import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db, collections } from "../lib/firestore";
import { RaterStats, Rating, RatingDirection, UserProfile } from "../types";

export class ReputationError extends Error {}

const DEFAULT_REPUTATION: UserProfile["reputation"] = {
  score: 50, // neutral starting point, not zero — nobody should start "in the hole"
  completedCount: 0,
  expiredCount: 0,
  ratingAvg: 0,
  ratingCount: 0,
  ratingWeightSum: 0,
};

export async function ensureUserProfile(userId: string, displayName: string, skills: string[] = []): Promise<void> {
  const ref = collections.users.doc(userId);
  const snap = await ref.get();
  if (snap.exists) return;
  const profile: Omit<UserProfile, "id"> = {
    displayName,
    skills,
    reputation: DEFAULT_REPUTATION,
    flagCount: 0,
    createdAt: FieldValue.serverTimestamp() as Timestamp,
  };
  await ref.set(profile);
}

/**
 * Score formula, deliberately simple and inspectable rather than a black box:
 *   score = 50
 *         + (onTimeRate - 0.5) * 40       // completion reliability, +/-20
 *         + (ratingAvg - 3) * 10          // rating quality on a 1-5 scale, +/-20
 *         - min(flagCount, 5) * 4         // diminishing penalty, capped so one bad week can't tank someone forever
 *   clamped to [0, 100]
 *
 * ratingAvg here is the *weighted* average — see computeRaterCredibilityWeight
 * below for how a chronic outlier rater's influence gets quietly reduced.
 *
 * This is a first pass, not gospel — the README explicitly invites
 * disagreement on the model. Change it in the open, in an issue.
 */
function computeScore(params: {
  completedCount: number;
  expiredCount: number;
  ratingAvg: number;
  ratingCount: number;
  flagCount: number;
}): number {
  const totalResolved = params.completedCount + params.expiredCount;
  const onTimeRate = totalResolved === 0 ? 0.5 : params.completedCount / totalResolved;
  const ratingComponent = params.ratingCount === 0 ? 0 : (params.ratingAvg - 3) * 10;

  const raw = 50 + (onTimeRate - 0.5) * 40 + ratingComponent - Math.min(params.flagCount, 5) * 4;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Reduces the influence of a rating based on how the rater scores things
 * *in general*, not just this one score. A rater with a long history of
 * unusually harsh ratings across many different resolvers gets their
 * ratings weighted down — quietly, with no flag or label attached to their
 * account, and no effect on anything except how much this one number moves
 * a resolver's average. Someone with a genuinely bad experience still
 * counts close to full weight; it's chronic outlier behavior that gets
 * dampened, not disagreement or a single bad day.
 *
 * - Needs at least MIN_HISTORY ratings given before any dampening applies,
 *   so a new account's first review is never discounted.
 * - Floor of 0.3 — a chronic harsh rater's voice is reduced, never erased.
 */
const BASELINE_AVG = 3.5;
const MIN_HISTORY_FOR_DAMPENING = 5;
const MIN_WEIGHT = 0.3;

function computeRaterCredibilityWeight(raterAvgGiven: number, raterGivenCount: number): number {
  if (raterGivenCount < MIN_HISTORY_FOR_DAMPENING) return 1.0;
  if (raterAvgGiven >= BASELINE_AVG - 0.5) return 1.0;

  const span = BASELINE_AVG - 0.5 - 1.0; // distance from "starts dampening" down to the lowest possible average (1.0)
  const distanceBelow = BASELINE_AVG - 0.5 - raterAvgGiven;
  const t = Math.min(1, distanceBelow / span);
  return 1.0 - t * (1.0 - MIN_WEIGHT);
}

export async function recordCompletion(userId: string): Promise<void> {
  await db.runTransaction(async (tx) => {
    const ref = collections.users.doc(userId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ReputationError("User profile not found");
    const profile = snap.data() as UserProfile;

    const rep = profile.reputation;
    const completedCount = rep.completedCount + 1;
    const score = computeScore({
      completedCount,
      expiredCount: rep.expiredCount,
      ratingAvg: rep.ratingAvg,
      ratingCount: rep.ratingCount,
      flagCount: profile.flagCount,
    });

    tx.update(ref, {
      "reputation.completedCount": completedCount,
      "reputation.score": score,
    });
  });
}

export async function recordExpiry(userId: string): Promise<void> {
  await db.runTransaction(async (tx) => {
    const ref = collections.users.doc(userId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ReputationError("User profile not found");
    const profile = snap.data() as UserProfile;

    const rep = profile.reputation;
    const expiredCount = rep.expiredCount + 1;
    const flagCount = profile.flagCount + 1;
    const score = computeScore({
      completedCount: rep.completedCount,
      expiredCount,
      ratingAvg: rep.ratingAvg,
      ratingCount: rep.ratingCount,
      flagCount,
    });

    tx.update(ref, {
      "reputation.expiredCount": expiredCount,
      flagCount,
      "reputation.score": score,
    });
  });
}

interface SubmitRatingInput {
  requestId: string;
  fromUserId: string;
  toUserId: string;
  direction: RatingDirection;
  score: 1 | 2 | 3 | 4 | 5;
  comment?: string;
}

/**
 * Mutual rating — requesters rate resolvers, and resolvers rate requesters
 * (was the context clear, did payout match what was promised, etc).
 * Credibility weighting only applies to requester_to_resolver ratings —
 * that's the direction where a chronic harsh rater can otherwise dominate
 * someone's livelihood-facing score.
 */
export async function submitRating(input: SubmitRatingInput): Promise<void> {
  const ratingRef = collections.ratings.doc();
  const userRef = collections.users.doc(input.toUserId);
  const raterStatsRef = collections.raterStats.doc(input.fromUserId);

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new ReputationError("Target user profile not found");
    const profile = userSnap.data() as UserProfile;
    const rep = profile.reputation;

    const raterStatsSnap = await tx.get(raterStatsRef);
    const raterStats = raterStatsSnap.exists ? (raterStatsSnap.data() as RaterStats) : { id: input.fromUserId, givenCount: 0, givenSum: 0 };

    // Update the rater's own giving history first, so the weight for *this*
    // rating reflects their pattern including this submission.
    const newGivenCount = raterStats.givenCount + 1;
    const newGivenSum = raterStats.givenSum + input.score;
    const raterAvgGiven = newGivenSum / newGivenCount;

    const weight = input.direction === "requester_to_resolver" ? computeRaterCredibilityWeight(raterAvgGiven, newGivenCount) : 1.0;

    const newWeightSum = rep.ratingWeightSum + weight;
    const newAvg = newWeightSum === 0 ? 0 : (rep.ratingAvg * rep.ratingWeightSum + weight * input.score) / newWeightSum;
    const newCount = rep.ratingCount + 1;

    const newScore = computeScore({
      completedCount: rep.completedCount,
      expiredCount: rep.expiredCount,
      ratingAvg: newAvg,
      ratingCount: newCount,
      flagCount: profile.flagCount,
    });

    const rating: Omit<Rating, "id"> = {
      requestId: input.requestId,
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      direction: input.direction,
      score: input.score,
      comment: input.comment,
      createdAt: FieldValue.serverTimestamp() as Timestamp,
    };

    tx.set(ratingRef, rating);
    tx.set(raterStatsRef, { id: input.fromUserId, givenCount: newGivenCount, givenSum: newGivenSum } satisfies RaterStats);
    tx.update(userRef, {
      "reputation.ratingCount": newCount,
      "reputation.ratingAvg": newAvg,
      "reputation.ratingWeightSum": newWeightSum,
      "reputation.score": newScore,
    });
  });
}

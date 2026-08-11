import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db, collections } from "../lib/firestore";
import { Rating, RatingDirection, UserProfile } from "../types";

export class ReputationError extends Error {}

const DEFAULT_REPUTATION: UserProfile["reputation"] = {
  score: 50, // neutral starting point, not zero — nobody should start "in the hole"
  completedCount: 0,
  expiredCount: 0,
  ratingAvg: 0,
  ratingCount: 0,
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

/** Mutual rating — requesters rate workers, and workers rate requesters (was the context clear, did payout match what was promised, etc). */
export async function submitRating(input: SubmitRatingInput): Promise<void> {
  const ratingRef = collections.ratings.doc();
  const userRef = collections.users.doc(input.toUserId);

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new ReputationError("Target user profile not found");
    const profile = userSnap.data() as UserProfile;
    const rep = profile.reputation;

    const newCount = rep.ratingCount + 1;
    const newAvg = (rep.ratingAvg * rep.ratingCount + input.score) / newCount;
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
    tx.update(userRef, {
      "reputation.ratingCount": newCount,
      "reputation.ratingAvg": newAvg,
      "reputation.score": newScore,
    });
  });
}

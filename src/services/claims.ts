import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db, collections } from "../lib/firestore";
import { verifyCode } from "../lib/verification";
import { Claim, HitlRequest } from "../types";

export class ClaimError extends Error {}

const MAX_VERIFICATION_ATTEMPTS = 5;

/**
 * Claim a task. Uses a Firestore transaction so two resolvers hitting "claim"
 * within milliseconds of each other can't both win — one succeeds, the
 * other gets a clear error and can move to the next task on the board.
 */
export async function claimTask(requestId: string, resolverId: string): Promise<Claim> {
  const requestRef = collections.requests.doc(requestId);
  const claimRef = collections.claims.doc(requestId); // 1:1 with the request

  return db.runTransaction(async (tx) => {
    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists) {
      throw new ClaimError("Request not found");
    }
    const request = requestSnap.data() as HitlRequest;
    if (request.status !== "open") {
      throw new ClaimError(`Request is not open to claim (status: ${request.status})`);
    }

    const now = Timestamp.now();
    const deadlineAt = Timestamp.fromMillis(now.toMillis() + request.turnaroundMinutes * 60_000);

    const claim: Omit<Claim, "id"> = {
      requestId,
      resolverId,
      claimedAt: now,
      deadlineAt,
      status: "active",
      verificationAttempts: 0,
    };

    tx.update(requestRef, { status: "claimed" });
    tx.set(claimRef, claim);

    return { id: requestId, ...claim };
  });
}

/**
 * Worker marks the task done — but only with the completion verification
 * code the approver relayed to the actual client. This is the mechanism
 * that stops a resolver from self-certifying finished work: they need a
 * code that only the client the work was done for actually has. Wrong
 * codes count against a per-claim attempt limit; exceeding it locks the
 * claim entirely rather than letting someone brute-force a 6-digit code —
 * an admin has to intervene from there.
 */
export async function completeTask(
  requestId: string,
  resolverId: string,
  verificationCode: string,
  submissionNote?: string
): Promise<void> {
  const requestRef = collections.requests.doc(requestId);
  const claimRef = collections.claims.doc(requestId);

  await db.runTransaction(async (tx) => {
    const [claimSnap, requestSnap] = await Promise.all([tx.get(claimRef), tx.get(requestRef)]);
    if (!claimSnap.exists) throw new ClaimError("No claim found for this request");
    if (!requestSnap.exists) throw new ClaimError("Request not found");

    const claim = claimSnap.data() as Claim;
    const request = requestSnap.data() as HitlRequest;

    if (claim.resolverId !== resolverId) {
      throw new ClaimError("Only the resolver who claimed this task can complete it");
    }
    if (claim.status !== "active") {
      throw new ClaimError(`Claim is not active (status: ${claim.status})`);
    }
    if (!request.verificationCodeHash) {
      // Shouldn't happen for a properly approved request, but fail closed rather than silently accepting anything.
      throw new ClaimError("This request has no verification code on file — cannot verify completion");
    }

    const isValid = verifyCode(verificationCode, request.verificationCodeHash);

    if (!isValid) {
      const attempts = claim.verificationAttempts + 1;
      if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
        tx.update(claimRef, { status: "verification_locked", verificationAttempts: attempts });
        throw new ClaimError("Too many incorrect verification codes — this claim is now locked and needs admin review");
      }
      tx.update(claimRef, { verificationAttempts: attempts });
      throw new ClaimError(`Incorrect verification code (attempt ${attempts} of ${MAX_VERIFICATION_ATTEMPTS})`);
    }

    tx.update(claimRef, {
      status: "completed",
      completedAt: FieldValue.serverTimestamp(),
      submissionNote: submissionNote ?? null,
      payoutStatus: "pending_payout",
    });
    tx.update(requestRef, { status: "completed" });
  });
}

/**
 * A resolver can release a claim voluntarily before the deadline, reopening
 * it for someone else without waiting out the clock or picking up a flag.
 */
export async function releaseClaim(requestId: string, resolverId: string): Promise<void> {
  const requestRef = collections.requests.doc(requestId);
  const claimRef = collections.claims.doc(requestId);

  await db.runTransaction(async (tx) => {
    const claimSnap = await tx.get(claimRef);
    if (!claimSnap.exists) {
      throw new ClaimError("No claim found for this request");
    }
    const claim = claimSnap.data() as Claim;
    if (claim.resolverId !== resolverId) {
      throw new ClaimError("Only the resolver who claimed this task can release it");
    }
    if (claim.status !== "active") {
      throw new ClaimError(`Claim is not active (status: ${claim.status})`);
    }

    tx.delete(claimRef);
    tx.update(requestRef, { status: "open" });
  });
}

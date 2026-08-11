import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db, collections } from "../lib/firestore";
import { Claim, HitlRequest } from "../types";

export class ClaimError extends Error {}

/**
 * Claim a task. Uses a Firestore transaction so two workers hitting "claim"
 * within milliseconds of each other can't both win — one succeeds, the
 * other gets a clear error and can move to the next task on the board.
 */
export async function claimTask(requestId: string, workerId: string): Promise<Claim> {
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
      workerId,
      claimedAt: now,
      deadlineAt,
      status: "active",
    };

    tx.update(requestRef, { status: "claimed" });
    tx.set(claimRef, claim);

    return { id: requestId, ...claim };
  });
}

/**
 * Worker marks the task done. Requester still rates the work afterward —
 * this just closes the claim and flips the request to completed.
 */
export async function completeTask(requestId: string, workerId: string, submissionNote?: string): Promise<void> {
  const requestRef = collections.requests.doc(requestId);
  const claimRef = collections.claims.doc(requestId);

  await db.runTransaction(async (tx) => {
    const claimSnap = await tx.get(claimRef);
    if (!claimSnap.exists) {
      throw new ClaimError("No claim found for this request");
    }
    const claim = claimSnap.data() as Claim;
    if (claim.workerId !== workerId) {
      throw new ClaimError("Only the worker who claimed this task can complete it");
    }
    if (claim.status !== "active") {
      throw new ClaimError(`Claim is not active (status: ${claim.status})`);
    }

    tx.update(claimRef, {
      status: "completed",
      completedAt: FieldValue.serverTimestamp(),
      submissionNote: submissionNote ?? null,
    });
    tx.update(requestRef, { status: "completed" });
  });
}

/**
 * A worker can release a claim voluntarily before the deadline, reopening
 * it for someone else without waiting out the clock or picking up a flag.
 */
export async function releaseClaim(requestId: string, workerId: string): Promise<void> {
  const requestRef = collections.requests.doc(requestId);
  const claimRef = collections.claims.doc(requestId);

  await db.runTransaction(async (tx) => {
    const claimSnap = await tx.get(claimRef);
    if (!claimSnap.exists) {
      throw new ClaimError("No claim found for this request");
    }
    const claim = claimSnap.data() as Claim;
    if (claim.workerId !== workerId) {
      throw new ClaimError("Only the worker who claimed this task can release it");
    }
    if (claim.status !== "active") {
      throw new ClaimError(`Claim is not active (status: ${claim.status})`);
    }

    tx.delete(claimRef);
    tx.update(requestRef, { status: "open" });
  });
}

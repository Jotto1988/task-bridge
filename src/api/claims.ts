import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as claims from "../services/claims";
import { recordCompletion } from "../services/reputation";

export const claimHitlTask = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to claim a task");
  const { requestId } = request.data ?? {};
  if (!requestId) throw new HttpsError("invalid-argument", "requestId is required");

  try {
    const claim = await claims.claimTask(requestId, request.auth.uid);
    return { claim };
  } catch (err) {
    // A failed claim (someone else got there first) is an expected outcome,
    // not a server error — surface it as "already-exists" so the client
    // can just refresh the board.
    throw new HttpsError("already-exists", (err as Error).message);
  }
});

export const completeHitlTask = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to complete a task");
  const { requestId, submissionNote } = request.data ?? {};
  if (!requestId) throw new HttpsError("invalid-argument", "requestId is required");

  try {
    await claims.completeTask(requestId, request.auth.uid, submissionNote);
    await recordCompletion(request.auth.uid);
    return { ok: true };
  } catch (err) {
    throw new HttpsError("failed-precondition", (err as Error).message);
  }
});

export const releaseHitlClaim = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to release a claim");
  const { requestId } = request.data ?? {};
  if (!requestId) throw new HttpsError("invalid-argument", "requestId is required");

  try {
    await claims.releaseClaim(requestId, request.auth.uid);
    return { ok: true };
  } catch (err) {
    throw new HttpsError("failed-precondition", (err as Error).message);
  }
});

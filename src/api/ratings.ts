import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as reputation from "../services/reputation";
import { RatingDirection } from "../types";

export const rateHitlParticipant = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to submit a rating");
  const { requestId, toUserId, direction, score, comment } = request.data ?? {};

  if (!requestId || !toUserId || !direction || !score) {
    throw new HttpsError("invalid-argument", "requestId, toUserId, direction, and score are required");
  }
  if (score < 1 || score > 5) {
    throw new HttpsError("invalid-argument", "score must be between 1 and 5");
  }

  try {
    await reputation.submitRating({
      requestId,
      fromUserId: request.auth.uid,
      toUserId,
      direction: direction as RatingDirection,
      score,
      comment,
    });
    return { ok: true };
  } catch (err) {
    throw new HttpsError("failed-precondition", (err as Error).message);
  }
});

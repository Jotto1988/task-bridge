import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as finance from "../services/finance";

/** Admin-only. Verified completion (a correct code entered) is a prerequisite enforced inside the service, not here. */
export const releasePayout = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to release a payout");
  const { requestId } = request.data ?? {};
  if (!requestId) throw new HttpsError("invalid-argument", "requestId is required");

  try {
    await finance.releasePayout(requestId, request.auth.uid);
    return { ok: true };
  } catch (err) {
    throw new HttpsError("permission-denied", (err as Error).message);
  }
});

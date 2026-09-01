import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as apiKeys from "../services/apiKeys";

/** Admin-only. Response includes the plaintext key ONCE — the caller must save it now, it can't be retrieved again. */
export const createApiKey = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const { orgId, label } = request.data ?? {};
  if (!orgId || !label) throw new HttpsError("invalid-argument", "orgId and label are required");

  try {
    const result = await apiKeys.createApiKey(orgId, label, request.auth.uid);
    return result; // { id, fullKey }
  } catch (err) {
    throw new HttpsError("permission-denied", (err as Error).message);
  }
});

export const listApiKeys = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const { orgId } = request.data ?? {};
  if (!orgId) throw new HttpsError("invalid-argument", "orgId is required");

  try {
    const keys = await apiKeys.listApiKeys(orgId, request.auth.uid);
    return { keys };
  } catch (err) {
    throw new HttpsError("permission-denied", (err as Error).message);
  }
});

export const revokeApiKey = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const { orgId, keyId } = request.data ?? {};
  if (!orgId || !keyId) throw new HttpsError("invalid-argument", "orgId and keyId are required");

  try {
    await apiKeys.revokeApiKey(orgId, keyId, request.auth.uid);
    return { ok: true };
  } catch (err) {
    throw new HttpsError("permission-denied", (err as Error).message);
  }
});

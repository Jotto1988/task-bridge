import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { collections } from "../lib/firestore";
import { extractPrefix, generateApiKey, hashApiKey, verifyApiKeyHash } from "../lib/apiKey";
import { ApiKey } from "../types";
import { assertIsAdmin } from "./orgMembers";

export class ApiKeyError extends Error {}

/** Admin-only. Returns the plaintext key exactly once — it is never retrievable again after this call. */
export async function createApiKey(orgId: string, label: string, createdBy: string): Promise<{ id: string; fullKey: string }> {
  await assertIsAdmin(orgId, createdBy);

  const { fullKey, prefix } = generateApiKey();
  const ref = collections.apiKeys.doc();
  const doc: Omit<ApiKey, "id"> = {
    orgId,
    label,
    prefix,
    hashedKey: hashApiKey(fullKey),
    status: "active",
    createdBy,
    createdAt: FieldValue.serverTimestamp() as Timestamp,
  };
  await ref.set(doc);

  return { id: ref.id, fullKey };
}

/** Admin-only. Metadata only — prefix and label, never the key or its hash. */
export async function listApiKeys(orgId: string, callerId: string): Promise<Omit<ApiKey, "hashedKey">[]> {
  await assertIsAdmin(orgId, callerId);
  const snap = await collections.apiKeys.where("orgId", "==", orgId).get();
  return snap.docs.map((d) => {
    const { hashedKey, ...rest } = d.data() as Omit<ApiKey, "id">;
    return { id: d.id, ...rest };
  });
}

export async function revokeApiKey(orgId: string, keyId: string, revokedBy: string): Promise<void> {
  await assertIsAdmin(orgId, revokedBy);
  const ref = collections.apiKeys.doc(keyId);
  const snap = await ref.get();
  if (!snap.exists || (snap.data() as ApiKey).orgId !== orgId) {
    throw new ApiKeyError("API key not found for this organization");
  }
  await ref.update({
    status: "revoked",
    revokedAt: FieldValue.serverTimestamp(),
    revokedBy,
  });
}

/**
 * Looks up a raw key from an incoming request by its prefix (an indexed
 * Firestore query — full keys are never stored, so this can't be a
 * lookup by the key itself), then verifies the hash with a timing-safe
 * comparison, checks it hasn't been revoked, and records last-used.
 * Returns the orgId the key belongs to, or throws.
 */
export async function verifyApiKey(rawKey: string): Promise<{ orgId: string; keyId: string }> {
  if (!rawKey || !rawKey.startsWith("tb_live_")) {
    throw new ApiKeyError("Malformed API key");
  }
  const prefix = extractPrefix(rawKey);

  const snap = await collections.apiKeys.where("prefix", "==", prefix).limit(1).get();
  if (snap.empty) {
    throw new ApiKeyError("Invalid API key");
  }

  const doc = snap.docs[0];
  const key = doc.data() as ApiKey;

  if (key.status === "revoked") {
    throw new ApiKeyError("This API key has been revoked");
  }
  if (!verifyApiKeyHash(rawKey, key.hashedKey)) {
    throw new ApiKeyError("Invalid API key");
  }

  // Best-effort — don't block the caller's actual request on this write.
  doc.ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => {});

  return { orgId: key.orgId, keyId: doc.id };
}

import { randomBytes, createHash, timingSafeEqual } from "crypto";

/**
 * Company AI systems authenticate with an API key, not a Firebase Auth
 * token — a human signing in through a browser is a fundamentally
 * different kind of caller than a company's backend calling an API.
 * Same shape as Stripe/GitHub/Twilio keys: a readable prefix for display
 * and indexed lookup, a long random secret, only the hash ever stored.
 */

const PREFIX_LENGTH = 12; // "tb_live_" + 4 hex chars — enough to look up by, never enough to guess the rest
const SECRET_BYTES = 24; // 24 random bytes -> 48 hex chars of actual secret

export function generateApiKey(): { fullKey: string; prefix: string } {
  const secret = randomBytes(SECRET_BYTES).toString("hex");
  const fullKey = `tb_live_${secret}`;
  const prefix = fullKey.slice(0, PREFIX_LENGTH);
  return { fullKey, prefix };
}

export function extractPrefix(fullKey: string): string {
  return fullKey.slice(0, PREFIX_LENGTH);
}

export function hashApiKey(fullKey: string): string {
  return createHash("sha256").update(fullKey).digest("hex");
}

export function verifyApiKeyHash(candidate: string, storedHash: string): boolean {
  const candidateHash = hashApiKey(candidate);
  const a = Buffer.from(candidateHash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

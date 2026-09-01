import { randomInt, createHash, timingSafeEqual } from "crypto";

/**
 * A resolver should never be able to self-certify that a job is done — the
 * whole point of this code is that it comes from the client the work was
 * actually done for, not from the person claiming to have done it. The
 * approver generates it at approval time and relays it to the client out
 * of band (SMS, a phone call, a printed slip at a site visit); only
 * entering the exact code marks a claim complete.
 */

const CODE_LENGTH = 6;

/** 6-digit numeric code — short enough to read over a phone call or print on a slip. */
export function generateVerificationCode(): string {
  return randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, "0");
}

/** Only the hash is ever stored — the plaintext code exists only in the approver's one-time response. */
export function hashVerificationCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Timing-safe comparison so response time can't leak how many characters of a guess were correct. */
export function verifyCode(candidate: string, storedHash: string): boolean {
  const candidateHash = hashVerificationCode(candidate);
  const a = Buffer.from(candidateHash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

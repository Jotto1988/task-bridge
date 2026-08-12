import { db, collections } from "../lib/firestore";
import { Claim, HitlRequest } from "../types";
import { assertIsAdmin } from "./orgMembers";

export class FinanceError extends Error {}

/**
 * The last step in the flow: a verified-complete claim moves from
 * "pending_payout" to "released." This is deliberately Admin-only, not
 * Approver — the same separation as a guild desk where the person who
 * signs off on a quest and the person who hands over the reward aren't
 * assumed to be the same authority. This function is a hook, not a real
 * payment integration: it flips the status so a real deployment can wire
 * this to an actual payout rail (PayFast, a bank transfer, whatever) —
 * see the comment inline for where that call belongs.
 */
export async function releasePayout(requestId: string, releasedBy: string): Promise<void> {
  const requestRef = collections.requests.doc(requestId);
  const claimRef = collections.claims.doc(requestId);

  const requestSnap = await requestRef.get();
  if (!requestSnap.exists) throw new FinanceError("Request not found");
  const request = requestSnap.data() as HitlRequest;

  await assertIsAdmin(request.submittedBy.orgId, releasedBy);

  await db.runTransaction(async (tx) => {
    const claimSnap = await tx.get(claimRef);
    if (!claimSnap.exists) throw new FinanceError("No claim found for this request");
    const claim = claimSnap.data() as Claim;

    if (claim.status !== "completed") {
      throw new FinanceError(`Claim is not in a completed/verified state (status: ${claim.status})`);
    }
    if (claim.payoutStatus === "released") {
      throw new FinanceError("Payout has already been released for this claim");
    }

    // Real payout integration goes here — e.g. call out to PayFast or a
    // bank transfer API with claim.resolverId and request.payoutCents/currency.
    // Left as a hook deliberately: this repo doesn't assume any specific
    // payment rail or region.

    tx.update(claimRef, { payoutStatus: "released" });
  });
}

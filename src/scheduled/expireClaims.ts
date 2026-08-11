import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { Timestamp } from "firebase-admin/firestore";
import { db, collections } from "../lib/firestore";
import { Claim } from "../types";
import { recordExpiry } from "../services/reputation";

/**
 * Runs every 5 minutes. Finds active claims whose deadline has passed,
 * reopens the underlying request, marks the claim expired, and flags
 * the resolver. Batched sequentially and kept simple deliberately — this
 * is the kind of function you want to be able to read in one sitting
 * when something's wrong with it in production.
 */
export const expireStaleClaims = onSchedule("every 5 minutes", async () => {
  const now = Timestamp.now();
  const staleSnap = await collections.claims
    .where("status", "==", "active")
    .where("deadlineAt", "<=", now)
    .get();

  if (staleSnap.empty) {
    logger.info("No stale claims found.");
    return;
  }

  logger.info(`Found ${staleSnap.size} stale claim(s) to expire.`);

  for (const doc of staleSnap.docs) {
    const claim = doc.data() as Claim;
    try {
      await db.runTransaction(async (tx) => {
        const claimRef = collections.claims.doc(doc.id);
        const requestRef = collections.requests.doc(claim.requestId);

        const freshClaim = await tx.get(claimRef);
        if (!freshClaim.exists || (freshClaim.data() as Claim).status !== "active") {
          // Already resolved (completed or released) between query and now — skip.
          return;
        }

        tx.update(claimRef, { status: "expired" });
        tx.update(requestRef, { status: "open" });
      });

      await recordExpiry(claim.resolverId);

      await collections.flags.add({
        userId: claim.resolverId,
        requestId: claim.requestId,
        reason: "expired_claim",
        createdAt: Timestamp.now(),
      });
    } catch (err) {
      logger.error(`Failed to expire claim ${doc.id}`, err);
    }
  }
});

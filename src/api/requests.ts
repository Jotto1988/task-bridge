import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as hitl from "../services/hitlRequests";

/**
 * Submitted by (or on behalf of) an AI system. In production this is where
 * you'd verify a system/API-key credential rather than a normal user auth
 * token — an AI process is a different kind of caller than a human.
 */
export const submitHitlRequest = onCall(async (request) => {
  const { orgId, systemLabel, title, description, context, requiredSkills, payoutCents, currency, turnaroundMinutes } =
    request.data ?? {};

  if (!orgId || !title || !description) {
    throw new HttpsError("invalid-argument", "orgId, title, and description are required");
  }

  try {
    const id = await hitl.submitRequest({
      orgId,
      systemLabel: systemLabel ?? "unspecified",
      title,
      description,
      context: context ?? {},
      requiredSkills: requiredSkills ?? [],
      payoutCents,
      currency: currency ?? "USD",
      turnaroundMinutes,
    });
    return { id };
  } catch (err) {
    throw new HttpsError("invalid-argument", (err as Error).message);
  }
});

export const approveHitlRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to approve requests");
  const { requestId } = request.data ?? {};
  if (!requestId) throw new HttpsError("invalid-argument", "requestId is required");

  // TODO: check request.auth.token for an "approver" custom claim before allowing this.
  await hitl.approveRequest(requestId, request.auth.uid);
  return { ok: true };
});

export const rejectHitlRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to reject requests");
  const { requestId, reason } = request.data ?? {};
  if (!requestId || !reason) throw new HttpsError("invalid-argument", "requestId and reason are required");

  await hitl.rejectRequest(requestId, request.auth.uid, reason);
  return { ok: true };
});

export const listOpenHitlRequests = onCall(async (request) => {
  const { skill, limit } = request.data ?? {};
  const results = await hitl.listOpenRequests(skill, limit);
  return { requests: results };
});

export const listPendingHitlRequests = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to view the approval queue");
  // TODO: check for "approver" custom claim.
  const results = await hitl.listPendingApproval();
  return { requests: results };
});

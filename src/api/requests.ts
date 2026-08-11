import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as hitl from "../services/hitlRequests";

/**
 * Submitted by (or on behalf of) an AI system. In production this is where
 * you'd verify a system/API-key credential rather than a normal user auth
 * token — an AI process is a different kind of caller than a human.
 */
export const submitHitlRequest = onCall(async (request) => {
  const {
    orgId,
    systemLabel,
    category,
    title,
    description,
    attireGuidance,
    context,
    requiredSkills,
    payoutCents,
    currency,
    turnaroundMinutes,
  } = request.data ?? {};

  if (!orgId || !category || !title || !description) {
    throw new HttpsError("invalid-argument", "orgId, category, title, and description are required");
  }

  try {
    const id = await hitl.submitRequest({
      orgId,
      origin: "ai_system",
      systemLabel: systemLabel ?? "unspecified",
      category,
      title,
      description,
      attireGuidance,
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

/**
 * The ABSA-style path: a company's own customer asks for help directly,
 * with no AI involved in raising it at all. Requires a signed-in user so
 * the board can't be spammed anonymously, but the input surface is
 * deliberately simpler than the AI-system path — a customer describing a
 * problem shouldn't need to know about skills tags or payout structuring.
 */
export const submitCustomerHelpRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to request help");
  const { orgId, category, title, description, payoutCents, currency, turnaroundMinutes } = request.data ?? {};

  if (!orgId || !category || !title || !description) {
    throw new HttpsError("invalid-argument", "orgId, category, title, and description are required");
  }

  try {
    const id = await hitl.submitRequest({
      orgId,
      origin: "customer_request",
      systemLabel: "customer self-service request",
      category,
      title,
      description,
      context: { requestedByUserId: request.auth.uid },
      requiredSkills: [],
      payoutCents,
      currency: currency ?? "ZAR",
      turnaroundMinutes,
    });
    return { id };
  } catch (err) {
    throw new HttpsError("invalid-argument", (err as Error).message);
  }
});

export const approveHitlRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to approve requests");
  const { requestId, attireGuidance } = request.data ?? {};
  if (!requestId) throw new HttpsError("invalid-argument", "requestId is required");

  // TODO: check request.auth.token for an "approver" custom claim before allowing this.
  await hitl.approveRequest(requestId, request.auth.uid, attireGuidance);
  return { ok: true };
});

export const rejectHitlRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to reject requests");
  const { requestId, reason } = request.data ?? {};
  if (!requestId || !reason) throw new HttpsError("invalid-argument", "requestId and reason are required");

  await hitl.rejectRequest(requestId, request.auth.uid, reason);
  return { ok: true };
});

/** The approver handled it personally — no job ever gets published. */
export const resolveHitlRequestDirectly = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to resolve requests");
  const { requestId, resolutionNote } = request.data ?? {};
  if (!requestId || !resolutionNote) throw new HttpsError("invalid-argument", "requestId and resolutionNote are required");

  try {
    await hitl.resolveDirectly(requestId, request.auth.uid, resolutionNote);
    return { ok: true };
  } catch (err) {
    throw new HttpsError("failed-precondition", (err as Error).message);
  }
});

export const listOpenHitlRequests = onCall(async (request) => {
  const { skill, category, limit } = request.data ?? {};
  const results = await hitl.listOpenRequests(skill, category, limit);
  return { requests: results };
});

export const listPendingHitlRequests = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to view the approval queue");
  // TODO: check for "approver" custom claim.
  const results = await hitl.listPendingApproval();
  return { requests: results };
});

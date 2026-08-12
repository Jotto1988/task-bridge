import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as hitl from "../services/hitlRequests";
import { assertIsApproverOrAdmin, assertIsAdmin } from "../services/orgMembers";
import { collections } from "../lib/firestore";
import { HitlRequest } from "../types";

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
 * with no AI involved in raising it at all.
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

/**
 * The real trust boundary. Only an Approver or Admin for THIS SPECIFIC
 * request's org can approve it — not any signed-in user, and not an
 * approver from a different org. Returns the plaintext verification code
 * once, for the approver to relay to the client — it is never retrievable
 * again after this response.
 */
export const approveHitlRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to approve requests");
  const { requestId, attireGuidance, approverNotes } = request.data ?? {};
  if (!requestId) throw new HttpsError("invalid-argument", "requestId is required");

  const reqSnap = await collections.requests.doc(requestId).get();
  if (!reqSnap.exists) throw new HttpsError("not-found", "Request not found");
  const orgId = (reqSnap.data() as HitlRequest).submittedBy.orgId;

  try {
    await assertIsApproverOrAdmin(orgId, request.auth.uid);
    const result = await hitl.approveRequest(requestId, request.auth.uid, {
      attireGuidanceOverride: attireGuidance,
      approverNotes,
    });
    return result; // { verificationCode }
  } catch (err) {
    throw new HttpsError("permission-denied", (err as Error).message);
  }
});

export const rejectHitlRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to reject requests");
  const { requestId, reason } = request.data ?? {};
  if (!requestId || !reason) throw new HttpsError("invalid-argument", "requestId and reason are required");

  const reqSnap = await collections.requests.doc(requestId).get();
  if (!reqSnap.exists) throw new HttpsError("not-found", "Request not found");
  const orgId = (reqSnap.data() as HitlRequest).submittedBy.orgId;

  try {
    await assertIsApproverOrAdmin(orgId, request.auth.uid);
    await hitl.rejectRequest(requestId, request.auth.uid, reason);
    return { ok: true };
  } catch (err) {
    throw new HttpsError("permission-denied", (err as Error).message);
  }
});

/** The approver handled it personally — no job, no verification code, no resolver ever needed. */
export const resolveHitlRequestDirectly = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to resolve requests");
  const { requestId, resolutionNote } = request.data ?? {};
  if (!requestId || !resolutionNote) throw new HttpsError("invalid-argument", "requestId and resolutionNote are required");

  const reqSnap = await collections.requests.doc(requestId).get();
  if (!reqSnap.exists) throw new HttpsError("not-found", "Request not found");
  const orgId = (reqSnap.data() as HitlRequest).submittedBy.orgId;

  try {
    await assertIsApproverOrAdmin(orgId, request.auth.uid);
    await hitl.resolveDirectly(requestId, request.auth.uid, resolutionNote);
    return { ok: true };
  } catch (err) {
    throw new HttpsError("permission-denied", (err as Error).message);
  }
});

export const listOpenHitlRequests = onCall(async (request) => {
  const { skill, category, limit } = request.data ?? {};
  const results = await hitl.listOpenRequests(skill, category, limit);
  return { requests: results };
});

export const listPendingHitlRequests = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to view the approval queue");
  const { orgId } = request.data ?? {};
  if (!orgId) throw new HttpsError("invalid-argument", "orgId is required");

  try {
    await assertIsApproverOrAdmin(orgId, request.auth.uid);
    const results = await hitl.listPendingApproval();
    // Filtered to this org — listPendingApproval itself isn't org-scoped, so narrow here.
    return { requests: results.filter((r) => r.submittedBy.orgId === orgId) };
  } catch (err) {
    throw new HttpsError("permission-denied", (err as Error).message);
  }
});

/** "Admin sees all" — every request for the org, any status. Admin-only, not Approver. */
export const listOrgRequests = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const { orgId } = request.data ?? {};
  if (!orgId) throw new HttpsError("invalid-argument", "orgId is required");

  try {
    await assertIsAdmin(orgId, request.auth.uid);
    const results = await hitl.listAllRequestsForOrg(orgId);
    return { requests: results };
  } catch (err) {
    throw new HttpsError("permission-denied", (err as Error).message);
  }
});

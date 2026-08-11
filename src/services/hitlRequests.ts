import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { collections } from "../lib/firestore";
import { generateTermsOfService } from "../lib/termsOfService";
import { DEFAULT_ATTIRE_BY_CATEGORY, HitlRequest, Organization, RequestOrigin, RequestStatus, TaskCategory } from "../types";
import { assertCanSubmit, recordApprovalOutcome } from "./organizations";

export class HitlRequestError extends Error {}

interface SubmitRequestInput {
  orgId: string;
  origin: RequestOrigin;
  systemLabel: string;
  category: TaskCategory;
  title: string;
  description: string;
  /** Optional — falls back to the category default so requests never ship with blank guidance. */
  attireGuidance?: string;
  context: Record<string, unknown>;
  requiredSkills: string[];
  payoutCents: number;
  currency: string;
  turnaroundMinutes: number;
}

/**
 * Called by (or on behalf of) an AI system, OR by a company's own customer
 * asking for help directly (origin: "customer_request") — the platform
 * doesn't require an AI to be involved at all. Either way it lands in
 * pending_approval; a human decides what happens next.
 */
export async function submitRequest(input: SubmitRequestInput): Promise<string> {
  if (input.payoutCents <= 0) {
    throw new HitlRequestError("payoutCents must be positive");
  }
  if (input.turnaroundMinutes <= 0) {
    throw new HitlRequestError("turnaroundMinutes must be positive");
  }

  // Throws if the org is suspended or already at its concurrent-request cap.
  await assertCanSubmit(input.orgId);

  const orgSnap = await collections.organizations.doc(input.orgId).get();
  if (!orgSnap.exists) throw new HitlRequestError("Organization not found");
  const org = orgSnap.data() as Organization;

  const ref = collections.requests.doc();
  const doc: Omit<HitlRequest, "id"> = {
    submittedBy: { orgId: input.orgId, origin: input.origin, systemLabel: input.systemLabel },
    category: input.category,
    title: input.title,
    description: input.description,
    attireGuidance: input.attireGuidance?.trim() || DEFAULT_ATTIRE_BY_CATEGORY[input.category],
    termsOfService: generateTermsOfService({
      category: input.category,
      payoutCents: input.payoutCents,
      currency: input.currency,
      turnaroundMinutes: input.turnaroundMinutes,
      orgName: org.name,
    }),
    context: input.context ?? {},
    requiredSkills: input.requiredSkills ?? [],
    payoutCents: input.payoutCents,
    currency: input.currency,
    turnaroundMinutes: input.turnaroundMinutes,
    status: "pending_approval",
    createdAt: FieldValue.serverTimestamp() as Timestamp,
  };
  await ref.set(doc);
  return ref.id;
}

/**
 * Human sign-off. This is the trust boundary between "AI or a customer
 * raised it" and "the board can see it." The approver gets a last chance
 * to correct the attire/context guidance before it goes public — this is
 * deliberate: the person approving usually knows the client site or
 * situation better than whatever raised the request in the first place.
 */
export async function approveRequest(requestId: string, approverId: string, attireGuidanceOverride?: string): Promise<void> {
  const ref = collections.requests.doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new HitlRequestError("Request not found");
  const request = snap.data() as HitlRequest;

  const update: Partial<HitlRequest> = {
    status: "open" satisfies RequestStatus,
    approvedBy: approverId,
    approvedAt: FieldValue.serverTimestamp() as Timestamp,
  };
  if (attireGuidanceOverride?.trim()) {
    update.attireGuidance = attireGuidanceOverride.trim();
  }

  await ref.update(update);
  await recordApprovalOutcome(request.submittedBy.orgId, true);
}

export async function rejectRequest(requestId: string, approverId: string, reason: string): Promise<void> {
  const ref = collections.requests.doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new HitlRequestError("Request not found");
  const request = snap.data() as HitlRequest;

  await ref.update({
    status: "rejected" satisfies RequestStatus,
    approvedBy: approverId,
    approvedAt: FieldValue.serverTimestamp(),
    rejectionReason: reason,
  });

  await recordApprovalOutcome(request.submittedBy.orgId, false);
}

/**
 * The ABSA-style path: a customer asks for help, and the approver is able
 * to sort it out directly — a phone call, a quick fix, whatever — without
 * ever needing to publish a paid job or involve a resolver at all. Counts
 * toward the org's good-faith track record the same as an approval does,
 * since it means the org engaged with the request rather than ignoring it.
 */
export async function resolveDirectly(requestId: string, approverId: string, resolutionNote: string): Promise<void> {
  const ref = collections.requests.doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new HitlRequestError("Request not found");
  const request = snap.data() as HitlRequest;
  if (request.status !== "pending_approval") {
    throw new HitlRequestError(`Request is not pending approval (status: ${request.status})`);
  }

  await ref.update({
    status: "resolved_directly" satisfies RequestStatus,
    approvedBy: approverId,
    approvedAt: FieldValue.serverTimestamp(),
    resolutionNote,
  });

  await recordApprovalOutcome(request.submittedBy.orgId, true);
}

/** Public job board — open tasks only, optionally filtered by a skill or category tag. */
export async function listOpenRequests(skillFilter?: string, categoryFilter?: TaskCategory, limit = 50): Promise<HitlRequest[]> {
  let query = collections.requests.where("status", "==", "open" satisfies RequestStatus).limit(limit);
  if (skillFilter) {
    query = query.where("requiredSkills", "array-contains", skillFilter);
  }
  if (categoryFilter) {
    query = query.where("category", "==", categoryFilter);
  }
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HitlRequest, "id">) }));
}

/** Queue for human approvers — requests waiting on sign-off or direct resolution. */
export async function listPendingApproval(limit = 50): Promise<HitlRequest[]> {
  const snap = await collections.requests
    .where("status", "==", "pending_approval" satisfies RequestStatus)
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HitlRequest, "id">) }));
}

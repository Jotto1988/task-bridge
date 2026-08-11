import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { collections } from "../lib/firestore";
import { HitlRequest, RequestStatus } from "../types";

export class HitlRequestError extends Error {}

interface SubmitRequestInput {
  orgId: string;
  systemLabel: string;
  title: string;
  description: string;
  context: Record<string, unknown>;
  requiredSkills: string[];
  payoutCents: number;
  currency: string;
  turnaroundMinutes: number;
}

/** Called by (or on behalf of) an AI system. Lands in pending_approval — never goes straight to the board. */
export async function submitRequest(input: SubmitRequestInput): Promise<string> {
  if (input.payoutCents <= 0) {
    throw new HitlRequestError("payoutCents must be positive");
  }
  if (input.turnaroundMinutes <= 0) {
    throw new HitlRequestError("turnaroundMinutes must be positive");
  }

  const ref = collections.requests.doc();
  const doc: Omit<HitlRequest, "id"> = {
    submittedBy: { orgId: input.orgId, systemLabel: input.systemLabel },
    title: input.title,
    description: input.description,
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

/** Human sign-off. This is the trust boundary between "AI raised it" and "the board can see it." */
export async function approveRequest(requestId: string, approverId: string): Promise<void> {
  const ref = collections.requests.doc(requestId);
  await ref.update({
    status: "open" satisfies RequestStatus,
    approvedBy: approverId,
    approvedAt: FieldValue.serverTimestamp(),
  });
}

export async function rejectRequest(requestId: string, approverId: string, reason: string): Promise<void> {
  const ref = collections.requests.doc(requestId);
  await ref.update({
    status: "rejected" satisfies RequestStatus,
    approvedBy: approverId,
    approvedAt: FieldValue.serverTimestamp(),
    rejectionReason: reason,
  });
}

/** Public job board — open tasks only, optionally filtered by a skill tag. */
export async function listOpenRequests(skillFilter?: string, limit = 50): Promise<HitlRequest[]> {
  let query = collections.requests.where("status", "==", "open" satisfies RequestStatus).limit(limit);
  if (skillFilter) {
    query = query.where("requiredSkills", "array-contains", skillFilter);
  }
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HitlRequest, "id">) }));
}

/** Queue for human approvers — requests waiting on sign-off. */
export async function listPendingApproval(limit = 50): Promise<HitlRequest[]> {
  const snap = await collections.requests
    .where("status", "==", "pending_approval" satisfies RequestStatus)
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HitlRequest, "id">) }));
}

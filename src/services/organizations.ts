import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db, collections } from "../lib/firestore";
import { CompanyType, HitlRequest, Organization } from "../types";
import { addFirstAdmin } from "./orgMembers";

export class OrganizationError extends Error {}

const STARTING_REQUEST_CAP = 3;
const APPROVALS_TO_RAISE_CAP = 10; // clean approvals before the cap steps up
const CAP_INCREMENT = 5;
const MAX_CAP = 50;
const REJECTION_RATE_SUSPEND_THRESHOLD = 0.4; // suspend if >40% of resolved requests get rejected
const MIN_RESOLVED_BEFORE_SUSPEND_CHECK = 5; // don't judge an org on its first couple of submissions

interface RegisterOrgInput {
  name: string;
  companyType: CompanyType;
  logoUrl?: string;
  description?: string;
  createdByUserId: string;
}

/** The registering user automatically becomes the org's first Admin — someone has to be able to add Approvers before any Approver exists. */
export async function registerOrganization(input: RegisterOrgInput): Promise<string> {
  const ref = collections.organizations.doc();
  const doc: Omit<Organization, "id"> = {
    name: input.name,
    companyType: input.companyType,
    logoUrl: input.logoUrl,
    description: input.description,
    status: "unverified",
    requestCap: STARTING_REQUEST_CAP,
    approvedCount: 0,
    rejectedCount: 0,
    createdAt: FieldValue.serverTimestamp() as Timestamp,
  };
  await ref.set(doc);
  await addFirstAdmin(ref.id, input.createdByUserId);
  return ref.id;
}

/** Public-facing profile: org details plus its currently open jobs — what a resolver sees if they click through from the board. */
export async function getOrganizationProfile(
  orgId: string
): Promise<{ org: Organization; openRequests: HitlRequest[] }> {
  const orgSnap = await collections.organizations.doc(orgId).get();
  if (!orgSnap.exists) throw new OrganizationError("Organization not found");
  const org = { id: orgSnap.id, ...(orgSnap.data() as Omit<Organization, "id">) };

  const requestsSnap = await collections.requests
    .where("submittedBy.orgId", "==", orgId)
    .where("status", "==", "open")
    .get();
  const openRequests = requestsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HitlRequest, "id">) }));

  return { org, openRequests };
}

/** Directory listing for browsing by company, e.g. "show me all insurance orgs on the board." */
export async function listOrganizations(companyType?: CompanyType): Promise<Organization[]> {
  let query = collections.organizations.where("status", "in", ["unverified", "verified"]);
  if (companyType) {
    query = query.where("companyType", "==", companyType);
  }
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Organization, "id">) }));
}

/**
 * Enforces the concurrent-request cap before a new submission is allowed.
 * Called by hitlRequests.submitRequest before it creates the doc.
 */
export async function assertCanSubmit(orgId: string): Promise<void> {
  const orgSnap = await collections.organizations.doc(orgId).get();
  if (!orgSnap.exists) throw new OrganizationError("Organization not found");
  const org = orgSnap.data() as Organization;

  if (org.status === "suspended") {
    throw new OrganizationError("Organization is suspended and cannot submit new requests");
  }

  const activeSnap = await collections.requests
    .where("submittedBy.orgId", "==", orgId)
    .where("status", "in", ["pending_approval", "open", "claimed"])
    .get();

  if (activeSnap.size >= org.requestCap) {
    throw new OrganizationError(
      `Organization has reached its concurrent request cap (${org.requestCap}). Wait for existing requests to resolve.`
    );
  }
}

/**
 * Called after every approval/rejection to update the org's track record
 * and apply the trust mechanics: cap raises after a run of clean approvals,
 * auto-suspend if the rejection rate gets too high once there's enough
 * history to judge it fairly.
 */
export async function recordApprovalOutcome(orgId: string, wasApproved: boolean): Promise<void> {
  const ref = collections.organizations.doc(orgId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new OrganizationError("Organization not found");
    const org = snap.data() as Organization;

    const approvedCount = org.approvedCount + (wasApproved ? 1 : 0);
    const rejectedCount = org.rejectedCount + (wasApproved ? 0 : 1);
    const totalResolved = approvedCount + rejectedCount;

    const update: Partial<Organization> = { approvedCount, rejectedCount };

    // Raise the cap after enough clean approvals, capped at MAX_CAP.
    if (wasApproved && approvedCount % APPROVALS_TO_RAISE_CAP === 0 && org.requestCap < MAX_CAP) {
      update.requestCap = Math.min(org.requestCap + CAP_INCREMENT, MAX_CAP);
    }

    // Auto-suspend on a sustained high rejection rate, but only once
    // there's enough history that one or two rejections can't trigger it.
    if (totalResolved >= MIN_RESOLVED_BEFORE_SUSPEND_CHECK) {
      const rejectionRate = rejectedCount / totalResolved;
      if (rejectionRate > REJECTION_RATE_SUSPEND_THRESHOLD && org.status !== "suspended") {
        update.status = "suspended";
        update.suspendedAt = FieldValue.serverTimestamp() as Timestamp;
        update.suspendedReason = `Automatic: rejection rate ${(rejectionRate * 100).toFixed(0)}% exceeded threshold`;
      }
    }

    tx.update(ref, update);
  });
}

/** Manual override for an admin to lift a suspension after review. */
export async function reinstateOrganization(orgId: string): Promise<void> {
  const ref = collections.organizations.doc(orgId);
  await ref.update({
    status: "unverified", // back to unverified, not straight to verified — re-earn trust
    suspendedAt: FieldValue.delete(),
    suspendedReason: FieldValue.delete(),
  });
}

/** Manual promotion, e.g. after an admin does out-of-band identity/business verification. */
export async function verifyOrganization(orgId: string): Promise<void> {
  const ref = collections.organizations.doc(orgId);
  await ref.update({ status: "verified" });
}

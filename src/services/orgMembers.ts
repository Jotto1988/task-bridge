import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { collections } from "../lib/firestore";
import { OrgMember, OrgRole } from "../types";

export class OrgMemberError extends Error {}

function memberDocId(orgId: string, userId: string): string {
  return `${orgId}_${userId}`;
}

/** Called once, automatically, when an org is registered — the creator becomes its first Admin. */
export async function addFirstAdmin(orgId: string, userId: string): Promise<void> {
  const ref = collections.orgMembers.doc(memberDocId(orgId, userId));
  const doc: Omit<OrgMember, "id"> = {
    orgId,
    userId,
    role: "admin",
    addedBy: userId, // self — this is the bootstrap case
    createdAt: FieldValue.serverTimestamp() as Timestamp,
  };
  await ref.set(doc);
}

/**
 * Admin-only: bring on an Approver (or a co-Admin) for the org. This is
 * the "guild desk manager decides who else can approve quests" step.
 */
export async function addOrgMember(orgId: string, userId: string, role: OrgRole, addedBy: string): Promise<void> {
  await assertIsAdmin(orgId, addedBy);
  const ref = collections.orgMembers.doc(memberDocId(orgId, userId));
  const doc: Omit<OrgMember, "id"> = {
    orgId,
    userId,
    role,
    addedBy,
    createdAt: FieldValue.serverTimestamp() as Timestamp,
  };
  await ref.set(doc);
}

export async function removeOrgMember(orgId: string, userId: string, removedBy: string): Promise<void> {
  await assertIsAdmin(orgId, removedBy);
  await collections.orgMembers.doc(memberDocId(orgId, userId)).delete();
}

export async function getOrgRole(orgId: string, userId: string): Promise<OrgRole | null> {
  const snap = await collections.orgMembers.doc(memberDocId(orgId, userId)).get();
  if (!snap.exists) return null;
  return (snap.data() as OrgMember).role;
}

/** Admin can do everything an Approver can — "Admin sees all" — so this passes for either role. */
export async function assertIsApproverOrAdmin(orgId: string, userId: string): Promise<void> {
  const role = await getOrgRole(orgId, userId);
  if (role !== "admin" && role !== "approver") {
    throw new OrgMemberError("Must be an approver or admin for this organization");
  }
}

export async function assertIsAdmin(orgId: string, userId: string): Promise<void> {
  const role = await getOrgRole(orgId, userId);
  if (role !== "admin") {
    throw new OrgMemberError("Must be an admin for this organization");
  }
}

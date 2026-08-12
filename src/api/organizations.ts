import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as orgs from "../services/organizations";
import * as members from "../services/orgMembers";
import { CompanyType, OrgRole } from "../types";

/** The registering user becomes the org's first Admin automatically. */
export const registerOrganization = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to register an organization");
  const { name, companyType, logoUrl, description } = request.data ?? {};

  if (!name || !companyType) {
    throw new HttpsError("invalid-argument", "name and companyType are required");
  }

  try {
    const id = await orgs.registerOrganization({ name, companyType, logoUrl, description, createdByUserId: request.auth.uid });
    return { id };
  } catch (err) {
    throw new HttpsError("invalid-argument", (err as Error).message);
  }
});

/** Admin-only — bring on an Approver or a co-Admin. */
export const addOrgMember = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const { orgId, userId, role } = (request.data ?? {}) as { orgId?: string; userId?: string; role?: OrgRole };
  if (!orgId || !userId || !role) throw new HttpsError("invalid-argument", "orgId, userId, and role are required");

  try {
    await members.addOrgMember(orgId, userId, role, request.auth.uid);
    return { ok: true };
  } catch (err) {
    throw new HttpsError("permission-denied", (err as Error).message);
  }
});

export const removeOrgMember = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const { orgId, userId } = request.data ?? {};
  if (!orgId || !userId) throw new HttpsError("invalid-argument", "orgId and userId are required");

  try {
    await members.removeOrgMember(orgId, userId, request.auth.uid);
    return { ok: true };
  } catch (err) {
    throw new HttpsError("permission-denied", (err as Error).message);
  }
});

/** Public — a resolver clicking through from the job board to "see this company's other open jobs." */
export const getOrganizationProfile = onCall(async (request) => {
  const { orgId } = request.data ?? {};
  if (!orgId) throw new HttpsError("invalid-argument", "orgId is required");

  try {
    const profile = await orgs.getOrganizationProfile(orgId);
    return profile;
  } catch (err) {
    throw new HttpsError("not-found", (err as Error).message);
  }
});

/** Public directory — e.g. "show me every insurance company posting work right now." */
export const listOrganizations = onCall(async (request) => {
  const { companyType } = (request.data ?? {}) as { companyType?: CompanyType };
  const results = await orgs.listOrganizations(companyType);
  return { organizations: results };
});

/**
 * These two are PLATFORM-level moderation, a different authority tier
 * from org Admin — an org Admin oversees their own org, but shouldn't be
 * able to verify or reinstate their own org's standing. That needs a
 * platform-operator credential (e.g. a Firebase custom claim set outside
 * this app's normal signup flow), which this scaffold deliberately leaves
 * as an open decision for whoever deploys it, rather than assuming a
 * specific moderation model.
 */
export const verifyOrganization = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const { orgId } = request.data ?? {};
  if (!orgId) throw new HttpsError("invalid-argument", "orgId is required");

  // TODO: check request.auth.token for a platform-level "operator" custom claim before allowing this.
  await orgs.verifyOrganization(orgId);
  return { ok: true };
});

export const reinstateOrganization = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const { orgId } = request.data ?? {};
  if (!orgId) throw new HttpsError("invalid-argument", "orgId is required");

  // TODO: check request.auth.token for a platform-level "operator" custom claim before allowing this.
  await orgs.reinstateOrganization(orgId);
  return { ok: true };
});

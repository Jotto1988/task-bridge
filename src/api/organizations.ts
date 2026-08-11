import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as orgs from "../services/organizations";
import { CompanyType } from "../types";

/** Companies self-register. They start unverified with a small request cap — see organizations.ts for the trust mechanics. */
export const registerOrganization = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in to register an organization");
  const { name, companyType, logoUrl, description } = request.data ?? {};

  if (!name || !companyType) {
    throw new HttpsError("invalid-argument", "name and companyType are required");
  }

  try {
    const id = await orgs.registerOrganization({ name, companyType, logoUrl, description });
    return { id };
  } catch (err) {
    throw new HttpsError("invalid-argument", (err as Error).message);
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

export const verifyOrganization = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const { orgId } = request.data ?? {};
  if (!orgId) throw new HttpsError("invalid-argument", "orgId is required");

  // TODO: check request.auth.token for an "admin" custom claim before allowing this.
  await orgs.verifyOrganization(orgId);
  return { ok: true };
});

export const reinstateOrganization = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
  const { orgId } = request.data ?? {};
  if (!orgId) throw new HttpsError("invalid-argument", "orgId is required");

  // TODO: check request.auth.token for an "admin" custom claim before allowing this.
  await orgs.reinstateOrganization(orgId);
  return { ok: true };
});

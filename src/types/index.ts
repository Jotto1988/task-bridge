import { Timestamp } from "firebase-admin/firestore";

/**
 * Lifecycle of a HITL request. Note the split between "pending_approval"
 * and "open" — nothing reaches the public board without a human sign-off.
 * "resolved_directly" covers the case where an approver fixes the issue
 * themselves and never needs to publish a paid job at all.
 */
export type RequestStatus =
  | "pending_approval"
  | "rejected"
  | "open"
  | "claimed"
  | "completed"
  | "resolved_directly" // approver handled it personally, no resolver ever needed
  | "expired_unclaimed" // never claimed before some other lifecycle event closed it (e.g. cancelled by requester)
  | "cancelled";

/**
 * Where a request came from. Most requests will be AI-raised, but the
 * platform doesn't require an AI in the loop at all — a company's own
 * customer can ask directly (e.g. "can you send someone to help with my
 * online banking"), and the approver decides whether to resolve it
 * personally or turn it into a job.
 */
export type RequestOrigin = "ai_system" | "customer_request";

export interface HitlRequest {
  id: string;
  submittedBy: {
    orgId: string;
    origin: RequestOrigin;
    systemLabel: string; // for ai_system: which process raised it. For customer_request: free text like "self-service help form"
  };
  category: TaskCategory;
  title: string;
  description: string;
  /** Free text, defaults to DEFAULT_ATTIRE_BY_CATEGORY[category] but always overridable by the submitter or the approver — the approver gets the final say before it reaches the board. */
  attireGuidance: string;
  /**
   * Plain-language terms shipped with every job so both the org and the
   * resolver know what they're agreeing to before a claim is made. This is
   * a deterministic template (see lib/termsOfService.ts), not legal advice —
   * a real deployment should have this reviewed by an actual lawyer, or
   * swap the generator for a proper legal-drafting call.
   */
  termsOfService: string;
  /** Arbitrary structured context the resolver needs to do the task (a payload, links, IDs — not PII by default). */
  context: Record<string, unknown>;
  requiredSkills: string[];
  payoutCents: number;
  currency: string; // ISO 4217, e.g. "ZAR", "USD"
  turnaroundMinutes: number;
  status: RequestStatus;
  createdAt: Timestamp;
  approvedBy?: string; // userId of the human approver
  approvedAt?: Timestamp;
  rejectionReason?: string;
  resolutionNote?: string; // set when status is resolved_directly
}

export type ClaimStatus = "active" | "completed" | "expired";

export interface Claim {
  id: string; // same id as the request it belongs to, 1:1
  requestId: string;
  resolverId: string;
  claimedAt: Timestamp;
  deadlineAt: Timestamp;
  status: ClaimStatus;
  completedAt?: Timestamp;
  submissionNote?: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  skills: string[];
  /** Derived, recomputed on rating/claim events — not hand-edited. */
  reputation: {
    score: number; // 0-100, see reputation.ts for the formula
    completedCount: number;
    expiredCount: number;
    ratingAvg: number; // weighted average — see reputation.ts for the credibility-weighting mechanism
    ratingCount: number; // raw count of ratings received, unweighted, kept for transparency
    ratingWeightSum: number; // internal — sum of credibility weights behind ratingAvg, not surfaced publicly
  };
  /** Count of unresolved-in-time claims. High flag counts should throttle claim eligibility. */
  flagCount: number;
  createdAt: Timestamp;
}

/**
 * Internal-only record of how a given account rates others over time.
 * Never exposed via a public profile or API response — this exists purely
 * so the reputation system can quietly reduce the influence of chronic
 * outlier raters. No label, no flag, no public consequence for the rater;
 * it just stops one person's pattern from dominating someone else's score.
 */
export interface RaterStats {
  id: string; // same as the rater's userId
  givenCount: number;
  givenSum: number;
}

export type OrgStatus = "unverified" | "verified" | "suspended";

export type CompanyType =
  | "insurance"
  | "bank"
  | "law_firm"
  | "accounting_firm"
  | "logistics"
  | "real_estate"
  | "retail"
  | "other";

export interface Organization {
  id: string;
  name: string;
  companyType: CompanyType;
  logoUrl?: string;
  description?: string;
  status: OrgStatus;
  /** Max concurrent pending_approval + open requests. Raised automatically as trust builds. */
  requestCap: number;
  approvedCount: number;
  rejectedCount: number;
  createdAt: Timestamp;
  suspendedAt?: Timestamp;
  suspendedReason?: string;
}

/**
 * Broad categories drive default expectations (attire, likely duration) but
 * every request can override those defaults — a "see_person" task at a
 * construction site and one at a law firm need very different guidance,
 * and the category alone shouldn't dictate that.
 */
export type TaskCategory =
  | "collect_parcel"
  | "deliver_parcel"
  | "see_person"
  | "site_visit"
  | "document_review"
  | "other";

export const DEFAULT_ATTIRE_BY_CATEGORY: Record<TaskCategory, string> = {
  collect_parcel: "Casual — no client interaction expected",
  deliver_parcel: "Casual — brief client interaction possible",
  see_person: "Business casual — confirm with the requester's industry norms",
  site_visit: "Smart casual, closed-toe shoes — check for site-specific PPE requirements",
  document_review: "No specific attire — likely remote/desk-based",
  other: "Not specified — confirm with requester before accepting",
};

export type RatingDirection = "requester_to_resolver" | "resolver_to_requester";

export interface Rating {
  id: string;
  requestId: string;
  fromUserId: string;
  toUserId: string;
  direction: RatingDirection;
  score: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: Timestamp;
}

export interface Flag {
  id: string;
  userId: string;
  requestId: string;
  reason: "expired_claim" | "requester_reported" | "resolver_reported";
  createdAt: Timestamp;
}

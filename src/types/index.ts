import { Timestamp } from "firebase-admin/firestore";

/**
 * Lifecycle of a HITL request. Note the split between "pending_approval"
 * and "open" — nothing reaches the public board without a human sign-off.
 */
export type RequestStatus =
  | "pending_approval"
  | "rejected"
  | "open"
  | "claimed"
  | "completed"
  | "expired_unclaimed" // never claimed before some other lifecycle event closed it (e.g. cancelled by requester)
  | "cancelled";

export interface HitlRequest {
  id: string;
  /** Identifies the submitting system or organization, not a person. */
  submittedBy: {
    orgId: string;
    systemLabel: string; // e.g. "claims-triage-v2", free text describing which AI process raised this
  };
  title: string;
  description: string;
  /** Arbitrary structured context the worker needs to do the task (a payload, links, IDs — not PII by default). */
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
}

export type ClaimStatus = "active" | "completed" | "expired";

export interface Claim {
  id: string; // same id as the request it belongs to, 1:1
  requestId: string;
  workerId: string;
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
    ratingAvg: number;
    ratingCount: number;
  };
  /** Count of unresolved-in-time claims. High flag counts should throttle claim eligibility. */
  flagCount: number;
  createdAt: Timestamp;
}

export type RatingDirection = "requester_to_worker" | "worker_to_requester";

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
  reason: "expired_claim" | "requester_reported" | "worker_reported";
  createdAt: Timestamp;
}

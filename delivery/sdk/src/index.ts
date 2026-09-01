/**
 * Client SDK for Task Bridge's org-facing REST API.
 *
 * This is deliberately a standalone package with no dependency on the
 * backend's internal types — it talks to the deployed Cloud Functions
 * over plain HTTP, the same way any other language or framework would.
 * If the backend's internal shapes change, this file is the seam that
 * absorbs it; consumers of this SDK shouldn't have to care.
 *
 * This is what src/mockTaskBridgeServer.ts in the Claude Agent SDK
 * example stands in for. Swap that example's tool calls to use this
 * client instead of localhost, and it stops being a demo.
 */

export type TaskCategory = "collect_parcel" | "deliver_parcel" | "see_person" | "site_visit" | "document_review" | "other";

export interface SubmitRequestInput {
  category: TaskCategory;
  title: string;
  description: string;
  payoutCents: number;
  currency: string;
  turnaroundMinutes: number;
  attireGuidance?: string;
  context?: Record<string, unknown>;
  requiredSkills?: string[];
  /** Free text identifying which of your systems raised this — shows up in the org's request history. */
  systemLabel?: string;
}

export type RequestStatus =
  | "pending_approval"
  | "rejected"
  | "open"
  | "claimed"
  | "completed"
  | "resolved_directly"
  | "expired_unclaimed"
  | "cancelled";

export interface TaskBridgeRequest {
  id: string;
  category: TaskCategory;
  title: string;
  description: string;
  status: RequestStatus;
  attireGuidance: string;
  approverNotes?: string;
  rejectionReason?: string;
  resolutionNote?: string;
  createdAt: string;
  approvedAt?: string;
}

export class TaskBridgeError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "TaskBridgeError";
  }
}

export interface TaskBridgeClientOptions {
  apiKey: string;
  /** Base URL of your deployed Cloud Functions, e.g. https://us-central1-your-project.cloudfunctions.net */
  baseUrl: string;
}

const TERMINAL_STATUSES: RequestStatus[] = ["completed", "resolved_directly", "rejected", "expired_unclaimed", "cancelled"];

export class TaskBridgeClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: TaskBridgeClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    const body = (await res.json().catch(() => ({}))) as any;

    if (!res.ok) {
      throw new TaskBridgeError(body?.error ?? `Request failed with status ${res.status}`, res.status);
    }

    return body as T;
  }

  /** Raise a new HITL request. Lands in pending_approval — a human at the org still has to approve it before it's public. */
  async submitRequest(input: SubmitRequestInput): Promise<{ id: string }> {
    return this.request<{ id: string }>("/apiSubmitRequest", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  /** Fetch the current state of a request you submitted. */
  async getRequest(requestId: string): Promise<TaskBridgeRequest> {
    const { request } = await this.request<{ request: TaskBridgeRequest }>(`/apiGetRequest?id=${encodeURIComponent(requestId)}`);
    return request;
  }

  /**
   * Poll a request until it reaches a terminal status (completed,
   * resolved_directly, rejected, expired, or cancelled), or until
   * timeoutMs elapses. This is the equivalent of the Claude Agent SDK
   * example's check_task_bridge_status tool, but against the real
   * backend — useful when your AI system needs to actually wait for a
   * human's answer before continuing.
   */
  async waitForResolution(
    requestId: string,
    options: { intervalMs?: number; timeoutMs?: number } = {}
  ): Promise<TaskBridgeRequest> {
    const intervalMs = options.intervalMs ?? 5000;
    const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const request = await this.getRequest(requestId);
      if (TERMINAL_STATUSES.includes(request.status)) {
        return request;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new TaskBridgeError(`Timed out waiting for request ${requestId} to resolve`, 408);
  }
}

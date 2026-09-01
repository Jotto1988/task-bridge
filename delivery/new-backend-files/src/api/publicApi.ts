import { onRequest } from "firebase-functions/v2/https";
import { verifyApiKey, ApiKeyError } from "../services/apiKeys";
import * as hitl from "../services/hitlRequests";
import { HitlRequestError } from "../services/hitlRequests";

function getBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

/**
 * The actual integration surface for a company's AI system — plain HTTP,
 * not the Firebase callable protocol the human-facing onCall functions
 * use. Any language, any HTTP client, any AI framework can call this
 * directly. This is what the @task-bridge/client SDK wraps, and what the
 * Claude Agent SDK example's mock server stands in for.
 *
 * POST /apiSubmitRequest
 * Headers: Authorization: Bearer tb_live_...
 * Body: { category, title, description, attireGuidance?, context?, requiredSkills?, payoutCents, currency, turnaroundMinutes, systemLabel? }
 */
export const apiSubmitRequest = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const token = getBearerToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({ error: "Missing Authorization: Bearer <api key> header" });
      return;
    }
    const { orgId } = await verifyApiKey(token);

    const { category, title, description, attireGuidance, context, requiredSkills, payoutCents, currency, turnaroundMinutes, systemLabel } =
      req.body ?? {};

    if (!category || !title || !description) {
      res.status(400).json({ error: "category, title, and description are required" });
      return;
    }

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

    res.status(201).json({ id });
  } catch (err) {
    if (err instanceof ApiKeyError) {
      res.status(401).json({ error: err.message });
      return;
    }
    if (err instanceof HitlRequestError) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * GET /apiGetRequest?id=<requestId>
 * Headers: Authorization: Bearer tb_live_...
 *
 * Lets a company's AI system poll a request it submitted — same shape as
 * the check_task_bridge_status tool in the Claude Agent SDK example, but
 * against the real backend instead of the mock. Scoped to the calling
 * org: a key can only ever see its own org's requests.
 */
export const apiGetRequest = onRequest(async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const token = getBearerToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({ error: "Missing Authorization: Bearer <api key> header" });
      return;
    }
    const { orgId } = await verifyApiKey(token);

    const requestId = req.query.id;
    if (typeof requestId !== "string") {
      res.status(400).json({ error: "id query parameter is required" });
      return;
    }

    const request = await hitl.getRequestById(requestId);
    if (!request || request.submittedBy.orgId !== orgId) {
      // Same 404 whether it doesn't exist or belongs to another org —
      // don't leak which requests exist for orgs a key can't access.
      res.status(404).json({ error: "Request not found" });
      return;
    }

    res.status(200).json({ request });
  } catch (err) {
    if (err instanceof ApiKeyError) {
      res.status(401).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal error" });
  }
});

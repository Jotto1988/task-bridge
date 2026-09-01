# @task-bridge/client

A small client for a company's AI system (or any backend) to call Task Bridge's REST API — submit human-in-the-loop requests, check their status, and wait for a human to resolve them.

This talks to the deployed Cloud Functions over plain HTTP with an API key. It has no dependency on the backend's internal code, so it works the same from any TypeScript or JavaScript service.

## Setup

An org Admin creates an API key (via the `createApiKey` callable, or a future admin UI) and gets a key back that looks like `tb_live_...` — shown once, save it somewhere safe.

```bash
cd sdk
npm install
npm run build
```

## Usage

```ts
import { TaskBridgeClient } from "@task-bridge/client";

const client = new TaskBridgeClient({
  apiKey: process.env.TASK_BRIDGE_API_KEY!,
  baseUrl: "https://us-central1-your-project.cloudfunctions.net",
});

// Raise a request
const { id } = await client.submitRequest({
  category: "site_visit",
  title: "Verify storm damage before payout",
  description: "Claim #4471 — photos are inconclusive on roof damage extent.",
  payoutCents: 45000,
  currency: "ZAR",
  turnaroundMinutes: 180,
  systemLabel: "claims-triage-v2",
});

// Check on it later
const request = await client.getRequest(id);

// Or wait for a human to actually resolve it before continuing
const resolved = await client.waitForResolution(id, { intervalMs: 5000, timeoutMs: 10 * 60 * 1000 });
console.log(resolved.status); // "open" -> ... -> "completed" once a resolver finishes it
```

## Relationship to the Claude Agent SDK example

`examples/claude-agent-integration/src/mockTaskBridgeServer.ts` simulates a tiny slice of what this SDK talks to for real — no roles, no verification codes, just enough to demo the raise → wait → resolve loop on one laptop. Swap that example's tool calls to use `TaskBridgeClient` pointed at a real deployment instead of `localhost:8787`, and the demo stops being a demo.

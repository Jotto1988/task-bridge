# Task Bridge × Claude Agent SDK — a live integration, not just a diagram

This is a working example, not a mockup: a real agent, built on the [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview), that hits a genuine wall in a coding task, raises a Task Bridge–style signal, waits for a human to answer it, and only then makes the fix — committing it to git with the human's reasoning preserved in the commit message.

It's here because Task Bridge's premise — AI raises the request, a human resolves what it can't — applies just as well to AI-assisted coding as it does to any other kind of work. This example is the proof.

## What it demonstrates

1. **Claude is given a coding task** with a failing test in a small fixture project (`local-project/`).
2. **The fix depends on something genuinely unknowable from the code** — a business decision (which timezone a reporting boundary uses) that isn't written down anywhere in the repo. Claude is instructed not to guess.
3. **Claude calls a custom tool, `emit_task_bridge_signal`**, built with the Agent SDK's [custom tools](https://docs.claude.com/en/api/agent-sdk/custom-tools) — the same mechanism you'd use to connect an agent to any API. This posts a request to a small mock Task Bridge server.
4. **A human resolves it from a second terminal**, using `npm run resolve`, exactly as a resolver would answer a real Task Bridge job.
5. **Claude picks the answer back up** via `check_task_bridge_status`, applies the fix, reruns the test, and commits — with the human's answer quoted in the commit body.

## What's real vs. simplified

This uses the actual Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) and actually calls the Anthropic API — nothing about the agent itself is mocked. What's simplified for a runnable, single-machine demo:

- **The Task Bridge backend is an in-memory mock** (`src/mockTaskBridgeServer.ts`), not the real Firestore/Cloud Functions backend in the main repo. No org/approver/resolver roles, no verification codes, no payout flow — just enough to show the raise → wait → resolve → resume loop.
- **One person plays both approver and resolver**, answering directly instead of going through an approval queue first.

The full role-based, verification-gated system this simplifies lives in the main repo's `src/services` and `src/api`.

## Prerequisites

- Node.js 18+
- An Anthropic API key ([get one here](https://platform.claude.com/)) — this example calls the real API and will use real usage

## Run it

```bash
cd examples/claude-agent-integration
npm install
export ANTHROPIC_API_KEY=your-api-key   # Windows PowerShell: $env:ANTHROPIC_API_KEY = "your-api-key"
npm start
```

Watch the terminal. Claude will read the failing test, investigate, and — if it behaves as instructed — raise a signal instead of guessing. You'll see something like:

```
[task-bridge] New signal raised: a1b2c3d4
  Title:       Timezone for report boundary is undocumented
  Description: ...
  Resolve it:  npm run resolve -- a1b2c3d4 "<your answer>"
```

Open a **second terminal**, in the same `examples/claude-agent-integration` folder, and answer it:

```bash
npm run resolve -- a1b2c3d4 "Pacific time — all account reports use the account owner's local timezone, per the finance team's 2024 policy"
```

Switch back to the first terminal. Claude picks up the answer, applies the fix, reruns the test, and commits. At the end you'll see the resulting git log inside `local-project/` — a fixture repo, isolated from the main Task Bridge repo, that resets to its original buggy state every time you run `npm start` again.

## Why this matters for the broader idea

This is a small, honest demonstration of the thing Task Bridge is actually proposing: not "AI does the work instead of people," but AI knowing the edge of its own knowledge and routing around it to a person, instead of guessing and shipping something wrong. The mechanism here — a tool call, a wait, a human answer, a resumed task — is the same shape as the real platform, just small enough to run on one laptop in under a minute.

If you want to take this further: swap `mockTaskBridgeServer.ts` for a client of the real Task Bridge API in the main repo, and this stops being a demo.

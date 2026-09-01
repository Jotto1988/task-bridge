<p align="center">
  <img src="assets/images/logo_task_bridge.png" width="180" alt="Task Bridge logo">
</p>

<h1 align="center">Task Bridge</h1>

<p align="center">
  <b>A working concept for routing AI-generated human-in-the-loop work back to real people, with the accountability mechanics of a bug bounty platform.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-early_scaffold-A63A2C?style=for-the-badge" alt="status">
  <img src="https://img.shields.io/badge/typescript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="typescript">
  <img src="https://img.shields.io/badge/firebase-ffca28?style=for-the-badge&logo=firebase&logoColor=black" alt="firebase">
  <img src="https://img.shields.io/badge/license-MIT-223756?style=for-the-badge" alt="MIT license">
</p>

<p align="center">
  <a href="https://jotto1988.github.io/task-bridge/"><b>Concept demo</b></a> ·
  <a href="web/"><b>Job board</b></a> ·
  <a href="sdk/"><b>Client SDK</b></a> ·
  <a href="examples/claude-agent-integration/"><b>Claude Agent SDK example</b></a>
</p>

> Working name — rename freely if you fork this. `task-bridge` is a placeholder, not a brand.

## What this is

As companies automate roles with AI, a lot of work doesn't disappear — it changes shape. AI systems increasingly produce edge cases, low-confidence decisions, and judgment calls they shouldn't resolve alone. Right now that work either gets absorbed by whoever is left on staff, or it doesn't get checked at all.

Task Bridge is an open-source attempt at infrastructure for the alternative: when an AI system needs a human to review, verify, or complete something, it can raise a request. It doesn't have to be an AI, either — a company's own customer can ask directly for help, and a human approver can choose to sort it out personally or turn it into a job. Either way, a human approver signs off so the board isn't flooded with noise. The task goes live. Anyone qualified can claim it. Once claimed, it's locked to them — no one else can take it, and no one can grind out reputation by sniping easy tasks out from under someone already working. There's a turnaround window. If it isn't finished in time, it reopens for someone else, and the person who let it lapse takes a mark against their record. Complete it well, on time, and both sides — requester and resolver — rate each other, the way they would on any bounty or freelance platform.

This is not a finished product. It is not a company, and it doesn't claim to solve the economics of AI-driven job displacement — that's a much bigger problem than one repo can fix, and how (or whether) that transition gets cushioned for the people affected is still very much unresolved. This is one piece of infrastructure, published so the idea can be tested, argued with, and improved by people who might actually need it or build on it.

**If it's useful, take it. If it's wrong, fork it and fix it. If it's a bad idea, open an issue and say so.**

## How it connects

<svg width="660" height="600" viewBox="0 0 660 600" xmlns="http://www.w3.org/2000/svg" role="img">
<title>How Task Bridge connects a company's AI system to a resolver</title>
<desc>A company's AI system calls the Task Bridge backend, a human approver reviews and issues a verification code, the request appears on the public job board, a resolver claims and completes it, and an admin releases the payout.</desc>

<rect x="0" y="0" width="660" height="600" fill="#EDE6D6"/>

<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M2 1L8 5L2 9" fill="none" stroke="#1B2233" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </marker>
</defs>

<!-- A: Company's AI system -->
<rect x="170" y="20" width="320" height="56" rx="8" fill="#F6F1E6" stroke="#1B2233" stroke-width="2"/>
<text x="330" y="42" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#1B2233">Company's AI system</text>
<text x="330" y="60" text-anchor="middle" font-family="Arial, sans-serif" font-size="12.5" fill="#6B7280">Calls the REST API or client SDK</text>

<line x1="330" y1="76" x2="330" y2="112" stroke="#1B2233" stroke-width="1.5" marker-end="url(#arrow)"/>

<!-- B: Task Bridge backend -->
<rect x="170" y="116" width="320" height="56" rx="8" fill="#F6F1E6" stroke="#223756" stroke-width="2"/>
<text x="330" y="138" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#223756">Task Bridge backend</text>
<text x="330" y="156" text-anchor="middle" font-family="Arial, sans-serif" font-size="12.5" fill="#6B7280">Cloud Functions — nothing to install</text>

<line x1="330" y1="172" x2="330" y2="208" stroke="#1B2233" stroke-width="1.5" marker-end="url(#arrow)"/>

<!-- C: Human approver -->
<rect x="170" y="212" width="320" height="56" rx="8" fill="#F6F1E6" stroke="#1B2233" stroke-width="2"/>
<text x="330" y="234" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#1B2233">Human approver</text>
<text x="330" y="252" text-anchor="middle" font-family="Arial, sans-serif" font-size="12.5" fill="#6B7280">Reviews it, issues a verification code</text>

<line x1="330" y1="268" x2="330" y2="304" stroke="#1B2233" stroke-width="1.5" marker-end="url(#arrow)"/>
<text x="345" y="290" font-family="Arial, sans-serif" font-size="11.5" fill="#A63A2C">approved</text>

<!-- D: Public job board -->
<rect x="170" y="308" width="320" height="56" rx="8" fill="#F6F1E6" stroke="#1B2233" stroke-width="2"/>
<text x="330" y="330" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#1B2233">Public job board</text>
<text x="330" y="348" text-anchor="middle" font-family="Arial, sans-serif" font-size="12.5" fill="#6B7280">Anyone qualified can browse and claim</text>

<line x1="330" y1="364" x2="330" y2="400" stroke="#1B2233" stroke-width="1.5" marker-end="url(#arrow)"/>

<!-- E: Resolver's device -->
<rect x="170" y="404" width="320" height="56" rx="8" fill="#F6F1E6" stroke="#A63A2C" stroke-width="2"/>
<text x="330" y="426" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#A63A2C">Resolver's device</text>
<text x="330" y="444" text-anchor="middle" font-family="Arial, sans-serif" font-size="12.5" fill="#6B7280">Browser, app, or bot</text>

<text x="330" y="478" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-style="italic" fill="#6B7280">Completion isn't accepted until the backend checks the code</text>

<line x1="330" y1="490" x2="330" y2="518" stroke="#1B2233" stroke-width="1.5" marker-end="url(#arrow)"/>
<text x="345" y="508" font-family="Arial, sans-serif" font-size="11.5" fill="#A63A2C">verified complete</text>

<!-- F: Admin releases payout -->
<rect x="170" y="522" width="320" height="56" rx="8" fill="#F6F1E6" stroke="#DD8A1E" stroke-width="2"/>
<text x="330" y="544" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#8A5A11">Admin releases payout</text>
<text x="330" y="562" text-anchor="middle" font-family="Arial, sans-serif" font-size="12.5" fill="#6B7280">Separate authority from the approver</text>

</svg>

## Roles

- **Org** — the company. Whose AI system (or self-service form) is allowed to raise requests, and who's accountable for the requests it publishes.
- **Admin** — oversees everything for their org: every request regardless of status, who's allowed to approve, and who releases payouts. The first Admin is whoever registers the org; only an existing Admin can add more Admins or Approvers.
- **Approver** — reviews requests before they go live. Can approve, reject, resolve a request personally, adjust the guidance shipped with it, or add their own notes. Cannot self-promote to Admin, and cannot release a payout — that's a separate authority.
- **Resolver** — the person who claims and does the work.

Role checks run against Firestore membership records (`orgMembers`), scoped per-org — an Approver at one company has no authority over another company's requests, and every approval/rejection/resolution/payout endpoint verifies the caller's role for that specific request's org before doing anything.

## Core mechanics

| Concept | Behavior |
|---|---|
| **Organization** | The employer side. Starts unverified with a small concurrent-request cap; the cap rises automatically after a run of clean approvals, and an org gets auto-suspended if too many of its requests get rejected. |
| **HITL Request** | Raised either by an AI system, or directly by an org's own customer. An AI can fill in everything about a request, but it cannot get itself past the approver gate — only a human with the approver or admin role can move it further. Tagged with a category, attire guidance, approver notes, plain-language terms of service, context, required skills, and a payout. |
| **Approval** | An Approver or Admin decides what happens: approve it onto the board, reject it, or resolve it personally. Approving generates a one-time completion verification code — the plaintext is returned once, in the approval response, for the approver to relay to the actual client out of band (SMS, a phone call, a printed slip). Only its hash is ever stored. |
| **Job Board** | Public listing of approved, open tasks. Filterable by skill, category, and payout, with each request linking to the org's public profile. |
| **Claim & Lock** | First qualified resolver to accept a task gets exclusive access. |
| **Turnaround Window** | Every task has a deadline. Miss it, and the task reopens automatically. |
| **Completion verification** | A resolver can't self-certify a job as done. Completing a claim requires the verification code the client was given — not the resolver's own say-so. Wrong codes count against a limited number of attempts; too many failures locks the claim for Admin review instead of allowing a brute-force guess. |
| **Finance / payout** | A verified-complete claim moves to `pending_payout`. Releasing it is Admin-only, deliberately separate from the Approver who signed off on the work. The actual payment rail is left as a hook (`services/finance.ts`) — this repo doesn't assume PayFast, a bank transfer, or any specific region. |
| **Reputation** | Built from completion rate, on-time rate, and ratings from the people a resolver worked with. |
| **Mutual Rating** | Both sides rate each other after a task closes. |
| **Rating integrity** | Ratings from a chronic outlier rater get quietly reduced in influence on a resolver's score. No flag, no label, nothing visible to anyone. |
| **Terms of Service** | Every request ships with auto-generated plain-language terms. Template today, not legal advice — see `src/lib/termsOfService.ts`. |
| **API keys** | A company's AI system authenticates with an API key (`tb_live_...`), not a human's Firebase Auth token — only its hash is ever stored, and the plaintext is shown exactly once, at creation. |

<details>
<summary><b>What's actually built vs. still open</b></summary>
<br>

**Built and tested:**
- [x] Org registration with automatic Admin bootstrap
- [x] Admin/Approver role checks, scoped per-org
- [x] Request lifecycle: submit → approve/reject/resolve → claim → complete → rate
- [x] One-time verification codes, hashed, with attempt lockout
- [x] Admin-only payout release, separate from approval
- [x] Org trust mechanics (request caps, auto-suspend) and rating-integrity weighting
- [x] Plain REST API + API keys for company AI systems ([`sdk/`](sdk/))
- [x] A minimal, functional job board resolvers can actually use ([`web/`](web/))
- [x] A live, tested integration showing a Claude agent raise a signal and wait for a human ([`examples/claude-agent-integration/`](examples/claude-agent-integration/))

**Explicitly still open:**
- [ ] Admin/Approver UI — creating API keys, approving requests, and releasing payouts currently go through direct function calls or the Firebase console
- [ ] Platform-level org verification/suspension override (see the comment in `api/organizations.ts`) — a different authority tier from any single org's own Admin
- [ ] Real payment integration — `services/finance.ts` is a deliberate hook, not wired to any payment rail
- [ ] Reputation display on the job board frontend

</details>

## Stack

- TypeScript
- Firebase Cloud Functions (v2) + Firestore
- Designed for horizontal scale from the start — claims are resolved with Firestore transactions to avoid race conditions under load, and expiry sweeps run on a schedule rather than per-request polling

## Getting started

```bash
npm install
firebase emulators:start
```

Deploy is left to whoever's running it — this repo doesn't assume a specific GCP project, billing setup, or environment. Wire up your own `firebase.json` / project config before deploying anywhere real.

## Contributing

Open issues, open PRs, fork it, argue with the model in the issues tab. If you think the reputation mechanics are wrong, or the approval step is a bottleneck, or the whole premise is flawed — say so. This is a concept meant to be pressure-tested, not a finished platform.

Live site: https://jotto1988.github.io/task-bridge/

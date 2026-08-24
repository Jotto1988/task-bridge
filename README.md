# Task Bridge

**A working concept for routing AI-generated human-in-the-loop work back to real people, with the accountability mechanics of a bug bounty platform.**

> Working name — rename freely if you fork this. `task-bridge` is a placeholder, not a brand.

## What this is

As companies automate roles with AI, a lot of work doesn't disappear — it changes shape. AI systems increasingly produce edge cases, low-confidence decisions, and judgment calls they shouldn't resolve alone. Right now that work either gets absorbed by whoever is left on staff, or it doesn't get checked at all.

Task Bridge is an open-source attempt at infrastructure for the alternative: when an AI system needs a human to review, verify, or complete something, it can raise a request. It doesn't have to be an AI, either — a company's own customer can ask directly for help, and a human approver can choose to sort it out personally or turn it into a job. Either way, a human approver signs off so the board isn't flooded with noise. The task goes live. Anyone qualified can claim it. Once claimed, it's locked to them — no one else can take it, and no one can grind out reputation by sniping easy tasks out from under someone already working. There's a turnaround window. If it isn't finished in time, it reopens for someone else, and the person who let it lapse takes a mark against their record. Complete it well, on time, and both sides — requester and resolver — rate each other, the way they would on any bounty or freelance platform.

This is not a finished product. It is not a company, and it doesn't claim to solve the economics of AI-driven job displacement — that's a much bigger problem than one repo can fix, and how (or whether) that transition gets cushioned for the people affected is still very much unresolved. This is one piece of infrastructure, published so the idea can be tested, argued with, and improved by people who might actually need it or build on it.

**If it's useful, take it. If it's wrong, fork it and fix it. If it's a bad idea, open an issue and say so.**

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
| **Finance / payout** | A verified-complete claim moves to `pending_payout`. Releasing it is Admin-only, deliberately separate from the Approver who signed off on the work — same separation of duties as a program that doesn't let one person both approve a bounty and cut the check. The actual payment rail is left as a hook (`services/finance.ts`) — this repo doesn't assume PayFast, a bank transfer, or any specific region. |
| **Reputation** | Built from completion rate, on-time rate, and ratings from the people a resolver worked with. |
| **Mutual Rating** | Both sides rate each other after a task closes. |
| **Rating integrity** | Ratings from a chronic outlier rater get quietly reduced in influence on a resolver's score. No flag, no label, nothing visible to anyone. |
| **Terms of Service** | Every request ships with auto-generated plain-language terms. Template today, not legal advice — see `src/lib/termsOfService.ts`. |

## Status

Early scaffold. Core Firestore data model and Cloud Functions for the full lifecycle: org registration with automatic Admin bootstrap, Admin/Approver membership management, request submission and approval with verification-code generation, claim/complete with code-gated verification and attempt lockout, Admin-only payout release, and org/rating trust mechanics. Two things explicitly still open: platform-level org verification/suspension-override (see the comment in `api/organizations.ts`) and any real payment integration. No frontend yet — this is API-first so the mechanics can be tested and argued with before anyone spends time on UI.

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

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
- **Approver** — a human at the org who reviews requests before they go live. Can approve, reject, resolve a request personally, or adjust the guidance shipped with it.
- **Resolver** — the person who claims and does the work.

## Core mechanics

| Concept | Behavior |
|---|---|
| **Organization** | The employer side. Starts unverified with a small concurrent-request cap; the cap rises automatically after a run of clean approvals, and an org gets auto-suspended if too many of its requests get rejected. Same trust logic bounty platforms apply to programs, applied here to requesters. |
| **HITL Request** | Raised either by an AI system, or directly by an org's own customer (e.g. "can you send someone to help with my online banking") — an AI isn't required to use this at all. Tagged with a category, attire guidance (defaults per category, always overridable — first by whoever submits it, then again by the approver, who usually knows the actual site or client better), plain-language terms of service, context, required skills, and a payout. |
| **Approval** | A human reviewer decides what happens: approve it onto the board, reject it, or — for customer requests that can be sorted out directly — resolve it personally without ever publishing a paid job. All three outcomes feed the org's track record. |
| **Job Board** | Public listing of approved, open tasks. Filterable by skill, category, and payout. Each request links back to the organization's public profile — logo, company type, and its other open jobs — for resolvers who'd rather stick with a company they trust. |
| **Claim & Lock** | First qualified resolver to accept a task gets exclusive access. No one else can take it while it's claimed. |
| **Turnaround Window** | Every task has a deadline. Miss it, and the task reopens automatically — the claim expires. |
| **Reputation** | Built from completion rate, on-time rate, and ratings from the people a resolver worked with — modeled on how bounty platforms like HackerOne track researcher trust. |
| **Mutual Rating** | Both sides rate each other after a task closes. Resolvers build a track record; requesters do too. |
| **Rating integrity** | Ratings from a chronic outlier rater (someone whose scores run consistently far harsher than the platform average, across enough history to tell it's a pattern and not a bad week) get quietly reduced in influence on a resolver's score. No flag, no label, nothing visible to anyone — it's a statistical correction, not a dispute system, because a resolver's livelihood shouldn't be held hostage by one difficult account. |
| **Terms of Service** | Every request ships with auto-generated plain-language terms (independent-work status, payout, turnaround, liability, disputes). It's a template today, not legal advice — see `src/lib/termsOfService.ts` for the seam where a real legal-drafting call could replace it. |

## Status

Early scaffold. Core Firestore data model and Cloud Functions for the organization → request → approve/resolve → claim → complete → rate lifecycle, including org-side trust mechanics and rating-integrity weighting. No frontend yet — this is API-first so the mechanics can be tested and argued with before anyone spends time on UI.

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

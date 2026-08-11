# Task Bridge

**A working concept for routing AI-generated human-in-the-loop work back to real people, with the accountability mechanics of a bug bounty platform.**

> Working name — rename freely if you fork this. `task-bridge` is a placeholder, not a brand.

## What this is

As companies automate roles with AI, a lot of work doesn't disappear — it changes shape. AI systems increasingly produce edge cases, low-confidence decisions, and judgment calls they shouldn't resolve alone. Right now that work either gets absorbed by whoever is left on staff, or it doesn't get checked at all.

Task Bridge is an open-source attempt at infrastructure for the alternative: when an AI system needs a human to review, verify, or complete something, it can raise a request. A human approver signs off so the board isn't flooded with noise. The task goes live. Anyone qualified can claim it. Once claimed, it's locked to them — no one else can take it, and no one can grind out reputation by sniping easy tasks out from under someone already working. There's a turnaround window. If it isn't finished in time, it reopens for someone else, and the person who let it lapse takes a mark against their record. Complete it well, on time, and both sides — requester and worker — rate each other, the way they would on any bounty or freelance platform.

This is not a finished product. It is not a company, and it doesn't claim to solve the economics of AI-driven job displacement — that's a much bigger problem than one repo can fix, and how (or whether) that transition gets cushioned for the people affected is still very much unresolved. This is one piece of infrastructure, published so the idea can be tested, argued with, and improved by people who might actually need it or build on it.

**If it's useful, take it. If it's wrong, fork it and fix it. If it's a bad idea, open an issue and say so.**

## Core mechanics

| Concept | Behavior |
|---|---|
| **HITL Request** | Submitted by an AI system (or, for testing, submitted manually) when it hits something it can't or shouldn't resolve alone. Includes context, required skill tags, and a payout. |
| **Approval** | A human reviewer signs off before a request goes live. Filters noise, keeps the board trustworthy. |
| **Job Board** | Public listing of approved, open tasks. Filterable by skill and payout. |
| **Claim & Lock** | First qualified person to accept a task gets exclusive access. No one else can take it while it's claimed. |
| **Turnaround Window** | Every task has a deadline. Miss it, and the task reopens automatically — the claim expires. |
| **Reputation** | Built from completion rate, on-time rate, and ratings from the people you worked with — modeled on how bounty platforms like HackerOne track researcher trust. |
| **Mutual Rating** | Both sides rate each other after a task closes. Workers build a track record; requesters do too. |

## Status

Early scaffold. Core Firestore data model and Cloud Functions for the request → approve → claim → complete → rate lifecycle. No frontend yet — this is API-first so the mechanics can be tested and argued with before anyone spends time on UI.

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

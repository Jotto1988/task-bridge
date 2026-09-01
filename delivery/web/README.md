# Task Bridge — job board (minimal frontend)

A single functional HTML page — no build step, no framework. It calls the real Cloud Functions, not mock data. This is the piece that was missing: somewhere an actual resolver opens to browse, claim, and complete jobs.

## Setup

1. In the Firebase console for your project: **Authentication > Sign-in method**, enable **Google** as a provider.
2. **Project settings > General > Your apps**, add a Web app if you haven't, and copy the config object.
3. Open `index.html` and replace the `firebaseConfig` placeholder near the top of the `<script type="module">` block with your real values. These are public client identifiers, not secrets — safe to ship in a static file.
4. Serve the file — `npx serve .` locally, or deploy it via Firebase Hosting, GitHub Pages, or anywhere that serves static files.

## What it does

- Lists open jobs from `listOpenHitlRequests` — no sign-in needed just to browse.
- Sign in with Google to claim a job (`claimHitlTask`).
- Shows a live countdown to the claim's deadline, computed client-side from the job's turnaround window.
- Enter the completion code to mark a job done (`completeHitlTask`) — this is the same code an Approver relayed to the actual client, so a resolver can't self-certify.
- Release a claim early if you can't finish it, so it's not stuck on the clock unnecessarily.

## What's deliberately not here

- No Admin/Approver UI — approving requests, managing API keys, and releasing payouts still happen via direct calls to the callable functions (or the Firebase console) until that's built.
- No reputation display — the backend tracks it, this page doesn't show it yet.
- No styling framework, no build step, no state library. One file, on purpose — the point was proving a resolver-facing surface can exist at all, not building the final product.

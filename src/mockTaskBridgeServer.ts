import http from "node:http";
import { randomUUID } from "node:crypto";

export interface TaskBridgeRequest {
  id: string;
  title: string;
  description: string;
  status: "open" | "resolved";
  answer?: string;
  createdAt: string;
  resolvedAt?: string;
}

const requests = new Map<string, TaskBridgeRequest>();
const waiters = new Map<string, Array<() => void>>();
const LONG_POLL_TIMEOUT_MS = 5000;

function notifyWaiters(id: string): void {
  const list = waiters.get(id);
  if (!list) return;
  for (const resolve of list) resolve();
  waiters.delete(id);
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

/**
 * A deliberately minimal stand-in for the real Task Bridge backend (see
 * the main repo's src/services and src/api) — no org/approver/resolver
 * roles, no verification codes, no Firestore. Just enough to demonstrate
 * the core loop this example is about: an agent raises a request, a
 * human answers it out of band, and the agent picks the answer back up.
 * The full role-based, verification-gated flow lives in the main repo.
 */
export function startMockTaskBridgeServer(port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    try {
      if (req.method === "POST" && url.pathname === "/requests") {
        const body = await readBody(req);
        const id = randomUUID().slice(0, 8);
        const request: TaskBridgeRequest = {
          id,
          title: body.title ?? "Untitled",
          description: body.description ?? "",
          status: "open",
          createdAt: new Date().toISOString(),
        };
        requests.set(id, request);
        console.log(`\n[task-bridge] New signal raised: ${id}`);
        console.log(`  Title:       ${request.title}`);
        console.log(`  Description: ${request.description}`);
        console.log(`  Resolve it:  npm run resolve -- ${id} "<your answer>"\n`);
        res.writeHead(201);
        res.end(JSON.stringify({ id }));
        return;
      }

      const waitMatch = url.pathname.match(/^\/requests\/([^/]+)\/wait$/);
      if (req.method === "GET" && waitMatch) {
        const id = waitMatch[1];
        const request = requests.get(id);
        if (!request) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "Request not found" }));
          return;
        }
        if (request.status === "resolved") {
          res.writeHead(200);
          res.end(JSON.stringify(request));
          return;
        }
        // Long-poll: hold the connection open until resolved or timeout,
        // so the agent's polling tool naturally retries every few seconds
        // instead of needing a separate sleep mechanism.
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, LONG_POLL_TIMEOUT_MS);
          const list = waiters.get(id) ?? [];
          list.push(() => {
            clearTimeout(timer);
            resolve();
          });
          waiters.set(id, list);
        });
        res.writeHead(200);
        res.end(JSON.stringify(requests.get(id)));
        return;
      }

      const resolveMatch = url.pathname.match(/^\/requests\/([^/]+)\/resolve$/);
      if (req.method === "POST" && resolveMatch) {
        const id = resolveMatch[1];
        const request = requests.get(id);
        if (!request) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "Request not found" }));
          return;
        }
        const body = await readBody(req);
        request.status = "resolved";
        request.answer = body.answer ?? "";
        request.resolvedAt = new Date().toISOString();
        console.log(`\n[task-bridge] ${id} resolved by a human: "${request.answer}"\n`);
        notifyWaiters(id);
        res.writeHead(200);
        res.end(JSON.stringify(request));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  });

  server.listen(port, () => {
    console.log(`[task-bridge] Mock server listening on http://localhost:${port}`);
  });

  return server;
}

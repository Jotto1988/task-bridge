import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { startMockTaskBridgeServer } from "./mockTaskBridgeServer.js";
import { taskBridgeServer } from "./taskBridgeTools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_PROJECT_DIR = path.resolve(__dirname, "../local-project");
const PORT = 8787;

function sh(cmd: string): void {
  execSync(cmd, { cwd: LOCAL_PROJECT_DIR, stdio: "pipe" });
}

/**
 * local-project is its OWN git repository, nested inside this example but
 * gitignored from the outer task-bridge repo (see .gitignore). That keeps
 * the demo's commits isolated from the real project's history, and lets
 * every run reset back to a clean starting point.
 */
function ensureFixtureRepo(): void {
  try {
    sh("git rev-parse --is-inside-work-tree");
    sh("git reset --hard initial-state");
    sh("git clean -fd");
    console.log("[setup] Reset local-project to its initial buggy state.\n");
  } catch {
    sh("git init -q");
    sh('git config user.email "demo@task-bridge.local"');
    sh('git config user.name "Task Bridge Demo"');
    sh("git add -A");
    sh('git commit -q -m "Initial state: failing test, undocumented DST business rule"');
    sh("git tag initial-state");
    console.log("[setup] Initialized local-project as an isolated git repo.\n");
  }
}

async function main() {
  ensureFixtureRepo();
  const server = startMockTaskBridgeServer(PORT);

  // Claude Code operates on the process's working directory by default —
  // point it at the sandboxed fixture so nothing outside this example is
  // ever touched.
  process.chdir(LOCAL_PROJECT_DIR);
  console.log(`[setup] Working directory: ${LOCAL_PROJECT_DIR}\n`);
  console.log("Starting agent — this may take a moment...\n");

  const task = `
The test in internal-lib/dateWindow.test.js is failing. Run it with
"node internal-lib/dateWindow.test.js" to see the failure, then read
internal-lib/dateWindow.js to understand what it does.

The correct fix depends on a business rule — which timezone the report
boundary should be computed in — that is not written down anywhere in
this repository's code, comments, or tests. Do not guess at it, and do
not just hardcode whatever value makes the test pass without knowing
why it's correct. If the fix requires knowledge you don't have and
can't derive from what's in front of you, use the emit_task_bridge_signal
tool to ask a human. Then use check_task_bridge_status, calling it again
if needed, to wait for their answer before making any change.

Once you have a real answer from a human and the test passes, stage and
commit your change with git. Mention the human's answer in the commit
message body so the reasoning behind the fix is preserved.
`.trim();

  for await (const message of query({
    prompt: task,
    options: {
      mcpServers: { taskbridge: taskBridgeServer },
      allowedTools: [
        "Read",
        "Edit",
        "Write",
        "Bash",
        "Glob",
        "Grep",
        "mcp__taskbridge__emit_task_bridge_signal",
        "mcp__taskbridge__check_task_bridge_status",
      ],
      // Safe only because this runs inside the sandboxed, isolated
      // local-project fixture repo — never use bypassPermissions against
      // a real codebase.
      permissionMode: "bypassPermissions",
    },
  })) {
    const anyMessage = message as any;
    if (anyMessage.type === "assistant" && anyMessage.message?.content) {
      for (const block of anyMessage.message.content as any[]) {
        if ("text" in block && block.text) {
          console.log(`[claude] ${block.text}\n`);
        } else if ("name" in block) {
          console.log(`[tool call] ${block.name}(${JSON.stringify(block.input)})\n`);
        }
      }
    } else if (anyMessage.type === "result") {
      console.log(`[done] ${anyMessage.subtype}\n`);
    }
  }

  console.log("--- git log in local-project ---");
  console.log(execSync("git log --oneline", { cwd: LOCAL_PROJECT_DIR }).toString());

  server.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

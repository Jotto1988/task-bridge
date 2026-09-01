import { z } from "zod";
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";

const BASE_URL = "http://localhost:8787";

const emitTaskBridgeSignal = tool(
  "emit_task_bridge_signal",
  "Raise a human-in-the-loop request when you hit a decision that depends on business or institutional knowledge you cannot determine from the code, tests, or docs in front of you. Do NOT use this for ordinary bugs you can reason about and fix yourself — only for genuine uncertainty where guessing wrong could break something. Returns a request ID; use check_task_bridge_status with that ID to wait for a human's answer.",
  {
    title: z.string().describe("A short, specific title for the question — this is what a human sees first"),
    description: z
      .string()
      .describe("The full context: what you were doing, exactly what's ambiguous, and what you need to know to proceed correctly"),
  },
  async (args) => {
    const res = await fetch(`${BASE_URL}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: args.title, description: args.description }),
    });
    const data: any = await res.json();
    return {
      content: [
        {
          type: "text" as const,
          text: `Signal raised as request ${data.id}. A human needs to answer this before you continue — call check_task_bridge_status with requestId "${data.id}" to wait for their response.`,
        },
      ],
    };
  }
);

const checkTaskBridgeStatus = tool(
  "check_task_bridge_status",
  "Check whether a human has responded to a request you raised with emit_task_bridge_signal. This waits briefly for a response; if nobody has answered yet, call it again to keep waiting.",
  {
    requestId: z.string().describe("The request ID returned by emit_task_bridge_signal"),
  },
  async (args) => {
    const res = await fetch(`${BASE_URL}/requests/${args.requestId}/wait`);
    if (!res.ok) {
      return {
        content: [{ type: "text" as const, text: `Could not find request ${args.requestId}.` }],
        isError: true,
      };
    }
    const data: any = await res.json();
    if (data.status === "resolved") {
      return {
        content: [
          {
            type: "text" as const,
            text: `A human answered: "${data.answer}". Use this to proceed with the fix.`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: `Still waiting for a human to respond to request ${args.requestId}. Call check_task_bridge_status again.`,
        },
      ],
    };
  }
);

export const taskBridgeServer = createSdkMcpServer({
  name: "taskbridge",
  version: "1.0.0",
  tools: [emitTaskBridgeSignal, checkTaskBridgeStatus],
});

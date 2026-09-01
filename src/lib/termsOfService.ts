import { HitlRequest } from "../types";

/**
 * Generates plain-language terms shipped with every request. This is a
 * deterministic template — NOT legal advice, and not a substitute for
 * review by an actual lawyer before this is used for anything real. It's
 * here so no job ever ships with zero terms, and so the shape of what
 * "terms per job" should cover is explicit and inspectable.
 *
 * A natural upgrade path: replace the body of this function with a call to
 * an LLM (with a lawyer-reviewed system prompt) that drafts context-aware
 * terms per request, then keep this template as the fallback if that call
 * fails. The signature is designed so that swap doesn't touch any caller.
 */
export function generateTermsOfService(input: {
  category: HitlRequest["category"];
  payoutCents: number;
  currency: string;
  turnaroundMinutes: number;
  orgName: string;
}): string {
  const payoutDisplay = (input.payoutCents / 100).toFixed(2);
  const hours = Math.round((input.turnaroundMinutes / 60) * 10) / 10;

  return [
    `Terms for this task, published by ${input.orgName} via Task Bridge.`,
    ``,
    `1. Independent work, not employment. Accepting this task does not create an employment, agency, or partnership relationship between the resolver and ${input.orgName} or Task Bridge. The resolver is acting as an independent contractor for the duration of this single task only.`,
    `2. Payment. The agreed payout for this task is ${input.currency} ${payoutDisplay}, payable on verified completion. Payment mechanics (timing, method) are between the resolver and ${input.orgName} and are not processed by Task Bridge itself.`,
    `3. Turnaround. This task must be completed within ${input.turnaroundMinutes} minutes (~${hours} hour${hours === 1 ? "" : "s"}) of being claimed. If it is not completed in that window, the claim expires automatically and the task reopens to other resolvers.`,
    `4. Conduct. The resolver agrees to represent themselves professionally for the duration of the task, including following any attire or site-specific guidance provided with the task.`,
    `5. Liability. This is an open-source concept platform. Neither Task Bridge nor its maintainers are a party to the agreement between ${input.orgName} and the resolver, and assume no liability for the conduct, safety, or outcome of any task. Both sides are responsible for their own insurance, safety precautions, and legal compliance appropriate to the nature of the task (category: ${input.category}).`,
    `6. Disputes. Disputes are between the resolver and ${input.orgName} directly. Ratings left after this task contribute to both parties' visible track record on the platform.`,
    ``,
    `These terms are auto-generated and are not a substitute for independent legal advice. If you are deploying this platform for real work, have these terms reviewed and replace this generator with your own vetted language.`,
  ].join("\n");
}

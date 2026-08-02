/**
 * The summary a reader carries to another assistant.
 *
 * A handoff is the durable form of continuity: it is immutable, it belongs to a
 * Work Item, and everything in it was chosen by a person on purpose. That is
 * what makes it evidence, and also what makes it a poor answer to "I am moving
 * to another assistant right now": it asks for a Work Item, a selection of
 * memory, a written next action, and a selection of events before it gives
 * anything back.
 *
 * This is the other form. It is composed from what the authoritative stores
 * already say, it is never persisted, and it is not evidence of anything: it is
 * a passage of text to paste elsewhere. Nothing here selects, sends, or
 * authorizes — composing it is a read.
 *
 * Two rules keep it honest:
 *
 * - **every claim carries where it came from**, because a summary whose lines
 *   cannot be traced back is exactly the material a second assistant would
 *   restate as fact;
 * - **what did not fit is stated**, never silently dropped. A truncated summary
 *   that looks complete is worse than a short one that says it is short.
 */

const BUDGET_BYTES = 8_000;
/**
 * Held back for the closing section. Stating what was left out is part of the
 * summary, so it has to fit inside the same budget as the rest: a truncation
 * notice that is itself truncated away would leave the summary looking whole.
 */
const OMISSION_RESERVE = 512;
const MAX_DECISIONS = 20;
const MAX_FINDINGS = 10;

export type RestartDecision = Readonly<{
  content: string;
  verification: string;
  /** Where this was extracted from, or null when it was authored directly. */
  sourceEventId: string | null;
}>;

export type RestartFinding = Readonly<{
  eventId: string;
  occurredAt: string | null;
  snippet: string;
  /** Why this passage was reached, already stated in the reader's terms. */
  why: string;
}>;

export type RestartSummaryInput = Readonly<{
  projectName: string;
  branch: string | null;
  headCommit: string | null;
  isDirty: boolean;
  /** The question that was asked, when the summary follows a search. */
  question: string | null;
  decisions: readonly RestartDecision[];
  findings: readonly RestartFinding[];
}>;

export type RestartSummary = Readonly<{
  text: string;
  exactBytes: number;
  /** What was left out, in the reader's terms. Empty when nothing was. */
  omissions: readonly string[];
}>;

function bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

/**
 * Composes the summary. Sections are added while they fit, in the order a
 * reader needs them: what the work is, what was decided, what was being looked
 * at. A section that does not fit is dropped whole and named, rather than cut
 * mid-sentence into something that reads as complete.
 */
export function composeRestartSummary(
  input: RestartSummaryInput,
): RestartSummary {
  const omissions: string[] = [];
  const lines: string[] = [
    `# Restarting work on ${input.projectName}`,
    "",
    "This is a local summary composed from stored evidence. Nothing in it was",
    "sent anywhere, and it is not an instruction to act.",
    "",
    "## Repository",
    `- branch: ${input.branch ?? "unknown"}`,
    `- commit: ${input.headCommit ?? "unknown"}`,
    `- working tree: ${input.isDirty ? "has uncommitted changes" : "clean"}`,
  ];

  if (input.question !== null) {
    lines.push("", "## Question asked", `- ${input.question}`);
  }

  const decisions = input.decisions.slice(0, MAX_DECISIONS);
  if (decisions.length < input.decisions.length)
    omissions.push(
      `${input.decisions.length - decisions.length} further decision(s) not included`,
    );
  if (decisions.length > 0) {
    lines.push("", "## What was decided");
    for (const decision of decisions)
      lines.push(
        `- ${decision.content} [${decision.verification}${
          decision.sourceEventId === null
            ? ", authored directly"
            : `, from event ${decision.sourceEventId}`
        }]`,
      );
  }

  const findings = input.findings.slice(0, MAX_FINDINGS);
  if (findings.length < input.findings.length)
    omissions.push(
      `${input.findings.length - findings.length} further result(s) not included`,
    );
  if (findings.length > 0) {
    lines.push("", "## What was being looked at");
    for (const finding of findings)
      lines.push(
        `- ${finding.snippet}`,
        `  [event ${finding.eventId}, ${finding.occurredAt ?? "no timestamp"}, matched because ${finding.why}]`,
      );
  }

  /**
   * Sections are removed from the end while the whole exceeds the budget: the
   * repository and the question are what a second assistant cannot reconstruct,
   * so they are the last to go.
   */
  const kept: string[] = [];
  let used = 0;
  let dropped = 0;
  for (const line of lines) {
    const cost = bytes(line) + 1;
    if (used + cost > BUDGET_BYTES - OMISSION_RESERVE) {
      dropped += 1;
      continue;
    }
    kept.push(line);
    used += cost;
  }
  if (dropped > 0)
    omissions.push(`${dropped} line(s) dropped to stay inside the byte budget`);

  if (omissions.length > 0)
    kept.push(
      "",
      "## Not included",
      ...omissions.map((omission) => `- ${omission}`),
    );

  const text = `${kept.join("\n")}\n`;
  return Object.freeze({
    text,
    exactBytes: bytes(text),
    omissions: Object.freeze(omissions),
  });
}

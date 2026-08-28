/**
 * The authenticated routes of the restart point, read and write.
 *
 * ADR-0035 keeps routing in modules of its own, one per area. This one is reached
 * from the conversation route rather than from the host, because the paths it
 * answers are paths inside a conversation: the module that owns
 * `/api/conversations/...` is the module that knows what is under it.
 *
 * The read composes through the non-persisting path of ADR-0037 and stores nothing,
 * so it is a GET and no mutation guard applies to it. Fixing the summary is the one
 * write, and it is a POST on the same path: the person is on that conversation, and
 * asking them for a project, a Work Item and an event identifier is exactly what
 * ADR-0037 exists to remove. Because it is reached outside the host's own write
 * block, the guard is handed to this module rather than inherited from position: an
 * unauthorized POST is refused here, with the same origin, CSRF and content-type
 * check every other local write passes.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import type { GuiApplication } from "./application.ts";
import { GuiApplicationError } from "./application.ts";
import { json, readJson, record, reject } from "./http-plumbing.ts";
import type { RestartPointTestInput } from "./restart-point-fixing.ts";

const PATH = /^\/api\/conversations\/([^/]+)\/restart-point$/u;

/** Whether the browser may write here, decided by the host and passed down. */
export type MutationGuard = (request: IncomingMessage) => boolean;

const OUTCOMES = Object.freeze({
  passed: "PASS" as const,
  failed: "FAIL" as const,
  "not-run": "NOT_RUN" as const,
});

/**
 * What the person stated about the tests, read from the body.
 *
 * The interface sends words rather than the stored constants, so the mapping lives
 * here. An outcome that is not one of the three is not silently dropped: it comes
 * back as null with the command intact, and the domain refuses half an observation
 * rather than storing a run nobody described.
 */
function testOf(value: unknown): RestartPointTestInput | null {
  if (!record(value)) return null;
  const command = typeof value.command === "string" ? value.command : "";
  const stated = typeof value.outcome === "string" ? value.outcome : "";
  const observedAt =
    typeof value.observedAt === "string" && value.observedAt.length > 0
      ? value.observedAt
      : null;
  return Object.freeze({
    command,
    outcome: OUTCOMES[stated as keyof typeof OUTCOMES] ?? null,
    observedAt,
  });
}

async function fix(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  application: GuiApplication,
  conversationId: string,
): Promise<void> {
  const body = await readJson(request);
  if (
    !record(body) ||
    typeof body.composition !== "string" ||
    typeof body.nextAction !== "string"
  )
    return reject(
      response,
      400,
      "Confirm the summary you are looking at, with the text you want stored.",
      "Reload the conversation and confirm again from the summary it shows.",
    );
  const result = await application.restartPoints.fix({
    conversationId,
    projectId: url.searchParams.get("project"),
    composition: body.composition,
    nextAction: body.nextAction,
    test: testOf(body.test),
  });
  if (result === null)
    return reject(
      response,
      404,
      "That conversation is no longer here.",
      "Return to your conversations and open another one from the list.",
    );
  json(response, "fixed" in result && result.fixed ? 201 : 200, result);
}

export async function handleRestartPointRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  application: GuiApplication,
  authorizeWrite: MutationGuard,
): Promise<boolean> {
  if (request.method !== "GET" && request.method !== "POST") return false;
  const match = PATH.exec(url.pathname);
  if (match === null) return false;
  const conversationId = decodeURIComponent(match[1]!);
  try {
    if (request.method === "POST") {
      if (!authorizeWrite(request))
        reject(
          response,
          403,
          "The local request failed origin or CSRF validation.",
          "Reload this page from the local address and confirm again.",
        );
      else await fix(request, response, url, application, conversationId);
      return true;
    }
    const point = await application.restartPoints.open({
      conversationId,
      projectId: url.searchParams.get("project"),
    });
    if (point === null)
      reject(
        response,
        404,
        "That conversation is no longer here.",
        "Return to your conversations and open another one from the list.",
      );
    else json(response, 200, point);
  } catch (error) {
    if (error instanceof GuiApplicationError)
      reject(response, 400, error.message, error.recovery);
    else
      reject(
        response,
        500,
        "This conversation's restart point could not be composed.",
        "Nothing was saved. Check local workspace permissions, then reload the conversation.",
      );
  }
  return true;
}

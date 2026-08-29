/**
 * The one write behind declaring that a conversation is a piece of work.
 *
 * It is a POST on the conversation path for the reason the restart point's own
 * confirmation is: the server reads which session this is and composes the evidence
 * itself, so no caller names a Work Item, an event or a session of its own choosing.
 * The browser supplies the objective, which is the only part the person wrote.
 *
 * Reached from the conversation route rather than from the host, so the origin and
 * CSRF guard arrives as an explicit parameter instead of being inherited from a
 * position in the routing table.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import type { GuiApplication } from "./application.ts";
import { GuiApplicationError } from "./application.ts";
import { json, readJson, record, reject } from "./http-plumbing.ts";
import type { MutationGuard } from "./restart-point-route.ts";

const PATH = /^\/api\/conversations\/([^/]+)\/work$/u;

export async function handleWorkFromConversationRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  application: GuiApplication,
  authorizeWrite: MutationGuard,
): Promise<boolean> {
  if (request.method !== "POST") return false;
  const match = PATH.exec(url.pathname);
  if (match === null) return false;
  const conversationId = decodeURIComponent(match[1]!);
  if (!authorizeWrite(request)) {
    reject(
      response,
      403,
      "The local request failed origin or CSRF validation.",
      "Reload this page from the local address and declare the work again.",
    );
    return true;
  }
  try {
    const body = await readJson(request);
    if (!record(body) || typeof body.objective !== "string")
      reject(
        response,
        400,
        "Write what this work is, in your own words.",
        "Keep the conversation open, enter the objective, and try again.",
      );
    else {
      const result = await application.workFromConversation.start({
        conversationId,
        projectId: url.searchParams.get("project"),
        objective: body.objective,
      });
      if (result === null)
        reject(
          response,
          404,
          "That conversation is no longer here.",
          "Return to your conversations and open another one from the list.",
        );
      else json(response, result.started ? 201 : 200, result);
    }
  } catch (error) {
    if (error instanceof GuiApplicationError)
      reject(response, 400, error.message, error.recovery);
    else
      reject(
        response,
        500,
        "This conversation could not be declared as work.",
        "Nothing was saved. Check local workspace permissions, then reload the conversation.",
      );
  }
  return true;
}

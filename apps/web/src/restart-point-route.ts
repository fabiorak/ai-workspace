/**
 * The authenticated read route behind the restart point.
 *
 * ADR-0035 keeps routing in modules of its own, one per area. This one is reached
 * from the conversation route rather than from the host, because the path it
 * answers is a path inside a conversation: the module that owns
 * `/api/conversations/...` is the module that knows what is under it.
 *
 * The route is a read in the strict sense — it composes through the non-persisting
 * path of ADR-0037 and stores nothing — so it is a GET, and no mutation guard
 * applies to it.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import type { GuiApplication } from "./application.ts";
import { GuiApplicationError } from "./application.ts";
import { json, reject } from "./http-plumbing.ts";

const PATH = /^\/api\/conversations\/([^/]+)\/restart-point$/u;

export async function handleRestartPointRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  application: GuiApplication,
): Promise<boolean> {
  if (request.method !== "GET") return false;
  const match = PATH.exec(url.pathname);
  if (match === null) return false;
  try {
    const point = await application.restartPoints.open({
      conversationId: decodeURIComponent(match[1]!),
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

/**
 * The authenticated read route behind the conversation list.
 *
 * ADR-0035 keeps routing in modules of its own, one per area, so the host stays a
 * host. The handler answers whether it took the request: an unmatched path falls
 * through to the rest of the routing table untouched.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import type { GuiApplication } from "./application.ts";
import { GuiApplicationError } from "./application.ts";
import { json, reject } from "./http-plumbing.ts";

/** Same shape as the other list bounds in this interface, so one rule covers them all. */
function limitOf(value: string | null): number | undefined {
  if (value === null) return undefined;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new GuiApplicationError(
      "The conversation limit must be a whole number from 1 to 100.",
      "Remove the limit to use the local default, then retry.",
    );
  return limit;
}

export async function handleConversationRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  application: GuiApplication,
): Promise<boolean> {
  if (request.method !== "GET" || url.pathname !== "/api/conversations")
    return false;
  try {
    json(
      response,
      200,
      await application.listConversations(
        limitOf(url.searchParams.get("limit")),
      ),
    );
  } catch (error) {
    if (error instanceof GuiApplicationError)
      reject(response, 400, error.message, error.recovery);
    else
      reject(
        response,
        500,
        "Your conversations could not be read.",
        "Check local workspace permissions, then reload the page.",
      );
  }
  return true;
}

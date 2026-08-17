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

/**
 * The id of one conversation, or null when the path is the list itself.
 *
 * Decoded before use so an id is compared as it was stored, and never joined to a
 * path: it names a record, not a file.
 */
function conversationIdOf(pathname: string): string | null {
  if (!pathname.startsWith("/api/conversations/")) return null;
  const id = decodeURIComponent(pathname.slice("/api/conversations/".length));
  return id.length === 0 || id.includes("/") ? null : id;
}

export async function handleConversationRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  application: GuiApplication,
): Promise<boolean> {
  if (request.method !== "GET") return false;
  const id = conversationIdOf(url.pathname);
  if (id === null && url.pathname !== "/api/conversations") return false;
  try {
    if (id !== null) {
      /**
       * No caller-set bound here: the list bound is a page size, while a
       * conversation is bounded by what it is, and one number that means two
       * things is a number that will be wrong for one of them.
       */
      const conversation = await application.conversations.open({
        id,
        projectId: url.searchParams.get("project"),
      });
      if (conversation === null)
        reject(
          response,
          404,
          "That conversation is no longer here.",
          "Return to your conversations and open another one from the list.",
        );
      else json(response, 200, conversation);
      return true;
    }
    json(
      response,
      200,
      await application.conversations.list(
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

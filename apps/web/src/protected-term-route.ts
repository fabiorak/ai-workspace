import type { IncomingMessage, ServerResponse } from "node:http";

import { PII_ENTITY_TYPES } from "@ai-workspace/privacy-gateway";

import type { GuiApplication } from "./application.ts";
import { json, readJson, record } from "./http-plumbing.ts";

type MutationGuard = (request: IncomingMessage) => boolean;
const PATH = /^\/api\/conversations\/([^/]+)\/protected-terms$/u;
const GENERAL_PATH = "/api/protected-terms";

/**
 * Why the value was not protected, as a code the browser can say in the reader's
 * own language. "Nothing changed" is true of all of them and tells a person
 * nothing about what to do differently, which is the whole point of the panel.
 * A code names the kind of obstacle only: never a key, a map, a scope or a path.
 */
export const PROTECTED_TERM_REFUSALS = Object.freeze([
  "LOCAL_GUARD",
  "TERM_INVALID",
  "TYPE_CONFLICT",
  "SCOPE_UNAVAILABLE",
  "NOT_STORED",
] as const);
export type ProtectedTermRefusal = (typeof PROTECTED_TERM_REFUSALS)[number];

function refuse(
  response: ServerResponse,
  status: number,
  reason: ProtectedTermRefusal,
  message: string,
  recovery: string,
) {
  return json(response, status, { reason, message, recovery });
}

/**
 * The person names the value; the server resolves which stable map owns it. A
 * first General draft uses the fixed GENERAL scope, not a browser-supplied one.
 * The browser never receives or chooses the scope, key, map or a path.
 */
export async function handleProtectedTermRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  application: GuiApplication,
  authorizeWrite: MutationGuard,
): Promise<boolean> {
  const match = PATH.exec(url.pathname);
  const general = url.pathname === GENERAL_PATH;
  if ((match === null && !general) || request.method !== "POST") return false;
  if (!authorizeWrite(request)) {
    refuse(
      response,
      403,
      "LOCAL_GUARD",
      "The local request failed origin or CSRF validation.",
      "Reload the local page, then name the value again.",
    );
    return true;
  }
  const body = await readJson(request);
  if (
    !record(body) ||
    Object.keys(body).some((key) => !["term", "type"].includes(key)) ||
    typeof body.term !== "string" ||
    typeof body.type !== "string" ||
    !PII_ENTITY_TYPES.includes(body.type as (typeof PII_ENTITY_TYPES)[number])
  ) {
    refuse(
      response,
      400,
      "TERM_INVALID",
      "Name one short value and the kind of data it is.",
      "Keep the draft and correct the term.",
    );
    return true;
  }
  try {
    json(
      response,
      200,
      await application.conversationTurns.addProtectedTerm({
        ...(match === null
          ? {}
          : { conversationId: decodeURIComponent(match[1]!) }),
        term: body.term,
        type: body.type as (typeof PII_ENTITY_TYPES)[number],
      }),
    );
  } catch (error) {
    const failure = error instanceof Error ? error.message : "";
    if (failure === "PROTECTED_TERM_TYPE_CONFLICT")
      refuse(
        response,
        409,
        "TYPE_CONFLICT",
        "This value is already protected as another kind of data.",
        "Keep the existing kind, or choose a different value.",
      );
    else if (failure === "PROTECTED_TERM_INVALID")
      refuse(
        response,
        400,
        "TERM_INVALID",
        "Name one short value and the kind of data it is.",
        "Keep the draft and correct the term.",
      );
    else if (failure === "CONVERSATION_SCOPE_UNAVAILABLE_OR_AMBIGUOUS")
      // The map a term belongs to is the one the next message would use, so a
      // conversation the server cannot resolve has no map to extend. Saying so
      // separates a stale open conversation from a value the panel refused.
      refuse(
        response,
        409,
        "SCOPE_UNAVAILABLE",
        "This conversation does not resolve to one local map.",
        "Reopen the conversation from the list, then name the value again.",
      );
    else
      refuse(
        response,
        500,
        "NOT_STORED",
        "The term was not protected, so nothing was changed.",
        "Keep the draft, check local state integrity, and try again.",
      );
  }
  return true;
}

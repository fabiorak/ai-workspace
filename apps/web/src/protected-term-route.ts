import type { IncomingMessage, ServerResponse } from "node:http";

import { PII_ENTITY_TYPES } from "@ai-workspace/privacy-gateway";

import type { GuiApplication } from "./application.ts";
import { json, readJson, record, reject } from "./http-plumbing.ts";

type MutationGuard = (request: IncomingMessage) => boolean;
const PATH = /^\/api\/conversations\/([^/]+)\/protected-terms$/u;
const GENERAL_PATH = "/api/protected-terms";

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
    reject(
      response,
      403,
      "The local request failed origin or CSRF validation.",
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
    reject(
      response,
      400,
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
    const reason = error instanceof Error ? error.message : "";
    if (reason === "PROTECTED_TERM_TYPE_CONFLICT")
      reject(
        response,
        409,
        "This value is already protected as another kind of data.",
        "Keep the existing kind, or choose a different value.",
      );
    else if (reason === "PROTECTED_TERM_INVALID")
      reject(
        response,
        400,
        "Name one short value and the kind of data it is.",
        "Keep the draft and correct the term.",
      );
    else
      reject(
        response,
        500,
        "The term was not protected, so nothing was changed.",
        "Keep the draft, check local state integrity, and try again.",
      );
  }
  return true;
}

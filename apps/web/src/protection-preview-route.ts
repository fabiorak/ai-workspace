import type { IncomingMessage, ServerResponse } from "node:http";

import type { GuiApplication } from "./application.ts";
import { json, readJson, record, reject } from "./http-plumbing.ts";

type MutationGuard = (request: IncomingMessage) => boolean;
const PATH = /^\/api\/conversations\/([^/]+)\/protection-preview$/u;

/**
 * A preview may extend the local stable map, but cannot compose context, write
 * an audit event or reach a transport. Scope is resolved from the conversation
 * rather than accepted from the browser.
 */
export async function handleProtectionPreviewRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  application: GuiApplication,
  authorizeWrite: MutationGuard,
): Promise<boolean> {
  const match = PATH.exec(url.pathname);
  if (match === null || request.method !== "POST") return false;
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
    Object.keys(body).some((key) => key !== "text") ||
    typeof body.text !== "string"
  ) {
    reject(response, 400, "Preview one bounded draft message.");
    return true;
  }
  try {
    json(
      response,
      200,
      await application.conversationTurns.previewProtection({
        conversationId: decodeURIComponent(match[1]!),
        text: body.text,
      }),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PROTECTION_PREVIEW_INVALID"
    )
      reject(response, 400, "Preview one bounded draft message.");
    else
      reject(
        response,
        500,
        "The protected preview is unavailable, so nothing was sent.",
        "Keep the draft, check local protection, and try again.",
      );
  }
  return true;
}

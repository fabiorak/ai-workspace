/**
 * The authenticated write routes of one project: registering it, re-reading it, and
 * bringing in the reviewed synthetic sample.
 *
 * ADR-0035 keeps routing in modules of its own, one per area, so the host stays a
 * host. The host asks for this module inside its own write block, after the origin
 * and CSRF check, and wraps the exchange in the try that turns a failure into a
 * message with its recovery — so there is no second catch here answering the same
 * failure with different words.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import type { GuiApplication } from "./application.ts";
import { json, readJson, record, reject } from "./http-plumbing.ts";

const INSPECT = /^\/api\/projects\/([^/]+)\/inspect$/u;
const SAMPLE = /^\/api\/projects\/([^/]+)\/import-sample$/u;

export async function handleProjectRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  application: GuiApplication,
): Promise<boolean> {
  if (url.pathname === "/api/projects") {
    const body = await readJson(request);
    if (!record(body) || typeof body.path !== "string")
      reject(response, 400, "Enter a local Git repository directory.");
    else json(response, 201, await application.registerProject(body.path));
    return true;
  }
  const inspect = INSPECT.exec(url.pathname);
  if (inspect !== null) {
    json(
      response,
      200,
      await application.inspectProject(decodeURIComponent(inspect[1]!)),
    );
    return true;
  }
  const sample = SAMPLE.exec(url.pathname);
  if (sample !== null) {
    json(
      response,
      200,
      await application.importSample(decodeURIComponent(sample[1]!)),
    );
    return true;
  }
  return false;
}

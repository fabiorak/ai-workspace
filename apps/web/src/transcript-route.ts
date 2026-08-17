/**
 * The authenticated write routes behind the transcripts a person brings in.
 *
 * ADR-0035 keeps routing in modules of its own, one per area, so the host stays a
 * host. The handler answers whether it took the request: an unmatched path falls
 * through to the rest of the routing table untouched.
 *
 * Bringing in what has arrived is a write and is stated as one. It could have been
 * hung off the list read, which a browser fetches anyway, but a read that imports is
 * a read that any page could trigger and that no cache may repeat safely — so it
 * asks for the same method, and the same CSRF check, as every other local write.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import type { GuiApplication } from "./application.ts";
import { GuiApplicationError } from "./application.ts";
import { json, readJson, record, reject } from "./http-plumbing.ts";

const IMPORT_PATH = /^\/api\/projects\/([^/]+)\/import-transcript$/u;

export async function handleTranscriptRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  application: GuiApplication,
): Promise<boolean> {
  if (request.method !== "POST") return false;
  const imported = IMPORT_PATH.exec(url.pathname);
  const discover = url.pathname === "/api/transcripts/discover";
  const arrived = url.pathname === "/api/transcripts/arrived";
  if (imported === null && !discover && !arrived) return false;
  try {
    if (arrived) {
      json(response, 200, await application.transcripts.arrived());
      return true;
    }
    const body = await readJson(request);
    if (imported !== null) {
      if (
        !record(body) ||
        typeof body.filePath !== "string" ||
        body.filePath.length === 0
      )
        reject(
          response,
          400,
          "Select one discovered transcript file to import.",
        );
      else
        json(
          response,
          200,
          await application.transcripts.import(
            decodeURIComponent(imported[1]!),
            body.filePath,
          ),
        );
      return true;
    }
    if (
      !record(body) ||
      typeof body.directory !== "string" ||
      body.directory.length === 0
    )
      reject(response, 400, "Enter the directory that holds your transcripts.");
    else
      json(
        response,
        200,
        await application.transcripts.discover(body.directory),
      );
  } catch (error) {
    if (error instanceof GuiApplicationError)
      reject(response, 400, error.message, error.recovery);
    else
      reject(
        response,
        500,
        "That transcript could not be read.",
        "Check that the file is still readable, then retry.",
      );
  }
  return true;
}

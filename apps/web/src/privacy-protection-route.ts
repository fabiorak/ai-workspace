import type { IncomingMessage, ServerResponse } from "node:http";

import type { GuiApplication } from "./application.ts";
import { json, readJson, reject } from "./http-plumbing.ts";

type MutationGuard = (request: IncomingMessage) => boolean;

export async function handlePrivacyProtectionRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  application: GuiApplication,
  authorizeWrite: MutationGuard,
) {
  if (url.pathname === "/api/privacy-protection") {
    if (request.method !== "GET") return false;
    json(response, 200, await application.privacyProtection.inspect());
    return true;
  }
  if (url.pathname !== "/api/privacy-protection/migrate") return false;
  if (request.method !== "POST") return false;
  if (!authorizeWrite(request)) {
    reject(
      response,
      403,
      "The local request failed origin or CSRF validation.",
    );
    return true;
  }
  try {
    json(
      response,
      200,
      await application.privacyProtection.migrateLegacy(
        await readJson(request),
      ),
    );
  } catch {
    reject(
      response,
      400,
      "Legacy migration failed closed. Existing files were preserved; verify the mapping identity and passphrase.",
    );
  }
  return true;
}

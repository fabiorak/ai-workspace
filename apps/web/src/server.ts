import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { APP_CSS, APP_JS, shellHtml } from "./assets.ts";
import { GuiApplication, GuiApplicationError } from "./application.ts";
import {
  SESSION_EVENT_TYPES,
  type SessionEventType,
} from "@ai-workspace/session-ingestion";
import {
  MEMORY_ITEM_TYPES,
  MEMORY_VALIDITIES,
  MEMORY_VERIFICATIONS,
  type MemoryItemType,
  type MemoryValidity,
  type MemoryVerification,
} from "@ai-workspace/active-memory";

const MAX_BODY = 32 * 1024;
const COOKIE = "aiw_session";
export type GuiServer = Readonly<{
  bootstrapUrl: string;
  origin: string;
  close(): Promise<void>;
}>;

export async function startGuiServer(
  application: GuiApplication,
  options: Readonly<{
    port?: number;
    bootstrapToken?: string;
    sessionToken?: string;
    csrfToken?: string;
  }> = {},
): Promise<GuiServer> {
  const bootstrapToken =
    options.bootstrapToken ?? randomBytes(32).toString("hex");
  const sessionToken = options.sessionToken ?? randomBytes(32).toString("hex");
  const csrfToken = options.csrfToken ?? randomBytes(32).toString("hex");
  let bootstrapAvailable = true;
  let authority = "";
  let origin = "";
  const server = createServer(async (request, response) => {
    secureHeaders(response);
    try {
      if (
        !loopback(request.socket.remoteAddress) ||
        !validHost(request.headers.host, authority)
      )
        return reject(response, 403, "Request origin is not allowed.");
      const url = new URL(request.url ?? "/", origin);
      if (
        request.method === "GET" &&
        url.pathname === `/bootstrap/${bootstrapToken}`
      ) {
        if (!bootstrapAvailable)
          return reject(
            response,
            410,
            "This bootstrap link has already been used.",
          );
        bootstrapAvailable = false;
        response.statusCode = 303;
        response.setHeader(
          "Set-Cookie",
          `${COOKIE}=${sessionToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,
        );
        response.setHeader("Location", "/");
        return response.end();
      }
      if (!authenticated(request, sessionToken))
        return reject(
          response,
          401,
          "Open the one-time bootstrap URL printed by the local GUI process.",
        );
      if (request.method === "GET" && url.pathname === "/")
        return send(response, "text/html; charset=utf-8", shellHtml(csrfToken));
      if (request.method === "GET" && url.pathname === "/app.css")
        return send(response, "text/css; charset=utf-8", APP_CSS);
      if (request.method === "GET" && url.pathname === "/app.js")
        return send(response, "text/javascript; charset=utf-8", APP_JS);
      if (request.method === "GET" && url.pathname === "/api/projects")
        return json(response, 200, await application.listProjects());
      if (request.method === "GET") {
        if (url.pathname === "/api/search") {
          const typeValue = url.searchParams.get("type");
          if (
            typeValue !== null &&
            !SESSION_EVENT_TYPES.includes(typeValue as SessionEventType)
          )
            return reject(
              response,
              400,
              "Choose a documented canonical event type.",
            );
          const limitValue = url.searchParams.get("limit");
          return json(
            response,
            200,
            await application.searchAllProjects({
              text: url.searchParams.get("q") ?? "",
              ...(typeValue === null
                ? {}
                : { type: typeValue as SessionEventType }),
              ...(limitValue === null ? {} : { limit: Number(limitValue) }),
            }),
          );
        }
        const workList = /^\/api\/projects\/([^/]+)\/work-items$/u.exec(
          url.pathname,
        );
        if (workList !== null)
          return json(
            response,
            200,
            await application.listWorkItems(decodeURIComponent(workList[1]!)),
          );
        const handoffList =
          /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/handoffs$/u.exec(
            url.pathname,
          );
        if (handoffList !== null)
          return json(
            response,
            200,
            await application.listHandoffs(
              decodeURIComponent(handoffList[1]!),
              decodeURIComponent(handoffList[2]!),
            ),
          );
        const validation =
          /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/handoffs\/([^/]+)\/validate$/u.exec(
            url.pathname,
          );
        if (validation !== null)
          return json(
            response,
            200,
            await application.validateHandoff(
              decodeURIComponent(validation[1]!),
              decodeURIComponent(validation[2]!),
              decodeURIComponent(validation[3]!),
            ),
          );
        const handoffItem =
          /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/handoffs\/([^/]+)$/u.exec(
            url.pathname,
          );
        if (handoffItem !== null)
          return json(
            response,
            200,
            await application.showHandoff(
              decodeURIComponent(handoffItem[1]!),
              decodeURIComponent(handoffItem[2]!),
              decodeURIComponent(handoffItem[3]!),
            ),
          );
        const workItem =
          /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)$/u.exec(url.pathname);
        if (workItem !== null)
          return json(
            response,
            200,
            await application.showWorkItem(
              decodeURIComponent(workItem[1]!),
              decodeURIComponent(workItem[2]!),
            ),
          );
        const memoryList = /^\/api\/projects\/([^/]+)\/memory$/u.exec(
          url.pathname,
        );
        if (memoryList !== null) {
          const type = optionalEnum(
            url.searchParams.get("type"),
            MEMORY_ITEM_TYPES,
            "memory type",
          ) as MemoryItemType | undefined;
          const validity = optionalEnum(
            url.searchParams.get("validity"),
            MEMORY_VALIDITIES,
            "memory validity",
          ) as MemoryValidity | undefined;
          const verification = optionalEnum(
            url.searchParams.get("verification"),
            MEMORY_VERIFICATIONS,
            "memory verification",
          ) as MemoryVerification | undefined;
          const limit = optionalLimit(url.searchParams.get("limit"));
          const cursor = url.searchParams.get("cursor");
          return json(
            response,
            200,
            await application.listMemory({
              projectId: decodeURIComponent(memoryList[1]!),
              ...(type === undefined ? {} : { type }),
              ...(validity === undefined ? {} : { validity }),
              ...(verification === undefined ? {} : { verification }),
              ...(limit === undefined ? {} : { limit }),
              ...(cursor === null ? {} : { cursor }),
            }),
          );
        }
        const memoryItem = /^\/api\/projects\/([^/]+)\/memory\/([^/]+)$/u.exec(
          url.pathname,
        );
        if (memoryItem !== null)
          return json(
            response,
            200,
            await application.showMemory(
              decodeURIComponent(memoryItem[1]!),
              decodeURIComponent(memoryItem[2]!),
            ),
          );
        const search = /^\/api\/projects\/([^/]+)\/search$/u.exec(url.pathname);
        if (search !== null) {
          const typeValue = url.searchParams.get("type");
          if (
            typeValue !== null &&
            !SESSION_EVENT_TYPES.includes(typeValue as SessionEventType)
          )
            return reject(
              response,
              400,
              "Choose a documented canonical event type.",
            );
          const limitValue = url.searchParams.get("limit");
          return json(
            response,
            200,
            await application.search({
              projectId: decodeURIComponent(search[1]!),
              text: url.searchParams.get("q") ?? "",
              ...(typeValue === null
                ? {}
                : { type: typeValue as SessionEventType }),
              ...(limitValue === null ? {} : { limit: Number(limitValue) }),
            }),
          );
        }
        const source =
          /^\/api\/projects\/([^/]+)\/events\/([^/]+)\/source$/u.exec(
            url.pathname,
          );
        if (source !== null)
          return json(
            response,
            200,
            await application.openEventSource(
              decodeURIComponent(source[1]!),
              decodeURIComponent(source[2]!),
            ),
          );
        const event = /^\/api\/projects\/([^/]+)\/events\/([^/]+)$/u.exec(
          url.pathname,
        );
        if (event !== null)
          return json(
            response,
            200,
            await application.showEvent(
              decodeURIComponent(event[1]!),
              decodeURIComponent(event[2]!),
            ),
          );
      }
      if (request.method === "POST") {
        if (!validMutation(request, origin, csrfToken))
          return reject(
            response,
            403,
            "The local request failed origin or CSRF validation.",
          );
        if (url.pathname === "/api/projects") {
          const body = await readJson(request);
          if (!record(body) || typeof body.path !== "string")
            return reject(
              response,
              400,
              "Enter a local Git repository directory.",
            );
          return json(
            response,
            201,
            await application.registerProject(body.path),
          );
        }
        const instructionPreview =
          /^\/api\/projects\/([^/]+)\/instructions\/preview$/u.exec(
            url.pathname,
          );
        if (instructionPreview !== null) {
          const body = await readJson(request);
          if (
            !record(body) ||
            !Array.isArray(body.bundles) ||
            body.bundles.length < 1 ||
            !body.bundles.every(
              (bundle) =>
                record(bundle) &&
                typeof bundle.path === "string" &&
                (bundle.expectedDigest === undefined ||
                  typeof bundle.expectedDigest === "string"),
            ) ||
            !optionalString(body.model) ||
            !optionalString(body.agent) ||
            !optionalString(body.task)
          )
            return reject(
              response,
              400,
              "Select at least one explicit reviewed instruction bundle and valid optional targets.",
            );
          return json(
            response,
            200,
            await application.previewInstructions({
              projectId: decodeURIComponent(instructionPreview[1]!),
              bundles: body.bundles as readonly {
                path: string;
                expectedDigest?: string;
              }[],
              ...(body.model === undefined ? {} : { model: body.model }),
              ...(body.agent === undefined ? {} : { agent: body.agent }),
              ...(body.task === undefined ? {} : { task: body.task }),
            }),
          );
        }
        const agentProfilePreview =
          /^\/api\/projects\/([^/]+)\/agent-profile\/preview$/u.exec(
            url.pathname,
          );
        if (agentProfilePreview !== null) {
          const body = await readJson(request);
          if (
            !record(body) ||
            typeof body.path !== "string" ||
            (body.expectedDigest !== undefined &&
              typeof body.expectedDigest !== "string")
          )
            return reject(
              response,
              400,
              "Select one explicit reviewed schema-v1 agent profile bundle.",
            );
          return json(
            response,
            200,
            await application.previewAgentProfile({
              projectId: decodeURIComponent(agentProfilePreview[1]!),
              profile: {
                path: body.path,
                ...(body.expectedDigest === undefined
                  ? {}
                  : { expectedDigest: body.expectedDigest }),
              },
            }),
          );
        }
        const contextPreview =
          /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/handoffs\/([^/]+)\/context\/preview$/u.exec(
            url.pathname,
          );
        if (contextPreview !== null) {
          const body = await readJson(request);
          if (
            !record(body) ||
            !Array.isArray(body.bundles) ||
            !body.bundles.every(
              (bundle) =>
                record(bundle) &&
                typeof bundle.path === "string" &&
                (bundle.expectedDigest === undefined ||
                  typeof bundle.expectedDigest === "string"),
            ) ||
            !optionalString(body.model) ||
            !optionalString(body.agent) ||
            !optionalString(body.task) ||
            typeof body.continuityBudget !== "number" ||
            typeof body.instructionBudget !== "number"
          )
            return reject(
              response,
              400,
              "Select an explicit handoff and enter documented exact-byte budgets.",
            );
          return json(
            response,
            200,
            await application.previewContext({
              projectId: decodeURIComponent(contextPreview[1]!),
              workItemId: decodeURIComponent(contextPreview[2]!),
              handoffId: decodeURIComponent(contextPreview[3]!),
              bundles: body.bundles as readonly {
                path: string;
                expectedDigest?: string;
              }[],
              continuityBudget: body.continuityBudget,
              instructionBudget: body.instructionBudget,
              ...(body.model === undefined ? {} : { model: body.model }),
              ...(body.agent === undefined ? {} : { agent: body.agent }),
              ...(body.task === undefined ? {} : { task: body.task }),
            }),
          );
        }
        const profileContextPreview =
          /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/handoffs\/([^/]+)\/profile-context\/preview$/u.exec(
            url.pathname,
          );
        if (profileContextPreview !== null) {
          const body = await readJson(request);
          if (
            !record(body) ||
            !record(body.profile) ||
            typeof body.profile.path !== "string" ||
            (body.profile.expectedDigest !== undefined &&
              typeof body.profile.expectedDigest !== "string") ||
            !Array.isArray(body.bundles) ||
            body.bundles.length < 1 ||
            !body.bundles.every(
              (bundle) =>
                record(bundle) &&
                typeof bundle.path === "string" &&
                (bundle.expectedDigest === undefined ||
                  typeof bundle.expectedDigest === "string"),
            ) ||
            typeof body.model !== "string" ||
            !body.model.trim() ||
            !optionalString(body.task)
          )
            return reject(
              response,
              400,
              "Select one reviewed profile, its exact instruction bundles, and one allowed model.",
            );
          return json(
            response,
            200,
            await application.previewProfileContext({
              projectId: decodeURIComponent(profileContextPreview[1]!),
              workItemId: decodeURIComponent(profileContextPreview[2]!),
              handoffId: decodeURIComponent(profileContextPreview[3]!),
              profile: body.profile as {
                path: string;
                expectedDigest?: string;
              },
              bundles: body.bundles as readonly {
                path: string;
                expectedDigest?: string;
              }[],
              model: body.model,
              ...(body.task === undefined ? {} : { task: body.task }),
            }),
          );
        }
        const createWork = /^\/api\/projects\/([^/]+)\/work-items$/u.exec(
          url.pathname,
        );
        if (createWork !== null) {
          const body = await readJson(request);
          if (
            !record(body) ||
            typeof body.objective !== "string" ||
            !stringArray(body.sourceEventIds)
          )
            return reject(
              response,
              400,
              "Enter an objective and select canonical source evidence.",
            );
          return json(
            response,
            201,
            await application.createWorkItem({
              projectId: decodeURIComponent(createWork[1]!),
              objective: body.objective,
              sourceEventIds: body.sourceEventIds,
            }),
          );
        }
        const workTransition =
          /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/(activate|block|complete|reopen)$/u.exec(
            url.pathname,
          );
        if (workTransition !== null) {
          const body = await readJson(request);
          if (!record(body) || !stringArray(body.sourceEventIds))
            return reject(
              response,
              400,
              "Select canonical transition evidence.",
            );
          return json(
            response,
            200,
            await application.transitionWorkItem(
              workTransition[3] as "activate" | "block" | "complete" | "reopen",
              {
                projectId: decodeURIComponent(workTransition[1]!),
                workItemId: decodeURIComponent(workTransition[2]!),
                sourceEventIds: body.sourceEventIds,
              },
            ),
          );
        }
        const handoffMutation =
          /^\/api\/projects\/([^/]+)\/work-items\/([^/]+)\/handoffs\/(preview|create)$/u.exec(
            url.pathname,
          );
        if (handoffMutation !== null) {
          const body = await readJson(request);
          if (
            !record(body) ||
            typeof body.nextAction !== "string" ||
            !stringArray(body.sourceEventIds) ||
            !optionalStringArray(body.memoryIds) ||
            !optionalStringArray(body.relevantFiles) ||
            (body.predecessorId !== undefined &&
              typeof body.predecessorId !== "string")
          )
            return reject(
              response,
              400,
              "Review the bounded handoff builder fields.",
            );
          const input = {
            projectId: decodeURIComponent(handoffMutation[1]!),
            workItemId: decodeURIComponent(handoffMutation[2]!),
            nextAction: body.nextAction,
            sourceEventIds: body.sourceEventIds,
            memoryIds: body.memoryIds ?? [],
            relevantFiles: body.relevantFiles ?? [],
            ...(body.predecessorId === undefined
              ? {}
              : { predecessorId: body.predecessorId }),
          };
          return json(
            response,
            handoffMutation[3] === "create" ? 201 : 200,
            handoffMutation[3] === "create"
              ? await application.createHandoff(input)
              : await application.previewHandoff(input),
          );
        }
        const addMemory = /^\/api\/projects\/([^/]+)\/memory$/u.exec(
          url.pathname,
        );
        if (addMemory !== null) {
          const body = await readJson(request);
          if (
            !record(body) ||
            typeof body.type !== "string" ||
            !MEMORY_ITEM_TYPES.includes(body.type as MemoryItemType) ||
            typeof body.content !== "string" ||
            !stringArray(body.sourceEventIds)
          )
            return reject(
              response,
              400,
              "Enter a documented memory type, content, and canonical source events.",
            );
          return json(
            response,
            201,
            await application.addMemory({
              projectId: decodeURIComponent(addMemory[1]!),
              type: body.type as MemoryItemType,
              content: body.content,
              sourceEventIds: body.sourceEventIds,
            }),
          );
        }
        const transition =
          /^\/api\/projects\/([^/]+)\/memory\/([^/]+)\/(verify|supersede|invalidate)$/u.exec(
            url.pathname,
          );
        if (transition !== null) {
          const body = await readJson(request);
          if (!record(body) || !stringArray(body.sourceEventIds))
            return reject(
              response,
              400,
              "Select at least one canonical source event.",
            );
          const base = {
            projectId: decodeURIComponent(transition[1]!),
            memoryId: decodeURIComponent(transition[2]!),
            sourceEventIds: body.sourceEventIds,
          };
          if (transition[3] === "verify" && typeof body.note === "string")
            return json(
              response,
              200,
              await application.verifyMemory({ ...base, note: body.note }),
            );
          if (transition[3] === "supersede" && typeof body.content === "string")
            return json(
              response,
              201,
              await application.supersedeMemory({
                ...base,
                content: body.content,
              }),
            );
          if (transition[3] === "invalidate" && typeof body.reason === "string")
            return json(
              response,
              200,
              await application.invalidateMemory({
                ...base,
                reason: body.reason,
              }),
            );
          return reject(response, 400, "Enter the documented lifecycle value.");
        }
        const inspect = /^\/api\/projects\/([^/]+)\/inspect$/u.exec(
          url.pathname,
        );
        if (inspect !== null)
          return json(
            response,
            200,
            await application.inspectProject(decodeURIComponent(inspect[1]!)),
          );
        const sample = /^\/api\/projects\/([^/]+)\/import-sample$/u.exec(
          url.pathname,
        );
        if (sample !== null)
          return json(
            response,
            200,
            await application.importSample(decodeURIComponent(sample[1]!)),
          );
      }
      return reject(response, 404, "This GUI route does not exist.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The local GUI operation failed.";
      const recovery =
        error instanceof GuiApplicationError
          ? error.recovery
          : "Return to the previous step, keep safe input, and retry.";
      return json(response, 400, { message, recovery });
    }
  });
  await new Promise<void>((resolve, rejectStart) => {
    server.once("error", rejectStart);
    server.listen(options.port ?? 0, "127.0.0.1", () => {
      server.off("error", rejectStart);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("GUI server did not receive a loopback TCP address.");
  authority = `127.0.0.1:${address.port}`;
  origin = `http://${authority}`;
  return Object.freeze({
    origin,
    bootstrapUrl: `${origin}/bootstrap/${bootstrapToken}`,
    close: () =>
      new Promise<void>((resolve, rejectClose) =>
        server.close((error) =>
          error === undefined ? resolve() : rejectClose(error),
        ),
      ),
  });
}

function secureHeaders(response: ServerResponse) {
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  response.setHeader("Cache-Control", "no-store");
}
function loopback(address: string | undefined) {
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
}
function validHost(value: string | undefined, authority: string) {
  return (
    value === authority || value === authority.replace("127.0.0.1", "localhost")
  );
}
function equal(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function authenticated(request: IncomingMessage, token: string) {
  const value = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  return value !== undefined && equal(value, token);
}
function validMutation(request: IncomingMessage, origin: string, csrf: string) {
  const provided = request.headers["x-ai-workspace-csrf"];
  return (
    request.headers.origin === origin &&
    typeof provided === "string" &&
    equal(provided, csrf) &&
    request.headers["content-type"] === "application/json"
  );
}
async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += value.length;
    if (size > MAX_BODY)
      throw new GuiApplicationError(
        "The submitted form exceeds the local safety bound.",
        "Shorten the entered values and retry.",
      );
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function send(response: ServerResponse, type: string, body: string) {
  response.statusCode = 200;
  response.setHeader("Content-Type", type);
  response.end(body);
}
function json(response: ServerResponse, status: number, value: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}
function reject(response: ServerResponse, status: number, message: string) {
  return json(response, status, {
    message,
    recovery: "Use the documented local GUI action and retry.",
  });
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string")
  );
}
function optionalStringArray(value: unknown): value is string[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}
function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}
function optionalEnum(
  value: string | null,
  allowed: readonly string[],
  label: string,
): string | undefined {
  if (value === null) return undefined;
  if (!allowed.includes(value))
    throw new Error(`Choose a documented ${label}.`);
  return value;
}
function optionalLimit(value: string | null): number | undefined {
  if (value === null) return undefined;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Memory limit must be an integer from 1 to 100.");
  return limit;
}

/**
 * Request validation, response encoding, and field readers for the local host.
 *
 * ADR-0035 separates presentation by responsibility, and this module is the
 * transport half of that split: it knows about headers, cookies, bodies, and
 * status codes, and nothing about which screen asked. Routing and view
 * composition stay outside, so a change to one cannot silently alter the other.
 */
import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import { GuiApplicationError } from "./application.ts";
import { escapeMarkup } from "./charts.ts";
import {
  guiMessage,
  resolveGuiLocale,
  type GuiMessageKey,
} from "./localization.ts";

export const MAX_BODY = 32 * 1024;
export const COOKIE = "aiw_session";

export function secureHeaders(response: ServerResponse) {
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
export function loopback(address: string | undefined) {
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
}
export function validHost(value: string | undefined, authority: string) {
  return (
    value === authority || value === authority.replace("127.0.0.1", "localhost")
  );
}
function equal(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function authenticated(request: IncomingMessage, token: string) {
  const value = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  return value !== undefined && equal(value, token);
}
export function validMutation(
  request: IncomingMessage,
  origin: string,
  csrf: string,
) {
  const provided = request.headers["x-ai-workspace-csrf"];
  return (
    request.headers.origin === origin &&
    typeof provided === "string" &&
    equal(provided, csrf) &&
    request.headers["content-type"] === "application/json"
  );
}
export async function readJson(request: IncomingMessage) {
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
export function send(response: ServerResponse, type: string, body: string) {
  response.statusCode = 200;
  response.setHeader("Content-Type", type);
  response.end(body);
}
export function json(response: ServerResponse, status: number, value: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}
export function reject(
  response: ServerResponse,
  status: number,
  message: string,
  recovery = "Use the documented local GUI action and retry.",
) {
  return json(response, status, { message, recovery });
}
/**
 * A refusal reaches this server two ways. A fetch from the shell wants JSON, so
 * the client can put the sentence where the user is already looking. A browser
 * typing the address wants a page: answering that with raw JSON leaves the reader
 * staring at a brace with no idea what to do next. Same cause, same remedy, two
 * encodings, chosen by what the request says it accepts and written in the
 * language it asks for — the shell is not loaded yet, so nothing else can
 * translate it.
 *
 * The page carries no stylesheet on purpose: `/app.css` is behind the very
 * session this request is missing, and a broken link would be one more thing
 * that looks wrong.
 */
export function denied(
  request: IncomingMessage,
  response: ServerResponse,
  status: number,
  messageKey: GuiMessageKey,
  recoveryKey: GuiMessageKey,
) {
  const locale = resolveGuiLocale(
    undefined,
    (request.headers["accept-language"] ?? "").split(","),
  );
  const message = guiMessage(locale, messageKey);
  const recovery = guiMessage(locale, recoveryKey);
  if (!(request.headers.accept ?? "").includes("text/html"))
    return reject(response, status, message, recovery);
  const title = guiMessage(locale, "accessBlockedTitle");
  response.statusCode = status;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeMarkup(title)}</title></head><body><main><h1>${escapeMarkup(title)}</h1><p>${escapeMarkup(message)}</p><p>${escapeMarkup(recovery)}</p></main></body></html>`,
  );
}
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function stringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string")
  );
}
export function optionalStringArray(
  value: unknown,
): value is string[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}
export function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}
export function optionalEnum(
  value: string | null,
  allowed: readonly string[],
  label: string,
): string | undefined {
  if (value === null) return undefined;
  if (!allowed.includes(value))
    throw new Error(`Choose a documented ${label}.`);
  return value;
}
export function optionalLimit(
  value: string | null,
  label = "Memory",
): number | undefined {
  if (value === null) return undefined;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error(`${label} limit must be an integer from 1 to 100.`);
  return limit;
}

import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  GuiApplication,
  LocalSessionStore,
  startGuiServer,
} from "../src/index.ts";

const sampleSessionPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../integrations/codex/test/fixtures/session.jsonl",
);
const HOUR = 60 * 60 * 1000;
const home = () => mkdtemp(join(tmpdir(), "aiw-session-"));
const sessionPath = (root: string) => join(root, "session", "session.json");

describe("local session kept across restarts", () => {
  it("creates one session, then reuses it for a later start", async () => {
    const root = await home();
    const started = new Date("2026-09-18T10:00:00.000Z");
    const first = await new LocalSessionStore(root, {
      clock: () => started,
      lifetimeMs: 24 * HOUR,
    }).establish();
    assert.match(first.token, /^[0-9a-f]{64}$/u);
    assert.equal(first.reused, false);
    assert.equal(first.renewedBecause, "MISSING");
    assert.equal(first.stored, true);
    assert.equal(first.maxAgeSeconds, 24 * 60 * 60);

    const later = new Date(started.getTime() + 6 * HOUR);
    const second = await new LocalSessionStore(root, {
      clock: () => later,
      lifetimeMs: 24 * HOUR,
    }).establish();
    assert.equal(second.token, first.token);
    assert.equal(second.reused, true);
    assert.equal(second.renewedBecause, null);
    // The browser is told what is left, not the full life again: the session
    // must stop being sent when the host stops accepting it.
    assert.equal(second.maxAgeSeconds, 18 * 60 * 60);
  });

  it("stores the session for this account only, and stores nothing else", async () => {
    const root = await home();
    const session = await new LocalSessionStore(root).establish();
    const file = await stat(sessionPath(root));
    const folder = await stat(join(root, "session"));
    assert.equal(file.mode & 0o777, 0o600);
    assert.equal(folder.mode & 0o777, 0o700);
    const document = JSON.parse(
      await readFile(sessionPath(root), "utf8"),
    ) as Record<string, unknown>;
    assert.deepEqual(Object.keys(document).sort(), [
      "createdAt",
      "expiresAt",
      "schemaVersion",
      "token",
    ]);
    assert.equal(document.token, session.token);
  });

  it("mints a new session when the stored one expired", async () => {
    const root = await home();
    const started = new Date("2026-09-18T10:00:00.000Z");
    const first = await new LocalSessionStore(root, {
      clock: () => started,
      lifetimeMs: HOUR,
    }).establish();
    const second = await new LocalSessionStore(root, {
      clock: () => new Date(started.getTime() + 2 * HOUR),
      lifetimeMs: HOUR,
    }).establish();
    assert.notEqual(second.token, first.token);
    assert.equal(second.reused, false);
    assert.equal(second.renewedBecause, "EXPIRED");
  });

  it("refuses a session other accounts could have read", async () => {
    const root = await home();
    const first = await new LocalSessionStore(root).establish();
    await chmod(sessionPath(root), 0o644);
    const second = await new LocalSessionStore(root).establish();
    assert.notEqual(second.token, first.token);
    assert.equal(second.renewedBecause, "UNSAFE_PERMISSIONS");
    // The replacement is narrow again; a widened file must not stay widened.
    assert.equal((await stat(sessionPath(root))).mode & 0o777, 0o600);
  });

  it("treats a damaged or foreign session as no session at all", async () => {
    for (const content of [
      "{ not json",
      JSON.stringify({ schemaVersion: 1, token: "short", expiresAt: "x" }),
      JSON.stringify({
        schemaVersion: 2,
        token: "a".repeat(64),
        expiresAt: new Date(Date.now() + HOUR).toISOString(),
      }),
    ]) {
      const root = await home();
      await new LocalSessionStore(root).establish();
      await writeFile(sessionPath(root), content, { mode: 0o600 });
      const renewed = await new LocalSessionStore(root).establish();
      assert.equal(renewed.reused, false);
      assert.equal(renewed.renewedBecause, "UNREADABLE");
    }
  });

  it("hands the browser a cookie that ends with the session it carries", async () => {
    const root = await home();
    const session = await new LocalSessionStore(root, {
      lifetimeMs: 30 * 24 * HOUR,
    }).establish();
    const server = await startGuiServer(
      new GuiApplication({ workspaceHome: root, sampleSessionPath }),
      {
        sessionToken: session.token,
        sessionMaxAgeSeconds: session.maxAgeSeconds,
      },
    );
    try {
      const response = await fetch(server.bootstrapUrl, { redirect: "manual" });
      const cookie = response.headers.get("set-cookie") ?? "";
      assert.match(cookie, /HttpOnly/u);
      assert.match(cookie, /SameSite=Strict/u);
      assert.match(cookie, new RegExp(`Max-Age=${session.maxAgeSeconds}`, "u"));
      // A reader of the reused session must be the same browser the token was
      // minted for, so the cookie value is the stored one and not a new one.
      assert.ok(cookie.includes(session.token));
    } finally {
      await server.close();
    }
  });
});

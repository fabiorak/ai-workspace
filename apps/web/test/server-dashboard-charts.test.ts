import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import {
  GuiApplication,
  startGuiServer,
  type GuiServer,
} from "../src/index.ts";

const sampleSessionPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../integrations/codex/test/fixtures/session.jsonl",
);

describe("GUI dashboard chart fragment", () => {
  let root: string, server: GuiServer, cookie: string;
  before(async () => {
    root = await mkdtemp(join(tmpdir(), "ai-workspace-gui-charts-"));
    server = await startGuiServer(
      new GuiApplication({
        workspaceHome: join(root, "home"),
        sampleSessionPath,
      }),
      {
        bootstrapToken: "b".repeat(64),
        sessionToken: "s".repeat(64),
        csrfToken: "c".repeat(64),
      },
    );
    const bootstrap = await fetch(server.bootstrapUrl, { redirect: "manual" });
    assert.equal(bootstrap.status, 303);
    cookie = bootstrap.headers.get("set-cookie")!.split(";", 1)[0]!;
  });
  after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });

  const fragment = (query: string) =>
    fetch(`${server.origin}/view/dashboard-charts${query}`, {
      headers: { cookie },
    });

  it("refuses the fragment without the local session cookie", async () => {
    const response = await fetch(
      `${server.origin}/view/dashboard-charts?locale=en`,
    );
    assert.equal(response.status, 401);
  });

  it("serves an accessible fragment as HTML", async () => {
    const response = await fragment("?locale=en");
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("content-type"),
      "text/html; charset=utf-8",
    );
    const body = await response.text();
    assert.equal(body.match(/role="img"/g)?.length, 4);
    assert.match(body, /<details class="chart-table">/);
    assert.match(body, /What to do now/);
    // No project is registered, so the fragment must say so instead of drawing
    // an empty chart with no explanation.
    assert.match(body, /data-focus="FIRST_RUN"/);
    assert.match(body, /No project is registered yet\./);
    assert.ok(!body.includes("<script"));
  });

  it("renders the requested locale and falls back to English otherwise", async () => {
    const italian = await (await fragment("?locale=it")).text();
    assert.match(italian, /Cosa fare adesso/);
    for (const query of ["?locale=de", "?locale=", ""]) {
      const body = await (await fragment(query)).text();
      assert.match(body, /What to do now/, query);
    }
  });

  it("keeps the same restrictive headers as every other local response", async () => {
    const response = await fragment("?locale=en");
    assert.equal(
      response.headers.get("content-security-policy"),
      "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

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

/**
 * The list ADR-0035 opens on, over real HTTP.
 *
 * The pure composition is covered elsewhere; what these cases hold is the part
 * that only shows up end to end: that the route is behind the local session, that
 * an empty workspace is a legitimate answer rather than an error, and that an
 * imported session appears without anyone having created anything.
 */
describe("GUI conversation list route", () => {
  let root: string,
    server: GuiServer,
    cookie: string,
    application: GuiApplication;
  before(async () => {
    root = await mkdtemp(join(tmpdir(), "ai-workspace-gui-conversations-"));
    application = new GuiApplication({
      workspaceHome: join(root, "home"),
      sampleSessionPath,
    });
    server = await startGuiServer(application, {
      bootstrapToken: "b".repeat(64),
      sessionToken: "s".repeat(64),
      csrfToken: "c".repeat(64),
    });
    const bootstrap = await fetch(server.bootstrapUrl, { redirect: "manual" });
    cookie = bootstrap.headers.get("set-cookie")!.split(";", 1)[0]!;
  });
  after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });

  const conversations = (query = "") =>
    fetch(`${server.origin}/api/conversations${query}`, {
      headers: { cookie },
    });
  /** The shape the route promises, so a changed field fails here instead of in a browser. */
  type Row = Readonly<{
    id: string;
    projectId: string | null;
    kind: string;
    projectName: string | null;
    title: string | null;
    titleSource: string;
    momentCount: number;
    workState: string | null;
    model: string | null;
    agent: string | null;
  }>;
  const page = async (query = "") =>
    (await (await conversations(query)).json()) as Readonly<{
      rows: readonly Row[];
      total: number;
      limit: number;
    }>;

  it("refuses the list without the local session cookie", async () => {
    assert.equal(
      (await fetch(`${server.origin}/api/conversations`)).status,
      401,
    );
  });

  it("answers an empty workspace with an empty list, not an error", async () => {
    assert.equal((await conversations()).status, 200);
    const empty = await page();
    assert.deepEqual(empty.rows, []);
    assert.equal(empty.total, 0);
    assert.equal(empty.limit, 50);
  });

  it("refuses a limit outside the local bound and says what to do", async () => {
    for (const query of ["?limit=0", "?limit=101", "?limit=two"]) {
      const response = await conversations(query);
      assert.equal(response.status, 400, query);
      const body = (await response.json()) as Readonly<{
        message: string;
        recovery: string;
      }>;
      assert.match(body.message, /whole number from 1 to 100/u);
      assert.ok(body.recovery.length > 0);
    }
  });

  it("lists an imported session with its own first question as the title", async () => {
    const project = await application.registerProject(process.cwd());
    await application.importSample(project.id);
    const listed = await page();
    assert.equal(listed.rows.length, 1);
    const [row] = listed.rows;
    assert.equal(row?.kind, "WORK_SESSION");
    // The row names the project the way the registry does, so the sidebar and the
    // project list cannot disagree about what a place is called.
    assert.equal(row?.projectName, project.name);
    assert.equal(row?.titleSource, "FIRST_QUESTION");
    assert.ok((row?.title ?? "").length > 0);
    assert.ok((row?.momentCount ?? 0) > 0);
    // Nobody created a Work Item, so the row carries no state rather than a default one.
    assert.equal(row?.workState, null);
    // The agent is always recorded, so the row can always say what produced the session;
    // the model is whatever the transcript declared, and null is a legitimate answer.
    assert.equal(typeof row?.agent, "string");
    assert.ok(row?.model === null || typeof row.model === "string");
  });

  it("keeps a project-free note in the same list as the sessions", async () => {
    await application.createGeneralConversation("Un appunto");
    const both = await page();
    assert.equal(both.total, 2);
    assert.deepEqual([...both.rows].map((entry) => entry.kind).sort(), [
      "NOTES",
      "WORK_SESSION",
    ]);
  });

  /**
   * A row that cannot be opened is a catalogue entry, not a conversation, and the
   * list was exactly that until this route existed. What matters end to end is that
   * opening one costs a single project read and that every moment arrives with the
   * record it came from: a conversation nobody can trace is a story.
   */
  const opened = (id: string, query = "") =>
    fetch(
      `${server.origin}/api/conversations/${encodeURIComponent(id)}${query}`,
      { headers: { cookie } },
    );
  type Moment = Readonly<{
    type: string;
    text: string;
    fromCanonicalPayload: boolean;
    sourcePosition: number | null;
    contentHash: string | null;
  }>;
  type Detail = Readonly<{
    id: string;
    kind: string;
    title: string | null;
    moments: readonly Moment[];
    total: number;
  }>;

  it("opens the session a row names, each moment carrying its own source", async () => {
    const row = (await page()).rows.find(
      (entry) => entry.kind === "WORK_SESSION",
    );
    assert.ok(row);
    const response = await opened(
      row.id,
      `?project=${encodeURIComponent(row.projectId ?? "")}`,
    );
    assert.equal(response.status, 200);
    const conversation = (await response.json()) as Detail;
    assert.equal(conversation.id, row.id);
    assert.equal(conversation.kind, "WORK_SESSION");
    assert.equal(conversation.title, row.title);
    assert.equal(conversation.moments.length, conversation.total);
    assert.ok(conversation.moments.length > 0);
    for (const moment of conversation.moments) {
      assert.equal(typeof moment.contentHash, "string");
      assert.equal(typeof moment.sourcePosition, "number");
      assert.ok(moment.type.length > 0);
    }
  });

  it("opens a note without naming a project, because a note has none", async () => {
    const row = (await page()).rows.find((entry) => entry.kind === "NOTES");
    assert.ok(row);
    const conversation = (await (await opened(row.id)).json()) as Detail;
    assert.equal(conversation.kind, "NOTES");
    assert.equal(conversation.title, "Un appunto");
    // Its own content hash stands in for an imported source it never had.
    for (const moment of conversation.moments)
      assert.equal(moment.sourcePosition, null);
  });

  it("says a conversation is gone instead of showing an empty one", async () => {
    const response = await opened("session_missing");
    assert.equal(response.status, 404);
    const body = (await response.json()) as Readonly<{
      message: string;
      recovery: string;
    }>;
    assert.match(body.message, /no longer here/u);
    assert.ok(body.recovery.length > 0);
  });

  it("refuses to open a conversation without the local session cookie", async () => {
    const row = (await page()).rows[0];
    assert.ok(row);
    assert.equal(
      (
        await fetch(
          `${server.origin}/api/conversations/${encodeURIComponent(row.id)}`,
        )
      ).status,
      401,
    );
  });

  it("carries the same restrictive headers as every other local response", async () => {
    const response = await conversations();
    assert.equal(
      response.headers.get("content-security-policy"),
      "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

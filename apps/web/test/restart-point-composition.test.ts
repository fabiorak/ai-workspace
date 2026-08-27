import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { promisify } from "node:util";

import {
  GuiApplication,
  startGuiServer,
  type GuiServer,
} from "../src/index.ts";

const execFileAsync = promisify(execFile);
const sampleSessionPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../integrations/codex/test/fixtures/session.jsonl",
);

/**
 * Every file under the workspace home, with the digest of its bytes.
 *
 * ADR-0037 turns on composition writing nothing, and a claim that nothing was
 * written is only worth what it is measured against: this is measured against the
 * whole local home, so a new document, a rewritten one, and a touched index all
 * show up the same way.
 */
const snapshot = async (root: string): Promise<Record<string, string>> => {
  const files: Record<string, string> = {};
  const walk = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else
        files[relative(root, path)] = createHash("sha256")
          .update(await readFile(path))
          .digest("hex");
    }
  };
  await walk(root);
  return files;
};

describe("composing a restart point over HTTP", () => {
  let root: string,
    home: string,
    repository: string,
    server: GuiServer,
    cookie: string,
    csrf: string,
    projectId: string,
    conversationId: string;

  const api = (path: string, options: RequestInit = {}) =>
    fetch(`${server.origin}${path}`, {
      ...options,
      headers: {
        Cookie: cookie,
        Origin: server.origin,
        "Content-Type": "application/json",
        "X-AI-Workspace-CSRF": csrf,
        ...(options.headers ?? {}),
      },
    });
  const read = async (path: string) => {
    const response = await api(path);
    return { status: response.status, body: (await response.json()) as never };
  };

  before(async () => {
    root = await mkdtemp(join(tmpdir(), "ai-workspace-restart-point-"));
    home = join(root, "home");
    repository = join(root, "repository");
    await mkdir(repository);
    await execFileAsync("git", [
      "-C",
      repository,
      "init",
      "--initial-branch=main",
    ]);
    await writeFile(join(repository, "README.md"), "# Synthetic project\n");
    await execFileAsync("git", ["-C", repository, "add", "README.md"]);
    await execFileAsync("git", [
      "-C",
      repository,
      "-c",
      "user.name=Synthetic",
      "-c",
      "user.email=synthetic@example.invalid",
      "commit",
      "-m",
      "initial",
    ]);
    server = await startGuiServer(
      new GuiApplication({ workspaceHome: home, sampleSessionPath }),
      {
        bootstrapToken: "b".repeat(64),
        sessionToken: "s".repeat(64),
        csrfToken: "c".repeat(64),
      },
    );
    const bootstrap = await fetch(server.bootstrapUrl, { redirect: "manual" });
    cookie = bootstrap.headers.get("set-cookie")!.split(";", 1)[0]!;
    const page = await fetch(`${server.origin}/`, {
      headers: { Cookie: cookie },
    });
    csrf =
      /name="aiw-csrf" content="([a-f0-9]+)"/u.exec(await page.text())?.[1] ??
      "";
    const project = (await (
      await api("/api/projects", {
        method: "POST",
        body: JSON.stringify({ path: repository }),
      })
    ).json()) as { id: string };
    projectId = project.id;
    await api(`/api/projects/${encodeURIComponent(projectId)}/import-sample`, {
      method: "POST",
      body: "{}",
    });
    const page1 = (await read("/api/conversations")).body as unknown as {
      rows: { id: string; projectId: string | null }[];
    };
    conversationId = page1.rows.find((row) => row.projectId === projectId)!.id;
  });

  after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });

  const point = (id = conversationId, project: string | null = projectId) =>
    read(
      `/api/conversations/${encodeURIComponent(id)}/restart-point${
        project === null ? "" : `?project=${encodeURIComponent(project)}`
      }`,
    );

  it("refuses to choose a Work Item for a conversation nothing links to", async () => {
    const answer = await point();
    assert.equal(answer.status, 200);
    assert.deepEqual(answer.body, {
      available: false,
      reason: "NO_LINKED_WORK",
    });
  });

  it("answers a conversation that is not there without composing anything", async () => {
    assert.equal((await point("session_missing")).status, 404);
  });

  it("has no work to resume in notes, and does not read a project to find out", async () => {
    const note = (await (
      await api("/api/general/conversations", {
        method: "POST",
        body: JSON.stringify({ title: "A note with no project" }),
      })
    ).json()) as { id: string };
    assert.deepEqual((await point(note.id, null)).body, {
      available: false,
      reason: "NOT_A_WORK_CONVERSATION",
    });
  });

  describe("once the conversation carries work and notes", () => {
    before(async () => {
      const conversation = (
        await read(
          `/api/conversations/${encodeURIComponent(conversationId)}?project=${encodeURIComponent(projectId)}`,
        )
      ).body as unknown as { moments: { id: string }[] };
      const evidence = [conversation.moments[0]!.id];
      const work = (await (
        await api(`/api/projects/${encodeURIComponent(projectId)}/work-items`, {
          method: "POST",
          body: JSON.stringify({
            objective: "Bring the fictional station back online",
            sourceEventIds: evidence,
          }),
        })
      ).json()) as { id: string };
      await api(
        `/api/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(work.id)}/activate`,
        { method: "POST", body: JSON.stringify({ sourceEventIds: evidence }) },
      );
      for (const note of [
        { type: "DECISION", content: "Composing is not fixing" },
        { type: "CONSTRAINT", content: "Nothing leaves this computer" },
        { type: "FAILURE", content: "The byte-range form was unusable" },
      ])
        await api(`/api/projects/${encodeURIComponent(projectId)}/memory`, {
          method: "POST",
          body: JSON.stringify({ ...note, sourceEventIds: evidence }),
        });
      // A working tree with something in it, so the composed point has a state to report.
      await writeFile(
        join(repository, "README.md"),
        "# Synthetic project\n\nEdited.\n",
      );
      await api(`/api/projects/${encodeURIComponent(projectId)}/inspect`, {
        method: "POST",
        body: "{}",
      });
    });

    it("composes what a reader needs, in their own terms", async () => {
      const answer = await point();
      assert.equal(answer.status, 200);
      const composed = answer.body as unknown as {
        available: boolean;
        doing: string;
        workState: string;
        decisions: { content: string; verification: string }[];
        constraints: { content: string }[];
        failures: { content: string }[];
        lookedAt: { type: string; occurredAt: string | null }[];
        repository: {
          branch: string | null;
          hasUnsavedChanges: boolean;
          changedFiles: number;
        };
        omissions: { kind: string; count: number }[];
        effect: string;
      };
      assert.equal(composed.available, true);
      assert.equal(composed.doing, "Bring the fictional station back online");
      assert.equal(composed.workState, "ACTIVE");
      assert.deepEqual(
        composed.decisions.map((entry) => entry.content),
        ["Composing is not fixing"],
      );
      assert.deepEqual(
        composed.constraints.map((entry) => entry.content),
        ["Nothing leaves this computer"],
      );
      assert.deepEqual(
        composed.failures.map((entry) => entry.content),
        ["The byte-range form was unusable"],
      );
      assert.ok(composed.lookedAt.length > 0);
      assert.ok(composed.lookedAt.length <= 5);
      assert.equal(composed.repository.branch, "main");
      assert.equal(composed.repository.hasUnsavedChanges, true);
      assert.ok(composed.repository.changedFiles >= 1);
      assert.equal(composed.effect, "COMPOSED_LOCALLY_NOT_SAVED_AND_NOT_SENT");
    });

    /**
     * The whole decision rests on this: a summary that a person did not ask to
     * create must not have created anything. It is asserted over the bytes of the
     * local home, not over an intention stated in a comment.
     */
    it("writes nothing to the local workspace, however many times it is composed", async () => {
      const before = await snapshot(home);
      await point();
      await point();
      await point("session_missing");
      assert.deepEqual(await snapshot(home), before);
      assert.equal(
        Object.keys(before).some((path) => path.includes("handoff")),
        false,
        "composing must not have created a handoff document",
      );
    });

    it("keeps identifiers, digests and byte counts out of what it answers", async () => {
      const serialized = JSON.stringify((await point()).body);
      for (const forbidden of [
        "sourceRecordHash",
        "recordHash",
        "artifactId",
        "schemaVersion",
        "exactBytes",
        "metadata",
        "nextAction",
        "sessionId",
      ])
        assert.equal(
          serialized.includes(forbidden),
          false,
          `${forbidden} reached the composed answer`,
        );
    });
  });
});

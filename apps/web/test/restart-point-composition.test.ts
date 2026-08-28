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
    let workItemId: string;

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
      workItemId = work.id;
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
        "sessionId",
      ])
        assert.equal(
          serialized.includes(forbidden),
          false,
          `${forbidden} reached the composed answer`,
        );
    });

    /**
     * The draft of what to do next is the one thing here that is meant to be edited,
     * so it does travel — as the person's own words, and never without the mark that
     * says it has to be read before anything is fixed.
     */
    it("carries the next action as a draft that says it needs review", async () => {
      const body = (await point()).body as {
        nextAction: { text: string; needsReview: boolean };
      };
      assert.equal(body.nextAction.needsReview, true);
      assert.ok(body.nextAction.text.length > 0);
    });

    /**
     * The one write of this area. Everything below is asserted over the bytes of the
     * local home and over the technical surface, never over an intention.
     */
    describe("keeping the summary", () => {
      type Packet = Readonly<{
        id: string;
        createdAt: string;
        predecessorId: string | null;
        sections: {
          nextAction: { value: string };
          testState: { value: { command: string; outcome: string }[] };
        };
      }>;
      const fix = async (body: Record<string, unknown>, headers = {}) => {
        const response = await api(
          `/api/conversations/${encodeURIComponent(conversationId)}/restart-point?project=${encodeURIComponent(projectId)}`,
          { method: "POST", body: JSON.stringify(body), headers },
        );
        return {
          status: response.status,
          body: (await response.json()) as Record<string, unknown>,
        };
      };
      const mark = async () =>
        ((await point()).body as unknown as { composition: string })
          .composition;
      const kept = async () =>
        (
          await read(
            `/api/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(workItemId)}/handoffs`,
          )
        ).body as unknown as Packet[];

      it("refuses a confirmation that carries no local write authorization", async () => {
        const before = await snapshot(home);
        const refused = await fix(
          { composition: await mark(), nextAction: "Carry on" },
          { "X-AI-Workspace-CSRF": "" },
        );
        assert.equal(refused.status, 403);
        assert.deepEqual(await snapshot(home), before);
      });

      it("refuses a summary that moved while it was being read", async () => {
        const before = await snapshot(home);
        const refused = await fix({
          composition: "a summary nobody composed",
          nextAction: "Carry on",
        });
        assert.equal(refused.status, 200);
        assert.deepEqual(refused.body, {
          fixed: false,
          reason: "COMPOSITION_CHANGED",
        });
        assert.deepEqual(await snapshot(home), before);
      });

      it("refuses an empty next action and half a test observation", async () => {
        const before = await snapshot(home);
        assert.equal(
          (await fix({ composition: await mark(), nextAction: "   " })).body
            .reason,
          "EMPTY_NEXT_ACTION",
        );
        assert.equal(
          (
            await fix({
              composition: await mark(),
              nextAction: "Carry on",
              test: { command: "npm run check", outcome: null },
            })
          ).body.reason,
          "INCOMPLETE_TEST",
        );
        assert.deepEqual(await snapshot(home), before);
      });

      it("keeps the confirmed text and the run the person stated", async () => {
        const answer = await fix({
          composition: await mark(),
          nextAction: "Read the platform gate log before touching anything",
          test: {
            command: "npm run check",
            outcome: "failed",
            observedAt: "2026-08-28T21:00",
          },
        });
        assert.equal(answer.status, 201);
        assert.equal(answer.body.fixed, true);
        assert.equal(answer.body.followsOne, false);
        const packets = await kept();
        assert.equal(packets.length, 1);
        assert.equal(
          packets[0]!.sections.nextAction.value,
          "Read the platform gate log before touching anything",
        );
        assert.deepEqual(
          packets[0]!.sections.testState.value.map((entry) => [
            entry.command,
            entry.outcome,
          ]),
          [["npm run check", "FAIL"]],
        );
      });

      /** ADR-0012: a packet is never rewritten, only followed by a successor. */
      it("creates a successor and leaves the earlier one byte-identical", async () => {
        const first = (await kept())[0]!;
        const before = await snapshot(home);
        const answer = await fix({
          composition: await mark(),
          nextAction: "Then run the whole suite again",
        });
        assert.equal(answer.body.followsOne, true);
        const packets = await kept();
        assert.equal(packets.length, 2);
        const successor = packets.find((packet) => packet.id !== first.id)!;
        assert.equal(successor.predecessorId, first.id);
        assert.equal(
          successor.sections.nextAction.value,
          "Then run the whole suite again",
        );
        assert.deepEqual(
          packets.find((packet) => packet.id === first.id),
          first,
        );
        const after = await snapshot(home);
        for (const [path, digest] of Object.entries(before))
          assert.equal(
            after[path],
            digest,
            `${path} changed while a successor was being written`,
          );
      });

      /** Nothing about the run states an outcome nobody chose. */
      it("keeps no observation when the fields were left alone", async () => {
        await fix({
          composition: await mark(),
          nextAction: "Leave the tests unstated on purpose",
          test: { command: "", outcome: null, observedAt: null },
        });
        const packets = await kept();
        const latest = packets.find(
          (packet) =>
            packet.sections.nextAction.value ===
            "Leave the tests unstated on purpose",
        )!;
        assert.deepEqual(latest.sections.testState.value, []);
      });
    });
  });
});

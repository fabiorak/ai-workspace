import assert from "node:assert/strict";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { startGuiServer } from "../src/server.ts";
import { continuationFixture } from "./continuation-fixture.ts";

type Reply = {
  ready: boolean;
  reason: string;
  localOnly: boolean;
  changed: boolean;
  authorized: boolean;
  stored?: { duplicate: boolean };
  proposal: string;
  text: string;
  model: string;
  items: { text: string }[];
  suggestions: { index: number; text: string }[];
};

async function snapshot(root: string): Promise<unknown> {
  return Promise.all(
    (await readdir(root, { withFileTypes: true })).map(async (entry) => [
      entry.name,
      entry.isDirectory()
        ? await snapshot(join(root, entry.name))
        : (await readFile(join(root, entry.name))).toString("hex"),
    ]),
  );
}

test("conversation privacy preparation uses scoped local actions and the complete question", async (t) => {
  const f = await continuationFixture();
  const server = await startGuiServer(f.app, {
    bootstrapToken: "b".repeat(64),
    sessionToken: "s".repeat(64),
    csrfToken: "c".repeat(64),
  });
  t.after(async () => {
    await server.close();
    await rm(f.root, { recursive: true, force: true });
  });
  const response = await fetch(server.bootstrapUrl, { redirect: "manual" });
  const cookie = response.headers.get("set-cookie")!.split(";", 1)[0]!;
  const path = `/api/conversations/${encodeURIComponent(f.query.conversationId)}/continuation`;
  const api = async (
    action = "",
    body?: unknown,
    overrides: Record<string, string> = {},
    project = f.project.id,
  ) =>
    fetch(
      `${server.origin}${path}${action}?project=${encodeURIComponent(project)}`,
      {
        method: body === undefined ? "GET" : "POST",
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        headers: {
          Cookie: cookie,
          Origin: server.origin,
          "Content-Type": "application/json",
          "X-AI-Workspace-CSRF": "c".repeat(64),
          ...overrides,
        },
      },
    );
  const { destinationId, ...configuration } = f.target;
  assert.equal(destinationId, "synthetic-recipient");
  const read = async (action = "", body?: unknown) =>
    (await api(action, body)).json() as Promise<Reply>;
  await t.test("GET is read-only and cannot send or audit", async () => {
    const before = await snapshot(f.home);
    assert.equal((await read()).reason, "TARGET_NOT_CONFIGURED");
    assert.equal((await api("/propose")).status, 404);
    assert.deepEqual(await snapshot(f.home), before);
  });
  await t.test(
    "write guards reject CSRF, Origin and content-type failures",
    async () => {
      for (const headers of [
        { "X-AI-Workspace-CSRF": "" },
        { Origin: "https://example.invalid" },
        { "Content-Type": "text/plain" },
      ])
        assert.equal(
          (await api("/configure", configuration, headers)).status,
          403,
        );
      assert.equal(
        (await api("/configure", { ...configuration, workItemId: "other" }))
          .status,
        400,
      );
      assert.equal(
        (await api("/propose", { question: "x".repeat(40_000), aliases: [] }))
          .status,
        400,
      );
    },
  );
  await t.test(
    "configuration is validated without audit or network availability claims",
    async () => {
      const before = await snapshot(f.home);
      const configured = await read("/configure", configuration);
      assert.equal(configured.ready, true);
      assert.equal(configured.localOnly, true);
      assert.equal(JSON.stringify(configured).includes(f.root), false);
      assert.deepEqual(await snapshot(f.home), before);
      assert.equal((await read()).ready, true);
    },
  );
  const question =
    "Perché Asteria Demo non va ritentato? Controlla anche città e 🛰️.";
  const propose = () =>
    read("/propose", {
      question,
      aliases: [{ entityType: "CUSTOMER", alias: "Asteria Demo" }],
    });
  await t.test(
    "the full question and all context are reviewed, and POST records only audit metadata",
    async () => {
      const before = (await f.app.listPrivacyAudit(f.project.id)).total;
      const draft = await propose();
      assert.equal(draft.ready, true);
      assert.equal(draft.items.at(-1)!.text, question);
      assert.equal(
        draft.items.some((item) => item.text.includes('"metadata"')),
        false,
        "review items must not expose the serialized metadata envelope",
      );
      assert.ok(
        draft.items.some((item) => item.text.includes("Origin:")),
        "review items must show readable content and provenance",
      );
      assert.equal(draft.suggestions.length, 1);
      assert.equal(
        (await f.app.listPrivacyAudit(f.project.id)).total,
        before + 1,
      );
      const unchanged = await snapshot(f.home);
      await read();
      assert.deepEqual(await snapshot(f.home), unchanged);
      const result = await read("/protect", {
        proposal: draft.proposal,
        selected: [],
        manual: [],
        passphrase: "",
      });
      assert.equal(result.ready, true);
      assert.equal(result.authorized, false);
      assert.ok(result.text.endsWith(question));
      assert.ok(result.text.startsWith("Continuation context"));
      assert.ok(result.text.includes(f.handoff.sections.nextAction.value));
      assert.equal(
        (
          await read("/protect", {
            proposal: draft.proposal,
            selected: [],
            manual: [],
            passphrase: "",
          })
        ).reason,
        "PREPARATION_EXPIRED",
      );
    },
  );
  await t.test(
    "policy and restricted screening include the question",
    async () => {
      const blocked = await read("/propose", {
        question: "api_key=" + "sk-" + "a".repeat(48),
        aliases: [],
      });
      assert.equal(blocked.reason, "PRIVACY_BLOCKED");
    },
  );
  await t.test(
    "cross-project proposals never reach the protected version",
    async () => {
      const draft = await propose();
      const result = (await (
        await api(
          "/protect",
          {
            proposal: draft.proposal,
            selected: [],
            manual: [],
            passphrase: "",
          },
          {},
          "other-project",
        )
      ).json()) as Reply;
      assert.equal(result.reason, "PREPARATION_EXPIRED");
    },
  );
  await t.test(
    "changed repository and policy invalidate an existing proposal",
    async () => {
      const draft = await propose();
      await writeFile(join(f.repository, "README.md"), "Changed\n");
      assert.equal(
        (
          await read("/protect", {
            proposal: draft.proposal,
            selected: [],
            manual: [],
            passphrase: "",
          })
        ).reason,
        "PREPARATION_CHANGED",
      );
      assert.equal((await read()).changed, true);
      const another = await propose();
      const policy = JSON.parse(await readFile(f.target.policy.path, "utf8"));
      await writeFile(
        f.target.policy.path,
        JSON.stringify({ ...policy, version: "1.0.1" }),
      );
      assert.equal(
        (
          await read("/protect", {
            proposal: another.proposal,
            selected: [],
            manual: [],
            passphrase: "",
          })
        ).reason,
        "PREPARATION_CHANGED",
      );
    },
  );
  await t.test(
    "reviewed aliases use encrypted mappings and bounded single-use proposals",
    async () => {
      const draft = await propose();
      const body = {
        proposal: draft.proposal,
        selected: [0],
        manual: [],
        passphrase: "synthetic passphrase for review only",
      };
      const answers = await Promise.all([
        read("/protect", body),
        read("/protect", body),
      ]);
      assert.equal(answers.filter((answer) => answer.ready).length, 1);
      const result = answers.find((answer) => answer.ready)!;
      assert.equal(result.text.includes("Asteria Demo"), false);
      const recorded = await f.app.continuations.recordResponse(f.query, {
        attemptId: "attempt-synthetic",
        model: result.model,
        text: result.text,
        occurredAt: new Date().toISOString(),
      });
      assert.equal(recorded.ready, true);
      if (recorded.ready) assert.equal(recorded.duplicate, false);
      const duplicate = await f.app.continuations.recordResponse(f.query, {
        attemptId: "attempt-synthetic",
        model: result.model,
        text: result.text,
        occurredAt: new Date().toISOString(),
      });
      assert.equal(duplicate.ready, true);
      if (duplicate.ready) assert.equal(duplicate.duplicate, true);
      const sessions = await readdir(join(f.home, "sessions"));
      assert.ok(
        sessions.some(
          (name) => name.startsWith("session_") && name.endsWith(".json"),
        ),
      );
      assert.ok(result.text.includes(f.handoff.sections.nextAction.value));
      assert.equal(result.text.includes("città"), true);
      assert.equal(result.text.includes("🛰️"), true);
      assert.equal(
        JSON.stringify(await f.app.listPrivacyAudit(f.project.id)).includes(
          question,
        ),
        false,
      );
    },
  );
});

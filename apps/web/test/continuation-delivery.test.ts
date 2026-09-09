import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { continuationFixture } from "./continuation-fixture.ts";
import { startGuiServer } from "../src/server.ts";

test("HTTP confirmation delivers exact protected text once, restores and saves the answer, and includes it in the next question", async (t) => {
  let calls = 0,
    expected = "";
  const f = await continuationFixture({
    send: async (input) => {
      calls++;
      assert.equal(input.text, expected);
      assert.equal(input.maxOutputTokens, 512);
      assert.equal(input.timeoutMs, 30000);
      const token = input.text.match(/\[\[AW_CUSTOMER_[A-F0-9]{16}\]\]/u)?.[0];
      assert.ok(token);
      return {
        kind: "COMPLETED",
        text: `Inspect the lock owner for ${token}.`,
        requestId: "synthetic-request",
        responseId: "synthetic-response",
        usage: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 12 },
      };
    },
  });
  const server = await startGuiServer(f.app, { csrfToken: "c".repeat(64) });
  t.after(async () => {
    await server.close();
    await rm(f.root, { recursive: true, force: true });
  });
  const bootstrap = await fetch(server.bootstrapUrl, { redirect: "manual" });
  const cookie = bootstrap.headers.get("set-cookie")!.split(";", 1)[0]!;
  const path = `${server.origin}/api/conversations/${f.query.conversationId}/continuation`;
  type Reply = {
    ready: boolean;
    text: string;
    authorizationId: string;
    proposal: string;
    suggestions: { index: number }[];
    items: { text: string }[];
  };
  async function post(action: string, body: unknown, csrf = "c".repeat(64)) {
    const response = await fetch(`${path}/${action}?project=${f.project.id}`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: server.origin,
        "Content-Type": "application/json",
        "X-AI-Workspace-CSRF": csrf,
      },
      body: JSON.stringify(body),
    });
    return {
      status: response.status,
      json: () => response.json() as Promise<Reply>,
    };
  }
  const { destinationId: _destination, ...config } = f.target;
  assert.ok(_destination);
  assert.equal((await (await post("configure", config)).json()).ready, true);
  const proposal = await (
    await post("propose", {
      question: "Ask Synthetic Customer which lock failed.",
      aliases: [{ entityType: "CUSTOMER", alias: "Synthetic Customer" }],
    })
  ).json();
  assert.equal(proposal.ready, true);
  const passphrase = "synthetic four word passphrase";
  const protectedText = await (
    await post("protect", {
      proposal: proposal.proposal,
      selected: proposal.suggestions.map((s: { index: number }) => s.index),
      manual: [],
      passphrase,
    })
  ).json();
  expected = protectedText.text;
  assert.equal(protectedText.ready, true);
  assert.ok(protectedText.authorizationId);
  assert.equal(calls, 0);
  const body = { authorizationId: protectedText.authorizationId, passphrase };
  assert.equal((await post("send", body, "wrong")).status, 403);
  const reply = await (await post("send", body)).json();
  assert.equal(reply.ready, true);
  assert.equal(reply.text, "Inspect the lock owner for Synthetic Customer.");
  assert.equal(calls, 1);
  assert.equal((await (await post("send", body)).json()).ready, false);
  assert.equal(calls, 1);
  const next = await (
    await post("propose", {
      question: "What should we inspect now?",
      aliases: [],
    })
  ).json();
  assert.equal(next.ready, true);
  assert.ok(
    next.items.some((item: { text: string }) => item.text.includes(reply.text)),
  );
  const conversation = await f.app.conversations.open({
    id: f.query.conversationId,
    projectId: f.project.id,
  });
  assert.equal(conversation?.moments.at(-1)?.type, "AGENT_MESSAGE");
});

test("changed evidence refuses confirmation and an uncertain result never retries", async (t) => {
  let calls = 0;
  const f = await continuationFixture({
    send: async () => {
      calls++;
      return { kind: "UNKNOWN" };
    },
  });
  t.after(() => rm(f.root, { recursive: true, force: true }));
  await f.app.continuations.configure(f.query, f.target);
  async function prepare() {
    const p = await f.app.continuations.propose(
      f.query,
      "Inspect the failure.",
      [],
    );
    assert.ok(p.ready);
    const result = await f.app.continuations.protect(f.query, {
      proposal: p.proposal,
      selected: [],
      manual: [],
      passphrase: "",
    });
    assert.ok(result.ready && result.authorizationId);
    return result.authorizationId;
  }
  const before = await prepare();
  await writeFile(join(f.repository, "README.md"), "Changed\n");
  assert.equal(
    (await f.app.continuations.send(f.query, before, "")).ready,
    false,
  );
  assert.equal(calls, 0);
  const after = await prepare();
  const unknown = await f.app.continuations.send(f.query, after, "");
  assert.ok(!unknown.ready);
  assert.equal(unknown.reason, "UNKNOWN_AFTER_EXPOSURE");
  assert.equal(
    (await f.app.continuations.send(f.query, after, "")).ready,
    false,
  );
  assert.equal(calls, 1);
});

test("failed restoration and restricted output are not stored or replayed", async (t) => {
  for (const [output, reason] of [
    ["Unknown [[AW_CUSTOMER_0000000000000000]]", "OUTPUT_RESTORATION_FAILED"],
    ["-----BEGIN PRIVATE KEY-----", "OUTPUT_BLOCKED"],
  ]) {
    await t.test(reason!, async () => {
      let calls = 0;
      const f = await continuationFixture({
        send: async () => {
          calls++;
          return {
            kind: "COMPLETED",
            text: output!,
            requestId: "synthetic",
            responseId: "synthetic",
            usage: {
              inputTokens: null,
              cachedInputTokens: null,
              outputTokens: null,
            },
          };
        },
      });
      try {
        await f.app.continuations.configure(f.query, f.target);
        const initial = await f.app.conversations.open({
          id: f.query.conversationId,
          projectId: f.project.id,
        });
        const p = await f.app.continuations.propose(
          f.query,
          "Inspect the failure.",
          [],
        );
        assert.ok(p.ready);
        const protectedText = await f.app.continuations.protect(f.query, {
          proposal: p.proposal,
          selected: [],
          manual: [],
          passphrase: "",
        });
        assert.ok(protectedText.ready && protectedText.authorizationId);
        const answer = await f.app.continuations.send(
          f.query,
          protectedText.authorizationId,
          "",
        );
        assert.ok(!answer.ready);
        assert.equal(answer.reason, reason);
        assert.equal(
          (
            await f.app.continuations.send(
              f.query,
              protectedText.authorizationId,
              "",
            )
          ).ready,
          false,
        );
        assert.equal(calls, 1);
        const after = await f.app.conversations.open({
          id: f.query.conversationId,
          projectId: f.project.id,
        });
        assert.equal(after?.moments.length, initial?.moments.length);
      } finally {
        await rm(f.root, { recursive: true, force: true });
      }
    });
  }
});

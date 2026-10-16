import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

import { GeneralConversations } from "@ai-workspace/general-conversation";
import { JsonGeneralConversationStore } from "@ai-workspace/local-general-conversation";
import { JsonSessionStore } from "@ai-workspace/local-session-ingestion";
import type { DeliveryTransport } from "@ai-workspace/model-delivery";
import type { ClassifiedModelTarget } from "@ai-workspace/model-targets";

import { GuiApplication, startGuiServer } from "../src/index.ts";
import { writeReducedTurnConfiguration } from "./reduced-turn-fixture.ts";
import { syntheticAgents, type SyntheticAgentLog } from "./synthetic-agents.ts";

/**
 * Agent journey with the real turn, registry, coordinator, stores and adapters.
 * Only the process observation is synthetic: no agent program is started.
 */
const sampleSessionPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../integrations/codex/test/fixtures/session.jsonl",
);
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

type Outcome = {
  duplicate: boolean;
  result: {
    kind: string;
    reason?: string;
    text?: string;
    effectiveModel?: string;
    attemptId?: string;
  };
};

async function start(
  root: string,
  log: SyntheticAgentLog,
  sent: string[],
  agents = true,
) {
  const transport: DeliveryTransport = {
    send: async ({ text }) => {
      sent.push(text);
      return { kind: "REJECTED" };
    },
  };
  const application = new GuiApplication({
    workspaceHome: join(root, "home"),
    sampleSessionPath,
    continuationTransport: transport,
    ...(agents ? { agentExecutors: syntheticAgents(log) } : {}),
  });
  const server = await startGuiServer(application, {
    bootstrapToken: "b".repeat(64),
    sessionToken: "s".repeat(64),
    csrfToken: "c".repeat(64),
  });
  const bootstrap = await fetch(server.bootstrapUrl, { redirect: "manual" });
  const cookie = bootstrap.headers.get("set-cookie")!.split(";", 1)[0]!;
  const headers = {
    cookie,
    origin: server.origin,
    "content-type": "application/json",
    "x-ai-workspace-csrf": "c".repeat(64),
  };
  return {
    application,
    close: () => server.close(),
    get: (path: string) =>
      fetch(`${server.origin}${path}`, { headers: { cookie } }).then(
        (response) => response.json(),
      ),
    post: (path: string, body: unknown) =>
      fetch(`${server.origin}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }).then(async (response) => ({
        status: response.status,
        body: (await response.json()) as Outcome,
      })),
  };
}

async function configureAgents(
  application: GuiApplication,
  root: string,
  projectId: string | null,
) {
  let revision = (await application.modelTargets.inspect()).revision;
  const targets: ClassifiedModelTarget[] = [
    {
      targetId: "codex",
      displayName: "Codex",
      executionClass: "AGENT_EXECUTION",
      kind: "CODEX_CLI",
      modelId: "synthetic-codex-model",
      boundary: "EXTERNAL_SERVICE",
      ...(await writeReducedTurnConfiguration(
        join(root, "codex-config"),
        "synthetic-codex-model",
        projectId,
      )),
      maxInputBytes: 256 * 1024,
      maxOutputBytes: 16_384,
      enabled: true,
    },
    {
      targetId: "claude",
      displayName: "Claude Code",
      executionClass: "AGENT_EXECUTION",
      kind: "CLAUDE_CODE",
      modelId: "sonnet",
      boundary: "EXTERNAL_SERVICE",
      ...(await writeReducedTurnConfiguration(
        join(root, "claude-config"),
        "sonnet",
        projectId,
      )),
      maxInputBytes: 256 * 1024,
      maxOutputBytes: 16_384,
      enabled: true,
    },
  ];
  for (const target of targets)
    revision = (await application.modelTargets.configure(target, revision))
      .revision;
  return revision;
}

describe("agent journey from the conversation", () => {
  it("answers, reopens, switches Codex to Claude Code and keeps one protected conversation", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-workspace-n7-journey-"));
    roots.push(root);
    const log = {
      stdin: [] as string[],
      models: [] as string[],
      mode: "ANSWER" as "ANSWER" | "BROKEN",
    };
    const sent: string[] = [];
    let fixture = await start(root, log, sent);
    let conversationId: string;
    try {
      const revision = await configureAgents(fixture.application, root, null);
      const view = (await fixture.get("/api/model-targets")) as {
        targets: {
          targetId: string;
          availability: { launch: string };
        }[];
      };
      assert.deepEqual(
        view.targets.map((target) => [
          target.targetId,
          target.availability.launch,
        ]),
        [
          ["claude", "SIMULATED"],
          ["codex", "SIMULATED"],
        ],
      );
      const general = await fixture.application.createGeneralConversation(
        "Synthetic agent journey",
      );
      conversationId = general.id;
      await fixture.application.modelTargets.selectConversation(
        conversationId,
        null,
        "codex",
        revision,
      );
      const path = `/api/conversations/${encodeURIComponent(conversationId)}`;
      const first = await fixture.post(`${path}/turn`, {
        targetId: "codex",
        userText: "Scrivi ad anna@example.test sul lavoro sintetico",
        clientRequestId: "n7-first",
      });
      assert.equal(first.status, 200);
      assert.equal(
        first.body.result.kind,
        "COMPLETED",
        JSON.stringify(first.body),
      );
      assert.equal(first.body.result.effectiveModel, "Codex");
      assert.equal(
        first.body.result.text,
        "Synthetic Codex answer for anna@example.test",
      );
      assert.equal(log.stdin.length, 1);
      assert.match(log.stdin[0]!, /\[\[EMAIL_1\]\]/u);
      assert.doesNotMatch(log.stdin[0]!, /anna@example\.test/u);
    } finally {
      await fixture.close();
    }

    fixture = await start(root, log, sent);
    try {
      const revision = (await fixture.application.modelTargets.inspect())
        .revision;
      await fixture.application.modelTargets.selectConversation(
        conversationId,
        null,
        "claude",
        revision,
      );
      const path = `/api/conversations/${encodeURIComponent(conversationId)}`;
      const second = await fixture.post(`${path}/turn`, {
        targetId: "claude",
        userText: "Continua per anna@example.test",
        clientRequestId: "n7-second",
      });
      assert.equal(
        second.body.result.kind,
        "COMPLETED",
        JSON.stringify(second.body),
      );
      assert.equal(second.body.result.effectiveModel, "Claude Code");
      assert.deepEqual(log.models, ["sonnet"]);
      assert.equal(log.stdin.length, 2);
      assert.match(
        log.stdin[1]!,
        /Synthetic Codex answer for \[\[EMAIL_1\]\]/u,
      );
      assert.doesNotMatch(log.stdin[1]!, /anna@example\.test/u);

      const conversation = (await fixture.get(path)) as {
        moments: { type: string; text: string; speaker: string | null }[];
      };
      assert.deepEqual(
        conversation.moments
          .filter((moment) => moment.type === "AGENT_MESSAGE")
          .map((moment) => [moment.speaker, moment.text]),
        [
          ["Codex", "Synthetic Codex answer for anna@example.test"],
          ["Claude Code", "Synthetic Claude answer for anna@example.test"],
        ],
      );
      assert.deepEqual(sent, [], "no model delivery was used");
      const stored = await new GeneralConversations({
        store: new JsonGeneralConversationStore(join(root, "home")),
        ids: () => "unused",
        clock: () => new Date(),
      }).show(conversationId);
      assert.deepEqual(
        stored.events
          .filter((event) => event.type === "AGENT_MESSAGE")
          .map((event) =>
            event.type === "AGENT_MESSAGE"
              ? [
                  event.provenance.executionClass,
                  event.provenance.model,
                  event.provenance.targetId,
                  event.provenance.reportedModel,
                ]
              : [],
          ),
        [
          ["AGENT_EXECUTION", "synthetic-codex-model", "codex", undefined],
          ["AGENT_EXECUTION", "sonnet", "claude", undefined],
        ],
      );

      const replay = await fixture.post(`${path}/turn`, {
        targetId: "codex",
        userText: "Scrivi ad anna@example.test sul lavoro sintetico",
        clientRequestId: "n7-first",
      });
      assert.equal(replay.body.duplicate, true);
      assert.equal(
        replay.body.result.text,
        "Synthetic Codex answer for anna@example.test",
      );
      assert.equal(log.stdin.length, 2);
    } finally {
      await fixture.close();
    }
  });

  /**
   * Real answers often span lines. A General conversation stores them, with a
   * carriage return before a line feed dropped; a message it could not store
   * is refused before anything is exposed, never after.
   */
  it("stores a multi-line answer and refuses an unstorable message before exposure", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-workspace-multiline-"));
    roots.push(root);
    const log: SyntheticAgentLog = { stdin: [], models: [], mode: "MULTILINE" };
    const sent: string[] = [];
    const fixture = await start(root, log, sent);
    try {
      const revision = await configureAgents(fixture.application, root, null);
      const general = await fixture.application.createGeneralConversation(
        "Synthetic multi-line",
      );
      await fixture.application.modelTargets.selectConversation(
        general.id,
        null,
        "claude",
        revision,
      );
      const path = `/api/conversations/${encodeURIComponent(general.id)}`;
      const answered = await fixture.post(`${path}/turn`, {
        targetId: "claude",
        userText: "Prima riga sintetica\r\nseconda riga sintetica",
        clientRequestId: "multiline-1",
      });
      assert.equal(answered.body.result.kind, "COMPLETED");
      assert.equal(
        answered.body.result.text,
        "Synthetic Claude answer\nUna seconda riga sintetica.",
      );
      const conversation = (await fixture.get(path)) as {
        moments: { text: string }[];
      };
      assert.deepEqual(
        conversation.moments.map((moment) => moment.text),
        [
          "Prima riga sintetica\nseconda riga sintetica",
          "Synthetic Claude answer\nUna seconda riga sintetica.",
        ],
      );
      const refused = await fixture.post(`${path}/turn`, {
        targetId: "claude",
        userText: "Colonna\tvalore sintetico",
        clientRequestId: "multiline-2",
      });
      assert.deepEqual(refused.body.result, {
        kind: "REFUSED_BEFORE_EXPOSURE",
        reason: "CONTEXT_UNAVAILABLE",
      });
      assert.equal(log.stdin.length, 1, "nothing ran for the refused message");
      assert.deepEqual(sent, []);
    } finally {
      await fixture.close();
    }
  });

  it("keeps an invalid agent answer unknown, never shows it and never reruns it after restart", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-workspace-n7-unknown-"));
    roots.push(root);
    const log = {
      stdin: [] as string[],
      models: [] as string[],
      mode: "BROKEN" as "ANSWER" | "BROKEN",
    };
    const sent: string[] = [];
    let fixture = await start(root, log, sent);
    let path: string;
    const request = {
      targetId: "codex",
      userText: "Domanda sintetica",
      clientRequestId: "n7-unknown",
    };
    try {
      const revision = await configureAgents(fixture.application, root, null);
      const general =
        await fixture.application.createGeneralConversation(
          "Synthetic unknown",
        );
      await fixture.application.modelTargets.selectConversation(
        general.id,
        null,
        "codex",
        revision,
      );
      path = `/api/conversations/${encodeURIComponent(general.id)}`;
      const first = await fixture.post(`${path}/turn`, request);
      assert.equal(first.body.result.kind, "UNKNOWN_AFTER_EXPOSURE");
    } finally {
      await fixture.close();
    }
    log.mode = "ANSWER";
    fixture = await start(root, log, sent);
    try {
      const replay = await fixture.post(`${path}/turn`, request);
      assert.equal(replay.body.duplicate, true);
      assert.equal(replay.body.result.kind, "UNKNOWN_AFTER_EXPOSURE");
      assert.equal(log.stdin.length, 1);
      const conversation = (await fixture.get(path)) as {
        moments: { type: string; text: string }[];
      };
      assert.equal(
        conversation.moments.some((moment) => /partial/u.test(moment.text)),
        false,
      );
      assert.deepEqual(sent, []);
    } finally {
      await fixture.close();
    }
  });

  it("records the agent class in a project conversation and reads it back", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-workspace-n7-project-"));
    roots.push(root);
    const log = {
      stdin: [] as string[],
      models: [] as string[],
      mode: "ANSWER" as "ANSWER" | "BROKEN",
    };
    const sent: string[] = [];
    const fixture = await start(root, log, sent);
    try {
      const project = await fixture.application.registerProject(process.cwd());
      await fixture.application.importSample(project.id);
      const page = (await fixture.get("/api/conversations")) as {
        rows: { id: string; kind: string }[];
      };
      const session = page.rows.find((row) => row.kind === "WORK_SESSION")!;
      const revision = await configureAgents(
        fixture.application,
        root,
        project.id,
      );
      await fixture.application.modelTargets.selectConversation(
        session.id,
        project.id,
        "codex",
        revision,
      );
      const path = `/api/conversations/${encodeURIComponent(session.id)}`;
      const query = `?project=${encodeURIComponent(project.id)}`;
      const turn = await fixture.post(`${path}/turn${query}`, {
        targetId: "codex",
        userText: "Domanda di progetto sintetica",
        clientRequestId: "n7-project",
      });
      assert.equal(
        turn.body.result.kind,
        "COMPLETED",
        JSON.stringify(turn.body),
      );
      const opened = (await fixture.get(`${path}${query}`)) as {
        moments: { type: string; speaker: string | null }[];
      };
      assert.equal(opened.moments.at(-1)?.speaker, "Codex");
      const events = (await new JsonSessionStore(join(root, "home")).load(
        session.id,
      ))!.events;
      assert.equal(events.at(-1)?.source.sourceType, "AGENT_EXECUTION:Codex");
      const replay = await fixture.post(`${path}/turn${query}`, {
        targetId: "codex",
        userText: "Domanda di progetto sintetica",
        clientRequestId: "n7-project",
      });
      assert.equal(replay.body.result.kind, "COMPLETED");
      assert.equal(replay.body.result.effectiveModel, "Codex");
      assert.equal(log.stdin.length, 1);
    } finally {
      await fixture.close();
    }
  });

  it("refuses an agent kind the host did not offer, with nothing run or delivered", async () => {
    const root = await mkdtemp(join(tmpdir(), "ai-workspace-n7-absent-"));
    roots.push(root);
    const log = {
      stdin: [] as string[],
      models: [] as string[],
      mode: "ANSWER" as "ANSWER" | "BROKEN",
    };
    const sent: string[] = [];
    const fixture = await start(root, log, sent, false);
    try {
      const revision = await configureAgents(fixture.application, root, null);
      const general =
        await fixture.application.createGeneralConversation("Synthetic absent");
      await fixture.application.modelTargets.selectConversation(
        general.id,
        null,
        "codex",
        revision,
      );
      const turn = await fixture.post(
        `/api/conversations/${encodeURIComponent(general.id)}/turn`,
        {
          targetId: "codex",
          userText: "Domanda",
          clientRequestId: "n7-absent",
        },
      );
      assert.equal(turn.body.result.reason, "TARGET_UNAVAILABLE");
      assert.deepEqual([log.stdin, sent], [[], []]);
    } finally {
      await fixture.close();
    }
  });
});

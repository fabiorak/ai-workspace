import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MemoryItem } from "@ai-workspace/active-memory";
import type { WorkItem, WorkItemId } from "@ai-workspace/core";
import type {
  CreateHandoffInput,
  Handoff,
  SectionMetadata,
  TestObservation,
} from "@ai-workspace/handoff";
import type { ImportedSession } from "@ai-workspace/session-ingestion";

import {
  LOOKED_AT_LIMIT,
  NOTE_LIMIT,
  restartPointOf,
  workForSession,
  CHANGED_PATH_LIMIT,
  MOMENT_TEXT_LIMIT,
  TEST_LIMIT,
} from "../src/restart-point.ts";
import { readRestartPoint } from "../src/restart-points.ts";

const METADATA: SectionMetadata = Object.freeze({
  origin: "WORK_ITEM",
  trust: "USER_CURATED",
  curation: "USER_CURATED",
  verification: "UNVERIFIED",
  observation: "DERIVED",
  sources: Object.freeze([]),
});

const section = <T>(value: T) => Object.freeze({ metadata: METADATA, value });

const note = (
  id: string,
  type: MemoryItem["type"],
  content: string,
  verification: MemoryItem["verification"] = "UNVERIFIED",
) =>
  Object.freeze({
    id,
    type,
    content,
    verification,
    confidence: "UNASSESSED" as const,
  });

const run = (
  command: string,
  outcome: TestObservation["outcome"],
  observedAt: string | null = "2026-08-27T08:30:00.000Z",
): TestObservation => Object.freeze({ command, outcome, observedAt });

const handoff = (overrides: Partial<Handoff["sections"]> = {}): Handoff =>
  Object.freeze({
    schemaVersion: 1,
    id: "handoff-01",
    projectId: "project-01",
    workItemId: "work-01",
    predecessorId: null,
    createdBy: "LOCAL_USER",
    createdAt: "2026-08-27T09:00:00.000Z",
    sections: Object.freeze({
      objective: section("Finish the restart point"),
      repository: section(
        Object.freeze({
          branch: "main",
          head: "0123456789abcdef0123456789abcdef01234567",
          dirty: true,
          changedPaths: Object.freeze(["apps/web/src/restart-point.ts"]),
        }),
      ),
      selectedMemory: section(
        Object.freeze([
          note(
            "memory-decision",
            "DECISION",
            "Composing is not fixing",
            "VERIFIED",
          ),
          note(
            "memory-constraint",
            "CONSTRAINT",
            "Nothing leaves the computer",
          ),
          note("memory-failure", "FAILURE", "The byte-range form was unusable"),
        ]),
      ),
      knownFailures: section(
        Object.freeze([
          note("memory-failure", "FAILURE", "The byte-range form was unusable"),
        ]),
      ),
      testState: section(Object.freeze([])),
      relevantFiles: section(Object.freeze([])),
      nextAction: section("Finish the restart point"),
      sourceReferences: section(Object.freeze([])),
      ...overrides,
    }),
  }) as Handoff;

const work = (overrides: Partial<WorkItem> = {}): WorkItem =>
  Object.freeze({
    id: "work-01" as WorkItemId,
    objective: "Show what it would take to pick this up again",
    projectId: "project-01",
    status: "ACTIVE",
    version: 2,
    createdBy: "LOCAL_USER",
    createdAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-08-26T09:00:00.000Z",
    sources: Object.freeze([
      Object.freeze({
        eventId: "event-01",
        sessionId: "session-01",
        eventType: "USER_MESSAGE",
        trust: "UNTRUSTED",
        sourceArtifactId: "artifact-01",
        sourcePosition: 1,
        sourceRecordHash: "a".repeat(64),
      }),
    ]),
    transitions: Object.freeze([]),
    ...overrides,
  });

const event = (
  sequence: number,
  type: ImportedSession["events"][number]["type"],
  text: string,
): ImportedSession["events"][number] =>
  Object.freeze({
    id: `event-${sequence}`,
    sessionId: "session-01",
    sequence,
    type,
    occurredAt: `2026-08-26T09:0${sequence}:00.000Z`,
    trust: "UNTRUSTED",
    payload: Object.freeze({ kind: "INLINE_TEXT" as const, text }),
    source: Object.freeze({
      artifactId: "artifact-01",
      sourceType: "SYNTHETIC",
      sourceSessionId: "source-session-01",
      position: sequence,
      recordHash: "b".repeat(64),
    }),
  });

const session = (
  events: readonly ImportedSession["events"][number][],
): ImportedSession =>
  Object.freeze({
    id: "session-01",
    projectId: "project-01",
    sourceType: "SYNTHETIC",
    sourceSessionId: "source-session-01",
    agent: "synthetic",
    model: "synthetic-model",
    startedAt: "2026-08-26T09:00:00.000Z",
    createdAt: "2026-08-26T09:00:00.000Z",
    lastImportedAt: "2026-08-26T09:10:00.000Z",
    latestSourceArtifact: Object.freeze({
      id: "artifact-01",
      byteLength: 128,
    }),
    events: Object.freeze(events),
  });

const storedNote = (index: number): MemoryItem =>
  Object.freeze({
    id: `memory-${String(index).padStart(2, "0")}`,
    projectId: "project-01",
    type: "DECISION",
    content: `Decision ${index}`,
    curation: "USER_CURATED",
    validity: "ACTIVE",
    verification: "UNVERIFIED",
    confidence: "UNASSESSED",
    version: 1,
    sources: Object.freeze([]),
    creationOperationId: `operation-${index}`,
    createdBy: "LOCAL_USER",
    createdAt: "2026-08-26T09:00:00.000Z",
    updatedAt: "2026-08-26T09:00:00.000Z",
    supersedes: null,
    supersession: null,
    verifications: Object.freeze([]),
    invalidation: null,
  });

/**
 * The composing path, as the area receives it. It records what it was asked to
 * build and hands back a packet: a double that cannot persist is the strongest
 * available statement that composing writes nothing.
 */
const composer = () => {
  const asked: CreateHandoffInput[] = [];
  return {
    asked,
    compose: async (input: CreateHandoffInput) => {
      asked.push(input);
      return handoff();
    },
  };
};

const sources = (
  overrides: Partial<Parameters<typeof readRestartPoint>[0]> = {},
) => ({
  sessions: {
    list: async () => [session([event(1, "USER_MESSAGE", "Where was I?")])],
  },
  workItems: { list: async () => [work()] },
  notes: async () => [storedNote(1)],
  compose: async () => handoff(),
  ...overrides,
});

describe("the Work Item an open conversation declares", () => {
  it("reads the stored link rather than guessing at one", () => {
    const linked = work();
    const unrelated = work({
      id: "work-02" as WorkItemId,
      updatedAt: "2026-08-27T09:00:00.000Z",
      sources: Object.freeze([
        Object.freeze({
          ...linked.sources[0]!,
          sessionId: "session-99",
        }),
      ]),
    });
    assert.equal(
      workForSession([unrelated, linked], "session-01")?.id,
      "work-01",
    );
    assert.equal(workForSession([unrelated], "session-01"), null);
    assert.equal(workForSession([], "session-01"), null);
  });

  it("prefers the most recently updated item when several point at one session", () => {
    const older = work();
    const newer = work({
      id: "work-03" as WorkItemId,
      updatedAt: "2026-08-27T10:00:00.000Z",
    });
    assert.equal(workForSession([older, newer], "session-01")?.id, "work-03");
    assert.equal(workForSession([newer, older], "session-01")?.id, "work-03");
  });
});

describe("what the restart point shows", () => {
  const point = restartPointOf({
    handoff: handoff(),
    conversationId: "session-01",
    workState: "ACTIVE",
    lookedAt: [
      Object.freeze({
        type: "USER_MESSAGE",
        occurredAt: "2026-08-26T09:01:00.000Z",
        text: "Where was I?",
        fromCanonicalPayload: true,
      }),
    ],
    saidAboutTests: null,
    omissions: [
      Object.freeze({ kind: "NOTES" as const, count: 3 }),
      Object.freeze({ kind: "MOMENTS" as const, count: 0 }),
    ],
  });

  it("separates what was decided, what has to hold, and what already failed", () => {
    assert.deepEqual(
      point.decisions.map((entry) => entry.content),
      ["Composing is not fixing"],
    );
    assert.deepEqual(
      point.constraints.map((entry) => entry.content),
      ["Nothing leaves the computer"],
    );
    assert.deepEqual(
      point.failures.map((entry) => entry.content),
      ["The byte-range form was unusable"],
    );
    assert.equal(point.decisions[0]?.verification, "VERIFIED");
  });

  it("speaks of branches and changed files, never of a commit", () => {
    assert.deepEqual(point.repository, {
      branch: "main",
      hasUnsavedChanges: true,
      changedFiles: 1,
      changedPaths: ["apps/web/src/restart-point.ts"],
    });
  });

  /**
   * A count says how much is unsaved and the names say where the work was left, so
   * both travel. Past the bound the rest is counted like everything else that did
   * not fit, rather than quietly disappearing.
   */
  it("names the changed files up to the bound and counts the rest", () => {
    const paths = Array.from(
      { length: CHANGED_PATH_LIMIT + 2 },
      (_, index) => `apps/web/src/file-${index + 1}.ts`,
    );
    const many = restartPointOf({
      handoff: handoff({
        repository: section(
          Object.freeze({
            branch: "main",
            head: "f".repeat(40),
            dirty: true,
            changedPaths: Object.freeze(paths),
          }),
        ),
      }),
      conversationId: "session-01",
      workState: "ACTIVE",
      lookedAt: [],
      saidAboutTests: null,
      omissions: [],
    });
    assert.deepEqual(
      many.repository.changedPaths,
      paths.slice(0, CHANGED_PATH_LIMIT),
    );
    assert.equal(many.repository.changedFiles, paths.length);
    assert.deepEqual(many.omissions, [{ kind: "CHANGED_FILES", count: 2 }]);
  });

  /**
   * Nothing observes a test run here, so a packet that records none leaves the list
   * empty and the interface says the absence out loud. What must never happen is the
   * silence being filled in — from a clean repository, or from a note that mentions
   * the tests — because that would be an outcome nobody checked.
   */
  it("records no test run when the packet holds none, and infers none", () => {
    assert.deepEqual(point.tests, []);
    assert.equal(
      point.omissions.some((omission) => omission.kind === "TESTS"),
      false,
    );
  });

  it("carries the command, the outcome and when it was seen", () => {
    const observed = restartPointOf({
      handoff: handoff({
        testState: section(
          Object.freeze([
            run("npm run check", "FAIL"),
            run("npm run build", "PASS", null),
          ]),
        ),
      }),
      conversationId: "session-01",
      workState: "ACTIVE",
      lookedAt: [],
      saidAboutTests: null,
      omissions: [],
    });
    assert.deepEqual(observed.tests, [
      {
        command: "npm run check",
        outcome: "FAIL",
        observedAt: "2026-08-27T08:30:00.000Z",
      },
      { command: "npm run build", outcome: "PASS", observedAt: null },
    ]);
  });

  it("shows the recorded runs up to the bound and counts the rest", () => {
    const many = restartPointOf({
      handoff: handoff({
        testState: section(
          Object.freeze(
            Array.from({ length: TEST_LIMIT + 2 }, (_, index) =>
              run(`npm run check -- suite-${index + 1}`, "PASS"),
            ),
          ),
        ),
      }),
      conversationId: "session-01",
      workState: "ACTIVE",
      lookedAt: [],
      saidAboutTests: null,
      omissions: [],
    });
    assert.equal(many.tests.length, TEST_LIMIT);
    assert.equal(many.tests[0]?.command, "npm run check -- suite-1");
    assert.deepEqual(
      many.omissions.filter((omission) => omission.kind === "TESTS"),
      [{ kind: "TESTS", count: 2 }],
    );
  });

  /**
   * The ordinary view carries no fingerprint, no packet identity, and no byte
   * count. The conversation's own id stays, because the caller asked with it and
   * uses it to tell a late answer from a current one; it is never shown.
   */
  it("carries no identifier, digest, or byte count a reader would have to decode", () => {
    const serialized = JSON.stringify(point);
    for (const forbidden of [
      "handoff-01",
      "memory-decision",
      "artifact-01",
      "0123456789abcdef",
      "a".repeat(64),
      "exactBytes",
      "schemaVersion",
      "metadata",
      "head",
    ])
      assert.equal(
        serialized.includes(forbidden),
        false,
        `${forbidden} reached the ordinary view`,
      );
    assert.equal(point.conversationId, "session-01");
  });

  it("states what was left out and stays silent about what was not", () => {
    assert.deepEqual(point.omissions, [{ kind: "NOTES", count: 3 }]);
    assert.equal(point.effect, "COMPOSED_LOCALLY_NOT_SAVED_AND_NOT_SENT");
  });
});

describe("composing the restart point of a conversation", () => {
  it("has nothing to compose for a note, and says so instead of choosing work", async () => {
    assert.deepEqual(
      await readRestartPoint(sources(), {
        conversationId: "note-01",
        projectId: null,
      }),
      { available: false, reason: "NOT_A_WORK_CONVERSATION" },
    );
  });

  it("answers null for a conversation that is not there", async () => {
    assert.equal(
      await readRestartPoint(sources(), {
        conversationId: "session-99",
        projectId: "project-01",
      }),
      null,
    );
  });

  it("refuses to pick a Work Item for an unlinked conversation", async () => {
    assert.deepEqual(
      await readRestartPoint(sources({ workItems: { list: async () => [] } }), {
        conversationId: "session-01",
        projectId: "project-01",
      }),
      { available: false, reason: "NO_LINKED_WORK" },
    );
  });

  it("composes nothing from a session whose moments have not arrived", async () => {
    assert.deepEqual(
      await readRestartPoint(
        sources({ sessions: { list: async () => [session([])] } }),
        { conversationId: "session-01", projectId: "project-01" },
      ),
      { available: false, reason: "NOTHING_IMPORTED_YET" },
    );
  });

  it("cites the moments it shows, bounded, and counts the ones it does not", async () => {
    const spy = composer();
    const moments = Array.from({ length: LOOKED_AT_LIMIT + 3 }, (_, index) =>
      event(index + 1, "AGENT_MESSAGE", `Moment ${index + 1}`),
    );
    const point = await readRestartPoint(
      sources({
        sessions: { list: async () => [session(moments)] },
        compose: spy.compose,
      }),
      { conversationId: "session-01", projectId: "project-01" },
    );
    assert.equal(point !== null && point.available, true);
    assert.deepEqual(
      spy.asked[0]?.sourceEventIds,
      moments.slice(-LOOKED_AT_LIMIT).map((moment) => moment.id),
    );
    assert.deepEqual(
      point!.available === true
        ? point!.lookedAt.map((moment) => moment.type)
        : [],
      moments.slice(-LOOKED_AT_LIMIT).map((moment) => moment.type),
    );
    assert.deepEqual(point!.available === true ? point!.omissions : [], [
      { kind: "MOMENTS", count: 3 },
    ]);
  });

  /**
   * The packet cannot be built without a next action, and no model may write one.
   * The draft is the person's own text — the objective, and the last thing they
   * asked — and it is never returned to the screen, because nothing has been
   * proposed for review yet.
   */
  it("assembles the next action out of local text, and shows none of it", async () => {
    const spy = composer();
    const point = await readRestartPoint(
      sources({
        sessions: {
          list: async () => [
            session([
              event(1, "USER_MESSAGE", "Where was I?"),
              event(2, "AGENT_MESSAGE", "Here is what I found"),
              event(3, "USER_MESSAGE", "Compose the restart point"),
            ]),
          ],
        },
        compose: spy.compose,
      }),
      { conversationId: "session-01", projectId: "project-01" },
    );
    const draft = spy.asked[0]?.nextAction ?? "";
    assert.match(draft, /^Show what it would take to pick this up again/u);
    assert.match(draft, /Compose the restart point$/u);
    assert.equal(draft.includes("Here is what I found"), false);
    /**
     * The assembled draft never reaches the screen. Looking for the last question
     * inside the point stopped measuring that once moments started carrying a line
     * of text: the question appears there because that is what the line is for. What
     * must be absent is the draft as a whole, and any field that would hold one.
     */
    assert.equal(JSON.stringify(point).includes(draft), false);
    assert.doesNotMatch(JSON.stringify(point), /nextAction|draft/u);
  });

  it("bounds the notes it carries and counts the rest", async () => {
    const spy = composer();
    const stored = Array.from({ length: NOTE_LIMIT + 4 }, (_, index) =>
      storedNote(index + 1),
    );
    const point = await readRestartPoint(
      sources({ notes: async () => stored, compose: spy.compose }),
      { conversationId: "session-01", projectId: "project-01" },
    );
    assert.equal(spy.asked[0]?.memoryIds.length, NOTE_LIMIT);
    assert.deepEqual(
      point!.available === true
        ? point!.omissions.filter((omission) => omission.kind === "NOTES")
        : [],
      [{ kind: "NOTES", count: 4 }],
    );
  });

  /**
   * Five speakers and five times say the reader was here, never what they were in
   * the middle of. The line of text is what makes the section answer the question it
   * is there for, and it says which of the two forms it is quoting.
   */
  it("quotes one line of every moment it shows, and says when it is raw text", async () => {
    const canonical = JSON.stringify({
      recordUuid: "record-01",
      blockIndex: 0,
      text: "The platform gate was still open\nand nobody had checked it",
    });
    const point = await readRestartPoint(
      sources({
        sessions: {
          list: async () => [
            session([
              event(1, "USER_MESSAGE", canonical),
              event(2, "AGENT_MESSAGE", "not an envelope at all"),
            ]),
          ],
        },
      }),
      { conversationId: "session-01", projectId: "project-01" },
    );
    const shown =
      point !== null && point.available === true ? point.lookedAt : [];
    assert.deepEqual(
      shown.map((moment) => moment.text),
      [
        "The platform gate was still open and nobody had checked it",
        "not an envelope at all",
      ],
    );
    assert.deepEqual(
      shown.map((moment) => moment.fromCanonicalPayload),
      [true, false],
    );
  });

  it("bounds a long moment at one line and marks the tail it cut", async () => {
    const long = `${"platform ".repeat(40)}gate`;
    const point = await readRestartPoint(
      sources({
        sessions: {
          list: async () => [session([event(1, "USER_MESSAGE", long)])],
        },
      }),
      { conversationId: "session-01", projectId: "project-01" },
    );
    const quoted =
      point !== null && point.available === true
        ? (point.lookedAt[0]?.text ?? "")
        : "";
    assert.equal(quoted.length, MOMENT_TEXT_LIMIT);
    assert.equal(quoted.endsWith("…"), true);
    assert.equal(long.startsWith(quoted.slice(0, -1)), true);
  });

  it("asks for the packet of the declared Work Item, with no files nobody named", async () => {
    const spy = composer();
    await readRestartPoint(sources({ compose: spy.compose }), {
      conversationId: "session-01",
      projectId: "project-01",
    });
    assert.equal(spy.asked.length, 1);
    assert.equal(spy.asked[0]?.projectId, "project-01");
    assert.equal(spy.asked[0]?.workItemId, "work-01");
    assert.equal(spy.asked[0]?.relevantFiles, undefined);
    assert.equal(spy.asked[0]?.predecessorId, undefined);
  });

  /**
   * Composing asks nothing and writes nothing, so it cannot state an outcome on the
   * person's behalf: an unasked test observation would be an observation nobody
   * made. Stating one belongs to the deliberate confirmation.
   */
  it("states no test outcome nobody was asked for", async () => {
    const spy = composer();
    const point = await readRestartPoint(sources({ compose: spy.compose }), {
      conversationId: "session-01",
      projectId: "project-01",
    });
    assert.equal(spy.asked[0]?.testState, undefined);
    assert.deepEqual(point!.available === true ? point!.tests : null, []);
    assert.equal(
      point!.available === true ? point!.saidAboutTests : "missing",
      null,
    );
  });

  /**
   * The answer to "do the tests pass" is usually in the conversation and nowhere
   * else. Only five moments are shown, so an outcome further back appeared nowhere
   * at all: it is searched over the whole conversation, quoted, and left as a
   * quotation — no outcome is derived from it and the recorded runs stay empty.
   */
  it("quotes the most recent moment that reported an outcome, however far back", async () => {
    const moments = [
      event(1, "TEST_RESULT", "npm test failed 3"),
      event(2, "TEST_RESULT", "npm test passed 1"),
      ...Array.from({ length: LOOKED_AT_LIMIT + 1 }, (_, index) =>
        event(index + 3, "AGENT_MESSAGE", `Moment ${index + 3}`),
      ),
    ];
    const point = await readRestartPoint(
      sources({ sessions: { list: async () => [session(moments)] } }),
      { conversationId: "session-01", projectId: "project-01" },
    );
    const said = point!.available === true ? point!.saidAboutTests : null;
    assert.equal(said?.text, "npm test passed 1");
    assert.equal(said?.type, "TEST_RESULT");
    assert.equal(said?.occurredAt, "2026-08-26T09:02:00.000Z");
    assert.equal(said?.fromCanonicalPayload, false);
    /** Quoted, never read as a result: nothing derives a recorded run from it. */
    assert.deepEqual(point!.available === true ? point!.tests : null, []);
    assert.equal(
      point!.available === true &&
        point!.lookedAt.some((moment) => moment.text === "npm test passed 1"),
      false,
      "the quoted outcome is older than the moments shown, which is the point",
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MemoryItem } from "@ai-workspace/active-memory";
import type { WorkItem, WorkItemId } from "@ai-workspace/core";
import type {
  CreateHandoffInput,
  Handoff,
  NextActionDraft,
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
import {
  readKeptRestartPoint,
  readRestartPoint,
} from "../src/restart-points.ts";

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

/** A draft as the composing path hands it over: the person's own words, to review. */
const DRAFT: NextActionDraft = Object.freeze({
  text: "Show what it would take to pick this up again",
  needsReview: true,
  assembledFrom: Object.freeze(["WORK_ITEM_OBJECTIVE" as const]),
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
  fixed: async () => [],
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
        fromArtifact: false,
      }),
    ],
    saidAboutTests: null,
    nextAction: DRAFT,
    fixed: null,
    composition: "composition-mark",
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
      nextAction: DRAFT,
      fixed: null,
      composition: "composition-mark",
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
      nextAction: DRAFT,
      fixed: null,
      composition: "composition-mark",
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
      nextAction: DRAFT,
      fixed: null,
      composition: "composition-mark",
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
   * asked — and it is now returned as well, because there is somewhere to review it.
   * What must remain true is that it is theirs: nothing an assistant said enters it,
   * and it always carries the mark that it has to be read before it is fixed.
   */
  it("assembles the next action out of the person's own words, to review", async () => {
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
    /** The composed packet and the screen carry one and the same draft. */
    const shown = point!.available === true ? point!.nextAction : null;
    assert.equal(shown?.text, draft);
    assert.equal(shown?.needsReview, true);
    assert.deepEqual(shown?.assembledFrom, [
      "WORK_ITEM_OBJECTIVE",
      "LAST_QUESTION",
    ]);
  });

  /**
   * The run recorded last time travels whole, because the tests section quotes it
   * beside its date and a quotation without its outcome answers nothing. What must
   * never happen with the outcome is the prefill, and that is measured where the
   * prefill lives: on the served client, in `restart-point-shell.test.ts`.
   */
  it("carries the run recorded in the last fixed summary, and no identity", async () => {
    const point = await readRestartPoint(
      sources({
        fixed: async () => [
          handoff({
            testState: section(Object.freeze([run("npm run check", "FAIL")])),
          }),
          handoff(),
        ],
      }),
      { conversationId: "session-01", projectId: "project-01" },
    );
    const fixed = point!.available === true ? point!.fixed : null;
    assert.equal(fixed?.count, 2);
    assert.equal(fixed?.at, "2026-08-27T09:00:00.000Z");
    assert.equal(fixed?.lastRecordedTest?.command, "npm run check");
    assert.equal(fixed?.lastRecordedTest?.outcome, "FAIL");
    assert.equal(JSON.stringify(fixed).includes("handoff-01"), false);
  });

  /** A work whose last summary recorded no run says so, rather than inventing one. */
  it("carries no recorded run when the last fixed summary recorded none", async () => {
    const point = await readRestartPoint(
      sources({ fixed: async () => [handoff()] }),
      { conversationId: "session-01", projectId: "project-01" },
    );
    const fixed = point!.available === true ? point!.fixed : null;
    assert.equal(fixed?.count, 1);
    assert.equal(fixed?.lastRecordedTest, null);
  });

  it("says nothing has been fixed when nothing has", async () => {
    const point = await readRestartPoint(sources(), {
      conversationId: "session-01",
      projectId: "project-01",
    });
    assert.equal(point!.available === true ? point!.fixed : "missing", null);
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

/**
 * A summary that was kept, read again.
 *
 * Everything here is asserted over the packet, because the packet is the whole
 * source: a photograph that quietly borrowed a value from today would be the one
 * failure this view exists to prevent.
 */
describe("rereading the summary a work already kept", () => {
  const reference = (sequence: number, eventType = "AGENT_MESSAGE") =>
    Object.freeze({
      eventId: `event-${sequence}`,
      sessionId: "session-01",
      eventType,
      trust: "UNTRUSTED",
      sourceArtifactId: "artifact-01",
      sourcePosition: sequence,
      sourceRecordHash: "b".repeat(64),
    });

  const kept = (overrides: Partial<Handoff["sections"]> = {}) =>
    handoff({
      nextAction: section(
        "Read the platform gate log before touching anything",
      ),
      testState: section(Object.freeze([run("npm run check", "PASS")])),
      sourceReferences: section(Object.freeze([reference(1), reference(2)])),
      ...overrides,
    });

  const moments = [
    event(1, "USER_MESSAGE", "Where was I?"),
    event(2, "AGENT_MESSAGE", "Halfway through the gate log"),
  ];

  const reread = (
    overrides: Partial<Parameters<typeof readRestartPoint>[0]> = {},
  ) =>
    readKeptRestartPoint(
      sources({
        sessions: { list: async () => [session(moments)] },
        fixed: async () => [kept()],
        ...overrides,
      }),
      { conversationId: "session-01", projectId: "project-01" },
    );

  it("says what the packet says, in the words of the summary", async () => {
    const photograph = await reread();
    assert.equal(photograph?.kept, true);
    if (photograph?.kept !== true) return;
    assert.equal(photograph.keptAt, "2026-08-27T09:00:00.000Z");
    assert.equal(photograph.doing, "Finish the restart point");
    assert.deepEqual(
      photograph.decisions.map((entry) => entry.content),
      ["Composing is not fixing"],
    );
    assert.deepEqual(
      photograph.constraints.map((entry) => entry.content),
      ["Nothing leaves the computer"],
    );
    assert.deepEqual(
      photograph.failures.map((entry) => entry.content),
      ["The byte-range form was unusable"],
    );
    assert.deepEqual(photograph.tests, [
      {
        command: "npm run check",
        outcome: "PASS",
        observedAt: "2026-08-27T08:30:00.000Z",
      },
    ]);
    assert.equal(photograph.repository.branch, "main");
    assert.equal(photograph.repository.hasUnsavedChanges, true);
    assert.deepEqual(photograph.repository.changedPaths, [
      "apps/web/src/restart-point.ts",
    ]);
  });

  /**
   * The confirmed text is not a draft. Marking it for review would tell a reader to
   * revise something that was decided and can no longer be changed, and the mark of
   * a composition would offer a photograph as something to confirm.
   */
  it("carries the confirmed next action, with nothing to review and nothing to confirm", async () => {
    const photograph = await reread();
    if (photograph?.kept !== true) return assert.fail("nothing was kept");
    assert.equal(
      photograph.nextAction,
      "Read the platform gate log before touching anything",
    );
    const serialized = JSON.stringify(photograph);
    for (const forbidden of [
      "needsReview",
      "composition",
      "workState",
      "assembledFrom",
    ])
      assert.equal(
        serialized.includes(forbidden),
        false,
        `${forbidden} reached a photograph, which has no value for it`,
      );
  });

  /**
   * The stored citations come back sorted by identifier, because the persisted form
   * shares one source table. Under "where you were" that is not an order at all.
   */
  it("puts the cited moments back in the order they happened", async () => {
    const photograph = await readKeptRestartPoint(
      sources({
        sessions: { list: async () => [session([...moments].reverse())] },
        fixed: async () => [
          kept({
            sourceReferences: section(
              Object.freeze([reference(2), reference(1)]),
            ),
          }),
        ],
      }),
      { conversationId: "session-01", projectId: "project-01" },
    );
    if (photograph?.kept !== true) return assert.fail("nothing was kept");
    assert.deepEqual(
      photograph.lookedAt.map((moment) => moment.text),
      ["Where was I?", "Halfway through the gate log"],
    );
  });

  /**
   * A packet is permanent, so a citation it makes stays part of the record even when
   * what it points at has gone. Dropping the line would make the summary look whole.
   */
  it("declares a cited moment that can no longer be read, and never replaces it", async () => {
    const photograph = await readKeptRestartPoint(
      sources({
        sessions: { list: async () => [session([moments[0]!])] },
        fixed: async () => [kept()],
      }),
      { conversationId: "session-01", projectId: "project-01" },
    );
    if (photograph?.kept !== true) return assert.fail("nothing was kept");
    assert.equal(photograph.lookedAt.length, 2);
    const gone = photograph.lookedAt[1]!;
    assert.equal(gone.readable, false);
    assert.equal(gone.type, "AGENT_MESSAGE");
    assert.equal(gone.text, "");
    assert.equal(gone.occurredAt, null);
  });

  it("says the packet followed another one, when it did", async () => {
    const photograph = await readKeptRestartPoint(
      sources({
        sessions: { list: async () => [session(moments)] },
        fixed: async () => [
          Object.freeze({ ...kept(), predecessorId: "handoff-00" }) as Handoff,
        ],
      }),
      { conversationId: "session-01", projectId: "project-01" },
    );
    assert.equal(photograph?.kept === true && photograph.followsOne, true);
    const first = await reread();
    assert.equal(first?.kept === true && first.followsOne, false);
  });

  /** The most recent one, as `Handoffs.list` already orders them. */
  it("rereads the most recent packet and not an earlier one", async () => {
    const photograph = await readKeptRestartPoint(
      sources({
        sessions: { list: async () => [session(moments)] },
        fixed: async () => [
          kept({ nextAction: section("The most recent one") }),
          kept({ nextAction: section("An older one") }),
        ],
      }),
      { conversationId: "session-01", projectId: "project-01" },
    );
    assert.equal(
      photograph?.kept === true ? photograph.nextAction : null,
      "The most recent one",
    );
  });

  it("says what is missing instead of showing an empty photograph", async () => {
    assert.deepEqual(await reread({ fixed: async () => [] }), {
      kept: false,
      reason: "NOTHING_KEPT_YET",
    });
    assert.deepEqual(await reread({ workItems: { list: async () => [] } }), {
      kept: false,
      reason: "NO_LINKED_WORK",
    });
    assert.deepEqual(
      await readKeptRestartPoint(
        sources({ sessions: { list: async () => [session(moments)] } }),
        { conversationId: "session-01", projectId: null },
      ),
      { kept: false, reason: "NOT_A_WORK_CONVERSATION" },
    );
    assert.equal(
      await readKeptRestartPoint(
        sources({ sessions: { list: async () => [session(moments)] } }),
        { conversationId: "session-99", projectId: "project-01" },
      ),
      null,
    );
  });
});

/**
 * Which moments answer "where you were", and where their text is read from.
 *
 * Both rules were changed by looking at a real transcript on 2026-08-29, not by
 * reasoning: its last five moments were tool calls, and its long replies were kept as
 * files no screen opened.
 */
describe("choosing and reading the moments shown", () => {
  const typed = (
    sequence: number,
    type: string,
  ): ImportedSession["events"][number] =>
    Object.freeze({
      ...event(sequence, "USER_MESSAGE", `Moment ${sequence}`),
      type,
    }) as ImportedSession["events"][number];

  const shown = async (
    events: readonly ImportedSession["events"][number][],
    artifact?: (id: string) => Promise<string>,
  ) => {
    const point = await readRestartPoint(
      sources({
        sessions: { list: async () => [session(events)] },
        ...(artifact === undefined ? {} : { artifact }),
      }),
      { conversationId: "session-01", projectId: "project-01" },
    );
    return point!.available === true ? point! : null;
  };

  /** The mechanics of execution are the how, not the where. */
  it("leaves out tool calls and their replies, and counts them", async () => {
    const point = await shown([
      typed(1, "USER_MESSAGE"),
      typed(2, "AGENT_MESSAGE"),
      typed(3, "TOOL_CALL"),
      typed(4, "TOOL_RESULT"),
      typed(5, "COMMAND_RESULT"),
      typed(6, "TOOL_CALL"),
    ]);
    assert.deepEqual(
      point!.lookedAt.map((moment) => moment.type),
      ["USER_MESSAGE", "AGENT_MESSAGE"],
    );
    assert.equal(
      point!.omissions.find((omission) => omission.kind === "OPERATIONS")
        ?.count,
      4,
    );
  });

  /**
   * The worst way to be wrong here would be a session that ended in a failure and a
   * summary that never mentioned it.
   */
  it("keeps the short moments that change how work is picked up", async () => {
    const point = await shown([
      typed(1, "TEST_RESULT"),
      typed(2, "ERROR"),
      typed(3, "FILE_CHANGE"),
      typed(4, "TOOL_CALL"),
    ]);
    assert.deepEqual(
      point!.lookedAt.map((moment) => moment.type),
      ["TEST_RESULT", "ERROR", "FILE_CHANGE"],
    );
  });

  /** A conversation of pure mechanics says so rather than filling with commands. */
  it("shows nothing rather than mechanics when there is nothing else", async () => {
    const point = await readRestartPoint(
      sources({
        sessions: {
          list: async () => [session([typed(1, "TOOL_CALL")])],
        },
      }),
      { conversationId: "session-01", projectId: "project-01" },
    );
    assert.deepEqual(point, {
      available: false,
      reason: "NOTHING_IMPORTED_YET",
    });
  });

  const held = (sequence: number): ImportedSession["events"][number] =>
    Object.freeze({
      ...event(sequence, "AGENT_MESSAGE", ""),
      payload: Object.freeze({
        kind: "ARTIFACT" as const,
        artifact: Object.freeze({ id: "artifact-long", byteLength: 9000 }),
        mediaType: "application/json" as const,
      }),
    }) as ImportedSession["events"][number];

  /** A moment longer than ingestion inlines used to be silent everywhere. */
  it("reads a long moment from its stored file, and says where it read it", async () => {
    const point = await shown([held(1)], async () =>
      JSON.stringify({ text: "The long reply nobody could read before" }),
    );
    assert.equal(
      point!.lookedAt[0]?.text,
      "The long reply nobody could read before",
    );
    assert.equal(point!.lookedAt[0]?.fromArtifact, true);
    assert.equal(point!.lookedAt[0]?.fromCanonicalPayload, true);
  });

  it("says the file could not be read instead of showing an empty moment", async () => {
    const point = await shown([held(1)], async () => {
      throw new Error("the artifact is gone");
    });
    assert.equal(point!.lookedAt[0]?.text, "");
    assert.equal(point!.lookedAt[0]?.fromArtifact, true);
  });

  /** Without a reader the line is absent, and nothing pretends otherwise. */
  it("carries no text when nothing can open artifacts", async () => {
    const point = await shown([held(1)]);
    assert.equal(point!.lookedAt[0]?.text, "");
    assert.equal(point!.lookedAt[0]?.fromArtifact, false);
  });
});

import { performance } from "node:perf_hooks";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  GeneralConversations,
  type GeneralConversation,
} from "@ai-workspace/general-conversation";
import {
  GeneralProjectLinks,
  type GeneralProjectLink,
} from "@ai-workspace/general-project-link";
import { HistoricalSearch } from "@ai-workspace/historical-search";
import { JsonGeneralConversationStore } from "@ai-workspace/local-general-conversation";
import { JsonGeneralProjectLinkStore } from "@ai-workspace/local-general-project-link";

export const GENERAL_LINK_SCALE_CORPORA = Object.freeze({
  SMALL: Object.freeze({
    conversations: 3,
    eventsPerConversation: 4,
    projects: 3,
    linkedEvents: 3,
    linksPerEvent: 2,
    warmRuns: 3,
  }),
  REFERENCE: Object.freeze({
    conversations: 12,
    eventsPerConversation: 20,
    projects: 6,
    linkedEvents: 60,
    linksPerEvent: 2,
    warmRuns: 5,
  }),
});

export type GeneralLinkScaleCorpus = keyof typeof GENERAL_LINK_SCALE_CORPORA;

export type GeneralLinkScaleReport = Readonly<{
  schemaVersion: 1;
  corpus: GeneralLinkScaleCorpus;
  counts: Readonly<{
    conversationDocuments: number;
    generalEvents: number;
    projectIds: number;
    linkDocuments: number;
    linkedEvents: number;
    queries: 5;
    perQueryGeneralEventValidations: number;
    perQueryLinkValidations: number;
    associatedQueryProjectChecks: number;
  }>;
  canonicalBytes: Readonly<{
    general: number;
    links: number;
    total: number;
  }>;
  matches: Readonly<{
    sharedGeneralOnly: number;
    uniqueKnownItem: number;
    allScopesAfterLimit: number;
    associatedProject: number;
    absent: number;
  }>;
  integrity: Readonly<{
    knownItemMisses: number;
    nonGeneralAssociationResults: number;
    nonLinkOnlyAnnotations: number;
    searchedEventCounts: readonly number[];
  }>;
  bounds: Readonly<{
    eventCountPercent: number;
    linkCountPercent: number;
    generalBytePercent: number;
    linkBytePercent: number;
  }>;
  elapsedMs: Readonly<{
    coldStorageRead: number;
    coldFiveQueries: number;
    coldTotal: number;
    warmFiveQueryRuns: readonly number[];
    warmP95: number;
  }>;
  gates: Readonly<{
    exactExpectations: boolean;
    belowTenPercentOfBounds: boolean;
    linearValidationCounts: boolean;
    coldAtMostTwoSeconds: boolean;
    warmP95AtMostHalfSecond: boolean;
  }>;
  eligibleDecision: "NO_CHANGE" | "INVESTIGATE_INDEX_TRIGGER";
}>;

const SHARED_CONTENT = "Synthetic shared collision phrase";
const FIXED_TIME = "2026-07-15T12:00:00.000Z";
const EVENT_BOUND = 10_000;
const LINK_BOUND = 10_000;
const BYTE_BOUND = 16 * 1024 * 1024;

export async function measureGeneralLinkScale(
  corpusName: GeneralLinkScaleCorpus,
): Promise<GeneralLinkScaleReport> {
  const corpus = GENERAL_LINK_SCALE_CORPORA[corpusName];
  const home = await mkdtemp(join(tmpdir(), "aiw-general-link-scale-"));
  try {
    const projectIds = Object.freeze(
      Array.from({ length: corpus.projects }, (_, index) =>
        stableId("project", index),
      ),
    );
    const projectSet = new Set(projectIds);
    const generalStore = new JsonGeneralConversationStore(home);
    const conversations = await createGeneralCorpus(
      corpus.conversations,
      corpus.eventsPerConversation,
      generalStore,
    );
    const linkStore = new JsonGeneralProjectLinkStore(home);
    const links = await createLinkCorpus(
      conversations,
      corpus.linkedEvents,
      corpus.linksPerEvent,
      projectIds,
      projectSet,
      linkStore,
      generalStore,
    );
    const bytes = await canonicalBytes(home);

    const coldStarted = performance.now();
    const [coldConversations, coldLinks] = await Promise.all([
      new JsonGeneralConversationStore(home).list(),
      new JsonGeneralProjectLinkStore(home).list(),
    ]);
    const coldStorageRead = performance.now() - coldStarted;
    const coldSearch = await runQueries(
      home,
      projectIds,
      projectSet,
      corpus.conversations * corpus.eventsPerConversation,
    );
    const warmRuns = [];
    for (let index = 0; index < corpus.warmRuns; index += 1) {
      const observation = await runQueries(
        home,
        projectIds,
        projectSet,
        corpus.conversations * corpus.eventsPerConversation,
      );
      warmRuns.push(observation.elapsedMs);
    }
    const warmP95 = percentile95(warmRuns);
    const totalEvents = corpus.conversations * corpus.eventsPerConversation;
    const expectedAssociated = new Set(
      links
        .filter((link) => link.targetProjectId === projectIds[0])
        .map((link) => link.generalEventId),
    ).size;
    const exactExpectations =
      coldConversations.length === corpus.conversations &&
      coldConversations.reduce(
        (sum, conversation) => sum + conversation.events.length,
        0,
      ) === totalEvents &&
      coldLinks.length === links.length &&
      coldSearch.matches.sharedGeneralOnly === corpus.conversations &&
      coldSearch.matches.uniqueKnownItem === 1 &&
      coldSearch.matches.allScopesAfterLimit ===
        Math.min(5, corpus.conversations) &&
      coldSearch.matches.associatedProject === expectedAssociated &&
      coldSearch.matches.absent === 0 &&
      coldSearch.integrity.knownItemMisses === 0 &&
      coldSearch.integrity.nonGeneralAssociationResults === 0 &&
      coldSearch.integrity.nonLinkOnlyAnnotations === 0;
    const bounds = Object.freeze({
      eventCountPercent: percent(totalEvents, EVENT_BOUND),
      linkCountPercent: percent(links.length, LINK_BOUND),
      generalBytePercent: percent(bytes.general, BYTE_BOUND),
      linkBytePercent: percent(bytes.links, BYTE_BOUND),
    });
    const gates = Object.freeze({
      exactExpectations,
      belowTenPercentOfBounds: Object.values(bounds).every(
        (value) => value < 10,
      ),
      linearValidationCounts:
        coldConversations.reduce(
          (sum, conversation) => sum + conversation.events.length,
          0,
        ) === totalEvents && coldLinks.length === links.length,
      coldAtMostTwoSeconds: coldStorageRead + coldSearch.elapsedMs <= 2_000,
      warmP95AtMostHalfSecond: warmP95 <= 500,
    });
    return Object.freeze({
      schemaVersion: 1 as const,
      corpus: corpusName,
      counts: Object.freeze({
        conversationDocuments: coldConversations.length,
        generalEvents: totalEvents,
        projectIds: projectIds.length,
        linkDocuments: coldLinks.length,
        linkedEvents: corpus.linkedEvents,
        queries: 5 as const,
        perQueryGeneralEventValidations: totalEvents,
        perQueryLinkValidations: links.length,
        associatedQueryProjectChecks: links.length + 1,
      }),
      canonicalBytes: bytes,
      matches: coldSearch.matches,
      integrity: coldSearch.integrity,
      bounds,
      elapsedMs: Object.freeze({
        coldStorageRead: milliseconds(coldStorageRead),
        coldFiveQueries: milliseconds(coldSearch.elapsedMs),
        coldTotal: milliseconds(coldStorageRead + coldSearch.elapsedMs),
        warmFiveQueryRuns: Object.freeze(warmRuns.map(milliseconds)),
        warmP95: milliseconds(warmP95),
      }),
      gates,
      eligibleDecision: Object.values(gates).every(Boolean)
        ? "NO_CHANGE"
        : "INVESTIGATE_INDEX_TRIGGER",
    });
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

export async function evaluateGeneralLinkScale(
  corpusName: GeneralLinkScaleCorpus = "REFERENCE",
): Promise<
  Readonly<{
    schemaVersion: 1;
    corpus: GeneralLinkScaleCorpus;
    runs: readonly GeneralLinkScaleReport[];
    deterministicCounts: boolean;
    decision: "NO_CHANGE" | "INVESTIGATE_INDEX_TRIGGER";
  }>
> {
  const first = await measureGeneralLinkScale(corpusName);
  const second = await measureGeneralLinkScale(corpusName);
  const runs = Object.freeze([first, second]);
  const deterministicCounts =
    JSON.stringify(withoutElapsed(first)) ===
    JSON.stringify(withoutElapsed(second));
  return Object.freeze({
    schemaVersion: 1 as const,
    corpus: corpusName,
    runs,
    deterministicCounts,
    decision:
      deterministicCounts &&
      runs.every((run) => run.eligibleDecision === "NO_CHANGE")
        ? "NO_CHANGE"
        : "INVESTIGATE_INDEX_TRIGGER",
  });
}

async function createGeneralCorpus(
  conversationCount: number,
  eventsPerConversation: number,
  store: JsonGeneralConversationStore,
): Promise<readonly GeneralConversation[]> {
  let nextId = 0;
  const service = new GeneralConversations({
    store,
    ids: () => stableId("general", nextId++),
    clock: () => new Date(FIXED_TIME),
  });
  const conversations: GeneralConversation[] = [];
  for (
    let conversationIndex = 0;
    conversationIndex < conversationCount;
    conversationIndex += 1
  ) {
    let conversation = await service.create(
      `Synthetic conversation ${padded(conversationIndex)}`,
    );
    for (
      let eventIndex = 0;
      eventIndex < eventsPerConversation;
      eventIndex += 1
    ) {
      const ordinal = conversationIndex * eventsPerConversation + eventIndex;
      conversation = await service.append({
        conversationId: conversation.id,
        expectedEventCount: eventIndex,
        content:
          eventIndex === 0
            ? SHARED_CONTENT
            : `Synthetic event ordinal ${padded(ordinal)} known-item`,
      });
    }
    conversations.push(conversation);
  }
  return Object.freeze(conversations);
}

async function createLinkCorpus(
  conversations: readonly GeneralConversation[],
  linkedEventCount: number,
  linksPerEvent: number,
  projectIds: readonly string[],
  projects: ReadonlySet<string>,
  store: JsonGeneralProjectLinkStore,
  general: JsonGeneralConversationStore,
): Promise<readonly GeneralProjectLink[]> {
  const events = conversations.flatMap((conversation) => conversation.events);
  const selected = Array.from(
    { length: linkedEventCount },
    (_, index) => events[index * 2]!,
  );
  let linkIndex = 0;
  const service = new GeneralProjectLinks({
    store,
    general,
    projects: { exists: async (id) => projects.has(id) },
    ids: () => stableId("link", linkIndex++),
    clock: () => new Date(FIXED_TIME),
  });
  const links: GeneralProjectLink[] = [];
  for (let eventIndex = 0; eventIndex < selected.length; eventIndex += 1) {
    const event = selected[eventIndex]!;
    for (let fanout = 0; fanout < linksPerEvent; fanout += 1) {
      links.push(
        await service.create({
          generalConversationId: event.conversationId,
          generalEventId: event.id,
          generalContentSha256: event.contentSha256,
          targetProjectId:
            projectIds[(eventIndex + fanout) % projectIds.length]!,
          rationale: `Synthetic relevance ${padded(eventIndex)} fanout ${fanout}`,
        }),
      );
    }
  }
  return Object.freeze(links);
}

async function runQueries(
  home: string,
  projectIds: readonly string[],
  projects: ReadonlySet<string>,
  totalEvents: number,
) {
  const search = new HistoricalSearch({
    events: { list: async () => [], find: async () => null },
    artifacts: { read: async () => new Uint8Array() },
    projects: { exists: async (id) => projects.has(id) },
    general: new JsonGeneralConversationStore(home),
    links: new JsonGeneralProjectLinkStore(home),
  });
  const uniqueOrdinal = totalEvents - 1;
  const started = performance.now();
  const shared = await search.searchAcrossScopes({
    scope: "GENERAL_ONLY",
    projectIds: [],
    text: SHARED_CONTENT,
    limit: 100,
  });
  const unique = await search.searchAcrossScopes({
    scope: "GENERAL_ONLY",
    projectIds: [],
    text: padded(uniqueOrdinal),
    limit: 20,
  });
  const all = await search.searchAcrossScopes({
    scope: "ALL_SCOPES",
    projectIds,
    text: SHARED_CONTENT,
    limit: 5,
  });
  const associated = await search.searchAcrossScopes({
    scope: "GENERAL_ONLY",
    projectIds: [],
    text: "Synthetic",
    limit: 100,
    associatedProjectId: projectIds[0]!,
  });
  const absent = await search.searchAcrossScopes({
    scope: "GENERAL_ONLY",
    projectIds: [],
    text: "synthetic phrase absent by construction",
    limit: 20,
  });
  const elapsedMs = performance.now() - started;
  const associationResults = associated.results;
  return Object.freeze({
    elapsedMs,
    matches: Object.freeze({
      sharedGeneralOnly: shared.results.length,
      uniqueKnownItem: unique.results.length,
      allScopesAfterLimit: all.results.length,
      associatedProject: associationResults.length,
      absent: absent.results.length,
    }),
    integrity: Object.freeze({
      knownItemMisses: unique.results.length === 1 ? 0 : 1,
      nonGeneralAssociationResults: associationResults.filter(
        (result) => result.scope !== "GENERAL",
      ).length,
      nonLinkOnlyAnnotations: associationResults.filter(
        (result) =>
          result.scope !== "GENERAL" ||
          result.links.every(
            (link) =>
              link.targetProjectId !== projectIds[0] ||
              link.effect !== "LINK_ONLY",
          ),
      ).length,
      searchedEventCounts: Object.freeze([
        shared.searchedEvents,
        unique.searchedEvents,
        all.searchedEvents,
        associated.searchedEvents,
        absent.searchedEvents,
      ]),
    }),
  });
}

async function canonicalBytes(home: string) {
  const general = await jsonBytes(join(home, "general-conversations"));
  const links = await jsonBytes(join(home, "general-project-links"));
  return Object.freeze({ general, links, total: general + links });
}
async function jsonBytes(directory: string): Promise<number> {
  const names = (await readdir(directory)).filter((name) =>
    name.endsWith(".json"),
  );
  let total = 0;
  for (const name of names)
    total += (await readFile(join(directory, name))).byteLength;
  return total;
}
function stableId(kind: string, index: number): string {
  return `${kind}-${padded(index)}`;
}
function padded(value: number): string {
  return value.toString().padStart(6, "0");
}
function percent(value: number, bound: number): number {
  return Number(((value / bound) * 100).toFixed(4));
}
function milliseconds(value: number): number {
  return Number(value.toFixed(3));
}
function percentile95(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)] ?? 0;
}
function withoutElapsed(report: GeneralLinkScaleReport) {
  return Object.freeze({
    schemaVersion: report.schemaVersion,
    corpus: report.corpus,
    counts: report.counts,
    canonicalBytes: report.canonicalBytes,
    matches: report.matches,
    integrity: report.integrity,
    bounds: report.bounds,
  });
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const requested = process.argv[2] === "SMALL" ? "SMALL" : "REFERENCE";
  const report = await evaluateGeneralLinkScale(requested);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

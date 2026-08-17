/**
 * The facade of one domain area: the transcripts a person brings in.
 *
 * ADR-0035 splits the application facade per area, and this area gained an
 * operation the host had no room for. It holds three things that belong together:
 * listing a directory, importing one file from it, and bringing in what has arrived
 * in the directories already pointed at.
 *
 * That last one is bounded by an explicit permission. A directory is remembered
 * only because somebody named it and imported from it; nothing is guessed, no
 * location is probed, and a person who never imported anything is never read from.
 * The interface's promise that no path is guessed survives intact — what changes is
 * that a directory already shown does not have to be shown again every time.
 */
import { basename, dirname } from "node:path";

import type {
  LocalTranscriptSourceStore,
  TranscriptSource,
} from "@ai-workspace/local-session-ingestion";
import { signatureOf } from "@ai-workspace/local-session-ingestion";

import type { FacadeGuard } from "./conversation-facade.ts";
import type { GuiImportReport, GuiTranscriptDiscovery } from "./view-models.ts";

/** What listing a directory finds, as the discovery adapter reports it. */
type Candidate = Readonly<{
  filePath: string;
  fileName: string;
  byteLength: number;
  modifiedAt: string;
}>;

type Discovery = Readonly<{
  discover(directory: string): Promise<readonly Candidate[]>;
}>;

type Ingestion = Readonly<{
  import(
    projectId: string,
    filePath: string,
  ): Promise<
    Readonly<{
      session: Readonly<{ id: string }>;
      addedEvents: number;
      existingEvents: number;
      totalEvents: number;
      skippedRecords: readonly Readonly<{ reason: string; count: number }>[];
    }>
  >;
}>;

/**
 * What arrived without anybody asking, stated rather than assumed.
 *
 * A directory that has become unreadable is counted, not hidden: a person who moved
 * their transcripts elsewhere must be able to tell that from a quiet morning.
 */
export type ArrivedReport = Readonly<{
  sessions: number;
  moments: number;
  directories: number;
  unreadable: number;
}>;

export type TranscriptArea = Readonly<{
  discover(directory: string): Promise<GuiTranscriptDiscovery>;
  import(projectId: string, filePath: string): Promise<GuiImportReport>;
  /** Re-reads every remembered directory once, importing what is new. */
  arrived(): Promise<ArrivedReport>;
}>;

const NOTHING_ARRIVED: ArrivedReport = Object.freeze({
  sessions: 0,
  moments: 0,
  directories: 0,
  unreadable: 0,
});

/**
 * Imports the transcripts of one remembered directory that are not already in.
 *
 * A file whose size and modification time are unchanged is skipped. Import is
 * idempotent, so this is an economy rather than a correctness measure: a wrong
 * signature costs a re-read, never a wrong answer. One failing file does not stop
 * the directory, and one failing directory does not stop the rest.
 */
async function importFrom(
  source: TranscriptSource,
  discovery: Discovery,
  ingestion: Ingestion,
  store: LocalTranscriptSourceStore,
): Promise<ArrivedReport> {
  let candidates: readonly Candidate[];
  try {
    candidates = await discovery.discover(source.directory);
  } catch {
    return Object.freeze({ ...NOTHING_ARRIVED, unreadable: 1 });
  }
  const seen: Record<string, string> = {};
  let sessions = 0;
  let moments = 0;
  let unreadable = 0;
  for (const candidate of candidates) {
    const signature = signatureOf(candidate);
    if (source.seen[candidate.fileName] === signature) continue;
    try {
      const report = await ingestion.import(
        source.projectId,
        candidate.filePath,
      );
      if (report.addedEvents > 0) {
        sessions += 1;
        moments += report.addedEvents;
      }
      seen[candidate.fileName] = signature;
    } catch {
      unreadable += 1;
    }
  }
  if (Object.keys(seen).length > 0)
    await store.remember({
      projectId: source.projectId,
      directory: source.directory,
      seen,
    });
  return Object.freeze({ sessions, moments, directories: 1, unreadable });
}

export function transcriptArea(
  dependencies: Readonly<{
    discovery: Discovery;
    ingestion: Ingestion;
    sources: LocalTranscriptSourceStore;
    guard: FacadeGuard;
  }>,
): TranscriptArea {
  const { discovery, ingestion, sources, guard } = dependencies;
  return Object.freeze({
    discover: async (directory: string) =>
      guard(async () => {
        const candidates = await discovery.discover(directory);
        return Object.freeze({
          directory,
          candidates: Object.freeze(
            candidates.map((candidate) =>
              Object.freeze({
                filePath: candidate.filePath,
                fileName: candidate.fileName,
                byteLength: candidate.byteLength,
                modifiedAt: candidate.modifiedAt,
              }),
            ),
          ),
          effect:
            candidates.length === 0
              ? "No transcript file was found; nothing was read."
              : "Only file names, sizes, and modification times were read; no transcript was opened.",
          nextAction: "Select one transcript and import it into a project.",
        });
      }, "Name an existing readable directory that holds .jsonl transcripts, then list it again."),
    import: async (projectId: string, filePath: string) =>
      guard(async () => {
        const report = await ingestion.import(projectId, filePath);
        /**
         * Pointing at this file is the permission to re-read its directory later.
         * It is recorded after the import rather than before, so a directory nobody
         * successfully imported from is never remembered.
         *
         * No signature is written here: reading the file's size and time again would
         * be a second stat for a saving of one re-read. The next sweep re-reads this
         * transcript once, the store answers that nothing changed, and from then on
         * the signature is known.
         */
        await sources.remember({ projectId, directory: dirname(filePath) });
        return Object.freeze({
          projectId,
          sessionId: report.session.id,
          sourceName: basename(filePath),
          trust: "UNTRUSTED" as const,
          addedEvents: report.addedEvents,
          existingEvents: report.existingEvents,
          totalEvents: report.totalEvents,
          skippedRecords: report.skippedRecords,
          effect:
            report.addedEvents === 0
              ? "This transcript was already imported; canonical events and artifacts were unchanged."
              : "Canonical events and immutable artifacts were added locally; nothing was transmitted.",
          nextAction: "Search this project's UNTRUSTED historical evidence.",
        });
      }, "Keep the selected project, check that the transcript is still readable and unchanged before its imported records, and retry."),
    arrived: async () =>
      guard(async () => {
        const remembered = await sources.list();
        if (remembered.length === 0) return NOTHING_ARRIVED;
        const reports: ArrivedReport[] = [];
        for (const source of remembered)
          reports.push(await importFrom(source, discovery, ingestion, sources));
        return Object.freeze(
          reports.reduce(
            (total, report) => ({
              sessions: total.sessions + report.sessions,
              moments: total.moments + report.moments,
              directories: total.directories + report.directories,
              unreadable: total.unreadable + report.unreadable,
            }),
            NOTHING_ARRIVED,
          ),
        );
      }, "Check that the directories you imported from are still readable, then reload the page."),
  });
}

# Sprint 41 — Ingest Real Local Claude Code Sessions

**Primary epics:** E0 — Product foundation; E2 — Session ingestion

**Milestone:** M5 — Privacy-ready beta

**Status:** completed

**Cadence:** scope-bounded increment (no timebox)

**Dependency:** Sprint 39 completed; the multi-page local GUI shell is available
in `2c7cdd2`; ADR-0029 records the reversal of the synthetic-only ingestion
posture

## Sprint goal

Make AI Workspace usable on the maintainer's own real Claude Code sessions, so
that product decisions can rest on evidence of use instead of on intent.

Forty sprints produced a coherent local-first design, but nobody had ever
imported a real session, because the only Claude Code reader accepted the
authored synthetic subset of Sprint 5 and rejected every shape an actual
transcript contains. The project could not be used on itself. This increment
removes that obstacle without weakening any decided guarantee.

## Delivery order

This increment is delivered before Sprint 40. The order is deliberate: Sprint 40
prepares provider credential presence, which only matters if model delivery is
worth building, and that is exactly the kind of product question that must be
answered with evidence of use. Dogfooding therefore precedes it. The change is
recorded in the project plan under recorded plan corrections.

## Product outcome

From the Sessions area, a user names a directory that holds Claude Code
transcripts, sees the candidate files with their size and modification time,
imports one by name, and reads back exactly what was imported — including how
many records were not converted and why.

An import is a snapshot. Importing the same growing transcript again appends only
the new records, and a transcript whose already-imported prefix changed is
refused rather than silently reconciled.

Nothing in this increment sends anything anywhere. No transcript, real or
synthetic, is committed to the repository.

## Committed backlog

### S41-01 — Extend the provider-neutral ingestion contract with skip accounting

- add a provider-neutral summary of records a source did not convert, as a
  reason and a count;
- report that summary from the import result, so a caller can never mistake a
  partial reading for a complete one;
- validate the summary like any other source claim: no empty reason, no
  duplicate reason, no non-positive or non-integer count;
- add a provider-neutral transcript discovery port that returns filesystem
  metadata only;
- keep the contract free of any Claude Code specifics.

### S41-02 — Add a tolerant local Claude Code reader

- implement the reader as a separate `sourceType`, so the frozen synthetic
  corpus, its adapter, and every already-imported session stay untouched;
- convert conversation records with or without a `uuid`, a `timestamp`, or a
  model, and tolerate records that are not conversation turns by counting them;
- map assistant reasoning to an agent message whose payload records that it is
  reasoning, so no new canonical event type is required;
- preserve an unrecognized content block as an `UNKNOWN` event that keeps the
  original block, because the transcript is evidence;
- tolerate an unparsable record only as the last line of the file, which makes a
  session that is still running importable without accepting corruption
  elsewhere;
- keep skipping deterministic and add no summary event, so the stored prefix
  stays stable across re-imports;
- bound file size, record size, block count, and event count, and reject
  non-UTF-8 input;
- never echo an unexpected record or block type into a message or a skip reason.

### S41-03 — Add explicit transcript discovery

- list `.jsonl` files in one directory that the user names;
- do not recurse, do not use a default location, and never open a candidate;
- return path, name, size, and modification time from filesystem metadata;
- bound the number of candidates and sort newest first;
- fail with an actionable message for an empty path, a missing directory, a
  non-directory, or an unreadable directory.

### S41-04 — Deliver discovery and import in the GUI and the CLI

- add a GUI panel that lists candidates for a named directory and imports one by
  name, with complete English and Italian parity;
- show the skip accounting in the result, so a partial import cannot look
  complete;
- state in the interface that the transcript is read locally, that nothing is
  transmitted, and that an import can be blocked by restricted-data screening;
- add the equivalent CLI commands, so neither surface is the only way to use the
  capability.

### S41-05 — Keep the privacy posture unchanged and documented

- leave high-confidence restricted-data screening fail-closed: a blocked import
  writes nothing at all;
- document that a real transcript can contain secrets, customer names, and
  private paths, and that screening is a safety net rather than a guarantee;
- record the reversal of the synthetic-only posture in an ADR;
- keep every committed fixture synthetic;
- update the public documentation that claimed real transcript ingestion was
  unsupported.

## Decision gates

The increment can be accepted only if:

1. the narrow synthetic adapter, the frozen corpus, and existing sessions are
   unchanged;
2. every record that is not converted is counted and reported;
3. no unexpected record or block type is echoed into any message, reason, or log;
4. re-importing an unchanged transcript adds nothing, and a changed prefix is
   refused;
5. restricted-data screening still blocks the whole import and writes nothing;
6. discovery reads no transcript content;
7. no external runtime dependency, network access, or automatic filesystem search
   is added;
8. the capability is complete in the bilingual GUI as well as the CLI;
9. no real transcript is committed.

## Stop and re-plan triggers

Stop and request a decision if:

- correct ingestion appears to require relaxing restricted-data screening;
- a real transcript would have to be committed to verify behavior;
- tolerating a shape would make the stored prefix unstable across re-imports;
- scope expands into automatic session discovery, background watching, model
  delivery, or any network access.

## Out of scope

- automatic discovery of the agent's own default transcript locations;
- recursive directory scanning, watching, or background import;
- other agents' transcript formats;
- redaction, rewriting, or partial import of a screened transcript;
- retention policy, pruning, or export;
- summarization, embedding, indexing, or model delivery of imported content;
- any network access.

## Verification plan

- adapter tests against a synthetic fixture that deliberately contains every
  shape the narrow reader rejects, including a reasoning block, a sidechain
  record, a meta record, a tool error, an unrecognized block, records without a
  timestamp, a blank line, and four record types that are not conversation
  turns;
- assertion of the exact event sequence, positions, payload provenance, and skip
  accounting;
- an unexpected record type asserted to produce a non-echoing reason;
- an incomplete trailing record tolerated, and the same corruption rejected when
  it is not the last line;
- CRLF input accepted; missing, mixed, and absent session identity rejected;
- incremental import over a growing transcript, and a rewritten prefix refused;
- screening rejection asserted to write neither an artifact nor a session;
- discovery tests for ordering, metadata, extension filtering, and every failure
  message;
- full repository quality gate, dependency audit, link check, diff review,
  staged-file review, and public safety scan.

## Definition of done

- a real local Claude Code transcript can be imported, and what was not imported
  is stated;
- the synthetic corpus and the narrow reader are untouched;
- discovery is explicit, non-recursive, and metadata-only;
- the capability is available and self-explanatory in the GUI and the CLI in
  English and Italian;
- the privacy posture is unchanged and honestly documented;
- the repository contains synthetic fixtures only.

## Planning decisions

- Real ingestion is added as a separate source type rather than by loosening the
  reviewed synthetic adapter, because the frozen corpus is evidence and must stay
  readable exactly as it was.
- Tolerance is bounded by accounting: the reader may accept an unfamiliar shape,
  but it may never lose it silently.
- Reasoning is preserved as agent output rather than discarded, and unrecognized
  blocks are preserved as `UNKNOWN`, because a transcript is evidence and partial
  evidence is misleading.
- Discovery is explicit because a tool that searches for conversations on its own
  is a privacy problem regardless of how carefully it is written.
- Restricted-data screening is not relaxed for real transcripts; a blocked import
  is a decision for the user to make about the transcript.

## Outcome and retrospective

The provider-neutral contract now carries a skip summary through the import
result, validated like any other source claim, plus a discovery port that returns
filesystem metadata only. A tolerant `claude-code-local` reader converts real
transcripts: reasoning becomes agent output tagged as reasoning, unknown blocks
survive as `UNKNOWN`, tool errors become errors, and records that are not
conversation turns are counted by reason. An unparsable last line is tolerated so
that a running session can be imported; the same corruption anywhere else still
fails closed. Skipping adds no event, so re-import stays idempotent and the
changed-prefix and truncation checks keep working unchanged.

Discovery lists one directory the user names, filters by extension, never opens a
candidate, and sorts newest first. The GUI and the CLI both expose discovery and
import, and both show the skip accounting, so a partial import cannot be read as
a complete one.

The narrow synthetic adapter and the frozen corpus were not modified, and their
tests still pass unchanged. Restricted-data screening still blocks an entire
import, which is verified by asserting that neither an artifact nor a session is
written. Every committed fixture remains synthetic.

The value of the increment is not the code: it is that the project can now be
used on its own sessions, which is the only way the remaining product questions
can be answered with evidence instead of with intent.

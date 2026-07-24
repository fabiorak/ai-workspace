# ADR-0029: Ingest real local agent transcripts through a tolerant adapter

**Status:** accepted

**Date:** 2026-07-24

## Context

Session ingestion has so far accepted only authored synthetic transcripts. The
`claude-code` adapter implements the reviewed subset of Sprint 5 and rejects
anything outside it: record types that are not conversation turns, assistant
reasoning blocks, records without a `uuid` or a `timestamp`, content blocks it
does not know, and a trailing record that has not been fully flushed. Every one
of those shapes occurs in an actual Claude Code transcript, so no real session
can be imported today.

That restriction protected the evidence-first method while persistence, privacy,
and delivery semantics were being decided. It also had a cost: the project has
never been used on real work, so no product decision rests on evidence of use.
PROJECT_PLAN principles 10 and 11 now separate the two kinds of evidence — a
frozen synthetic corpus for irreversible technical decisions, actual use for
product decisions — and name the maintainer's own agent sessions as the source
of product evidence. Reading a real transcript is therefore required, and it
reverses a stated posture, so it needs a decision record.

Two things must not be weakened by that reversal. A repository that is public
must never contain a real transcript. And the high-confidence restricted-data
screen must keep blocking an import in full rather than storing a partially
sanitized session.

## Decision

Read real local agent transcripts through a separate tolerant adapter, and keep
the narrow synthetic adapter unchanged:

- the tolerant reader is a distinct `sourceType` (`claude-code-local`), so the
  frozen synthetic corpus, its adapter, and every already-imported session are
  untouched and the two readings can never be confused for each other;
- tolerance is about shape, not about accounting: every record that is not
  converted is counted by reason and reported to the caller, so a partial
  reading cannot be mistaken for a complete one;
- an unrecognized content block becomes an `UNKNOWN` event that preserves the
  original block instead of being discarded, because the transcript is evidence;
- assistant reasoning becomes an `AGENT_MESSAGE` whose payload records that it
  is reasoning, so no new canonical event type is needed to keep the
  distinction;
- an unparsable record is tolerated only as the last line of the file, which is
  what makes a session that is still running importable without accepting
  corruption anywhere else;
- skipping is deterministic and adds no summary event, so re-importing a grown
  transcript keeps the stored prefix stable and the changed-prefix and
  truncation checks keep working;
- discovery lists one directory that the user names explicitly. It is not
  recursive, it has no default location, and it reads filesystem metadata only,
  so listing candidates cannot read a conversation;
- reading happens only when the user then imports one named file;
- restricted-data screening is unchanged and stays fail-closed: a transcript
  containing high-confidence restricted data blocks the whole import and writes
  nothing;
- the repository keeps containing synthetic fixtures only. Real transcripts stay
  in the maintainer's local runtime state, which is ignored by version control.

The adapter remains dependency-free and adds no network access, no provider
call, and no automatic filesystem search.

## Consequences

- the project can be used on its own real sessions, so product decisions can
  finally rest on evidence of use;
- two readers exist for the same agent, and the difference between them must
  stay documented, because a user who imports with the tolerant reader gets
  events the narrow reader would have rejected;
- `UNKNOWN` events and reasoning events make imported sessions larger and less
  uniform than the synthetic corpus, which downstream features must tolerate;
- an import that is blocked by restricted-data screening gives the user no
  partial result by design, and the remedy is a decision about the transcript,
  not a weaker screen;
- the skip accounting is part of the user-facing contract: the CLI and the GUI
  must show it, otherwise a partial import would look complete;
- tolerating an incomplete trailing record means an import of a live session is
  a snapshot, and a later import of the same file is expected and supported.

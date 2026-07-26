# ADR-0030: Screen restricted data per record in the tolerant reader

**Status:** accepted

**Date:** 2026-07-25

## Context

ADR-0029 made real local transcripts importable and deliberately left
restricted-data screening unchanged: a transcript containing a high-confidence
pattern blocked the whole import and wrote nothing. Use on real transcripts shows
what that posture costs.

A transcript of ordinary development work on a security-sensitive codebase is
refused with `Restricted data detected in session source (private-key); import
blocked` even when no key is involved. The `private-key` detector looks for the
literal string `-----BEGIN PRIVATE KEY-----`. Any project whose own privacy tests
or measurement scripts carry a synthetic canary of that shape puts that string
into every session that reads those files. A false positive of meaning, a true
positive of pattern.

Because screening is per file and fails the whole import closed, every session
that touches such files is permanently unimportable — which is precisely the set
of sessions that did the work. The primary use case of the product is blocked,
and with it the evidence of real use that product decisions depend on. The remedy
ADR-0029 suggested, "a decision about the transcript", does not exist here: a
canary cannot be removed from a repository whose tests need it, and history that
already happened cannot be rewritten.

Two remedies were considered and rejected before this one. Asking the user to
acknowledge each record moves a security decision onto a click and would have to
show the matched value in the interface to be meaningful. Loosening the detectors
or adding an allowlist weakens screening for every other use of it, including the
privacy gateway, where the same detectors guard model delivery.

## Decision

For the tolerant reader only, screening becomes per record and the import becomes
partial, counted, and visible:

- the reader classifies each record before converting it. A record carrying a
  high-confidence pattern produces no event and is counted as
  `RESTRICTED_DATA:<category>`, on the same shape as
  `NON_MESSAGE_RECORD_TYPE:<type>`. The category comes from the closed set of
  detector names and collapses to `other` if it is ever anything else;
- exclusion is per line, not per content block. A secret can straddle two blocks
  of one record, and the line is the unit of provenance, so a contaminated record
  is dropped whole even when some of its blocks are clean;
- the excluded record is left out of the source content the reader returns, so the
  detected value never reaches the artifact store. With no exclusion the returned
  content is still the file byte for byte; with an exclusion it is the screened
  transcript, and CRLF endings collapse to LF in that copy. Per-record hashes are
  unaffected, because they are computed per line without the carriage return;
- the matched value is never returned, shown, logged, or persisted — not in an
  event, not in an artifact, not in a skip reason, not in an error message;
- exclusion is reported on its own line in the CLI and in its own notice in the
  GUI, in English and Italian, rather than left among the ordinary skips: the
  import is partial for a security reason and that must be impossible to miss;
- the provider-neutral core is unchanged and stays fail-closed. It screens
  whatever it receives and refuses the whole import if anything restricted is
  still present, so the guarantee does not depend on an adapter having behaved.
  A second port classifies instead of throwing; both shapes read the same
  overlapping window scan;
- the narrow synthetic reader keeps failing the whole import closed. Its corpus is
  authored, so a detection there means the fixture is wrong;
- user acknowledgement of an individual record and more permissive detectors or
  allowlists are rejected, for the reasons above.

This amends ADR-0029 on the screening point only. Everything else it decided —
the separate `sourceType`, tolerance bounded by accounting, `UNKNOWN` preservation,
reasoning as tagged agent output, the trailing-record rule, deterministic skipping,
explicit non-recursive discovery, synthetic-only fixtures — stands unchanged.

## Consequences

- a session that merely mentions a credential pattern is importable, so a project
  can be used on the history of its own development;
- an import can now be partial for a security reason, and the accounting is the
  only thing that says so: a reader who ignores the skip breakdown can mistake a
  screened import for a complete one. That is why exclusion is reported
  separately in both surfaces;
- for the tolerant source type, the stored source artifact is no longer
  necessarily the file byte for byte. Evidence remains verifiable per record
  through record hashes, but a byte-for-byte comparison against the original file
  will differ whenever something was excluded;
- an excluded record proves nothing about the rest of the transcript. Screening
  stays a bounded net over high-confidence patterns, not a guarantee that what
  was imported is free of secrets or personal data;
- a real credential quoted in a conversation is now silently dropped instead of
  loudly blocking. The interface therefore has to keep telling the user to rotate
  anything that was real, because a dropped record is not a rotated key;
- the detector category set is duplicated as a validation list in the reader. If a
  detector is added to the privacy gateway, that list has to grow with it or the
  new category will report as `other`.

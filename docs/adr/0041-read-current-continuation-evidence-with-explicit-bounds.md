# ADR-0041: Read current continuation evidence with explicit bounds

Status: proposed
Date: 2026-09-09

## Context

Six synthetic application scenarios showed that the prepared context included
source references without their text. Even a recent critical fact was absent.
The fake journey also checked that a second proposal opened, without checking
whether it contained the preceding response.

## Decision

Keep the reviewed handoff immutable. Read current events from sessions explicitly
linked to its work, with project validation, into a separate transient evidence
item. Use canonical payload decoding, and keep model responses as literal text.
Each reading carries its event, session, date, type and UNTRUSTED attribution.
This does not promote imported claims into active memory or verified test results.

The expanded privacy projection adds CANONICAL_EVENT as an additive item kind.
Existing handoff and instruction items retain their schemas and interpretation.
The regular handoff Context Pack stays unchanged. The transient projection
accounts for the extra content separately and is screened before any delivery.

Read at most 128 events, newest first (date, sequence, then ID), at most 16 KiB
per artifact and 64 KiB of serialized readings in total. Omit oversized/unreadable
records whole and enumerate the reason; do not silently truncate a critical
sentence. The full serialized request, including instructions, metadata and
question, must fit 256 KiB. These byte limits are not model token capacities.
The limits are safety bounds, not a claim that this selection is optimal.

Present the exact request as readable sections rather than JSON strings inside
JSON. Keep source metadata, explicit omissions, and the untrusted-evidence
boundary visible. Reviewed substitutions apply before final serialization.

Use ADR-0040's coordinator through a guarded conversation-scoped POST /send.
Only a host-injected transport enables confirmation; the default host loads no
credentials and enables no transport. Confirm one exact prepared request, bounded
to 512 output tokens and a 30 second timeout. Recheck context, target and policy
before exposure. Unlock the exact retained mapping before sending, restore output
strictly, screen restricted content, and persist a successful response in the
same conversation. An unknown outcome, failed restoration or local save never
causes automatic replay. A later question prepares and reviews a new request.

## Consequences

Tests cover the six source-presence requirements and an HTTP fake-transport
journey, including restoration, idempotent confirmation and the previous answer
in the next proposal. They do not establish live model quality or cost savings.
A dedicated demo creates a fresh synthetic home and visibly simulated responses.
Real provider activation remains a separate configuration and live approval gate.

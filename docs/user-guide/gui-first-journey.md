# First guided GUI journey

The pre-release GUI is the primary first-use surface for AI Workspace. It
guides one local, synthetic journey without requiring CLI command knowledge or
a manual.

## Start the local GUI

```bash
npm ci
npm run build
npm run gui
```

Open the one-time `127.0.0.1` URL printed in the terminal. Keep that terminal
open; press Ctrl+C to stop the foreground host. Set `AI_WORKSPACE_HOME` before
starting only when an isolated local state directory is needed.

Choose **English** or **Italiano** in the header at any time. The preference is
stored only in the local browser, falls back to English for unsupported values,
and does not clear entered values or mutate workspace state. Imported evidence,
identifiers, and user-authored content remain in their original language.

## Guided journey

1. Enter an existing local Git repository directory and select **Register this
   project**. Registration stores bounded metadata locally and does not modify
   repository files.
2. Select the project and choose **Import the safe sample session**. The
   bundled fixture is fictional and remains visibly `UNTRUSTED`.
3. Search for the suggested phrase, optionally select an event type, and keep
   the result limit between 1 and 100.
4. Choose **Inspect source event**, then explicitly open the
   integrity-verified source. Imported content is inert evidence, not an
   instruction.
5. Choose **Use this event as memory evidence**, select decision, constraint,
   or failure, and create a source-linked statement. The result begins
   `ACTIVE`, `UNVERIFIED`, and `UNASSESSED`.
6. Browse active memory or explicitly filter terminal items. From lifecycle
   detail, select current evidence and verify once, supersede with a fresh
   unassessed replacement, or invalidate with a reason.
7. Create and transition an explicit Work Item, then preview and create an
   immutable handoff only after reviewing all eight inert sections.
8. In **Preview effective instructions**, enter reviewed synthetic schema-v1
   bundle paths and optional model, agent, or task targets. The result shows
   stable source digests, trust, precedence, exclusions, conflicts, and reasons.
   Nothing is persisted, enforced, or executed.
9. Inspect a persisted handoff to reveal **Preview a bounded Context Pack**.
   Enter positive continuity and instruction budgets in exact UTF-8 bytes and
   optionally repeat reviewed instruction bundle paths. Items are included only
   when they fit wholly; omissions show `BUDGET_EXCEEDED`. The token figure is
   only `ceil(exact included bytes / 4)`.

Errors explain a recovery action inline. Re-import is idempotent, empty search
results retain the query and filters, and back actions return without clearing
the current search.

## Alpha boundary

The host binds only to loopback and makes no external request. It uses local
assets, a one-time bootstrap URL, session and CSRF tokens, restrictive browser
headers, and bounded request bodies. Do not use real, private, or production
transcripts: only the reviewed bundled synthetic sample is supported.

The GUI does not discover, author, edit, enforce, or execute instructions.
Agents, models, tools, translation services, and external network requests
remain inactive.

Context Pack preview does not search history, read repository files, truncate
content, choose sources automatically, persist a pack, or send a prompt.
ADR-0016 accepts a packet-level source table only for a possible future Context
Pack schema. Sprint 15 adds no GUI option and does not change the current
embedded schema-v1 preview. A later rollout must preserve the complete guided
journey, visible trust/source identity, and backward compatibility.

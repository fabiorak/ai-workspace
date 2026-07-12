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

Errors explain a recovery action inline. Re-import is idempotent, empty search
results retain the query and filters, and back actions return without clearing
the current search.

## Alpha boundary

The host binds only to loopback and makes no external request. It uses local
assets, a one-time bootstrap URL, session and CSRF tokens, restrictive browser
headers, and bounded request bodies. Do not use real, private, or production
transcripts: only the reviewed bundled synthetic sample is supported.

Work Items, handoffs, and effective-instruction preview remain available
through the secondary CLI and are the next priority for GUI parity.

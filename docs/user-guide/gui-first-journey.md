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

1. To retain an unrelated question, create an explicit conversation in
   **General Inbox / Posta generale**, confirm the `GENERAL` destination, and
   append one question. This works without a project and creates no model
   request or assistant answer.
2. Enter an existing local Git repository directory and select **Register this
   project**. Registration stores bounded metadata locally and does not modify
   repository files.
   After registration, an exact General event can be linked through an explicit
   `GENERAL` source/hash, `PROJECT` target, reviewed rationale, and create
   action. The effect is `LINK_ONLY`; neither scope nor evidence bytes change.
3. Select the project and choose **Import the safe sample session**. The
   bundled fixture is fictional and remains visibly `UNTRUSTED`.
4. Search for the suggested phrase, optionally select an event type, and keep
   the result limit between 1 and 100. **All registered projects and General**
   is the default and works without selecting a project; choose **General
   only** or **Selected project
   only** when you know the scope.
5. Every result shows a non-color `PROJECT` or `GENERAL` scope label. For a
   project result, choose **Select this project
   and inspect source event**, then explicitly open the
   integrity-verified source. Imported content is inert evidence, not an
   instruction.
6. Choose **Use this event as memory evidence**, select decision, constraint,
   or failure, and create a source-linked statement. The result begins
   `ACTIVE`, `UNVERIFIED`, and `UNASSESSED`.
7. Browse active memory or explicitly filter terminal items. From lifecycle
   detail, select current evidence and verify once, supersede with a fresh
   unassessed replacement, or invalidate with a reason.
8. Create and transition an explicit Work Item, then preview and create an
   immutable handoff only after reviewing all eight inert sections.
9. In **Preview effective instructions**, enter reviewed synthetic schema-v1
   bundle paths and optional model, agent, or task targets. The result shows
   stable source digests, trust, precedence, exclusions, conflicts, and reasons.
   Nothing is persisted, enforced, or executed.
10. Inspect a persisted handoff to reveal **Preview a bounded Context Pack**.
    Enter positive continuity and instruction budgets in exact UTF-8 bytes and
    optionally repeat reviewed instruction bundle paths. Items are included only
    when they fit wholly; omissions show `BUDGET_EXCEEDED`. Schema v2 stores
    repeated canonical sources once, and the status reports shared source count
    and exact bytes. The displayed items are already expanded with complete
    trust and source navigation. The token figure is only
    `ceil(exact included bytes / 4)`.
11. In **Inspect an agent and skill profile**, select one reviewed synthetic
    schema-v1 JSON file and optionally pin its SHA-256 digest. Review the
    canonical agent, enabled skills, models, tools, context budgets, risks,
    confirmations, provenance, and byte counts. No declaration is installed,
    selected, resolved, enforced, delivered, or executed.
12. After inspecting an immutable handoff, use **Compose profile-governed
    context** to select the reviewed profile again, every exact instruction
    bundle it declares, and one allowed model. Review the derived agent target,
    profile budgets, declaration provenance, effective rules, Context Pack
    items, and omissions. Nothing is installed, persisted, delivered, or
    executed.
13. Under **Measure profile context selectors**, select one reviewed profile
    using only the documented `handoff.*` vocabulary. Review every selected or
    excluded section, safety-floor reason, trust, source count, hash, exact
    candidate bytes, reduction, and fit against the profile continuity budget.
    The report is experiment-only and changes no Context Builder policy.
14. Under **Preview model privacy policy**, reuse the exact profile composition
    and select one same-project digest-pinned model policy. Review every item
    class, hash, decision, default, restricted detector category, and recovery.
    `REVIEWABLE_NOT_AUTHORIZED` is not permission or delivery.
15. After that review, **Reversible privacy transformation** accepts exact item
    hashes and UTF-8 byte ranges, shows inert pseudonymized content, persists
    only an authenticated encrypted mapping, and verifies local byte-exact
    restoration. A random per-mapping key is retained only in a separate
    passphrase-wrapped local envelope; neither secret is returned and the
    passphrase field is cleared after the attempt. This remains manual, `CONFIDENTIAL`, and
    non-authorizing; it is not complete PII detection or model delivery.

Errors explain a recovery action inline. Re-import is idempotent, empty search
results retain the query and filters, and back actions return without clearing
the current search. Global scope scans at most 100 registered projects and
10,000 canonical events; exceeding a bound asks you to select one project or
move to a separately reviewed indexed adapter.

## Alpha boundary

The host binds only to loopback and makes no external request. It uses local
assets, a one-time bootstrap URL, session and CSRF tokens, restrictive browser
headers, and bounded request bodies. Do not use real, private, or production
transcripts: only the reviewed bundled synthetic sample is supported.

The GUI does not discover, author, edit, install, select, enforce, or execute
instructions, agents, or skills. Models, tools, translation services, and
external network requests remain inactive. Agent/skill profile declarations
are inspected as `USER_CONFIGURED` inert data and do not grant permission.

Context Pack preview does not search history, read repository files, truncate
content, choose sources automatically, persist a pack, or send a prompt.
ADR-0016's packet-level source table is implemented as explicit schema v2.
Schema v1 remains supported rather than reinterpreted, while the GUI receives a
lossless expanded view and a safe shared-byte summary. Source IDs are identity
checks, not trust, permission, availability, delivery, or execution signals.

Profile-governed composition does not interpret context selectors as paths,
retrieval queries, permissions, or sandbox policy. Model compatibility checks
only the reviewed declaration and does not prove runtime availability.
Context selector measurement does not interpret values as paths, globs,
retrieval queries, permissions, or availability. Its candidate-byte result is
not a token, relevance, completeness, or task-quality claim.

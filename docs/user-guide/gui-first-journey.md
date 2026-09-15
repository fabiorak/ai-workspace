# First use

The GUI is the primary surface of AI Workspace. This page covers the short path
— from starting the host to carrying an answer to another assistant — and then
lists what else is there, so you can find it when you need it rather than walk
through it first.

## Start the local GUI

```bash
npm ci
npm run build
npm run gui
```

Open the one-time `127.0.0.1` URL printed in the terminal and keep that terminal
open; Ctrl+C stops the host. The link opens one session and then expires: if you
open it twice, or in a browser that never received the session cookie, the page
says what happened and what to do.

Set `AI_WORKSPACE_HOME` before starting when you want an isolated state
directory, which is the easiest way to try the product without touching state
you already have:

```bash
AI_WORKSPACE_HOME=/tmp/ai-workspace-demo npm run gui
```

## The short path

The page you land on is a conversation. Your conversations remain in the
sidebar, most recent first; the newest one opens automatically without moving
keyboard focus. Select an already open row again and it stays open.

**1. Write.** Type in the composer at the bottom of the conversation. Enter adds
a new line and Ctrl+Enter sends. U4 submits one conversation-scoped request to
the authenticated loopback server. The standard server uses a clearly labeled
local simulated transport: no model, credential, external API, or network is
used. A completed user/assistant pair is retained atomically in the same
conversation and the answer is brought into view. Before the transport sees the
message, the built-in detector replaces supported personal-data patterns with
stable readable placeholders. The returned text is restored locally before it
is saved.

**2. Choose what the next message would use.** Configure named model targets in
**Settings**, then choose one in the conversation header. The default and the
choice for a stored conversation survive a host restart. The conversation sees
only the target ID and validated display name; technical metadata stays in
Settings. **Context** explains what the preview can see. **Automatic protection**
explains the privacy boundary and the replacement count for the last message.
Routine turns require no privacy preview, manual name entry, or passphrase. None
of these controls stores provider credentials or enables a real provider or
external network in the standard host.

If Settings reports an earlier passphrase-protected mapping, its dedicated
one-time import form can add those reviewed values to the new stable project map.
The old passphrase is cleared from the form after the attempt. Migration derives
the project from the encrypted legacy mapping, verifies a local round trip, and
does not rewrite or delete the original ciphertext. See
[automatic privacy protection](automatic-privacy-protection.md).

**3. Search separately when you need history.** Choose **Search history** in the
sidebar. Search forgives accents, capitalization, ordinary Italian and English
word endings, and single character typing errors, and ranks results by relevance.
Every result says why it matched. Results are composed from what is already on
this computer; nothing is sent anywhere. See
[historical search](historical-search.md) for the bounds. A project result can
still prepare a summary for another assistant from that dedicated search view.

### Bringing in history you already have

The list starts empty until there is something stored. In U3, **New chat** is
created as a durable General conversation on its first completed turn. To bring
in existing work,
open **Projects**, register the directory of a local Git repository, then choose
**Import the safe sample session** for the bundled fictional fixture, or
**Import your own sessions** to name the directory holding your Claude Code
transcripts, list it, and import a file. Listing reads names, sizes, and
modification times only; no transcript is opened until you select it. Read
[importing your own local transcripts](local-transcripts.md) first - it covers
where that content is stored and what not to import.

Imported sessions appear in the list on their own, titled with the first question
you asked in them, with the most recently active at the top. Each row also names
the project, the model that ran that session exactly as the transcript recorded
it, and how many moments it holds. A session whose transcript declared no model
names the agent instead, which is always recorded.

## What else is there

The sidebar holds **New chat**, **Search history**, your conversations, then
**Projects**, **Settings**, and **Technical view**. On a narrow screen, reveal
the sidebar with the labeled menu button. Tool calls, tool results, commands,
file changes, and test results are grouped behind a single technical-activity
disclosure in the conversation instead of interrupting its ordinary reading.

The technical view is where provenance, integrity verification, exact states, and
the original vocabulary live. The interface is being rebuilt one part at a time,
so some of these screens are still in their previous shape and say so; each one
remains reachable and none of their capabilities were removed.

- **Dashboard** — totals, ratios, coverage boundary, and model-delivery status,
  derived on demand from the authoritative stores. It is no longer the page you
  land on.
- **Scripts** — a deliberate unavailable state: no runner or hidden automation
  exists.
- **[General Inbox](general-inbox.md)** — keep a question that belongs to no
  project yet, and later link it to one without changing its `GENERAL` scope.
- **[Active memory](active-memory.md)** — turn an event into a source-linked
  decision, constraint, or failure, then verify, supersede, or invalidate it.
- **[Work Items and handoffs](work-items-and-handoffs.md)** — durable
  continuity: an immutable handoff attached to a Work Item, with drift
  inspection and successor preparation. This is the deliberate, evidential form
  of what step 4 does informally.
- **[Effective instructions](effective-instructions.md)**,
  **[agent and skill profiles](agent-skill-profiles.md)**, and
  **[profile-governed context](profile-governed-context.md)** — inspect what
  would apply, with digests, precedence, and conflicts. Nothing is installed,
  enforced, or executed.
- **[Privacy preflight](privacy-preflight.md)**,
  **[reversible transformation](reversible-privacy-transformation.md)**, and
  **[strict output restoration](pseudonymized-output-restoration.md)** — per
  model policy decisions, reviewed pseudonymization over exact byte ranges, and
  all-or-nothing restoration.

## Language

**Settings** switches between English and Italiano at any time. The interface
shows one language, and switching also rewrites messages already on screen,
including the ones written after an import or a search. Technical details coming
from the core packages stay in English under a labeled line, so the cause and
the remedy are always in your language while the untranslated detail stays
visibly separate. The preference is stored only in this browser and never
changes workspace state. Imported evidence, identifiers, and user-authored
content stay in their original language.

## What the alpha does and does not do

The host binds only to loopback and makes no external request. It serves local
assets, a one-time bootstrap URL, session and CSRF tokens, restrictive browser
headers, and bounded request bodies.

Imported evidence stays visibly `UNTRUSTED` and is never executed; imperative
text inside it is inert data. It is stored unencrypted under
`AI_WORKSPACE_HOME`, so never import credentials, third-party confidential
material, or recovery secrets. Fixtures committed to this repository stay
synthetic without exception.

The GUI does not discover, author, edit, install, select, enforce, or execute
instructions, agents, or skills. Models, tools, translation services, and
external network requests remain inactive. Profile declarations are inspected as
`USER_CONFIGURED` inert data and grant no permission. Context Pack preview does
not search history, read repository files, choose sources automatically, persist
a pack, or send a prompt. Automatic and reviewed pseudonymization are
non-authorizing, and neither is complete PII detection. The app-managed key and
encrypted stable map are separate private local files, but a process able to read
the complete workspace home can read both; this is the explicit residual threat
of the default single-user mode.

Errors explain a recovery action inline. Re-import is idempotent, empty results
keep your query and filters, and going back does not clear the current search.

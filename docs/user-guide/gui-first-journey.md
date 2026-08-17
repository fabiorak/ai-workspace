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

The page you land on is your own work: the conversations you have had, most
recent first, and one field to search them. Nothing has to be set up first.

**1. Ask.** Type what you are looking for. Search forgives accents,
capitalization, ordinary Italian and English word endings, and single character
typing errors, and ranks results by relevance. **Every result says why it
matched** — the word you typed, the word it reached, and how — which is what lets
you recognise a plausible but wrong result for what it is. The answer is composed
from what is already on this computer; nothing is sent anywhere. See
[historical search](historical-search.md) for the bounds.

**2. Carry the answer away.** When the answer comes from a project, **Prepare the
summary** composes a passage you can copy into a different assistant so it can
continue without replaying the conversation: repository state, what is currently
decided, and the results you were just looking at, each with where it came from.
It is composed from what is already stored, is never saved, and never leaves this
computer.

That is the whole path.

### Bringing in history you already have

The list starts empty until there is something to list. Two ways to fill it:

- **write.** A question you type is kept, belongs to no project, and can be
  linked to one later without changing where it lives;
- **import sessions.** Open **Projects**, register the directory of a local Git
  repository, then choose **Import the safe sample session** for the bundled
  fictional fixture, or **Import your own sessions** to name the directory
  holding your Claude Code transcripts, list it, and import a file. Listing reads
  names, sizes, and modification times only; no transcript is opened until you
  select it. Read [importing your own local
  transcripts](local-transcripts.md) first — it covers where that content is
  stored and what not to import.

Imported sessions appear in the list on their own, titled with the first question
you asked in them, with the most recently active at the top. Each row also names
the project, the model that ran that session exactly as the transcript recorded
it, and how many moments it holds. A session whose transcript declared no model
names the agent instead, which is always recorded.

## What else is there

The sidebar holds your conversations, then **Projects**, **Settings**, and
**Technical view**. On a narrow screen, reveal the sidebar with the labeled menu
button.

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
a pack, or send a prompt. Reviewed pseudonymization is manual and non
authorizing, and is not complete PII detection.

Errors explain a recovery action inline. Re-import is idempotent, empty results
keep your query and filters, and going back does not clear the current search.

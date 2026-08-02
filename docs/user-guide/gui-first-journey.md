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

**1. Register a project.** Open **Projects**, enter the directory of a local Git
repository, and select **Register this project**. Registration stores bounded
metadata locally and does not modify repository files.

**2. Bring in some history.** Select the project and choose **Import the safe
sample session** for the bundled fictional fixture. To work on your own history
instead, use **Import your own sessions**: name the directory holding your
Claude Code transcripts, list it, and import one file. Listing reads names,
sizes, and modification times only; no transcript is opened until you select it.
Read [importing your own local transcripts](local-transcripts.md) first — it
covers where that content is stored and what not to import.

**3. Ask.** Open **Evidence** and type what you are looking for. Search forgives
accents, capitalization, ordinary Italian and English word endings, and single
character typing errors, and ranks results by relevance. **Every result says why
it matched** — the word you typed, the word it reached, and how — which is what
lets you recognise a plausible but wrong result for what it is. See
[historical search](historical-search.md) for the filters and the bounds.

**4. Carry the answer away.** Under the results, **Prepare the summary**
composes a passage you can copy into a different assistant so it can continue
without replaying the conversation: repository state, what is currently decided,
and the results you were just looking at, each with where it came from. It is
composed from what is already stored, is never saved, and never leaves this
computer.

That is the whole path. Everything below is available when you need it and is
not a prerequisite for it.

## What else is there

Open pages from the sidebar: Dashboard, Projects, Evidence, Active memory, Work
and handoffs, Privacy, Scripts, Settings, and System status. On a narrow screen,
reveal the sidebar with the labeled menu button. Scripts is a deliberate
unavailable state: no runner or hidden automation exists.

- **Dashboard** — totals, ratios, coverage boundary, and model-delivery status,
  derived on demand from the authoritative stores.
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

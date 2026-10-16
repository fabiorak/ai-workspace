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

The session survives the restart. Start the host again and the terminal prints
the plain address instead of a link, because the browser that already has the
session keeps it for thirty days; the link is printed, and needed, only when
there is no living session — the terminal says which case you are in, and why.
The session lives in `session/session.json` under `AI_WORKSPACE_HOME`: delete
that file to end it everywhere, which is what to do on a machine you share or
stop trusting. Stopping the host no longer ends it.

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
a new line and Ctrl+Enter sends. Sending submits one conversation-scoped request to
the authenticated loopback server. The standard server uses a clearly labeled
local simulated transport: no model, credential, external API, or network is
used. A completed user/assistant pair is retained atomically in the same
conversation and the answer is brought into view. Before the transport sees the
message, the built-in detector replaces supported personal-data patterns with
stable readable placeholders. The returned text is restored locally before it
is saved.

Each submitted gesture has a durable local identity tied to its exact text and
conversation scope. If the host stops while a send is unresolved, reopening the
conversation does not send it again. The application checks the recorded model
attempt and saved conversation result: an uncertain exposure remains unresolved,
and a completed attempt without a saved answer is withheld as unavailable.
This behavior is verified for controlled process termination and restart; it
does not qualify every power-loss timing or filesystem and hardware failure mode.
Start a new message only when you intend a new send; it cannot
recover an earlier missing answer. This guarantee depends on keeping the local
conversation-turn registry intact. Deleting or restoring an older copy of that
registry removes the guarantee for affected gestures. Gestures made before this
durable identity was introduced cannot be recovered through it.

**2. Choose what the next message would use.** Configure named model targets in
**Settings**, then choose one in the conversation header. The default and the
choice for a stored conversation survive a host restart. The conversation sees
only the target ID and validated display name; technical metadata stays in
Settings. **Context** explains what the preview can see. **Automatic protection**
explains the privacy boundary and the replacement count for the last message.
Routine turns require no privacy preview, manual name entry, or passphrase. None
of these controls stores provider credentials or enables a real provider or
external network in the standard host.

Each target has a **kind** that fixes its class: OpenAI Responses is direct
model delivery, Codex CLI and Claude Code are subscription agents, and
llama-server on loopback is a local model. Settings shows a state for each
target. **Available, simulated answers** means the standard host answers locally
without calling a model, whatever the target is called; the conversation
selector adds **simulated** next to the name. Agents and the local model show
**Qualified offline, not connected yet** until the host offers them: you can
configure them, but they cannot answer and a send is refused with the draft
kept. A local model target that is offered shows **Available**; one that does not
declare the `LOCAL_ONLY` boundary shows **Unclassified** and cannot answer.
Nothing falls back to another target. Choosing Claude Code proposes the `sonnet` alias
when the model field is empty.

A target also needs a profile, a data policy and instructions. With
**Configuration: Guided**, the default, you write them in Settings: choose which
conversations the target serves (General conversations or one registered
project), write the instructions for the model one per line, and keep or change
the space reserved for conversation context and for instructions. AI Workspace
writes the three files for you in the local workspace and never changes them
afterwards; each save with different values writes new ones, and the target
switches to them only when its own save succeeds. The guided policy admits data
up to `CONFIDENTIAL`, the level every conversation needs. A target serves one
scope: for a project, also choose the target for that project or for its
conversation. **Edit** next to a target fills the form again, including the
guided fields. To use skills, tools or a different policy, choose **Files of my
own** and enter the paths of files you wrote following the
[reduced-turn configuration guide](../development/reduced-turn-configuration.md).

When the host offers an agent, a Codex or Claude Code target answers from the
same conversation: choose it, write and send. The answer is saved with the
agent's name and class, and the next message, with any target, sees it as
context. **Show protections** on an agent target adds a note: it shows exactly
what AI Workspace supplies, while the agent product adds instructions of its own.
The standard start offers no agent; the offline demo offers synthetic agents
marked **simulated**. An uncertain agent outcome is never rerun.

The local model is offered only when the host starts with
`AI_WORKSPACE_LOCAL_MODEL_ENDPOINT` set to `http://127.0.0.1:<port>` or
`http://[::1]:<port>`; the terminal then prints where it is offered. You start
the `llama-server` yourself: AI Workspace does not start or stop it. Choose the
local target, write and send; the answer is saved with the class **local model**
and an uncertain outcome is never rerun. A local target must declare the
`LOCAL_ONLY` boundary, and that is your statement: AI Workspace checks only that
the address is numeric loopback, not which program listens there. For this
target the text is not pseudonymized, so the model receives your original text.
The data policy and the block on reserved material still apply. **Show
protections** says so, and **Send only the content shown here** is not available
because there is no protected text to review. An answer that was cut off or is
empty counts as uncertain: send again if you want a new attempt.

Targets saved by an earlier version keep working. The first time you change
target settings, the earlier file is kept unchanged next to the new one as
`configuration.v1-<digest>.json`. An earlier target whose kind cannot be
recognised shows **No kind: save it again choosing a kind**; it stays listed
but cannot be chosen until you save it again with a kind.

**Show protections** normally shows the payload available now; a later send
recomposes it. To require the exact reviewed text, select **Send only the content
shown here** inside that panel. Read the sections and **Exact text prepared for
sending**, then use the same **Send** button within five minutes. If the sources,
settings, selected model, protection map or conversation relationships change,
the server stops the send and keeps the draft. Reopen **Show protections** to
prepare a new review. A server restart also invalidates unused reviews.

Editing the draft or changing the model clears the review and disables reviewed
sending until you review again. You can uncheck the option to return to ordinary
sending. Preparing a review makes no model request or execution attempt; for a
new chat it creates an empty local conversation first. It may add local protection
associations, as an ordinary preview does. Protection still has the detector's
documented coverage limits; inspect unchanged values and add protected terms.

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

The list starts empty until there is something stored. **New chat** creates a
durable General conversation when sending starts, or when you explicitly prepare
its first reviewed send. An unfinished review can leave an empty conversation. To bring
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

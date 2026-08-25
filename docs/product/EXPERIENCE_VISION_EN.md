# AI Workspace — Experience vision

**Status:** experience target, not yet implemented
**Italian version:** [`EXPERIENCE_VISION_IT.md`](EXPERIENCE_VISION_IT.md) — the two
must stay aligned; changing only one of them is a defect.
**Note:** all examples use invented names and content.

This document sets **how AI Workspace must feel to the person using it**, and
serves as the target for every later sprint that touches the interface. It does
not describe an architecture and does not replace any ADR: it describes the
experience the architecture has to allow.

---

## 1. The starting point

The current interface is **a faithful mirror of the internal model**. Every
concept in the engine has its own screen, its own label, and its own field to
fill in. Three measurements of the problem, taken from today's code and
documentation:

- the two files that produce what the user reads
  (`apps/web/src/assets/shell.ts` and `apps/web/src/localization.ts`) contain
  **373 occurrences** of unambiguous domain terms such as `UNTRUSTED`,
  `Context Pack`, `handoff`, `UNVERIFIED`, `SHA-256`, `UNASSESSED`, `LINK_ONLY`,
  `REVIEWABLE_NOT_AUTHORIZED`;
- the first-use journey documented in
  [`docs/user-guide/gui-first-journey.md`](../user-guide/gui-first-journey.md) has
  **sixteen steps**;
- performing the first useful action — searching for something — requires setting
  **five controls** (scope, associated project, text, event type, maximum number
  of results), and the text field even arrives pre-filled with the sample phrase
  `test failed`.

None of this is an oversight. It all follows coherently from a discipline the
project set for itself — _never claim more than the product actually does_ —
applied, however, **to the visible surface** instead of to the behaviour. The
result is an interface that talks to a security reviewer instead of to the person
who has work to do.

The principle to correct fits in one line:

> A guarantee is not something to **print**, it is something to **keep**. It must
> be true in the behaviour and available on request, not permanently occupy the
> screen.

---

## 2. Who opens the product

**Reference persona:** someone who works with one or more assistants based on
language models and who is **not an insider**. They can use a program with a
familiar graphical interface. They do not know the domain vocabulary, they have
not read the manual, they never will, and they have no reason to know that
canonical events, context packs, or byte ranges exist inside the product.

This person does not want to "administer their working memory". They want to find
one thing again and get back to work.

They are not necessarily someone who writes software: as § 3 explains, the product
is general purpose, so the reference persona may be someone analysing tender
specifications, comparing versions of a contract, or maintaining a company's
quality documentation. None of these people has any reason to know what a Git
repository is.

[`PRODUCT.md`](PRODUCT.md) already contains the principle this work delivers:
_"every interface is self-guiding: first-run paths, contextual help, actionable
errors, examples, and recovery instructions must let a new user complete the
supported workflow without reading the full project documentation first"_. The
current interface does not honour a principle the product had already set for
itself.

---

## 3. This is not a product for code: it is a general-purpose product

### 3.1 The document side is already designed, but outside the delivery horizon

AI Workspace was conceived as a **general-purpose** product, not as a tool for
code repositories. The document side is designed at length, in
[`AI_WORKSPACE_VISION_LONG_TERM_IT.md`](../AI_WORKSPACE_VISION_LONG_TERM_IT.md)
§§ 4–16 (the Italian version is the complete one; the English version covers the
same material in §§ 1–10). It includes:

- the **repository types** `SOFTWARE`, `DOCUMENTS`, `MIXED`, `LEGAL`, `TECHNICAL`,
  `RESEARCH`, `TENDER`, `QUALITY`, `POLICY`;
- the **code-to-document equivalence** table (source files ↔ documents, symbols ↔
  sections and concepts, module dependencies ↔ references between documents,
  errors and tests ↔ inconsistencies and gaps, code review ↔ critical review);
- the **document pipeline**: file detection → parsing and normalisation →
  anonymisation → structural chunking → metadata extraction → indexing →
  relationship extraction → analysis → annotations and derived documents;
- the **formats**: PDF, DOCX, ODT, Markdown, TXT, HTML, CSV, XLSX, PPTX, email,
  images and scanned PDFs with optional optical recognition;
- the **Document Graph**, the document-side equivalent of the code graph;
- a whole section on **token saving** in document repositories;
- the document work item types `DOCUMENT_ANALYSIS`, `DOCUMENT_COMPARISON`,
  `REQUIREMENT_EXTRACTION`, `CRITICAL_REVIEW`, `REPORT_GENERATION`,
  `COMPLIANCE_CHECK`, `MIXED_ANALYSIS`;
- a **Document Explorer** for the interface.

That document declares itself an _"exploratory horizon, not a delivery
commitment"_, and places document analysis and mixed repositories among the
_"later increments not required to complete the Core MVP alpha"_.

**Consequence for today's product:** the tie to code is not theoretical.
Registering a project asks for a _"Local Git repository directory"_, ingestion
reads transcripts from coding assistants, and repository type does not exist
anywhere. Someone holding a folder of tender documents cannot even begin.

### 3.2 What this means for the experience

1. the search box must find **documents** on equal footing with conversations: a
   clause in a tender specification is a result just as much as a decision taken
   three days ago;
2. "resume where you were" applies to **an interrupted document analysis** exactly
   as it does to work on code;
3. the word "project" in the interface **must not imply "Git repository"**. One
   picks **a folder**, and the product works out for itself what is inside;
4. **repository type is internal information**: the person does not declare it,
   and does not see it in the normal view.

This document does not bring the document side back into the delivery horizon:
that is a scoping decision, recorded among the open points in § 11. It does set a
constraint for everything built from here on: **no new screen may assume there is
code inside a project.**

### 3.3 The reference products

Five open-source products are the reference for this vision, sharing exactly one
trait: **they do complex work behind the scenes and do not make the person using
them carry the weight of it.**

| Product                           | What is taken from it                                                     | Where it touches AI Workspace                       |
| --------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| **OpenSearch**                    | search that finds, instead of literal search                              | the box in § 5.1                                    |
| **Source graph / Document Graph** | relationships between sources reconstructed without the user stating them | "where this comes from" and the resume summary      |
| **TokenSave**                     | saving context without the user having to think about saving              | automatic context preparation (§ 6.1)               |
| **Presidio**                      | automatic detection of personal data                                      | the anonymisation proposal (§ 6.3)                  |
| **Headroom**                      | mediation towards the model with a beautiful, readable control panel      | the outbound confirmation (§ 6.2) and the dashboard |

Two of these already appear in the project documents: OpenSearch appears in the
design document as a _possible future adapter, not a dependency_, and the Document
Graph as the document-side equivalent of the code graph. Presidio and Headroom do
not appear at all.

What is taken from these products is **their way of being in the world, not
necessarily their code.** Adopting any of them as a real dependency is a
structural decision that requires an ADR and is not decided here: the rule "no
external dependency without an ADR" stands, and for the GUI so does "zero runtime
dependencies".

One lesson can be taken immediately, and it costs nothing: **Headroom proves that
a control panel can be beautiful and readable without explaining its own
architecture to whoever is looking at it.** That is exactly the target for the
dashboard.

---

## 4. The first ten seconds

On opening, the person sees **one thing**, and understands what to do without
reading anything:

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                        AI Workspace                          │
│                                                              │
│     ┌────────────────────────────────────────────────┐       │
│     │  Search a conversation, a document,         🔍 │       │
│     │  a decision…                                   │       │
│     └────────────────────────────────────────────────┘       │
│                                                              │
│   Resume where you were                                      │
│                                                              │
│   ┌──────────────────┐ ┌──────────────────┐ ┌─────────────┐  │
│   │ Cart rewrite     │ │ Why not Redis    │ │ Tender doc  │  │
│   │                  │ │                  │ │ City of X   │  │
│   │                  │ │                  │ │             │  │
│   │ yesterday · 2h   │ │ 3 days ago       │ │ last week   │  │
│   │ 12 failing tests │ │ a decision taken │ │ 4 gaps      │  │
│   │ to fix           │ │ and explained    │ │             │  │
│   └──────────────────┘ └──────────────────┘ └─────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

No sidebar with nine entries. No warning panel. No jargon. Dates in natural form
("yesterday", "3 days ago"), titles in plain language, one summary line to recall
what it was about. The third card is not a code repository, and that requires no
explanation to the user.

First run, when there is nothing to resume yet, shows **one proposal only**: the
working folders the product found on the computer, to be picked from a list. Not a
field in which to type a folder path by hand, and not the word "Git".

---

## 5. The three fundamental actions

The whole product must be usable through three actions. If a feature does not
serve one of these three, it does not appear in the normal view.

### 5.1 "Where was that thing?"

You type into the box in natural language and get readable results, mixed together
and ordered by relevance and recency: conversations, projects, documents,
decisions, moments of work. A result reads like this — "_the time we decided not
to use Redis_, Cart project, 3 days ago" — and opens with one click at the exact
point.

There is no scope to choose beforehand: search always covers everything, and
filters appear **afterwards**, over the results, if they help narrow things down.

This is the most demanding part of the vision, and the constraint must be stated
without ambiguity: search today is literal by design — there is _"no fuzzy,
semantic, vector, stemmed, or indexed search"_ — so a search box at the centre of
the screen is a promise the current engine does not keep. Making it tolerant is
engine work, not interface work, has to be planned as its own sprint, and is the
point where the OpenSearch lesson genuinely counts.

### 5.2 "Let's pick up where we left off", including with another assistant

You open a "resume where you were" card and get, already prepared, the summary of
where things stood: goal, decisions taken, what was not working, next step.

The person does not build the summary, does not select which memories to include,
does not choose a budget in bytes, and does not ask for a preview before creating.
The summary **is already there**: you read it, you correct it if it is wrong, you
use it.

#### Changing assistant without starting over

This is the reason AI Workspace exists, and in the interface it must be a single
action.

Today, when you switch model — because the previous one ran out of context,
because another one costs less, because one is better at this task, or simply
because the provider retired a version — you start from zero. You re-explain the
project, retell the decisions already taken, rediscover the mistakes already made.
The accumulated work stays in the old conversation, which the new assistant cannot
read.

The target is: **you pick the new assistant from a list and keep talking.** The
new assistant already knows which project this is, what was decided and why, what
was tried and did not work, and where things stood. The person pastes nothing,
summarises nothing, re-explains nothing.

Behind that single command the product does everything needed by itself, without
asking and without showing it:

1. **collects what matters** from the project history: decisions with their
   rationale, constraints to respect, mistakes not to repeat, current state, and
   next step. Not the whole history, which would be unusable: what is needed to
   continue;
2. **ranks by importance and cuts to fit** the new assistant. Every model has a
   different context capacity, and the product knows it: what fits, fits whole;
   what does not fit is left out deliberately, favouring decisions that still hold
   over superseded detail;
3. **compresses without losing the meaning**, because a shorter context costs less
   and leaves more room for the actual work;
4. **anonymises what has to stay here**, with the ready-made proposal described in
   § 6.3;
5. **translates into the shape the new assistant expects**, because every model
   family wants its instructions in its own form. That is the product's problem,
   not the person's;
6. **shows once what is about to leave** and asks for the yes, as § 6.2 requires.

From that moment the conversation continues with the new assistant, and what
happens there becomes part of the project memory in turn: if there is another
switch later, the next handover starts from there.

The product does **not** promise that the new assistant will behave like the
previous one: different models give different answers, and that is not a defect to
hide. It promises that the new one does not have to **start ignorant**.

### 5.3 "Remember this"

You write down something you do not want to lose and it lands in the right place.
One single box. The product works out for itself whether it is a question with no
project, a decision, a constraint, or a mistake not to repeat, links it to the
conversation or document it comes from, and makes it findable.

Today that single action requires: creating a conversation first, confirming the
destination, saving the question, then separately inspecting an event, declaring
the intent to use it as evidence, choosing a type among three constants, and
creating the memory. That is seven steps for "remember this".

---

## 6. The principle: automatic for everything except what leaves

The product's actions fall into two categories, and today they are all treated the
same way.

### 6.1 Category A — local and reversible: no questions

Everything that **stays on this computer** and **destroys nothing** happens by
itself, without asking and without explaining itself. This covers: saving,
indexing, summarising, compressing to save context, linking something to its
source, reconstructing relationships between sources, keeping up to date with what
is on the computer, preparing the resume summary, recovering the context left by a
previous assistant, verifying the integrity of what is read, **and proposing
anonymisation already done**.

The product can get these wrong without irreversible consequences, and the user
has no way of doing better than the product: asking them to decide is pure cost.

### 6.2 Category B — irreversible or outbound: one confirmation, in plain language

An explicit confirmation remains **only** for what sends data off this computer or
cannot be undone. The confirmation must be asked in plain language, **at the right
moment and once only**, never as a form to fill in.

Four confirmations remain:

1. **sending something to an external model.** You see _exactly the text that will
   leave_, already anonymised, in plain readable form, with what was substituted
   highlighted. One question only: "send it?";
2. **permanently deleting** something that cannot be recovered;
3. **setting and writing down the custody passphrase**, because losing it is
   irreversible. Asked once, saying clearly what happens if it is lost;
4. **substituting someone else's data** irreversibly, if and when that possibility
   exists.

Outside those four, no confirmations.

A model reached through an adapter that guarantees a local-only execution
boundary is not an outbound operation: it receives original context after the
same policy and `RESTRICTED`-data checks, without anonymisation or confirmation.
That property belongs to the adapter and is not inferred from a model name, a
configurable URL, or the use of a loopback address alone. An unclassified
destination is blocked.

[ADR-0036](../adr/0036-route-model-privacy-by-declared-execution-boundary.md)
records this boundary without authorising any model connection or execution.

### 6.3 The reversal on anonymisation

This is the point where the vision changes a recorded posture, and it must be said
without ambiguity.

Today ADR-0021 and ADR-0023 establish that **the user** states the exact byte
ranges to substitute and confirms every suggestion one by one; in the GUI this
becomes a field in which to hand-write a JSON array with `itemId`,
`contentSha256` as 64 hexadecimal characters, `byteStart`, and `byteEnd`.

The new target is: **the product proposes the anonymisation already done, the user
looks at it and says yes.** The original concern stays satisfied — nothing leaves
without a person having seen what leaves — but the effort moves from constructing
to checking, which is what a human being is good at. This is the Presidio model:
the machine does the detection, the responsibility stays with the person.

What does **not** change: substitution stays local, the mapping stays encrypted,
restoration stays strict and all-or-nothing, and detection remains explicitly
**not** a guarantee of complete personal-data coverage. The product proposes; it
does not promise to have seen everything. The sentence that says so must appear
**once, next to the text to approve**, not on every screen.

[ADR-0034](../adr/0034-propose-a-complete-local-anonymization-for-one-approval.md)
records this amendment to ADR-0021 and ADR-0023: the software composes the
proposal, substitutions are applied by default, and one approval covers the exact
transformed text.

---

## 7. The confirmations and forms that disappear

An explicit list, so that nobody reintroduces them out of habit. Every one of
these exists in the interface today.

| Today                                                     | Tomorrow                                |
| --------------------------------------------------------- | --------------------------------------- |
| "Create a general conversation" before being able to type | you just type                           |
| "Save the question in GENERAL"                            | everything is already saved             |
| "Use this event as memory evidence"                       | the link to the source is automatic     |
| Git repository path to type by hand                       | list of folders found, to pick from     |
| "List transcripts" then "import one file"                 | what is there is already up to date     |
| continuity and instruction budgets "in exact UTF-8 bytes" | no longer exist in the interface        |
| JSON array with `byteStart` and `byteEnd`                 | the product proposes, the user approves |
| SHA-256 digest to paste as an optional "pin"              | automatic verification, one-word result |
| "Preview the summary" before "Create summary"             | the summary is read and corrected       |
| custody dropdown with **one single entry**                | it disappears                           |
| "Refresh" on dashboard, memory, and audit                 | it refreshes by itself                  |
| "Effect: …" lines and "Trust: …" panels on every form     | real behaviour, detail on request       |

---

## 8. How today's jargon reads in plain language

Rendering table. "Do not show" means: **it does not appear at all in the normal
view**, and stays available in the technical view of § 9.

| On screen today                                    | Normal view                         | Technical view                   |
| -------------------------------------------------- | ----------------------------------- | -------------------------------- |
| `handoff`                                          | resume summary                      | `handoff`                        |
| `Work Item`                                        | task                                | `Work Item`                      |
| `Context Pack`                                     | do not show                         | `Context Pack`                   |
| `canonical event`                                  | moment in the conversation          | `canonical event`                |
| `artifact`                                         | original text                       | `artifact`                       |
| `UNTRUSTED`                                        | do not show                         | imported content, never executed |
| `USER_CURATED`, `USER_AUTHORED`, `USER_CONFIGURED` | do not show                         | unchanged                        |
| `UNASSESSED`                                       | do not show                         | unchanged                        |
| `UNVERIFIED`                                       | to be confirmed                     | `UNVERIFIED`                     |
| `ACTIVE`                                           | do not show (it is the normal case) | `ACTIVE`                         |
| `SUPERSEDED`                                       | replaced                            | `SUPERSEDED`                     |
| `INVALIDATED`                                      | cancelled                           | `INVALIDATED`                    |
| `PROPOSED`                                         | to start                            | `PROPOSED`                       |
| `BLOCKED`                                          | blocked                             | `BLOCKED`                        |
| `GENERAL`                                          | notes (no project)                  | `GENERAL`                        |
| `PROJECT`                                          | project                             | `PROJECT`                        |
| `LINK_ONLY`                                        | linked, not moved                   | `LINK_ONLY`                      |
| `CONFIDENTIAL`                                     | confidential                        | `CONFIDENTIAL`                   |
| `REVIEWABLE_NOT_AUTHORIZED`                        | ready: your yes is missing          | `REVIEWABLE_NOT_AUTHORIZED`      |
| `SUGGESTED_NOT_REVIEWED`                           | proposed, to confirm                | `SUGGESTED_NOT_REVIEWED`         |
| `BUDGET_EXCEEDED`                                  | it did not all fit                  | `BUDGET_EXCEEDED`                |
| `PASSPHRASE_WRAPPING`                              | do not show                         | unchanged                        |
| `SHA-256`, `digest`                                | verified                            | unchanged                        |
| `UTF-8 bytes`                                      | do not show                         | unchanged                        |
| `provenance`                                       | where this comes from               | `provenance`                     |
| `SOFTWARE`, `DOCUMENTS`, `MIXED`, `LEGAL`, …       | do not show                         | repository type                  |
| `USER_MESSAGE`                                     | you                                 | `USER_MESSAGE`                   |
| `AGENT_MESSAGE`                                    | the assistant                       | `AGENT_MESSAGE`                  |
| `TOOL_CALL`, `TOOL_RESULT`                         | a tool that was used                | unchanged                        |
| `COMMAND_RESULT`                                   | a command that ran                  | `COMMAND_RESULT`                 |
| `FILE_CHANGE`                                      | a file that changed                 | `FILE_CHANGE`                    |
| `TEST_RESULT`                                      | a test                              | `TEST_RESULT`                    |
| `ERROR`                                            | an error                            | `ERROR`                          |
| `DECISION`                                         | a decision                          | `DECISION`                       |
| `CONSTRAINT`                                       | a constraint                        | `CONSTRAINT`                     |
| `FAILURE`                                          | a mistake not to repeat             | `FAILURE`                        |
| `PASS` / `FAIL` / `NOT_RUN`                        | passed / failed / not run           | unchanged                        |

General rule: **no all-caps word with an underscore appears in the normal view.**
This is verifiable by an automated test, as the project already does for other
invariants.

---

## 9. What does not change

This work weakens nothing. In particular:

- **the guarantees stay true.** No data leaves without approval, nothing is
  executed, there is no telemetry, the host binds only to the local interface.
  They are no longer _repeated on screen_, which is different from no longer
  holding;
- **the technical view stays, in full.** Every screen has a way to see
  provenance, integrity verification, exact state, and original vocabulary. It is
  explicit, reachable, and not hidden; it simply is not the default view. It
  serves whoever is running a check, not whoever is working;
- **the command line stays**, with all its capabilities;
- **stated limits stay stated.** Personal-data detection is not complete; search
  has limits; a summary is not verified truth. These sentences belong **once,
  where they matter**, not in every panel.

---

## 10. How to tell whether the target was reached

Observable criteria, not impressions:

1. someone who has read nothing finds again something from an earlier session
   **without opening any menu** and without asking questions;
2. the controls to set for the first useful action go from **five to one**;
3. the steps in the first-use journey go from **sixteen to three**;
4. the normal view contains **zero** all-caps domain constants, verified by an
   automated test over the text actually served;
5. the confirmations asked of the user across a complete journey — from opening to
   handing over to another assistant — are **at most one**, and it concerns what
   leaves;
6. someone starting from **a folder of documents**, not from a code repository,
   reaches their first useful search **without meeting the word "Git"**;
7. switching assistant mid-work requires **no copy-paste and no re-explaining**:
   the person picks the new assistant and continues, and the new assistant answers
   "where were we?" and "why did we decide that?" correctly without having been
   told;
8. the person can say, after using it and without help, what the product did for
   them. If the experience is magical but inexplicable, the target was missed:
   transparent does not mean invisible.

---

## 11. What this document does **not** decide

Each of these points needs its own sprint and, where required, its own ADR:

- **the tolerant search engine** (normalisation, stemming, typo tolerance, ranking
  by relevance and recency, grouping by conversation). It is the largest piece of
  work and must be measured before being promised in the interface;
- **whether and when to bring the document side back into the delivery horizon.**
  § 3 records that it is designed and that it sits outside the horizon, and
  constrains future screens not to assume code; it does not reopen it as a
  commitment;
- **adopting one of the reference products as a real dependency** (OpenSearch,
  Presidio, a source graph, a model gateway). Each needs its own ADR and must be
  weighed against "no external dependency without an ADR" and "zero runtime
  dependencies in the GUI";
- **the shape of the technical view**. Its existence is settled by
  [ADR-0035](../adr/0035-use-a-conversational-shell-over-local-history.md), which
  also replaces the nine-entry sidebar with a list of conversations, but not what
  that view looks like;
- **the visual design** proper: colours, typefaces, illustrations;
- **the time dimension in the dashboard**, which today shows only instantaneous
  state;
- **rewriting
  [`gui-first-journey.md`](../user-guide/gui-first-journey.md)**, which will be the
  consequence and not the cause of the new journey.

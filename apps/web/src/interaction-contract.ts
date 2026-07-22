export type GuiJourneyStep =
  | "WELCOME"
  | "PROJECTS"
  | "IMPORT"
  | "GENERAL_INBOX"
  | "SEARCH"
  | "EVENT"
  | "ARTIFACT"
  | "MEMORY"
  | "MEMORY_DETAIL"
  | "WORK_ITEMS"
  | "WORK_DETAIL"
  | "HANDOFF_BUILDER"
  | "HANDOFF_DETAIL"
  | "INSTRUCTIONS"
  | "AGENT_PROFILE"
  | "CONTEXT_PACK"
  | "PROFILE_CONTEXT"
  | "CONTEXT_SELECTOR_REPORT"
  | "CUSTOMER_ALIAS_REVIEW"
  | "PRIVACY_TRANSFORMATION"
  | "PRIVACY_OUTPUT_RESTORATION";
export type GuiState =
  | "FIRST_RUN"
  | "RETURNING"
  | "EMPTY"
  | "LOADING"
  | "SUCCESS"
  | "WARNING"
  | "ERROR";
export type GuiActionContract = Readonly<{
  id: string;
  label: string;
  description: string;
  effect: string;
  prerequisites: string;
  recovery: string;
  nextAction: string;
  mutates: boolean;
}>;
export type GuiScreenContract = Readonly<{
  step: GuiJourneyStep;
  title: string;
  purpose: string;
  states: readonly GuiState[];
  primaryAction: GuiActionContract;
  accessibility: Readonly<{
    landmark: string;
    focusTarget: string;
    statusText: string;
    keyboardReachable: true;
    programmaticLabels: true;
    colorIndependent: true;
    reducedMotionSafe: true;
  }>;
}>;

const action = (
  value: Omit<GuiActionContract, "prerequisites" | "recovery" | "nextAction"> &
    Partial<
      Pick<GuiActionContract, "prerequisites" | "recovery" | "nextAction">
    >,
): GuiActionContract =>
  Object.freeze({
    prerequisites: "None. The interface will explain any missing requirement.",
    recovery:
      "The entered values remain available; correct the highlighted field and retry.",
    nextAction: "The interface moves focus to the next recommended step.",
    ...value,
  });

const STATES: readonly GuiState[] = Object.freeze([
  "FIRST_RUN",
  "RETURNING",
  "EMPTY",
  "LOADING",
  "SUCCESS",
  "WARNING",
  "ERROR",
]);

export const GUI_SCREEN_CONTRACTS: readonly GuiScreenContract[] = Object.freeze(
  [
    screen(
      "WELCOME",
      "Welcome to AI Workspace",
      "Understand local-first behavior and start the shortest safe journey.",
      action({
        id: "start-project",
        label: "Register a project",
        description: "Connect one local Git repository to this workspace.",
        effect:
          "Stores bounded project metadata locally; repository files are not copied.",
        mutates: false,
      }),
    ),
    screen(
      "PROJECTS",
      "Projects",
      "Register, select, and inspect a local project before importing evidence.",
      action({
        id: "register-project",
        label: "Register this project",
        description:
          "Validate the entered local directory and add it to the Project Registry.",
        effect:
          "Creates one local registry entry and does not modify the repository.",
        prerequisites: "Enter an existing local Git repository directory.",
        mutates: true,
      }),
    ),
    screen(
      "IMPORT",
      "Import sample evidence",
      "Import the reviewed synthetic session into the selected project.",
      action({
        id: "import-sample",
        label: "Import the safe sample session",
        description:
          "Load the bundled fictional Codex fixture for guided evaluation.",
        effect:
          "Adds canonical UNTRUSTED events and immutable artifacts locally; re-import is idempotent.",
        prerequisites:
          "Select a registered project. Do not use private transcripts in this pre-release flow.",
        mutates: true,
      }),
    ),
    screen(
      "GENERAL_INBOX",
      "General Inbox",
      "Create project-free conversations, append immutable local user questions, and explicitly link exact evidence to a registered project without changing scope.",
      action({
        id: "capture-general-question",
        label: "Save question to General",
        description:
          "Append one USER_AUTHORED question to the explicitly selected General conversation.",
        effect:
          "Persists local CONFIDENTIAL, UNVERIFIED evidence; no model, answer, promotion, delivery, or execution occurs.",
        prerequisites:
          "Create or select one General conversation and enter non-restricted bounded text.",
        mutates: true,
      }),
    ),
    screen(
      "SEARCH",
      "Search historical evidence",
      "Find bounded canonical evidence across registered projects or in the selected project.",
      action({
        id: "search-evidence",
        label: "Search evidence",
        description:
          "Run literal bounded search with explicit all-project or selected-project scope.",
        effect:
          "Reads local canonical events only; no content is executed or sent over a network.",
        prerequisites:
          "Register at least one project and enter a search term. Selected-project scope additionally requires a project selection.",
        mutates: false,
      }),
    ),
    screen(
      "EVENT",
      "Inspect canonical event",
      "Review one event, trust label, payload, and provenance before opening source bytes.",
      action({
        id: "inspect-artifact",
        label: "Open integrity-verified source",
        description:
          "Verify and open the immutable source artifact linked by this event.",
        effect:
          "Reads bounded local bytes after SHA-256 verification; content remains inert and UNTRUSTED.",
        prerequisites: "Choose a result that has an artifact reference.",
        mutates: false,
      }),
    ),
    screen(
      "ARTIFACT",
      "Source evidence",
      "Inspect bounded integrity-verified source text with injection guidance.",
      action({
        id: "back-to-results",
        label: "Return to search results",
        description: "Go back without losing the current query or filters.",
        effect: "Changes only the current view.",
        mutates: false,
      }),
    ),
    screen(
      "MEMORY",
      "Curate active project memory",
      "Turn explicitly selected evidence into active decisions, constraints, or failures.",
      action({
        id: "create-memory",
        label: "Create source-linked memory",
        description:
          "Create one USER_CURATED item from the selected canonical event.",
        effect:
          "Creates ACTIVE, UNVERIFIED, UNASSESSED memory without promoting evidence trust.",
        prerequisites:
          "Inspect a canonical event in the selected project and explicitly use it as evidence.",
        mutates: true,
      }),
    ),
    screen(
      "MEMORY_DETAIL",
      "Memory lifecycle and provenance",
      "Inspect trust and attribution, then verify, supersede, or invalidate additively.",
      action({
        id: "transition-memory",
        label: "Record a lifecycle transition",
        description:
          "Apply one explicit valid transition with newly selected canonical evidence.",
        effect:
          "Appends attribution and provenance; no memory or evidence is edited or deleted.",
        prerequisites:
          "Choose an ACTIVE item and explicitly select a same-project canonical event.",
        mutates: true,
      }),
    ),
    screen(
      "WORK_ITEMS",
      "Work Items",
      "Create an explicit software objective from selected canonical evidence.",
      action({
        id: "create-work-item",
        label: "Create proposed Work Item",
        description:
          "Create one USER_CURATED objective in the selected project.",
        effect:
          "Creates PROPOSED additive objective state without inferring a current task.",
        prerequisites:
          "Select a project, canonical evidence, and enter a bounded objective.",
        mutates: true,
      }),
    ),
    screen(
      "WORK_DETAIL",
      "Work Item lifecycle",
      "Inspect objective provenance and apply only valid additive transitions.",
      action({
        id: "transition-work-item",
        label: "Record Work Item transition",
        description:
          "Activate, block, complete, or reopen with current evidence.",
        effect:
          "Appends attribution and provenance without editing objective history.",
        prerequisites:
          "Choose a valid visible action and same-project canonical evidence.",
        mutates: true,
      }),
    ),
    screen(
      "HANDOFF_BUILDER",
      "Build handoff",
      "Preview every bounded section and exact persisted size before creation.",
      action({
        id: "preview-handoff",
        label: "Preview immutable handoff",
        description:
          "Validate selections and capture bounded Git state without writing a file.",
        effect:
          "Shows deterministic packet sections and exact bytes; persistence remains unchanged.",
        prerequisites:
          "Use an ACTIVE Work Item, next action, source evidence, and explicit memory selection.",
        mutates: false,
      }),
    ),
    screen(
      "HANDOFF_DETAIL",
      "Immutable handoff",
      "Inspect section-level trust, source links, repository drift, and successor recovery.",
      action({
        id: "validate-handoff",
        label: "Validate current Git state",
        description:
          "Compare current bounded repository metadata with the immutable snapshot.",
        effect:
          "Reads Git state only and never refreshes or replaces the saved handoff.",
        prerequisites:
          "Choose a persisted handoff for this project and Work Item.",
        mutates: false,
      }),
    ),
    screen(
      "INSTRUCTIONS",
      "Effective instructions",
      "Inspect deterministic source-linked instruction composition without execution.",
      action({
        id: "preview-instructions",
        label: "Preview instructions read-only",
        description:
          "Compose explicitly selected reviewed bundles for the selected project context.",
        effect:
          "Shows precedence, exclusions, conflicts, provenance, and non-enforcement without persistence.",
        prerequisites:
          "Select a registered project and at least one reviewed synthetic instruction bundle.",
        mutates: false,
      }),
    ),
    screen(
      "AGENT_PROFILE",
      "Agent and skill profile",
      "Inspect one portable versioned USER_CONFIGURED agent and its complete enabled skill set without activation.",
      action({
        id: "preview-agent-profile",
        label: "Inspect profile read-only",
        description:
          "Validate one explicit digest-pinned local schema-v1 profile and its internal model, tool, context, and confirmation relationships.",
        effect:
          "Shows canonical portable declarations without installation, selection, permission, delivery, or execution.",
        prerequisites:
          "Select a registered project and one reviewed synthetic agent profile bundle.",
        mutates: false,
      }),
    ),
    screen(
      "CONTEXT_PACK",
      "Bounded Context Pack",
      "Preview schema-v2 continuity with shared canonical provenance and instruction material within exact-byte budgets.",
      action({
        id: "preview-context-pack",
        label: "Preview Context Pack read-only",
        description:
          "Build one deterministic expanded preview from an explicit immutable handoff and optional reviewed instructions.",
        effect:
          "Includes or omits whole source-linked items without persistence, delivery, enforcement, or execution.",
        prerequisites:
          "Inspect a persisted handoff and enter positive continuity and instruction byte budgets.",
        mutates: false,
      }),
    ),
    screen(
      "PROFILE_CONTEXT",
      "Profile-governed context",
      "Inspect exact profile-to-instruction selection and its budgeted Context Pack without runtime authority.",
      action({
        id: "preview-profile-context",
        label: "Compose profile and Context Pack read-only",
        description:
          "Combine one reviewed profile, its exact declared instruction sources, one allowed model, and one immutable handoff.",
        effect:
          "Shows profile provenance, effective rules, exact budgets, included items, and omissions without persistence, delivery, or execution.",
        prerequisites:
          "Inspect a persisted handoff and explicitly select one reviewed profile, all declared instruction bundles, and one allowed model.",
        mutates: false,
      }),
    ),
    screen(
      "CONTEXT_SELECTOR_REPORT",
      "Profile context selector measurement",
      "Compare baseline and experiment-only handoff section selection with exact candidate bytes and a visible safety floor.",
      action({
        id: "preview-context-selectors",
        label: "Preview selector measurement read-only",
        description:
          "Measure one reviewed profile's documented handoff selectors against one immutable handoff and its profile continuity budget.",
        effect:
          "Shows section decisions, provenance, hashes, exact candidate bytes, and fit without changing Context Builder or profile policy.",
        prerequisites:
          "Inspect a persisted handoff and select one reviewed profile using only the documented experiment-only handoff selector vocabulary.",
        mutates: false,
      }),
    ),
    screen(
      "CUSTOMER_ALIAS_REVIEW",
      "Exact customer/project alias review",
      "Preview transient exact customer or project ranges and confirm them individually without treating a suggestion as reviewed truth.",
      action({
        id: "preview-customer-aliases",
        label: "Preview entity suggestions",
        description:
          "Recompose the exact profile-governed Context Pack and match only explicit case-sensitive CUSTOMER or PROJECT aliases.",
        effect:
          "Returns non-echoing SUGGESTED_NOT_REVIEWED metadata without persistence, transformation, delivery, or execution.",
        prerequisites:
          "Inspect one immutable handoff, complete the exact privacy inputs, and enter a typed transient synthetic customer/project dictionary.",
        mutates: false,
      }),
    ),
    screen(
      "PRIVACY_TRANSFORMATION",
      "Reversible privacy transformation",
      "Apply explicitly reviewed exact UTF-8 spans, persist only an authenticated encrypted mapping, and verify local restoration without delivery authority.",
      action({
        id: "preview-pseudonymization",
        label: "Transform and verify locally",
        description:
          "Replace reviewed values with deterministic inert aliases and verify the separate encrypted mapping through a complete local round trip.",
        effect:
          "Persists authenticated schema-v1 or explicit schema-v2 ciphertext only; source evidence and Context Packs remain unchanged and nothing is sent or executed.",
        prerequisites:
          "Complete the exact privacy inputs, review item hashes and UTF-8 byte ranges, choose a new mapping-set identity, and provide a local custody passphrase.",
        recovery:
          "No source evidence changed and no data was sent. Preserve existing encrypted state, correct the exact reviewed plan or custody passphrase, and retry with a new mapping-set identity when creation already occurred.",
        mutates: true,
      }),
    ),
    screen(
      "PRIVACY_OUTPUT_RESTORATION",
      "Strict local output restoration",
      "Validate every AI Workspace-shaped placeholder before restoring exact mapping-owned values in bounded local output.",
      action({
        id: "inspect-pseudonymized-output",
        label: "Validate and restore locally",
        description:
          "Unlock one existing encrypted mapping and inspect one bounded local candidate output through strict whole-token validation.",
        effect:
          "Returns restored content only after complete validation; nothing is persisted, delivered, routed, authorized, or executed.",
        prerequisites:
          "Inspect the originating handoff and provide its exact mapping-set identity, local custody passphrase, and pseudonymized output.",
        recovery:
          "Preserve encrypted state, verify the originating project, Work Item, handoff, mapping identity, and passphrase, then retry without altered placeholders.",
        mutates: false,
      }),
    ),
  ],
);

function screen(
  step: GuiJourneyStep,
  title: string,
  purpose: string,
  primaryAction: GuiActionContract,
): GuiScreenContract {
  return Object.freeze({
    step,
    title,
    purpose,
    states: STATES,
    primaryAction,
    accessibility: Object.freeze({
      landmark: "main",
      focusTarget: `${step.toLowerCase().replaceAll("_", "-")}-heading`,
      statusText: "Visible text and aria-live status describe every result.",
      keyboardReachable: true,
      programmaticLabels: true,
      colorIndependent: true,
      reducedMotionSafe: true,
    }),
  });
}

export function validateGuiInteractionContracts(
  contracts: readonly GuiScreenContract[] = GUI_SCREEN_CONTRACTS,
) {
  const steps = new Set<GuiJourneyStep>();
  const actions = new Set<string>();
  for (const contract of contracts) {
    if (steps.has(contract.step))
      throw new Error("GUI screen steps must be unique.");
    steps.add(contract.step);
    const action = contract.primaryAction;
    if (actions.has(action.id))
      throw new Error("GUI action IDs must be unique.");
    actions.add(action.id);
    for (const text of [
      contract.title,
      contract.purpose,
      action.label,
      action.description,
      action.effect,
      action.prerequisites,
      action.recovery,
      action.nextAction,
      contract.accessibility.landmark,
      contract.accessibility.focusTarget,
      contract.accessibility.statusText,
    ])
      if (!text.trim())
        throw new Error("GUI contracts require complete inline guidance.");
    if (
      new Set(contract.states).size !== STATES.length ||
      STATES.some((state) => !contract.states.includes(state))
    )
      throw new Error(
        "Every GUI screen must define all required interaction states.",
      );
    if (
      !contract.accessibility.keyboardReachable ||
      !contract.accessibility.programmaticLabels ||
      !contract.accessibility.colorIndependent ||
      !contract.accessibility.reducedMotionSafe
    )
      throw new Error(
        "Every GUI screen must satisfy the accessibility baseline.",
      );
  }
  if (steps.size !== 21)
    throw new Error(
      "The GUI journey must cover every committed screen exactly once.",
    );
  return true;
}

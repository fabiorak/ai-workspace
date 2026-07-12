export type GuiJourneyStep =
  | "WELCOME"
  | "PROJECTS"
  | "IMPORT"
  | "SEARCH"
  | "EVENT"
  | "ARTIFACT"
  | "MEMORY"
  | "MEMORY_DETAIL"
  | "WORK_ITEMS"
  | "WORK_DETAIL"
  | "HANDOFF_BUILDER"
  | "HANDOFF_DETAIL";
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
      "SEARCH",
      "Search project history",
      "Find bounded canonical evidence in the selected project.",
      action({
        id: "search-evidence",
        label: "Search evidence",
        description:
          "Run literal project-scoped search with the visible query and filters.",
        effect:
          "Reads local canonical events only; no content is executed or sent over a network.",
        prerequisites:
          "Select a project and enter a search term. Import the safe sample if the project is empty.",
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
      focusTarget: `${step.toLowerCase()}-heading`,
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
  if (steps.size !== 12)
    throw new Error(
      "The first GUI journey must cover all six committed steps.",
    );
  return true;
}

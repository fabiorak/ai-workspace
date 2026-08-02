export const SUPPORTED_LOCALES = ["en", "it"] as const;
export type GuiLocale = (typeof SUPPORTED_LOCALES)[number];

const EN = {
  language: "Language",
  english: "English",
  italian: "Italiano",
  headerTagline: "Local-first control plane",
  headerPrivacy:
    "Your project data stays on this computer. This guided alpha makes no external requests.",
  skip: "Skip to the guided workflow",
  projects: "Projects",
  welcome: "Start with one local project",
  next: "Next recommended action",
  import: "Import safe sample evidence",
  search: "Search historical evidence",
  event: "Inspect canonical event",
  artifact: "Integrity-verified source evidence",
  memory: "Curate active project memory",
  memoryDetail: "Memory lifecycle and provenance",
  work: "Work Items",
  workDetail: "Work Item lifecycle",
  handoff: "Build a transparent handoff",
  handoffDetail: "Immutable handoff",
  instructions: "Preview effective instructions",
  agentProfile: "Inspect an agent and skill profile",
  context: "Preview a bounded Context Pack",
  capabilities: "Product capability map",
  dashboard: "Workspace overview",
  dashboardIntro:
    "Read-only local summary. Every value comes from an authoritative store; no telemetry or model request is used.",
  dashboardProjects: "Projects and Git attention",
  dashboardWork: "Work Item lifecycle",
  dashboardMemory: "Active memory verification",
  dashboardPrivacy: "Privacy decisions",
  dashboardDelivery: "Model delivery",
  dashboardUnavailable:
    "Unavailable: no provider delivery surface exists. Nothing can be sent.",
  navOverview: "Overview",
  navDashboard: "Dashboard",
  navWork: "Workspace",
  navProjects: "Projects",
  navEvidence: "Evidence",
  navMemory: "Active memory",
  navContinuity: "Work & handoffs",
  navPrivacy: "Privacy",
  navManage: "Manage",
  navScripts: "Scripts",
  navSoon: "Soon",
  navSettings: "Settings",
  navSystem: "System status",
  localOnly: "Local only",
  localOnlyDetail: "No telemetry or external requests",
  openMenu: "Open navigation",
  privateWorkspace: "Private workspace",
  dashboardEyebrow: "Workspace pulse",
  refreshDashboard: "Refresh overview",
  dashboardProjectsKicker: "Repository health",
  dashboardWorkKicker: "Continuity flow",
  dashboardMemoryKicker: "Knowledge quality",
  dashboardPrivacyKicker: "Decision boundary",
  dashboardBoundaryKicker: "Safety boundary",
  openProjects: "Open projects",
  openWork: "Open Work Items",
  openMemory: "Open memory",
  openPrivacy: "Open privacy center",
  settingsEyebrow: "Workspace preferences",
  settingsTitle: "Settings",
  settingsIntro:
    "Presentation preferences stay in this browser and never leave this computer.",
  appearanceTitle: "Appearance",
  appearanceBody:
    "AI Workspace follows your operating-system light or dark theme and reduced-motion preference.",
  systemManaged: "System managed",
  privacyTitle: "Local preference storage",
  privacyBody:
    "Only the language preference is stored in local browser storage. It contains no workspace content.",
  browserOnly: "Browser only",
  scriptsEyebrow: "Automation workspace",
  scriptsTitle: "Scripts",
  scriptsIntro:
    "This area is reserved for reviewed local automations when an execution contract exists.",
  scriptsUnavailable:
    "Not available yet. No script runner, command execution, scheduler, or hidden automation is active.",
  systemEyebrow: "Runtime boundaries",
  systemTitle: "System status",
  localHostTitle: "Local host",
  localHostBody:
    "Running on authenticated loopback with restrictive browser security headers.",
  storesTitle: "Authoritative stores",
  storesPending: "Coverage loads with the dashboard.",
  deliveryTitle: "Provider delivery",
  footerLocal: "Local-first, private by design",
  register: "Register this project",
  selectProject: "Select {name}",
  refreshGit: "Refresh Git inspection",
  importSample: "Import the safe sample session",
  transcripts: "Import your own Claude Code sessions",
  transcriptsIntro:
    "Name the directory that holds your Claude Code transcripts, then import one file into the selected project. Listing a directory reads names, sizes, and modification times only; no transcript is opened until you import it.",
  transcriptsTrustBody:
    "the transcript is read locally and stored as UNTRUSTED evidence. Nothing is executed and nothing is sent over a network. A record that carries high-confidence restricted data is excluded whole, counted, and never stored; if that leaves nothing to convert, the import writes nothing at all.",
  transcriptDirectory: "Transcript directory",
  transcriptDirectoryHelp:
    "Enter one existing directory. It is not searched recursively and no location is guessed.",
  transcriptDiscover: "List transcripts",
  transcriptDiscoverEffect:
    "Effect: reads file names, sizes, and modification times only. No transcript is opened.",
  transcriptStatusIdle: "Select a project, then list a transcript directory.",
  transcriptListing: "Reading file names and sizes only…",
  transcriptNone: "No .jsonl transcript was found in that directory.",
  transcriptFound: "{count} transcript file(s), newest first.",
  transcriptImport: "Import this transcript",
  transcriptImporting: "Reading and storing this transcript locally…",
  transcriptCounts:
    "Added {added}, unchanged {unchanged}, total {total}, records not converted {skipped}.",
  transcriptRestricted:
    "{count} record(s) were excluded by restricted-data screening. Their content was neither imported nor stored, and the detected value is never shown. Rotate any credential that was real.",
  transcriptNoProject: "Select a registered project first.",
  transcriptAttention: "Transcript import needs attention.",
  searchEvidence: "Search evidence",
  searchScope: "Scopes to search",
  allProjects: "All registered projects and General",
  selectedProjectOnly: "Selected project only",
  inspectEvent: "Inspect source event",
  openSource: "Open integrity-verified source",
  useMemorySource: "Use this event as memory evidence",
  backResults: "Return to search results",
  createMemory: "Create source-linked memory",
  refreshMemory: "Refresh memory list",
  inspectMemory: "Inspect memory lifecycle",
  verifyMemory: "Record one verification",
  supersedeMemory: "Supersede with replacement",
  invalidateMemory: "Invalidate this item",
  backMemory: "Return to memory list",
  createWork: "Create proposed Work Item",
  inspectWork: "Inspect Work Item lifecycle",
  activateWork: "Activate Work Item",
  blockWork: "Block Work Item",
  completeWork: "Complete Work Item",
  reopenWork: "Reopen Work Item",
  backWork: "Return to Work Items",
  previewHandoff: "Preview immutable handoff",
  createHandoff: "Create reviewed immutable handoff",
  inspectHandoff: "Inspect handoff {id}",
  validateHandoff: "Validate current Git state",
  successor: "Prepare successor",
  backHandoff: "Return to handoff builder",
  previewInstructions: "Preview instructions read-only",
  previewAgentProfile: "Inspect profile read-only",
  previewContext: "Preview Context Pack read-only",
  profileContext: "Compose profile-governed context",
  previewProfileContext: "Compose profile and Context Pack read-only",
  privacyPreflight: "Preview model privacy policy",
  previewPrivacyPreflight: "Run and record privacy preflight",
  customerAliasSuggestions: "Review exact customer/project alias suggestions",
  previewCustomerAliases: "Preview entity suggestions",
  confirmCustomerAliases: "Confirm selected current-hash ranges",
  contextSelectorReport: "Measure profile context selectors",
  previewContextSelectors: "Preview selector measurement read-only",
  noExecution:
    "Configured instruction text and precedence are descriptive. The GUI does not enforce or execute them.",
  bundlePaths: "Reviewed instruction bundle paths, one per line",
  model: "Model target (optional)",
  agent: "Agent target (optional)",
  task: "Task target (optional)",
  originalContent:
    "Imported evidence and user-authored content remain in their original language. No translation service is used.",
  loadingProjects: "Loading local projects…",
  noProjects: "No projects yet. Enter a local Git repository directory below.",
  selectedProject:
    "Project selected. Continue to evidence, memory, continuity, or instruction inspection below.",
  instructionEmpty:
    "Select a project and explicit reviewed synthetic bundle paths to preview effective instructions.",
  instructionWarning:
    "Read-only preview: nothing is persisted or executed. Configuring something here does not grant it permission to run.",
  profileWarning:
    "USER_CONFIGURED profile declarations are descriptive. They are not installed, selected, enforced, resolved, delivered, or executed and grant no runtime permission.",
  profilePath: "Reviewed schema-v1 agent profile bundle path",
  profileDigest: "Expected SHA-256 digest (optional pin)",
  profileEmpty:
    "Select a project and one explicit reviewed synthetic profile bundle to inspect agent and skill declarations.",
  profileReady:
    "Profile {name} inspected with {skills} skills: {sourceBytes} source bytes and {canonicalBytes} canonical bytes. No capability was activated.",
  previewReady:
    "Effective instruction preview ready. Nothing was persisted or executed.",
  contextWarning:
    "Schema v2 shares canonical source provenance once and uses exact UTF-8 byte budgets. The expanded preview does not persist, send, enforce, or execute anything.",
  continuityBudget: "Continuity budget (exact UTF-8 bytes)",
  instructionBudget: "Instruction budget (exact UTF-8 bytes)",
  contextBundles: "Optional reviewed instruction bundle paths, one per line",
  contextEmpty:
    "Inspect an immutable handoff, then enter explicit budgets to preview its Context Pack.",
  contextReady:
    "Context Pack schema {schema} preview ready: {entries} shared source entries use {sharedBytes} exact bytes. Review expanded logical items and omissions below.",
  profileContextWarning:
    "Explicit read-only composition: the profile supplies the agent target and exact-byte budgets. You select an allowed model and the exact reviewed instruction sources. Nothing is installed, resolved, persisted, delivered, or executed.",
  profileContextBundles:
    "Exact reviewed instruction bundle paths declared by the profile, one per line",
  profileContextModel: "Allowed model to select explicitly",
  profileContextTask: "Task target (optional explicit selector)",
  profileContextEmpty:
    "Inspect an immutable handoff, then select one profile, its exact instruction sources, and one allowed model.",
  profileContextReady:
    "Profile {profile} composed for {model}: {sources} declared sources, {rules} effective rules, Context Pack schema {schema}. Review provenance, budgets, included items, and omissions below.",
  privacyPreflightWarning:
    "Required review boundary: every included item is classified for one explicit model policy. Unknown items default to CONFIDENTIAL. Every valid decision is recorded in the separate local non-content audit before its report is returned. A reviewable outcome is neither permission nor delivery, and detection is not complete PII coverage.",
  privacyPolicyPath: "Reviewed schema-v1 model data policy path",
  privacyPolicyDigest: "Expected policy SHA-256 digest (optional pin)",
  privacyPreflightEmpty:
    "Inspect an immutable handoff, then provide one profile, its exact instruction sources, one allowed model, and one same-project model data policy.",
  privacyPreflightReady:
    "Privacy preflight {result} for {model} under policy {policy}: {allowed} allowed, {blocked} blocked, {defaulted} defaulted, {restricted} restricted. The local non-content audit was verified; nothing was sent or authorized.",
  customerAliasWarning:
    "Exact, case-sensitive customer and project aliases only. The dictionary is transient and never persisted. Every result starts as a suggestion you have not reviewed and requires individual confirmation; this is not identity proof, complete PII detection, transformation, or delivery.",
  customerAliasInput:
    "Synthetic aliases, one typed line such as CUSTOMER: Cedar Demo or PROJECT: Quartz Demo",
  customerAliasEmpty:
    "Reuse the exact privacy inputs above and enter typed transient synthetic aliases.",
  customerAliasReady:
    "{count} exact entity suggestion(s) ready. All are unselected and not reviewed.",
  customerAliasSelectOne: "Select at least one current-hash suggestion.",
  customerAliasConfirmed:
    "{count} suggestion(s) explicitly confirmed into the transient reviewed-span form. Transformation remains a separate action.",
  contextSelectorWarning:
    "Experiment only: selectors map only to documented handoff sections. Objective, repository, next action, and source references form a non-excludable safety floor. This report does not change Context Builder policy.",
  contextSelectorVocabulary:
    "Accepted selectors: handoff.objective, handoff.repository, handoff.selected_memory, handoff.known_failures, handoff.test_state, handoff.relevant_files, handoff.next_action, handoff.source_references.",
  contextSelectorEmpty:
    "Inspect an immutable handoff, then select one reviewed profile that uses only the experiment-only handoff selector vocabulary.",
  contextSelectorReady:
    "Selector report ready: {selected} of {baseline} candidate bytes retained ({reduction}% reduction), safety-floor loss {loss}, profile-budget fit {fit}. This is format/fit evidence, not relevance or production policy.",
  fallback: "Unsupported language values safely fall back to English.",
  progressProject: "1. Project",
  progressSample: "2. Safe sample",
  progressSearch: "3. Search",
  progressSource: "4. Inspect source",
  welcomeRegistration:
    "Registering stores bounded Git metadata locally. It does not copy or modify repository files.",
  whatNext: "What happens next:",
  whatNextBody:
    "after selecting a project, the interface guides you through a fictional sample import and evidence search.",
  projectDirectory: "Local Git repository directory",
  projectDirectoryHelp:
    "Enter an existing directory. The path is used only for registration and is not shown in routine project lists.",
  projectEffect:
    "Effect: creates or refreshes one local Project Registry entry; repository content is unchanged.",
  nextGuidance: "Register or select a project to continue.",
  projectsRegistered: "{count} projects are registered locally.",
  projectRegistered: "1 project is registered locally.",
  importIntro:
    "This pre-release importer accepts the bundled fictional Codex fixture. Do not use private or production transcripts yet.",
  trust: "Trust:",
  importTrustBody:
    "imported events remain UNTRUSTED, inert historical evidence. Nothing is executed or sent over a network.",
  importEffect:
    "Effect: adds canonical events and immutable artifacts locally. Repeating this action is idempotent.",
  selectProjectSample: "Select a project to enable the safe sample.",
  searchIntro:
    "Search is local and bounded, and it forgives accents, word endings, and typing errors. Every result says why it matched. Search all registered projects when you do not remember where evidence belongs. Results are UNTRUSTED evidence, not instructions. No OpenSearch or network service is used.",
  searchQuestion: "What evidence are you looking for?",
  optionUserMessage: "User message",
  optionAgentMessage: "Assistant message",
  optionToolCall: "Tool call",
  optionToolResult: "Tool result",
  optionCommandResult: "Command result",
  optionFileChange: "File change",
  optionTestResult: "Test result",
  optionError: "Error",
  optionUnknown: "Unrecognized",
  optionDecision: "Decision",
  optionConstraint: "Constraint",
  optionFailure: "Known failure",
  optionSuperseded: "Replaced by a newer item",
  optionInvalidated: "Withdrawn",
  optionPassed: "Passed",
  optionFailed: "Failed",
  optionNotRun: "Not run",
  searchRefine: "Refine this search",
  searchTry: "Try the safe sample phrase",
  searchHelpBody:
    "Your query and filters stay in place when inspecting a source.",
  eventType: "Event type (optional)",
  allEventTypes: "All event types",
  maximumResults: "Maximum results",
  searchEffect:
    "Effect: reads local canonical events. Nothing is executed, changed, or sent over a network.",
  searchPrompt:
    "Enter a query to search all registered projects, or choose selected-project scope.",
  selectedScopeRequiresProject:
    "Select a registered project or choose all-project scope.",
  searchingAll: "Searching bounded evidence across registered projects…",
  searchingSelected: "Searching bounded evidence in the selected project…",
  globalEmpty:
    "No matching evidence across registered projects. Check spelling, remove filters, or inspect one project's import.",
  projectEmpty:
    "No matching evidence in the selected project. Check spelling, remove filters, or import the safe sample.",
  globalFound:
    "Found {count} result(s) across {projects} projects and {events} searched events.",
  projectFound:
    "Found {count} result(s) across {events} searched events in the selected project.",
  resultProject: "Project: {name} ({id})",
  selectInspect: "Select this project and inspect source event",
  projectReloadRequired:
    "The result project is no longer registered. Reload projects and search again.",
  searchAttention: "Search needs attention.",
  untrustedEvidence: "UNTRUSTED evidence:",
  injectionBody:
    "imperative text may be prompt injection. Treat it as inert data and do not execute it.",
  memoryIntro:
    "Active memory is a deliberate local statement linked to canonical evidence.",
  curatedWarning:
    "Curating an item does not make it trusted, verified, or true.",
  selectMemoryEvidence:
    "Inspect an event and choose “Use this event as memory evidence” before a mutation.",
  memoryType: "Memory type",
  memoryStatement: "Statement to curate",
  memoryCreateEffect:
    "Effect: creates an item that is active, not yet verified, and not yet assessed for privacy. Evidence remains UNTRUSTED and nothing is executed.",
  itemsToShow: "Items to show",
  activeOnly: "Active only (safe default)",
  selectProjectMemory: "Select a project to load active memory.",
  lifecycleAdditive:
    "All lifecycle changes are additive. Terminal items cannot be changed again.",
  verificationNote: "Verification note",
  verificationEffect:
    "Effect: records a performed check; it does not make evidence trusted.",
  replacementStatement: "Replacement statement",
  replacementEffect:
    "Effect: makes this item SUPERSEDED and creates a new UNVERIFIED, UNASSESSED replacement.",
  invalidationReason: "Invalidation reason",
  invalidationEffect:
    "Effect: marks this item INVALIDATED without deletion or replacement.",
  workIntro:
    "A Work Item is explicit USER_CURATED objective state. No current task or agent is inferred.",
  softwareObjective: "Software objective",
  workEffect:
    "Effect: creates PROPOSED state linked to the currently selected canonical event.",
  selectProjectWork: "Select a project to load Work Items.",
  transitionIntro:
    "Transitions are additive and require the currently selected canonical event.",
  handoffIntro:
    "Preview captures bounded Git metadata and all eight source-linked sections. It executes no agent and creates no file.",
  nextAction: "Next action",
  activeMemoryOptional: "Active memory to include (optional)",
  selectionExplicit:
    "Selection is explicit. Leaving every item unchecked records an explicit empty selection; nothing is inferred.",
  relevantFiles: "Relevant files, one per line (optional)",
  testCommand: "Observed test command (optional)",
  testOutcome: "Observed test outcome",
  observedAt: "Observed at ISO timestamp (optional)",
  predecessor: "Predecessor handoff ID (optional successor)",
  untrustedSource: "UNTRUSTED source:",
  untrustedSourceBody:
    "displayed as inert bounded text after SHA-256 verification.",
  backEvent: "Return to canonical event",
  availableNow: "Available now:",
  availableBody:
    "English/Italian GUI, Projects, safe sample import, history search, source inspection, active memory, Work Items, immutable handoffs, and effective-instruction preview.",
  notActive: "Not active:",
  notActiveBody:
    "Agents, models, tools, external network, handoff evaluation, instruction enforcement, and instruction execution.",
  footer:
    "CLI is optional for automation and diagnostics. This journey does not require command knowledge or a manual.",
  readyImport: "Ready to import the fictional sample into {name}.",
  noMatchingMemory:
    "No matching memory. Curate an event or choose another validity filter.",
  noWorkItems:
    "No Work Items. Select evidence and create an explicit objective.",
  loadingMemory: "Loading bounded project memory…",
  showingMemory: "Showing {count} memory item(s).",
  showingMemoryMore:
    "Showing {count} memory item(s). More items are available.",
  memoryAttention: "Memory needs attention.",
  showingWork: "Showing {count} Work Item(s).",
  returningImport:
    "A project is selected. You can import or re-import the safe sample.",
  dashboardFocusKicker: "What to do now",
  focusFirstRunTitle: "Register your first project",
  focusFirstRunBody:
    "No project is registered, so there is nothing to summarize yet. Register one local repository and this overview fills itself in.",
  focusFirstRunAction: "Register a project",
  focusBlockedTitle: "Blocked work needs a decision",
  focusBlockedBody:
    "{count} of {total} Work Items are BLOCKED. Nothing that depends on them can move until each one is completed or reopened.",
  focusBlockedAction: "Review blocked Work Items",
  focusAttentionTitle: "Uncommitted repository changes",
  focusAttentionBody:
    "{count} of {total} registered projects have uncommitted changes. Evidence captured now describes a state that is committed nowhere.",
  focusAttentionAction: "Review projects needing attention",
  focusUnverifiedTitle: "Unverified memory is in play",
  focusUnverifiedBody:
    "{count} of {total} sampled active memory items are still UNVERIFIED. Treat them as claims until you check each one against its evidence.",
  focusUnverifiedAction: "Review active memory",
  focusClearTitle: "Nothing needs your attention",
  focusClearBody:
    "No blocked Work Item, no uncommitted repository change, and no unverified memory. Import evidence or curate memory when you are ready.",
  focusClearAction: "Open projects",
  chartProjectsDesc:
    "{clean} of {total} registered projects have a clean working tree and {attention} need attention.",
  chartProjectsEmpty: "No project is registered yet.",
  chartProjectsTotal: "projects",
  chartWorkDesc:
    "{total} Work Items: {proposed} proposed, {active} active, {blocked} blocked, {completed} completed.",
  chartWorkEmpty: "No Work Item exists yet.",
  chartWorkTotal: "Work Items",
  chartMemoryDesc:
    "{verified} of {sampled} sampled active memory items are verified and {unverified} are unverified.",
  chartMemoryEmpty: "No active memory item exists yet.",
  chartMemoryTotal: "active items",
  chartMemoryTruncated:
    "The sample is bounded: {sampled} of {active} active items were read, so this chart describes the sample and not the whole store.",
  chartPrivacyDesc:
    "{total} recorded privacy decisions: {reviewable} reviewable and {blocked} blocked.",
  chartPrivacyEmpty: "No privacy decision has been recorded yet.",
  chartPrivacyTotal: "decisions",
  legendClean: "Clean",
  legendAttention: "Needs attention",
  legendProposed: "Proposed",
  legendActive: "Active",
  legendBlocked: "Blocked",
  legendCompleted: "Completed",
  legendVerified: "Verified",
  legendUnverified: "Unverified",
  legendReviewable: "Reviewable",
  legendValue: "{value} ({share}%)",
  chartTableSummary: "Show the same numbers as a table",
  chartTableCaption: "Every dashboard chart as text.",
  chartTableMeasure: "Measure",
  chartTableGroup: "Group",
  chartTableValue: "Value",
  chartTableShare: "Share",
  dashboardCoverageText:
    "Coverage: {available} of {total} projects available; memory is limited to {memoryLimit} items and audit to {privacyLimit} events per project. Updated {updated}.",
  dashboardUpdatedStatus: "Local overview updated. Read-only.",
  dashboardAttentionStatus: "The overview needs attention.",
  dashboardChartsLoading: "Loading the local charts…",
  systemProjectCoverage:
    "Available {available} of {total} projects; {unavailable} need attention.",
  systemSnapshot: "Latest local snapshot: {updated}.",
  filterProjectsAttention:
    "Showing only the registered projects that need attention.",
  filterWorkState: "Showing only Work Items with status {state}.",
  filterClear: "Show all",
  noMatchingProjects: "No registered project matches this filter.",
  noMatchingWork: "No Work Item matches this filter.",
  // Everything below is written by the browser after a user action. It has to live in the
  // catalogue like the static copy: a message composed as a literal in the client script is
  // never translated, because the locale walk only rewrites text that is already in the page.
  detailLabel: "Technical detail: {detail}",
  projectCardSummary: "Software repository · branch {branch} · {state}",
  projectStateDirty: "uncommitted changes present",
  projectStateClean: "working tree clean",
  projectBranchDetached: "detached",
  refreshingGit: "Refreshing bounded Git metadata…",
  projectsLoadFailed:
    "The project list could not be loaded. The local store is unchanged; retry when ready.",
  registerValidating: "Validating the local Git repository…",
  projectReady: "{name} is ready. Select it to continue.",
  registerAttention:
    "This project was not registered. Correct the directory in the field below and retry; nothing was stored.",
  importRunning: "Importing the reviewed synthetic session locally…",
  importDone:
    "Synthetic canonical events and immutable artifacts were added locally. Added {added}, unchanged {unchanged}, total {total}.",
  sampleReadyGuidance:
    "The safe sample is ready. Continue with Search historical evidence.",
  importAttention:
    "The sample import did not complete. Nothing partial was stored; retry from this page.",
  auditSelectProject: "Select a project.",
  auditLoading: "Loading the verified local audit…",
  auditNoDecisions:
    "No valid preflight decision has been recorded for this project.",
  auditCount: "{count} verified event(s), newest first. Read-only.",
  auditEventSummary:
    "Work Item {work} · handoff {handoff} · model {model} · policy {policy} v{version} · allowed {allowed} · blocked {blocked}",
  auditInspect: "Inspect safe provenance",
  auditAttention:
    "The audit could not be loaded. No partial event is shown; use Refresh to retry.",
  searchNoAssociationFilter: "No association filter",
  generalShowing: "Showing {count} bounded General conversation(s).",
  generalEmpty:
    "The General Inbox is empty. Create an explicit project-free conversation above.",
  generalConversationState:
    "{count} immutable USER_MESSAGE event(s) · CONFIDENTIAL · UNVERIFIED",
  generalAppend: "Append a question here",
  generalDestination: "Destination: GENERAL · {title} · {id}",
  generalEventMetadata:
    "{occurred} · written by you on this computer · {bytes} UTF-8 bytes · SHA-256 {hash}",
  generalCopyPhrase: "Copy safe search phrase",
  generalPhrasePrepared:
    "The search phrase is ready; review it in Search before you submit it.",
  generalLinkButton: "Link to PROJECT",
  generalLinkSource:
    "Source GENERAL: {conversation} · event {event} · exact SHA-256 {hash}. The target PROJECT must be reviewed explicitly; link only.",
  generalAttention:
    "The General Inbox could not be loaded. No partial conversation is shown.",
  generalQuestionSaved:
    "The question was saved locally in GENERAL. No model was called and no answer was created.",
  generalLinkReload: "Reload the page and select an exact General event.",
  generalLinkCreated:
    "Link created: General → project {project} · {id}. The original evidence is unchanged.",
  generalLinkFailed:
    "No link was created. Reload the immutable event and the project, check for a stale hash or a duplicate, then retry. No partial link was used.",
  eventLabelType: "Type",
  eventLabelTrust: "Trust",
  eventLabelSession: "Session",
  eventLabelOccurred: "Occurred",
  eventLabelPosition: "Source position",
  eventOccurredUnknown: "Unknown",
  searchingScope: "Searching bounded canonical evidence in {scope}…",
  searchNoMatch:
    "No match in the requested scope. Try a shorter or more common word, remove the type filter, or widen the scope.",
  searchFound:
    "Found {count} result(s) after scanning {events} event(s); the global limit was applied after the scope merge.",
  restartTitle: "Carry this to another assistant",
  restartIntro:
    "A summary of this project is composed from what is already stored: the repository state, what was decided, and what you were just looking at. It is not saved anywhere and nothing is sent.",
  restartPrepare: "Prepare the summary",
  restartPreparing: "Composing the summary from local evidence…",
  restartReady:
    "Summary ready: {bytes} UTF-8 bytes. Copy it and paste it into the other assistant.",
  restartCopy: "Copy the summary",
  restartCopied: "Copied. Nothing left this computer.",
  restartOmitted: "Not included: {omissions}",
  restartAttention: "The summary could not be composed.",
  searchWhyMatched: "Why this matched",
  reasonEXACT: "“{term}” appears as you wrote it",
  reasonPREFIX: "“{term}” begins “{matched}”",
  reasonSTEM: "“{term}” and “{matched}” share a word ending",
  reasonTYPO: "“{term}” was read as “{matched}”",
  reasonGLOSSARY: "“{term}” was translated to “{matched}”",
  searchResultGeneral:
    "Source GENERAL: {conversation} · USER_AUTHORED · CONFIDENTIAL · exact SHA-256 {hash}",
  searchResultLink:
    "Target PROJECT: {project} · {actor} · {verification} · {effect} · {created} · rationale: {rationale}",
  openGeneralInbox: "Open the General Inbox",
  artifactMetadata: "{bytes} UTF-8 bytes · {trust} · {id}",
  handoffNoMemory:
    "No ACTIVE memory is available. The handoff will record an explicit empty selection.",
  memoryLabelType: "Type",
  memoryLabelCuration: "Curation",
  memoryLabelValidity: "Validity",
  memoryLabelVerification: "Verification",
  memoryLabelConfidence: "Confidence",
  memoryLabelVersion: "Version",
  memoryLabelCreated: "Created",
  memorySourceEntry: "UNTRUSTED event {event} · {type} · position {position}",
  memorySourceSelected:
    "Selected UNTRUSTED canonical event {event} as provenance for the next explicit memory action.",
  memoryNeedsEvent: "Inspect an event and select it as memory evidence first.",
  memoryCreated:
    "Created {type} as ACTIVE, UNVERIFIED, UNASSESSED USER_CURATED memory.",
  memoryNeedsEvidence:
    "Select canonical evidence before this lifecycle action.",
  workCardHeading: "{status} · version {version}",
  workLabelStatus: "Status",
  workLabelVersion: "Version",
  workLabelCreatedBy: "Created by",
  workLabelUpdated: "Updated",
  workTransition: "{from} → {to} by {actor} at {occurred}",
  workNeedsEvidence: "Inspect and select current canonical evidence first.",
  workCreateNeedsEvidence:
    "Inspect and select canonical evidence before you create a Work Item.",
  handoffPreviewReady:
    "Preview only: schema {schema} · {bytes} exact UTF-8 bytes · {sources} source reference(s). Review all eight inert sections below. No file was created.",
  handoffMatch:
    "The current bounded Git state still matches the immutable snapshot.",
  handoffDrift: "The repository has moved: {differences}. {recovery}",
  privacyAuditEventSuffix: "Audit event: {event}.",
  aliasPrefixRequired: "Prefix every alias with CUSTOMER: or PROJECT:.",
  aliasItemMissing:
    "The recomposed Context Pack no longer contains a suggested item.",
  pseudonymNeedsHandoff: "Inspect one immutable handoff first.",
  pseudonymReady:
    "Verified local round trip: schema v{schema}, {selections} reviewed selection(s), {items} transformed item(s), mapping {mapping} stored as authenticated ciphertext with passphrase-wrapped local custody. Not authorized and not delivered.",
  restorationNeedsHandoff: "Inspect the originating handoff first.",
  restorationReady:
    "Decision: {decision}; schema v{schema}; restored tokens: {tokens}; anomalies: {anomalies}. Local only, not authorized and not delivered.",
  importNoProject: "Select a registered project first.",
  selectedProjectFallback: "Selected project",
  // The shell markup carries these as `data-i18n` keys, so the reader sees one language.
  dashboardLoading: "Loading the workspace overview…",
  generalInbox: "General Inbox",
  generalDestinationLabel: "Destination: GENERAL.",
  generalNotice:
    "Local persistence only: no model request, assistant answer, tool execution, active-memory promotion, Context Pack inclusion, or delivery occurs.",
  generalIntro:
    "Questions are immutable evidence you wrote yourself, not yet verified, and CONFIDENTIAL by default. Restricted high-confidence values are blocked before persistence. Search is literal: it does not find paraphrases, typos, synonyms, or stems.",
  generalTitleLabel: "Conversation title",
  generalCreate: "Create a General conversation",
  generalCreateEffect:
    "Effect: creates one empty project-free immutable conversation; changing the project selection cannot move it.",
  generalQuestionLabel: "Question to save",
  generalSave: "Save the question in GENERAL",
  generalAppendEffect:
    "Effect: appends one local USER_MESSAGE. No assistant message is created.",
  generalLoading: "Loading bounded General conversations…",
  generalLinkHeading: "Link General evidence to a project",
  generalLinkProjectLabel: "Explicit target PROJECT",
  generalLinkRationaleLabel: "Reviewed rationale",
  generalLinkSubmit: "Create the immutable link",
  generalLinkEffect:
    "Effect: creates a link and nothing else. The General question and the project remain separate and byte-unchanged; no ownership, active memory, Work Item, permission, model, or execution is created.",
  scopeAll: "All registered projects and General",
  scopeGeneral: "General only",
  searchAssociatedLabel:
    "Associated with a project (optional, General scopes only)",
  pseudonymHeading: "Reversible privacy transformation",
  pseudonymWarning:
    "Local reviewed-span boundary: reuse the exact privacy inputs above, then bind every selection to item ID, content SHA-256, entity type, and UTF-8 byte range. Only encrypted mapping ciphertext is persisted. Source evidence is unchanged; this is not detection, permission, delivery, or execution.",
  pseudonymMappingLabel: "New mapping-set identity",
  pseudonymSelectionsLabel: "Reviewed selection JSON array",
  pseudonymSelectionsHelp:
    "Each entry carries itemId, contentSha256 as 64 lowercase hex characters, byteStart, byteEnd, and entityType. Schema v1 types: PERSON, CUSTOMER, EMAIL, BUSINESS_IDENTIFIER, OTHER. Confirming PROJECT selects schema v2 explicitly.",
  pseudonymCustodyLabel: "Local key custody",
  pseudonymCustodyOption: "Passphrase-wrapped local key",
  pseudonymPassphraseLabel: "Custody passphrase, 16–1024 UTF-8 bytes",
  pseudonymSubmit: "Transform, encrypt the mapping, and verify locally",
  pseudonymEffect:
    "Effect: generates one mapping key and stores only an immutable authenticated passphrase-wrapped schema-v1 custody envelope plus schema-v1 or explicit schema-v2 mapping ciphertext. Back up both encrypted directories and keep the passphrase offline; losing either is irrecoverable. Older v1-only software must preserve v2 ciphertext until compatible software is restored. The passphrase is cleared after every attempt.",
  pseudonymEmpty: "Run and inspect the exact privacy preflight first.",
  restorationHeading: "Strict local output restoration",
  restorationWarning:
    "Every AI Workspace-shaped placeholder is validated before any value is restored. Unknown, altered, foreign, or malformed tokens block the complete output. Candidate and restored text stay transient and local; this is not model access, response capture, permission, delivery, or execution.",
  restorationMappingLabel: "Existing mapping-set identity",
  restorationOutputLabel: "Bounded pseudonymized output",
  restorationPassphraseLabel: "Local custody passphrase",
  restorationSubmit: "Validate and restore locally",
  restorationEffect:
    "Effect: reads one existing authenticated encrypted mapping and returns restored content only after all-or-nothing validation. Nothing is persisted or sent. The passphrase is cleared after every attempt.",
  restorationEmpty:
    "Inspect the originating handoff and enter one existing mapping.",
  privacyAuditHeading: "Privacy decision audit",
  privacyAuditNotice:
    "Project-scoped, local, bounded, append-only non-content evidence. The hash chain detects internal corruption, gaps, and reordering, but cannot prove that a privileged actor did not replace or truncate the whole store.",
  privacyAuditHelp:
    "Valid preflight decisions only. No Context Pack content, item hashes, matches, paths, reports, mappings, secrets, prompts, responses, or restored output. No delete, edit, correction, export, search, or retention controls.",
  privacyAuditRefresh: "Refresh the audit",
  privacyAuditMore: "Load older events",
  accessBlockedTitle: "Access blocked",
  bootstrapUsedMessage: "This bootstrap link has already been used.",
  bootstrapUsedRecovery:
    "A bootstrap link opens one session and then expires, so nobody can replay it. Restart the local GUI process and open the new one-time URL it prints.",
  sessionMissingMessage: "This browser has no session for the local GUI.",
  sessionMissingRecovery:
    "The session lives in a cookie this browser has not received yet. Open the one-time bootstrap URL printed by the local GUI process in this same browser.",
  originBlockedMessage: "This request did not come from this machine.",
  originBlockedRecovery:
    "The GUI answers the loopback address only, so nothing on the network can reach it. Open it as http://127.0.0.1 on the port the local process printed.",
  brandLabel: "AI Workspace dashboard",
  navLabel: "Workspace",
  projectListLabel: "Registered projects",
  transcriptListLabel: "Discovered transcripts",
  generalListLabel: "General conversations",
  searchResultsLabel: "Historical evidence results",
  memoryListLabel: "Project memory items",
  privacyAuditListLabel: "Privacy decision audit events",
} as const;

export type GuiMessageKey = keyof typeof EN;
type Catalog = Readonly<Record<GuiMessageKey, string>>;

const IT = {
  language: "Lingua",
  english: "English",
  italian: "Italiano",
  headerTagline: "Piano di controllo local-first",
  headerPrivacy:
    "I dati del progetto restano su questo computer. Questa alpha guidata non effettua richieste esterne.",
  skip: "Vai al flusso guidato",
  projects: "Progetti",
  welcome: "Inizia con un progetto locale",
  next: "Prossima azione consigliata",
  import: "Importa evidenza di esempio sicura",
  search: "Cerca nelle evidenze storiche",
  event: "Esamina l'evento canonico",
  artifact: "Evidenza sorgente con integrità verificata",
  memory: "Cura la memoria attiva del progetto",
  memoryDetail: "Ciclo di vita e provenance della memoria",
  work: "Work Item",
  workDetail: "Ciclo di vita del Work Item",
  handoff: "Crea un handoff trasparente",
  handoffDetail: "Handoff immutabile",
  instructions: "Anteprima delle istruzioni effettive",
  agentProfile: "Ispeziona un profilo agente e skill",
  context: "Anteprima di un Context Pack bounded",
  capabilities: "Mappa delle funzionalità del prodotto",
  dashboard: "Panoramica del workspace",
  dashboardIntro:
    "Riepilogo locale in sola lettura. Ogni valore proviene da uno store autorevole; non usa telemetria né richieste a modelli.",
  dashboardProjects: "Progetti e attenzione Git",
  dashboardWork: "Ciclo di vita dei Work Item",
  dashboardMemory: "Verifica della memoria attiva",
  dashboardPrivacy: "Decisioni privacy",
  dashboardDelivery: "Invio ai modelli",
  dashboardUnavailable:
    "Non disponibile: non esiste alcuna superficie di invio al provider. Nulla può essere inviato.",
  navOverview: "Panoramica",
  navDashboard: "Dashboard",
  navWork: "Workspace",
  navProjects: "Progetti",
  navEvidence: "Evidenza",
  navMemory: "Memoria attiva",
  navContinuity: "Lavoro e handoff",
  navPrivacy: "Privacy",
  navManage: "Gestione",
  navScripts: "Script",
  navSoon: "Presto",
  navSettings: "Impostazioni",
  navSystem: "Stato sistema",
  localOnly: "Solo locale",
  localOnlyDetail: "Nessuna telemetria o richiesta esterna",
  openMenu: "Apri navigazione",
  privateWorkspace: "Workspace privato",
  dashboardEyebrow: "Battito del workspace",
  refreshDashboard: "Aggiorna panoramica",
  dashboardProjectsKicker: "Salute repository",
  dashboardWorkKicker: "Flusso di continuità",
  dashboardMemoryKicker: "Qualità della conoscenza",
  dashboardPrivacyKicker: "Confine decisionale",
  dashboardBoundaryKicker: "Confine di sicurezza",
  openProjects: "Apri progetti",
  openWork: "Apri Work Item",
  openMemory: "Apri memoria",
  openPrivacy: "Apri centro privacy",
  settingsEyebrow: "Preferenze del workspace",
  settingsTitle: "Impostazioni",
  settingsIntro:
    "Le preferenze di presentazione restano in questo browser e non lasciano mai il computer.",
  appearanceTitle: "Aspetto",
  appearanceBody:
    "AI Workspace segue il tema chiaro o scuro e la preferenza di movimento ridotto del sistema operativo.",
  systemManaged: "Gestito dal sistema",
  privacyTitle: "Memoria locale delle preferenze",
  privacyBody:
    "Solo la preferenza della lingua viene salvata nello storage locale del browser. Non contiene dati del workspace.",
  browserOnly: "Solo browser",
  scriptsEyebrow: "Workspace automazioni",
  scriptsTitle: "Script",
  scriptsIntro:
    "Quest'area è riservata alle automazioni locali revisionate quando esisterà un contratto di esecuzione.",
  scriptsUnavailable:
    "Non ancora disponibile. Nessun runner di script, esecuzione comandi, scheduler o automazione nascosta è attivo.",
  systemEyebrow: "Confini runtime",
  systemTitle: "Stato sistema",
  localHostTitle: "Host locale",
  localHostBody:
    "In esecuzione su loopback autenticato con header di sicurezza restrittivi.",
  storesTitle: "Store autorevoli",
  storesPending: "La copertura viene caricata con la dashboard.",
  deliveryTitle: "Invio al provider",
  footerLocal: "Local-first, privato by design",
  register: "Registra questo progetto",
  selectProject: "Seleziona {name}",
  refreshGit: "Aggiorna ispezione Git",
  importSample: "Importa la sessione di esempio sicura",
  transcripts: "Importa le tue sessioni Claude Code",
  transcriptsIntro:
    "Indica la cartella che contiene i tuoi transcript di Claude Code, poi importa un file nel progetto selezionato. Elencare una cartella legge soltanto nomi, dimensioni e date di modifica; nessun transcript viene aperto finché non lo importi.",
  transcriptsTrustBody:
    "il transcript è letto in locale e conservato come evidenza UNTRUSTED. Nulla viene eseguito e nulla viene inviato in rete. Un record che contiene dati riservati ad alta confidenza viene escluso per intero, contato e mai salvato; se così non resta nulla da convertire, l'import non scrive nulla.",
  transcriptDirectory: "Cartella dei transcript",
  transcriptDirectoryHelp:
    "Indica una cartella esistente. Non viene esplorata in modo ricorsivo e nessun percorso viene indovinato.",
  transcriptDiscover: "Elenca i transcript",
  transcriptDiscoverEffect:
    "Effetto: legge soltanto nomi, dimensioni e date di modifica dei file. Nessun transcript viene aperto.",
  transcriptStatusIdle:
    "Seleziona un progetto, poi elenca una cartella di transcript.",
  transcriptListing: "Lettura dei soli nomi e dimensioni dei file…",
  transcriptNone: "Nessun transcript .jsonl trovato in quella cartella.",
  transcriptFound: "File di transcript: {count}, dal più recente.",
  transcriptImport: "Importa questo transcript",
  transcriptImporting: "Lettura e salvataggio locale di questo transcript…",
  transcriptCounts:
    "Aggiunti: {added}, invariati: {unchanged}, totale: {total}, record non convertiti: {skipped}.",
  transcriptRestricted:
    "Record esclusi dallo screening dei dati riservati: {count}. Il loro contenuto non è stato importato né salvato e il valore rilevato non viene mai mostrato. Ruota qualunque credenziale che fosse reale.",
  transcriptNoProject: "Seleziona prima un progetto registrato.",
  transcriptAttention: "L'import del transcript richiede attenzione.",
  searchEvidence: "Cerca evidenza",
  searchScope: "Ambiti in cui cercare",
  allProjects: "Tutti i progetti registrati e General",
  selectedProjectOnly: "Solo il progetto selezionato",
  inspectEvent: "Esamina evento sorgente",
  openSource: "Apri sorgente con integrità verificata",
  useMemorySource: "Usa questo evento come evidenza della memoria",
  backResults: "Torna ai risultati della ricerca",
  createMemory: "Crea memoria collegata alla sorgente",
  refreshMemory: "Aggiorna elenco memoria",
  inspectMemory: "Esamina ciclo di vita della memoria",
  verifyMemory: "Registra una verifica",
  supersedeMemory: "Sostituisci con una nuova versione",
  invalidateMemory: "Invalida questo elemento",
  backMemory: "Torna all'elenco memoria",
  createWork: "Crea Work Item proposto",
  inspectWork: "Esamina ciclo di vita del Work Item",
  activateWork: "Attiva Work Item",
  blockWork: "Blocca Work Item",
  completeWork: "Completa Work Item",
  reopenWork: "Riapri Work Item",
  backWork: "Torna ai Work Item",
  previewHandoff: "Anteprima handoff immutabile",
  createHandoff: "Crea handoff immutabile revisionato",
  inspectHandoff: "Esamina handoff {id}",
  validateHandoff: "Valida stato Git corrente",
  successor: "Prepara successore",
  backHandoff: "Torna al builder handoff",
  previewInstructions: "Anteprima istruzioni in sola lettura",
  previewAgentProfile: "Ispeziona profilo in sola lettura",
  previewContext: "Anteprima Context Pack in sola lettura",
  profileContext: "Componi contesto governato dal profilo",
  previewProfileContext: "Componi profilo e Context Pack in sola lettura",
  privacyPreflight: "Anteprima policy privacy del modello",
  previewPrivacyPreflight: "Esegui e registra il preflight privacy",
  customerAliasSuggestions:
    "Revisiona suggerimenti alias cliente/progetto esatti",
  previewCustomerAliases: "Anteprima suggerimenti entità",
  confirmCustomerAliases: "Conferma gli intervalli current-hash selezionati",
  contextSelectorReport: "Misura i selector context del profilo",
  previewContextSelectors: "Anteprima misurazione selector in sola lettura",
  noExecution:
    "Testo e precedenza delle istruzioni configurate sono descrittivi. La GUI non li applica né li esegue.",
  bundlePaths: "Percorsi dei bundle revisionati, uno per riga",
  model: "Target modello (facoltativo)",
  agent: "Target agente (facoltativo)",
  task: "Target attività (facoltativo)",
  originalContent:
    "Evidenza importata e contenuti scritti dall'utente restano nella lingua originale. Non viene usato alcun servizio di traduzione.",
  loadingProjects: "Caricamento progetti locali…",
  noProjects:
    "Nessun progetto presente. Inserisci qui sotto una directory Git locale.",
  selectedProject:
    "Progetto selezionato. Continua con evidenza, memoria, continuità o ispezione delle istruzioni.",
  instructionEmpty:
    "Seleziona un progetto e i percorsi espliciti di bundle sintetici revisionati per vedere le istruzioni effettive.",
  instructionWarning:
    "Anteprima in sola lettura: nulla viene persistito o eseguito. Configurare qualcosa qui non concede il permesso di eseguirlo.",
  profileWarning:
    "Le dichiarazioni profilo USER_CONFIGURED sono descrittive. Non vengono installate, selezionate, applicate, risolte, consegnate o eseguite e non concedono permessi runtime.",
  profilePath: "Percorso bundle profilo agente schema v1 revisionato",
  profileDigest: "Digest SHA-256 atteso (pin facoltativo)",
  profileEmpty:
    "Seleziona un progetto e un bundle profilo sintetico revisionato esplicito per ispezionare agente e skill.",
  profileReady:
    "Profilo {name} ispezionato con {skills} skill: {sourceBytes} byte sorgente e {canonicalBytes} byte canonici. Nessuna capacità è stata attivata.",
  previewReady:
    "Anteprima delle istruzioni effettive pronta. Nulla è stato persistito o eseguito.",
  contextWarning:
    "Lo schema v2 condivide una sola volta la provenienza canonica e usa budget in byte UTF-8 esatti. L'anteprima espansa non persiste, invia, applica o esegue nulla.",
  continuityBudget: "Budget continuità (byte UTF-8 esatti)",
  instructionBudget: "Budget istruzioni (byte UTF-8 esatti)",
  contextBundles:
    "Percorsi bundle di istruzioni revisionati facoltativi, uno per riga",
  contextEmpty:
    "Esamina un handoff immutabile, poi inserisci budget espliciti per l'anteprima del Context Pack.",
  contextReady:
    "Anteprima Context Pack schema {schema} pronta: {entries} sorgenti condivise usano {sharedBytes} byte esatti. Esamina elementi logici espansi e omissioni.",
  profileContextWarning:
    "Composizione esplicita in sola lettura: il profilo fornisce target agente e budget in byte esatti. Selezioni un modello consentito e le sorgenti istruzioni revisionate esatte. Nulla viene installato, risolto, persistito, consegnato o eseguito.",
  profileContextBundles:
    "Percorsi esatti dei bundle istruzioni revisionati dichiarati dal profilo, uno per riga",
  profileContextModel: "Modello consentito da selezionare esplicitamente",
  profileContextTask: "Target attività (selettore esplicito facoltativo)",
  profileContextEmpty:
    "Esamina un handoff immutabile, poi seleziona un profilo, le sue sorgenti istruzioni esatte e un modello consentito.",
  profileContextReady:
    "Profilo {profile} composto per {model}: {sources} sorgenti dichiarate, {rules} regole effettive, Context Pack schema {schema}. Esamina provenance, budget, elementi inclusi e omissioni.",
  privacyPreflightWarning:
    "Boundary di revisione obbligatorio: ogni elemento incluso viene classificato per una policy modello esplicita. Gli elementi sconosciuti diventano CONFIDENTIAL. Ogni decisione valida viene registrata nell'audit locale separato e senza contenuto prima di restituire il report. REVIEWABLE_NOT_AUTHORIZED non è permesso o consegna e il rilevamento non copre tutta la PII.",
  privacyPolicyPath: "Percorso policy dati modello schema v1 revisionata",
  privacyPolicyDigest: "Digest SHA-256 atteso della policy (pin facoltativo)",
  privacyPreflightEmpty:
    "Esamina un handoff immutabile, poi fornisci un profilo, le sue sorgenti istruzioni esatte, un modello consentito e una policy dati modello dello stesso progetto.",
  privacyPreflightReady:
    "Preflight privacy {result} per {model} con policy {policy}: consentiti {allowed}, bloccati {blocked}, predefiniti {defaulted}, restricted {restricted}. L'audit locale senza contenuto è stato verificato; nulla è stato inviato o autorizzato.",
  customerAliasWarning:
    "Solo alias di cliente e progetto esatti e sensibili alle maiuscole. Il dizionario è transitorio e non viene mai persistito. Ogni risultato nasce come suggerimento non ancora rivisto e richiede conferma individuale; non è prova d'identità, rilevamento PII completo, trasformazione o consegna.",
  customerAliasInput:
    "Alias sintetici, una riga tipizzata come CUSTOMER: Cedar Demo o PROJECT: Quartz Demo",
  customerAliasEmpty:
    "Riusa gli input privacy esatti sopra e inserisci alias sintetici transitori tipizzati.",
  customerAliasReady:
    "Suggerimenti entità esatti pronti: {count}. Sono tutti deselezionati e non revisionati.",
  customerAliasSelectOne: "Seleziona almeno un suggerimento current-hash.",
  customerAliasConfirmed:
    "Suggerimenti confermati esplicitamente nel form transitorio degli span revisionati: {count}. La trasformazione resta un'azione separata.",
  contextSelectorWarning:
    "Solo esperimento: i selector mappano esclusivamente sezioni handoff documentate. Obiettivo, repository, prossima azione e riferimenti sorgente formano un safety floor non escludibile. Il report non cambia la policy del Context Builder.",
  contextSelectorVocabulary:
    "Selector accettati: handoff.objective, handoff.repository, handoff.selected_memory, handoff.known_failures, handoff.test_state, handoff.relevant_files, handoff.next_action, handoff.source_references.",
  contextSelectorEmpty:
    "Esamina un handoff immutabile, poi seleziona un profilo revisionato che usa solo il vocabolario sperimentale dei selector handoff.",
  contextSelectorReady:
    "Report selector pronto: mantenuti {selected} di {baseline} byte candidati (riduzione {reduction}%), perdita safety floor {loss}, fit sul budget profilo {fit}. È evidenza di formato/fit, non rilevanza o policy di produzione.",
  fallback: "I valori lingua non supportati usano in sicurezza l'inglese.",
  progressProject: "1. Progetto",
  progressSample: "2. Esempio sicuro",
  progressSearch: "3. Ricerca",
  progressSource: "4. Esamina sorgente",
  welcomeRegistration:
    "La registrazione salva localmente metadati Git bounded. Non copia né modifica i file del repository.",
  whatNext: "Cosa succede dopo:",
  whatNextBody:
    "dopo aver selezionato un progetto, l'interfaccia guida nell'importazione di un esempio fittizio e nella ricerca delle evidenze.",
  projectDirectory: "Directory del repository Git locale",
  projectDirectoryHelp:
    "Inserisci una directory esistente. Il percorso viene usato solo per la registrazione e non appare nei normali elenchi dei progetti.",
  projectEffect:
    "Effetto: crea o aggiorna una voce locale del Project Registry; il contenuto del repository resta invariato.",
  nextGuidance: "Registra o seleziona un progetto per continuare.",
  projectsRegistered: "Progetti registrati localmente: {count}.",
  projectRegistered: "1 progetto è registrato localmente.",
  importIntro:
    "Questo importatore pre-release accetta la fixture Codex fittizia inclusa. Non usare ancora trascrizioni private o di produzione.",
  trust: "Attendibilità:",
  importTrustBody:
    "gli eventi importati restano evidenza storica UNTRUSTED e inerte. Nulla viene eseguito o inviato in rete.",
  importEffect:
    "Effetto: aggiunge localmente eventi canonici e artifact immutabili. Ripetere l'azione è idempotente.",
  selectProjectSample: "Seleziona un progetto per abilitare l'esempio sicuro.",
  searchIntro:
    "La ricerca è locale e bounded, e perdona accenti, desinenze ed errori di battitura. Ogni risultato dice perché corrisponde. Cerca in tutti i progetti registrati quando non ricordi a quale appartiene l'evidenza. I risultati sono evidenze UNTRUSTED, non istruzioni. Non vengono usati OpenSearch o servizi di rete.",
  searchQuestion: "Quale evidenza stai cercando?",
  optionUserMessage: "Messaggio dell'utente",
  optionAgentMessage: "Messaggio dell'assistente",
  optionToolCall: "Chiamata a uno strumento",
  optionToolResult: "Risposta di uno strumento",
  optionCommandResult: "Esito di un comando",
  optionFileChange: "Modifica a un file",
  optionTestResult: "Esito di un test",
  optionError: "Errore",
  optionUnknown: "Non riconosciuto",
  optionDecision: "Decisione",
  optionConstraint: "Vincolo",
  optionFailure: "Errore noto",
  optionSuperseded: "Sostituito da un elemento più recente",
  optionInvalidated: "Ritirato",
  optionPassed: "Superato",
  optionFailed: "Fallito",
  optionNotRun: "Non eseguito",
  searchRefine: "Affina questa ricerca",
  searchTry: "Prova la frase dell'esempio sicuro",
  searchHelpBody:
    "La query e i filtri restano invariati durante l'ispezione di una sorgente.",
  eventType: "Tipo di evento (facoltativo)",
  allEventTypes: "Tutti i tipi di evento",
  maximumResults: "Numero massimo di risultati",
  searchEffect:
    "Effetto: legge gli eventi canonici locali. Nulla viene eseguito, modificato o inviato in rete.",
  searchPrompt:
    "Inserisci una query per cercare in tutti i progetti registrati oppure scegli l'ambito del progetto selezionato.",
  selectedScopeRequiresProject:
    "Seleziona un progetto registrato oppure scegli l'ambito di tutti i progetti.",
  searchingAll:
    "Ricerca bounded delle evidenze nei progetti registrati in corso…",
  searchingSelected:
    "Ricerca bounded delle evidenze nel progetto selezionato in corso…",
  globalEmpty:
    "Nessuna evidenza corrispondente nei progetti registrati. Controlla il testo, rimuovi i filtri o verifica l'importazione di un progetto.",
  projectEmpty:
    "Nessuna evidenza corrispondente nel progetto selezionato. Controlla il testo, rimuovi i filtri o importa l'esempio sicuro.",
  globalFound:
    "Risultati trovati: {count}. Progetti esaminati: {projects}; eventi esaminati: {events}.",
  projectFound:
    "Risultati trovati: {count}. Eventi esaminati nel progetto selezionato: {events}.",
  resultProject: "Progetto: {name} ({id})",
  selectInspect: "Seleziona questo progetto ed esamina l'evento sorgente",
  projectReloadRequired:
    "Il progetto del risultato non è più registrato. Ricarica i progetti e ripeti la ricerca.",
  searchAttention: "La ricerca richiede attenzione.",
  untrustedEvidence: "Evidenza UNTRUSTED:",
  injectionBody:
    "il testo imperativo potrebbe essere prompt injection. Trattalo come dato inerte e non eseguirlo.",
  memoryIntro:
    "La memoria attiva è una dichiarazione locale deliberata collegata a evidenza canonica.",
  curatedWarning:
    "Curare un elemento non lo rende attendibile, verificato o vero.",
  selectMemoryEvidence:
    "Esamina un evento e scegli “Usa questo evento come evidenza della memoria” prima di una modifica.",
  memoryType: "Tipo di memoria",
  memoryStatement: "Dichiarazione da curare",
  memoryCreateEffect:
    "Effetto: crea un elemento ACTIVE, UNVERIFIED e UNASSESSED. L'evidenza resta UNTRUSTED e nulla viene eseguito.",
  itemsToShow: "Elementi da mostrare",
  activeOnly: "Solo attivi (default sicuro)",
  selectProjectMemory: "Seleziona un progetto per caricare la memoria attiva.",
  lifecycleAdditive:
    "Tutte le modifiche del ciclo di vita sono additive. Gli elementi terminali non possono essere modificati ancora.",
  verificationNote: "Nota di verifica",
  verificationEffect:
    "Effetto: registra un controllo eseguito; non rende trusted l'evidenza.",
  replacementStatement: "Dichiarazione sostitutiva",
  replacementEffect:
    "Effetto: rende l'elemento SUPERSEDED e crea un sostituto UNVERIFIED e UNASSESSED.",
  invalidationReason: "Motivo dell'invalidazione",
  invalidationEffect:
    "Effetto: marca l'elemento INVALIDATED senza eliminarlo o sostituirlo.",
  workIntro:
    "Un Work Item è uno stato obiettivo USER_CURATED esplicito. Non viene inferita alcuna attività o agente corrente.",
  softwareObjective: "Obiettivo software",
  workEffect:
    "Effetto: crea uno stato PROPOSED collegato all'evento canonico selezionato.",
  selectProjectWork: "Seleziona un progetto per caricare i Work Item.",
  transitionIntro:
    "Le transizioni sono additive e richiedono l'evento canonico selezionato.",
  handoffIntro:
    "L'anteprima acquisisce metadati Git bounded e tutte le otto sezioni source-linked. Non esegue agenti e non crea file.",
  nextAction: "Prossima azione",
  activeMemoryOptional: "Memoria attiva da includere (facoltativa)",
  selectionExplicit:
    "La selezione è esplicita. Lasciare tutto deselezionato registra una selezione vuota esplicita; nulla viene inferito.",
  relevantFiles: "File rilevanti, uno per riga (facoltativi)",
  testCommand: "Comando di test osservato (facoltativo)",
  testOutcome: "Esito del test osservato",
  observedAt: "Osservato al timestamp ISO (facoltativo)",
  predecessor: "ID handoff predecessore (successore facoltativo)",
  untrustedSource: "Sorgente UNTRUSTED:",
  untrustedSourceBody:
    "mostrata come testo inerte bounded dopo la verifica SHA-256.",
  backEvent: "Torna all'evento canonico",
  availableNow: "Disponibile ora:",
  availableBody:
    "GUI inglese/italiano, Progetti, import esempio sicuro, ricerca storica, ispezione sorgente, memoria attiva, Work Item, handoff immutabili e anteprima effective instruction.",
  notActive: "Non attivo:",
  notActiveBody:
    "Agenti, modelli, strumenti, rete esterna, valutazione handoff, enforcement ed esecuzione delle istruzioni.",
  footer:
    "La CLI è facoltativa per automazione e diagnostica. Questo percorso non richiede comandi o un manuale.",
  readyImport: "Pronto a importare l'esempio fittizio in {name}.",
  noMatchingMemory:
    "Nessuna memoria corrispondente. Cura un evento o scegli un altro filtro di validità.",
  noWorkItems:
    "Nessun Work Item. Seleziona un'evidenza e crea un obiettivo esplicito.",
  loadingMemory: "Caricamento della memoria bounded del progetto…",
  showingMemory: "Elementi di memoria visualizzati: {count}.",
  showingMemoryMore:
    "Elementi di memoria visualizzati: {count}. Sono disponibili altri elementi.",
  memoryAttention: "La memoria richiede attenzione.",
  showingWork: "Work Item visualizzati: {count}.",
  returningImport:
    "È selezionato un progetto. Puoi importare o reimportare l'esempio sicuro.",
  dashboardFocusKicker: "Cosa fare adesso",
  focusFirstRunTitle: "Registra il tuo primo progetto",
  focusFirstRunBody:
    "Nessun progetto è registrato, quindi non c'è ancora nulla da riassumere. Registra un repository locale e questa panoramica si popola da sé.",
  focusFirstRunAction: "Registra un progetto",
  focusBlockedTitle: "Il lavoro bloccato richiede una decisione",
  focusBlockedBody:
    "Work Item in stato BLOCKED: {count} su {total}. Nulla che dipenda da loro può avanzare finché ciascuno non viene completato o riaperto.",
  focusBlockedAction: "Esamina i Work Item bloccati",
  focusAttentionTitle: "Modifiche non committate nel repository",
  focusAttentionBody:
    "Progetti registrati con modifiche non committate: {count} su {total}. L'evidenza raccolta adesso descrive uno stato che non è committato da nessuna parte.",
  focusAttentionAction: "Esamina i progetti che richiedono attenzione",
  focusUnverifiedTitle: "È in uso memoria non verificata",
  focusUnverifiedBody:
    "Elementi di memoria attiva campionati ancora UNVERIFIED: {count} su {total}. Trattali come affermazioni finché non li verifichi ciascuno rispetto alla sua evidenza.",
  focusUnverifiedAction: "Esamina la memoria attiva",
  focusClearTitle: "Nulla richiede la tua attenzione",
  focusClearBody:
    "Nessun Work Item bloccato, nessuna modifica non committata e nessuna memoria non verificata. Importa evidenza o cura la memoria quando vuoi.",
  focusClearAction: "Apri i progetti",
  chartProjectsDesc:
    "Progetti registrati con working tree pulito: {clean} su {total}; richiedono attenzione: {attention}.",
  chartProjectsEmpty: "Nessun progetto è ancora registrato.",
  chartProjectsTotal: "progetti",
  chartWorkDesc:
    "Work Item in totale: {total}; proposti {proposed}, attivi {active}, bloccati {blocked}, completati {completed}.",
  chartWorkEmpty: "Non esiste ancora nessun Work Item.",
  chartWorkTotal: "Work Item",
  chartMemoryDesc:
    "Elementi di memoria attiva campionati verificati: {verified} su {sampled}; non verificati: {unverified}.",
  chartMemoryEmpty: "Non esiste ancora nessun elemento di memoria attiva.",
  chartMemoryTotal: "elementi attivi",
  chartMemoryTruncated:
    "Il campione è limitato: elementi attivi letti {sampled} su {active}, quindi questo grafico descrive il campione e non tutto lo store.",
  chartPrivacyDesc:
    "Decisioni privacy registrate: {total}; rivedibili {reviewable}, bloccate {blocked}.",
  chartPrivacyEmpty: "Nessuna decisione privacy è ancora stata registrata.",
  chartPrivacyTotal: "decisioni",
  legendClean: "Pulito",
  legendAttention: "Richiede attenzione",
  legendProposed: "Proposti",
  legendActive: "Attivi",
  legendBlocked: "Bloccati",
  legendCompleted: "Completati",
  legendVerified: "Verificati",
  legendUnverified: "Non verificati",
  legendReviewable: "Rivedibili",
  legendValue: "{value} ({share}%)",
  chartTableSummary: "Mostra gli stessi numeri come tabella",
  chartTableCaption: "Ogni grafico della dashboard in forma testuale.",
  chartTableMeasure: "Misura",
  chartTableGroup: "Gruppo",
  chartTableValue: "Valore",
  chartTableShare: "Quota",
  dashboardCoverageText:
    "Copertura: progetti disponibili {available} su {total}; la memoria è limitata a {memoryLimit} elementi e l'audit a {privacyLimit} eventi per progetto. Aggiornato {updated}.",
  dashboardUpdatedStatus: "Panoramica locale aggiornata. Sola lettura.",
  dashboardAttentionStatus: "La panoramica richiede attenzione.",
  dashboardChartsLoading: "Caricamento dei grafici locali…",
  systemProjectCoverage:
    "Progetti disponibili: {available} su {total}; richiedono attenzione: {unavailable}.",
  systemSnapshot: "Ultimo snapshot locale: {updated}.",
  filterProjectsAttention:
    "Sono mostrati solo i progetti registrati che richiedono attenzione.",
  filterWorkState: "Sono mostrati solo i Work Item con stato {state}.",
  filterClear: "Mostra tutto",
  noMatchingProjects: "Nessun progetto registrato corrisponde a questo filtro.",
  noMatchingWork: "Nessun Work Item corrisponde a questo filtro.",
  detailLabel: "Dettaglio tecnico: {detail}",
  projectCardSummary: "Repository software · branch {branch} · {state}",
  projectStateDirty: "modifiche non committate presenti",
  projectStateClean: "working tree pulito",
  projectBranchDetached: "detached",
  refreshingGit: "Aggiornamento dei metadati Git bounded…",
  projectsLoadFailed:
    "Non è stato possibile caricare l'elenco dei progetti. Lo store locale è invariato; riprova quando vuoi.",
  registerValidating: "Verifica del repository Git locale…",
  projectReady: "{name} è pronto. Selezionalo per continuare.",
  registerAttention:
    "Il progetto non è stato registrato. Correggi la directory nel campo qui sotto e riprova; non è stato salvato nulla.",
  importRunning: "Importazione locale della sessione sintetica revisionata…",
  importDone:
    "Eventi canonici sintetici e artifact immutabili aggiunti localmente. Aggiunti: {added}, invariati: {unchanged}, totale: {total}.",
  sampleReadyGuidance:
    "L'esempio sicuro è pronto. Prosegui con Cerca nelle evidenze storiche.",
  importAttention:
    "L'importazione dell'esempio non è stata completata. Non è stato salvato nulla di parziale; riprova da questa pagina.",
  auditSelectProject: "Seleziona un progetto.",
  auditLoading: "Caricamento dell'audit locale verificato…",
  auditNoDecisions:
    "Nessuna decisione preflight valida è stata registrata per questo progetto.",
  auditCount: "Eventi verificati: {count}, dal più recente. Sola lettura.",
  auditEventSummary:
    "Work Item {work} · handoff {handoff} · modello {model} · policy {policy} v{version} · consentiti {allowed} · bloccati {blocked}",
  auditInspect: "Ispeziona la provenienza sicura",
  auditAttention:
    "Non è stato possibile caricare l'audit. Non viene mostrato alcun evento parziale; usa Aggiorna per riprovare.",
  searchNoAssociationFilter: "Nessun filtro di associazione",
  generalShowing: "Conversazioni General bounded mostrate: {count}.",
  generalEmpty:
    "La Posta generale è vuota. Crea qui sopra una conversazione esplicita senza progetto.",
  generalConversationState:
    "Eventi USER_MESSAGE immutabili: {count} · CONFIDENTIAL · UNVERIFIED",
  generalAppend: "Aggiungi qui una domanda",
  generalDestination: "Destinazione: GENERAL · {title} · {id}",
  generalEventMetadata:
    "{occurred} · scritto da te su questo computer · {bytes} byte UTF-8 · SHA-256 {hash}",
  generalCopyPhrase: "Copia la frase di ricerca sicura",
  generalPhrasePrepared:
    "La frase di ricerca è pronta; controllala in Cerca prima di inviarla.",
  generalLinkButton: "Collega a un PROJECT",
  generalLinkSource:
    "Sorgente GENERAL: {conversation} · evento {event} · SHA-256 esatto {hash}. Il PROJECT di destinazione va revisionato esplicitamente; solo collegamento.",
  generalAttention:
    "Non è stato possibile caricare la Posta generale. Non viene mostrata alcuna conversazione parziale.",
  generalQuestionSaved:
    "La domanda è stata salvata localmente in GENERAL. Nessun modello è stato chiamato e nessuna risposta è stata creata.",
  generalLinkReload: "Ricarica la pagina e seleziona un evento General esatto.",
  generalLinkCreated:
    "Collegamento creato: Posta generale → progetto {project} · {id}. L'evidenza originale è invariata.",
  generalLinkFailed:
    "Nessun collegamento è stato creato. Ricarica l'evento immutabile e il progetto, controlla se l'hash è obsoleto o duplicato, poi riprova. Nessun collegamento parziale è stato usato.",
  eventLabelType: "Tipo",
  eventLabelTrust: "Attendibilità",
  eventLabelSession: "Sessione",
  eventLabelOccurred: "Avvenuto",
  eventLabelPosition: "Posizione nella sorgente",
  eventOccurredUnknown: "Sconosciuto",
  searchingScope: "Ricerca di evidenza canonica bounded in {scope}…",
  searchNoMatch:
    "Nessuna corrispondenza nell'ambito richiesto. Prova una parola più corta o più comune, togli il filtro sul tipo, oppure allarga l'ambito.",
  searchFound:
    "Risultati trovati: {count}. Eventi esaminati: {events}. Il limite globale è stato applicato dopo l'unione degli ambiti.",
  restartTitle: "Porta questo a un altro assistente",
  restartIntro:
    "Il riepilogo di questo progetto viene composto da ciò che è già memorizzato: lo stato del repository, ciò che è stato deciso e ciò che stavi guardando. Non viene salvato da nessuna parte e non viene inviato nulla.",
  restartPrepare: "Prepara il riepilogo",
  restartPreparing: "Composizione del riepilogo dalle evidenze locali…",
  restartReady:
    "Riepilogo pronto: {bytes} byte UTF-8. Copialo e incollalo nell'altro assistente.",
  restartCopy: "Copia il riepilogo",
  restartCopied: "Copiato. Non è uscito nulla da questo computer.",
  restartOmitted: "Non incluso: {omissions}",
  restartAttention: "Non è stato possibile comporre il riepilogo.",
  searchWhyMatched: "Perché corrisponde",
  reasonEXACT: "«{term}» compare come l'hai scritto",
  reasonPREFIX: "«{term}» è l'inizio di «{matched}»",
  reasonSTEM: "«{term}» e «{matched}» hanno la stessa radice",
  reasonTYPO: "«{term}» è stato letto come «{matched}»",
  reasonGLOSSARY: "«{term}» è stato tradotto in «{matched}»",
  searchResultGeneral:
    "Sorgente GENERAL: {conversation} · USER_AUTHORED · CONFIDENTIAL · SHA-256 esatto {hash}",
  searchResultLink:
    "PROJECT di destinazione: {project} · {actor} · {verification} · {effect} · {created} · motivazione: {rationale}",
  openGeneralInbox: "Apri la Posta generale",
  artifactMetadata: "{bytes} byte UTF-8 · {trust} · {id}",
  handoffNoMemory:
    "Nessuna memoria ACTIVE disponibile. L'handoff registrerà una selezione vuota esplicita.",
  memoryLabelType: "Tipo",
  memoryLabelCuration: "Curatela",
  memoryLabelValidity: "Validità",
  memoryLabelVerification: "Verifica",
  memoryLabelConfidence: "Confidenza",
  memoryLabelVersion: "Versione",
  memoryLabelCreated: "Creata",
  memorySourceEntry: "Evento UNTRUSTED {event} · {type} · posizione {position}",
  memorySourceSelected:
    "Selezionato l'evento canonico UNTRUSTED {event} come provenienza per la prossima azione esplicita sulla memoria.",
  memoryNeedsEvent:
    "Prima esamina un evento e selezionalo come evidenza per la memoria.",
  memoryCreated:
    "Creata {type} come memoria ACTIVE, UNVERIFIED, UNASSESSED, USER_CURATED.",
  memoryNeedsEvidence:
    "Seleziona un'evidenza canonica prima di questa azione di ciclo di vita.",
  workCardHeading: "{status} · versione {version}",
  workLabelStatus: "Stato",
  workLabelVersion: "Versione",
  workLabelCreatedBy: "Creato da",
  workLabelUpdated: "Aggiornato",
  workTransition: "{from} → {to} da {actor} il {occurred}",
  workNeedsEvidence: "Prima esamina e seleziona l'evidenza canonica corrente.",
  workCreateNeedsEvidence:
    "Esamina e seleziona un'evidenza canonica prima di creare un Work Item.",
  handoffPreviewReady:
    "Solo anteprima: schema {schema} · {bytes} byte UTF-8 esatti · {sources} riferimenti a sorgenti. Rivedi tutte e otto le sezioni inerti qui sotto. Nessun file è stato creato.",
  handoffMatch:
    "Lo stato Git bounded corrente corrisponde ancora allo snapshot immutabile.",
  handoffDrift: "The repository has moved: {differences}. {recovery}",
  privacyAuditEventSuffix: "Evento di audit: {event}.",
  aliasPrefixRequired: "Usa il prefisso CUSTOMER: o PROJECT: per ogni alias.",
  aliasItemMissing:
    "Il Context Pack ricomposto non contiene più un elemento suggerito.",
  pseudonymNeedsHandoff: "Esamina prima un handoff immutabile.",
  pseudonymReady:
    "Round trip locale verificato: schema v{schema}, selezioni revisionate: {selections}, elementi trasformati: {items}, mapping {mapping} salvato come ciphertext autenticato con custodia locale protetta da passphrase. Non autorizzato e non inviato.",
  restorationNeedsHandoff: "Esamina prima l'handoff di origine.",
  restorationReady:
    "Decisione: {decision}; schema v{schema}; token ripristinati: {tokens}; anomalie: {anomalies}. Solo locale, non autorizzato e non inviato.",
  importNoProject: "Seleziona prima un progetto registrato.",
  selectedProjectFallback: "Progetto selezionato",
  dashboardLoading: "Caricamento della panoramica del workspace…",
  generalInbox: "Posta generale",
  generalDestinationLabel: "Destinazione: GENERAL.",
  generalNotice:
    "Solo persistenza locale: nessuna richiesta a un modello, nessuna risposta dell'assistente, nessuna esecuzione di strumenti, nessuna promozione a memoria attiva, nessuna inclusione nel Context Pack e nessun invio.",
  generalIntro:
    "Le domande sono evidenza immutabile scritta da te, non ancora verificata, e CONFIDENTIAL per impostazione predefinita. I valori riservati ad alta confidenza vengono bloccati prima della persistenza. La ricerca è letterale: non trova parafrasi, refusi, sinonimi o radici di parola.",
  generalTitleLabel: "Titolo della conversazione",
  generalCreate: "Crea una conversazione General",
  generalCreateEffect:
    "Effetto: crea una conversazione immutabile vuota e senza progetto; cambiare progetto selezionato non può spostarla.",
  generalQuestionLabel: "Domanda da salvare",
  generalSave: "Salva la domanda in GENERAL",
  generalAppendEffect:
    "Effetto: aggiunge un solo USER_MESSAGE locale. Nessun messaggio dell'assistente viene creato.",
  generalLoading: "Caricamento delle conversazioni General bounded…",
  generalLinkHeading: "Collega evidenza General a un progetto",
  generalLinkProjectLabel: "PROJECT di destinazione esplicito",
  generalLinkRationaleLabel: "Motivazione revisionata",
  generalLinkSubmit: "Crea il collegamento immutabile",
  generalLinkEffect:
    "Effetto: crea un collegamento e nient'altro. La domanda generale e il progetto restano separati e invariati byte per byte; non vengono creati proprietà, memoria attiva, Work Item, permessi, modelli o esecuzioni.",
  scopeAll: "Tutti i progetti registrati e General",
  scopeGeneral: "Solo General",
  searchAssociatedLabel:
    "Associata a un progetto (facoltativo, solo ambiti General)",
  pseudonymHeading: "Trasformazione privacy reversibile",
  pseudonymWarning:
    "Boundary locale a intervalli revisionati: riusa gli stessi input privacy qui sopra, poi vincola ogni selezione a ID elemento, SHA-256 del contenuto, tipo di entità e intervallo di byte UTF-8. Viene salvato solo il ciphertext cifrato del mapping. L'evidenza di origine resta invariata; non si tratta di rilevamento, autorizzazione, invio o esecuzione.",
  pseudonymMappingLabel: "Identità del nuovo mapping set",
  pseudonymSelectionsLabel: "Array JSON delle selezioni revisionate",
  pseudonymSelectionsHelp:
    "Ogni voce contiene itemId, contentSha256 come 64 caratteri esadecimali minuscoli, byteStart, byteEnd e entityType. Tipi dello schema v1: PERSON, CUSTOMER, EMAIL, BUSINESS_IDENTIFIER, OTHER. Confermare PROJECT seleziona esplicitamente lo schema v2.",
  pseudonymCustodyLabel: "Custodia locale della chiave",
  pseudonymCustodyOption: "Chiave locale protetta da passphrase",
  pseudonymPassphraseLabel: "Passphrase di custodia, 16–1024 byte UTF-8",
  pseudonymSubmit: "Trasforma, cifra il mapping e verifica localmente",
  pseudonymEffect:
    "Effetto: genera una chiave di mapping e salva solo una busta di custodia schema v1 immutabile, autenticata e protetta da passphrase, più il ciphertext del mapping schema v1 o esplicitamente v2. Fai il backup di entrambe le directory cifrate e conserva la passphrase offline; perdere una delle due è irrecuperabile. Il software che conosce solo la v1 deve preservare il ciphertext v2 finché non viene ripristinato software compatibile. La passphrase viene cancellata dopo ogni tentativo.",
  pseudonymEmpty: "Esegui e ispeziona prima il preflight privacy esatto.",
  restorationHeading: "Ripristino locale rigoroso dell'output",
  restorationWarning:
    "Ogni segnaposto nel formato di AI Workspace viene validato prima di ripristinare qualsiasi valore. Token sconosciuti, alterati, estranei o malformati bloccano l'intero output. Il testo candidato e quello ripristinato restano transitori e locali; non si tratta di accesso al modello, cattura di risposte, autorizzazione, invio o esecuzione.",
  restorationMappingLabel: "Identità del mapping set esistente",
  restorationOutputLabel: "Output pseudonimizzato bounded",
  restorationPassphraseLabel: "Passphrase di custodia locale",
  restorationSubmit: "Valida e ripristina localmente",
  restorationEffect:
    "Effetto: legge un mapping cifrato e autenticato già esistente e restituisce il contenuto ripristinato solo dopo una validazione tutto-o-niente. Non viene salvato né inviato nulla. La passphrase viene cancellata dopo ogni tentativo.",
  restorationEmpty:
    "Ispeziona l'handoff di origine e inserisci un mapping esistente.",
  privacyAuditHeading: "Audit delle decisioni privacy",
  privacyAuditNotice:
    "Evidenza locale, bounded, append-only, senza contenuto e limitata al progetto. La catena di hash rileva corruzione interna, buchi e riordini, ma non può dimostrare che un attore privilegiato non abbia sostituito o troncato l'intero store.",
  privacyAuditHelp:
    "Solo decisioni preflight valide. Nessun contenuto del Context Pack, hash di elementi, corrispondenze, percorsi, report, mapping, segreti, prompt, risposte o output ripristinato. Nessun controllo di cancellazione, modifica, correzione, esportazione, ricerca o retention.",
  privacyAuditRefresh: "Aggiorna l'audit",
  privacyAuditMore: "Carica eventi precedenti",
  accessBlockedTitle: "Accesso bloccato",
  bootstrapUsedMessage: "Questo link di avvio è già stato usato.",
  bootstrapUsedRecovery:
    "Un link di avvio apre una sola sessione e poi scade, così nessuno può riutilizzarlo. Riavvia il processo locale della GUI e apri il nuovo URL monouso che stampa.",
  sessionMissingMessage:
    "Questo browser non ha una sessione per la GUI locale.",
  sessionMissingRecovery:
    "La sessione vive in un cookie che questo browser non ha ancora ricevuto. Apri in questo stesso browser l'URL di avvio monouso stampato dal processo locale della GUI.",
  originBlockedMessage: "Questa richiesta non proviene da questa macchina.",
  originBlockedRecovery:
    "La GUI risponde solo all'indirizzo di loopback, così nulla dalla rete può raggiungerla. Aprila come http://127.0.0.1 sulla porta stampata dal processo locale.",
  brandLabel: "Panoramica di AI Workspace",
  navLabel: "Workspace",
  projectListLabel: "Progetti registrati",
  transcriptListLabel: "Transcript trovati",
  generalListLabel: "Conversazioni General",
  searchResultsLabel: "Risultati delle evidenze storiche",
  memoryListLabel: "Elementi di memoria del progetto",
  privacyAuditListLabel: "Eventi di audit delle decisioni privacy",
} as const satisfies Catalog;

export const GUI_CATALOGS: Readonly<Record<GuiLocale, Catalog>> = Object.freeze(
  {
    en: Object.freeze(EN),
    it: Object.freeze(IT),
  },
);

export function resolveGuiLocale(
  explicit: string | null | undefined,
  browserLanguages: readonly string[] = [],
): GuiLocale {
  for (const candidate of [explicit, ...browserLanguages]) {
    const locale = candidate?.trim().toLowerCase().split("-", 1)[0];
    if (locale === "en" || locale === "it") return locale;
  }
  return "en";
}

const NUMBER_FORMATTERS = new Map<GuiLocale, Intl.NumberFormat>();
const DATE_TIME_FORMATTERS = new Map<GuiLocale, Intl.DateTimeFormat>();

/**
 * Formats a count for display, so 1000 reads as `1,000` in English and `1.000`
 * in Italian instead of as a bare digit run in both.
 */
export function formatGuiNumber(locale: GuiLocale, value: number): string {
  if (!Number.isFinite(value)) return "—";
  let formatter = NUMBER_FORMATTERS.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale);
    NUMBER_FORMATTERS.set(locale, formatter);
  }
  return formatter.format(value);
}

/**
 * Formats a stored ISO timestamp in the reader's locale and local time zone. An
 * unparsable value is returned verbatim rather than shown as `Invalid Date`.
 */
export function formatGuiDateTime(
  locale: GuiLocale,
  isoTimestamp: string,
): string {
  const instant = new Date(isoTimestamp);
  if (Number.isNaN(instant.getTime())) return isoTimestamp;
  let formatter = DATE_TIME_FORMATTERS.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "medium",
    });
    DATE_TIME_FORMATTERS.set(locale, formatter);
  }
  return formatter.format(instant);
}

export function guiMessage(
  locale: GuiLocale,
  key: GuiMessageKey,
  parameters: Readonly<Record<string, string>> = {},
): string {
  const template = GUI_CATALOGS[locale][key];
  const expected = [...template.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/gu)].map(
    (match) => match[1]!,
  );
  if (
    Object.keys(parameters).length !== expected.length ||
    expected.some((name) => !(name in parameters))
  )
    throw new Error(`Invalid localization parameters for '${key}'.`);
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/gu, (_, name: string) =>
    [...parameters[name]!]
      .map((character) => {
        const point = character.codePointAt(0) ?? 0;
        return point < 32 || (point >= 127 && point <= 159) ? "�" : character;
      })
      .join(""),
  );
}

/**
 * The static HTML document the local server sends for every route.
 *
 * The shell is markup only: it carries no data and no state. Every section
 * starts in the document, so navigation is a class toggle rather than a fetch,
 * and every visible string is either final copy or a `data-i18n` key the client
 * swaps when the reader changes language.
 */
export function shellHtml(csrfToken: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="aiw-csrf" content="${csrfToken}">
  <title>AI Workspace</title>
  <link rel="stylesheet" href="/app.css">
  <script src="/app.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main" data-i18n="skip">Skip to the guided workflow</a>
  <div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <a class="brand" href="#/dashboard" data-i18n-label="brandLabel" aria-label="AI Workspace dashboard">
        <span class="brand-mark" aria-hidden="true">AW</span>
        <span><strong>AI Workspace</strong><small data-i18n="headerTagline">Local-first control plane</small></span>
      </a>
      <nav class="primary-nav" data-i18n-label="navLabel" aria-label="Workspace">
        <p class="nav-label" data-i18n="navOverview">Overview</p>
        <a href="#/dashboard" data-route="dashboard"><span aria-hidden="true">⌂</span><span data-i18n="navDashboard">Dashboard</span></a>
        <p class="nav-label" data-i18n="navWork">Workspace</p>
        <a href="#/projects" data-route="projects"><span aria-hidden="true">◇</span><span data-i18n="navProjects">Projects</span></a>
        <a href="#/evidence" data-route="evidence"><span aria-hidden="true">⌕</span><span data-i18n="navEvidence">Evidence</span></a>
        <a href="#/memory" data-route="memory"><span aria-hidden="true">◉</span><span data-i18n="navMemory">Active memory</span></a>
        <a href="#/work" data-route="work"><span aria-hidden="true">✓</span><span data-i18n="navContinuity">Work &amp; handoffs</span></a>
        <a href="#/privacy" data-route="privacy"><span aria-hidden="true">◈</span><span data-i18n="navPrivacy">Privacy</span></a>
        <p class="nav-label" data-i18n="navManage">Manage</p>
        <a href="#/scripts" data-route="scripts"><span aria-hidden="true">⌘</span><span data-i18n="navScripts">Scripts</span><span class="nav-badge" data-i18n="navSoon">Soon</span></a>
        <a href="#/settings" data-route="settings"><span aria-hidden="true">⚙</span><span data-i18n="navSettings">Settings</span></a>
        <a href="#/system" data-route="system"><span aria-hidden="true">●</span><span data-i18n="navSystem">System status</span></a>
      </nav>
      <div class="locality-card">
        <span class="locality-dot" aria-hidden="true"></span>
        <div><strong data-i18n="localOnly">Local only</strong><small data-i18n="localOnlyDetail">No telemetry or external requests</small></div>
      </div>
    </aside>
    <div class="workspace-shell">
      <header class="topbar">
        <button id="menu-toggle" class="menu-toggle" type="button" aria-controls="sidebar" aria-expanded="false"><span aria-hidden="true">☰</span><span class="visually-hidden" data-i18n="openMenu">Open navigation</span></button>
        <div>
          <p class="eyebrow" id="page-eyebrow" data-i18n="headerTagline">Local-first control plane</p>
          <h1 id="page-title" data-i18n="navDashboard">Dashboard</h1>
        </div>
        <div class="topbar-state"><span class="status-dot" aria-hidden="true"></span><span data-i18n="privateWorkspace">Private workspace</span></div>
      </header>
      <main id="main" tabindex="-1">
    <section aria-labelledby="dashboard-heading" id="dashboard">
      <div class="dashboard-hero">
        <div><p class="eyebrow" data-i18n="dashboardEyebrow">Workspace pulse</p><h2 id="dashboard-heading" tabindex="-1" data-i18n="dashboard">Workspace overview</h2>
        <p data-i18n="dashboardIntro">Read-only local summary. Every value comes from an authoritative store; no telemetry or model request is used.</p></div>
        <button id="dashboard-refresh" type="button" class="button-secondary" data-i18n="refreshDashboard">Refresh overview</button>
      </div>
      <div id="dashboard-status" class="inline-status" role="status" aria-live="polite" data-i18n="dashboardLoading">Loading the workspace overview…</div>
      <div id="dashboard-charts"><p class="inline-status" data-i18n="dashboardChartsLoading">Loading the local charts…</p></div>
      <article class="boundary-card">
        <div class="boundary-icon" aria-hidden="true">⛨</div><div><p class="card-kicker" data-i18n="dashboardBoundaryKicker">Safety boundary</p><h3 data-i18n="dashboardDelivery">Model delivery</h3>
        <p class="status-unavailable" data-i18n="dashboardUnavailable">Unavailable: no provider delivery surface exists. Nothing can be sent.</p></div>
      </article>
      <p id="dashboard-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="welcome-heading" id="welcome">
      <h2 id="welcome-heading" tabindex="-1" data-i18n="welcome">Start with one local project</h2>
      <p data-i18n="welcomeRegistration">Registering stores bounded Git metadata locally. It does not copy or modify repository files.</p>
      <p class="notice"><strong data-i18n="whatNext">What happens next:</strong> <span data-i18n="whatNextBody">after selecting a project, the interface guides you through a fictional sample import and evidence search.</span></p>
    </section>
    <section aria-labelledby="projects-heading" id="projects">
      <h2 id="projects-heading" tabindex="-1" data-i18n="projects">Projects</h2>
      <div id="project-status" role="status" aria-live="polite">Loading local projects…</div>
      <div id="project-filter" class="filter-chip" role="status" hidden></div>
      <form id="register-project-form">
        <label for="project-path" data-i18n="projectDirectory">Local Git repository directory</label>
        <p id="project-path-help" class="help" data-i18n="projectDirectoryHelp">Enter an existing directory. The path is used only for registration and is not shown in routine project lists.</p>
        <input id="project-path" name="path" required aria-describedby="project-path-help project-error" autocomplete="off" spellcheck="false">
        <button type="submit" data-i18n="register">Register this project</button>
        <p id="project-effect" class="effect" data-i18n="projectEffect">Effect: creates or refreshes one local Project Registry entry; repository content is unchanged.</p>
        <p id="project-error" class="error" role="alert"></p>
      </form>
      <div id="project-list" data-i18n-label="projectListLabel" aria-label="Registered projects"></div>
    </section>
    <section aria-labelledby="next-heading" id="next-step" tabindex="-1">
      <h2 id="next-heading" data-i18n="next">Next recommended action</h2>
      <p id="next-guidance" data-i18n="nextGuidance">Register or select a project to continue.</p>
    </section>
    <section aria-labelledby="import-heading" id="import" hidden>
      <h2 id="import-heading" tabindex="-1" data-i18n="import">Import safe sample evidence</h2>
      <p>This pre-release importer accepts the bundled fictional Codex fixture. Do not use private or production transcripts yet.</p>
      <p class="notice"><strong data-i18n="trust">Trust:</strong> <span data-i18n="importTrustBody">imported events remain UNTRUSTED, inert historical evidence. Nothing is executed or sent over a network.</span></p>
      <button id="import-sample" type="button" data-i18n="importSample">Import the safe sample session</button>
      <p class="effect">Effect: adds canonical events and immutable artifacts locally. Repeating this action is idempotent.</p>
      <div id="import-status" role="status" aria-live="polite">Select a project to enable the safe sample.</div>
      <p id="import-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="transcripts-heading" id="transcripts" hidden>
      <h2 id="transcripts-heading" tabindex="-1" data-i18n="transcripts">Import your own Claude Code sessions</h2>
      <p data-i18n="transcriptsIntro">Name the directory that holds your Claude Code transcripts, then import one file into the selected project. Listing a directory reads names, sizes, and modification times only; no transcript is opened until you import it.</p>
      <p class="notice"><strong data-i18n="trust">Trust:</strong> <span data-i18n="transcriptsTrustBody">the transcript is read locally and stored as UNTRUSTED evidence. Nothing is executed and nothing is sent over a network. A record that carries high-confidence restricted data is excluded whole, counted, and never stored; if that leaves nothing to convert, the import writes nothing at all.</span></p>
      <form id="transcript-discover-form">
        <label for="transcript-directory" data-i18n="transcriptDirectory">Transcript directory</label>
        <p id="transcript-directory-help" class="help" data-i18n="transcriptDirectoryHelp">Enter one existing directory. It is not searched recursively and no location is guessed.</p>
        <input id="transcript-directory" required aria-describedby="transcript-directory-help transcript-error" autocomplete="off" spellcheck="false">
        <button type="submit" data-i18n="transcriptDiscover">List transcripts</button>
        <p class="effect" data-i18n="transcriptDiscoverEffect">Effect: reads file names, sizes, and modification times only. No transcript is opened.</p>
      </form>
      <div id="transcript-status" role="status" aria-live="polite" data-i18n="transcriptStatusIdle">Select a project, then list a transcript directory.</div>
      <p id="transcript-restricted" class="notice" role="status" aria-live="polite" hidden></p>
      <p id="transcript-detail" class="help" role="status" aria-live="polite"></p>
      <div id="transcript-list" data-i18n-label="transcriptListLabel" aria-label="Discovered transcripts"></div>
      <p id="transcript-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="general-heading" id="general-inbox">
      <h2 id="general-heading" tabindex="-1" data-i18n="generalInbox">General Inbox</h2>
      <p class="notice"><strong data-i18n="generalDestinationLabel">Destination: GENERAL.</strong> <span data-i18n="generalNotice">Local persistence only: no model request, assistant answer, tool execution, active-memory promotion, Context Pack inclusion, or delivery occurs.</span></p>
      <p data-i18n="generalIntro">Questions are immutable USER_AUTHORED, UNVERIFIED evidence and default to CONFIDENTIAL. Restricted high-confidence values are blocked before persistence. Search is literal: it does not find paraphrases, typos, synonyms, or stems.</p>
      <form id="general-create-form">
        <label for="general-title" data-i18n="generalTitleLabel">Conversation title</label>
        <input id="general-title" required maxlength="200" autocomplete="off">
        <button type="submit" data-i18n="generalCreate">Create a General conversation</button>
        <p class="effect" data-i18n="generalCreateEffect">Effect: creates one empty project-free immutable conversation; changing the project selection cannot move it.</p>
      </form>
      <form id="general-append-form" hidden>
        <p id="general-destination" class="notice"></p>
        <label for="general-question" data-i18n="generalQuestionLabel">Question to save</label>
        <textarea id="general-question" required aria-describedby="general-effect general-error"></textarea>
        <button type="submit" data-i18n="generalSave">Save the question in GENERAL</button>
        <p id="general-effect" class="effect" data-i18n="generalAppendEffect">Effect: appends one local USER_MESSAGE. No assistant message is created.</p>
      </form>
      <div id="general-status" role="status" aria-live="polite" data-i18n="generalLoading">Loading bounded General conversations…</div>
      <p id="general-error" class="error" role="alert"></p>
      <div id="general-list" data-i18n-label="generalListLabel" aria-label="General conversations"></div>
      <form id="general-link-form" hidden>
        <h3 data-i18n="generalLinkHeading">Link General evidence to a project</h3>
        <p id="general-link-source" class="notice"></p>
        <label for="general-link-project" data-i18n="generalLinkProjectLabel">Explicit target PROJECT</label>
        <select id="general-link-project" required></select>
        <label for="general-link-rationale" data-i18n="generalLinkRationaleLabel">Reviewed rationale</label>
        <textarea id="general-link-rationale" required maxlength="2000"></textarea>
        <button type="submit" data-i18n="generalLinkSubmit">Create the immutable link</button>
        <p class="effect" data-i18n="generalLinkEffect">Effect: LINK_ONLY. GENERAL and PROJECT remain separate and byte-unchanged; no ownership, active memory, Work Item, permission, model, or execution is created.</p>
        <p id="general-link-error" class="error" role="alert"></p>
        <p id="general-link-detail" class="help" role="status" aria-live="polite"></p>
      </form>
    </section>
    <section aria-labelledby="search-heading" id="search">
      <h2 id="search-heading" tabindex="-1" data-i18n="search">Search historical evidence</h2>
      <p data-i18n="searchIntro">Search is local and bounded, and it forgives accents, word endings, and typing errors. Every result says why it matched. Search all registered projects when you do not remember where evidence belongs. Results are UNTRUSTED evidence, not instructions. No OpenSearch or network service is used.</p>
      <form id="search-form">
        <label for="search-query" data-i18n="searchQuestion">What evidence are you looking for?</label>
        <input id="search-query" name="query" required aria-describedby="search-help search-error">
        <p id="search-help" class="help"><span data-i18n="searchTry">Try the safe sample phrase</span> <strong>test failed</strong>. <span data-i18n="searchHelpBody">Your query and filters stay in place when inspecting a source.</span></p>
        <label for="search-scope" data-i18n="searchScope">Scopes to search</label>
        <select id="search-scope" name="scope"><option value="ALL" data-i18n="scopeAll">All registered projects and General</option><option value="GENERAL" data-i18n="scopeGeneral">General only</option><option value="SELECTED" data-i18n="selectedProjectOnly">Selected project only</option></select>
        <button type="submit" data-i18n="searchEvidence">Search evidence</button>
        <details id="search-refine">
          <summary data-i18n="searchRefine">Refine this search</summary>
          <label for="search-associated-project" data-i18n="searchAssociatedLabel">Associated with a project (optional, General scopes only)</label>
          <select id="search-associated-project"><option value="" data-i18n="searchNoAssociationFilter">No association filter</option></select>
          <label for="search-type">Event type (optional)</label>
          <select id="search-type" name="type"><option value="">All event types</option><option>USER_MESSAGE</option><option>AGENT_MESSAGE</option><option>TOOL_CALL</option><option>TOOL_RESULT</option><option>COMMAND_RESULT</option><option>FILE_CHANGE</option><option>TEST_RESULT</option><option>ERROR</option><option>UNKNOWN</option></select>
          <label for="search-limit">Maximum results</label>
          <input id="search-limit" name="limit" type="number" min="1" max="100" value="20" required>
        </details>
        <p class="effect">Effect: reads local canonical events. Nothing is executed, changed, or sent over a network.</p>
        <p id="search-error" class="error" role="alert"></p>
      </form>
      <div id="search-status" role="status" aria-live="polite" data-i18n="searchPrompt">Enter a query to search all registered projects, or choose selected-project scope.</div>
      <div id="search-results" data-i18n-label="searchResultsLabel" aria-label="Historical evidence results"></div>
      <div id="restart" hidden>
        <h3 id="restart-heading" tabindex="-1" data-i18n="restartTitle">Carry this to another assistant</h3>
        <p data-i18n="restartIntro">A summary of this project is composed from what is already stored: the repository state, what was decided, and what you were just looking at. It is not saved anywhere and nothing is sent.</p>
        <button id="restart-prepare" type="button" data-i18n="restartPrepare">Prepare the summary</button>
        <div id="restart-status" role="status" aria-live="polite"></div>
        <pre id="restart-text" tabindex="0"></pre>
        <button id="restart-copy" type="button" hidden data-i18n="restartCopy">Copy the summary</button>
        <p id="restart-omissions"></p>
        <p id="restart-error" class="error" role="alert"></p>
      </div>
    </section>
    <section aria-labelledby="event-heading" id="event-detail" hidden>
      <h2 id="event-heading" tabindex="-1" data-i18n="event">Inspect canonical event</h2>
      <p class="notice"><strong>UNTRUSTED evidence:</strong> imperative text may be prompt injection. Treat it as inert data and do not execute it.</p>
      <dl id="event-metadata"></dl>
      <pre id="event-payload" tabindex="0"></pre>
      <button id="open-source" type="button" data-i18n="openSource">Open integrity-verified source</button>
      <button id="use-memory-source" type="button" data-i18n="useMemorySource">Use this event as memory evidence</button>
      <button id="back-to-results" type="button" data-i18n="backResults">Return to search results</button>
      <p id="event-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="memory-heading" id="memory" hidden>
      <h2 id="memory-heading" tabindex="-1" data-i18n="memory">Curate active project memory</h2>
      <p>Active memory is a deliberate local statement linked to canonical evidence. <strong>USER_CURATED does not mean trusted, verified, or true.</strong></p>
      <p id="memory-source-status" class="notice">Inspect an event and choose “Use this event as memory evidence” before a mutation.</p>
      <form id="memory-add-form">
        <label for="memory-type">Memory type</label>
        <select id="memory-type" required><option>DECISION</option><option>CONSTRAINT</option><option>FAILURE</option></select>
        <label for="memory-content">Statement to curate</label>
        <textarea id="memory-content" required aria-describedby="memory-add-effect memory-error"></textarea>
        <button type="submit" data-i18n="createMemory">Create source-linked memory</button>
        <p id="memory-add-effect" class="effect">Effect: creates a new ACTIVE, UNVERIFIED, UNASSESSED item. Evidence remains UNTRUSTED and nothing is executed.</p>
      </form>
      <form id="memory-filter-form">
        <label for="memory-validity">Items to show</label>
        <select id="memory-validity"><option value="">Active only (safe default)</option><option>SUPERSEDED</option><option>INVALIDATED</option></select>
        <button type="submit" data-i18n="refreshMemory">Refresh memory list</button>
      </form>
      <div id="memory-status" role="status" aria-live="polite">Select a project to load active memory.</div>
      <p id="memory-error" class="error" role="alert"></p>
      <div id="memory-list" data-i18n-label="memoryListLabel" aria-label="Project memory items"></div>
    </section>
    <section aria-labelledby="memory-detail-heading" id="memory-detail" hidden>
      <h2 id="memory-detail-heading" tabindex="-1" data-i18n="memoryDetail">Memory lifecycle and provenance</h2>
      <dl id="memory-metadata"></dl><p id="memory-detail-content"></p><ul id="memory-sources"></ul>
      <p class="notice">All lifecycle changes are additive. Terminal items cannot be changed again.</p>
      <form id="memory-verify-form"><label for="memory-note">Verification note</label><textarea id="memory-note" required></textarea><button type="submit">Record one verification</button><p class="effect">Effect: records a performed check; it does not make evidence trusted.</p></form>
      <form id="memory-supersede-form"><label for="memory-replacement">Replacement statement</label><textarea id="memory-replacement" required></textarea><button type="submit">Supersede with replacement</button><p class="effect">Effect: makes this item SUPERSEDED and creates a new UNVERIFIED, UNASSESSED replacement.</p></form>
      <form id="memory-invalidate-form"><label for="memory-reason">Invalidation reason</label><textarea id="memory-reason" required></textarea><button type="submit">Invalidate this item</button><p class="effect">Effect: marks this item INVALIDATED without deletion or replacement.</p></form>
      <button id="memory-back" type="button">Return to memory list</button>
      <p id="memory-detail-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="work-heading" id="work-items" hidden>
      <h2 id="work-heading" tabindex="-1" data-i18n="work">Work Items</h2>
      <p>A Work Item is explicit USER_CURATED objective state. No current task or agent is inferred.</p>
      <form id="work-create-form"><label for="work-objective">Software objective</label><textarea id="work-objective" required></textarea><button type="submit" data-i18n="createWork">Create proposed Work Item</button><p class="effect">Effect: creates PROPOSED state linked to the currently selected canonical event.</p></form>
      <div id="work-status" role="status" aria-live="polite">Select a project to load Work Items.</div><div id="work-filter" class="filter-chip" role="status" hidden></div><p id="work-error" class="error" role="alert"></p><div id="work-list"></div>
    </section>
    <section aria-labelledby="work-detail-heading" id="work-detail" hidden>
      <h2 id="work-detail-heading" tabindex="-1" data-i18n="workDetail">Work Item lifecycle</h2><dl id="work-metadata"></dl><p id="work-objective-detail"></p><ul id="work-transitions"></ul>
      <p class="notice">Transitions are additive and require the currently selected canonical event.</p>
      <div id="work-actions"></div><button id="work-back" type="button">Return to Work Items</button><p id="work-detail-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="handoff-builder-heading" id="handoff-builder" hidden>
      <h2 id="handoff-builder-heading" tabindex="-1" data-i18n="handoff">Build a transparent handoff</h2>
      <p>Preview captures bounded Git metadata and all eight source-linked sections. It executes no agent and creates no file.</p>
      <form id="handoff-form"><label for="handoff-next">Next action</label><textarea id="handoff-next" required></textarea><fieldset><legend>Active memory to include (optional)</legend><p class="help">Selection is explicit. Leaving every item unchecked records an explicit empty selection; nothing is inferred.</p><div id="handoff-memory-options"></div></fieldset><label for="handoff-files">Relevant files, one per line (optional)</label><textarea id="handoff-files"></textarea><label for="handoff-test-command">Observed test command (optional)</label><input id="handoff-test-command"><label for="handoff-test-outcome">Observed test outcome</label><select id="handoff-test-outcome"><option>PASS</option><option>FAIL</option><option>NOT_RUN</option></select><label for="handoff-test-at">Observed at ISO timestamp (optional)</label><input id="handoff-test-at"><label for="handoff-predecessor">Predecessor handoff ID (optional successor)</label><input id="handoff-predecessor"><button id="handoff-preview" type="submit">Preview immutable handoff</button></form>
      <div id="handoff-preview-result" role="status" aria-live="polite"></div><pre id="handoff-preview-content" tabindex="0" hidden></pre><button id="handoff-create" type="button" hidden>Create reviewed immutable handoff</button><p id="handoff-error" class="error" role="alert"></p><div id="handoff-list"></div>
    </section>
    <section aria-labelledby="handoff-detail-heading" id="handoff-detail" hidden>
      <h2 id="handoff-detail-heading" tabindex="-1" data-i18n="handoffDetail">Immutable handoff</h2><pre id="handoff-content" tabindex="0"></pre><button id="handoff-validate" type="button" data-i18n="validateHandoff">Validate current Git state</button><div id="handoff-validation" role="status" aria-live="polite"></div><button id="handoff-successor" type="button" data-i18n="successor">Prepare successor</button><button id="handoff-back" type="button" data-i18n="backHandoff">Return to handoff builder</button><p id="handoff-detail-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="instructions-heading" id="instructions" hidden>
      <h2 id="instructions-heading" tabindex="-1" data-i18n="instructions">Preview effective instructions</h2>
      <p class="notice" data-i18n="instructionWarning">Read-only preview: nothing is persisted or executed. USER_CONFIGURED does not mean runtime permission.</p>
      <form id="instructions-form"><label for="instruction-bundles" data-i18n="bundlePaths">Reviewed instruction bundle paths, one per line</label><textarea id="instruction-bundles" required spellcheck="false"></textarea><label for="instruction-model" data-i18n="model">Model target (optional)</label><input id="instruction-model"><label for="instruction-agent" data-i18n="agent">Agent target (optional)</label><input id="instruction-agent"><label for="instruction-task" data-i18n="task">Task target (optional)</label><input id="instruction-task"><button type="submit" data-i18n="previewInstructions">Preview instructions read-only</button></form>
      <div id="instruction-status" role="status" aria-live="polite" data-i18n="instructionEmpty">Select a project and explicit reviewed synthetic bundle paths to preview effective instructions.</div><pre id="instruction-content" tabindex="0" hidden></pre><p id="instruction-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="agent-profile-heading" id="agent-profile" hidden>
      <h2 id="agent-profile-heading" tabindex="-1" data-i18n="agentProfile">Inspect an agent and skill profile</h2>
      <p class="notice" data-i18n="profileWarning">USER_CONFIGURED profile declarations are descriptive. They are not installed, selected, enforced, resolved, delivered, or executed and grant no runtime permission.</p>
      <form id="agent-profile-form"><label for="agent-profile-path" data-i18n="profilePath">Reviewed schema-v1 agent profile bundle path</label><input id="agent-profile-path" required autocomplete="off" spellcheck="false"><label for="agent-profile-digest" data-i18n="profileDigest">Expected SHA-256 digest (optional pin)</label><input id="agent-profile-digest" pattern="[a-f0-9]{64}" autocomplete="off" spellcheck="false"><button type="submit" data-i18n="previewAgentProfile">Inspect profile read-only</button></form>
      <div id="agent-profile-status" role="status" aria-live="polite" data-i18n="profileEmpty">Select a project and one explicit reviewed synthetic profile bundle to inspect agent and skill declarations.</div><pre id="agent-profile-content" tabindex="0" hidden></pre><p id="agent-profile-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="context-heading" id="context-pack" hidden>
      <h2 id="context-heading" tabindex="-1" data-i18n="context">Preview a bounded Context Pack</h2>
      <p class="notice" data-i18n="contextWarning">Schema v2 shares canonical source provenance once and uses exact UTF-8 byte budgets. The expanded preview does not persist, send, enforce, or execute anything.</p>
      <form id="context-form"><label for="context-continuity-budget" data-i18n="continuityBudget">Continuity budget (exact UTF-8 bytes)</label><input id="context-continuity-budget" type="number" min="1" max="1000000" value="100000" required><label for="context-instruction-budget" data-i18n="instructionBudget">Instruction budget (exact UTF-8 bytes)</label><input id="context-instruction-budget" type="number" min="1" max="1000000" value="100000" required><label for="context-bundles" data-i18n="contextBundles">Optional reviewed instruction bundle paths, one per line</label><textarea id="context-bundles" spellcheck="false"></textarea><button type="submit" data-i18n="previewContext">Preview Context Pack read-only</button></form>
      <div id="context-status" role="status" aria-live="polite" data-i18n="contextEmpty">Inspect an immutable handoff, then enter explicit budgets to preview its Context Pack.</div><pre id="context-content" tabindex="0" hidden></pre><p id="context-error" class="error" role="alert"></p>
      <h3 id="profile-context-heading" data-i18n="profileContext">Compose profile-governed context</h3>
      <p class="notice" data-i18n="profileContextWarning">Explicit read-only composition: the profile supplies the agent target and exact-byte budgets. You select an allowed model and the exact reviewed instruction sources. Nothing is installed, resolved, persisted, delivered, or executed.</p>
      <form id="profile-context-form"><label for="profile-context-path" data-i18n="profilePath">Reviewed schema-v1 agent profile bundle path</label><input id="profile-context-path" required autocomplete="off" spellcheck="false"><label for="profile-context-digest" data-i18n="profileDigest">Expected SHA-256 digest (optional pin)</label><input id="profile-context-digest" pattern="[a-f0-9]{64}" autocomplete="off" spellcheck="false"><label for="profile-context-bundles" data-i18n="profileContextBundles">Exact reviewed instruction bundle paths declared by the profile, one per line</label><textarea id="profile-context-bundles" required spellcheck="false"></textarea><label for="profile-context-model" data-i18n="profileContextModel">Allowed model to select explicitly</label><input id="profile-context-model" required><label for="profile-context-task" data-i18n="profileContextTask">Task target (optional explicit selector)</label><input id="profile-context-task"><button type="submit" data-i18n="previewProfileContext">Compose profile and Context Pack read-only</button></form>
      <div id="profile-context-status" role="status" aria-live="polite" data-i18n="profileContextEmpty">Inspect an immutable handoff, then select one profile, its exact instruction sources, and one allowed model.</div><pre id="profile-context-content" tabindex="0" hidden></pre><p id="profile-context-error" class="error" role="alert"></p>
      <h3 id="privacy-preflight-heading" data-i18n="privacyPreflight">Preview model privacy policy</h3>
      <p class="notice" data-i18n="privacyPreflightWarning">Required review boundary: every included item is classified for one explicit model policy. Unknown items default to CONFIDENTIAL. Every valid decision is recorded in the separate local non-content audit before its report is returned. REVIEWABLE_NOT_AUTHORIZED is not permission or delivery, and detection is not complete PII coverage.</p>
      <form id="privacy-preflight-form"><label for="privacy-profile-path" data-i18n="profilePath">Reviewed schema-v1 agent profile bundle path</label><input id="privacy-profile-path" required autocomplete="off" spellcheck="false"><label for="privacy-profile-digest" data-i18n="profileDigest">Expected SHA-256 digest (optional pin)</label><input id="privacy-profile-digest" pattern="[a-f0-9]{64}" autocomplete="off" spellcheck="false"><label for="privacy-bundles" data-i18n="profileContextBundles">Exact reviewed instruction bundle paths declared by the profile, one per line</label><textarea id="privacy-bundles" required spellcheck="false"></textarea><label for="privacy-model" data-i18n="profileContextModel">Allowed model to select explicitly</label><input id="privacy-model" required><label for="privacy-task" data-i18n="profileContextTask">Task target (optional explicit selector)</label><input id="privacy-task"><label for="privacy-policy-path" data-i18n="privacyPolicyPath">Reviewed schema-v1 model data policy path</label><input id="privacy-policy-path" required autocomplete="off" spellcheck="false"><label for="privacy-policy-digest" data-i18n="privacyPolicyDigest">Expected policy SHA-256 digest (optional pin)</label><input id="privacy-policy-digest" pattern="[a-f0-9]{64}" autocomplete="off" spellcheck="false"><button type="submit" data-i18n="previewPrivacyPreflight">Run and record privacy preflight</button></form>
      <div id="privacy-preflight-status" role="status" aria-live="polite" data-i18n="privacyPreflightEmpty">Inspect an immutable handoff, then provide one profile, its exact instruction sources, one allowed model, and one same-project model data policy.</div><p id="privacy-preflight-audit" class="help" role="status" aria-live="polite"></p><pre id="privacy-preflight-content" tabindex="0" hidden></pre><p id="privacy-preflight-error" class="error" role="alert"></p>
      <h3 id="customer-alias-heading" data-i18n="customerAliasSuggestions">Review exact customer/project alias suggestions</h3>
      <p class="notice" data-i18n="customerAliasWarning">Exact, case-sensitive CUSTOMER and PROJECT aliases only. The dictionary is transient and never persisted. Every result starts SUGGESTED_NOT_REVIEWED and requires individual confirmation; this is not identity proof, complete PII detection, transformation, or delivery.</p>
      <form id="customer-alias-form"><label for="customer-aliases" data-i18n="customerAliasInput">Synthetic aliases, one typed line such as CUSTOMER: Cedar Demo or PROJECT: Quartz Demo</label><textarea id="customer-aliases" required spellcheck="false"></textarea><button type="submit" data-i18n="previewCustomerAliases">Preview entity suggestions</button></form>
      <div id="customer-alias-status" role="status" aria-live="polite" data-i18n="customerAliasEmpty">Reuse the exact privacy inputs above and enter typed transient synthetic aliases.</div><ul id="customer-alias-results"></ul><button id="customer-alias-confirm" type="button" hidden data-i18n="confirmCustomerAliases">Confirm selected current-hash ranges</button><p id="customer-alias-error" class="error" role="alert"></p>
      <h3 id="pseudonymization-heading" data-i18n="pseudonymHeading">Reversible privacy transformation</h3>
      <p class="notice" data-i18n="pseudonymWarning">Local reviewed-span boundary: reuse the exact privacy inputs above, then bind every selection to item ID, content SHA-256, entity type, and UTF-8 byte range. Only encrypted mapping ciphertext is persisted. Source evidence is unchanged; this is not detection, permission, delivery, or execution.</p>
      <form id="pseudonymization-form"><label for="pseudonym-mapping-id" data-i18n="pseudonymMappingLabel">New mapping-set identity</label><input id="pseudonym-mapping-id" required maxlength="256" autocomplete="off"><label for="pseudonym-selections" data-i18n="pseudonymSelectionsLabel">Reviewed selection JSON array</label><p class="help" data-i18n="pseudonymSelectionsHelp">Each entry carries itemId, contentSha256 as 64 lowercase hex characters, byteStart, byteEnd, and entityType. Schema v1 types: PERSON, CUSTOMER, EMAIL, BUSINESS_IDENTIFIER, OTHER. Confirming PROJECT selects schema v2 explicitly.</p><textarea id="pseudonym-selections" required spellcheck="false"></textarea><label for="pseudonym-custody-mode" data-i18n="pseudonymCustodyLabel">Local key custody</label><select id="pseudonym-custody-mode" required><option value="PASSPHRASE_WRAPPING" data-i18n="pseudonymCustodyOption">Passphrase-wrapped local key</option></select><label for="pseudonym-passphrase" data-i18n="pseudonymPassphraseLabel">Custody passphrase, 16–1024 UTF-8 bytes</label><input id="pseudonym-passphrase" type="password" required minlength="16" maxlength="1024" autocomplete="new-password" spellcheck="false"><button type="submit" data-i18n="pseudonymSubmit">Transform, encrypt the mapping, and verify locally</button><p class="effect" data-i18n="pseudonymEffect">Effect: generates one mapping key and stores only an immutable authenticated passphrase-wrapped schema-v1 custody envelope plus schema-v1 or explicit schema-v2 mapping ciphertext. Back up both encrypted directories and keep the passphrase offline; losing either is irrecoverable. Older v1-only software must preserve v2 ciphertext until compatible software is restored. The passphrase is cleared after every attempt.</p></form>
      <div id="pseudonymization-status" role="status" aria-live="polite" data-i18n="pseudonymEmpty">Run and inspect the exact privacy preflight first.</div><pre id="pseudonymization-content" tabindex="0" hidden></pre><p id="pseudonymization-error" class="error" role="alert"></p>
      <h3 id="output-restoration-heading" data-i18n="restorationHeading">Strict local output restoration</h3>
      <p class="notice" data-i18n="restorationWarning">Every AI Workspace-shaped placeholder is validated before any value is restored. Unknown, altered, foreign, or malformed tokens block the complete output. Candidate and restored text stay transient and local; this is not model access, response capture, permission, delivery, or execution.</p>
      <form id="output-restoration-form"><label for="output-restoration-mapping-id" data-i18n="restorationMappingLabel">Existing mapping-set identity</label><input id="output-restoration-mapping-id" required maxlength="256" autocomplete="off"><label for="output-restoration-candidate" data-i18n="restorationOutputLabel">Bounded pseudonymized output</label><textarea id="output-restoration-candidate" required maxlength="30000" spellcheck="false"></textarea><label for="output-restoration-passphrase" data-i18n="restorationPassphraseLabel">Local custody passphrase</label><input id="output-restoration-passphrase" type="password" required minlength="16" maxlength="1024" autocomplete="current-password" spellcheck="false"><button type="submit" data-i18n="restorationSubmit">Validate and restore locally</button><p class="effect" data-i18n="restorationEffect">Effect: reads one existing authenticated encrypted mapping and returns restored content only after all-or-nothing validation. Nothing is persisted or sent. The passphrase is cleared after every attempt.</p></form>
      <div id="output-restoration-status" role="status" aria-live="polite" data-i18n="restorationEmpty">Inspect the originating handoff and enter one existing mapping.</div><pre id="output-restoration-content" tabindex="0" hidden></pre><p id="output-restoration-error" class="error" role="alert"></p>
      <h3 id="context-selector-report-heading" data-i18n="contextSelectorReport">Measure profile context selectors</h3>
      <p class="notice" data-i18n="contextSelectorWarning">Experiment only: selectors map only to documented handoff sections. Objective, repository, next action, and source references form a non-excludable safety floor. This report does not change Context Builder policy.</p><p class="help" data-i18n="contextSelectorVocabulary">Accepted selectors: handoff.objective, handoff.repository, handoff.selected_memory, handoff.known_failures, handoff.test_state, handoff.relevant_files, handoff.next_action, handoff.source_references.</p>
      <form id="context-selector-form"><label for="context-selector-profile-path" data-i18n="profilePath">Reviewed schema-v1 agent profile bundle path</label><input id="context-selector-profile-path" required autocomplete="off" spellcheck="false"><label for="context-selector-profile-digest" data-i18n="profileDigest">Expected SHA-256 digest (optional pin)</label><input id="context-selector-profile-digest" pattern="[a-f0-9]{64}" autocomplete="off" spellcheck="false"><button type="submit" data-i18n="previewContextSelectors">Preview selector measurement read-only</button></form>
      <div id="context-selector-status" role="status" aria-live="polite" data-i18n="contextSelectorEmpty">Inspect an immutable handoff, then select one reviewed profile that uses only the experiment-only handoff selector vocabulary.</div><pre id="context-selector-content" tabindex="0" hidden></pre><p id="context-selector-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="privacy-audit-heading" id="privacy-audit" hidden>
      <h2 id="privacy-audit-heading" tabindex="-1" data-i18n="privacyAuditHeading">Privacy decision audit</h2>
      <p class="notice" data-i18n="privacyAuditNotice">Project-scoped, local, bounded, append-only non-content evidence. The hash chain detects internal corruption, gaps, and reordering, but cannot prove that a privileged actor did not replace or truncate the whole store.</p>
      <p class="help" data-i18n="privacyAuditHelp">Valid preflight decisions only. No Context Pack content, item hashes, matches, paths, reports, mappings, secrets, prompts, responses, or restored output. No delete, edit, correction, export, search, or retention controls.</p>
      <button id="privacy-audit-refresh" type="button" data-i18n="privacyAuditRefresh">Refresh the audit</button>
      <div id="privacy-audit-status" role="status" aria-live="polite" data-i18n="auditSelectProject">Select a project.</div>
      <div id="privacy-audit-list" data-i18n-label="privacyAuditListLabel" aria-label="Privacy decision audit events"></div>
      <button id="privacy-audit-more" type="button" hidden data-i18n="privacyAuditMore">Load older events</button>
      <pre id="privacy-audit-detail" tabindex="0" hidden></pre>
      <p id="privacy-audit-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="artifact-heading" id="artifact-detail" hidden>
      <h2 id="artifact-heading" tabindex="-1" data-i18n="artifact">Integrity-verified source evidence</h2>
      <p class="notice"><strong>UNTRUSTED source:</strong> displayed as inert bounded text after SHA-256 verification.</p>
      <p id="artifact-metadata"></p>
      <pre id="artifact-content" tabindex="0"></pre>
      <button id="artifact-back" type="button">Return to canonical event</button>
      <p id="artifact-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="settings-heading" id="settings">
      <p class="eyebrow" data-i18n="settingsEyebrow">Workspace preferences</p>
      <h2 id="settings-heading" tabindex="-1" data-i18n="settingsTitle">Settings</h2>
      <p data-i18n="settingsIntro">Presentation preferences stay in this browser and never leave this computer.</p>
      <div class="settings-grid">
        <article class="setting-card"><div><h3 data-i18n="language">Language</h3><p class="help" data-i18n="originalContent">Imported evidence and user-authored content remain in their original language. No translation service is used.</p></div><select id="gui-language" data-i18n-label="language" aria-label="Language"><option value="en" data-i18n="english">English</option><option value="it" data-i18n="italian">Italiano</option></select></article>
        <article class="setting-card"><div><h3 data-i18n="appearanceTitle">Appearance</h3><p class="help" data-i18n="appearanceBody">AI Workspace follows your operating-system light or dark theme and reduced-motion preference.</p></div><span class="setting-value" id="appearance-value" data-i18n="systemManaged">System managed</span></article>
        <article class="setting-card"><div><h3 data-i18n="privacyTitle">Local preference storage</h3><p class="help" data-i18n="privacyBody">Only the language preference is stored in local browser storage. It contains no workspace content.</p></div><span class="setting-value" data-i18n="browserOnly">Browser only</span></article>
      </div>
    </section>
    <section aria-labelledby="scripts-heading" id="scripts">
      <div class="empty-state-icon" aria-hidden="true">⌘</div>
      <p class="eyebrow" data-i18n="scriptsEyebrow">Automation workspace</p>
      <h2 id="scripts-heading" tabindex="-1" data-i18n="scriptsTitle">Scripts</h2>
      <p data-i18n="scriptsIntro">This area is reserved for reviewed local automations when an execution contract exists.</p>
      <p class="notice" data-i18n="scriptsUnavailable">Not available yet. No script runner, command execution, scheduler, or hidden automation is active.</p>
    </section>
    <section aria-labelledby="system-heading" id="system-status">
      <p class="eyebrow" data-i18n="systemEyebrow">Runtime boundaries</p>
      <h2 id="system-heading" tabindex="-1" data-i18n="systemTitle">System status</h2>
      <div class="system-grid">
        <article><span class="health-dot health-good" aria-hidden="true"></span><div><h3 data-i18n="localHostTitle">Local host</h3><p data-i18n="localHostBody">Running on authenticated loopback with restrictive browser security headers.</p></div></article>
        <article><span class="health-dot health-good" aria-hidden="true"></span><div><h3 data-i18n="storesTitle">Authoritative stores</h3><p id="system-project-coverage" data-i18n="storesPending">Coverage loads with the dashboard.</p></div></article>
        <article><span class="health-dot health-muted" aria-hidden="true"></span><div><h3 data-i18n="deliveryTitle">Provider delivery</h3><p data-i18n="dashboardUnavailable">Unavailable: no provider delivery surface exists. Nothing can be sent.</p></div></article>
      </div>
      <p id="system-updated" class="help"></p><p id="system-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="capabilities-heading" id="capabilities">
      <h2 id="capabilities-heading" data-i18n="capabilities">Product capability map</h2>
      <ul><li><strong>Available now:</strong> English/Italian GUI, Projects, safe sample import, history search, source inspection, active memory, Work Items, immutable handoffs, and effective-instruction preview.</li><li><strong>Not active:</strong> Agents, models, tools, external network, handoff evaluation, instruction enforcement, and instruction execution.</li></ul>
    </section>
      </main>
      <footer><p>AI Workspace · <span data-i18n="footerLocal">Local-first, private by design</span></p></footer>
    </div>
  </div>
</body>
</html>`;
}

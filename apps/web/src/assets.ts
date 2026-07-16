import { GUI_CATALOGS } from "./localization.ts";

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
  <header><p class="eyebrow" data-i18n="headerTagline">Local-first control plane</p><h1>AI Workspace</h1><p data-i18n="headerPrivacy">Your project data stays on this computer. This guided alpha makes no external requests.</p><label for="gui-language" data-i18n="language">Language / Lingua</label><select id="gui-language"><option value="en" data-i18n="english">English</option><option value="it" data-i18n="italian">Italiano</option></select><p class="help" data-i18n="originalContent">Imported evidence and user-authored content remain in their original language. No translation service is used.</p></header>
  <nav aria-label="Journey progress"><ol class="progress"><li aria-current="step" data-i18n="progressProject">1. Project</li><li data-i18n="progressSample">2. Safe sample</li><li data-i18n="progressSearch">3. Search</li><li data-i18n="progressSource">4. Inspect source</li></ol></nav>
  <main id="main" tabindex="-1">
    <section aria-labelledby="welcome-heading" id="welcome">
      <h2 id="welcome-heading" tabindex="-1" data-i18n="welcome">Start with one local project</h2>
      <p data-i18n="welcomeRegistration">Registering stores bounded Git metadata locally. It does not copy or modify repository files.</p>
      <p class="notice"><strong data-i18n="whatNext">What happens next:</strong> <span data-i18n="whatNextBody">after selecting a project, the interface guides you through a fictional sample import and evidence search.</span></p>
    </section>
    <section aria-labelledby="projects-heading" id="projects">
      <h2 id="projects-heading" tabindex="-1" data-i18n="projects">Projects</h2>
      <div id="project-status" role="status" aria-live="polite">Loading local projects…</div>
      <form id="register-project-form">
        <label for="project-path" data-i18n="projectDirectory">Local Git repository directory</label>
        <p id="project-path-help" class="help" data-i18n="projectDirectoryHelp">Enter an existing directory. The path is used only for registration and is not shown in routine project lists.</p>
        <input id="project-path" name="path" required aria-describedby="project-path-help project-error" autocomplete="off" spellcheck="false">
        <button type="submit" data-i18n="register">Register this project</button>
        <p id="project-effect" class="effect" data-i18n="projectEffect">Effect: creates or refreshes one local Project Registry entry; repository content is unchanged.</p>
        <p id="project-error" class="error" role="alert"></p>
      </form>
      <div id="project-list" aria-label="Registered projects"></div>
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
    <section aria-labelledby="general-heading" id="general-inbox">
      <h2 id="general-heading" tabindex="-1">General Inbox / Posta generale</h2>
      <p class="notice"><strong>Destination / Destinazione: GENERAL.</strong> Local persistence only: no model request, assistant answer, tool execution, active-memory promotion, Context Pack inclusion, or delivery occurs. Solo persistenza locale: nessuna risposta AI.</p>
      <p>Questions are immutable USER_AUTHORED, UNVERIFIED evidence and default to CONFIDENTIAL. Restricted high-confidence values are blocked before persistence. Search is literal: it does not find paraphrases, typos, synonyms, or stems.</p>
      <form id="general-create-form">
        <label for="general-title">Conversation title / Titolo conversazione</label>
        <input id="general-title" required maxlength="200" autocomplete="off">
        <button type="submit">Create General conversation / Crea conversazione General</button>
        <p class="effect">Effect: creates one empty project-free immutable conversation; changing project selection cannot move it.</p>
      </form>
      <form id="general-append-form" hidden>
        <p id="general-destination" class="notice"></p>
        <label for="general-question">Question to save / Domanda da salvare</label>
        <textarea id="general-question" required aria-describedby="general-effect general-error"></textarea>
        <button type="submit">Save question to GENERAL / Salva domanda in GENERAL</button>
        <p id="general-effect" class="effect">Effect: appends one local USER_MESSAGE. No assistant message is created.</p>
      </form>
      <div id="general-status" role="status" aria-live="polite">Loading bounded General conversations…</div>
      <p id="general-error" class="error" role="alert"></p>
      <div id="general-list" aria-label="General conversations"></div>
      <form id="general-link-form" hidden>
        <h3>Link General evidence to a project / Collega evidenza General a un progetto</h3>
        <p id="general-link-source" class="notice"></p>
        <label for="general-link-project">Explicit target PROJECT / Progetto destinazione esplicito</label>
        <select id="general-link-project" required></select>
        <label for="general-link-rationale">Reviewed rationale / Motivazione revisionata</label>
        <textarea id="general-link-rationale" required maxlength="2000"></textarea>
        <button type="submit">Create immutable link / Crea link immutabile</button>
        <p class="effect">Effect / Effetto: LINK_ONLY. GENERAL and PROJECT remain separate and byte-unchanged; no ownership, active memory, Work Item, permission, model, or execution is created.</p>
        <p id="general-link-error" class="error" role="alert"></p>
      </form>
    </section>
    <section aria-labelledby="search-heading" id="search">
      <h2 id="search-heading" tabindex="-1" data-i18n="search">Search historical evidence</h2>
      <p data-i18n="searchIntro">Search is literal, local, and bounded. Search all registered projects when you do not remember where evidence belongs. Results are UNTRUSTED evidence, not instructions. No OpenSearch or network service is used.</p>
      <form id="search-form">
        <label for="search-scope" data-i18n="searchScope">Projects to search</label>
        <select id="search-scope" name="scope"><option value="ALL">All registered projects and General / Tutti i progetti registrati e General</option><option value="GENERAL">General only / Solo General</option><option value="SELECTED" data-i18n="selectedProjectOnly">Selected project only</option></select>
        <label for="search-associated-project">Associated with project (optional, General scopes only) / Associata al progetto (opzionale)</label>
        <select id="search-associated-project"><option value="">No association filter / Nessun filtro associazione</option></select>
        <label for="search-query">What evidence are you looking for?</label>
        <p id="search-help" class="help"><span data-i18n="searchTry">Try the safe sample phrase</span> <strong>test failed</strong>. <span data-i18n="searchHelpBody">Your query and filters stay in place when inspecting a source.</span></p>
        <input id="search-query" name="query" value="test failed" required aria-describedby="search-help search-error">
        <label for="search-type">Event type (optional)</label>
        <select id="search-type" name="type"><option value="">All event types</option><option>USER_MESSAGE</option><option>AGENT_MESSAGE</option><option>TOOL_CALL</option><option>TOOL_RESULT</option><option>COMMAND_RESULT</option><option>FILE_CHANGE</option><option>TEST_RESULT</option><option>ERROR</option><option>UNKNOWN</option></select>
        <label for="search-limit">Maximum results</label>
        <input id="search-limit" name="limit" type="number" min="1" max="100" value="20" required>
        <button type="submit" data-i18n="searchEvidence">Search evidence</button>
        <p class="effect">Effect: reads local canonical events. Nothing is executed, changed, or sent over a network.</p>
        <p id="search-error" class="error" role="alert"></p>
      </form>
      <div id="search-status" role="status" aria-live="polite" data-i18n="searchPrompt">Enter a query to search all registered projects, or choose selected-project scope.</div>
      <div id="search-results" aria-label="Historical evidence results"></div>
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
      <div id="memory-list" aria-label="Project memory items"></div>
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
      <div id="work-status" role="status" aria-live="polite">Select a project to load Work Items.</div><p id="work-error" class="error" role="alert"></p><div id="work-list"></div>
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
      <p class="notice" data-i18n="privacyPreflightWarning">Required review boundary: every included item is classified for one explicit model policy. Unknown items default to CONFIDENTIAL and high-confidence restricted patterns always block. REVIEWABLE_NOT_AUTHORIZED is not permission or delivery, and detection is not complete PII coverage.</p>
      <form id="privacy-preflight-form"><label for="privacy-profile-path" data-i18n="profilePath">Reviewed schema-v1 agent profile bundle path</label><input id="privacy-profile-path" required autocomplete="off" spellcheck="false"><label for="privacy-profile-digest" data-i18n="profileDigest">Expected SHA-256 digest (optional pin)</label><input id="privacy-profile-digest" pattern="[a-f0-9]{64}" autocomplete="off" spellcheck="false"><label for="privacy-bundles" data-i18n="profileContextBundles">Exact reviewed instruction bundle paths declared by the profile, one per line</label><textarea id="privacy-bundles" required spellcheck="false"></textarea><label for="privacy-model" data-i18n="profileContextModel">Allowed model to select explicitly</label><input id="privacy-model" required><label for="privacy-task" data-i18n="profileContextTask">Task target (optional explicit selector)</label><input id="privacy-task"><label for="privacy-policy-path" data-i18n="privacyPolicyPath">Reviewed schema-v1 model data policy path</label><input id="privacy-policy-path" required autocomplete="off" spellcheck="false"><label for="privacy-policy-digest" data-i18n="privacyPolicyDigest">Expected policy SHA-256 digest (optional pin)</label><input id="privacy-policy-digest" pattern="[a-f0-9]{64}" autocomplete="off" spellcheck="false"><button type="submit" data-i18n="previewPrivacyPreflight">Run privacy preflight read-only</button></form>
      <div id="privacy-preflight-status" role="status" aria-live="polite" data-i18n="privacyPreflightEmpty">Inspect an immutable handoff, then provide one profile, its exact instruction sources, one allowed model, and one same-project model data policy.</div><pre id="privacy-preflight-content" tabindex="0" hidden></pre><p id="privacy-preflight-error" class="error" role="alert"></p>
      <h3 id="pseudonymization-heading">Reversible privacy transformation / Trasformazione privacy reversibile</h3>
      <p class="notice">Local reviewed-span boundary / Boundary locale a intervalli revisionati: reuse the exact privacy inputs above, then bind every selection to item ID, content SHA-256, entity type, and UTF-8 byte range. Only encrypted mapping ciphertext is persisted. Source evidence is unchanged; this is not detection, permission, delivery, or execution.</p>
      <form id="pseudonymization-form"><label for="pseudonym-mapping-id">New mapping-set identity / Nuova identità mapping set</label><input id="pseudonym-mapping-id" required maxlength="256" autocomplete="off"><label for="pseudonym-selections">Reviewed selection JSON array / Array JSON delle selezioni revisionate</label><p class="help">Each entry / Ogni voce: {"itemId":"…","contentSha256":"64 lowercase hex","byteStart":0,"byteEnd":4,"entityType":"CUSTOMER"}. Types: PERSON, CUSTOMER, EMAIL, BUSINESS_IDENTIFIER, OTHER.</p><textarea id="pseudonym-selections" required spellcheck="false"></textarea><label for="pseudonym-custody-mode">Local key custody / Custodia locale della chiave</label><select id="pseudonym-custody-mode" required><option value="PASSPHRASE_WRAPPING">Passphrase-wrapped local key / Chiave locale protetta da passphrase</option></select><label for="pseudonym-passphrase">Custody passphrase, 16–1024 UTF-8 bytes / Passphrase di custodia, 16–1024 byte UTF-8</label><input id="pseudonym-passphrase" type="password" required minlength="16" maxlength="1024" autocomplete="new-password" spellcheck="false"><button type="submit">Transform, encrypt mapping, and verify locally / Trasforma, cifra il mapping e verifica localmente</button><p class="effect">Effect / Effetto: generates one mapping key and stores only an immutable authenticated passphrase-wrapped envelope plus schema-v1 mapping ciphertext. Back up both encrypted directories and retain the passphrase offline; losing either is irrecoverable. The passphrase is cleared after every attempt.</p></form>
      <div id="pseudonymization-status" role="status" aria-live="polite">Run and inspect the exact privacy preflight first / Esegui e ispeziona prima il preflight privacy esatto.</div><pre id="pseudonymization-content" tabindex="0" hidden></pre><p id="pseudonymization-error" class="error" role="alert"></p>
      <h3 id="context-selector-report-heading" data-i18n="contextSelectorReport">Measure profile context selectors</h3>
      <p class="notice" data-i18n="contextSelectorWarning">Experiment only: selectors map only to documented handoff sections. Objective, repository, next action, and source references form a non-excludable safety floor. This report does not change Context Builder policy.</p><p class="help" data-i18n="contextSelectorVocabulary">Accepted selectors: handoff.objective, handoff.repository, handoff.selected_memory, handoff.known_failures, handoff.test_state, handoff.relevant_files, handoff.next_action, handoff.source_references.</p>
      <form id="context-selector-form"><label for="context-selector-profile-path" data-i18n="profilePath">Reviewed schema-v1 agent profile bundle path</label><input id="context-selector-profile-path" required autocomplete="off" spellcheck="false"><label for="context-selector-profile-digest" data-i18n="profileDigest">Expected SHA-256 digest (optional pin)</label><input id="context-selector-profile-digest" pattern="[a-f0-9]{64}" autocomplete="off" spellcheck="false"><button type="submit" data-i18n="previewContextSelectors">Preview selector measurement read-only</button></form>
      <div id="context-selector-status" role="status" aria-live="polite" data-i18n="contextSelectorEmpty">Inspect an immutable handoff, then select one reviewed profile that uses only the experiment-only handoff selector vocabulary.</div><pre id="context-selector-content" tabindex="0" hidden></pre><p id="context-selector-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="artifact-heading" id="artifact-detail" hidden>
      <h2 id="artifact-heading" tabindex="-1" data-i18n="artifact">Integrity-verified source evidence</h2>
      <p class="notice"><strong>UNTRUSTED source:</strong> displayed as inert bounded text after SHA-256 verification.</p>
      <p id="artifact-metadata"></p>
      <pre id="artifact-content" tabindex="0"></pre>
      <button id="artifact-back" type="button">Return to canonical event</button>
      <p id="artifact-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="capabilities-heading">
      <h2 id="capabilities-heading" data-i18n="capabilities">Product capability map</h2>
      <ul><li><strong>Available now:</strong> English/Italian GUI, Projects, safe sample import, history search, source inspection, active memory, Work Items, immutable handoffs, and effective-instruction preview.</li><li><strong>Not active:</strong> Agents, models, tools, external network, handoff evaluation, instruction enforcement, and instruction execution.</li></ul>
    </section>
  </main>
  <footer><p>CLI is optional for automation and diagnostics. This journey does not require command knowledge or a manual.</p></footer>
</body>
</html>`;
}

export const APP_CSS = `
:root { font-family: system-ui, sans-serif; line-height: 1.5; color-scheme: light dark; --accent: #0b6bcb; --border: #77808a; }
* { box-sizing: border-box; }
body { margin: 0; max-width: 76rem; margin-inline: auto; padding: 1rem; }
header, nav, main, footer { margin-block: 1rem; }
section { border: 1px solid var(--border); border-radius: .75rem; padding: 1rem; margin-block: 1rem; }
.eyebrow { font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
.progress { display: flex; flex-wrap: wrap; gap: .75rem; padding: 0; list-style: none; }
.progress li { border: 1px solid var(--border); border-radius: 999px; padding: .35rem .7rem; }
.progress [aria-current] { border-width: 3px; font-weight: 700; }
label { display: block; font-weight: 700; }
input, select, textarea { width: min(100%, 48rem); padding: .7rem; font: inherit; display: block; margin-block-end: .75rem; }
input[type="checkbox"] { display: inline-block; width: auto; margin-inline-end: .5rem; }
fieldset { max-width: 48rem; margin-block: .75rem; }
button { display: inline-block; margin-block: .75rem; padding: .65rem 1rem; font: inherit; font-weight: 700; cursor: pointer; }
button:focus-visible, input:focus-visible, [tabindex="-1"]:focus { outline: 4px solid #f0a500; outline-offset: 3px; }
.help, .effect { max-width: 68ch; }
.notice { border-inline-start: .4rem solid var(--accent); padding-inline-start: .8rem; }
.error { font-weight: 700; }
.project-card { border-block-start: 1px solid var(--border); padding-block: .75rem; }
.result-card { border-block-start: 1px solid var(--border); padding-block: .75rem; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; border: 1px solid var(--border); padding: .75rem; max-height: 30rem; overflow: auto; }
.skip-link { position: absolute; transform: translateY(-200%); }
.skip-link:focus { position: static; transform: none; }
@media (max-width: 38rem) { body { padding: .5rem; } .progress { display: block; } .progress li { margin-block: .4rem; } button { width: 100%; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; } }
`;

export const APP_JS = `
(() => {
  "use strict";
  const catalogs = ${JSON.stringify(GUI_CATALOGS)};
  const localeKey = "aiw-locale";
  const supported = new Set(Object.keys(catalogs));
  const originalText = new WeakMap();
  const browserLocale = (navigator.languages || [navigator.language || "en"]).map((value) => value.toLowerCase().split("-")[0]).find((value) => supported.has(value));
  let locale = supported.has(localStorage.getItem(localeKey)) ? localStorage.getItem(localeKey) : (browserLocale || "en");
  const message = (key, parameters = {}) => { const template = catalogs[locale][key] || catalogs.en[key]; return template.replace(/\\{([a-zA-Z][a-zA-Z0-9]*)\\}/gu, (_, name) => String(parameters[name] || "").replace(/[\\u0000-\\u001f\\u007f-\\u009f]/gu, "�")); };
  const applyLocale = () => { document.documentElement.lang = locale; document.getElementById("gui-language").value = locale; const translations = new Map(Object.keys(catalogs.en).map((key) => [catalogs.en[key], catalogs[locale][key]])); const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); while (walker.nextNode()) { const node = walker.currentNode; if (!originalText.has(node)) originalText.set(node, node.nodeValue); const original = originalText.get(node); const trimmed = original.trim(); const translated = translations.get(trimmed); if (translated) node.nodeValue = original.replace(trimmed, translated); } for (const element of document.querySelectorAll("[data-i18n]")) text(element, message(element.dataset.i18n)); };
  const csrf = document.querySelector('meta[name="aiw-csrf"]').content;
  const status = document.getElementById("project-status");
  const list = document.getElementById("project-list");
  const error = document.getElementById("project-error");
  const guidance = document.getElementById("next-guidance");
  const nextStep = document.getElementById("next-step");
  const importSection = document.getElementById("import");
  const importStatus = document.getElementById("import-status");
  const importError = document.getElementById("import-error");
  const generalStatus = document.getElementById("general-status");
  const generalError = document.getElementById("general-error");
  const generalList = document.getElementById("general-list");
  const searchSection = document.getElementById("search");
  const searchStatus = document.getElementById("search-status");
  const searchError = document.getElementById("search-error");
  const searchResults = document.getElementById("search-results");
  const eventSection = document.getElementById("event-detail");
  const artifactSection = document.getElementById("artifact-detail");
  const memorySection = document.getElementById("memory");
  const memoryDetail = document.getElementById("memory-detail");
  const memoryStatus = document.getElementById("memory-status");
  const memoryError = document.getElementById("memory-error");
  const memoryList = document.getElementById("memory-list");
  const workSection = document.getElementById("work-items");
  const workDetail = document.getElementById("work-detail");
  const handoffBuilder = document.getElementById("handoff-builder");
  const handoffDetail = document.getElementById("handoff-detail");
  const instructionSection = document.getElementById("instructions");
  const agentProfileSection = document.getElementById("agent-profile");
  const contextSection = document.getElementById("context-pack");
  let selectedProject = sessionStorage.getItem("aiw-project");
  let registeredProjects = new Map();
  let selectedEvent = null;
  let selectedMemory = null;
  let selectedWork = null;
  let selectedHandoff = null;
  let selectedGeneral = null;
  let selectedGeneralEvent = null;
  let reviewedHandoffInput = null;
  const selectedHandoffMemoryIds = new Set();
  const text = (element, value) => { element.textContent = value; };
  document.getElementById("gui-language").addEventListener("change", (event) => { locale = supported.has(event.target.value) ? event.target.value : "en"; localStorage.setItem(localeKey, locale); applyLocale(); });
  const api = async (path, options = {}) => {
    const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", "X-AI-Workspace-CSRF": csrf, ...(options.headers || {}) } });
    const value = await response.json();
    if (!response.ok) throw new Error(value.message + " " + value.recovery);
    return value;
  };
  const selectProject = (project, focusNext = true) => { selectedProject = project.id; sessionStorage.setItem("aiw-project", project.id); text(guidance, message("selectedProject")); importSection.hidden = false; memorySection.hidden = false; workSection.hidden = false; instructionSection.hidden = false; agentProfileSection.hidden = false; text(importStatus, message("readyImport", { name: project.name })); loadMemory(); loadWork(); if (focusNext) nextStep.focus(); };
  const renderProjects = (projects) => {
    registeredProjects = new Map(projects.map((project) => [project.id, project]));
    for (const selectId of ["general-link-project", "search-associated-project"]) {
      const target = document.getElementById(selectId); const previous = target.value; target.replaceChildren();
      if (selectId === "search-associated-project") { const empty = document.createElement("option"); empty.value = ""; text(empty, "No association filter / Nessun filtro associazione"); target.append(empty); }
      for (const project of projects) { const option = document.createElement("option"); option.value = project.id; text(option, project.name + " · PROJECT · " + project.id); target.append(option); }
      if ([...target.options].some((option) => option.value === previous)) target.value = previous;
    }
    list.replaceChildren();
    if (projects.length === 0) { text(status, "No projects yet. Enter a local Git repository directory below."); return; }
    text(status, projects.length === 1 ? message("projectRegistered") : message("projectsRegistered", { count: String(projects.length) }));
    for (const project of projects) {
      const article = document.createElement("article"); article.className = "project-card";
      const heading = document.createElement("h3"); text(heading, project.name); article.append(heading);
      const details = document.createElement("p"); text(details, "Software repository · branch " + (project.branch || "detached") + " · " + (project.isDirty ? "uncommitted changes present" : "working tree clean")); article.append(details);
      const select = document.createElement("button"); select.type = "button"; text(select, message("selectProject", { name: project.name }));
      select.addEventListener("click", () => selectProject(project));
      const inspect = document.createElement("button"); inspect.type = "button"; text(inspect, message("refreshGit"));
      inspect.addEventListener("click", async () => { try { text(status, "Refreshing bounded Git metadata…"); await api("/api/projects/" + encodeURIComponent(project.id) + "/inspect", { method: "POST", body: "{}" }); await loadProjects(); } catch (cause) { text(error, cause.message); error.focus?.(); } });
      article.append(select, inspect); list.append(article);
    }
  };
  const loadProjects = async () => { try { renderProjects(await api("/api/projects")); } catch (cause) { text(status, "Projects could not be loaded."); text(error, cause.message); } };
  document.getElementById("register-project-form").addEventListener("submit", async (event) => {
    event.preventDefault(); text(error, ""); text(status, "Validating the local Git repository…");
    const input = document.getElementById("project-path");
    try { const project = await api("/api/projects", { method: "POST", body: JSON.stringify({ path: input.value }) }); input.value = ""; await loadProjects(); text(guidance, project.name + " is ready. Select it to continue."); nextStep.focus(); }
    catch (cause) { text(status, "Project registration needs attention."); text(error, cause.message); input.focus(); }
  });
  document.getElementById("import-sample").addEventListener("click", async () => {
    if (!selectedProject) { text(importError, "Select a registered project first."); document.getElementById("projects-heading").focus(); return; }
    text(importError, ""); text(importStatus, "Importing the reviewed synthetic session locally…");
    try { const report = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/import-sample", { method: "POST", body: "{}" }); text(importStatus, report.effect + " Added " + report.addedEvents + ", unchanged " + report.existingEvents + ", total " + report.totalEvents + ". " + report.nextAction); text(guidance, "Safe sample ready. Continue to Search project history."); searchSection.hidden = false; document.getElementById("search-heading").focus(); }
    catch (cause) { text(importStatus, "Sample import needs attention."); text(importError, cause.message); document.getElementById("import-sample").focus(); }
  });
  const renderGeneral = (conversations) => {
    generalList.replaceChildren();
    text(generalStatus, conversations.length ? "Showing " + conversations.length + " bounded General conversation(s)." : "General Inbox is empty. Create an explicit project-free conversation above.");
    for (const conversation of conversations) {
      const article = document.createElement("article"); article.className = "result-card";
      const heading = document.createElement("h3"); text(heading, "GENERAL · " + conversation.title);
      const state = document.createElement("p"); text(state, conversation.events.length + " immutable USER_MESSAGE event(s) · CONFIDENTIAL · UNVERIFIED");
      const select = document.createElement("button"); select.type = "button"; text(select, "Append a question here / Aggiungi qui una domanda");
      select.addEventListener("click", () => { selectedGeneral = conversation; const form = document.getElementById("general-append-form"); form.hidden = false; text(document.getElementById("general-destination"), "Destination / Destinazione: GENERAL · " + conversation.title + " · " + conversation.id); document.getElementById("general-question").focus(); });
      article.append(heading, state);
      for (const event of conversation.events) {
        const body = document.createElement("p"); text(body, event.content);
        const metadata = document.createElement("p"); text(metadata, event.occurredAt + " · LOCAL_USER · USER_AUTHORED · " + event.exactBytes + " UTF-8 bytes · SHA-256 " + event.contentSha256);
        const copy = document.createElement("button"); copy.type = "button"; text(copy, "Copy safe search phrase / Copia frase di ricerca");
        copy.addEventListener("click", async () => { const phrase = event.content.slice(0, 80); await navigator.clipboard?.writeText(phrase); document.getElementById("search-query").value = phrase; document.getElementById("search-scope").value = "GENERAL"; text(generalStatus, "Search phrase prepared; review it in Search before submitting."); });
        const link = document.createElement("button"); link.type = "button"; text(link, "Link to PROJECT / Collega a PROJECT");
        link.addEventListener("click", () => { selectedGeneral = conversation; selectedGeneralEvent = event; const form = document.getElementById("general-link-form"); form.hidden = false; text(document.getElementById("general-link-source"), "Source GENERAL / Sorgente GENERAL: " + conversation.id + " · event " + event.id + " · exact SHA-256 " + event.contentSha256 + ". Target PROJECT must be reviewed explicitly; link only."); document.getElementById("general-link-project").focus(); });
        article.append(body, metadata, copy, link);
      }
      article.append(select); generalList.append(article);
    }
  };
  const loadGeneral = async () => { text(generalError, ""); try { renderGeneral(await api("/api/general/conversations")); } catch (cause) { text(generalStatus, "General state needs attention; no partial conversations are shown."); text(generalError, cause.message); } };
  document.getElementById("general-create-form").addEventListener("submit", async (event) => { event.preventDefault(); const input = document.getElementById("general-title"); text(generalError, ""); try { selectedGeneral = await api("/api/general/conversations", { method: "POST", body: JSON.stringify({ title: input.value }) }); input.value = ""; await loadGeneral(); const form = document.getElementById("general-append-form"); form.hidden = false; text(document.getElementById("general-destination"), "Destination / Destinazione: GENERAL · " + selectedGeneral.title + " · " + selectedGeneral.id); document.getElementById("general-question").focus(); } catch (cause) { text(generalError, cause.message); input.focus(); } });
  document.getElementById("general-append-form").addEventListener("submit", async (event) => { event.preventDefault(); const input = document.getElementById("general-question"); if (!selectedGeneral) return; text(generalError, ""); try { selectedGeneral = await api("/api/general/conversations/" + encodeURIComponent(selectedGeneral.id) + "/events", { method: "POST", body: JSON.stringify({ expectedEventCount: selectedGeneral.events.length, content: input.value }) }); input.value = ""; await loadGeneral(); text(generalStatus, "Question saved locally in GENERAL. No model was called and no answer was created."); } catch (cause) { text(generalError, cause.message); input.focus(); } });
  document.getElementById("general-link-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("general-link-error"); text(error, ""); if (!selectedGeneral || !selectedGeneralEvent) { text(error, "Reload and select an exact General event / Ricarica e seleziona un evento General esatto."); return; } const project = document.getElementById("general-link-project"); const rationale = document.getElementById("general-link-rationale"); try { const link = await api("/api/general/project-links", { method: "POST", body: JSON.stringify({ generalConversationId: selectedGeneral.id, generalEventId: selectedGeneralEvent.id, generalContentSha256: selectedGeneralEvent.contentSha256, targetProjectId: project.value, rationale: rationale.value }) }); rationale.value = ""; text(generalStatus, "LINK_ONLY created / Link creato: GENERAL → PROJECT " + link.targetProjectId + " · " + link.id + ". Original evidence is unchanged / Evidenza originale invariata."); } catch (cause) { text(error, cause.message + " Recovery / Ripristino: reload the immutable event and project / ricarica evento immutabile e progetto; review a stale hash or duplicate / controlla hash obsoleto o duplicato; remove restricted data / rimuovi dati riservati; preserve corrupt state for diagnosis / conserva lo stato corrotto per la diagnosi. No partial link was used / Nessun link parziale è stato usato."); rationale.focus(); } });
  const syncSearchType = () => { const selectedOnly = document.getElementById("search-scope").value === "SELECTED"; const type = document.getElementById("search-type"); const association = document.getElementById("search-associated-project"); type.disabled = !selectedOnly; association.disabled = selectedOnly; if (!selectedOnly) type.value = ""; if (selectedOnly) association.value = ""; };
  document.getElementById("search-scope").addEventListener("change", syncSearchType);
  syncSearchType();
  const showEvent = async (projectId, eventId) => { try { selectedEvent = eventId; const value = await api("/api/projects/" + encodeURIComponent(projectId) + "/events/" + encodeURIComponent(eventId)); const metadata = document.getElementById("event-metadata"); metadata.replaceChildren(); for (const [label, content] of [["Type", value.type], ["Trust", value.trust], ["Session", value.sessionId], ["Occurred", value.occurredAt || "Unknown"], ["Source position", String(value.sourcePosition)]]) { const term = document.createElement("dt"); text(term, label); const detail = document.createElement("dd"); text(detail, content); metadata.append(term, detail); } text(document.getElementById("event-payload"), value.payload); eventSection.hidden = false; artifactSection.hidden = true; document.getElementById("event-heading").focus(); } catch (cause) { text(searchError, cause.message); } };
  document.getElementById("search-form").addEventListener("submit", async (event) => { event.preventDefault(); const scope = document.getElementById("search-scope").value; if (scope === "SELECTED" && !selectedProject) { text(searchError, message("selectedScopeRequiresProject")); document.getElementById("search-scope").focus(); return; } text(searchError, ""); text(searchStatus, scope === "SELECTED" ? message("searchingSelected") : "Searching bounded canonical evidence in " + (scope === "GENERAL" ? "GENERAL_ONLY" : "ALL_SCOPES") + "…"); searchResults.replaceChildren(); const query = document.getElementById("search-query").value; const typeValue = document.getElementById("search-type").value; const limit = document.getElementById("search-limit").value; const parameters = new URLSearchParams({ q: query, limit }); if (typeValue && scope === "SELECTED") parameters.set("type", typeValue); const associated = document.getElementById("search-associated-project").value; if (associated && scope !== "SELECTED") parameters.set("associatedProjectId", associated); try { const path = scope === "SELECTED" ? "/api/projects/" + encodeURIComponent(selectedProject) + "/search?" + parameters : "/api/scoped-search?scope=" + (scope === "GENERAL" ? "GENERAL_ONLY" : "ALL_SCOPES") + "&" + parameters; const report = await api(path); text(searchStatus, report.results.length === 0 ? "No literal match in the requested scope or explicit association filter. Check spelling, links, or project registration." : "Found " + report.results.length + " result(s) after scanning " + report.searchedEvents + " event(s); the global limit was applied after scope merge."); for (const result of report.results) { const projectId = result.projectId || selectedProject; const project = result.scope === "PROJECT" ? registeredProjects.get(projectId) : null; const isGeneral = result.scope === "GENERAL"; const article = document.createElement("article"); article.className = "result-card"; const heading = document.createElement("h3"); text(heading, (isGeneral ? "GENERAL" : "PROJECT") + " · " + result.type + " · " + result.trust); const scopeLabel = document.createElement("p"); text(scopeLabel, isGeneral ? "Source GENERAL / Sorgente GENERAL: " + result.conversationId + " · USER_AUTHORED · CONFIDENTIAL · exact SHA-256 " + result.contentSha256 : message("resultProject", { name: result.projectName || project?.name || "Selected project", id: projectId })); const snippet = document.createElement("p"); text(snippet, result.snippet); article.append(heading, scopeLabel, snippet); if (isGeneral) for (const link of result.links || []) { const linked = document.createElement("p"); text(linked, "Target PROJECT / Destinazione PROJECT: " + link.targetProjectId + " · " + link.actor + " · " + link.verification + " · " + link.effect + " · " + link.createdAt + " · rationale / motivazione: " + link.rationale); article.append(linked); } if (!isGeneral) { const inspect = document.createElement("button"); inspect.type = "button"; text(inspect, message("inspectEvent")); inspect.addEventListener("click", async () => { if (result.scope === "PROJECT" && project) selectProject(project, false); await showEvent(projectId, result.eventId); }); article.append(inspect); } else { const open = document.createElement("button"); open.type = "button"; text(open, "Open General Inbox / Apri Posta generale"); open.addEventListener("click", () => { document.getElementById("general-heading").focus(); }); article.append(open); } searchResults.append(article); } } catch (cause) { text(searchStatus, message("searchAttention")); text(searchError, cause.message); document.getElementById("search-query").focus(); } });
  document.getElementById("open-source").addEventListener("click", async () => { if (!selectedProject || !selectedEvent) return; const artifactError = document.getElementById("artifact-error"); text(artifactError, ""); try { const value = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/events/" + encodeURIComponent(selectedEvent) + "/source"); text(document.getElementById("artifact-metadata"), value.byteLength + " UTF-8 bytes · " + value.trust + " · " + value.artifactId); text(document.getElementById("artifact-content"), value.content); artifactSection.hidden = false; document.getElementById("artifact-heading").focus(); } catch (cause) { text(artifactError, cause.message); document.getElementById("open-source").focus(); } });
  document.getElementById("back-to-results").addEventListener("click", () => { eventSection.hidden = true; document.getElementById("search-heading").focus(); });
  document.getElementById("artifact-back").addEventListener("click", () => { artifactSection.hidden = true; document.getElementById("event-heading").focus(); });
  const memoryPath = () => "/api/projects/" + encodeURIComponent(selectedProject) + "/memory";
  const sourceIds = () => selectedEvent ? [selectedEvent] : [];
  const renderHandoffMemoryOptions = (items) => { const options = document.getElementById("handoff-memory-options"); options.replaceChildren(); const activeIds = new Set(items.map((item) => item.id)); for (const id of selectedHandoffMemoryIds) if (!activeIds.has(id)) selectedHandoffMemoryIds.delete(id); if (items.length === 0) { const empty = document.createElement("p"); text(empty, "No ACTIVE memory is available. The handoff will record an explicit empty selection."); options.append(empty); return; } for (const item of items) { const label = document.createElement("label"); const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.value = item.id; checkbox.checked = selectedHandoffMemoryIds.has(item.id); checkbox.addEventListener("change", () => { if (checkbox.checked) selectedHandoffMemoryIds.add(item.id); else selectedHandoffMemoryIds.delete(item.id); reviewedHandoffInput = null; document.getElementById("handoff-create").hidden = true; }); const description = document.createTextNode(item.type + " · " + item.verification + " · " + item.content); label.append(checkbox, description); options.append(label); } };
  const loadMemory = async () => { if (!selectedProject) return; text(memoryError, ""); text(memoryStatus, message("loadingMemory")); memoryList.replaceChildren(); const validity = document.getElementById("memory-validity").value; const parameters = new URLSearchParams({ limit: "20" }); if (validity) parameters.set("validity", validity); try { const page = await api(memoryPath() + "?" + parameters); if (!validity) renderHandoffMemoryOptions(page.items); text(memoryStatus, page.items.length === 0 ? message("noMatchingMemory") : message("showingMemory", { count: String(page.items.length) }) + (page.nextCursor ? " " + message("moreMemory") : "")); for (const item of page.items) { const article = document.createElement("article"); article.className = "memory-card"; const heading = document.createElement("h3"); text(heading, item.type + " · " + item.validity); const content = document.createElement("p"); text(content, item.content); const state = document.createElement("p"); text(state, item.curation + " · " + item.verification + " · " + item.confidence + " · version " + item.version); const inspect = document.createElement("button"); inspect.type = "button"; text(inspect, message("inspectMemory")); inspect.addEventListener("click", () => showMemory(item.id)); article.append(heading, content, state, inspect); memoryList.append(article); } } catch (cause) { text(memoryStatus, message("memoryAttention")); text(memoryError, cause.message); } };
  const showMemory = async (memoryId) => { try { const item = await api(memoryPath() + "/" + encodeURIComponent(memoryId)); selectedMemory = item.id; const metadata = document.getElementById("memory-metadata"); metadata.replaceChildren(); for (const [label, content] of [["Type", item.type], ["Curation", item.curation], ["Validity", item.validity], ["Verification", item.verification], ["Confidence", item.confidence], ["Version", String(item.version)], ["Created", item.createdAt]]) { const term = document.createElement("dt"); text(term, label); const detail = document.createElement("dd"); text(detail, content); metadata.append(term, detail); } text(document.getElementById("memory-detail-content"), item.content); const sources = document.getElementById("memory-sources"); sources.replaceChildren(); for (const source of item.sources) { const entry = document.createElement("li"); text(entry, "UNTRUSTED event " + source.eventId + " · " + source.eventType + " · position " + source.sourcePosition); sources.append(entry); } const terminal = item.validity !== "ACTIVE"; document.getElementById("memory-verify-form").hidden = terminal || item.verification === "VERIFIED"; document.getElementById("memory-supersede-form").hidden = terminal; document.getElementById("memory-invalidate-form").hidden = terminal; memoryDetail.hidden = false; document.getElementById("memory-detail-heading").focus(); } catch (cause) { text(memoryError, cause.message); } };
  document.getElementById("use-memory-source").addEventListener("click", () => { if (!selectedEvent) return; memorySection.hidden = false; text(document.getElementById("memory-source-status"), "Selected UNTRUSTED canonical event " + selectedEvent + " as provenance for the next explicit memory action."); document.getElementById("memory-heading").focus(); });
  document.getElementById("memory-add-form").addEventListener("submit", async (event) => { event.preventDefault(); if (!selectedProject || !selectedEvent) { text(memoryError, "Inspect an event and select it as memory evidence first."); return; } try { const item = await api(memoryPath(), { method: "POST", body: JSON.stringify({ type: document.getElementById("memory-type").value, content: document.getElementById("memory-content").value, sourceEventIds: sourceIds() }) }); document.getElementById("memory-content").value = ""; text(memoryStatus, "Created " + item.type + " as ACTIVE, UNVERIFIED, UNASSESSED USER_CURATED memory."); await loadMemory(); await showMemory(item.id); } catch (cause) { text(memoryError, cause.message); document.getElementById("memory-content").focus(); } });
  document.getElementById("memory-filter-form").addEventListener("submit", (event) => { event.preventDefault(); loadMemory(); });
  const transition = async (action, field, property) => { const detailError = document.getElementById("memory-detail-error"); if (!selectedMemory || !selectedEvent) { text(detailError, "Select canonical evidence before this lifecycle action."); return; } try { const value = document.getElementById(field).value; const result = await api(memoryPath() + "/" + encodeURIComponent(selectedMemory) + "/" + action, { method: "POST", body: JSON.stringify({ [property]: value, sourceEventIds: sourceIds() }) }); document.getElementById(field).value = ""; const item = result.replacement || result; await loadMemory(); await showMemory(item.id); } catch (cause) { text(detailError, cause.message); document.getElementById(field).focus(); } };
  document.getElementById("memory-verify-form").addEventListener("submit", (event) => { event.preventDefault(); transition("verify", "memory-note", "note"); });
  document.getElementById("memory-supersede-form").addEventListener("submit", (event) => { event.preventDefault(); transition("supersede", "memory-replacement", "content"); });
  document.getElementById("memory-invalidate-form").addEventListener("submit", (event) => { event.preventDefault(); transition("invalidate", "memory-reason", "reason"); });
  document.getElementById("memory-back").addEventListener("click", () => { memoryDetail.hidden = true; document.getElementById("memory-heading").focus(); });
  const workPath = () => "/api/projects/" + encodeURIComponent(selectedProject) + "/work-items";
  const loadWork = async () => { if (!selectedProject) return; const list = document.getElementById("work-list"); list.replaceChildren(); try { const items = await api(workPath()); text(document.getElementById("work-status"), items.length ? message("showingWork", { count: String(items.length) }) : message("noWorkItems")); for (const item of items) { const article = document.createElement("article"); article.className = "work-card"; const heading = document.createElement("h3"); text(heading, item.status + " · version " + item.version); const objective = document.createElement("p"); text(objective, item.objective); const inspect = document.createElement("button"); inspect.type = "button"; text(inspect, message("inspectWork")); inspect.addEventListener("click", () => showWork(item.id)); article.append(heading, objective, inspect); list.append(article); } } catch (cause) { text(document.getElementById("work-error"), cause.message); } };
  const loadHandoffs = async () => { if (!selectedWork) return; const list = document.getElementById("handoff-list"); list.replaceChildren(); const values = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs"); for (const value of values) { const button = document.createElement("button"); button.type = "button"; text(button, message("inspectHandoff", { id: value.id })); button.addEventListener("click", () => showHandoff(value.id)); list.append(button); } };
  const showWork = async (id) => { try { const item = await api(workPath() + "/" + encodeURIComponent(id)); selectedWork = item.id; const metadata = document.getElementById("work-metadata"); metadata.replaceChildren(); for (const [label, value] of [["Status", item.status], ["Version", String(item.version)], ["Created by", item.createdBy], ["Updated", item.updatedAt]]) { const dt = document.createElement("dt"); text(dt, label); const dd = document.createElement("dd"); text(dd, value); metadata.append(dt, dd); } text(document.getElementById("work-objective-detail"), item.objective); const history = document.getElementById("work-transitions"); history.replaceChildren(); for (const transition of item.transitions) { const entry = document.createElement("li"); text(entry, transition.from + " → " + transition.to + " by " + transition.actor + " at " + transition.occurredAt); history.append(entry); } const allowed = item.status === "PROPOSED" ? ["activate", "block"] : item.status === "ACTIVE" ? ["block", "complete"] : item.status === "BLOCKED" ? ["complete"] : ["reopen"]; const actionKeys = { activate: "activateWork", block: "blockWork", complete: "completeWork", reopen: "reopenWork" }; const actions = document.getElementById("work-actions"); actions.replaceChildren(); for (const action of allowed) { const button = document.createElement("button"); button.type = "button"; text(button, message(actionKeys[action])); button.addEventListener("click", () => transitionWork(action)); actions.append(button); } workDetail.hidden = false; handoffBuilder.hidden = item.status !== "ACTIVE"; if (item.status === "ACTIVE") loadHandoffs(); document.getElementById("work-detail-heading").focus(); } catch (cause) { text(document.getElementById("work-error"), cause.message); } };
  const transitionWork = async (action) => { const error = document.getElementById("work-detail-error"); if (!selectedEvent) { text(error, "Inspect and select current canonical evidence first."); return; } try { const item = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/" + action, { method: "POST", body: JSON.stringify({ sourceEventIds: [selectedEvent] }) }); await loadWork(); await showWork(item.id); } catch (cause) { text(error, cause.message); } };
  document.getElementById("work-create-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("work-error"); if (!selectedEvent) { text(error, "Inspect and select canonical evidence before creating a Work Item."); return; } try { const item = await api(workPath(), { method: "POST", body: JSON.stringify({ objective: document.getElementById("work-objective").value, sourceEventIds: [selectedEvent] }) }); document.getElementById("work-objective").value = ""; await loadWork(); await showWork(item.id); } catch (cause) { text(error, cause.message); document.getElementById("work-objective").focus(); } });
  document.getElementById("work-back").addEventListener("click", () => { workDetail.hidden = true; handoffBuilder.hidden = true; document.getElementById("work-heading").focus(); });
  const handoffInput = () => { const command = document.getElementById("handoff-test-command").value.trim(); return ({ nextAction: document.getElementById("handoff-next").value, sourceEventIds: selectedEvent ? [selectedEvent] : [], memoryIds: [...selectedHandoffMemoryIds].sort(), relevantFiles: document.getElementById("handoff-files").value.split(/\\r?\\n/u).map((value) => value.trim()).filter(Boolean), ...(command ? { testState: [{ command, outcome: document.getElementById("handoff-test-outcome").value, observedAt: document.getElementById("handoff-test-at").value.trim() || null }] } : {}), ...(document.getElementById("handoff-predecessor").value.trim() ? { predecessorId: document.getElementById("handoff-predecessor").value.trim() } : {}) }); };
  document.getElementById("handoff-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("handoff-error"); const previewContent = document.getElementById("handoff-preview-content"); text(error, ""); try { reviewedHandoffInput = handoffInput(); const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/preview", { method: "POST", body: JSON.stringify(reviewedHandoffInput) }); text(document.getElementById("handoff-preview-result"), "Preview only: schema " + value.measurement.schemaVersion + " · " + value.measurement.exactHandoffBytes + " exact UTF-8 bytes · " + value.handoff.sections.sourceReferences.value.length + " source reference(s). Review all eight inert sections below. No file was created."); text(previewContent, JSON.stringify(value.handoff, null, 2)); previewContent.hidden = false; document.getElementById("handoff-create").hidden = false; previewContent.focus(); } catch (cause) { reviewedHandoffInput = null; previewContent.hidden = true; document.getElementById("handoff-create").hidden = true; text(error, cause.message); } });
  document.getElementById("handoff-create").addEventListener("click", async () => { if (!reviewedHandoffInput) return; try { const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/create", { method: "POST", body: JSON.stringify(reviewedHandoffInput) }); reviewedHandoffInput = null; document.getElementById("handoff-create").hidden = true; await loadHandoffs(); await showHandoff(value.id); } catch (cause) { text(document.getElementById("handoff-error"), cause.message); } });
  const showHandoff = async (id) => { try { const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(id)); selectedHandoff = value.id; text(document.getElementById("handoff-content"), JSON.stringify(value, null, 2)); handoffDetail.hidden = false; contextSection.hidden = false; document.getElementById("handoff-detail-heading").focus(); } catch (cause) { text(document.getElementById("handoff-error"), cause.message); } };
  document.getElementById("handoff-validate").addEventListener("click", async () => { try { const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/validate"); text(document.getElementById("handoff-validation"), value.matches ? "MATCH: current bounded Git state matches the immutable snapshot." : "DRIFT: " + value.differences.join(", ") + ". " + value.recovery); } catch (cause) { text(document.getElementById("handoff-detail-error"), cause.message); } });
  document.getElementById("handoff-successor").addEventListener("click", () => { document.getElementById("handoff-predecessor").value = selectedHandoff || ""; handoffDetail.hidden = true; document.getElementById("handoff-builder-heading").focus(); });
  document.getElementById("handoff-back").addEventListener("click", () => { handoffDetail.hidden = true; document.getElementById("handoff-builder-heading").focus(); });
  document.getElementById("instructions-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("instruction-error"); const content = document.getElementById("instruction-content"); text(error, ""); if (!selectedProject) { text(error, message("instructionEmpty")); return; } const paths = document.getElementById("instruction-bundles").value.split(/\\r?\\n/u).map((value) => value.trim()).filter(Boolean); const optional = (id) => document.getElementById(id).value.trim() || undefined; try { const value = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/instructions/preview", { method: "POST", body: JSON.stringify({ bundles: paths.map((path) => ({ path })), model: optional("instruction-model"), agent: optional("instruction-agent"), task: optional("instruction-task") }) }); text(document.getElementById("instruction-status"), message("previewReady")); text(content, JSON.stringify(value, null, 2)); content.hidden = false; content.focus(); } catch (cause) { content.hidden = true; text(error, cause.message); document.getElementById("instruction-bundles").focus(); } });
  document.getElementById("agent-profile-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("agent-profile-error"); const content = document.getElementById("agent-profile-content"); text(error, ""); if (!selectedProject) { text(error, message("profileEmpty")); return; } const path = document.getElementById("agent-profile-path").value.trim(); const expectedDigest = document.getElementById("agent-profile-digest").value.trim(); try { const value = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/agent-profile/preview", { method: "POST", body: JSON.stringify({ path, ...(expectedDigest ? { expectedDigest } : {}) }) }); text(document.getElementById("agent-profile-status"), message("profileReady", { name: value.bundle.agent.name, skills: String(value.bundle.skills.length), sourceBytes: String(value.sourceBytes), canonicalBytes: String(value.canonicalBytes) })); text(content, JSON.stringify(value, null, 2)); content.hidden = false; content.focus(); } catch (cause) { content.hidden = true; text(error, cause.message); document.getElementById("agent-profile-path").focus(); } });
  document.getElementById("context-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("context-error"); const content = document.getElementById("context-content"); text(error, ""); if (!selectedProject || !selectedWork || !selectedHandoff) { text(error, message("contextEmpty")); return; } const paths = document.getElementById("context-bundles").value.split(/\\r?\\n/u).map((value) => value.trim()).filter(Boolean); try { const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/context/preview", { method: "POST", body: JSON.stringify({ bundles: paths.map((path) => ({ path })), continuityBudget: Number(document.getElementById("context-continuity-budget").value), instructionBudget: Number(document.getElementById("context-instruction-budget").value) }) }); const summary = value.sourceTableSummary || { entryCount: 0, exactBytes: 0 }; text(document.getElementById("context-status"), message("contextReady", { schema: String(value.schemaVersion), entries: String(summary.entryCount), sharedBytes: String(summary.exactBytes) })); text(content, JSON.stringify(value, null, 2)); content.hidden = false; content.focus(); } catch (cause) { content.hidden = true; text(error, cause.message); document.getElementById("context-continuity-budget").focus(); } });
  document.getElementById("profile-context-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("profile-context-error"); const content = document.getElementById("profile-context-content"); text(error, ""); if (!selectedProject || !selectedWork || !selectedHandoff) { text(error, message("profileContextEmpty")); return; } const path = document.getElementById("profile-context-path").value.trim(); const expectedDigest = document.getElementById("profile-context-digest").value.trim(); const paths = document.getElementById("profile-context-bundles").value.split(/\\r?\\n/u).map((value) => value.trim()).filter(Boolean); const model = document.getElementById("profile-context-model").value.trim(); const task = document.getElementById("profile-context-task").value.trim(); try { const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/profile-context/preview", { method: "POST", body: JSON.stringify({ profile: { path, ...(expectedDigest ? { expectedDigest } : {}) }, bundles: paths.map((bundlePath) => ({ path: bundlePath })), model, ...(task ? { task } : {}) }) }); text(document.getElementById("profile-context-status"), message("profileContextReady", { profile: value.selection.profile.id, model: value.selection.target.model, sources: String(value.selection.instructionSources.length), rules: String(value.instructions.rules.length), schema: String(value.contextPack.schemaVersion) })); text(content, JSON.stringify(value, null, 2)); content.hidden = false; content.focus(); } catch (cause) { content.hidden = true; text(error, cause.message); document.getElementById("profile-context-path").focus(); } });
  document.getElementById("privacy-preflight-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("privacy-preflight-error"); const content = document.getElementById("privacy-preflight-content"); text(error, ""); if (!selectedProject || !selectedWork || !selectedHandoff) { text(error, message("privacyPreflightEmpty")); return; } const profilePath = document.getElementById("privacy-profile-path").value.trim(); const profileDigest = document.getElementById("privacy-profile-digest").value.trim(); const policyPath = document.getElementById("privacy-policy-path").value.trim(); const policyDigest = document.getElementById("privacy-policy-digest").value.trim(); const paths = document.getElementById("privacy-bundles").value.split(/\\r?\\n/u).map((value) => value.trim()).filter(Boolean); const model = document.getElementById("privacy-model").value.trim(); const task = document.getElementById("privacy-task").value.trim(); try { const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/privacy-preflight/preview", { method: "POST", body: JSON.stringify({ profile: { path: profilePath, ...(profileDigest ? { expectedDigest: profileDigest } : {}) }, policy: { path: policyPath, ...(policyDigest ? { expectedDigest: policyDigest } : {}) }, bundles: paths.map((path) => ({ path })), model, ...(task ? { task } : {}) }) }); const counts = value.preflight.accounting; text(document.getElementById("privacy-preflight-status"), message("privacyPreflightReady", { result: value.preflight.overallResult, model: value.preflight.modelId, policy: value.preflight.policy.id, allowed: String(counts.allowedItems), blocked: String(counts.blockedItems), defaulted: String(counts.defaultedItems), restricted: String(counts.restrictedItems) })); text(content, JSON.stringify(value, null, 2)); content.hidden = false; content.focus(); } catch (cause) { content.hidden = true; text(error, cause.message); document.getElementById("privacy-policy-path").focus(); } });
  document.getElementById("pseudonymization-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("pseudonymization-error"); const content = document.getElementById("pseudonymization-content"); const passphraseField = document.getElementById("pseudonym-passphrase"); text(error, ""); if (!selectedProject || !selectedWork || !selectedHandoff) { text(error, "Inspect one immutable handoff first / Esamina prima un handoff immutabile."); return; } try { const profilePath = document.getElementById("privacy-profile-path").value.trim(); const profileDigest = document.getElementById("privacy-profile-digest").value.trim(); const policyPath = document.getElementById("privacy-policy-path").value.trim(); const policyDigest = document.getElementById("privacy-policy-digest").value.trim(); const paths = document.getElementById("privacy-bundles").value.split(/\\r?\\n/u).map((value) => value.trim()).filter(Boolean); const model = document.getElementById("privacy-model").value.trim(); const task = document.getElementById("privacy-task").value.trim(); const selections = JSON.parse(document.getElementById("pseudonym-selections").value); const review = { schemaVersion: 1, mappingSetId: document.getElementById("pseudonym-mapping-id").value.trim(), projectId: selectedProject, workItemId: selectedWork, handoffId: selectedHandoff, modelId: model, attribution: "USER_REVIEWED", selections }; const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/pseudonymization/preview", { method: "POST", body: JSON.stringify({ profile: { path: profilePath, ...(profileDigest ? { expectedDigest: profileDigest } : {}) }, policy: { path: policyPath, ...(policyDigest ? { expectedDigest: policyDigest } : {}) }, bundles: paths.map((path) => ({ path })), model, ...(task ? { task } : {}), review, keyCustody: { mode: document.getElementById("pseudonym-custody-mode").value, passphrase: passphraseField.value } }) }); const counts = value.transformation.accounting; text(document.getElementById("pseudonymization-status"), "Verified local round trip / Round trip locale verificato: " + counts.reviewedSelections + " reviewed selection(s), " + counts.transformedItems + " transformed item(s), mapping " + value.mapping.mappingSetId + " stored as authenticated ciphertext with passphrase-wrapped local custody. Not authorized or delivered / Non autorizzato né inviato."); text(content, JSON.stringify(value, null, 2)); content.hidden = false; content.focus(); } catch (cause) { content.hidden = true; text(error, cause.message); document.getElementById("pseudonym-selections").focus(); } finally { passphraseField.value = ""; } });
  document.getElementById("context-selector-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("context-selector-error"); const content = document.getElementById("context-selector-content"); text(error, ""); if (!selectedProject || !selectedWork || !selectedHandoff) { text(error, message("contextSelectorEmpty")); return; } const path = document.getElementById("context-selector-profile-path").value.trim(); const expectedDigest = document.getElementById("context-selector-profile-digest").value.trim(); try { const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/context-selectors/preview", { method: "POST", body: JSON.stringify({ profile: { path, ...(expectedDigest ? { expectedDigest } : {}) } }) }); const measured = value.report.cases[0]; const budget = measured.budgets[0]; text(document.getElementById("context-selector-status"), message("contextSelectorReady", { selected: String(measured.selectedCandidateBytes), baseline: String(measured.baselineCandidateBytes), reduction: String(measured.reductionPercentFromBaseline), loss: String(measured.safetyFloorLossCount), fit: budget.selectorPolicyFits ? "YES" : "NO" })); text(content, JSON.stringify(value, null, 2)); content.hidden = false; content.focus(); } catch (cause) { content.hidden = true; text(error, cause.message); document.getElementById("context-selector-profile-path").focus(); } });
  if (selectedProject) { importSection.hidden = false; memorySection.hidden = false; workSection.hidden = false; instructionSection.hidden = false; agentProfileSection.hidden = false; text(importStatus, message("returningImport")); loadMemory(); loadWork(); }
  applyLocale();
  loadGeneral();
  loadProjects();
})();
`;

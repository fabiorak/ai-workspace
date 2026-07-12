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
  <a class="skip-link" href="#main">Skip to the guided workflow</a>
  <header><p class="eyebrow">Local-first control plane</p><h1>AI Workspace</h1><p>Your project data stays on this computer. This guided alpha makes no external requests.</p></header>
  <nav aria-label="Journey progress"><ol class="progress"><li aria-current="step">1. Project</li><li>2. Safe sample</li><li>3. Search</li><li>4. Inspect source</li></ol></nav>
  <main id="main" tabindex="-1">
    <section aria-labelledby="welcome-heading" id="welcome">
      <h2 id="welcome-heading" tabindex="-1">Start with one local project</h2>
      <p>Registering stores bounded Git metadata locally. It does not copy or modify repository files.</p>
      <p class="notice"><strong>What happens next:</strong> after selecting a project, the interface guides you through a fictional sample import and evidence search.</p>
    </section>
    <section aria-labelledby="projects-heading" id="projects">
      <h2 id="projects-heading" tabindex="-1">Projects</h2>
      <div id="project-status" role="status" aria-live="polite">Loading local projects…</div>
      <form id="register-project-form">
        <label for="project-path">Local Git repository directory</label>
        <p id="project-path-help" class="help">Enter an existing directory. The path is used only for registration and is not shown in routine project lists.</p>
        <input id="project-path" name="path" required aria-describedby="project-path-help project-error" autocomplete="off" spellcheck="false">
        <button type="submit">Register this project</button>
        <p id="project-effect" class="effect">Effect: creates or refreshes one local Project Registry entry; repository content is unchanged.</p>
        <p id="project-error" class="error" role="alert"></p>
      </form>
      <div id="project-list" aria-label="Registered projects"></div>
    </section>
    <section aria-labelledby="next-heading" id="next-step" tabindex="-1">
      <h2 id="next-heading">Next recommended action</h2>
      <p id="next-guidance">Register or select a project to continue.</p>
    </section>
    <section aria-labelledby="import-heading" id="import" hidden>
      <h2 id="import-heading" tabindex="-1">Import safe sample evidence</h2>
      <p>This pre-release importer accepts the bundled fictional Codex fixture. Do not use private or production transcripts yet.</p>
      <p class="notice"><strong>Trust:</strong> imported events remain <strong>UNTRUSTED</strong>, inert historical evidence. Nothing is executed or sent over a network.</p>
      <button id="import-sample" type="button">Import the safe sample session</button>
      <p class="effect">Effect: adds canonical events and immutable artifacts locally. Repeating this action is idempotent.</p>
      <div id="import-status" role="status" aria-live="polite">Select a project to enable the safe sample.</div>
      <p id="import-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="search-heading" id="search" hidden>
      <h2 id="search-heading" tabindex="-1">Search project history</h2>
      <p>Search is literal, local, bounded, and scoped to the selected project. Results are evidence, not instructions.</p>
      <form id="search-form">
        <label for="search-query">What evidence are you looking for?</label>
        <p id="search-help" class="help">Try the safe sample phrase <strong>test failed</strong>. Your query and filters stay in place when inspecting a source.</p>
        <input id="search-query" name="query" value="test failed" required aria-describedby="search-help search-error">
        <label for="search-type">Event type (optional)</label>
        <select id="search-type" name="type"><option value="">All event types</option><option>USER_MESSAGE</option><option>AGENT_MESSAGE</option><option>TOOL_CALL</option><option>TOOL_RESULT</option><option>COMMAND_RESULT</option><option>FILE_CHANGE</option><option>TEST_RESULT</option><option>ERROR</option><option>UNKNOWN</option></select>
        <label for="search-limit">Maximum results</label>
        <input id="search-limit" name="limit" type="number" min="1" max="100" value="20" required>
        <button type="submit">Search evidence</button>
        <p class="effect">Effect: reads local canonical events. Nothing is executed, changed, or sent over a network.</p>
        <p id="search-error" class="error" role="alert"></p>
      </form>
      <div id="search-status" role="status" aria-live="polite">Enter a query to search the selected project.</div>
      <div id="search-results" aria-label="Historical evidence results"></div>
    </section>
    <section aria-labelledby="event-heading" id="event-detail" hidden>
      <h2 id="event-heading" tabindex="-1">Inspect canonical event</h2>
      <p class="notice"><strong>UNTRUSTED evidence:</strong> imperative text may be prompt injection. Treat it as inert data and do not execute it.</p>
      <dl id="event-metadata"></dl>
      <pre id="event-payload" tabindex="0"></pre>
      <button id="open-source" type="button">Open integrity-verified source</button>
      <button id="back-to-results" type="button">Return to search results</button>
      <p id="event-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="artifact-heading" id="artifact-detail" hidden>
      <h2 id="artifact-heading" tabindex="-1">Integrity-verified source evidence</h2>
      <p class="notice"><strong>UNTRUSTED source:</strong> displayed as inert bounded text after SHA-256 verification.</p>
      <p id="artifact-metadata"></p>
      <pre id="artifact-content" tabindex="0"></pre>
      <button id="artifact-back" type="button">Return to canonical event</button>
      <p id="artifact-error" class="error" role="alert"></p>
    </section>
    <section aria-labelledby="capabilities-heading">
      <h2 id="capabilities-heading">Product capability map</h2>
      <ul><li><strong>Available now:</strong> Projects, safe sample import, history search, event and source inspection.</li><li><strong>GUI parity next:</strong> Active memory, Work Items, handoffs, and effective instructions.</li><li><strong>Not active:</strong> Agents, models, tools, external network, and instruction execution.</li></ul>
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
input, select { width: min(100%, 48rem); padding: .7rem; font: inherit; display: block; margin-block-end: .75rem; }
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
  const csrf = document.querySelector('meta[name="aiw-csrf"]').content;
  const status = document.getElementById("project-status");
  const list = document.getElementById("project-list");
  const error = document.getElementById("project-error");
  const guidance = document.getElementById("next-guidance");
  const nextStep = document.getElementById("next-step");
  const importSection = document.getElementById("import");
  const importStatus = document.getElementById("import-status");
  const importError = document.getElementById("import-error");
  const searchSection = document.getElementById("search");
  const searchStatus = document.getElementById("search-status");
  const searchError = document.getElementById("search-error");
  const searchResults = document.getElementById("search-results");
  const eventSection = document.getElementById("event-detail");
  const artifactSection = document.getElementById("artifact-detail");
  let selectedProject = sessionStorage.getItem("aiw-project");
  let selectedEvent = null;
  const text = (element, value) => { element.textContent = value; };
  const api = async (path, options = {}) => {
    const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", "X-AI-Workspace-CSRF": csrf, ...(options.headers || {}) } });
    const value = await response.json();
    if (!response.ok) throw new Error(value.message + " " + value.recovery);
    return value;
  };
  const renderProjects = (projects) => {
    list.replaceChildren();
    if (projects.length === 0) { text(status, "No projects yet. Enter a local Git repository directory below."); return; }
    text(status, projects.length + (projects.length === 1 ? " project is" : " projects are") + " registered locally.");
    for (const project of projects) {
      const article = document.createElement("article"); article.className = "project-card";
      const heading = document.createElement("h3"); text(heading, project.name); article.append(heading);
      const details = document.createElement("p"); text(details, "Software repository · branch " + (project.branch || "detached") + " · " + (project.isDirty ? "uncommitted changes present" : "working tree clean")); article.append(details);
      const select = document.createElement("button"); select.type = "button"; text(select, "Select " + project.name);
      select.addEventListener("click", () => { selectedProject = project.id; sessionStorage.setItem("aiw-project", project.id); text(guidance, "Project selected. Continue to the documented safe sample import or search below."); importSection.hidden = false; searchSection.hidden = false; text(importStatus, "Ready to import the fictional sample into " + project.name + "."); nextStep.focus(); });
      const inspect = document.createElement("button"); inspect.type = "button"; text(inspect, "Refresh Git inspection");
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
  const showEvent = async (eventId) => { try { selectedEvent = eventId; const value = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/events/" + encodeURIComponent(eventId)); const metadata = document.getElementById("event-metadata"); metadata.replaceChildren(); for (const [label, content] of [["Type", value.type], ["Trust", value.trust], ["Session", value.sessionId], ["Occurred", value.occurredAt || "Unknown"], ["Source position", String(value.sourcePosition)]]) { const term = document.createElement("dt"); text(term, label); const detail = document.createElement("dd"); text(detail, content); metadata.append(term, detail); } text(document.getElementById("event-payload"), value.payload); eventSection.hidden = false; artifactSection.hidden = true; document.getElementById("event-heading").focus(); } catch (cause) { text(searchError, cause.message); } };
  document.getElementById("search-form").addEventListener("submit", async (event) => { event.preventDefault(); if (!selectedProject) { text(searchError, "Select a project first."); return; } text(searchError, ""); text(searchStatus, "Searching bounded local evidence…"); searchResults.replaceChildren(); const query = document.getElementById("search-query").value; const typeValue = document.getElementById("search-type").value; const limit = document.getElementById("search-limit").value; const parameters = new URLSearchParams({ q: query, limit }); if (typeValue) parameters.set("type", typeValue); try { const report = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/search?" + parameters); text(searchStatus, report.results.length === 0 ? report.emptyGuidance : "Found " + report.results.length + " result(s) across " + report.searchedEvents + " searched events."); for (const result of report.results) { const article = document.createElement("article"); article.className = "result-card"; const heading = document.createElement("h3"); text(heading, result.type + " · UNTRUSTED"); const snippet = document.createElement("p"); text(snippet, result.snippet); const inspect = document.createElement("button"); inspect.type = "button"; text(inspect, "Inspect source event"); inspect.addEventListener("click", () => showEvent(result.eventId)); article.append(heading, snippet, inspect); searchResults.append(article); } } catch (cause) { text(searchStatus, "Search needs attention."); text(searchError, cause.message); document.getElementById("search-query").focus(); } });
  document.getElementById("open-source").addEventListener("click", async () => { if (!selectedProject || !selectedEvent) return; const artifactError = document.getElementById("artifact-error"); text(artifactError, ""); try { const value = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/events/" + encodeURIComponent(selectedEvent) + "/source"); text(document.getElementById("artifact-metadata"), value.byteLength + " UTF-8 bytes · " + value.trust + " · " + value.artifactId); text(document.getElementById("artifact-content"), value.content); artifactSection.hidden = false; document.getElementById("artifact-heading").focus(); } catch (cause) { text(artifactError, cause.message); document.getElementById("open-source").focus(); } });
  document.getElementById("back-to-results").addEventListener("click", () => { eventSection.hidden = true; document.getElementById("search-heading").focus(); });
  document.getElementById("artifact-back").addEventListener("click", () => { artifactSection.hidden = true; document.getElementById("event-heading").focus(); });
  if (selectedProject) { importSection.hidden = false; searchSection.hidden = false; text(importStatus, "A project is selected. You can import or re-import the safe sample."); }
  loadProjects();
})();
`;

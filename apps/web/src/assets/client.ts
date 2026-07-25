/**
 * The single script served at `/app.js`.
 *
 * It runs under `default-src 'none'; script-src 'self'`, so it is one inline
 * IIFE with no import, no bundler, and no runtime dependency. It never assigns
 * `innerHTML`: text goes in through `textContent` and server-rendered fragments
 * through `DOMParser` plus `replaceChildren`, so no markup carried by a response
 * can become executable.
 */
import { GUI_CATALOGS } from "../localization.ts";

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
  const transcriptSection = document.getElementById("transcripts");
  const transcriptStatus = document.getElementById("transcript-status");
  const transcriptList = document.getElementById("transcript-list");
  const transcriptError = document.getElementById("transcript-error");
  const transcriptRestricted = document.getElementById("transcript-restricted");
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
  const privacyAuditSection = document.getElementById("privacy-audit");
  const privacyAuditList = document.getElementById("privacy-audit-list");
  const privacyAuditMore = document.getElementById("privacy-audit-more");
  let privacyAuditCursor = null;
  let selectedProject = sessionStorage.getItem("aiw-project");
  let registeredProjects = new Map();
  let workItems = [];
  let selectedEvent = null;
  let selectedMemory = null;
  let selectedWork = null;
  let selectedHandoff = null;
  let selectedGeneral = null;
  let selectedGeneralEvent = null;
  let reviewedHandoffInput = null;
  let customerAliasSuggestions = [];
  const selectedHandoffMemoryIds = new Set();
  const text = (element, value) => { element.textContent = value; };
  // These mirror formatGuiNumber and formatGuiDateTime on the server: the client is a
  // string literal, so it cannot import them, and the two sides must agree because the
  // same dashboard sentence is written here and inside the server-rendered fragment.
  const numberFormatters = new Map();
  const dateTimeFormatters = new Map();
  const number = (value) => { if (!numberFormatters.has(locale)) numberFormatters.set(locale, new Intl.NumberFormat(locale)); return numberFormatters.get(locale).format(value); };
  const dateTime = (value) => { const instant = new Date(value); if (Number.isNaN(instant.getTime())) return value; if (!dateTimeFormatters.has(locale)) dateTimeFormatters.set(locale, new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" })); return dateTimeFormatters.get(locale).format(instant); };
  // The four states a Work Item can hold; a drill-down carrying anything else is ignored
  // rather than applied, so an unknown filter never hides the whole list.
  const WORK_STATES = new Set(["PROPOSED", "ACTIVE", "BLOCKED", "COMPLETED"]);
  const pageSections = Object.freeze({
    dashboard: ["dashboard"],
    projects: ["welcome", "projects", "next-step", "import", "transcripts"],
    evidence: ["general-inbox", "search", "event-detail", "artifact-detail"],
    memory: ["memory", "memory-detail"],
    work: ["work-items", "work-detail", "handoff-builder", "handoff-detail"],
    privacy: ["context-pack", "privacy-audit"],
    scripts: ["scripts"],
    settings: ["settings"],
    system: ["system-status", "instructions", "agent-profile", "capabilities"],
  });
  const pageTitleKeys = Object.freeze({
    dashboard: "navDashboard",
    projects: "navProjects",
    evidence: "navEvidence",
    memory: "navMemory",
    work: "navContinuity",
    privacy: "navPrivacy",
    scripts: "navScripts",
    settings: "navSettings",
    system: "navSystem",
  });
  const pageForSection = new Map(Object.entries(pageSections).flatMap(([page, ids]) => ids.map((id) => [id, page])));
  const currentRoute = () => {
    const fragment = location.hash.startsWith("#/") ? location.hash.slice(2) : "";
    const query = fragment.indexOf("?");
    const path = query === -1 ? fragment : fragment.slice(0, query);
    const candidate = path.split("/")[0];
    return { page: Object.hasOwn(pageSections, candidate) ? candidate : "dashboard", parameters: new URLSearchParams(query === -1 ? "" : fragment.slice(query + 1)) };
  };
  const currentPage = () => currentRoute().page;
  const projectFilter = () => currentRoute().parameters.get("filter") === "attention" ? "attention" : null;
  const workFilter = () => { const state = currentRoute().parameters.get("state"); return WORK_STATES.has(state) ? state : null; };
  const renderFilterChip = (id, label, page) => {
    const chip = document.getElementById(id);
    chip.replaceChildren();
    chip.hidden = label === null;
    if (label === null) return;
    const description = document.createElement("span"); text(description, label);
    const clear = document.createElement("button"); clear.type = "button"; text(clear, message("filterClear"));
    clear.addEventListener("click", () => { location.hash = "#/" + page; });
    chip.append(description, clear);
  };
  const renderRoute = (focusMain = false) => {
    const page = currentPage();
    document.body.classList.remove("menu-open");
    document.getElementById("menu-toggle").setAttribute("aria-expanded", "false");
    for (const section of document.querySelectorAll("main > section")) section.classList.toggle("route-hidden", !pageSections[page].includes(section.id));
    for (const link of document.querySelectorAll("[data-route]")) {
      if (link.dataset.route === page) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    text(document.getElementById("page-title"), message(pageTitleKeys[page]));
    document.title = message(pageTitleKeys[page]) + " · AI Workspace";
    if (focusMain) document.getElementById("main").focus();
    if (page === "dashboard") loadDashboard();
    // Re-rendering the destination is what makes a drill-down real: the filter lives in the
    // hash, so arriving at the page has to apply it to the data already loaded.
    if (page === "projects") renderProjectList();
    if (page === "work") renderWorkList();
    if (page === "system") loadSystemSnapshot();
  };
  const openPage = (page, focusMain = true) => {
    const nextHash = "#/" + page;
    if (location.hash === nextHash) renderRoute(focusMain);
    else {
      location.hash = nextHash;
      if (focusMain) queueMicrotask(() => document.getElementById("main").focus());
    }
  };
  document.getElementById("menu-toggle").addEventListener("click", (event) => {
    const open = document.body.classList.toggle("menu-open");
    event.currentTarget.setAttribute("aria-expanded", String(open));
  });
  addEventListener("hashchange", () => renderRoute(false));
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]:not([href^="#/"])');
    if (!link) return;
    const targetId = link.getAttribute("href").slice(1);
    const page = pageForSection.get(targetId);
    if (!page) return;
    event.preventDefault();
    openPage(page, false);
    queueMicrotask(() => document.getElementById(targetId)?.focus());
  });
  document.getElementById("gui-language").addEventListener("change", (event) => { locale = supported.has(event.target.value) ? event.target.value : "en"; localStorage.setItem(localeKey, locale); applyLocale(); renderRoute(false); });
  const api = async (path, options = {}) => {
    const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", "X-AI-Workspace-CSRF": csrf, ...(options.headers || {}) } });
    const value = await response.json();
    if (!response.ok) throw new Error(value.message + " " + value.recovery);
    return value;
  };
  // Markup fetched from the local server is parsed in an inert document: DOMParser never
  // runs script, never fetches subresources and never wires event-handler attributes, so
  // nothing a response carries can become behaviour. The parsed nodes are then moved with
  // replaceChildren, so markup is never assigned to a live element as a string.
  const fragmentNodes = async (path) => {
    const response = await fetch(path, { headers: { Accept: "text/html" } });
    const body = await response.text();
    if (!response.ok) {
      let value = null;
      try { value = JSON.parse(body); } catch { value = null; }
      throw new Error(value && value.message ? value.message + " " + value.recovery : body);
    }
    return [...new DOMParser().parseFromString(body, "text/html").body.childNodes];
  };
  const loadDashboard = async () => {
    const dashboardStatus = document.getElementById("dashboard-status");
    const dashboardError = document.getElementById("dashboard-error");
    text(dashboardError, "");
    try {
      // The charts, their legends, their tables and the coverage sentence are all rendered
      // by the server from tested pure functions, so the browser holds no chart geometry
      // and no second copy of the wording.
      document.getElementById("dashboard-charts").replaceChildren(...await fragmentNodes("/view/dashboard-charts?locale=" + encodeURIComponent(locale)));
      text(dashboardStatus, message("dashboardUpdatedStatus"));
    } catch (cause) {
      text(dashboardStatus, message("dashboardAttentionStatus"));
      text(dashboardError, cause.message);
    }
  };
  const loadSystemSnapshot = async () => {
    const systemError = document.getElementById("system-error");
    text(systemError, "");
    try {
      const value = await api("/api/dashboard");
      text(document.getElementById("system-project-coverage"), message("systemProjectCoverage", { available: number(value.coverage.availableProjects), total: number(value.projects.total), unavailable: number(value.coverage.unavailableProjects) }));
      text(document.getElementById("system-updated"), message("systemSnapshot", { updated: dateTime(value.asOf) }));
    } catch (cause) {
      text(systemError, cause.message);
    }
  };
  document.getElementById("dashboard-refresh").addEventListener("click", loadDashboard);
  const selectProject = (project, focusNext = true) => { selectedProject = project.id; sessionStorage.setItem("aiw-project", project.id); text(guidance, message("selectedProject")); importSection.hidden = false; transcriptSection.hidden = false; memorySection.hidden = false; workSection.hidden = false; instructionSection.hidden = false; agentProfileSection.hidden = false; privacyAuditSection.hidden = false; text(importStatus, message("readyImport", { name: project.name })); loadMemory(); loadWork(); loadPrivacyAudit(true); if (focusNext) nextStep.focus(); };
  const renderProjects = (projects) => {
    registeredProjects = new Map(projects.map((project) => [project.id, project]));
    for (const selectId of ["general-link-project", "search-associated-project"]) {
      const target = document.getElementById(selectId); const previous = target.value; target.replaceChildren();
      if (selectId === "search-associated-project") { const empty = document.createElement("option"); empty.value = ""; text(empty, "No association filter / Nessun filtro associazione"); target.append(empty); }
      for (const project of projects) { const option = document.createElement("option"); option.value = project.id; text(option, project.name + " · PROJECT · " + project.id); target.append(option); }
      if ([...target.options].some((option) => option.value === previous)) target.value = previous;
    }
    renderProjectList();
  };
  // Split from renderProjects so that arriving at #/projects?filter=attention re-filters the
  // cards already loaded instead of refetching, and so that clearing the filter is instant.
  const renderProjectList = () => {
    const projects = [...registeredProjects.values()];
    const filter = projectFilter();
    renderFilterChip("project-filter", filter === null ? null : message("filterProjectsAttention"), "projects");
    // The dashboard counts projects needing attention as exactly the dirty ones, so the
    // filtered page shows the same number the chart offered to drill into.
    const shown = filter === null ? projects : projects.filter((project) => project.isDirty);
    list.replaceChildren();
    if (projects.length === 0) { text(status, "No projects yet. Enter a local Git repository directory below."); return; }
    if (shown.length === 0) { text(status, message("noMatchingProjects")); return; }
    text(status, shown.length === 1 ? message("projectRegistered") : message("projectsRegistered", { count: number(shown.length) }));
    for (const project of shown) {
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
  const loadProjects = async () => { try { renderProjects(await api("/api/projects")); await loadDashboard(); } catch (cause) { text(status, "Projects could not be loaded."); text(error, cause.message); } };
  const loadPrivacyAudit = async (reset = false) => {
    const auditStatus = document.getElementById("privacy-audit-status");
    const auditError = document.getElementById("privacy-audit-error");
    if (!selectedProject) { text(auditStatus, "Select a project / Seleziona un progetto."); return; }
    if (reset) { privacyAuditCursor = null; privacyAuditList.replaceChildren(); document.getElementById("privacy-audit-detail").hidden = true; }
    text(auditError, ""); text(auditStatus, "Loading verified local audit / Caricamento audit locale verificato…");
    try {
      const suffix = privacyAuditCursor ? "?limit=25&cursor=" + encodeURIComponent(privacyAuditCursor) : "?limit=25";
      const page = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/privacy-audit" + suffix);
      if (page.events.length === 0 && privacyAuditList.childElementCount === 0) text(auditStatus, "No valid preflight decision has been recorded for this project / Nessuna decisione preflight valida registrata per questo progetto.");
      else text(auditStatus, page.total + " verified event(s), newest first / evento/i verificati, dal più recente. Read-only / Sola lettura.");
      for (const event of page.events) {
        const article = document.createElement("article"); article.className = "result-card";
        const heading = document.createElement("h3"); text(heading, event.decision + " · " + event.occurredAt);
        const summary = document.createElement("p"); text(summary, "Work Item " + event.workItemId + " · handoff " + event.handoffId + " · model " + event.modelId + " · policy " + event.policyId + " v" + event.policyVersion + " · allowed " + event.counts.allowedItems + " · blocked " + event.counts.blockedItems);
        const inspect = document.createElement("button"); inspect.type = "button"; text(inspect, "Inspect safe provenance / Ispeziona provenienza sicura");
        inspect.addEventListener("click", async () => { try { const detail = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/privacy-audit/" + encodeURIComponent(event.eventId)); const output = document.getElementById("privacy-audit-detail"); text(output, JSON.stringify(detail, null, 2)); output.hidden = false; output.focus(); } catch (cause) { text(auditError, cause.message); } });
        article.append(heading, summary, inspect); privacyAuditList.append(article);
      }
      privacyAuditCursor = page.nextCursor; privacyAuditMore.hidden = privacyAuditCursor === null;
    } catch (cause) { privacyAuditMore.hidden = true; text(auditStatus, "Audit needs attention / L'audit richiede attenzione."); text(auditError, cause.message); document.getElementById("privacy-audit-refresh").focus(); }
  };
  document.getElementById("privacy-audit-refresh").addEventListener("click", () => loadPrivacyAudit(true));
  privacyAuditMore.addEventListener("click", () => loadPrivacyAudit(false));
  document.getElementById("register-project-form").addEventListener("submit", async (event) => {
    event.preventDefault(); text(error, ""); text(status, "Validating the local Git repository…");
    const input = document.getElementById("project-path");
    try { const project = await api("/api/projects", { method: "POST", body: JSON.stringify({ path: input.value }) }); input.value = ""; await loadProjects(); text(guidance, project.name + " is ready. Select it to continue."); nextStep.focus(); }
    catch (cause) { text(status, "Project registration needs attention."); text(error, cause.message); input.focus(); }
  });
  document.getElementById("import-sample").addEventListener("click", async () => {
    if (!selectedProject) { text(importError, "Select a registered project first."); document.getElementById("projects-heading").focus(); return; }
    text(importError, ""); text(importStatus, "Importing the reviewed synthetic session locally…");
    try { const report = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/import-sample", { method: "POST", body: "{}" }); text(importStatus, report.effect + " Added " + report.addedEvents + ", unchanged " + report.existingEvents + ", total " + report.totalEvents + ". " + report.nextAction); text(guidance, "Safe sample ready. Continue to Search project history."); searchSection.hidden = false; openPage("evidence", false); queueMicrotask(() => document.getElementById("search-heading").focus()); }
    catch (cause) { text(importStatus, "Sample import needs attention."); text(importError, cause.message); document.getElementById("import-sample").focus(); }
  });
  const renderTranscripts = (discovery) => {
    transcriptList.replaceChildren();
    if (discovery.candidates.length === 0) { text(transcriptStatus, message("transcriptNone")); return; }
    text(transcriptStatus, message("transcriptFound", { count: String(discovery.candidates.length) }));
    for (const candidate of discovery.candidates) {
      const article = document.createElement("article"); article.className = "result-card";
      const heading = document.createElement("h3"); text(heading, candidate.fileName); article.append(heading);
      const details = document.createElement("p"); text(details, candidate.modifiedAt + " · " + candidate.byteLength + " bytes"); article.append(details);
      const button = document.createElement("button"); button.type = "button"; text(button, message("transcriptImport"));
      button.addEventListener("click", async () => {
        if (!selectedProject) { text(transcriptError, message("transcriptNoProject")); document.getElementById("projects-heading").focus(); return; }
        text(transcriptError, ""); text(transcriptStatus, message("transcriptImporting"));
        try {
          const report = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/import-transcript", { method: "POST", body: JSON.stringify({ filePath: candidate.filePath }) });
          const skipped = report.skippedRecords.reduce((total, entry) => total + entry.count, 0);
          text(transcriptStatus, report.effect + " " + message("transcriptCounts", { added: String(report.addedEvents), unchanged: String(report.existingEvents), total: String(report.totalEvents), skipped: String(skipped) }) + (skipped === 0 ? "" : " " + report.skippedRecords.map((entry) => entry.reason + " × " + entry.count).join(", ")));
          const restricted = report.skippedRecords.filter((entry) => entry.reason.indexOf("RESTRICTED_DATA:") === 0).reduce((total, entry) => total + entry.count, 0);
          transcriptRestricted.hidden = restricted === 0;
          text(transcriptRestricted, restricted === 0 ? "" : message("transcriptRestricted", { count: String(restricted) }));
          searchSection.hidden = false;
        } catch (cause) { text(transcriptStatus, message("transcriptAttention")); text(transcriptError, cause.message); button.focus(); }
      });
      article.append(button); transcriptList.append(article);
    }
  };
  document.getElementById("transcript-discover-form").addEventListener("submit", async (event) => {
    event.preventDefault(); text(transcriptError, ""); text(transcriptStatus, message("transcriptListing"));
    const input = document.getElementById("transcript-directory");
    try { renderTranscripts(await api("/api/transcripts/discover", { method: "POST", body: JSON.stringify({ directory: input.value }) })); }
    catch (cause) { transcriptList.replaceChildren(); text(transcriptStatus, message("transcriptAttention")); text(transcriptError, cause.message); input.focus(); }
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
  document.getElementById("use-memory-source").addEventListener("click", () => { if (!selectedEvent) return; memorySection.hidden = false; text(document.getElementById("memory-source-status"), "Selected UNTRUSTED canonical event " + selectedEvent + " as provenance for the next explicit memory action."); openPage("memory", false); queueMicrotask(() => document.getElementById("memory-heading").focus()); });
  document.getElementById("memory-add-form").addEventListener("submit", async (event) => { event.preventDefault(); if (!selectedProject || !selectedEvent) { text(memoryError, "Inspect an event and select it as memory evidence first."); return; } try { const item = await api(memoryPath(), { method: "POST", body: JSON.stringify({ type: document.getElementById("memory-type").value, content: document.getElementById("memory-content").value, sourceEventIds: sourceIds() }) }); document.getElementById("memory-content").value = ""; text(memoryStatus, "Created " + item.type + " as ACTIVE, UNVERIFIED, UNASSESSED USER_CURATED memory."); await loadMemory(); await showMemory(item.id); } catch (cause) { text(memoryError, cause.message); document.getElementById("memory-content").focus(); } });
  document.getElementById("memory-filter-form").addEventListener("submit", (event) => { event.preventDefault(); loadMemory(); });
  const transition = async (action, field, property) => { const detailError = document.getElementById("memory-detail-error"); if (!selectedMemory || !selectedEvent) { text(detailError, "Select canonical evidence before this lifecycle action."); return; } try { const value = document.getElementById(field).value; const result = await api(memoryPath() + "/" + encodeURIComponent(selectedMemory) + "/" + action, { method: "POST", body: JSON.stringify({ [property]: value, sourceEventIds: sourceIds() }) }); document.getElementById(field).value = ""; const item = result.replacement || result; await loadMemory(); await showMemory(item.id); } catch (cause) { text(detailError, cause.message); document.getElementById(field).focus(); } };
  document.getElementById("memory-verify-form").addEventListener("submit", (event) => { event.preventDefault(); transition("verify", "memory-note", "note"); });
  document.getElementById("memory-supersede-form").addEventListener("submit", (event) => { event.preventDefault(); transition("supersede", "memory-replacement", "content"); });
  document.getElementById("memory-invalidate-form").addEventListener("submit", (event) => { event.preventDefault(); transition("invalidate", "memory-reason", "reason"); });
  document.getElementById("memory-back").addEventListener("click", () => { memoryDetail.hidden = true; document.getElementById("memory-heading").focus(); });
  const workPath = () => "/api/projects/" + encodeURIComponent(selectedProject) + "/work-items";
  // The endpoint returns every Work Item of the project, so filtering here is complete:
  // no page boundary can hide an item the dashboard counted.
  const loadWork = async () => { if (!selectedProject) return; try { workItems = await api(workPath()); renderWorkList(); } catch (cause) { workItems = []; document.getElementById("work-list").replaceChildren(); text(document.getElementById("work-error"), cause.message); } };
  const renderWorkList = () => {
    if (!selectedProject) return;
    const list = document.getElementById("work-list"); list.replaceChildren();
    const filter = workFilter();
    renderFilterChip("work-filter", filter === null ? null : message("filterWorkState", { state: filter }), "work");
    const shown = filter === null ? workItems : workItems.filter((item) => item.status === filter);
    text(document.getElementById("work-status"), workItems.length === 0 ? message("noWorkItems") : shown.length === 0 ? message("noMatchingWork") : message("showingWork", { count: number(shown.length) }));
    for (const item of shown) { const article = document.createElement("article"); article.className = "work-card"; const heading = document.createElement("h3"); text(heading, item.status + " · version " + item.version); const objective = document.createElement("p"); text(objective, item.objective); const inspect = document.createElement("button"); inspect.type = "button"; text(inspect, message("inspectWork")); inspect.addEventListener("click", () => showWork(item.id)); article.append(heading, objective, inspect); list.append(article); }
  };
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
  document.getElementById("privacy-preflight-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("privacy-preflight-error"); const content = document.getElementById("privacy-preflight-content"); text(error, ""); if (!selectedProject || !selectedWork || !selectedHandoff) { text(error, message("privacyPreflightEmpty")); return; } const profilePath = document.getElementById("privacy-profile-path").value.trim(); const profileDigest = document.getElementById("privacy-profile-digest").value.trim(); const policyPath = document.getElementById("privacy-policy-path").value.trim(); const policyDigest = document.getElementById("privacy-policy-digest").value.trim(); const paths = document.getElementById("privacy-bundles").value.split(/\\r?\\n/u).map((value) => value.trim()).filter(Boolean); const model = document.getElementById("privacy-model").value.trim(); const task = document.getElementById("privacy-task").value.trim(); try { const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/privacy-preflight/preview", { method: "POST", body: JSON.stringify({ profile: { path: profilePath, ...(profileDigest ? { expectedDigest: profileDigest } : {}) }, policy: { path: policyPath, ...(policyDigest ? { expectedDigest: policyDigest } : {}) }, bundles: paths.map((path) => ({ path })), model, ...(task ? { task } : {}) }) }); const counts = value.preflight.accounting; text(document.getElementById("privacy-preflight-status"), message("privacyPreflightReady", { result: value.preflight.overallResult, model: value.preflight.modelId, policy: value.preflight.policy.id, allowed: String(counts.allowedItems), blocked: String(counts.blockedItems), defaulted: String(counts.defaultedItems), restricted: String(counts.restrictedItems) }) + " Audit event / Evento audit: " + value.auditEvent.eventId + "."); text(content, JSON.stringify(value, null, 2)); content.hidden = false; content.focus(); loadPrivacyAudit(true); } catch (cause) { content.hidden = true; text(error, cause.message); document.getElementById("privacy-policy-path").focus(); } });
  document.getElementById("customer-alias-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("customer-alias-error"); const results = document.getElementById("customer-alias-results"); const confirm = document.getElementById("customer-alias-confirm"); text(error, ""); results.replaceChildren(); confirm.hidden = true; customerAliasSuggestions = []; if (!selectedProject || !selectedWork || !selectedHandoff) { text(error, message("customerAliasEmpty")); return; } const profilePath = document.getElementById("privacy-profile-path").value.trim(); const profileDigest = document.getElementById("privacy-profile-digest").value.trim(); const policyPath = document.getElementById("privacy-policy-path").value.trim(); const policyDigest = document.getElementById("privacy-policy-digest").value.trim(); const paths = document.getElementById("privacy-bundles").value.split(/\\r?\\n/u).map((value) => value.trim()).filter(Boolean); const model = document.getElementById("privacy-model").value.trim(); const task = document.getElementById("privacy-task").value.trim(); const dictionary = document.getElementById("customer-aliases").value.split(/\\r?\\n/u).map((line) => line.trim()).filter(Boolean).map((line) => { const match = /^(CUSTOMER|PROJECT):\\s*(.+)$/u.exec(line); if (!match) throw new Error("Prefix every alias with CUSTOMER: or PROJECT: / Usa il prefisso CUSTOMER: o PROJECT: per ogni alias."); return { entityType: match[1], alias: match[2] }; }); const profile = { path: profilePath, ...(profileDigest ? { expectedDigest: profileDigest } : {}) }; const bundles = paths.map((path) => ({ path })); try { const [value, context] = await Promise.all([api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/entity-alias-suggestions/preview", { method: "POST", body: JSON.stringify({ profile, policy: { path: policyPath, ...(policyDigest ? { expectedDigest: policyDigest } : {}) }, bundles, model, ...(task ? { task } : {}), dictionary }) }), api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/profile-context/preview", { method: "POST", body: JSON.stringify({ profile, bundles, model, ...(task ? { task } : {}) }) })]); customerAliasSuggestions = value.suggestions.suggestions; const items = new Map(context.contextPack.included.map((item) => [item.id, item.content])); const encoder = new TextEncoder(); const decoder = new TextDecoder("utf-8", { fatal: true }); customerAliasSuggestions.forEach((suggestion, index) => { const content = items.get(suggestion.itemId); if (typeof content !== "string") throw new Error("The recomposed Context Pack no longer contains a suggested item."); const bytes = encoder.encode(content); const row = document.createElement("li"); const label = document.createElement("label"); const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.dataset.suggestionIndex = String(index); label.append(checkbox, document.createTextNode(" " + suggestion.entityType + " · " + suggestion.itemId + " · UTF-8 " + suggestion.byteStart + "–" + suggestion.byteEnd + " · " + suggestion.state)); const sample = document.createElement("code"); sample.append(document.createTextNode(decoder.decode(bytes.slice(0, suggestion.byteStart)))); const mark = document.createElement("mark"); text(mark, decoder.decode(bytes.slice(suggestion.byteStart, suggestion.byteEnd))); sample.append(mark, document.createTextNode(decoder.decode(bytes.slice(suggestion.byteEnd)))); row.append(label, document.createElement("br"), sample); results.append(row); }); text(document.getElementById("customer-alias-status"), message("customerAliasReady", { count: String(customerAliasSuggestions.length) })); confirm.hidden = customerAliasSuggestions.length === 0; if (!confirm.hidden) confirm.focus(); } catch (cause) { customerAliasSuggestions = []; results.replaceChildren(); confirm.hidden = true; text(error, cause.message); document.getElementById("customer-aliases").focus(); } });
  document.getElementById("customer-alias-confirm").addEventListener("click", () => { const selected = [...document.querySelectorAll("#customer-alias-results input[type=checkbox]:checked")].map((entry) => customerAliasSuggestions[Number(entry.dataset.suggestionIndex)]).filter(Boolean).map(({ itemId, contentSha256, byteStart, byteEnd, entityType }) => ({ itemId, contentSha256, byteStart, byteEnd, entityType })); if (selected.length === 0) { text(document.getElementById("customer-alias-error"), message("customerAliasSelectOne")); return; } document.getElementById("pseudonym-selections").value = JSON.stringify(selected, null, 2); text(document.getElementById("customer-alias-status"), message("customerAliasConfirmed", { count: String(selected.length) })); document.getElementById("pseudonym-selections").focus(); });
  document.getElementById("pseudonymization-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("pseudonymization-error"); const content = document.getElementById("pseudonymization-content"); const passphraseField = document.getElementById("pseudonym-passphrase"); text(error, ""); if (!selectedProject || !selectedWork || !selectedHandoff) { text(error, "Inspect one immutable handoff first / Esamina prima un handoff immutabile."); return; } try { const profilePath = document.getElementById("privacy-profile-path").value.trim(); const profileDigest = document.getElementById("privacy-profile-digest").value.trim(); const policyPath = document.getElementById("privacy-policy-path").value.trim(); const policyDigest = document.getElementById("privacy-policy-digest").value.trim(); const paths = document.getElementById("privacy-bundles").value.split(/\\r?\\n/u).map((value) => value.trim()).filter(Boolean); const model = document.getElementById("privacy-model").value.trim(); const task = document.getElementById("privacy-task").value.trim(); const selections = JSON.parse(document.getElementById("pseudonym-selections").value); const schemaVersion = selections.some((entry) => entry && entry.entityType === "PROJECT") ? 2 : 1; const review = { schemaVersion, mappingSetId: document.getElementById("pseudonym-mapping-id").value.trim(), projectId: selectedProject, workItemId: selectedWork, handoffId: selectedHandoff, modelId: model, attribution: "USER_REVIEWED", selections }; const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/pseudonymization/preview", { method: "POST", body: JSON.stringify({ profile: { path: profilePath, ...(profileDigest ? { expectedDigest: profileDigest } : {}) }, policy: { path: policyPath, ...(policyDigest ? { expectedDigest: policyDigest } : {}) }, bundles: paths.map((path) => ({ path })), model, ...(task ? { task } : {}), review, keyCustody: { mode: document.getElementById("pseudonym-custody-mode").value, passphrase: passphraseField.value } }) }); const counts = value.transformation.accounting; text(document.getElementById("pseudonymization-status"), "Verified local round trip / Round trip locale verificato: schema v" + value.mapping.schemaVersion + ", " + counts.reviewedSelections + " reviewed selection(s), " + counts.transformedItems + " transformed item(s), mapping " + value.mapping.mappingSetId + " stored as authenticated ciphertext with passphrase-wrapped local custody. Not authorized or delivered / Non autorizzato né inviato."); text(content, JSON.stringify(value, null, 2)); content.hidden = false; content.focus(); } catch (cause) { content.hidden = true; text(error, cause.message); document.getElementById("pseudonym-selections").focus(); } finally { passphraseField.value = ""; } });
  document.getElementById("output-restoration-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("output-restoration-error"); const content = document.getElementById("output-restoration-content"); const passphraseField = document.getElementById("output-restoration-passphrase"); text(error, ""); if (!selectedProject || !selectedWork || !selectedHandoff) { text(error, "Inspect the originating handoff first / Ispeziona prima l'handoff di origine."); return; } try { const mappingSetId = document.getElementById("output-restoration-mapping-id").value.trim(); const output = document.getElementById("output-restoration-candidate").value; const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/output-restoration/preview", { method: "POST", body: JSON.stringify({ mappingSetId, passphrase: passphraseField.value, output }) }); text(document.getElementById("output-restoration-status"), "Decision / Decisione: " + value.decision + "; schema v" + value.mappingSchemaVersion + "; restored tokens / token ripristinati: " + value.restoredTokens + "; anomalies / anomalie: " + value.anomalyCount + ". Local only, not authorized or delivered / Solo locale, non autorizzato né inviato."); text(content, value.restoredContent === null ? JSON.stringify({ ...value, restoredContent: null }, null, 2) : value.restoredContent); content.hidden = false; content.focus(); } catch (cause) { content.hidden = true; text(error, cause.message); document.getElementById("output-restoration-mapping-id").focus(); } finally { passphraseField.value = ""; } });
  document.getElementById("context-selector-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("context-selector-error"); const content = document.getElementById("context-selector-content"); text(error, ""); if (!selectedProject || !selectedWork || !selectedHandoff) { text(error, message("contextSelectorEmpty")); return; } const path = document.getElementById("context-selector-profile-path").value.trim(); const expectedDigest = document.getElementById("context-selector-profile-digest").value.trim(); try { const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/context-selectors/preview", { method: "POST", body: JSON.stringify({ profile: { path, ...(expectedDigest ? { expectedDigest } : {}) } }) }); const measured = value.report.cases[0]; const budget = measured.budgets[0]; text(document.getElementById("context-selector-status"), message("contextSelectorReady", { selected: String(measured.selectedCandidateBytes), baseline: String(measured.baselineCandidateBytes), reduction: String(measured.reductionPercentFromBaseline), loss: String(measured.safetyFloorLossCount), fit: budget.selectorPolicyFits ? "YES" : "NO" })); text(content, JSON.stringify(value, null, 2)); content.hidden = false; content.focus(); } catch (cause) { content.hidden = true; text(error, cause.message); document.getElementById("context-selector-profile-path").focus(); } });
  if (selectedProject) { importSection.hidden = false; transcriptSection.hidden = false; memorySection.hidden = false; workSection.hidden = false; instructionSection.hidden = false; agentProfileSection.hidden = false; privacyAuditSection.hidden = false; text(importStatus, message("returningImport")); loadMemory(); loadWork(); loadPrivacyAudit(true); }
  applyLocale();
  if (!location.hash.startsWith("#/")) history.replaceState(null, "", "#/dashboard");
  renderRoute(false);
  loadGeneral();
  loadProjects();
})();
`;

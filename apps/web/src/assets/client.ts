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
import { mergeCatalogues } from "../text/catalog.ts";
import { HOME_CATALOGUES } from "../text/home.ts";
import { PRIVACY_CATALOGUES } from "../text/privacy.ts";
import { RESTART_POINT_CATALOGUES } from "../text/restart-point.ts";
import { HOME_BEHAVIOUR } from "./home-client.ts";
import { PRIVACY_BEHAVIOUR } from "./privacy-client.ts";
import { RESTART_POINT_BEHAVIOUR } from "./restart-point-client.ts";

export const APP_JS = `
(() => {
  "use strict";
  const catalogs = ${JSON.stringify(
    mergeCatalogues(
      GUI_CATALOGS,
      HOME_CATALOGUES,
      PRIVACY_CATALOGUES,
      RESTART_POINT_CATALOGUES,
    ),
  )};
  const localeKey = "aiw-locale";
  const supported = new Set(Object.keys(catalogs));
  const originalText = new WeakMap();
  const browserLocale = (navigator.languages || [navigator.language || "en"]).map((value) => value.toLowerCase().split("-")[0]).find((value) => supported.has(value));
  let locale = supported.has(localStorage.getItem(localeKey)) ? localStorage.getItem(localeKey) : (browserLocale || "en");
  const message = (key, parameters = {}) => { const template = catalogs[locale][key] || catalogs.en[key]; return template.replace(/\\{([a-zA-Z][a-zA-Z0-9]*)\\}/gu, (_, name) => String(parameters[name] || "").replace(/[\\u0000-\\u001f\\u007f-\\u009f]/gu, "�")); };
  // A placeholder is sometimes filled with another catalogue entry rather than with data.
  // Resolving \`{ key: "..." }\` at render time instead of at write time is what keeps the
  // inner word from staying in the language the sentence was first written in.
  const resolve = (parameters) => { const filled = {}; for (const name of Object.keys(parameters || {})) { const value = parameters[name]; filled[name] = value && typeof value === "object" && typeof value.key === "string" ? message(value.key) : value; } return filled; };
  const render = (element) => { element.textContent = message(element.dataset.i18n, resolve(element.dataset.i18nArgs ? JSON.parse(element.dataset.i18nArgs) : null)); };
  const applyLocale = () => { document.documentElement.lang = locale; document.getElementById("gui-language").value = locale; const translations = new Map(Object.keys(catalogs.en).map((key) => [catalogs.en[key], catalogs[locale][key]])); const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); while (walker.nextNode()) { const node = walker.currentNode; if (!originalText.has(node)) originalText.set(node, node.nodeValue); const original = originalText.get(node); const trimmed = original.trim(); const translated = translations.get(trimmed); if (translated) node.nodeValue = original.replace(trimmed, translated); } for (const element of document.querySelectorAll("[data-i18n]")) render(element); for (const element of document.querySelectorAll("[data-i18n-label]")) element.setAttribute("aria-label", message(element.dataset.i18nLabel)); };
  // Domain sentences arrive from the core packages in English and are not translated here.
  // They are shown under a localized label, so the reader always sees in their own language
  // what failed and what to do, with the untranslated technical detail clearly separated.
  const detail = (element, cause) => say(element, "detailLabel", { detail: cause.message });
  // The server sends the cause and the remedy as two separate sentences; joining them needs
  // the sentence stop the first one may be missing, otherwise the two run into each other.
  const problem = (value) => { const head = String(value.message || "").trim(); const tail = String(value.recovery || "").trim(); if (!tail) return head; return head + (/[.!?…:]$/u.test(head) ? " " : ". ") + tail; };
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
  const transcriptDetail = document.getElementById("transcript-detail");
  const generalStatus = document.getElementById("general-status");
  const generalError = document.getElementById("general-error");
  const generalList = document.getElementById("general-list");
  const searchSection = document.getElementById("search");
  const searchStatus = document.getElementById("search-status");
  const searchError = document.getElementById("search-error");
  const searchResults = document.getElementById("search-results");
  const restartSection = document.getElementById("restart");
  const restartStatus = document.getElementById("restart-status");
  const restartText = document.getElementById("restart-text");
  const restartCopy = document.getElementById("restart-copy");
  const restartOmissions = document.getElementById("restart-omissions");
  const restartError = document.getElementById("restart-error");
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
  // A sentence written after a user action has to remember which catalogue entry produced
  // it, otherwise switching language leaves it frozen in the language it was written in.
  // \`say\` records the key and its parameters on the node so applyLocale can rewrite it;
  // \`text\` writes what has no catalogue entry at all (a project name, a hash, a server
  // detail) and drops any stale key, so a node is never retranslated into what it no
  // longer says.
  const text = (element, value) => { if (element.dataset && element.dataset.i18n !== undefined) { delete element.dataset.i18n; delete element.dataset.i18nArgs; } element.textContent = value; };
  const say = (element, key, parameters = null) => { element.dataset.i18n = key; if (parameters) element.dataset.i18nArgs = JSON.stringify(parameters); else delete element.dataset.i18nArgs; render(element); };
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
    home: ["home"],
    technical: ["technical"],
    dashboard: ["dashboard"],
    projects: ["welcome", "projects", "next-step", "import", "transcripts"],
    evidence: ["general-inbox", "search", "event-detail", "artifact-detail"],
    memory: ["memory", "memory-detail"],
    work: ["work-items", "work-detail", "handoff-builder", "handoff-detail"],
    privacy: ["privacy", "context-pack", "privacy-audit"],
    scripts: ["scripts"],
    settings: ["settings"],
    system: ["system-status", "instructions", "agent-profile", "capabilities"],
  });
  const pageTitleKeys = Object.freeze({
    home: "navHome",
    technical: "homeTechnicalHeading",
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
    return { page: Object.hasOwn(pageSections, candidate) ? candidate : "home", parameters: new URLSearchParams(query === -1 ? "" : fragment.slice(query + 1)) };
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
    const clear = document.createElement("button"); clear.type = "button"; say(clear, "filterClear");
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
    say(document.getElementById("page-title"), pageTitleKeys[page]);
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
    if (!response.ok) throw new Error(problem(value));
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
      throw new Error(value && value.message ? problem(value) : body);
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
      say(dashboardStatus, "dashboardUpdatedStatus");
    } catch (cause) {
      say(dashboardStatus, "dashboardAttentionStatus");
      detail(dashboardError, cause);
    }
  };
  const loadSystemSnapshot = async () => {
    const systemError = document.getElementById("system-error");
    text(systemError, "");
    try {
      const value = await api("/api/dashboard");
      say(document.getElementById("system-project-coverage"), "systemProjectCoverage", { available: number(value.coverage.availableProjects), total: number(value.projects.total), unavailable: number(value.coverage.unavailableProjects) });
      say(document.getElementById("system-updated"), "systemSnapshot", { updated: dateTime(value.asOf) });
    } catch (cause) {
      detail(systemError, cause);
    }
  };
  document.getElementById("dashboard-refresh").addEventListener("click", loadDashboard);
  const selectProject = (project, focusNext = true) => { selectedProject = project.id; sessionStorage.setItem("aiw-project", project.id); say(guidance, "selectedProject"); importSection.hidden = false; transcriptSection.hidden = false; memorySection.hidden = false; workSection.hidden = false; instructionSection.hidden = false; agentProfileSection.hidden = false; privacyAuditSection.hidden = false; say(importStatus, "readyImport", { name: project.name }); loadMemory(); loadWork(); loadPrivacyAudit(true); if (focusNext) nextStep.focus(); };
  const renderProjects = (projects) => {
    registeredProjects = new Map(projects.map((project) => [project.id, project]));
    for (const selectId of ["general-link-project", "search-associated-project"]) {
      const target = document.getElementById(selectId); const previous = target.value; target.replaceChildren();
      if (selectId === "search-associated-project") { const empty = document.createElement("option"); empty.value = ""; say(empty, "searchNoAssociationFilter"); target.append(empty); }
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
    if (projects.length === 0) { say(status, "noProjects"); return; }
    if (shown.length === 0) { say(status, "noMatchingProjects"); return; }
    if (shown.length === 1) say(status, "projectRegistered"); else say(status, "projectsRegistered", { count: number(shown.length) });
    for (const project of shown) {
      const article = document.createElement("article"); article.className = "project-card";
      const heading = document.createElement("h3"); text(heading, project.name); article.append(heading);
      const details = document.createElement("p"); say(details, "projectCardSummary", { branch: project.branch || { key: "projectBranchDetached" }, state: { key: project.isDirty ? "projectStateDirty" : "projectStateClean" } }); article.append(details);
      const select = document.createElement("button"); select.type = "button"; say(select, "selectProject", { name: project.name });
      select.addEventListener("click", () => selectProject(project));
      const inspect = document.createElement("button"); inspect.type = "button"; say(inspect, "refreshGit");
      inspect.addEventListener("click", async () => { try { say(status, "refreshingGit"); await api("/api/projects/" + encodeURIComponent(project.id) + "/inspect", { method: "POST", body: "{}" }); await loadProjects(); } catch (cause) { detail(error, cause); error.focus?.(); } });
      article.append(select, inspect); list.append(article);
    }
  };
  const loadProjects = async () => { try { renderProjects(await api("/api/projects")); await loadDashboard(); } catch (cause) { say(status, "projectsLoadFailed"); detail(error, cause); } };
  const loadPrivacyAudit = async (reset = false) => {
    const auditStatus = document.getElementById("privacy-audit-status");
    const auditError = document.getElementById("privacy-audit-error");
    if (!selectedProject) { say(auditStatus, "auditSelectProject"); return; }
    if (reset) { privacyAuditCursor = null; privacyAuditList.replaceChildren(); document.getElementById("privacy-audit-detail").hidden = true; }
    text(auditError, ""); say(auditStatus, "auditLoading");
    try {
      const suffix = privacyAuditCursor ? "?limit=25&cursor=" + encodeURIComponent(privacyAuditCursor) : "?limit=25";
      const page = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/privacy-audit" + suffix);
      if (page.events.length === 0 && privacyAuditList.childElementCount === 0) say(auditStatus, "auditNoDecisions");
      else say(auditStatus, "auditCount", { count: number(page.total) });
      for (const event of page.events) {
        const article = document.createElement("article"); article.className = "result-card";
        const heading = document.createElement("h3"); text(heading, event.decision + " · " + event.occurredAt);
        const summary = document.createElement("p"); say(summary, "auditEventSummary", { work: event.workItemId, handoff: event.handoffId, model: event.modelId, policy: event.policyId, version: String(event.policyVersion), allowed: String(event.counts.allowedItems), blocked: String(event.counts.blockedItems) });
        const inspect = document.createElement("button"); inspect.type = "button"; say(inspect, "auditInspect");
        inspect.addEventListener("click", async () => { try { const detail = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/privacy-audit/" + encodeURIComponent(event.eventId)); const output = document.getElementById("privacy-audit-detail"); text(output, JSON.stringify(detail, null, 2)); output.hidden = false; output.focus(); } catch (cause) { detail(auditError, cause); } });
        article.append(heading, summary, inspect); privacyAuditList.append(article);
      }
      privacyAuditCursor = page.nextCursor; privacyAuditMore.hidden = privacyAuditCursor === null;
    } catch (cause) { privacyAuditMore.hidden = true; say(auditStatus, "auditAttention"); detail(auditError, cause); document.getElementById("privacy-audit-refresh").focus(); }
  };
  document.getElementById("privacy-audit-refresh").addEventListener("click", () => loadPrivacyAudit(true));
  privacyAuditMore.addEventListener("click", () => loadPrivacyAudit(false));
  document.getElementById("register-project-form").addEventListener("submit", async (event) => {
    event.preventDefault(); text(error, ""); say(status, "registerValidating");
    const input = document.getElementById("project-path");
    try { const project = await api("/api/projects", { method: "POST", body: JSON.stringify({ path: input.value }) }); input.value = ""; await loadProjects(); say(guidance, "projectReady", { name: project.name }); nextStep.focus(); }
    catch (cause) { say(status, "registerAttention"); detail(error, cause); input.focus(); }
  });
  document.getElementById("import-sample").addEventListener("click", async () => {
    if (!selectedProject) { say(importError, "importNoProject"); document.getElementById("projects-heading").focus(); return; }
    text(importError, ""); say(importStatus, "importRunning");
    try { const report = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/import-sample", { method: "POST", body: "{}" }); say(importStatus, "importDone", { added: number(report.addedEvents), unchanged: number(report.existingEvents), total: number(report.totalEvents) }); say(guidance, "sampleReadyGuidance"); searchSection.hidden = false; await loadConversations(); openPage("evidence", false); queueMicrotask(() => document.getElementById("search-heading").focus()); }
    catch (cause) { say(importStatus, "importAttention"); detail(importError, cause); document.getElementById("import-sample").focus(); }
  });
  const renderTranscripts = (discovery) => {
    transcriptList.replaceChildren();
    if (discovery.candidates.length === 0) { say(transcriptStatus, "transcriptNone"); return; }
    say(transcriptStatus, "transcriptFound", { count: String(discovery.candidates.length) });
    for (const candidate of discovery.candidates) {
      const article = document.createElement("article"); article.className = "result-card";
      const heading = document.createElement("h3"); text(heading, candidate.fileName); article.append(heading);
      const details = document.createElement("p"); text(details, candidate.modifiedAt + " · " + candidate.byteLength + " bytes"); article.append(details);
      const button = document.createElement("button"); button.type = "button"; say(button, "transcriptImport");
      button.addEventListener("click", async () => {
        if (!selectedProject) { say(transcriptError, "transcriptNoProject"); document.getElementById("projects-heading").focus(); return; }
        text(transcriptError, ""); say(transcriptStatus, "transcriptImporting");
        try {
          const report = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/import-transcript", { method: "POST", body: JSON.stringify({ filePath: candidate.filePath }) });
          const skipped = report.skippedRecords.reduce((total, entry) => total + entry.count, 0);
          say(transcriptStatus, "transcriptCounts", { added: number(report.addedEvents), unchanged: number(report.existingEvents), total: number(report.totalEvents), skipped: number(skipped) });
          // The effect the server declares and the per-reason breakdown are domain sentences,
          // so they stay as sent and sit under the localized count instead of inside it.
          text(transcriptDetail, report.effect + (skipped === 0 ? "" : " " + report.skippedRecords.map((entry) => entry.reason + " × " + entry.count).join(", ")));
          const restricted = report.skippedRecords.filter((entry) => entry.reason.indexOf("RESTRICTED_DATA:") === 0).reduce((total, entry) => total + entry.count, 0);
          transcriptRestricted.hidden = restricted === 0;
          if (restricted === 0) text(transcriptRestricted, ""); else say(transcriptRestricted, "transcriptRestricted", { count: number(restricted) });
          searchSection.hidden = false;
          // What was just imported belongs in the list on the left, and the list is
          // drawn once at load. Without this a person imports, goes back, finds the
          // same emptiness, and concludes the import did nothing. It is defined in
          // the home fragment below and initialised by the time any click runs.
          await loadConversations();
        } catch (cause) { say(transcriptStatus, "transcriptAttention"); detail(transcriptError, cause); button.focus(); }
      });
      article.append(button); transcriptList.append(article);
    }
  };
  document.getElementById("transcript-discover-form").addEventListener("submit", async (event) => {
    event.preventDefault(); text(transcriptError, ""); say(transcriptStatus, "transcriptListing");
    const input = document.getElementById("transcript-directory");
    try { renderTranscripts(await api("/api/transcripts/discover", { method: "POST", body: JSON.stringify({ directory: input.value }) })); }
    catch (cause) { transcriptList.replaceChildren(); say(transcriptStatus, "transcriptAttention"); detail(transcriptError, cause); input.focus(); }
  });
  const renderGeneral = (conversations) => {
    generalList.replaceChildren();
    conversations.length ? say(generalStatus, "generalShowing", { count: number(conversations.length) }) : say(generalStatus, "generalEmpty");
    for (const conversation of conversations) {
      const article = document.createElement("article"); article.className = "result-card";
      const heading = document.createElement("h3"); text(heading, "GENERAL · " + conversation.title);
      const state = document.createElement("p"); say(state, "generalConversationState", { count: number(conversation.events.length) });
      const select = document.createElement("button"); select.type = "button"; say(select, "generalAppend");
      select.addEventListener("click", () => { selectedGeneral = conversation; const form = document.getElementById("general-append-form"); form.hidden = false; say(document.getElementById("general-destination"), "generalDestination", { title: conversation.title, id: conversation.id }); document.getElementById("general-question").focus(); });
      article.append(heading, state);
      for (const event of conversation.events) {
        const body = document.createElement("p"); text(body, event.content);
        const metadata = document.createElement("p"); say(metadata, "generalEventMetadata", { occurred: dateTime(event.occurredAt), bytes: number(event.exactBytes), hash: event.contentSha256 });
        const copy = document.createElement("button"); copy.type = "button"; say(copy, "generalCopyPhrase");
        copy.addEventListener("click", async () => { const phrase = event.content.slice(0, 80); await navigator.clipboard?.writeText(phrase); document.getElementById("search-query").value = phrase; document.getElementById("search-scope").value = "GENERAL"; say(generalStatus, "generalPhrasePrepared"); });
        const link = document.createElement("button"); link.type = "button"; say(link, "generalLinkButton");
        link.addEventListener("click", () => { selectedGeneral = conversation; selectedGeneralEvent = event; const form = document.getElementById("general-link-form"); form.hidden = false; say(document.getElementById("general-link-source"), "generalLinkSource", { conversation: conversation.id, event: event.id, hash: event.contentSha256 }); document.getElementById("general-link-project").focus(); });
        article.append(body, metadata, copy, link);
      }
      article.append(select); generalList.append(article);
    }
  };
  const loadGeneral = async () => { text(generalError, ""); try { renderGeneral(await api("/api/general/conversations")); } catch (cause) { say(generalStatus, "generalAttention"); detail(generalError, cause); } };
  document.getElementById("general-create-form").addEventListener("submit", async (event) => { event.preventDefault(); const input = document.getElementById("general-title"); text(generalError, ""); try { selectedGeneral = await api("/api/general/conversations", { method: "POST", body: JSON.stringify({ title: input.value }) }); input.value = ""; await loadGeneral(); await loadConversations(); const form = document.getElementById("general-append-form"); form.hidden = false; say(document.getElementById("general-destination"), "generalDestination", { title: selectedGeneral.title, id: selectedGeneral.id }); document.getElementById("general-question").focus(); } catch (cause) { detail(generalError, cause); input.focus(); } });
  document.getElementById("general-append-form").addEventListener("submit", async (event) => { event.preventDefault(); const input = document.getElementById("general-question"); if (!selectedGeneral) return; text(generalError, ""); try { selectedGeneral = await api("/api/general/conversations/" + encodeURIComponent(selectedGeneral.id) + "/events", { method: "POST", body: JSON.stringify({ expectedEventCount: selectedGeneral.events.length, content: input.value }) }); input.value = ""; await loadGeneral(); await loadConversations(); say(generalStatus, "generalQuestionSaved"); } catch (cause) { detail(generalError, cause); input.focus(); } });
  document.getElementById("general-link-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("general-link-error"); text(error, ""); if (!selectedGeneral || !selectedGeneralEvent) { say(error, "generalLinkReload"); return; } const project = document.getElementById("general-link-project"); const rationale = document.getElementById("general-link-rationale"); try { const link = await api("/api/general/project-links", { method: "POST", body: JSON.stringify({ generalConversationId: selectedGeneral.id, generalEventId: selectedGeneralEvent.id, generalContentSha256: selectedGeneralEvent.contentSha256, targetProjectId: project.value, rationale: rationale.value }) }); rationale.value = ""; say(generalStatus, "generalLinkCreated", { project: link.targetProjectId, id: link.id }); } catch (cause) { say(error, "generalLinkFailed"); detail(document.getElementById("general-link-detail"), cause); rationale.focus(); } });
  // Retrieval forgives accents, word endings and typing errors, so a result can be
  // reached by a word the reader did not type. Each reason is its own element with its
  // own catalogue key, so switching language re-renders it like every other sentence.
  const reasonList = (reasons) => {
    const stated = (reasons || []).filter((reason) => catalogs.en["reason" + reason.kind]).slice(0, 3);
    if (stated.length === 0) return null;
    const group = document.createElement("div");
    const label = document.createElement("p"); say(label, "searchWhyMatched"); group.append(label);
    const list = document.createElement("ul");
    for (const reason of stated) { const item = document.createElement("li"); say(item, "reason" + reason.kind, { term: reason.term, matched: reason.matched }); list.append(item); }
    group.append(list);
    return group;
  };
  // Three steps and no selection: open a project, ask, carry the answer away. The
  // summary is composed from what the stores already hold, so there is nothing to
  // choose and nothing to save, and nothing leaves the computer by preparing it.
  const prepareRestart = async () => {
    text(restartError, ""); say(restartStatus, "restartPreparing");
    const question = document.getElementById("search-query").value;
    try {
      const summary = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/restart-summary?q=" + encodeURIComponent(question));
      text(restartText, summary.text);
      say(restartStatus, "restartReady", { bytes: number(summary.exactBytes) });
      restartCopy.hidden = false;
      if (summary.omissions.length === 0) text(restartOmissions, ""); else say(restartOmissions, "restartOmitted", { omissions: summary.omissions.join("; ") });
    } catch (cause) { say(restartStatus, "restartAttention"); detail(restartError, cause); }
  };
  const syncSearchType = () => { const selectedOnly = document.getElementById("search-scope").value === "SELECTED"; const type = document.getElementById("search-type"); const association = document.getElementById("search-associated-project"); type.disabled = !selectedOnly; association.disabled = selectedOnly; if (!selectedOnly) type.value = ""; if (selectedOnly) association.value = ""; };
  document.getElementById("restart-prepare").addEventListener("click", prepareRestart);
  restartCopy.addEventListener("click", async () => { await navigator.clipboard?.writeText(restartText.textContent || ""); say(restartStatus, "restartCopied"); });
  document.getElementById("search-scope").addEventListener("change", syncSearchType);
  syncSearchType();
  const showEvent = async (projectId, eventId) => { try { selectedEvent = eventId; const value = await api("/api/projects/" + encodeURIComponent(projectId) + "/events/" + encodeURIComponent(eventId)); const metadata = document.getElementById("event-metadata"); metadata.replaceChildren(); for (const [key, content] of [["eventLabelType", value.type], ["eventLabelTrust", value.trust], ["eventLabelSession", value.sessionId], ["eventLabelOccurred", value.occurredAt ? dateTime(value.occurredAt) : message("eventOccurredUnknown")], ["eventLabelPosition", String(value.sourcePosition)]]) { const term = document.createElement("dt"); say(term, key); const value_ = document.createElement("dd"); text(value_, content); metadata.append(term, value_); } text(document.getElementById("event-payload"), value.payload); eventSection.hidden = false; artifactSection.hidden = true; document.getElementById("event-heading").focus(); } catch (cause) { detail(searchError, cause); } };
  document.getElementById("search-form").addEventListener("submit", async (event) => { event.preventDefault(); const scope = document.getElementById("search-scope").value; if (scope === "SELECTED" && !selectedProject) { say(searchError, "selectedScopeRequiresProject"); document.getElementById("search-scope").focus(); return; } text(searchError, ""); if (scope === "SELECTED") say(searchStatus, "searchingSelected"); else say(searchStatus, "searchingScope", { scope: scope === "GENERAL" ? "GENERAL_ONLY" : "ALL_SCOPES" }); searchResults.replaceChildren(); const query = document.getElementById("search-query").value; const typeValue = document.getElementById("search-type").value; const limit = document.getElementById("search-limit").value; const parameters = new URLSearchParams({ q: query, limit }); if (typeValue && scope === "SELECTED") parameters.set("type", typeValue); const associated = document.getElementById("search-associated-project").value; if (associated && scope !== "SELECTED") parameters.set("associatedProjectId", associated); try { const path = scope === "SELECTED" ? "/api/projects/" + encodeURIComponent(selectedProject) + "/search?" + parameters : "/api/scoped-search?scope=" + (scope === "GENERAL" ? "GENERAL_ONLY" : "ALL_SCOPES") + "&" + parameters; const report = await api(path); report.results.length === 0 ? say(searchStatus, "searchNoMatch") : say(searchStatus, "searchFound", { count: number(report.results.length), events: number(report.searchedEvents) }); for (const result of report.results) { const projectId = result.projectId || selectedProject; const project = result.scope === "PROJECT" ? registeredProjects.get(projectId) : null; const isGeneral = result.scope === "GENERAL"; const article = document.createElement("article"); article.className = "result-card"; const heading = document.createElement("h3"); text(heading, (isGeneral ? "GENERAL" : "PROJECT") + " · " + result.type + " · " + result.trust); const scopeLabel = document.createElement("p"); if (isGeneral) say(scopeLabel, "searchResultGeneral", { conversation: result.conversationId, hash: result.contentSha256 }); else say(scopeLabel, "resultProject", { name: result.projectName || project?.name || { key: "selectedProjectFallback" }, id: projectId }); const snippet = document.createElement("p"); text(snippet, result.snippet); article.append(heading, scopeLabel, snippet); const why = reasonList(result.reasons); if (why) article.append(why); if (isGeneral) for (const link of result.links || []) { const linked = document.createElement("p"); say(linked, "searchResultLink", { project: link.targetProjectId, actor: link.actor, verification: link.verification, effect: link.effect, created: dateTime(link.createdAt), rationale: link.rationale }); article.append(linked); } if (!isGeneral) { const inspect = document.createElement("button"); inspect.type = "button"; say(inspect, "inspectEvent"); inspect.addEventListener("click", async () => { if (result.scope === "PROJECT" && project) selectProject(project, false); await showEvent(projectId, result.eventId); }); article.append(inspect); } else { const open = document.createElement("button"); open.type = "button"; say(open, "openGeneralInbox"); open.addEventListener("click", () => { document.getElementById("general-heading").focus(); }); article.append(open); } searchResults.append(article); } restartSection.hidden = !(scope === "SELECTED" && selectedProject); } catch (cause) { say(searchStatus, "searchAttention"); detail(searchError, cause); document.getElementById("search-query").focus(); } });
  document.getElementById("open-source").addEventListener("click", async () => { if (!selectedProject || !selectedEvent) return; const artifactError = document.getElementById("artifact-error"); text(artifactError, ""); try { const value = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/events/" + encodeURIComponent(selectedEvent) + "/source"); say(document.getElementById("artifact-metadata"), "artifactMetadata", { bytes: number(value.byteLength), trust: value.trust, id: value.artifactId }); text(document.getElementById("artifact-content"), value.content); artifactSection.hidden = false; document.getElementById("artifact-heading").focus(); } catch (cause) { detail(artifactError, cause); document.getElementById("open-source").focus(); } });
  document.getElementById("back-to-results").addEventListener("click", () => { eventSection.hidden = true; document.getElementById("search-heading").focus(); });
  document.getElementById("artifact-back").addEventListener("click", () => { artifactSection.hidden = true; document.getElementById("event-heading").focus(); });
  const memoryPath = () => "/api/projects/" + encodeURIComponent(selectedProject) + "/memory";
  const sourceIds = () => selectedEvent ? [selectedEvent] : [];
  const renderHandoffMemoryOptions = (items) => { const options = document.getElementById("handoff-memory-options"); options.replaceChildren(); const activeIds = new Set(items.map((item) => item.id)); for (const id of selectedHandoffMemoryIds) if (!activeIds.has(id)) selectedHandoffMemoryIds.delete(id); if (items.length === 0) { const empty = document.createElement("p"); say(empty, "handoffNoMemory"); options.append(empty); return; } for (const item of items) { const label = document.createElement("label"); const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.value = item.id; checkbox.checked = selectedHandoffMemoryIds.has(item.id); checkbox.addEventListener("change", () => { if (checkbox.checked) selectedHandoffMemoryIds.add(item.id); else selectedHandoffMemoryIds.delete(item.id); reviewedHandoffInput = null; document.getElementById("handoff-create").hidden = true; }); const description = document.createTextNode(item.type + " · " + item.verification + " · " + item.content); label.append(checkbox, description); options.append(label); } };
  const loadMemory = async () => { if (!selectedProject) return; text(memoryError, ""); say(memoryStatus, "loadingMemory"); memoryList.replaceChildren(); const validity = document.getElementById("memory-validity").value; const parameters = new URLSearchParams({ limit: "20" }); if (validity) parameters.set("validity", validity); try { const page = await api(memoryPath() + "?" + parameters); if (!validity) renderHandoffMemoryOptions(page.items); if (page.items.length === 0) say(memoryStatus, "noMatchingMemory"); else say(memoryStatus, page.nextCursor ? "showingMemoryMore" : "showingMemory", { count: number(page.items.length) }); for (const item of page.items) { const article = document.createElement("article"); article.className = "memory-card"; const heading = document.createElement("h3"); text(heading, item.type + " · " + item.validity); const content = document.createElement("p"); text(content, item.content); const state = document.createElement("p"); text(state, item.curation + " · " + item.verification + " · " + item.confidence + " · " + message("memoryLabelVersion") + " " + number(item.version)); const inspect = document.createElement("button"); inspect.type = "button"; say(inspect, "inspectMemory"); inspect.addEventListener("click", () => showMemory(item.id)); article.append(heading, content, state, inspect); memoryList.append(article); } } catch (cause) { say(memoryStatus, "memoryAttention"); detail(memoryError, cause); } };
  const showMemory = async (memoryId) => { try { const item = await api(memoryPath() + "/" + encodeURIComponent(memoryId)); selectedMemory = item.id; const metadata = document.getElementById("memory-metadata"); metadata.replaceChildren(); for (const [key, content] of [["memoryLabelType", item.type], ["memoryLabelCuration", item.curation], ["memoryLabelValidity", item.validity], ["memoryLabelVerification", item.verification], ["memoryLabelConfidence", item.confidence], ["memoryLabelVersion", number(item.version)], ["memoryLabelCreated", dateTime(item.createdAt)]]) { const term = document.createElement("dt"); say(term, key); const cell = document.createElement("dd"); text(cell, content); metadata.append(term, cell); } text(document.getElementById("memory-detail-content"), item.content); const sources = document.getElementById("memory-sources"); sources.replaceChildren(); for (const source of item.sources) { const entry = document.createElement("li"); say(entry, "memorySourceEntry", { event: source.eventId, type: source.eventType, position: String(source.sourcePosition) }); sources.append(entry); } const terminal = item.validity !== "ACTIVE"; document.getElementById("memory-verify-form").hidden = terminal || item.verification === "VERIFIED"; document.getElementById("memory-supersede-form").hidden = terminal; document.getElementById("memory-invalidate-form").hidden = terminal; memoryDetail.hidden = false; document.getElementById("memory-detail-heading").focus(); } catch (cause) { detail(memoryError, cause); } };
  document.getElementById("use-memory-source").addEventListener("click", () => { if (!selectedEvent) return; memorySection.hidden = false; say(document.getElementById("memory-source-status"), "memorySourceSelected", { event: selectedEvent }); openPage("memory", false); queueMicrotask(() => document.getElementById("memory-heading").focus()); });
  document.getElementById("memory-add-form").addEventListener("submit", async (event) => { event.preventDefault(); if (!selectedProject || !selectedEvent) { say(memoryError, "memoryNeedsEvent"); return; } try { const item = await api(memoryPath(), { method: "POST", body: JSON.stringify({ type: document.getElementById("memory-type").value, content: document.getElementById("memory-content").value, sourceEventIds: sourceIds() }) }); document.getElementById("memory-content").value = ""; say(memoryStatus, "memoryCreated", { type: item.type }); await loadMemory(); await showMemory(item.id); } catch (cause) { detail(memoryError, cause); document.getElementById("memory-content").focus(); } });
  document.getElementById("memory-filter-form").addEventListener("submit", (event) => { event.preventDefault(); loadMemory(); });
  const transition = async (action, field, property) => { const detailError = document.getElementById("memory-detail-error"); if (!selectedMemory || !selectedEvent) { say(detailError, "memoryNeedsEvidence"); return; } try { const value = document.getElementById(field).value; const result = await api(memoryPath() + "/" + encodeURIComponent(selectedMemory) + "/" + action, { method: "POST", body: JSON.stringify({ [property]: value, sourceEventIds: sourceIds() }) }); document.getElementById(field).value = ""; const item = result.replacement || result; await loadMemory(); await showMemory(item.id); } catch (cause) { detail(detailError, cause); document.getElementById(field).focus(); } };
  document.getElementById("memory-verify-form").addEventListener("submit", (event) => { event.preventDefault(); transition("verify", "memory-note", "note"); });
  document.getElementById("memory-supersede-form").addEventListener("submit", (event) => { event.preventDefault(); transition("supersede", "memory-replacement", "content"); });
  document.getElementById("memory-invalidate-form").addEventListener("submit", (event) => { event.preventDefault(); transition("invalidate", "memory-reason", "reason"); });
  document.getElementById("memory-back").addEventListener("click", () => { memoryDetail.hidden = true; document.getElementById("memory-heading").focus(); });
  const workPath = () => "/api/projects/" + encodeURIComponent(selectedProject) + "/work-items";
  // The endpoint returns every Work Item of the project, so filtering here is complete:
  // no page boundary can hide an item the dashboard counted.
  const loadWork = async () => { if (!selectedProject) return; try { workItems = await api(workPath()); renderWorkList(); } catch (cause) { workItems = []; document.getElementById("work-list").replaceChildren(); detail(document.getElementById("work-error"), cause); } };
  const renderWorkList = () => {
    if (!selectedProject) return;
    const list = document.getElementById("work-list"); list.replaceChildren();
    const filter = workFilter();
    renderFilterChip("work-filter", filter === null ? null : message("filterWorkState", { state: filter }), "work");
    const shown = filter === null ? workItems : workItems.filter((item) => item.status === filter);
    const workStatus = document.getElementById("work-status"); if (workItems.length === 0) say(workStatus, "noWorkItems"); else if (shown.length === 0) say(workStatus, "noMatchingWork"); else say(workStatus, "showingWork", { count: number(shown.length) });
    for (const item of shown) { const article = document.createElement("article"); article.className = "work-card"; const heading = document.createElement("h3"); say(heading, "workCardHeading", { status: item.status, version: number(item.version) }); const objective = document.createElement("p"); text(objective, item.objective); const inspect = document.createElement("button"); inspect.type = "button"; say(inspect, "inspectWork"); inspect.addEventListener("click", () => showWork(item.id)); article.append(heading, objective, inspect); list.append(article); }
  };
  const loadHandoffs = async () => { if (!selectedWork) return; const list = document.getElementById("handoff-list"); list.replaceChildren(); const values = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs"); for (const value of values) { const button = document.createElement("button"); button.type = "button"; say(button, "inspectHandoff", { id: value.id }); button.addEventListener("click", () => showHandoff(value.id)); list.append(button); } };
  const showWork = async (id) => { try { const item = await api(workPath() + "/" + encodeURIComponent(id)); selectedWork = item.id; const metadata = document.getElementById("work-metadata"); metadata.replaceChildren(); for (const [key, value] of [["workLabelStatus", item.status], ["workLabelVersion", number(item.version)], ["workLabelCreatedBy", item.createdBy], ["workLabelUpdated", dateTime(item.updatedAt)]]) { const dt = document.createElement("dt"); say(dt, key); const dd = document.createElement("dd"); text(dd, value); metadata.append(dt, dd); } text(document.getElementById("work-objective-detail"), item.objective); const history = document.getElementById("work-transitions"); history.replaceChildren(); for (const transition of item.transitions) { const entry = document.createElement("li"); say(entry, "workTransition", { from: transition.from, to: transition.to, actor: transition.actor, occurred: dateTime(transition.occurredAt) }); history.append(entry); } const allowed = item.status === "PROPOSED" ? ["activate", "block"] : item.status === "ACTIVE" ? ["block", "complete"] : item.status === "BLOCKED" ? ["complete"] : ["reopen"]; const actionKeys = { activate: "activateWork", block: "blockWork", complete: "completeWork", reopen: "reopenWork" }; const actions = document.getElementById("work-actions"); actions.replaceChildren(); for (const action of allowed) { const button = document.createElement("button"); button.type = "button"; say(button, actionKeys[action]); button.addEventListener("click", () => transitionWork(action)); actions.append(button); } workDetail.hidden = false; handoffBuilder.hidden = item.status !== "ACTIVE"; if (item.status === "ACTIVE") loadHandoffs(); document.getElementById("work-detail-heading").focus(); } catch (cause) { detail(document.getElementById("work-error"), cause); } };
  const transitionWork = async (action) => { const error = document.getElementById("work-detail-error"); if (!selectedEvent) { say(error, "workNeedsEvidence"); return; } try { const item = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/" + action, { method: "POST", body: JSON.stringify({ sourceEventIds: [selectedEvent] }) }); await loadWork(); await showWork(item.id); } catch (cause) { detail(error, cause); } };
  document.getElementById("work-create-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("work-error"); if (!selectedEvent) { say(error, "workCreateNeedsEvidence"); return; } try { const item = await api(workPath(), { method: "POST", body: JSON.stringify({ objective: document.getElementById("work-objective").value, sourceEventIds: [selectedEvent] }) }); document.getElementById("work-objective").value = ""; await loadWork(); await showWork(item.id); } catch (cause) { detail(error, cause); document.getElementById("work-objective").focus(); } });
  document.getElementById("work-back").addEventListener("click", () => { workDetail.hidden = true; handoffBuilder.hidden = true; document.getElementById("work-heading").focus(); });
  const handoffInput = () => { const command = document.getElementById("handoff-test-command").value.trim(); return ({ nextAction: document.getElementById("handoff-next").value, sourceEventIds: selectedEvent ? [selectedEvent] : [], memoryIds: [...selectedHandoffMemoryIds].sort(), relevantFiles: document.getElementById("handoff-files").value.split(/\\r?\\n/u).map((value) => value.trim()).filter(Boolean), ...(command ? { testState: [{ command, outcome: document.getElementById("handoff-test-outcome").value, observedAt: document.getElementById("handoff-test-at").value.trim() || null }] } : {}), ...(document.getElementById("handoff-predecessor").value.trim() ? { predecessorId: document.getElementById("handoff-predecessor").value.trim() } : {}) }); };
  document.getElementById("handoff-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("handoff-error"); const previewContent = document.getElementById("handoff-preview-content"); text(error, ""); try { reviewedHandoffInput = handoffInput(); const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/preview", { method: "POST", body: JSON.stringify(reviewedHandoffInput) }); say(document.getElementById("handoff-preview-result"), "handoffPreviewReady", { schema: String(value.measurement.schemaVersion), bytes: number(value.measurement.exactHandoffBytes), sources: number(value.handoff.sections.sourceReferences.value.length) }); text(previewContent, JSON.stringify(value.handoff, null, 2)); previewContent.hidden = false; document.getElementById("handoff-create").hidden = false; previewContent.focus(); } catch (cause) { reviewedHandoffInput = null; previewContent.hidden = true; document.getElementById("handoff-create").hidden = true; detail(error, cause); } });
  document.getElementById("handoff-create").addEventListener("click", async () => { if (!reviewedHandoffInput) return; try { const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/create", { method: "POST", body: JSON.stringify(reviewedHandoffInput) }); reviewedHandoffInput = null; document.getElementById("handoff-create").hidden = true; await loadHandoffs(); await showHandoff(value.id); } catch (cause) { detail(document.getElementById("handoff-error"), cause); } });
  const showHandoff = async (id) => { try { const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(id)); selectedHandoff = value.id; text(document.getElementById("handoff-content"), JSON.stringify(value, null, 2)); handoffDetail.hidden = false; contextSection.hidden = false; document.getElementById("handoff-detail-heading").focus(); } catch (cause) { detail(document.getElementById("handoff-error"), cause); } };
  document.getElementById("handoff-validate").addEventListener("click", async () => { try { const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/validate"); value.matches ? say(document.getElementById("handoff-validation"), "handoffMatch") : say(document.getElementById("handoff-validation"), "handoffDrift", { differences: value.differences.join(", "), recovery: value.recovery }); } catch (cause) { detail(document.getElementById("handoff-detail-error"), cause); } });
  document.getElementById("handoff-successor").addEventListener("click", () => { document.getElementById("handoff-predecessor").value = selectedHandoff || ""; handoffDetail.hidden = true; document.getElementById("handoff-builder-heading").focus(); });
  document.getElementById("handoff-back").addEventListener("click", () => { handoffDetail.hidden = true; document.getElementById("handoff-builder-heading").focus(); });
  document.getElementById("instructions-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("instruction-error"); const content = document.getElementById("instruction-content"); text(error, ""); if (!selectedProject) { say(error, "instructionEmpty"); return; } const paths = document.getElementById("instruction-bundles").value.split(/\\r?\\n/u).map((value) => value.trim()).filter(Boolean); const optional = (id) => document.getElementById(id).value.trim() || undefined; try { const value = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/instructions/preview", { method: "POST", body: JSON.stringify({ bundles: paths.map((path) => ({ path })), model: optional("instruction-model"), agent: optional("instruction-agent"), task: optional("instruction-task") }) }); say(document.getElementById("instruction-status"), "previewReady"); text(content, JSON.stringify(value, null, 2)); content.hidden = false; content.focus(); } catch (cause) { content.hidden = true; detail(error, cause); document.getElementById("instruction-bundles").focus(); } });
  document.getElementById("agent-profile-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("agent-profile-error"); const content = document.getElementById("agent-profile-content"); text(error, ""); if (!selectedProject) { say(error, "profileEmpty"); return; } const path = document.getElementById("agent-profile-path").value.trim(); const expectedDigest = document.getElementById("agent-profile-digest").value.trim(); try { const value = await api("/api/projects/" + encodeURIComponent(selectedProject) + "/agent-profile/preview", { method: "POST", body: JSON.stringify({ path, ...(expectedDigest ? { expectedDigest } : {}) }) }); say(document.getElementById("agent-profile-status"), "profileReady", { name: value.bundle.agent.name, skills: String(value.bundle.skills.length), sourceBytes: String(value.sourceBytes), canonicalBytes: String(value.canonicalBytes) }); text(content, JSON.stringify(value, null, 2)); content.hidden = false; content.focus(); } catch (cause) { content.hidden = true; detail(error, cause); document.getElementById("agent-profile-path").focus(); } });
  document.getElementById("context-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("context-error"); const content = document.getElementById("context-content"); text(error, ""); if (!selectedProject || !selectedWork || !selectedHandoff) { say(error, "contextEmpty"); return; } const paths = document.getElementById("context-bundles").value.split(/\\r?\\n/u).map((value) => value.trim()).filter(Boolean); try { const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/context/preview", { method: "POST", body: JSON.stringify({ bundles: paths.map((path) => ({ path })), continuityBudget: Number(document.getElementById("context-continuity-budget").value), instructionBudget: Number(document.getElementById("context-instruction-budget").value) }) }); const summary = value.sourceTableSummary || { entryCount: 0, exactBytes: 0 }; say(document.getElementById("context-status"), "contextReady", { schema: String(value.schemaVersion), entries: String(summary.entryCount), sharedBytes: String(summary.exactBytes) }); text(content, JSON.stringify(value, null, 2)); content.hidden = false; content.focus(); } catch (cause) { content.hidden = true; detail(error, cause); document.getElementById("context-continuity-budget").focus(); } });
  document.getElementById("profile-context-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("profile-context-error"); const content = document.getElementById("profile-context-content"); text(error, ""); if (!selectedProject || !selectedWork || !selectedHandoff) { say(error, "profileContextEmpty"); return; } const path = document.getElementById("profile-context-path").value.trim(); const expectedDigest = document.getElementById("profile-context-digest").value.trim(); const paths = document.getElementById("profile-context-bundles").value.split(/\\r?\\n/u).map((value) => value.trim()).filter(Boolean); const model = document.getElementById("profile-context-model").value.trim(); const task = document.getElementById("profile-context-task").value.trim(); try { const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/profile-context/preview", { method: "POST", body: JSON.stringify({ profile: { path, ...(expectedDigest ? { expectedDigest } : {}) }, bundles: paths.map((bundlePath) => ({ path: bundlePath })), model, ...(task ? { task } : {}) }) }); say(document.getElementById("profile-context-status"), "profileContextReady", { profile: value.selection.profile.id, model: value.selection.target.model, sources: String(value.selection.instructionSources.length), rules: String(value.instructions.rules.length), schema: String(value.contextPack.schemaVersion) }); text(content, JSON.stringify(value, null, 2)); content.hidden = false; content.focus(); } catch (cause) { content.hidden = true; detail(error, cause); document.getElementById("profile-context-path").focus(); } });
  document.getElementById("privacy-preflight-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("privacy-preflight-error"); const content = document.getElementById("privacy-preflight-content"); text(error, ""); if (!selectedProject || !selectedWork || !selectedHandoff) { say(error, "privacyPreflightEmpty"); return; } const profilePath = document.getElementById("privacy-profile-path").value.trim(); const profileDigest = document.getElementById("privacy-profile-digest").value.trim(); const policyPath = document.getElementById("privacy-policy-path").value.trim(); const policyDigest = document.getElementById("privacy-policy-digest").value.trim(); const paths = document.getElementById("privacy-bundles").value.split(/\\r?\\n/u).map((value) => value.trim()).filter(Boolean); const model = document.getElementById("privacy-model").value.trim(); const task = document.getElementById("privacy-task").value.trim(); try { const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/privacy-preflight/preview", { method: "POST", body: JSON.stringify({ profile: { path: profilePath, ...(profileDigest ? { expectedDigest: profileDigest } : {}) }, policy: { path: policyPath, ...(policyDigest ? { expectedDigest: policyDigest } : {}) }, bundles: paths.map((path) => ({ path })), model, ...(task ? { task } : {}) }) }); const counts = value.preflight.accounting; say(document.getElementById("privacy-preflight-status"), "privacyPreflightReady", { result: value.preflight.overallResult, model: value.preflight.modelId, policy: value.preflight.policy.id, allowed: String(counts.allowedItems), blocked: String(counts.blockedItems), defaulted: String(counts.defaultedItems), restricted: String(counts.restrictedItems) }); say(document.getElementById("privacy-preflight-audit"), "privacyAuditEventSuffix", { event: value.auditEvent.eventId }); text(content, JSON.stringify(value, null, 2)); content.hidden = false; content.focus(); loadPrivacyAudit(true); } catch (cause) { content.hidden = true; detail(error, cause); document.getElementById("privacy-policy-path").focus(); } });
  document.getElementById("customer-alias-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("customer-alias-error"); const results = document.getElementById("customer-alias-results"); const confirm = document.getElementById("customer-alias-confirm"); text(error, ""); results.replaceChildren(); confirm.hidden = true; customerAliasSuggestions = []; if (!selectedProject || !selectedWork || !selectedHandoff) { say(error, "customerAliasEmpty"); return; } const profilePath = document.getElementById("privacy-profile-path").value.trim(); const profileDigest = document.getElementById("privacy-profile-digest").value.trim(); const policyPath = document.getElementById("privacy-policy-path").value.trim(); const policyDigest = document.getElementById("privacy-policy-digest").value.trim(); const paths = document.getElementById("privacy-bundles").value.split(/\\r?\\n/u).map((value) => value.trim()).filter(Boolean); const model = document.getElementById("privacy-model").value.trim(); const task = document.getElementById("privacy-task").value.trim(); const dictionary = document.getElementById("customer-aliases").value.split(/\\r?\\n/u).map((line) => line.trim()).filter(Boolean).map((line) => { const match = /^(CUSTOMER|PROJECT):\\s*(.+)$/u.exec(line); if (!match) throw new Error(message("aliasPrefixRequired")); return { entityType: match[1], alias: match[2] }; }); const profile = { path: profilePath, ...(profileDigest ? { expectedDigest: profileDigest } : {}) }; const bundles = paths.map((path) => ({ path })); try { const [value, context] = await Promise.all([api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/entity-alias-suggestions/preview", { method: "POST", body: JSON.stringify({ profile, policy: { path: policyPath, ...(policyDigest ? { expectedDigest: policyDigest } : {}) }, bundles, model, ...(task ? { task } : {}), dictionary }) }), api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/profile-context/preview", { method: "POST", body: JSON.stringify({ profile, bundles, model, ...(task ? { task } : {}) }) })]); customerAliasSuggestions = value.suggestions.suggestions; const items = new Map(context.contextPack.included.map((item) => [item.id, item.content])); const encoder = new TextEncoder(); const decoder = new TextDecoder("utf-8", { fatal: true }); customerAliasSuggestions.forEach((suggestion, index) => { const content = items.get(suggestion.itemId); if (typeof content !== "string") throw new Error(message("aliasItemMissing")); const bytes = encoder.encode(content); const row = document.createElement("li"); const label = document.createElement("label"); const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.dataset.suggestionIndex = String(index); label.append(checkbox, document.createTextNode(" " + suggestion.entityType + " · " + suggestion.itemId + " · UTF-8 " + suggestion.byteStart + "–" + suggestion.byteEnd + " · " + suggestion.state)); const sample = document.createElement("code"); sample.append(document.createTextNode(decoder.decode(bytes.slice(0, suggestion.byteStart)))); const mark = document.createElement("mark"); text(mark, decoder.decode(bytes.slice(suggestion.byteStart, suggestion.byteEnd))); sample.append(mark, document.createTextNode(decoder.decode(bytes.slice(suggestion.byteEnd)))); row.append(label, document.createElement("br"), sample); results.append(row); }); say(document.getElementById("customer-alias-status"), "customerAliasReady", { count: String(customerAliasSuggestions.length) }); confirm.hidden = customerAliasSuggestions.length === 0; if (!confirm.hidden) confirm.focus(); } catch (cause) { customerAliasSuggestions = []; results.replaceChildren(); confirm.hidden = true; detail(error, cause); document.getElementById("customer-aliases").focus(); } });
  document.getElementById("customer-alias-confirm").addEventListener("click", () => { const selected = [...document.querySelectorAll("#customer-alias-results input[type=checkbox]:checked")].map((entry) => customerAliasSuggestions[Number(entry.dataset.suggestionIndex)]).filter(Boolean).map(({ itemId, contentSha256, byteStart, byteEnd, entityType }) => ({ itemId, contentSha256, byteStart, byteEnd, entityType })); if (selected.length === 0) { say(document.getElementById("customer-alias-error"), "customerAliasSelectOne"); return; } document.getElementById("pseudonym-selections").value = JSON.stringify(selected, null, 2); say(document.getElementById("customer-alias-status"), "customerAliasConfirmed", { count: String(selected.length) }); document.getElementById("pseudonym-selections").focus(); });
  document.getElementById("pseudonymization-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("pseudonymization-error"); const content = document.getElementById("pseudonymization-content"); const passphraseField = document.getElementById("pseudonym-passphrase"); text(error, ""); if (!selectedProject || !selectedWork || !selectedHandoff) { say(error, "pseudonymNeedsHandoff"); return; } try { const profilePath = document.getElementById("privacy-profile-path").value.trim(); const profileDigest = document.getElementById("privacy-profile-digest").value.trim(); const policyPath = document.getElementById("privacy-policy-path").value.trim(); const policyDigest = document.getElementById("privacy-policy-digest").value.trim(); const paths = document.getElementById("privacy-bundles").value.split(/\\r?\\n/u).map((value) => value.trim()).filter(Boolean); const model = document.getElementById("privacy-model").value.trim(); const task = document.getElementById("privacy-task").value.trim(); const selections = JSON.parse(document.getElementById("pseudonym-selections").value); const schemaVersion = selections.some((entry) => entry && entry.entityType === "PROJECT") ? 2 : 1; const review = { schemaVersion, mappingSetId: document.getElementById("pseudonym-mapping-id").value.trim(), projectId: selectedProject, workItemId: selectedWork, handoffId: selectedHandoff, modelId: model, attribution: "USER_REVIEWED", selections }; const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/pseudonymization/preview", { method: "POST", body: JSON.stringify({ profile: { path: profilePath, ...(profileDigest ? { expectedDigest: profileDigest } : {}) }, policy: { path: policyPath, ...(policyDigest ? { expectedDigest: policyDigest } : {}) }, bundles: paths.map((path) => ({ path })), model, ...(task ? { task } : {}), review, keyCustody: { mode: document.getElementById("pseudonym-custody-mode").value, passphrase: passphraseField.value } }) }); const counts = value.transformation.accounting; say(document.getElementById("pseudonymization-status"), "pseudonymReady", { schema: String(value.mapping.schemaVersion), selections: number(counts.reviewedSelections), items: number(counts.transformedItems), mapping: value.mapping.mappingSetId }); text(content, JSON.stringify(value, null, 2)); content.hidden = false; content.focus(); } catch (cause) { content.hidden = true; detail(error, cause); document.getElementById("pseudonym-selections").focus(); } finally { passphraseField.value = ""; } });
  document.getElementById("output-restoration-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("output-restoration-error"); const content = document.getElementById("output-restoration-content"); const passphraseField = document.getElementById("output-restoration-passphrase"); text(error, ""); if (!selectedProject || !selectedWork || !selectedHandoff) { say(error, "restorationNeedsHandoff"); return; } try { const mappingSetId = document.getElementById("output-restoration-mapping-id").value.trim(); const output = document.getElementById("output-restoration-candidate").value; const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/output-restoration/preview", { method: "POST", body: JSON.stringify({ mappingSetId, passphrase: passphraseField.value, output }) }); say(document.getElementById("output-restoration-status"), "restorationReady", { decision: value.decision, schema: String(value.mappingSchemaVersion), tokens: number(value.restoredTokens), anomalies: number(value.anomalyCount) }); text(content, value.restoredContent === null ? JSON.stringify({ ...value, restoredContent: null }, null, 2) : value.restoredContent); content.hidden = false; content.focus(); } catch (cause) { content.hidden = true; detail(error, cause); document.getElementById("output-restoration-mapping-id").focus(); } finally { passphraseField.value = ""; } });
  document.getElementById("context-selector-form").addEventListener("submit", async (event) => { event.preventDefault(); const error = document.getElementById("context-selector-error"); const content = document.getElementById("context-selector-content"); text(error, ""); if (!selectedProject || !selectedWork || !selectedHandoff) { say(error, "contextSelectorEmpty"); return; } const path = document.getElementById("context-selector-profile-path").value.trim(); const expectedDigest = document.getElementById("context-selector-profile-digest").value.trim(); try { const value = await api(workPath() + "/" + encodeURIComponent(selectedWork) + "/handoffs/" + encodeURIComponent(selectedHandoff) + "/context-selectors/preview", { method: "POST", body: JSON.stringify({ profile: { path, ...(expectedDigest ? { expectedDigest } : {}) } }) }); const measured = value.report.cases[0]; const budget = measured.budgets[0]; say(document.getElementById("context-selector-status"), "contextSelectorReady", { selected: String(measured.selectedCandidateBytes), baseline: String(measured.baselineCandidateBytes), reduction: String(measured.reductionPercentFromBaseline), loss: String(measured.safetyFloorLossCount), fit: budget.selectorPolicyFits ? "YES" : "NO" }); text(content, JSON.stringify(value, null, 2)); content.hidden = false; content.focus(); } catch (cause) { content.hidden = true; detail(error, cause); document.getElementById("context-selector-profile-path").focus(); } });
  if (selectedProject) { importSection.hidden = false; transcriptSection.hidden = false; memorySection.hidden = false; workSection.hidden = false; instructionSection.hidden = false; agentProfileSection.hidden = false; privacyAuditSection.hidden = false; say(importStatus, "returningImport"); loadMemory(); loadWork(); loadPrivacyAudit(true); }
  ${PRIVACY_BEHAVIOUR}
  ${HOME_BEHAVIOUR}
  ${RESTART_POINT_BEHAVIOUR}
  applyLocale();
  if (!location.hash.startsWith("#/")) history.replaceState(null, "", "#/home");
  renderRoute(false);
  loadGeneral();
  loadProjects();
  // The list is drawn from what is already stored, then whatever arrived since is
  // brought in behind it. In that order, so the page answers immediately instead of
  // waiting on a directory read that may find nothing.
  loadConversations().then(loadArrived);
})();
`;

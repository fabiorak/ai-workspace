/**
 * Behaviour of the opening screen, inserted into the single served script.
 *
 * It is a source fragment rather than a module because `/app.js` is one IIFE
 * under `script-src 'self'` with no bundler: keeping the home in its own file is
 * the decomposition ADR-0035 asks for, and splicing it in is what preserves the
 * single-script contract. It uses the helpers the IIFE already defines — `api`,
 * `say`, `text`, `message`, `number`, `dateTime`, `reasonList`, `openPage` — and
 * assigns no `innerHTML`.
 *
 * Two accessibility rules are visible in the code and are not decoration. Focus
 * moves only when the reader asked for something, so a list arriving on its own
 * never steals the caret. And every count is announced through a polite live
 * region, because "done" without a number tells a person who cannot see the list
 * nothing at all.
 */
export const HOME_BEHAVIOUR = `
  const conversationStatus = document.getElementById("conversation-status");
  const conversationGroups = document.getElementById("conversation-groups");
  const conversationCount = document.getElementById("conversation-count");
  const homeEmpty = document.getElementById("home-empty");
  const homeAnswerHeading = document.getElementById("home-answer-heading");
  const homeAnswerStatus = document.getElementById("home-answer-status");
  const homeAnswerResults = document.getElementById("home-answer-results");
  const homeAskError = document.getElementById("home-ask-error");
  // A row names itself with the person's own first question. When that question lives in an
  // artifact there is nothing to quote, so the date stands in: a made-up summary would read
  // like a title the person wrote, and it would not be one.
  const conversationTitle = (row) => {
    if (row.title) return row.title;
    if (row.lastMomentAt) return dateTime(row.lastMomentAt);
    return message("homeUntitled");
  };
  const momentLabel = (count) => count === 0 ? message("homeNoMoments") : count === 1 ? message("homeOneMoment") : message("homeMoments", { count: number(count) });
  const renderConversationRow = (row) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = row.kind === "NOTES" ? "#/evidence" : "#/evidence";
    const title = document.createElement("span");
    title.className = "conversation-title";
    text(title, conversationTitle(row));
    const meta = document.createElement("span");
    meta.className = "conversation-meta";
    const parts = [row.kind === "NOTES" ? message("homeKindNOTES") : row.projectName, momentLabel(row.momentCount)];
    // A linked Work Item contributes its state as a word, never as the constant that stores it.
    if (row.workState && catalogs.en["homeState" + row.workState]) parts.push(message("homeState" + row.workState));
    text(meta, parts.filter(Boolean).join(" · "));
    link.append(title, meta);
    item.append(link);
    return item;
  };
  const renderConversations = (page) => {
    conversationGroups.replaceChildren();
    homeEmpty.hidden = page.rows.length > 0;
    if (page.rows.length === 0) {
      say(conversationStatus, "homeEmpty");
      text(conversationCount, "");
      return;
    }
    for (const group of groupRows(page.rows)) {
      const heading = document.createElement("p");
      heading.className = "nav-label";
      say(heading, "homeGroup" + group.key);
      const list = document.createElement("ul");
      for (const row of group.rows) list.append(renderConversationRow(row));
      conversationGroups.append(heading, list);
    }
    text(conversationStatus, "");
    if (page.total > page.rows.length) say(conversationCount, "homeCounted", { shown: number(page.rows.length), total: number(page.total) });
    else say(conversationCount, "homeAllShown", { count: number(page.total) });
  };
  // Grouping by the reader's own calendar day, mirroring the server-side rule. It runs here
  // because "today" has to mean the day the reader is living, and only the browser knows it.
  const groupRows = (rows) => {
    const startOfDay = (value) => { const day = new Date(value); day.setHours(0, 0, 0, 0); return day.getTime(); };
    const today = startOfDay(new Date());
    const keyOf = (row) => {
      if (!row.lastMomentAt) return "UNDATED";
      const moment = new Date(row.lastMomentAt);
      if (Number.isNaN(moment.getTime())) return "UNDATED";
      const distance = today - startOfDay(moment);
      if (distance <= 0) return "TODAY";
      if (distance === 86400000) return "YESTERDAY";
      return "EARLIER";
    };
    return ["TODAY", "YESTERDAY", "EARLIER", "UNDATED"].map((key) => ({ key, rows: rows.filter((row) => keyOf(row) === key) })).filter((group) => group.rows.length > 0);
  };
  const loadConversations = async () => {
    try {
      renderConversations(await api("/api/conversations"));
    } catch (cause) {
      say(conversationStatus, "homeAnswerFailed");
      detail(conversationCount, cause);
    }
  };
  // The answer is the found material itself, with its provenance and the reason it came up.
  // Nothing is rewritten into prose here: what a reader sees is what is stored.
  const renderAnswer = (report) => {
    homeAnswerResults.replaceChildren();
    homeAnswerHeading.hidden = false;
    if (report.results.length === 0) {
      say(homeAnswerStatus, "homeAnswerNone");
      const hint = document.createElement("p");
      say(hint, "homeAnswerNoneDetail");
      homeAnswerResults.append(hint);
      return;
    }
    say(homeAnswerStatus, "homeAnswerComposed", { count: number(report.results.length) });
    for (const result of report.results) {
      const article = document.createElement("article");
      article.className = "result-card";
      const origin = document.createElement("p");
      origin.className = "card-kicker";
      if (result.scope === "GENERAL") say(origin, "homeFromNotes");
      else say(origin, "homeFromProject", { name: result.projectName || result.projectId });
      const snippet = document.createElement("p");
      text(snippet, result.snippet);
      article.append(origin, snippet);
      if (result.occurredAt) { const when = document.createElement("p"); when.className = "help"; text(when, dateTime(result.occurredAt)); article.append(when); }
      const why = reasonList(result.reasons);
      if (why) article.append(why);
      if (result.scope !== "GENERAL" && result.eventId) {
        const open = document.createElement("button");
        open.type = "button";
        say(open, "homeOpenMoment");
        open.addEventListener("click", async () => { openPage("evidence", false); await showEvent(result.projectId, result.eventId); });
        article.append(open);
      }
      homeAnswerResults.append(article);
    }
  };
  // Carrying the work onward is part of the same phase as finding it, so it sits in the
  // answer rather than in a screen of its own. The summary is per project by construction,
  // so it is offered for the project the answer actually came from — and not at all when
  // the answer came only from notes, because there would be no project to summarise.
  const homeRestart = document.getElementById("home-restart");
  const homeRestartStatus = document.getElementById("home-restart-status");
  const homeRestartText = document.getElementById("home-restart-text");
  const homeRestartCopy = document.getElementById("home-restart-copy");
  const homeRestartOmissions = document.getElementById("home-restart-omissions");
  const homeRestartError = document.getElementById("home-restart-error");
  let homeRestartProject = null;
  let homeRestartQuestion = "";
  const offerRestart = (report, question) => {
    const withProject = report.results.find((result) => result.scope !== "GENERAL" && result.projectId);
    homeRestartProject = withProject ? withProject.projectId : null;
    homeRestartQuestion = question;
    homeRestart.hidden = homeRestartProject === null;
    homeRestartCopy.hidden = true;
    text(homeRestartText, "");
    text(homeRestartOmissions, "");
    text(homeRestartError, "");
    if (homeRestartProject) say(homeRestartStatus, "homeRestartFor", { name: withProject.projectName || withProject.projectId });
    else text(homeRestartStatus, "");
  };
  document.getElementById("home-restart-prepare").addEventListener("click", async () => {
    if (!homeRestartProject) return;
    text(homeRestartError, "");
    say(homeRestartStatus, "restartPreparing");
    try {
      const summary = await api("/api/projects/" + encodeURIComponent(homeRestartProject) + "/restart-summary?q=" + encodeURIComponent(homeRestartQuestion));
      text(homeRestartText, summary.text);
      say(homeRestartStatus, "restartReady", { bytes: number(summary.exactBytes) });
      homeRestartCopy.hidden = false;
      if (summary.omissions.length > 0) say(homeRestartOmissions, "restartOmitted", { omissions: summary.omissions.join("; ") });
    } catch (cause) {
      say(homeRestartStatus, "restartAttention");
      detail(homeRestartError, cause);
    }
  });
  homeRestartCopy.addEventListener("click", async () => { await navigator.clipboard?.writeText(homeRestartText.textContent || ""); say(homeRestartStatus, "restartCopied"); });
  document.getElementById("home-ask-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    text(homeAskError, "");
    const field = document.getElementById("home-ask");
    const question = field.value.trim();
    if (question.length === 0) { say(homeAskError, "homeAskEmpty"); field.focus(); return; }
    say(homeAnswerStatus, "homeAnswerSearching");
    homeAnswerResults.replaceChildren();
    homeRestart.hidden = true;
    try {
      const report = await api("/api/scoped-search?scope=ALL_SCOPES&" + new URLSearchParams({ q: question, limit: "20" }));
      renderAnswer(report);
      offerRestart(report, question);
      // The reader asked, so moving focus to the answer is expected rather than an interruption.
      homeAnswerHeading.focus();
    } catch (cause) {
      say(homeAnswerStatus, "homeAnswerFailed");
      detail(homeAskError, cause);
      field.focus();
    }
  });`;

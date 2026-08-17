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
  // Seconds are noise in a narrow column: a row says which minute, and the moment
  // itself carries the exact instant when the conversation is opened.
  let rowMomentFormatter = null;
  const rowMoment = (value) => { const instant = new Date(value); if (Number.isNaN(instant.getTime())) return value; if (!rowMomentFormatter) rowMomentFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }); return rowMomentFormatter.format(instant); };
  const momentLabel = (count) => count === 0 ? message("homeNoMoments") : count === 1 ? message("homeOneMoment") : message("homeMoments", { count: number(count) });
  const renderConversationRow = (row) => {
    const item = document.createElement("li");
    // A button rather than a link: the row opens the conversation in place and does
    // not go anywhere, and a link that changes no address lies to whoever reads the
    // status bar or navigates by links.
    const link = document.createElement("button");
    link.type = "button";
    link.dataset.conversation = row.id;
    link.addEventListener("click", () => { void showConversation(row); });
    const title = document.createElement("span");
    title.className = "conversation-title";
    text(title, conversationTitle(row));
    const meta = document.createElement("span");
    meta.className = "conversation-meta";
    // The model is shown exactly as the session recorded it, because a model name is a
    // proper name. When ingestion found none, the agent stands in — that much is always
    // known — and a note shows neither, since nothing answered it.
    const ran = row.model || row.agent;
    // The day group says which day; the row says which moment of it, because two
    // sessions on the same day are told apart by their time and by what ran them.
    // A session with no readable time says nothing rather than borrowing one.
    // An untitled row already shows that time as its title, and saying it twice in
    // one row is noise rather than information.
    const when = row.lastMomentAt && row.title ? rowMoment(row.lastMomentAt) : null;
    const parts = [when, row.kind === "NOTES" ? message("homeKindNOTES") : row.projectName, ran, momentLabel(row.momentCount)];
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
    // Redrawing the list builds new rows, so whichever one is open has to be marked
    // again: an import that refreshes the list must not quietly unmark it.
    markOpenRow();
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
  // Sessions arrive on their own from the folders somebody already pointed at, so the
  // list is not empty at the start of a day nobody has imported anything into. Nothing
  // is guessed: only a folder that was named, and imported from, is read again. It is a
  // write and asks for one, because a read that imports is a read no page may trigger.
  const loadArrived = async () => {
    say(conversationStatus, "homeArrivedLooking");
    let report;
    try {
      report = await api("/api/transcripts/arrived", { method: "POST", body: "{}" });
    } catch { text(conversationStatus, ""); return; }
    if (report.sessions > 0) {
      await loadConversations();
      say(conversationStatus, report.sessions === 1 ? "homeArrivedOne" : "homeArrived", { sessions: number(report.sessions), moments: number(report.moments) });
    } else text(conversationStatus, "");
    // A folder that has gone missing is said out loud: work that silently stops
    // arriving reads like a quiet week rather than a moved directory.
    if (report.unreadable > 0) say(conversationCount, "homeArrivedUnreadable", { count: number(report.unreadable) });
  };
  // A row opens its own conversation, which is what ADR-0035 makes the unit of this
  // shell. It opens in place, under the field that found it, rather than as a screen
  // of its own: the list stays where it is, so the reader never loses the thread they
  // were following. Each moment carries the record it came from and that record's
  // fingerprint, because a conversation one cannot trace is a story, not evidence.
  const homeConversation = document.getElementById("home-conversation");
  const homeConversationStatus = document.getElementById("home-conversation-status");
  const homeConversationHeading = document.getElementById("home-conversation-heading");
  const homeConversationMeta = document.getElementById("home-conversation-meta");
  const homeConversationMoments = document.getElementById("home-conversation-moments");
  const homeConversationCount = document.getElementById("home-conversation-count");
  let openConversation = null;
  const markOpenRow = () => {
    for (const button of conversationGroups.querySelectorAll("button[data-conversation]"))
      if (button.dataset.conversation === openConversation) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
  };
  const closeConversation = () => {
    openConversation = null;
    homeConversation.hidden = true;
    homeConversationMoments.replaceChildren();
    text(homeConversationStatus, "");
    markOpenRow();
  };
  const momentSpeaker = (type) => message(catalogs.en["homeMoment" + type] ? "homeMoment" + type : "homeMomentUNKNOWN");
  const renderMoment = (moment, kind) => {
    const item = document.createElement("li");
    item.className = "moment";
    const who = document.createElement("p");
    who.className = "card-kicker";
    text(who, momentSpeaker(moment.type));
    const body = document.createElement("p");
    body.className = "moment-text";
    // An empty text is a payload kept as a separate file. Saying so beats an empty
    // paragraph, which reads as a moment that held nothing.
    if (moment.text) text(body, moment.text);
    else say(body, "homeMomentElsewhere");
    const provenance = document.createElement("p");
    provenance.className = "help";
    const fingerprint = (moment.contentHash || "").slice(0, 12);
    if (moment.sourcePosition === null) say(provenance, "homeMomentOwnSource", { hash: fingerprint });
    else say(provenance, "homeMomentSource", { position: number(moment.sourcePosition), hash: fingerprint });
    item.append(who, body, provenance);
    if (moment.occurredAt) { const when = document.createElement("p"); when.className = "help"; text(when, dateTime(moment.occurredAt)); item.append(when); }
    // Only an imported moment can fail to be the canonical envelope; a note never was
    // one, so saying it there would answer a question nobody asked.
    if (kind !== "NOTES" && !moment.fromCanonicalPayload && moment.text) { const raw = document.createElement("p"); raw.className = "help"; say(raw, "homeMomentAsStored"); item.append(raw); }
    return item;
  };
  const renderConversation = (conversation) => {
    homeConversationMoments.replaceChildren();
    const opened = conversation.moments[0];
    text(homeConversationHeading, conversation.title || (opened && opened.occurredAt ? dateTime(opened.occurredAt) : message("homeUntitled")));
    const parts = [conversation.kind === "NOTES" ? message("homeKindNOTES") : conversation.projectName, conversation.model || conversation.agent];
    text(homeConversationMeta, parts.filter(Boolean).join(" · "));
    for (const moment of conversation.moments) homeConversationMoments.append(renderMoment(moment, conversation.kind));
    if (conversation.total > conversation.moments.length) say(homeConversationCount, "homeConversationShown", { shown: number(conversation.moments.length), total: number(conversation.total) });
    else say(homeConversationCount, "homeConversationAll", { count: number(conversation.total) });
    homeConversation.hidden = false;
    text(homeConversationStatus, "");
    markOpenRow();
    // The focus moves because a person asked for this conversation, not on the
    // screen's own initiative, and it lands on the heading so a reader hears which
    // conversation opened before its moments.
    homeConversationHeading.focus();
  };
  const showConversation = async (row) => {
    if (openConversation === row.id) { closeConversation(); return; }
    openConversation = row.id;
    say(homeConversationStatus, "homeConversationOpening");
    const query = row.projectId ? "?project=" + encodeURIComponent(row.projectId) : "";
    try {
      renderConversation(await api("/api/conversations/" + encodeURIComponent(row.id) + query));
    } catch (cause) {
      openConversation = null;
      homeConversation.hidden = true;
      say(homeConversationStatus, "homeConversationFailed");
      detail(homeConversationCount, cause);
      markOpenRow();
    }
  };
  document.getElementById("home-conversation-close").addEventListener("click", () => closeConversation());
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

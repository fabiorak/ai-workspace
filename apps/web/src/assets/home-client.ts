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
    link.addEventListener("click", () => { void showConversation(row, true); });
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
    if (row.restartSignal && catalogs.en["homeRestartSignal" + row.restartSignal]) {
      const signal = document.createElement("span");
      signal.className = "conversation-signal";
      say(signal, "homeRestartSignal" + row.restartSignal);
      link.append(signal);
    }
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
    // The newest conversation is the home screen, not a second choice after reaching
    // it. Automatic opening never moves focus; a deliberate row click still does.
    if (!openConversation && currentPage() === "home" && page.rows[0]) void showConversation(page.rows[0], false);
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
      // Moments that arrived may have changed what an open conversation would take to
      // resume, so its point is composed again rather than left as it was.
      refreshRestartPoint();
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
  const homeConversationModel = document.getElementById("home-conversation-model");
  const homeMessage = document.getElementById("home-message");
  const homeSend = document.getElementById("home-send");
  const homeComposerStatus = document.getElementById("home-composer-status");
  const homeComposerError = document.getElementById("home-composer-error");
  let openConversation = null;
  let openConversationProject = null;
  const updateHomeSend = () => { homeSend.disabled = !homeMessage.value.trim() || !homeConversationModel.value; };
  const markOpenRow = () => {
    for (const button of conversationGroups.querySelectorAll("button[data-conversation]"))
      if (button.dataset.conversation === openConversation) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
  };
  const closeConversation = () => {
    openConversation = null;
    openConversationProject = null;
    homeConversation.hidden = true;
    homeConversationMoments.replaceChildren();
    text(homeConversationStatus, "");
    // The point belongs to the conversation, so closing the conversation closes it:
    // a summary left behind would describe work nobody is looking at.
    hideRestartPoint();
    markOpenRow();
  };
  const momentSpeaker = (moment, conversation) => moment.speaker || (moment.type === "AGENT_MESSAGE" && (conversation.model || conversation.agent) ? conversation.model || conversation.agent : message(catalogs.en["homeMoment" + moment.type] ? "homeMoment" + moment.type : "homeMomentUNKNOWN"));
  const technicalMoment = (type) => new Set(["TOOL_CALL", "TOOL_RESULT", "COMMAND_RESULT", "FILE_CHANGE", "TEST_RESULT"]).has(type);
  const renderMoment = (moment, conversation) => {
    const item = document.createElement("li");
    // What the person wrote themselves is what a reader scrolls a long conversation to
    // find, so those moments carry their own surface. The line above already names who
    // spoke, so the colour is a shortcut for the eye and never the only way to tell a
    // question from an answer.
    item.className = moment.type === "USER_MESSAGE" ? "moment moment-yours" : "moment";
    const who = document.createElement("p");
    who.className = "card-kicker";
    text(who, momentSpeaker(moment, conversation));
    const body = document.createElement("p");
    body.className = "moment-text";
    // An empty text is a payload kept as a separate file. Saying so beats an empty
    // paragraph, which reads as a moment that held nothing.
    if (moment.text) text(body, moment.text);
    else say(body, "homeMomentElsewhere");
    item.append(who, body);
    if (moment.occurredAt) { const when = document.createElement("p"); when.className = "help"; text(when, dateTime(moment.occurredAt)); item.append(when); }
    // Record number and fingerprint are what make this screen checkable, and also
    // exactly what an ordinary reader should not have to read: they stay one gesture
    // away instead of on every moment.
    const source = document.createElement("details");
    source.className = "moment-source";
    const sourceSummary = document.createElement("summary");
    say(sourceSummary, "homeMomentSourceSummary");
    const provenance = document.createElement("p");
    provenance.className = "help";
    const fingerprint = (moment.contentHash || "").slice(0, 12);
    if (moment.sourcePosition === null) say(provenance, "homeMomentOwnSource", { hash: fingerprint });
    else say(provenance, "homeMomentSource", { position: number(moment.sourcePosition), hash: fingerprint });
    source.append(sourceSummary, provenance);
    // Only an imported moment can fail to be the canonical envelope; a note never was
    // one, so saying it there would answer a question nobody asked.
    if (conversation.kind !== "NOTES" && !moment.fromCanonicalPayload && moment.text) { const raw = document.createElement("p"); raw.className = "help"; say(raw, "homeMomentAsStored"); source.append(raw); }
    item.append(source);
    // A long payload is opened only after this explicit gesture. The request names the
    // conversation and event, never the artifact: the server resolves that immutable
    // reference after proving the event belongs here and verifies its bytes before use.
    if (moment.textStoredSeparately) {
      const open = document.createElement("button");
      open.type = "button";
      say(open, "homeMomentOpen");
      const status = document.createElement("p");
      status.className = "help";
      status.setAttribute("role", "status");
      const error = document.createElement("p");
      error.className = "error";
      error.setAttribute("role", "alert");
      open.addEventListener("click", async () => {
        open.disabled = true;
        say(status, "homeMomentOpening");
        text(error, "");
        const query = conversation.projectId ? "?project=" + encodeURIComponent(conversation.projectId) : "";
        try {
          const reading = await api("/api/conversations/" + encodeURIComponent(conversation.id) + "/moments/" + encodeURIComponent(moment.id) + query);
          if (reading.available) {
            text(body, reading.text);
            say(status, "homeMomentOpened");
            if (!reading.fromCanonicalPayload) { const raw = document.createElement("p"); raw.className = "help"; say(raw, "homeMomentAsStored"); item.append(raw); }
            open.remove();
          } else {
            say(body, "homeMomentUnavailable");
            text(status, "");
            open.disabled = false;
          }
        } catch (cause) {
          text(status, "");
          detail(error, cause);
          open.disabled = false;
          open.focus();
        }
      });
      item.append(open, status, error);
    }
    return item;
  };
  const renderTechnicalActivity = (moments, conversation) => {
    const item = document.createElement("li");
    item.className = "technical-activity";
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    say(summary, moments.length === 1 ? "homeTechnicalActivityOne" : "homeTechnicalActivity", { count: number(moments.length) });
    const list = document.createElement("ol");
    list.className = "technical-activity-list";
    for (const moment of moments) list.append(renderMoment(moment, conversation));
    details.append(summary, list); item.append(details); return item;
  };
  const renderConversation = (conversation, focusHeading = true) => {
    homeConversationMoments.replaceChildren();
    const opened = conversation.moments[0];
    text(homeConversationHeading, conversation.title || (opened && opened.occurredAt ? dateTime(opened.occurredAt) : message("homeUntitled")));
    const parts = [conversation.kind === "NOTES" ? message("homeKindNOTES") : conversation.projectName, conversation.model || conversation.agent];
    text(homeConversationMeta, parts.filter(Boolean).join(" · "));
    let technical = [];
    const flushTechnical = () => { if (technical.length > 0) homeConversationMoments.append(renderTechnicalActivity(technical, conversation)); technical = []; };
    for (const moment of conversation.moments) {
      if (technicalMoment(moment.type)) technical.push(moment);
      else { flushTechnical(); homeConversationMoments.append(renderMoment(moment, conversation)); }
    }
    flushTechnical();
    // Open at the latest message, matching a chat rather than a transcript inspector.
    homeConversationMoments.scrollTop = homeConversationMoments.scrollHeight;
    if (conversation.total > conversation.moments.length) say(homeConversationCount, "homeConversationShown", { shown: number(conversation.moments.length), total: number(conversation.total) });
    else say(homeConversationCount, "homeConversationAll", { count: number(conversation.total) });
    homeConversation.hidden = false;
    homeEmpty.hidden = true;
    text(homeConversationStatus, "");
    homeConversationModel.value = "";
    homeMessage.value = ""; updateHomeSend(); text(homeComposerError, ""); say(homeComposerStatus, "homeTurnReady");
    // What it would take to pick this work up again sits at the end of it, composed
    // rather than fetched, and expanded rather than behind a control (ADR-0037).
    showRestartPoint(conversation);
    markOpenRow();
    // The focus moves because a person asked for this conversation, not on the
    // screen's own initiative, and it lands on the heading so a reader hears which
    // conversation opened before its moments.
    if (focusHeading) homeConversationHeading.focus();
  };
  const showConversation = async (row, focusHeading = true, refresh = false) => {
    // The list stays on the left of every screen, so a row can be clicked from a screen
    // this conversation does not open on. Going there is the product's job: leaving a
    // person to find the way themselves is the same defect as having no way back at all.
    // Clicking the selected row is idempotent. Closing a conversation because its name
    // was selected again made the primary navigation behave like a disclosure widget.
    const showing = currentPage() === "home";
    if (showing && openConversation === row.id && !refresh) { if (focusHeading) homeConversationHeading.focus(); return; }
    if (!showing) openPage("home", false);
    openConversation = row.id;
    openConversationProject = row.projectId;
    say(homeConversationStatus, "homeConversationOpening");
    const query = row.projectId ? "?project=" + encodeURIComponent(row.projectId) : "";
    try {
      const conversation = await api("/api/conversations/" + encodeURIComponent(row.id) + query);
      renderConversation(conversation, focusHeading);
      const selected = await loadConversationTarget(conversation);
      updateHomeSend();
      if (selected) say(homeComposerStatus, "homeModelLoaded", { model: selected.displayName });
      else say(homeComposerStatus, "homeTargetRequired");
    } catch (cause) {
      openConversation = null;
      openConversationProject = null;
      homeConversation.hidden = true;
      // Whatever was open is gone, so the point of the previous conversation is dropped
      // rather than left to be recomposed for a conversation nobody is reading.
      hideRestartPoint();
      say(homeConversationStatus, "homeConversationFailed");
      detail(homeConversationCount, cause);
      markOpenRow();
    }
  };
  document.getElementById("home-conversation-close").addEventListener("click", () => closeConversation());
  const homePanel = document.getElementById("home-conversation-panel");
  const homePanelHeading = document.getElementById("home-panel-heading");
  const homePanelBody = document.getElementById("home-panel-body");
  let homePanelOpener = null;
  const closeConversationPanel = () => {
    homePanel.hidden = true;
    if (homePanelOpener) { homePanelOpener.setAttribute("aria-expanded", "false"); homePanelOpener.focus(); }
    homePanelOpener = null;
  };
  const panelSentence = (key, parameters = null) => { const paragraph = document.createElement("p"); say(paragraph, key, parameters); return paragraph; };
  let lastProtectionReplacements = 0;
  // The detector finds deterministic values only, so a name, a company or an address
  // is protected only if the person names it here. The server resolves which map owns it.
  const protectedTermKinds = ["PERSON", "ORGANIZATION", "CUSTOMER", "PROJECT", "ADDRESS", "OTHER"];
  const renderProtectionPreview = (output, value) => {
    output.replaceChildren();
    const expression = /\\[\\[[A-Z_]+_\\d+\\]\\]/gu;
    let from = 0;
    for (const match of value.matchAll(expression)) {
      output.append(document.createTextNode(value.slice(from, match.index)));
      const highlighted = document.createElement("mark");
      text(highlighted, match[0]);
      output.append(highlighted);
      from = match.index + match[0].length;
    }
    output.append(document.createTextNode(value.slice(from)));
  };
  const protectionPreview = () => {
    const section = document.createElement("div");
    section.className = "protection-preview";
    const intro = panelSentence("homeProtectionPreviewIntro");
    const action = document.createElement("button");
    action.type = "button";
    say(action, "homeProtectionPreviewAction");
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    const output = document.createElement("p");
    output.className = "protection-preview-output";
    section.append(intro, action, status, output);
    if (!openConversation || openConversation.startsWith("local-preview-")) {
      action.disabled = true;
      say(status, "homeProtectionPreviewUnavailable");
      return section;
    }
    action.addEventListener("click", async () => {
      const draft = homeMessage.value;
      if (!draft.trim()) {
        say(status, "homeProtectionPreviewEmpty");
        homeMessage.focus();
        return;
      }
      action.disabled = true;
      output.replaceChildren();
      try {
        const preview = await api("/api/conversations/" + encodeURIComponent(openConversation) + "/protection-preview", {
          method: "POST",
          body: JSON.stringify({ text: draft }),
        });
        renderProtectionPreview(output, preview.text);
        say(status, "homeProtectionPreviewReady", { count: number(preview.replacements) });
      } catch {
        say(status, "homeProtectionPreviewFailed");
      }
      action.disabled = false;
    });
    return section;
  };
  const protectionTermForm = () => {
    const form = document.createElement("form");
    form.className = "protection-term";
    const label = document.createElement("label");
    label.htmlFor = "home-term-value";
    say(label, "homeProtectionTermLabel");
    const input = document.createElement("input");
    input.type = "text"; input.id = "home-term-value"; input.maxLength = 120; input.autocomplete = "off";
    const kindLabel = document.createElement("label");
    kindLabel.htmlFor = "home-term-kind";
    say(kindLabel, "homeProtectionTermKind");
    const kind = document.createElement("select");
    kind.id = "home-term-kind";
    for (const value of protectedTermKinds) { const option = document.createElement("option"); option.value = value; say(option, "homeProtectionKind" + value); kind.append(option); }
    const submit = document.createElement("button");
    submit.type = "submit"; submit.className = "protection-term-add";
    say(submit, "homeProtectionTermAdd");
    const status = document.createElement("p");
    status.className = "protection-term-status"; status.setAttribute("role", "status");
    form.append(label, input, kindLabel, kind, submit, status);
    if (!openConversation || openConversation.startsWith("local-preview-")) {
      input.disabled = true; kind.disabled = true; submit.disabled = true;
      say(status, "homeProtectionTermUnavailable");
      return form;
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const term = input.value.trim();
      if (term.length < 2) { say(status, "homeProtectionTermInvalid"); input.focus(); return; }
      submit.disabled = true;
      try {
        // The outcome is read from the status, so the sentence a person reads is one
        // of ours in their own language instead of the server's English wording.
        const response = await fetch("/api/conversations/" + encodeURIComponent(openConversation) + "/protected-terms", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-AI-Workspace-CSRF": csrf },
          body: JSON.stringify({ term, type: kind.value }),
        });
        const value = await response.json().catch(() => null);
        if (response.status === 409) say(status, "homeProtectionTermConflict", { term });
        else if (!response.ok || !value) say(status, "homeProtectionTermRefused", { term });
        else {
          say(status, value.added ? "homeProtectionTermAdded" : "homeProtectionTermKnown", { term, placeholder: value.pseudonym });
          input.value = "";
        }
      } catch { say(status, "homeProtectionTermRefused", { term }); }
      submit.disabled = false;
      input.focus();
    });
    return form;
  };
  const openConversationPanel = (kind, opener) => {
    if (homePanelOpener && homePanelOpener !== opener) homePanelOpener.setAttribute("aria-expanded", "false");
    homePanelOpener = opener; opener.setAttribute("aria-expanded", "true"); homePanelBody.replaceChildren();
    if (kind === "context") {
      say(homePanelHeading, "homeContextHeading");
      homePanelBody.append(panelSentence("homeContextSummary"), panelSentence("homeContextMaterial", { count: number(homeConversationMoments.children.length) }));
    } else {
      say(homePanelHeading, "homeProtectionHeading");
      homePanelBody.append(panelSentence("homeProtectionSummary"), panelSentence("homeProtectionFake", { count: number(lastProtectionReplacements) }), protectionPreview(), protectionTermForm());
    }
    homePanel.hidden = false; homePanelHeading.focus();
  };
  document.getElementById("home-context-open").addEventListener("click", (event) => openConversationPanel("context", event.currentTarget));
  document.getElementById("home-protection-open").addEventListener("click", (event) => openConversationPanel("protection", event.currentTarget));
  document.getElementById("home-panel-close").addEventListener("click", closeConversationPanel);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !homePanel.hidden) closeConversationPanel(); });
  homeConversationModel.addEventListener("change", async () => {
    const targetId = homeConversationModel.value;
    updateHomeSend();
    if (!targetId) { say(homeComposerStatus, "homeTargetRequired"); homeMessage.focus(); return; }
    try {
      if (openConversation && !openConversation.startsWith("local-preview-")) await selectConversationTarget(openConversation, openConversationProject, targetId);
      say(homeComposerStatus, "homeModelChanged", { model: homeConversationModel.selectedOptions[0].textContent });
    } catch (cause) {
      detail(homeComposerError, cause);
      if (openConversation && !openConversation.startsWith("local-preview-")) {
        const selected = await loadConversationTarget({ id: openConversation, projectId: openConversationProject });
        if (!selected) homeConversationModel.value = "";
      }
      updateHomeSend();
    }
    homeMessage.focus();
  });
  const startNewConversation = () => {
    if (currentPage() !== "home") openPage("home", false);
    document.body.classList.remove("menu-open");
    document.getElementById("menu-toggle").setAttribute("aria-expanded", "false");
    hideRestartPoint();
    openConversation = "local-preview-" + Date.now();
    openConversationProject = null;
    renderConversation({ id: openConversation, title: message("homeNewConversationTitle"), projectName: null, model: null, agent: null, kind: "NOTES", moments: [], total: 0 }, false);
    homeConversationModel.value = modelTargetDefault.value;
    updateHomeSend();
    if (!homeConversationModel.value) say(homeComposerStatus, "homeTargetRequired");
    markOpenRow(); homeMessage.focus();
  };
  document.getElementById("home-new-conversation").addEventListener("click", startNewConversation);
  homeMessage.addEventListener("input", updateHomeSend);
  homeMessage.addEventListener("keydown", (event) => { if (event.key === "Enter" && event.ctrlKey) { event.preventDefault(); document.getElementById("home-composer").requestSubmit(); } });
  document.getElementById("home-composer").addEventListener("submit", async (event) => {
    event.preventDefault();
    const userText = homeMessage.value;
    if (!userText.trim()) { say(homeComposerError, "homeTurnEmpty"); homeMessage.focus(); return; }
    if (!homeConversationModel.value) { say(homeComposerError, "homeTargetRequired"); homeConversationModel.focus(); return; }
    text(homeComposerError, ""); homeSend.disabled = true;
    say(homeComposerStatus, "homeTurnPreparing");
    const targetId = homeConversationModel.value;
    try {
      if (openConversation && openConversation.startsWith("local-preview-")) {
        const title = userText.replace(/\\s+/gu, " ").trim().slice(0, 100);
        const created = await api("/api/general/conversations", { method: "POST", body: JSON.stringify({ title }) });
        openConversation = created.id; openConversationProject = null;
        await selectConversationTarget(openConversation, null, targetId);
      }
      if (!openConversation) throw new Error(message("homeConversationFailed"));
      say(homeComposerStatus, "homeTurnIncoming");
      const project = openConversationProject ? "?project=" + encodeURIComponent(openConversationProject) : "";
      const outcome = await api("/api/conversations/" + encodeURIComponent(openConversation) + "/turn" + project, {
        method: "POST",
        body: JSON.stringify({ targetId, userText, clientRequestId: crypto.randomUUID() }),
      });
      if (outcome.result.kind === "COMPLETED") {
        lastProtectionReplacements = outcome.result.protection?.replacements || 0;
        homeMessage.value = "";
        await showConversation({ id: openConversation, projectId: openConversationProject }, false, true);
        await loadConversations();
        say(homeComposerStatus, outcome.duplicate ? "homeTurnDuplicate" : "homeTurnSaved", { model: outcome.result.effectiveModel });
      } else if (outcome.result.kind === "REFUSED_BEFORE_EXPOSURE") {
        say(homeComposerError, "homeTurnRefused");
      } else if (outcome.result.kind === "UNKNOWN_AFTER_EXPOSURE") {
        homeMessage.value = "";
        say(homeComposerError, "homeTurnUnknown");
      } else {
        homeMessage.value = "";
        say(homeComposerError, "homeTurnWithheld");
      }
    } catch (cause) {
      detail(homeComposerError, cause);
    } finally {
      updateHomeSend(); homeMessage.focus();
    }
  });
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

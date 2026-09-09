export const CONTINUATION_BEHAVIOUR = `
  const continuationElement = (name) => document.getElementById("continuation-" + name);
  let continuationFor = null, continuationGeneration = 0, continuationProposal = null;
  const continuationQuestions = new Map();
  let continuationSelected = [], continuationManual = [];
let continuationAuthorization = null;
  const continuationPath = (action = "") => "/api/conversations/" + encodeURIComponent(continuationFor.id) + "/continuation" + action + "?project=" + encodeURIComponent(continuationFor.projectId);
  const continuationClearReview = () => {
    continuationProposal = null;
  continuationAuthorization = null;
  continuationElement("delivery").hidden = true;
  continuationElement("response").hidden = true; continuationSelected = []; continuationManual = [];
    continuationElement("review").hidden = true; continuationElement("final").hidden = true;
    continuationElement("items").replaceChildren(); continuationElement("suggestions").replaceChildren();
    continuationElement("text").value = ""; continuationElement("passphrase").value = "";
  };
  const setContinuationConversation = (row) => {
    if (continuationFor) {
      if (continuationQuestions.size >= 20) continuationQuestions.delete(continuationQuestions.keys().next().value);
      continuationQuestions.set(continuationFor.projectId + ":" + continuationFor.id, continuationElement("question").value);
    }
    continuationGeneration++; continuationClearReview();
    continuationFor = row && row.projectId ? { id: row.id, projectId: row.projectId } : null;
    continuationElement("open").hidden = !continuationFor;
    continuationElement("panel").hidden = true;
    continuationElement("question").value = continuationFor ? continuationQuestions.get(continuationFor.projectId + ":" + continuationFor.id) || "" : "";
    for (const name of ["label", "model", "profile", "policy", "instructions", "task", "names"]) continuationElement(name).value = "";
    continuationElement("changed").hidden = true; continuationElement("omitted").hidden = true;
    text(continuationElement("error"), "");
  };
  const continuationAnswer = (answer) => {
    if (!answer.ready) {
      const reason = answer.reason;
      say(continuationElement("status"), reason === "TARGET_NOT_CONFIGURED" ? "continueSetupHelp" : reason === "NO_LINKED_WORK" || reason === "NO_HANDOFF" ? "continueMissing" : reason === "PRIVACY_BLOCKED" ? "continueBlocked" : reason === "PREPARATION_EXPIRED" || reason === "PREPARATION_CHANGED" ? "continueExpired" : "continueFailed");
      if (reason === "TARGET_NOT_CONFIGURED") continuationElement("setup").open = true;
      return false;
    }
    say(continuationElement("status"), "continueReady", { label: answer.label, model: answer.model, date: dateTime(answer.keptAt) });
    continuationElement("changed").hidden = !answer.changed;
    continuationElement("omitted").hidden = !answer.omitted;
    return true;
  };
  const continuationRequest = async (action, body) => {
    const generation = continuationGeneration;
    text(continuationElement("error"), ""); say(continuationElement("status"), "continueLoading");
    try {
      const answer = await api(continuationPath(action), body === undefined ? {} : { method: "POST", body: JSON.stringify(body) });
      return generation === continuationGeneration && continuationAnswer(answer) ? answer : null;
    } catch { if (generation === continuationGeneration) say(continuationElement("error"), "continueFailed"); return null; }
  };
  continuationElement("open").addEventListener("click", async () => {
    if (!continuationFor) return;
    continuationElement("panel").hidden = false; continuationElement("heading").focus();
    await continuationRequest("");
  });
  continuationElement("back").addEventListener("click", () => {
    continuationElement("panel").hidden = true;
    const heading = document.getElementById("restart-point-heading"); heading.setAttribute("tabindex", "-1"); heading.focus();
  });
  continuationElement("configure").addEventListener("submit", async (event) => {
    event.preventDefault(); continuationGeneration++; continuationClearReview();
    const value = (name) => continuationElement(name).value.trim();
    const answer = await continuationRequest("/configure", { label: value("label"), model: value("model"), profile: { path: value("profile") }, policy: { path: value("policy") }, bundles: value("instructions").split(/\\r?\\n/u).map((path) => path.trim()).filter(Boolean).map((path) => ({ path })), ...(value("task") ? { task: value("task") } : {}) });
    if (answer) { continuationElement("setup").open = false; continuationElement("question").focus(); }
  });
  for (const name of ["question", "names"]) continuationElement(name).addEventListener("input", () => { continuationGeneration++; continuationClearReview(); });
  continuationElement("propose").addEventListener("submit", async (event) => {
    event.preventDefault(); continuationGeneration++; continuationClearReview();
    const answer = await continuationRequest("/propose", { question: continuationElement("question").value, aliases: continuationElement("names").value.split(/\\r?\\n/u).map((alias) => alias.trim()).filter(Boolean).map((alias) => ({ entityType: "CUSTOMER", alias })) });
    if (!answer) return;
    continuationProposal = answer.proposal;
    answer.items.forEach((item, index) => {
      const area = document.createElement("textarea"); area.readOnly = true; area.rows = 5; area.value = item.text; area.setAttribute("aria-label", message("continueReview") + " " + (index + 1));
      const button = document.createElement("button"); button.type = "button"; say(button, "continueProtectSelection");
      button.addEventListener("click", () => {
        if (area.selectionEnd <= area.selectionStart) return;
        const span = { item: index, start: area.selectionStart, end: area.selectionEnd };
        if (continuationManual.some((other) => other.item === span.item && other.start < span.end && span.start < other.end)) return;
        continuationManual.push(span);
        const label = document.createElement("label"), check = document.createElement("input"); check.type = "checkbox"; check.checked = true;
        check.addEventListener("change", () => { continuationManual = continuationManual.filter((other) => other !== span); if (check.checked) continuationManual.push(span); });
        label.append(check, document.createTextNode(area.value.slice(span.start, span.end))); continuationElement("suggestions").append(label);
      });
      continuationElement("items").append(area, button);
    });
    for (const suggestion of answer.suggestions) {
      const label = document.createElement("label"), check = document.createElement("input"); check.type = "checkbox"; check.checked = true; continuationSelected.push(suggestion.index);
      check.addEventListener("change", () => { continuationSelected = continuationSelected.filter((value) => value !== suggestion.index); if (check.checked) continuationSelected.push(suggestion.index); });
      label.append(check, document.createTextNode(suggestion.text)); continuationElement("suggestions").append(label);
    }
    continuationElement("review").hidden = false; continuationElement("review-heading").focus();
  });
  continuationElement("protect").addEventListener("click", async () => {
    if (!continuationProposal) return;
    const proposal = continuationProposal; continuationProposal = null;
    const passphrase = continuationElement("passphrase").value; continuationElement("passphrase").value = "";
    continuationElement("protect").disabled = true;
    try {
      const answer = await continuationRequest("/protect", { proposal, selected: continuationSelected, manual: continuationManual, passphrase });
      if (answer) { continuationAuthorization = answer.authorizationId; continuationElement("delivery").hidden = !continuationAuthorization; continuationElement("send").disabled = false; continuationElement("final").hidden = false; continuationElement("text").value = answer.text; continuationElement("text").focus(); }
    } finally { continuationElement("protect").disabled = false; }
  });
continuationElement("send").addEventListener("click", async () => {
  if (!continuationAuthorization) return;
  const authorizationId = continuationAuthorization;
  continuationAuthorization = null;
  continuationElement("send").disabled = true;
  const generation = continuationGeneration;
  const passphrase = continuationElement("passphrase").value;
  continuationElement("passphrase").value = "";
  say(continuationElement("status"), "continueSending");
  try {
    const answer = await api(continuationPath("/send"), { method: "POST", body: JSON.stringify({ authorizationId, passphrase }) });
    if (generation !== continuationGeneration) return;
    if (!answer.ready) { say(continuationElement("status"), "continueDeliveryProblem", { reason: answer.reason }); return; }
    continuationElement("response").hidden = false;
    continuationElement("response-text").value = answer.text;
    say(continuationElement("status"), "continueSaved");
    continuationElement("question").value = "";
    continuationElement("question").focus();
  } catch { if (generation === continuationGeneration) say(continuationElement("status"), "continueDeliveryProblem", { reason: "UNKNOWN" }); }
});
`;

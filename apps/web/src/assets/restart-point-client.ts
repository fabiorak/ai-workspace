/**
 * Behaviour of the restart point, inserted into the single served script.
 *
 * It is a source fragment rather than a module because `/app.js` is one IIFE under
 * `script-src 'self'` with no bundler: keeping this zone in its own file is the
 * decomposition ADR-0035 asks for, and splicing it in is what preserves the
 * single-script contract. It uses the helpers the IIFE already defines — `api`,
 * `say`, `text`, `detail`, `message`, `number`, `dateTime`, `momentSpeaker` — and
 * assigns no `innerHTML`.
 *
 * ADR-0037 makes composition continuous: the point is composed when a conversation
 * is opened, and again when continuous import brings new moments in, so what is on
 * screen is never stale. Composing writes nothing, which is why it may happen
 * without anybody asking. Focus is never moved here: this arrives on its own, and a
 * summary that steals the caret from the conversation a person is reading would be
 * an interruption rather than an answer.
 */
export const RESTART_POINT_BEHAVIOUR = `
  const restartPoint = document.getElementById("restart-point");
  const restartPointStatus = document.getElementById("restart-point-status");
  const restartPointBody = document.getElementById("restart-point-body");
  const restartPointOmissions = document.getElementById("restart-point-omissions");
  const restartPointError = document.getElementById("restart-point-error");
  const restartPointDraft = document.getElementById("restart-point-draft");
  const restartPointNext = document.getElementById("restart-point-next");
  const restartPointDraftSource = document.getElementById("restart-point-draft-source");
  // Whether the person has edited the draft. Composition repeats on its own when new
  // moments arrive, and refilling the field then would delete a revision nobody asked
  // to lose: the prefill applies to a field still holding exactly what was proposed.
  let restartPointNextEdited = false;
  restartPointNext.addEventListener("input", () => { restartPointNextEdited = true; });
  const restartPointTestCommand = document.getElementById("restart-point-test-command");
  const restartPointTestOutcome = document.getElementById("restart-point-test-outcome");
  const restartPointTestAt = document.getElementById("restart-point-test-at");
  const restartPointTestsOptional = document.getElementById("restart-point-tests-optional");
  // The command is the person's own text handed back, so it may be offered filled; it
  // stops being offered the moment they change it. The outcome is never offered: it is
  // the part that asserts something, and it is chosen every time or left unstated.
  let restartPointTestCommandEdited = false;
  restartPointTestCommand.addEventListener("input", () => { restartPointTestCommandEdited = true; });
  // Which conversation the point on screen belongs to, so an import can recompose the
  // right one and a closed conversation recomposes nothing at all.
  let restartPointFor = null;
  const hideRestartPoint = () => {
    restartPointFor = null;
    restartPoint.hidden = true;
    restartPointBody.replaceChildren();
    restartPointOmissions.replaceChildren();
    // A draft belongs to one conversation. Leaving it behind would offer the next
    // reader a proposal about work they did not open.
    restartPointDraft.hidden = true;
    restartPointNext.value = "";
    restartPointNextEdited = false;
    restartPointTestCommand.value = "";
    restartPointTestCommandEdited = false;
    restartPointTestOutcome.value = "";
    restartPointTestAt.value = "";
    say(restartPointTestsOptional, "pointTestsOptional");
    text(restartPointDraftSource, "");
    text(restartPointStatus, "");
    text(restartPointError, "");
  };
  const restartPointLabel = (key) => { const label = document.createElement("p"); label.className = "card-kicker"; say(label, key); return label; };
  const restartPointSentence = (key, parameters) => { const line = document.createElement("p"); say(line, key, parameters || null); return line; };
  // A note keeps the word for whether the person confirmed it: a reader deciding how
  // much to lean on a line needs that much, and it is a word rather than a stored state.
  const restartPointNotes = (notes, emptyKey) => {
    if (notes.length === 0) return restartPointSentence(emptyKey);
    const list = document.createElement("ul");
    for (const note of notes) {
      const item = document.createElement("li");
      const content = document.createElement("span");
      text(content, note.content);
      const confirmed = document.createElement("span");
      confirmed.className = "help";
      say(confirmed, note.verification === "VERIFIED" ? "pointNoteVerified" : "pointNoteUnverified");
      item.append(content, document.createTextNode(" · "), confirmed);
      list.append(item);
    }
    return list;
  };
  // Who spoke and when says the reader was here; the line of text says what they
  // were in the middle of. Without it five moments are five timestamps, which is
  // not where anybody was.
  const restartPointMoments = (moments) => {
    const list = document.createElement("ul");
    for (const moment of moments) {
      const item = document.createElement("li");
      const said = document.createElement("span");
      if (moment.text) text(said, moment.text); else say(said, "pointMomentNoText");
      const who = document.createElement("span");
      who.className = "help";
      text(who, moment.occurredAt ? momentSpeaker(moment.type) + " · " + dateTime(moment.occurredAt) : momentSpeaker(moment.type));
      item.append(said, document.createTextNode(" · "), who);
      // An unrecognised envelope means the line above is the raw stored text, and a
      // reader weighing a quotation is told which of the two they are reading.
      if (moment.text && !moment.fromCanonicalPayload) {
        const raw = document.createElement("span");
        raw.className = "help";
        say(raw, "pointMomentRaw");
        item.append(document.createTextNode(" · "), raw);
      }
      list.append(item);
    }
    return list;
  };
  // A recorded run is said as the command, the outcome as a word, and when it was
  // seen. Nothing is observed here, so no record at all is said in a sentence: a
  // reader who found this part silent would be free to read the silence as green.
  const restartPointTests = (tests) => {
    if (tests.length === 0) return restartPointSentence("pointNoTests");
    const list = document.createElement("ul");
    for (const test of tests) {
      const item = document.createElement("li");
      const command = document.createElement("span");
      text(command, test.command);
      const outcome = document.createElement("span");
      say(outcome, test.outcome === "PASS" ? "pointTestPassed" : test.outcome === "FAIL" ? "pointTestFailed" : "pointTestNotRun");
      const when = document.createElement("span");
      when.className = "help";
      if (test.observedAt) say(when, "pointTestObservedAt", { when: dateTime(test.observedAt) }); else say(when, "pointTestNotObserved");
      item.append(command, document.createTextNode(" · "), outcome, document.createTextNode(" · "), when);
      list.append(item);
    }
    return list;
  };
  const renderRestartPoint = (point) => {
    restartPointBody.replaceChildren();
    restartPointOmissions.replaceChildren();
    // Nothing to compose is said as what is missing, never as an empty summary: a
    // work item is not chosen on the reader's behalf here.
    if (!point.available) {
      restartPointDraft.hidden = true;
      say(restartPointStatus, point.reason === "NOT_A_WORK_CONVERSATION" ? "pointNotWork" : point.reason === "NO_LINKED_WORK" ? "pointNoWork" : "pointNothingImported");
      return;
    }
    const doing = document.createElement("p");
    text(doing, point.doing + (catalogs.en["homeState" + point.workState] ? " · " + message("homeState" + point.workState) : ""));
    restartPointBody.append(restartPointLabel("pointDoing"), doing);
    restartPointBody.append(restartPointLabel("pointDecisions"), restartPointNotes(point.decisions, "pointNoDecisions"));
    restartPointBody.append(restartPointLabel("pointConstraints"), restartPointNotes(point.constraints, "pointNoConstraints"));
    restartPointBody.append(restartPointLabel("pointFailures"), restartPointNotes(point.failures, "pointNoFailures"));
    restartPointBody.append(restartPointLabel("pointLookedAt"), restartPointMoments(point.lookedAt));
    restartPointBody.append(restartPointLabel("pointTests"), restartPointTests(point.tests));
    // The answer to "do the tests pass" is often in the conversation and nowhere else,
    // and only the last five moments are shown. It is quoted with its provenance said
    // out loud, never as an outcome: no word of result stands beside it.
    if (point.saidAboutTests) {
      const said = document.createElement("p");
      const line = document.createElement("span");
      if (point.saidAboutTests.text) text(line, point.saidAboutTests.text); else say(line, "pointMomentNoText");
      const source = document.createElement("span");
      source.className = "help";
      text(source, message("pointTestsSaid") + (point.saidAboutTests.occurredAt ? " · " + dateTime(point.saidAboutTests.occurredAt) : ""));
      said.append(line, document.createTextNode(" · "), source);
      if (point.saidAboutTests.text && !point.saidAboutTests.fromCanonicalPayload) {
        const raw = document.createElement("span");
        raw.className = "help";
        say(raw, "pointMomentRaw");
        said.append(document.createTextNode(" · "), raw);
      }
      restartPointBody.append(said);
    }
    restartPointBody.append(restartPointLabel("pointRepository"));
    restartPointBody.append(point.repository.branch ? restartPointSentence("pointOnBranch", { branch: point.repository.branch }) : restartPointSentence("pointNoBranch"));
    restartPointBody.append(point.repository.hasUnsavedChanges ? (point.repository.changedFiles === 1 ? restartPointSentence("pointRepositoryOneChanged") : restartPointSentence("pointRepositoryChanged", { count: number(point.repository.changedFiles) })) : restartPointSentence("pointRepositoryClean"));
    // The count says how much is unsaved; the names say where the work was left.
    if (point.repository.changedPaths.length > 0) {
      const paths = document.createElement("ul");
      for (const path of point.repository.changedPaths) {
        const entry = document.createElement("li");
        text(entry, path);
        paths.append(entry);
      }
      restartPointBody.append(paths);
    }
    // What did not fit is stated. A summary that looks whole while it is not is worse
    // than one that says how much it left out.
    for (const omission of point.omissions)
      restartPointOmissions.append(restartPointSentence(omission.kind === "NOTES" ? "pointOmittedNotes" : omission.kind === "MOMENTS" ? "pointOmittedMoments" : omission.kind === "TESTS" ? "pointOmittedTests" : "pointOmittedChangedFiles", { count: number(omission.count) }));
    // The draft is the person's own words put back in front of them, so it is offered
    // in a field and never as a statement. It says what it was assembled from, and it
    // is not refilled over a revision.
    restartPointDraft.hidden = false;
    if (!restartPointNextEdited) restartPointNext.value = point.nextAction.text;
    const from = point.nextAction.assembledFrom.map((source) => message(source === "WORK_ITEM_OBJECTIVE" ? "pointDraftFromObjective" : "pointDraftFromQuestion"));
    say(restartPointDraftSource, "pointDraftMadeOf", { sources: from.join(" · ") });
    // A command recorded last time comes back as a starting point, and the sentence
    // beside the fields says both that it was repeated and that the outcome was not.
    if (!restartPointTestCommandEdited && point.fixed && point.fixed.testCommand) {
      restartPointTestCommand.value = point.fixed.testCommand;
      say(restartPointTestsOptional, "pointTestCommandRepeated");
    } else if (!restartPointTestCommandEdited) say(restartPointTestsOptional, "pointTestsOptional");
    say(restartPointStatus, "pointComposed", { when: dateTime(point.composedAt) });
  };
  const composeRestartPoint = async (conversation) => {
    restartPointFor = { id: conversation.id, projectId: conversation.projectId || null };
    const asked = restartPointFor.id;
    restartPoint.hidden = false;
    text(restartPointError, "");
    say(restartPointStatus, "pointComposing");
    const query = restartPointFor.projectId ? "?project=" + encodeURIComponent(restartPointFor.projectId) : "";
    try {
      const point = await api("/api/conversations/" + encodeURIComponent(asked) + "/restart-point" + query);
      // A reader who opened another conversation while this was composing is looking at
      // that one now. A late answer is dropped rather than drawn over what they asked for.
      if (!restartPointFor || restartPointFor.id !== asked) return;
      renderRestartPoint(point);
    } catch (cause) {
      if (!restartPointFor || restartPointFor.id !== asked) return;
      restartPointBody.replaceChildren();
      restartPointOmissions.replaceChildren();
      say(restartPointStatus, "pointFailed");
      detail(restartPointError, cause);
    }
  };
  const showRestartPoint = (conversation) => { void composeRestartPoint(conversation); };
  // Recomposed rather than patched: the moments that arrived may have changed what was
  // decided, where the reader was, and how the repository stands, and a point assembled
  // from two different reads would be a point that never existed.
  const refreshRestartPoint = () => { if (restartPointFor) void composeRestartPoint(restartPointFor); };`;

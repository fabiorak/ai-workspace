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
  const restartPointHeading = document.getElementById("restart-point-heading");
  const restartPointStart = document.getElementById("restart-point-start");
  const restartPointObjective = document.getElementById("restart-point-objective");
  const restartPointStartButton = document.getElementById("restart-point-start-button");
  const restartPointStartStatus = document.getElementById("restart-point-start-status");
  const restartPointKeptToggle = document.getElementById("restart-point-kept-toggle");
  // The date of the summary the control offers, kept so that closing can put it back
  // in the label. A control that says only "read the kept summary" would hide the one
  // thing that distinguishes the photograph from what is already on screen.
  let restartPointKeptToggleDate = "";
  const restartPointKept = document.getElementById("restart-point-kept");
  const restartPointKeptHeading = document.getElementById("restart-point-kept-heading");
  const restartPointKeptStatus = document.getElementById("restart-point-kept-status");
  const restartPointKeptBody = document.getElementById("restart-point-kept-body");
  const restartPointKeptOmissions = document.getElementById("restart-point-kept-omissions");
  const restartPointFollows = document.getElementById("restart-point-follows");
  const restartPointFixButton = document.getElementById("restart-point-fix");
  const restartPointFixStatus = document.getElementById("restart-point-fix-status");
  // The mark of the composition on screen. It travels back untouched so the server can
  // refuse a confirmation that no longer describes what was read; it is never shown.
  let restartPointComposition = null;
  // Which conversation the point on screen belongs to, so an import can recompose the
  // right one and a closed conversation recomposes nothing at all.
  let restartPointFor = null;
  // Closing empties it rather than only hiding it: a photograph left in the document
  // is a summary of another day one keystroke away from being read as this one.
  const closeRestartPointKept = () => {
    restartPointKept.hidden = true;
    restartPointKeptToggle.setAttribute("aria-expanded", "false");
    restartPointKeptBody.replaceChildren();
    restartPointKeptOmissions.replaceChildren();
    text(restartPointKeptStatus, "");
    text(restartPointKeptHeading, "");
  };
  const hideRestartPoint = () => {
    restartPointFor = null;
    restartPoint.hidden = true;
    restartPointBody.replaceChildren();
    restartPointOmissions.replaceChildren();
    // An objective belongs to the conversation it describes, so it does not survive
    // the conversation closing, and the heading goes back to what it says by default.
    restartPointStart.hidden = true;
    restartPointObjective.value = "";
    restartPointStartButton.disabled = false;
    text(restartPointStartStatus, "");
    say(restartPointHeading, "pointHeading");
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
    restartPointComposition = null;
    // The photograph belongs to one work, and it closes with the conversation that
    // opened it: leaving it behind would show the next reader a dated summary of
    // work they did not open.
    closeRestartPointKept();
    restartPointKeptToggle.hidden = true;
    text(restartPointFollows, "");
    text(restartPointFixStatus, "");
    restartPointFixButton.disabled = false;
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
      // A kept summary cites moments by identity, so one of them may be gone by the
      // time it is reread. The line stays and says so: the citation is part of a
      // permanent record, and neither silence nor a substitute would be honest.
      if (moment.readable === false) {
        say(said, "keptMomentUnreadable");
        const gone = document.createElement("span");
        gone.className = "help";
        text(gone, momentSpeaker(moment.type));
        item.append(said, document.createTextNode(" · "), gone);
        list.append(item);
        continue;
      }
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
      // A line read out of the moment's own stored file says so, and a file that could
      // not be read says that instead: an empty line and a failed read are not the same.
      if (moment.fromArtifact) {
        const file = document.createElement("span");
        file.className = "help";
        say(file, moment.text ? "pointMomentFromFile" : "pointMomentFileUnreadable");
        item.append(document.createTextNode(" · "), file);
      }
      list.append(item);
    }
    return list;
  };
  // A recorded run is said as the command, the outcome as a word, and when it was
  // seen. Nothing is observed here, so no record at all is said in a sentence: a
  // reader who found this part silent would be free to read the silence as green.
  // \`elsewhere\` is true when a kept summary does record a run. The absence is still
  // stated, but not with the sentence that ends "nothing says whether this works":
  // the line right below it does say something, and a sentence that contradicts the
  // line under it teaches a reader to skip both.
  const restartPointTests = (tests, elsewhere) => {
    if (tests.length === 0) return restartPointSentence(elsewhere ? "pointNoTestsYet" : "pointNoTests");
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
      // Saying what is missing and stopping there is a diagnosis with no remedy. The
      // gesture is offered only where it would work: notes carry no work, and a
      // conversation with no moments has nothing for a record to cite.
      const canStart = point.reason === "NO_LINKED_WORK";
      restartPointStart.hidden = !canStart;
      say(restartPointHeading, canStart ? "startHeading" : "pointHeading");
      restartPointKeptToggle.hidden = true;
      return;
    }
    restartPointStart.hidden = true;
    say(restartPointHeading, "pointHeading");
    const doing = document.createElement("p");
    text(doing, point.doing + (catalogs.en["homeState" + point.workState] ? " · " + message("homeState" + point.workState) : ""));
    restartPointBody.append(restartPointLabel("pointDoing"), doing);
    restartPointBody.append(restartPointLabel("pointDecisions"), restartPointNotes(point.decisions, "pointNoDecisions"));
    restartPointBody.append(restartPointLabel("pointConstraints"), restartPointNotes(point.constraints, "pointNoConstraints"));
    restartPointBody.append(restartPointLabel("pointFailures"), restartPointNotes(point.failures, "pointNoFailures"));
    restartPointBody.append(restartPointLabel("pointLookedAt"), restartPointSentence("pointImportedWarning"), restartPointMoments(point.lookedAt));
    // What was stated the last time a summary was kept. It is quoted with its own two
    // dates — when the run was seen, and when it was kept — so it reads as a fact of
    // that day. It is never what fills the outcome field below.
    const keptRun = point.fixed && point.fixed.lastRecordedTest ? point.fixed.lastRecordedTest : null;
    restartPointBody.append(restartPointLabel("pointTests"), restartPointTests(point.tests, keptRun !== null));
    if (keptRun) {
      const stated = document.createElement("p");
      const command = document.createElement("span");
      text(command, keptRun.command);
      const outcome = document.createElement("span");
      say(outcome, keptRun.outcome === "PASS" ? "pointTestPassed" : keptRun.outcome === "FAIL" ? "pointTestFailed" : "pointTestNotRun");
      const when = document.createElement("span");
      when.className = "help";
      if (keptRun.observedAt) say(when, "pointTestObservedAt", { when: dateTime(keptRun.observedAt) }); else say(when, "pointTestNotObserved");
      const source = document.createElement("span");
      source.className = "help";
      say(source, "pointTestsKept", { when: dateTime(point.fixed.at) });
      stated.append(command, document.createTextNode(" · "), outcome, document.createTextNode(" · "), when, document.createTextNode(" · "), source);
      restartPointBody.append(stated);
    }
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
      restartPointOmissions.append(restartPointSentence(omission.kind === "NOTES" ? "pointOmittedNotes" : omission.kind === "MOMENTS" ? "pointOmittedMoments" : omission.kind === "OPERATIONS" ? "pointOmittedOperations" : omission.kind === "TESTS" ? "pointOmittedTests" : "pointOmittedChangedFiles", { count: number(omission.count) }));
    // The draft is the person's own words put back in front of them, so it is offered
    // in a field and never as a statement. It says what it was assembled from, and it
    // is not refilled over a revision.
    restartPointDraft.hidden = false;
    if (!restartPointNextEdited) restartPointNext.value = point.nextAction.text;
    const from = point.nextAction.assembledFrom.map((source) => message(source === "WORK_ITEM_OBJECTIVE" ? "pointDraftFromObjective" : "pointDraftFromQuestion"));
    say(restartPointDraftSource, "pointDraftMadeOf", { sources: from.join(" · ") });
    // A command recorded last time comes back as a starting point, and the sentence
    // beside the fields says both that it was repeated and that the outcome was not.
    // Only the command is taken from it. The outcome is quoted above beside its date
    // and never reaches this field: what is already in a field gets confirmed without
    // being chosen, and an outcome nobody chose today is the one claim to avoid.
    if (!restartPointTestCommandEdited && keptRun && keptRun.command) {
      restartPointTestCommand.value = keptRun.command;
      say(restartPointTestsOptional, "pointTestCommandRepeated");
    } else if (!restartPointTestCommandEdited) say(restartPointTestsOptional, "pointTestsOptional");
    // Which summary this one would follow, by date and never by identifier, said before
    // the gesture: a permanent link is not something to discover afterwards.
    restartPointComposition = point.composition;
    if (point.fixed) say(restartPointFollows, "pointFollows", { when: dateTime(point.fixed.at) });
    else say(restartPointFollows, "pointFollowsNothing");
    // The photograph is offered only where there is one, and always by date. A summary
    // already open is read again rather than left as it was: a confirmation just made
    // it the previous one, and the reader would be looking at a photograph of a
    // summary that is no longer the most recent.
    if (point.fixed) {
      restartPointKeptToggleDate = dateTime(point.fixed.at);
      restartPointKeptToggle.hidden = false;
      if (restartPointKept.hidden) say(restartPointKeptToggle, "keptOpen", { when: restartPointKeptToggleDate });
      else { say(restartPointKeptToggle, "keptClose"); void loadRestartPointKept(); }
    } else {
      closeRestartPointKept();
      restartPointKeptToggle.hidden = true;
    }
    say(restartPointStatus, "pointComposed", { when: dateTime(point.composedAt) });
  };
  // The kept summary, rendered as the day it was kept. It reuses the lists of the
  // composed one — a note, a moment, a run read the same way in both — and drops what
  // a stored packet has no honest value for: no state of the work, no mark to confirm
  // with, and a next action that is confirmed text rather than a draft.
  const renderRestartPointKept = (photograph) => {
    restartPointKeptBody.replaceChildren();
    restartPointKeptOmissions.replaceChildren();
    if (!photograph.kept) {
      say(restartPointKeptStatus, photograph.reason === "NOTHING_KEPT_YET" ? "keptNothing" : photograph.reason === "NO_LINKED_WORK" ? "pointNoWork" : "pointNotWork");
      return;
    }
    text(restartPointKeptStatus, "");
    say(restartPointKeptHeading, "keptHeading", { when: dateTime(photograph.keptAt) });
    const doing = document.createElement("p");
    text(doing, photograph.doing);
    restartPointKeptBody.append(restartPointLabel("pointDoing"), doing);
    restartPointKeptBody.append(restartPointLabel("pointDecisions"), restartPointNotes(photograph.decisions, "pointNoDecisions"));
    restartPointKeptBody.append(restartPointLabel("pointConstraints"), restartPointNotes(photograph.constraints, "pointNoConstraints"));
    restartPointKeptBody.append(restartPointLabel("pointFailures"), restartPointNotes(photograph.failures, "pointNoFailures"));
    restartPointKeptBody.append(restartPointLabel("pointLookedAt"), restartPointSentence("pointImportedWarning"), restartPointMoments(photograph.lookedAt));
    restartPointKeptBody.append(restartPointLabel("pointTests"), restartPointTests(photograph.tests, false));
    restartPointKeptBody.append(restartPointLabel("pointRepository"));
    restartPointKeptBody.append(photograph.repository.branch ? restartPointSentence("pointOnBranch", { branch: photograph.repository.branch }) : restartPointSentence("pointNoBranch"));
    restartPointKeptBody.append(photograph.repository.hasUnsavedChanges ? (photograph.repository.changedFiles === 1 ? restartPointSentence("pointRepositoryOneChanged") : restartPointSentence("pointRepositoryChanged", { count: number(photograph.repository.changedFiles) })) : restartPointSentence("pointRepositoryClean"));
    if (photograph.repository.changedPaths.length > 0) {
      const paths = document.createElement("ul");
      for (const path of photograph.repository.changedPaths) {
        const entry = document.createElement("li");
        text(entry, path);
        paths.append(entry);
      }
      restartPointKeptBody.append(paths);
    }
    const confirmed = document.createElement("p");
    text(confirmed, photograph.nextAction);
    restartPointKeptBody.append(restartPointLabel("keptNextAction"), confirmed);
    if (photograph.followsOne) restartPointKeptOmissions.append(restartPointSentence("keptFollowsOne"));
    for (const omission of photograph.omissions)
      restartPointKeptOmissions.append(restartPointSentence(omission.kind === "NOTES" ? "pointOmittedNotes" : omission.kind === "MOMENTS" ? "pointOmittedMoments" : omission.kind === "OPERATIONS" ? "pointOmittedOperations" : omission.kind === "TESTS" ? "pointOmittedTests" : "pointOmittedChangedFiles", { count: number(omission.count) }));
  };
  const loadRestartPointKept = async () => {
    if (!restartPointFor) return;
    const asked = restartPointFor.id;
    const query = restartPointFor.projectId ? "?project=" + encodeURIComponent(restartPointFor.projectId) : "";
    try {
      const photograph = await api("/api/conversations/" + encodeURIComponent(asked) + "/restart-point/kept" + query);
      if (!restartPointFor || restartPointFor.id !== asked) return;
      renderRestartPointKept(photograph);
    } catch (cause) {
      if (!restartPointFor || restartPointFor.id !== asked) return;
      restartPointKeptBody.replaceChildren();
      restartPointKeptOmissions.replaceChildren();
      say(restartPointKeptStatus, "keptFailed");
      detail(restartPointError, cause);
    }
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
  // The one write of this area, and it happens only here: no timer, no navigation and
  // no arriving moment ever reaches it.
  const outcomeStated = () => restartPointTestOutcome.value || null;
  const fixRestartPoint = async () => {
    if (!restartPointFor || !restartPointComposition) return;
    const asked = restartPointFor.id;
    restartPointFixButton.disabled = true;
    text(restartPointError, "");
    say(restartPointFixStatus, "pointFixing");
    const query = restartPointFor.projectId ? "?project=" + encodeURIComponent(restartPointFor.projectId) : "";
    try {
      const result = await api("/api/conversations/" + encodeURIComponent(asked) + "/restart-point" + query, {
        method: "POST",
        body: JSON.stringify({
          composition: restartPointComposition,
          nextAction: restartPointNext.value,
          test: { command: restartPointTestCommand.value, outcome: outcomeStated(), observedAt: restartPointTestAt.value || null },
        }),
      });
      if (!restartPointFor || restartPointFor.id !== asked) return;
      if (result.fixed) {
        say(restartPointFixStatus, "pointFixedAt", { when: dateTime(result.at) });
        // What was kept is now part of this work's history, so the summary is composed
        // again: it is the same read that says which one a next summary would follow.
        restartPointNextEdited = false;
        restartPointTestCommandEdited = false;
        void composeRestartPoint(restartPointFor);
        return;
      }
      restartPointFixButton.disabled = false;
      if (result.reason === "EMPTY_NEXT_ACTION") say(restartPointFixStatus, "pointFixEmpty");
      else if (result.reason === "INCOMPLETE_TEST") say(restartPointFixStatus, "pointFixHalfTest");
      else {
        // The composition moved under the reader. Nothing was written, and the summary is
        // recomposed at once so that confirming again is one gesture on what is now true.
        say(restartPointFixStatus, "pointFixMoved");
        void composeRestartPoint(restartPointFor);
      }
    } catch (cause) {
      if (!restartPointFor || restartPointFor.id !== asked) return;
      restartPointFixButton.disabled = false;
      text(restartPointFixStatus, "");
      detail(restartPointError, cause);
    }
  };
  // The write that ends the dead end. One gesture, both halves of it declared above,
  // and the summary recomposed straight after: what was missing is now there, and the
  // same screen shows it without anybody navigating anywhere.
  const startWorkHere = async () => {
    if (!restartPointFor || !restartPointFor.projectId) return;
    const asked = restartPointFor.id;
    restartPointStartButton.disabled = true;
    text(restartPointError, "");
    say(restartPointStartStatus, "startWorking");
    try {
      const result = await api("/api/conversations/" + encodeURIComponent(asked) + "/work?project=" + encodeURIComponent(restartPointFor.projectId), {
        method: "POST",
        body: JSON.stringify({ objective: restartPointObjective.value }),
      });
      if (!restartPointFor || restartPointFor.id !== asked) return;
      if (result.started) {
        // Both halves of the truth: a work that exists and is not in progress is a
        // real state, and the summary below will show it for what it is.
        say(restartPointStartStatus, result.active ? "startDone" : "startDoneNotActive");
        restartPointObjective.value = "";
        void composeRestartPoint(restartPointFor);
        return;
      }
      restartPointStartButton.disabled = false;
      if (result.reason === "EMPTY_OBJECTIVE") say(restartPointStartStatus, "startEmpty");
      else if (result.reason === "ALREADY_LINKED") say(restartPointStartStatus, "startAlready");
      else say(restartPointStartStatus, "pointNothingImported");
    } catch (cause) {
      if (!restartPointFor || restartPointFor.id !== asked) return;
      restartPointStartButton.disabled = false;
      text(restartPointStartStatus, "");
      detail(restartPointError, cause);
    }
  };
  restartPointStartButton.addEventListener("click", () => { void startWorkHere(); });
  restartPointFixButton.addEventListener("click", () => { void fixRestartPoint(); });
  // Asked for, never arriving on its own: the composed summary is the one that speaks
  // without being asked, and a second summary appearing beside it would leave a reader
  // to work out which of the two is about today.
  restartPointKeptToggle.addEventListener("click", () => {
    if (!restartPointKept.hidden) {
      closeRestartPointKept();
      say(restartPointKeptToggle, "keptOpen", { when: restartPointKeptToggleDate });
      return;
    }
    restartPointKept.hidden = false;
    restartPointKeptToggle.setAttribute("aria-expanded", "true");
    say(restartPointKeptToggle, "keptClose");
    void loadRestartPointKept();
  });
  const showRestartPoint = (conversation) => { void composeRestartPoint(conversation); };
  // Recomposed rather than patched: the moments that arrived may have changed what was
  // decided, where the reader was, and how the repository stands, and a point assembled
  // from two different reads would be a point that never existed.
  const refreshRestartPoint = () => { if (restartPointFor) void composeRestartPoint(restartPointFor); };`;

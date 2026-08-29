import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { APP_CSS, APP_JS, shellHtml } from "../src/assets.ts";
import { GUI_CATALOGS, SUPPORTED_LOCALES } from "../src/index.ts";
import { mergeCatalogues } from "../src/text/catalog.ts";
import { HOME_CATALOGUES } from "../src/text/home.ts";
import { PRIVACY_CATALOGUES } from "../src/text/privacy.ts";
import {
  RESTART_POINT_CATALOGUES,
  RESTART_POINT_TEXT,
} from "../src/text/restart-point.ts";

const html = shellHtml("csrf-token");
const catalogues = mergeCatalogues(
  GUI_CATALOGS,
  HOME_CATALOGUES,
  PRIVACY_CATALOGUES,
  RESTART_POINT_CATALOGUES,
);
const conversation = (() => {
  const start = html.indexOf('<div id="home-conversation" hidden>');
  assert.notEqual(start, -1);
  return html.slice(start, html.indexOf('<div id="home-answer">', start));
})();
const behaviour = (() => {
  const start = APP_JS.indexOf("const restartPoint = document.getElementById");
  assert.notEqual(start, -1);
  return APP_JS.slice(start);
})();

describe("the restart point at the end of a work conversation", () => {
  it("sits inside the open conversation, after its moments", () => {
    assert.match(conversation, /id="restart-point"/u);
    assert.ok(
      conversation.indexOf('id="home-conversation-count"') <
        conversation.indexOf('id="restart-point"'),
    );
  });

  /**
   * A point at the end of a conversation nobody can reach is a point that is not
   * there. The moments scroll inside their own box and the point stays outside it,
   * so a conversation of any length leaves it in view.
   */
  it("stays in view however long the conversation is", () => {
    const moments = conversation.slice(
      conversation.indexOf('id="home-conversation-moments"'),
    );
    assert.match(moments.slice(0, 220), /class="moments moments-scroll"/u);
    assert.ok(
      conversation.indexOf("</ol>") <
        conversation.indexOf('id="restart-point"'),
      "the point must not scroll away with the moments",
    );
    assert.match(APP_CSS, /\.moments-scroll \{[^}]*max-height/u);
    assert.match(APP_CSS, /\.moments-scroll \{[^}]*overflow-y: auto/u);
    assert.match(APP_JS, /homeConversationMoments\.scrollTop = 0/u);
  });

  /** An area only a pointer can scroll is an area some readers cannot read. */
  it("lets a keyboard reach and scroll the moments, and shows where it landed", () => {
    const moments = conversation.slice(
      conversation.indexOf('id="home-conversation-moments"'),
    );
    assert.match(moments.slice(0, 220), /tabindex="0"/u);
    assert.match(
      moments.slice(0, 220),
      /data-i18n-label="homeConversationMomentsLabel"/u,
    );
    assert.match(APP_CSS, /\.moments-scroll:focus-visible \{[^}]*outline/u);
    for (const locale of SUPPORTED_LOCALES)
      assert.ok(catalogues[locale].homeConversationMomentsLabel?.trim());
  });

  /**
   * ADR-0037 shows it expanded, so there is nothing to open and nothing to close.
   *
   * The photograph of a kept summary lives inside this block and does open, which is
   * how two summaries stay apart, so the measurement is on the composed part: from
   * the start of the block to the control that offers the photograph, nothing opens,
   * closes or collapses.
   */
  it("is neither collapsed nor closable", () => {
    const block = conversation.slice(
      conversation.indexOf('id="restart-point"'),
    );
    const composed = block.slice(
      0,
      block.indexOf('id="restart-point-kept-toggle"'),
    );
    assert.notEqual(composed.length, 0);
    assert.doesNotMatch(composed, /<details|<summary|aria-expanded/u);
    assert.doesNotMatch(block, /restart-point-close/u);
    /** The one thing that opens is the photograph, and nothing else. */
    assert.deepEqual([...block.matchAll(/aria-expanded/gu)].length, 1);
  });

  it("is a named region announced politely", () => {
    assert.match(
      conversation,
      /id="restart-point"[^>]*role="region"[^>]*aria-labelledby="restart-point-heading"/u,
    );
    const status = conversation.slice(
      conversation.indexOf('id="restart-point-status"'),
    );
    assert.match(status.slice(0, 120), /aria-live="polite"/u);
    assert.doesNotMatch(conversation, /aria-live="assertive"/u);
  });

  it("is composed when a conversation opens and dropped when it closes", () => {
    assert.match(APP_JS, /showRestartPoint\(conversation\)/u);
    assert.match(APP_JS, /hideRestartPoint\(\)/u);
    assert.match(behaviour, /"\/restart-point"/u);
  });

  /**
   * Continuous import is the other reason the packet changes. Recomposing rather
   * than patching is what keeps the point from being assembled out of two reads.
   */
  it("is composed again when new moments arrive", () => {
    const arrived = APP_JS.slice(APP_JS.indexOf("const loadArrived"));
    assert.match(
      arrived.slice(0, arrived.indexOf("const showConversation")),
      /refreshRestartPoint\(\)/u,
    );
    assert.match(behaviour, /const refreshRestartPoint = \(\) =>/u);
  });

  /**
   * Composing writes nothing, so it may happen without being asked for — which is
   * exactly why it must not take the caret from the conversation being read.
   */
  it("never moves focus, because nobody asked for it", () => {
    assert.doesNotMatch(behaviour, /\.focus\(\)/u);
  });

  it("reads, and never writes: no method, no body, no CSRF header", () => {
    const call = behaviour.slice(behaviour.indexOf('"/api/conversations/'));
    assert.doesNotMatch(call.slice(0, 400), /method: "POST"|body:/u);
  });

  it("drops an answer that arrived for a conversation nobody is reading", () => {
    assert.match(behaviour, /restartPointFor\.id !== asked/u);
  });

  it("says what is missing rather than showing an empty summary", () => {
    for (const key of ["pointNotWork", "pointNoWork", "pointNothingImported"])
      assert.match(behaviour, new RegExp(`"${key}"`, "u"));
  });

  it("says an empty part is empty instead of leaving it out", () => {
    for (const key of [
      "pointNoDecisions",
      "pointNoConstraints",
      "pointNoFailures",
      "pointNoTests",
    ])
      assert.match(behaviour, new RegExp(`"${key}"`, "u"));
  });

  /**
   * A reader who finds nothing about the tests is free to assume they pass, which is
   * the assumption that costs most. The part is there, it says the outcome as a word,
   * and it says the absence of a record as a sentence.
   */
  it("says how the tests stand, or that nothing says", () => {
    assert.match(behaviour, /restartPointLabel\("pointTests"\)/u);
    assert.match(
      behaviour,
      /restartPointTests\(point\.tests, keptRun !== null\)/u,
    );
    for (const key of ["pointTestPassed", "pointTestFailed", "pointTestNotRun"])
      assert.match(behaviour, new RegExp(`"${key}"`, "u"));
    assert.match(RESTART_POINT_TEXT.pointNoTests.it, /Non è registrata/u);
  });

  /**
   * A quoted outcome is what an assistant wrote, not what anybody observed, and the
   * two must not be readable as the same thing: the line carries its provenance in
   * words, and no result word stands beside it.
   */
  it("quotes what was said about the tests, and says it is a quotation", () => {
    assert.match(behaviour, /if \(point\.saidAboutTests\)/u);
    assert.match(behaviour, /text\(line, point\.saidAboutTests\.text\)/u);
    assert.match(behaviour, /message\("pointTestsSaid"\)/u);
    const quoted = behaviour.slice(
      behaviour.indexOf("if (point.saidAboutTests)"),
    );
    for (const outcome of [
      "pointTestPassed",
      "pointTestFailed",
      "pointTestNotRun",
    ])
      assert.doesNotMatch(
        quoted.slice(0, quoted.indexOf("restartPointBody.append(said)")),
        new RegExp(`"${outcome}"`, "u"),
        "a quotation must not be dressed as an outcome",
      );
    for (const locale of SUPPORTED_LOCALES)
      assert.ok(catalogues[locale].pointTestsSaid?.trim());
  });

  /**
   * The draft exists to be revised, so it is a labelled field with the review
   * obligation beside it, and it says which of the person's own words it was put
   * together from. What it must never be is a sentence presented as a decision.
   */
  it("offers the next action as a draft to review, and says what it is made of", () => {
    const draft = conversation.slice(
      conversation.indexOf('id="restart-point-draft"'),
    );
    assert.match(draft, /<label for="restart-point-next"/u);
    assert.match(draft, /<textarea id="restart-point-next"/u);
    assert.match(draft, /aria-describedby="restart-point-draft-review/u);
    assert.match(
      behaviour,
      /restartPointNext\.value = point\.nextAction\.text/u,
    );
    for (const key of [
      "pointNextAction",
      "pointDraftReview",
      "pointDraftFromObjective",
      "pointDraftFromQuestion",
      "pointDraftMadeOf",
    ])
      for (const locale of SUPPORTED_LOCALES)
        assert.ok(catalogues[locale][key]?.trim(), `${locale}.${key} is empty`);
  });

  /**
   * Composition repeats on its own when moments arrive. Refilling the field then
   * would delete a revision the person did not ask to lose.
   */
  it("never refills a draft the person has revised", () => {
    assert.match(behaviour, /restartPointNextEdited = true/u);
    assert.match(
      behaviour,
      /if \(!restartPointNextEdited\) restartPointNext\.value/u,
    );
    /** A draft belongs to one conversation and does not follow the reader elsewhere. */
    const hide = behaviour.slice(behaviour.indexOf("const hideRestartPoint"));
    assert.match(
      hide.slice(0, hide.indexOf("const restartPointLabel")),
      /restartPointNext\.value = ""/u,
    );
  });

  /**
   * The three parts of a recorded run, all optional, with the outcome defaulting to
   * nothing said. An unchosen outcome must not become "not run": that is a claim of
   * its own, and the whole point of the empty option is the difference between the
   * two.
   */
  it("asks how the tests went without ever answering for the person", () => {
    const draft = conversation.slice(
      conversation.indexOf('id="restart-point-draft"'),
    );
    assert.match(draft, /<input id="restart-point-test-command"/u);
    assert.match(draft, /<select id="restart-point-test-outcome"/u);
    assert.match(
      draft,
      /<input id="restart-point-test-at" type="datetime-local"/u,
    );
    const outcome = draft.slice(
      draft.indexOf('id="restart-point-test-outcome"'),
    );
    assert.match(
      outcome.slice(0, outcome.indexOf("</select>")),
      /<option value="" data-i18n="pointTestOutcomeNone">/u,
      "the first option must be the one that states nothing",
    );
    assert.doesNotMatch(behaviour, /restartPointTestOutcome\.value = [^"]/u);
    for (const key of [
      "pointTestCommand",
      "pointTestOutcome",
      "pointTestWhen",
      "pointTestOutcomeNone",
      "pointTestsOptional",
      "pointTestCommandRepeated",
    ])
      for (const locale of SUPPORTED_LOCALES)
        assert.ok(catalogues[locale][key]?.trim(), `${locale}.${key} is empty`);
  });

  /**
   * A command already recorded comes back into the field; a stated outcome never
   * does. The run travels whole now, because the tests section quotes it beside its
   * date, so the measurement is on the field: only the command reaches it, and the
   * outcome control is never assigned from anything the server sent.
   */
  it("offers back the command of the last fixed summary, and never its outcome", () => {
    assert.match(
      behaviour,
      /restartPointTestCommand\.value = keptRun\.command/u,
    );
    assert.match(behaviour, /"pointTestCommandRepeated"/u);
    assert.doesNotMatch(
      behaviour,
      /restartPointTestOutcome\.value = (?!"")/u,
      "an outcome must never be prefilled: a filled field gets confirmed by inertia",
    );
  });

  /**
   * The run stated when the last summary was kept, quoted beside its own date.
   * Quoting it answers the first question a reader asks; it is not the same act as
   * putting it back in the field they are about to confirm.
   */
  it("quotes the run recorded in the last kept summary, with where it came from", () => {
    assert.match(behaviour, /"pointTestsKept"/u);
    assert.match(behaviour, /keptRun\.outcome === "PASS"/u);
    assert.match(behaviour, /"pointNoTestsYet"/u);
    for (const key of ["pointTestsKept", "pointNoTestsYet"])
      for (const locale of SUPPORTED_LOCALES)
        assert.ok(catalogues[locale][key]?.trim(), `${locale}.${key} is empty`);
  });

  it("states what did not fit", () => {
    assert.match(behaviour, /"pointOmittedNotes"/u);
    assert.match(behaviour, /"pointOmittedMoments"/u);
    assert.match(behaviour, /"pointOmittedChangedFiles"/u);
    assert.match(behaviour, /"pointOmittedTests"/u);
  });

  /**
   * The two things a reader needs in order to place themselves again: what was being
   * said, and which files it was being said about.
   */
  it("quotes each moment and names the files with unsaved changes", () => {
    assert.match(behaviour, /text\(said, moment\.text\)/u);
    assert.match(behaviour, /"pointMomentNoText"/u);
    assert.match(behaviour, /"pointMomentRaw"/u);
    assert.match(
      behaviour,
      /for \(const path of point\.repository\.changedPaths\)/u,
    );
  });

  it("shows a stored state as a word, never as the constant that stores it", () => {
    assert.doesNotMatch(
      conversation.slice(conversation.indexOf('id="restart-point"')),
      /\b[A-Z][A-Z_]{3,}\b/u,
    );
    assert.match(behaviour, /message\("homeState" \+ point\.workState\)/u);
    assert.match(behaviour, /"pointNoteVerified"/u);
  });

  it("resolves every key it asks for, in both languages", () => {
    const asked = new Set(
      [...behaviour.matchAll(/"(point[A-Za-z]+)"/gu)].map(
        (match) => match[1] as string,
      ),
    );
    assert.ok(asked.size > 10);
    const missing = [...asked].flatMap((key) =>
      SUPPORTED_LOCALES.filter(
        (locale) => typeof catalogues[locale][key] !== "string",
      ).map((locale) => `${locale}.${key}`),
    );
    assert.deepEqual(missing, []);
  });

  it("keeps every sentence present, in both languages, free of placeholders", () => {
    for (const [key, entry] of Object.entries(RESTART_POINT_TEXT))
      for (const locale of SUPPORTED_LOCALES) {
        assert.ok(entry[locale]?.trim(), `${locale}.${key} is empty`);
        assert.doesNotMatch(entry[locale], /TODO|TBD/u);
      }
  });

  /**
   * A summary appearing by itself invites the question of where it went, so both
   * languages answer it before it is asked.
   */
  it("says out loud that nothing was saved and nothing was sent", () => {
    assert.match(RESTART_POINT_TEXT.pointHelp.it, /Non viene salvato/u);
    assert.match(RESTART_POINT_TEXT.pointHelp.en, /not saved/u);
  });

  it("promises nothing that answers", () => {
    for (const [key, entry] of Object.entries(RESTART_POINT_TEXT))
      for (const locale of SUPPORTED_LOCALES)
        assert.doesNotMatch(
          entry[locale],
          /\b(assistant|assistente|chat|model|modello)\b/iu,
          `${locale}.${key} must not imply something answers`,
        );
  });

  /**
   * The photograph of the last kept summary. Two summaries on one screen is the risk
   * of this zone, so what is measured here is what keeps them apart: one is asked
   * for, and it carries its date where a reader cannot miss it.
   */
  describe("the summary already kept", () => {
    it("is a labelled region of its own, opened by a control that says so", () => {
      assert.match(conversation, /id="restart-point-kept"/u);
      assert.match(conversation, /id="restart-point-kept-toggle"/u);
      const toggle = conversation.slice(
        conversation.indexOf('id="restart-point-kept-toggle"'),
      );
      assert.match(
        toggle.slice(0, toggle.indexOf(">")),
        /aria-expanded="false"/u,
      );
      assert.match(
        toggle.slice(0, toggle.indexOf(">")),
        /aria-controls="restart-point-kept"/u,
      );
      const region = conversation.slice(
        conversation.indexOf('id="restart-point-kept"'),
      );
      assert.match(
        region.slice(0, region.indexOf(">")),
        /role="region" aria-labelledby="restart-point-kept-heading"/u,
      );
    });

    it("carries its date in its own heading and in the control that opens it", () => {
      assert.match(
        behaviour,
        /"keptHeading", \{ when: dateTime\(photograph\.keptAt\) \}/u,
      );
      assert.match(
        behaviour,
        /"keptOpen", \{ when: restartPointKeptToggleDate \}/u,
      );
      assert.match(RESTART_POINT_TEXT.keptHeading.it, /\{when\}/u);
      assert.match(RESTART_POINT_TEXT.keptOpen.it, /\{when\}/u);
    });

    /** It arrives only when asked for, and never composes anything on its way. */
    it("is read from its own path, and only on request", () => {
      assert.match(behaviour, /"\/restart-point\/kept"/u);
      assert.match(
        behaviour,
        /restartPointKeptToggle\.addEventListener\("click"/u,
      );
      assert.doesNotMatch(
        behaviour,
        /refreshRestartPoint = \(\) => \{[^}]*loadRestartPointKept/u,
        "an arriving moment must not open a photograph nobody asked for",
      );
    });

    it("shows the confirmed text as confirmed, not as a draft to review", () => {
      assert.match(behaviour, /"keptNextAction"/u);
      assert.match(behaviour, /text\(confirmed, photograph\.nextAction\)/u);
      assert.doesNotMatch(
        behaviour,
        /photograph\.nextAction\.text|pointDraftReview.*photograph/u,
      );
    });

    it("says when a cited moment can no longer be read", () => {
      assert.match(behaviour, /"keptMomentUnreadable"/u);
      assert.match(behaviour, /moment\.readable === false/u);
    });

    it("says when a work has kept nothing yet", () => {
      assert.match(behaviour, /"keptNothing"/u);
      assert.match(behaviour, /"NOTHING_KEPT_YET"/u);
    });

    it("keeps its sentences in both languages", () => {
      for (const key of [
        "keptOpen",
        "keptClose",
        "keptHeading",
        "keptHelp",
        "keptNextAction",
        "keptFollowsOne",
        "keptMomentUnreadable",
        "keptNothing",
        "keptFailed",
      ])
        for (const locale of SUPPORTED_LOCALES)
          assert.ok(
            catalogues[locale][key]?.trim(),
            `${locale}.${key} is empty`,
          );
    });

    /** The photograph is of that day, so it must not state the state of now. */
    it("says out loud that it is not the state of now", () => {
      assert.match(RESTART_POINT_TEXT.keptHelp.it, /non è lo stato di adesso/u);
      assert.match(RESTART_POINT_TEXT.keptHelp.en, /not the state of now/u);
    });
  });
});

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

  /** ADR-0037 shows it expanded, so there is nothing to open and nothing to close. */
  it("is neither collapsed nor closable", () => {
    const block = conversation.slice(
      conversation.indexOf('id="restart-point"'),
    );
    assert.doesNotMatch(block, /<details|<summary|aria-expanded/u);
    assert.doesNotMatch(block, /restart-point-close/u);
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
    assert.match(behaviour, /restartPointTests\(point\.tests\)/u);
    for (const key of ["pointTestPassed", "pointTestFailed", "pointTestNotRun"])
      assert.match(behaviour, new RegExp(`"${key}"`, "u"));
    assert.match(RESTART_POINT_TEXT.pointNoTests.it, /Non è registrata/u);
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
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { APP_JS, shellHtml } from "../src/assets.ts";
import { GUI_CATALOGS, SUPPORTED_LOCALES } from "../src/index.ts";
import { mergeCatalogues } from "../src/text/catalog.ts";
import { HOME_CATALOGUES, HOME_TEXT } from "../src/text/home.ts";

const html = shellHtml("csrf-token");
const catalogues = mergeCatalogues(GUI_CATALOGS, HOME_CATALOGUES);
const homeSection = (() => {
  const start = html.indexOf('<section aria-labelledby="home-heading"');
  return html.slice(start, html.indexOf("</section>", start));
})();

describe("the opening screen", () => {
  it("is what a reader lands on, by address and by title", () => {
    assert.match(APP_JS, /replaceState\(null, "", "#\/home"\)/u);
    assert.match(APP_JS, /home: \["home"\]/u);
    assert.match(html, /<h1 id="page-title" data-i18n="navHome">/u);
  });

  it("asks one question and needs no form filled in first", () => {
    assert.match(homeSection, /<input id="home-ask" name="q" required/u);
    assert.equal((homeSection.match(/<input /gu) ?? []).length, 1);
    assert.equal((homeSection.match(/<select /gu) ?? []).length, 0);
    assert.equal((homeSection.match(/<textarea/gu) ?? []).length, 0);
  });

  it("names the field with a visible label bound to its control", () => {
    assert.match(homeSection, /<label for="home-ask"/u);
    assert.match(
      homeSection,
      /aria-describedby="home-ask-help home-ask-error"/u,
    );
  });

  it("offers the conversation list as a real list inside a landmark", () => {
    assert.match(
      html,
      /<nav class="conversation-nav"[^>]*aria-label="Your conversations"/u,
    );
    assert.match(APP_JS, /document\.createElement\("ul"\)/u);
    assert.match(APP_JS, /document\.createElement\("li"\)/u);
  });

  it("announces the list and the answer politely, never assertively", () => {
    for (const id of ["conversation-status", "home-answer-status"]) {
      const region = html.slice(html.indexOf(`id="${id}"`));
      assert.match(region.slice(0, 120), /aria-live="polite"/u);
    }
    assert.doesNotMatch(homeSection, /aria-live="assertive"/u);
  });

  it("says how many conversations there are, not merely that loading finished", () => {
    assert.match(APP_JS, /say\(conversationCount, "homeCounted"/u);
    assert.match(APP_JS, /say\(conversationCount, "homeAllShown"/u);
    assert.match(APP_JS, /say\(homeAnswerStatus, "homeAnswerComposed"/u);
  });

  it("moves focus only where the reader asked for something", () => {
    // The answer heading is focused after a submitted question, and nothing focuses
    // when the list arrives on its own.
    assert.match(APP_JS, /homeAnswerHeading\.focus\(\)/u);
    assert.doesNotMatch(
      APP_JS,
      /renderConversations[\s\S]{0,400}?\.focus\(\)/u,
    );
  });

  it("offers to carry the work onward only when the answer names a project", () => {
    // The summary is per project by construction, so an answer composed only from
    // project-free notes has no project to summarise and must not offer one.
    assert.match(html, /<div id="home-restart" hidden>/u);
    assert.match(APP_JS, /homeRestart\.hidden = homeRestartProject === null/u);
    assert.match(APP_JS, /restart-summary\?q=/u);
    assert.match(APP_JS, /say\(homeRestartStatus, "homeRestartFor"/u);
  });

  it("keeps the technical view reachable and says it is being rebuilt", () => {
    assert.match(
      html,
      /<section aria-labelledby="technical-heading" id="technical">/u,
    );
    assert.match(html, /data-i18n="homeTechnicalIntro"/u);
    for (const locale of SUPPORTED_LOCALES)
      assert.match(
        catalogues[locale].homeTechnicalIntro ?? "",
        locale === "it" ? /rifacimento/u : /rebuilt/u,
      );
  });

  it("names the model that ran a session, falling back to the agent", () => {
    assert.match(APP_JS, /const ran = row\.model \|\| row\.agent/u);
    // Shown verbatim: no translation key wraps it, because a model name is a proper name.
    assert.doesNotMatch(APP_JS, /message\("homeModel/u);
  });

  it("shows a linked work state as a word, never as the constant that stores it", () => {
    assert.doesNotMatch(homeSection, /\b[A-Z][A-Z_]{3,}\b/u);
    assert.equal(HOME_TEXT.homeStateBLOCKED.it, "bloccato");
    assert.equal(HOME_TEXT.homeStatePROPOSED.it, "da iniziare");
  });

  it("promises no assistant, in either language", () => {
    /**
     * The prohibition is about implying that something here answers. Carrying the
     * work onward names an assistant on purpose — it is the recipient elsewhere,
     * not an interlocutor in this product — so those two sentences are the only
     * place the word belongs.
     */
    const recipients = new Set(["homeRestartFor"]);
    for (const [key, entry] of Object.entries(HOME_TEXT))
      if (!recipients.has(key))
        for (const locale of SUPPORTED_LOCALES)
          assert.doesNotMatch(
            entry[locale],
            /\b(assistant|assistente|chat|model|modello|ask me|chiedimi)\b/iu,
            `${locale}.${key}: "${entry[locale]}" must not imply something answers`,
          );
    assert.match(HOME_TEXT.homeAskHelp.it, /già su questo computer/u);
    assert.match(HOME_TEXT.homeRestartFor.it, /un altro assistente/u);
  });
});

describe("the served script", () => {
  it("parses, so a broken fragment fails here instead of in a browser", () => {
    /**
     * ADR-0035 splits client behaviour per zone, and those pieces are spliced in as
     * source text. A syntax error in one of them would leave every assertion above
     * passing while the whole interface stayed dead, because nothing else in this
     * suite ever parses what is served. Constructing the function parses it without
     * running it: there is no DOM here, and none is needed to catch this.
     */

    assert.doesNotThrow(() => new Function(APP_JS));
  });

  it("assigns no markup, on any zone", () => {
    assert.doesNotMatch(APP_JS, /innerHTML|outerHTML|insertAdjacentHTML/u);
  });
});

describe("shell text keys", () => {
  it("resolves every key the served markup asks for, in both languages", () => {
    const keys = new Set(
      [...html.matchAll(/data-i18n(?:-label)?="([^"]+)"/gu)].map(
        (match) => match[1] as string,
      ),
    );
    assert.ok(keys.size > 40);
    const missing = [...keys].flatMap((key) =>
      SUPPORTED_LOCALES.filter(
        (locale) => typeof catalogues[locale][key] !== "string",
      ).map((locale) => `${locale}.${key}`),
    );
    assert.deepEqual(
      missing,
      [],
      `The shell asks for keys no catalogue defines: ${missing.join(", ")}`,
    );
  });

  it("refuses two areas that claim one key, instead of letting merge order decide", () => {
    assert.throws(
      () => mergeCatalogues(GUI_CATALOGS, HOME_CATALOGUES, HOME_CATALOGUES),
      /both define/u,
    );
  });

  it("keeps every home sentence present and free of placeholders in both languages", () => {
    for (const [key, entry] of Object.entries(HOME_TEXT))
      for (const locale of SUPPORTED_LOCALES) {
        assert.ok(entry[locale]?.trim(), `${locale}.${key} is empty`);
        assert.doesNotMatch(entry[locale], /TODO|TBD/u);
      }
  });
});

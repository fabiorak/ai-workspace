import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { APP_JS, shellHtml } from "../src/assets.ts";

const html = shellHtml("csrf-token");
const privacySection = (() => {
  const start = html.indexOf('<section aria-labelledby="privacy-heading"');
  return start === -1
    ? ""
    : html.slice(start, html.indexOf("</section>", start));
})();

describe("the guided privacy preparation", () => {
  it("always gives the privacy route a visible explanation and way forward", () => {
    assert.match(
      APP_JS,
      /privacy: \["privacy", "context-pack", "privacy-audit"\]/u,
    );
    assert.match(privacySection, /id="privacy"/u);
    assert.match(privacySection, /href="#\/work"/u);
    assert.doesNotMatch(privacySection, /<section[^>]* hidden/u);
  });

  it("asks for names and review, never hashes, byte coordinates, or JSON", () => {
    assert.match(privacySection, /id="privacy-customer-aliases"/u);
    assert.match(privacySection, /id="privacy-project-aliases"/u);
    assert.match(privacySection, /id="privacy-proposal-items"/u);
    assert.match(privacySection, /id="privacy-review-form"/u);
    assert.match(
      privacySection,
      /<details id="privacy-proposal-sources">[\s\S]*id="privacy-proposal-profile"[\s\S]*id="privacy-proposal-model"[\s\S]*<\/details>/u,
    );
    assert.ok(
      privacySection.indexOf('id="privacy-customer-aliases"') <
        privacySection.indexOf('id="privacy-proposal-sources"'),
    );
    assert.doesNotMatch(
      privacySection,
      /byteStart|byteEnd|contentSha256|JSON|pseudonym-selections/u,
    );
    assert.doesNotMatch(privacySection, /<select[^>]+custody/u);
  });

  it("applies every proposal by default and lets a reader remove or add one", () => {
    assert.match(APP_JS, /checkbox\.checked = selection\.enabled/u);
    assert.match(APP_JS, /origin: "PROPOSED",\s*enabled: true/u);
    assert.match(APP_JS, /selectionStart/u);
    assert.match(APP_JS, /selectionEnd/u);
    assert.match(APP_JS, /privacyUnicodeRange/u);
    assert.ok(APP_JS.includes("\\uD800"));
    assert.match(APP_JS, /crypto\.subtle\.digest\("SHA-256"/u);
    assert.match(APP_JS, /privacyManualOverlap/u);
    assert.match(APP_JS, /const proposedSpans = new Set\(\)/u);
  });

  it("generates technical review fields and shows transformed text as text", () => {
    assert.match(APP_JS, /crypto\.randomUUID\(\)/u);
    assert.match(APP_JS, /mode: "PASSPHRASE_WRAPPING"/u);
    assert.match(APP_JS, /value\.transformation\.items/u);
    assert.match(APP_JS, /\[\.\.\.privacyItems\.values\(\)\]/u);
    assert.match(
      APP_JS,
      /transformedByItem\.get\(item\.id\) \?\? item\.content/u,
    );
    assert.match(APP_JS, /privacy-transformed-items/u);
    assert.match(APP_JS, /document\.createElement\("mark"\)/u);
    assert.doesNotMatch(APP_JS, /innerHTML\s*=/u);
  });
});

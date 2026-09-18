import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APP_JS } from "../src/assets.ts";

/**
 * Arriving at a screen halfway down it hides the heading that says where you
 * are, which is what a reader checks first after choosing a destination. The
 * shell keeps every screen in one document, so nothing moves the viewport
 * unless the client does it.
 *
 * The decision is lifted out of the shipped string and executed, rather than
 * asserted as text: a rename in the client has to fail here instead of passing
 * against a copy of the rule that nobody serves.
 */
function shippedDecision(): (page: string) => boolean {
  const declaration =
    /let renderedPage = null;\n {2}const startOfScreen = \([\s\S]*?\n {2}\};/u.exec(
      APP_JS,
    );
  assert.ok(declaration, "the client must still decide when a screen starts");
  return new Function(`${declaration[0]}\nreturn startOfScreen;`)() as (
    page: string,
  ) => boolean;
}

describe("a screen opens at its beginning", () => {
  it("returns to the top when the screen changes, and only then", () => {
    const startOfScreen = shippedDecision();
    assert.equal(startOfScreen("home"), true);
    // An arriving import, a filter or a language change redraws the same screen.
    // Scrolling away from the line a reader is on would be a second defect.
    assert.equal(startOfScreen("home"), false);
    assert.equal(startOfScreen("home"), false);
    assert.equal(startOfScreen("settings"), true);
    assert.equal(startOfScreen("settings"), false);
    assert.equal(startOfScreen("home"), true);
  });

  it("is what the route rendering actually calls", () => {
    // The rule is worth nothing if the render path does not use it, and the
    // hash route is the only way a screen changes in this shell.
    assert.match(APP_JS, /if \(startOfScreen\(page\)\) scrollTo\(0, 0\);/u);
    assert.match(
      APP_JS,
      /addEventListener\("hashchange", \(\) => renderRoute/u,
    );
  });
});

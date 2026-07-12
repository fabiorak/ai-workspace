import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GUI_CATALOGS,
  guiMessage,
  resolveGuiLocale,
  SUPPORTED_LOCALES,
} from "../src/index.ts";

describe("GUI localization contract", () => {
  it("keeps every supported catalog complete and free of placeholders", () => {
    assert.deepEqual(SUPPORTED_LOCALES, ["en", "it"]);
    const english = Object.keys(GUI_CATALOGS.en).sort();
    assert.ok(english.length > 50);
    for (const locale of SUPPORTED_LOCALES) {
      assert.deepEqual(Object.keys(GUI_CATALOGS[locale]).sort(), english);
      assert.equal(
        Object.values(GUI_CATALOGS[locale]).every(
          (value) => value.trim() && !/TODO|TBD/u.test(value),
        ),
        true,
      );
    }
  });

  it("uses explicit, browser, and English fallback order deterministically", () => {
    assert.equal(resolveGuiLocale("it", ["en-US"]), "it");
    assert.equal(resolveGuiLocale(null, ["it-IT", "en"]), "it");
    assert.equal(resolveGuiLocale("unsupported", ["de-DE"]), "en");
  });

  it("validates interpolation and neutralizes terminal controls", () => {
    assert.equal(
      guiMessage("it", "selectProject", { name: "Demo" }),
      "Seleziona Demo",
    );
    assert.equal(
      guiMessage("en", "selectProject", { name: "De\u0000mo" }),
      "Select De�mo",
    );
    assert.throws(() => guiMessage("en", "selectProject"));
    assert.throws(() => guiMessage("en", "projects", { extra: "value" }));
  });
});

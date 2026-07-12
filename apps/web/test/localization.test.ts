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

  it("covers the complete onboarding copy instead of headings only", () => {
    assert.equal(
      GUI_CATALOGS.it.welcomeRegistration,
      "La registrazione salva localmente metadati Git bounded. Non copia né modifica i file del repository.",
    );
    assert.equal(
      guiMessage("it", "projectsRegistered", { count: "2" }),
      "2 progetti sono registrati localmente.",
    );
    assert.match(GUI_CATALOGS.it.projectDirectoryHelp, /registrazione/u);
    assert.match(GUI_CATALOGS.it.projectEffect, /Effetto/u);
    assert.equal(GUI_CATALOGS.it.progressSource, "4. Esamina sorgente");
    assert.equal(GUI_CATALOGS.it.trust, "Attendibilità:");
    assert.equal(
      guiMessage("it", "readyImport", { name: "ai-workspace" }),
      "Pronto a importare l'esempio fittizio in ai-workspace.",
    );
    assert.match(GUI_CATALOGS.it.noMatchingMemory, /Nessuna memoria/u);
    assert.match(GUI_CATALOGS.it.noWorkItems, /Nessun Work Item/u);
  });
});

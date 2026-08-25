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

  it("describes work history instead of the former control plane", () => {
    assert.equal(
      GUI_CATALOGS.en.headerTagline,
      "Your work history, on this computer",
    );
    assert.equal(
      GUI_CATALOGS.it.headerTagline,
      "La storia del tuo lavoro, sul tuo computer",
    );
    assert.doesNotMatch(
      `${GUI_CATALOGS.en.headerTagline} ${GUI_CATALOGS.it.headerTagline}`,
      /control plane|piano di controllo/iu,
    );
  });

  it("states a reason for every match rule and offers no search mode", () => {
    /**
     * One merged token set means there is no prose-or-code mode to pick and
     * none to disclose. The failure that hid itself — a query run in the wrong
     * mode returning plausible results instead of none — is gone at the root,
     * so nothing in either language may offer the choice back.
     */
    for (const locale of SUPPORTED_LOCALES) {
      const catalog = GUI_CATALOGS[locale];
      for (const kind of [
        "reasonEXACT",
        "reasonPREFIX",
        "reasonSTEM",
        "reasonTYPO",
        "reasonGLOSSARY",
      ] as const) {
        const sentence = catalog[kind];
        assert.ok(sentence, `${locale} states the ${kind} reason`);
        assert.match(sentence, /\{term\}/u);
      }
      assert.ok(catalog.searchWhyMatched);
      for (const [key, value] of Object.entries(catalog))
        assert.doesNotMatch(
          value,
          /\b(prose mode|code mode|search mode|modalità di ricerca|modalità prosa|modalità codice)\b/iu,
          `${locale}.${key} offers no search mode`,
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
    // Italian has no "(s)", so the count follows the noun and the sentence reads
    // correctly at one as well as at many.
    assert.equal(
      guiMessage("it", "projectsRegistered", { count: "2" }),
      "Progetti registrati localmente: 2.",
    );
    assert.match(GUI_CATALOGS.it.projectDirectoryHelp, /registrazione/u);
    assert.match(GUI_CATALOGS.it.projectEffect, /Effetto/u);
    assert.equal(GUI_CATALOGS.it.progressSource, "4. Esamina sorgente");
    assert.equal(GUI_CATALOGS.it.navSettings, "Impostazioni");
    assert.equal(GUI_CATALOGS.it.navSystem, "Stato sistema");
    assert.match(GUI_CATALOGS.it.scriptsUnavailable, /Nessun runner/u);
    assert.equal(GUI_CATALOGS.it.trust, "Attendibilità:");
    assert.equal(
      guiMessage("it", "readyImport", { name: "ai-workspace" }),
      "Pronto a importare l'esempio fittizio in ai-workspace.",
    );
    assert.match(GUI_CATALOGS.it.noMatchingMemory, /Nessuna memoria/u);
    assert.match(GUI_CATALOGS.it.noWorkItems, /Nessun Work Item/u);
    assert.equal(
      GUI_CATALOGS.it.allProjects,
      "Tutti i progetti registrati e General",
    );
    assert.match(GUI_CATALOGS.it.searchIntro, /OpenSearch/u);
    assert.equal(
      guiMessage("it", "globalFound", {
        count: "2",
        projects: "3",
        events: "40",
      }),
      "Risultati trovati: 2. Progetti esaminati: 3; eventi esaminati: 40.",
    );
    assert.match(GUI_CATALOGS.it.selectInspect, /Seleziona questo progetto/u);
    assert.match(GUI_CATALOGS.it.contextWarning, /schema v2/u);
    assert.match(
      guiMessage("it", "contextReady", {
        schema: "2",
        entries: "3",
        sharedBytes: "512",
      }),
      /3 sorgenti condivise.*512 byte/u,
    );
    assert.match(GUI_CATALOGS.it.profileWarning, /non concedono permessi/u);
    assert.match(
      guiMessage("it", "profileReady", {
        name: "Review",
        skills: "2",
        sourceBytes: "1000",
        canonicalBytes: "900",
      }),
      /Review.*2 skill.*1000 byte.*900 byte/u,
    );
    assert.match(GUI_CATALOGS.it.profileContextWarning, /sola lettura/u);
    assert.match(GUI_CATALOGS.it.privacyPreflightWarning, /CONFIDENTIAL/u);
    assert.match(GUI_CATALOGS.it.privacyPreflightWarning, /non è permesso/u);
    assert.match(
      guiMessage("it", "profileContextReady", {
        profile: "review-agent",
        model: "model-balanced",
        sources: "3",
        rules: "3",
        schema: "2",
      }),
      /review-agent.*model-balanced.*3 sorgenti.*3 regole.*schema 2/u,
    );
    assert.match(GUI_CATALOGS.it.contextSelectorWarning, /safety floor/u);
    assert.match(
      guiMessage("it", "contextSelectorReady", {
        selected: "3000",
        baseline: "5000",
        reduction: "40",
        loss: "0",
        fit: "YES",
      }),
      /3000.*5000.*40%.*safety floor 0.*YES/u,
    );
  });
  assert.match(
    guiMessage("it", "privacyPreflightReady", {
      result: "REVIEWABLE_NOT_AUTHORIZED",
      model: "model-balanced",
      policy: "synthetic-policy",
      allowed: "8",
      blocked: "0",
      defaulted: "8",
      restricted: "0",
    }),
    /nulla è stato inviato o autorizzato/u,
  );
});

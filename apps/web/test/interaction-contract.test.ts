import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GUI_SCREEN_CONTRACTS,
  validateGuiInteractionContracts,
} from "../src/index.ts";

describe("GUI interaction contract", () => {
  it("covers the no-manual journey with inline action and recovery guidance", () => {
    assert.equal(validateGuiInteractionContracts(), true);
    assert.deepEqual(
      GUI_SCREEN_CONTRACTS.map((screen) => screen.step),
      ["WELCOME", "PROJECTS", "IMPORT", "SEARCH", "EVENT", "ARTIFACT"],
    );
    assert.equal(
      GUI_SCREEN_CONTRACTS.every(
        ({ primaryAction }) =>
          primaryAction.label !== primaryAction.id &&
          primaryAction.description.length > 20 &&
          primaryAction.effect.length > 20 &&
          primaryAction.recovery.length > 20 &&
          primaryAction.nextAction.length > 20,
      ),
      true,
    );
  });

  it("rejects incomplete screens before they reach the presentation layer", () => {
    const broken = GUI_SCREEN_CONTRACTS.map((screen, index) =>
      index === 0
        ? {
            ...screen,
            primaryAction: { ...screen.primaryAction, description: "" },
          }
        : screen,
    );
    assert.throws(() => validateGuiInteractionContracts(broken));
  });
});

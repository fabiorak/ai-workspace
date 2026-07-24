import { TextDecoder } from "node:util";

import {
  SessionImportError,
  type RestrictedDataScreen,
} from "@ai-workspace/session-ingestion";
import { detectRestrictedData } from "@ai-workspace/privacy-gateway";

/**
 * Blocks an import that contains high-confidence restricted data.
 *
 * The detector accepts at most one megabyte of text per call, while a real agent
 * transcript is routinely larger than that (ADR-0029). The content is therefore
 * scanned in bounded windows that overlap, so a pattern lying across a window
 * boundary is still seen: every detector pattern is far shorter than the overlap.
 * Screening stays fail-closed — the first detection blocks the whole import and
 * nothing is written.
 */

// Counted in characters, not bytes: a window of this many UTF-16 units cannot
// exceed the detector's one-megabyte input limit once encoded as UTF-8.
const WINDOW_CHARACTERS = 256 * 1024;
const OVERLAP_CHARACTERS = 4_096;
const decoder = new TextDecoder("utf8", { fatal: false });

export class HighConfidenceRestrictedDataScreen implements RestrictedDataScreen {
  public assertAllowed(content: Uint8Array, location: string): void {
    const text = decoder.decode(content);
    const step = WINDOW_CHARACTERS - OVERLAP_CHARACTERS;

    for (let start = 0; ; start += step) {
      const category = detectRestrictedData(
        text.slice(start, start + WINDOW_CHARACTERS),
      );

      if (category !== null) {
        throw new SessionImportError(
          `Restricted data detected in ${location} (${category}); import blocked`,
        );
      }

      if (start + WINDOW_CHARACTERS >= text.length) {
        return;
      }
    }
  }
}

import { TextDecoder } from "node:util";

import {
  SessionImportError,
  type RestrictedDataClassifier,
  type RestrictedDataScreen,
} from "@ai-workspace/session-ingestion";
import { detectRestrictedData } from "@ai-workspace/privacy-gateway";

/**
 * Detects high-confidence restricted data in import candidates.
 *
 * The detector accepts at most one megabyte of text per call, while a real agent
 * transcript is routinely larger than that (ADR-0029). The content is therefore
 * scanned in bounded windows that overlap, so a pattern lying across a window
 * boundary is still seen: every detector pattern is far shorter than the overlap.
 *
 * Two shapes share that single scan. The screen stays fail-closed: the first
 * detection blocks whatever it was given and nothing is written. The classifier
 * only reports the category, so a tolerant reader can exclude and account for one
 * record instead of losing the transcript (ADR-0030). Neither shape ever returns,
 * logs, or persists the matched value or a fragment of it.
 */

// Counted in characters, not bytes: a window of this many UTF-16 units cannot
// exceed the detector's one-megabyte input limit once encoded as UTF-8.
const WINDOW_CHARACTERS = 256 * 1024;
const OVERLAP_CHARACTERS = 4_096;
const decoder = new TextDecoder("utf8", { fatal: false });

export function classifyRestrictedData(content: Uint8Array): string | null {
  const text = decoder.decode(content);
  const step = WINDOW_CHARACTERS - OVERLAP_CHARACTERS;

  for (let start = 0; ; start += step) {
    const category = detectRestrictedData(
      text.slice(start, start + WINDOW_CHARACTERS),
    );

    if (category !== null) {
      return category;
    }

    if (start + WINDOW_CHARACTERS >= text.length) {
      return null;
    }
  }
}

export class HighConfidenceRestrictedDataScreen implements RestrictedDataScreen {
  public assertAllowed(content: Uint8Array, location: string): void {
    const category = classifyRestrictedData(content);

    if (category !== null) {
      throw new SessionImportError(
        `Restricted data detected in ${location} (${category}); import blocked`,
      );
    }
  }
}

export class HighConfidenceRestrictedDataClassifier implements RestrictedDataClassifier {
  public classify(content: Uint8Array): string | null {
    return classifyRestrictedData(content);
  }
}

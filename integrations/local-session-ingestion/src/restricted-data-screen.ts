import { TextDecoder } from "node:util";

import {
  SessionImportError,
  type RestrictedDataScreen,
} from "@ai-workspace/session-ingestion";
import { detectRestrictedData } from "@ai-workspace/privacy-gateway";

const decoder = new TextDecoder("utf8", { fatal: false });

export class HighConfidenceRestrictedDataScreen implements RestrictedDataScreen {
  public assertAllowed(content: Uint8Array, location: string): void {
    const text = decoder.decode(content);

    const category = detectRestrictedData(text);
    if (category !== null)
      throw new SessionImportError(
        `Restricted data detected in ${location} (${category}); import blocked`,
      );
  }
}

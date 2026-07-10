import { TextDecoder } from "node:util";

import {
  SessionImportError,
  type RestrictedDataScreen,
} from "@ai-workspace/session-ingestion";

const decoder = new TextDecoder("utf8", { fatal: false });

const DETECTORS: readonly Readonly<{
  category: string;
  pattern: RegExp;
}>[] = Object.freeze([
  {
    category: "private-key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  },
  {
    category: "aws-access-key",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u,
  },
  {
    category: "github-token",
    pattern: /\bgh[oprsu]_[A-Za-z0-9]{30,}\b/u,
  },
  {
    category: "provider-api-key",
    pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/u,
  },
  {
    category: "assigned-credential",
    pattern:
      /\b(?:api[_-]?key|access[_-]?token|password)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{12,}/iu,
  },
]);

export class HighConfidenceRestrictedDataScreen implements RestrictedDataScreen {
  public assertAllowed(content: Uint8Array, location: string): void {
    const text = decoder.decode(content);

    for (const detector of DETECTORS) {
      if (detector.pattern.test(text)) {
        throw new SessionImportError(
          `Restricted data detected in ${location} (${detector.category}); import blocked`,
        );
      }
    }
  }
}

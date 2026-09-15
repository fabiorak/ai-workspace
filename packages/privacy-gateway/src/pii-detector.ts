export const PII_ENTITY_TYPES = Object.freeze([
  "PERSON",
  "ORGANIZATION",
  "CUSTOMER",
  "PROJECT",
  "EMAIL",
  "PHONE",
  "TAX_ID",
  "VAT_ID",
  "IBAN",
  "ADDRESS",
  "DATE",
  "PATH",
  "URL",
  "BUSINESS_IDENTIFIER",
  "OTHER",
] as const);

export type PiiEntityType = (typeof PII_ENTITY_TYPES)[number];

export type PiiSpan = Readonly<{
  startUtf8: number;
  endUtf8: number;
  type: PiiEntityType;
  confidence: number;
  detector: string;
}>;

export type PiiDetector = Readonly<{
  detect(text: string, languageHint?: string): Promise<readonly PiiSpan[]>;
}>;

type Pattern = Readonly<{
  type: PiiEntityType;
  expression: RegExp;
  confidence: number;
}>;

const PATTERNS: readonly Pattern[] = Object.freeze([
  {
    type: "EMAIL",
    expression: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/giu,
    confidence: 0.99,
  },
  {
    type: "IBAN",
    expression: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gu,
    confidence: 0.98,
  },
  {
    type: "TAX_ID",
    expression: /\b[A-Z]{6}\d{2}[A-EHLMPRST]\d{2}[A-Z]\d{3}[A-Z]\b/giu,
    confidence: 0.98,
  },
  {
    type: "VAT_ID",
    expression: /\b(?:IT)?\d{11}\b/gu,
    confidence: 0.96,
  },
  {
    type: "PHONE",
    expression:
      /(?<![\p{L}\p{N}_])(?:\+39[ .-]?)?(?:0\d{1,3}|3\d{2})[ .-]?\d{5,8}\b/gu,
    confidence: 0.93,
  },
]);

export class BuiltInPiiDetector implements PiiDetector {
  public async detect(
    text: string,
    languageHint?: string,
  ): Promise<readonly PiiSpan[]> {
    void languageHint;
    if (
      typeof text !== "string" ||
      !text.isWellFormed() ||
      Buffer.byteLength(text, "utf8") > 1024 * 1024
    )
      throw new Error("PII_DETECTION_INPUT_INVALID");
    const candidates = PATTERNS.flatMap((pattern, priority) =>
      [...text.matchAll(pattern.expression)].map((match) => {
        const start = match.index;
        const value = match[0];
        return {
          priority,
          span: Object.freeze({
            startUtf8: Buffer.byteLength(text.slice(0, start), "utf8"),
            endUtf8: Buffer.byteLength(
              text.slice(0, start + value.length),
              "utf8",
            ),
            type: pattern.type,
            confidence: pattern.confidence,
            detector: "BUILT_IN_DETERMINISTIC_V1",
          }),
        };
      }),
    );
    candidates.sort(
      (left, right) =>
        left.span.startUtf8 - right.span.startUtf8 ||
        left.priority - right.priority ||
        right.span.endUtf8 - left.span.endUtf8,
    );
    const accepted: PiiSpan[] = [];
    for (const candidate of candidates) {
      if (
        accepted.some(
          (span) =>
            candidate.span.startUtf8 < span.endUtf8 &&
            candidate.span.endUtf8 > span.startUtf8,
        )
      )
        continue;
      accepted.push(candidate.span);
    }
    return Object.freeze(accepted.sort((a, b) => a.startUtf8 - b.startUtf8));
  }
}

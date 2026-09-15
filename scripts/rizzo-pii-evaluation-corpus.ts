import { createHash } from "node:crypto";

import type { PiiEntityType } from "../packages/privacy-gateway/src/index.ts";

export const RIZZO_PII_CORPUS_ID = "U5_SYNTHETIC_IT_EN_V1" as const;

export type PiiEvaluationKind =
  | "PERSON"
  | "ORGANIZATION"
  | "EMAIL"
  | "PHONE"
  | "TAX_ID"
  | "VAT_ID"
  | "IBAN"
  | "ADDRESS"
  | "DATE"
  | "PATH"
  | "URL"
  | "HASH_NEGATIVE"
  | "CODE_NEGATIVE"
  | "LOG_NEGATIVE";

export type PiiEvaluationTruth = Readonly<{
  startUtf8: number;
  endUtf8: number;
  type: PiiEntityType;
}>;

export type PiiEvaluationFixture = Readonly<{
  id: string;
  language: "it" | "en";
  kind: PiiEvaluationKind;
  text: string;
  expected: readonly PiiEvaluationTruth[];
}>;

type Marked = Readonly<{ value: string; type: PiiEntityType }>;

const mark = (value: string, type: PiiEntityType): Marked => ({ value, type });

function fixture(
  id: string,
  language: "it" | "en",
  kind: PiiEvaluationKind,
  parts: readonly (string | Marked)[],
): PiiEvaluationFixture {
  let text = "";
  const expected: PiiEvaluationTruth[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      text += part;
      continue;
    }
    const startUtf8 = Buffer.byteLength(text, "utf8");
    text += part.value;
    expected.push(
      Object.freeze({
        startUtf8,
        endUtf8: Buffer.byteLength(text, "utf8"),
        type: part.type,
      }),
    );
  }
  return Object.freeze({
    id,
    language,
    kind,
    text,
    expected: Object.freeze(expected),
  });
}

const PEOPLE = Object.freeze([
  "Alma Virelli",
  "Bruno Castelli",
  "Celia Montorsi",
  "Dario Luminati",
  "Elena Quercini",
  "Flavio Sereni",
  "Greta Valdieri",
  "Hugo Northfield",
  "Iris Meadowcroft",
  "Jonas Wintermere",
]);
const ORGANIZATIONS = Object.freeze([
  "Aurora Sintetica S.r.l.",
  "Cooperativa Gelsomino",
  "Studio Fittizio Associato",
  "Officine Luminara S.p.A.",
  "Fondazione Quercia Blu",
  "Northfield Example Ltd",
  "Wintermere Sample Works",
  "Meadowcroft Fictional Trust",
  "Asteria Testing Group",
  "Cobalt Demo Partners",
]);

const CF_ODD = "BAKPLCQDREVOSFTGUHMINJWZYX";
const CF_EVEN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function fiscalCode(base: string): string {
  if (!/^[A-Z0-9]{15}$/u.test(base))
    throw new Error("INVALID_SYNTHETIC_CF_BASE");
  let total = 0;
  for (let index = 0; index < base.length; index += 1) {
    const character = base[index]!;
    const normalized = /\d/u.test(character)
      ? String.fromCharCode("A".charCodeAt(0) + Number(character))
      : character;
    total +=
      index % 2 === 0
        ? CF_ODD.charCodeAt(CF_EVEN.indexOf(normalized)) - 65
        : CF_EVEN.indexOf(normalized);
  }
  return `${base}${String.fromCharCode(65 + (total % 26))}`;
}

function vatId(base: string): string {
  if (!/^\d{10}$/u.test(base)) throw new Error("INVALID_SYNTHETIC_VAT_BASE");
  let total = 0;
  for (let index = 0; index < base.length; index += 1) {
    let digit = Number(base[index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    total += digit;
  }
  return `${base}${(10 - (total % 10)) % 10}`;
}

function mod97(value: string): number {
  let remainder = 0;
  for (const character of value) {
    const digits = /[A-Z]/u.test(character)
      ? String(character.charCodeAt(0) - 55)
      : character;
    for (const digit of digits)
      remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}

function italianIban(index: number): string {
  const bban = `X0542811101${String(10_000_000_000 + index).slice(-12)}`;
  const check = String(98 - mod97(`${bban}IT00`)).padStart(2, "0");
  return `IT${check}${bban}`;
}

function positives(): PiiEvaluationFixture[] {
  const result: PiiEvaluationFixture[] = [];
  for (let index = 0; index < 10; index += 1) {
    const language = index < 7 ? "it" : "en";
    result.push(
      fixture(`person-${index}`, language, "PERSON", [
        language === "it" ? "La referente è " : "The contact is ",
        mark(PEOPLE[index]!, "PERSON"),
        language === "it"
          ? " per la pratica inventata."
          : " for the fictional case.",
      ]),
      fixture(`organization-${index}`, language, "ORGANIZATION", [
        language === "it"
          ? "Il fornitore indicato è "
          : "The named supplier is ",
        mark(ORGANIZATIONS[index]!, "ORGANIZATION"),
        ".",
      ]),
      fixture(`email-${index}`, language, "EMAIL", [
        language === "it" ? "Scrivere a " : "Write to ",
        mark(`utente${index}@example.invalid`, "EMAIL"),
        language === "it" ? " per la demo." : " for this sample.",
      ]),
      fixture(`phone-${index}`, language, "PHONE", [
        language === "it" ? "Numero di prova: " : "Sample telephone: ",
        mark(`+39 333 555${String(1000 + index)}`, "PHONE"),
        ".",
      ]),
      fixture(`tax-id-${index}`, "it", "TAX_ID", [
        "Codice fiscale sintetico: ",
        mark(fiscalCode(`SYNTHA8${index}A01H${String(500 + index)}`), "TAX_ID"),
        ".",
      ]),
      fixture(`vat-id-${index}`, "it", "VAT_ID", [
        "Partita IVA di collaudo: ",
        mark(vatId(String(10_000_000 + index).padStart(10, "0")), "VAT_ID"),
        ".",
      ]),
      fixture(`iban-${index}`, language, "IBAN", [
        language === "it" ? "IBAN inventato: " : "Fictional IBAN: ",
        mark(italianIban(index), "IBAN"),
        ".",
      ]),
      fixture(`address-${index}`, language, "ADDRESS", [
        language === "it" ? "Recapito inventato: " : "Fictional address: ",
        mark(`Via delle Querce ${40 + index}`, "ADDRESS"),
        ", ",
        mark(`001${String(index).padStart(2, "0")}`, "ADDRESS"),
        " ",
        mark(`Luminara${index}`, "ADDRESS"),
        " ",
        mark("RM", "ADDRESS"),
        ".",
      ]),
      fixture(`date-${index}`, language, "DATE", [
        language === "it" ? "La data indicata è " : "The stated date is ",
        mark(`${String(index + 1).padStart(2, "0")}/10/203${index}`, "DATE"),
        ".",
      ]),
      fixture(`path-${index}`, language, "PATH", [
        language === "it" ? "Apri il percorso locale " : "Open the local path ",
        mark(`/srv/synthetic/workspace-${index}/private-note.txt`, "PATH"),
        ".",
      ]),
      fixture(`url-${index}`, language, "URL", [
        language === "it" ? "Profilo di test: " : "Test profile: ",
        mark(`https://example.com/fictional/user-${index}`, "URL"),
        ".",
      ]),
    );
  }
  return result;
}

function negatives(): PiiEvaluationFixture[] {
  const result: PiiEvaluationFixture[] = [];
  for (let index = 0; index < 10; index += 1) {
    result.push(
      fixture(
        `hash-negative-${index}`,
        index < 5 ? "it" : "en",
        "HASH_NEGATIVE",
        [
          `sha256:${createHash("sha256").update(`synthetic-hash-${index}`).digest("hex")}`,
        ],
      ),
      fixture(
        `code-negative-${index}`,
        index < 5 ? "it" : "en",
        "CODE_NEGATIVE",
        [
          `const fixture${index} = { email: "dev${index}@example.invalid", phone: "+39 333 555${String(2000 + index)}" };`,
        ],
      ),
      fixture(
        `log-negative-${index}`,
        index < 5 ? "it" : "en",
        "LOG_NEGATIVE",
        [
          `203${index}-10-${String(index + 1).padStart(2, "0")}T08:15:30Z INFO job=${String(index).padStart(4, "0")} status=synthetic_ok`,
        ],
      ),
    );
  }
  return result;
}

export function buildRizzoPiiEvaluationCorpus(): readonly PiiEvaluationFixture[] {
  const corpus = Object.freeze([...positives(), ...negatives()]);
  if (corpus.length !== 140) throw new Error("INVALID_SYNTHETIC_CORPUS_SIZE");
  return corpus;
}

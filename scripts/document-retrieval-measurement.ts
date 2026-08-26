/**
 * Measures document retrieval over the real Markdown documents of this
 * repository, to decide whether the engine measured in
 * `tolerant-search-measurement.ts` and `unified-retrieval-measurement.ts` also
 * serves documents, and at which indexing unit.
 *
 * The two earlier measurements used conversation-shaped records: one to three
 * sentences each. Documents are three orders of magnitude longer, they carry
 * headings, and in this repository they are mostly English while the person
 * asking is Italian. Those three differences are what this measurement isolates.
 *
 * The corpus is the committed documentation of this repository, read at run
 * time. It is real prose, already public, and it is not copied into a fixture.
 * The ignored local handoff file is excluded. Because the corpus grows as the
 * project grows, the report states its fingerprint and the owning test asserts
 * predeclared targets and thresholds rather than frozen percentages.
 *
 * Ground truth is predeclared by reading the documents, not by running a query:
 * `expected` lists every document a person asking that question would want.
 *
 * Retrieval rules are imported from the lexical measurement rather than
 * reimplemented, so this measures that engine and not a variant of it.
 *
 * Development-only. No production consumer.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  contentTerms,
  isTypoOf,
  normalizeTokens,
  stem,
} from "../packages/tolerant-retrieval/src/index.ts";

export class DocumentRetrievalMeasurementError extends Error {}

export const DOCUMENT_CORPUS_ID = "DOCUMENT_RETRIEVAL_REAL_REPOSITORY_V1";
export const SCHEMA_VERSION = 1;

/** A query must answer within this budget at the measured corpus size. */
const INTERACTIVE_BUDGET_MILLISECONDS = 150;

/**
 * Directories and files that form the declared document corpus. `AGENTS.md` was
 * a root until assistant instruction files stopped being versioned in this
 * public repository. It still exists on the machines that use it, which is
 * exactly why it cannot stay: reading it would measure one machine instead of
 * the documentation a fresh clone contains.
 */
export const CORPUS_ROOTS = Object.freeze([
  "docs",
  "README.md",
  "ROADMAP.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
]);

/**
 * Excluded from the corpus. The local handoff file and the internal planning
 * material are both intentionally ignored by Git, and neither may be read into a
 * measured corpus: a corpus that includes untracked files measures one machine
 * instead of this repository, and the same run against a fresh clone then reports
 * different figures. The owning test asserts the collected corpus against the Git
 * index, because keeping this list correct by hand has already failed once.
 */
const EXCLUDED_PATHS = Object.freeze([
  ".ai-workspace",
  "node_modules",
  ".git",
  "docs/planning",
]);

/**
 * Indexing units under comparison. This is the open question for documents: a
 * whole document dilutes its own terms under BM25 length normalization, while a
 * section answers with the part a person has to read.
 */
export const INDEXING_UNITS = Object.freeze([
  "WHOLE_DOCUMENT",
  "SECTION",
  "SECTION_HEADING_WEIGHTED",
] as const);

export type IndexingUnit = (typeof INDEXING_UNITS)[number];

export const DOCUMENT_ENGINES = Object.freeze([
  "INVERTED_WHOLE_DOCUMENT",
  "INVERTED_SECTION",
  "INVERTED_SECTION_HEADING_WEIGHTED",
  "INVERTED_SECTION_GLOSSARY",
  "FTS5_SECTION_UNICODE61",
  "DENSE_SECTION",
  "HYBRID_SECTION",
] as const);

export type DocumentEngineName = (typeof DOCUMENT_ENGINES)[number];

export const DENSE_MODEL = "bge-m3";
export const DENSE_ENDPOINT = "http://localhost:11434/api/embed";
export const DENSE_MODES = Object.freeze([
  "SKIP",
  "IF_AVAILABLE",
  "REQUIRE",
] as const);
export type DenseMode = (typeof DENSE_MODES)[number];

/** bge-m3 truncates long input; declared here so the limit is not implicit. */
const DENSE_CHARACTER_LIMIT = 4_000;

/** How many heading repetitions the weighted unit applies. */
const HEADING_WEIGHT = 3;

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const RRF_K = 60;
const RESULT_LIMIT = 10;

export const QUERY_LANGUAGES = Object.freeze(["IT", "EN"] as const);
export type QueryLanguage = (typeof QUERY_LANGUAGES)[number];

export const DOCUMENT_FAMILIES = Object.freeze([
  "LITERAL",
  "INFLECTION",
  "TYPO",
  "WORD_ORDER",
  "SYNONYM",
  "PARAPHRASE",
  "SECTION_LOCALIZATION",
] as const);
export type DocumentFamily = (typeof DOCUMENT_FAMILIES)[number];

export type DocumentRecord = Readonly<{
  id: string;
  documentPath: string;
  headingPath: string;
  body: string;
  unit: IndexingUnit;
}>;

export type DocumentQuery = Readonly<{
  id: string;
  text: string;
  language: QueryLanguage;
  family: DocumentFamily;
  /** Every document a person asking this question would want to find. */
  expected: readonly string[];
  /** Heading a section-level answer should land in, when the document is long. */
  expectedHeading: string | null;
}>;

/**
 * Predeclared questions. Italian questions against English documents are the
 * measured reality of this repository: 132 of 135 documents are English and the
 * person asking is Italian. Same-language questions are kept beside them so the
 * cost of the language gap is separable from the cost of tolerance.
 */
export const DOCUMENT_QUERIES: readonly DocumentQuery[] = Object.freeze([
  {
    id: "it-artifact-store",
    text: "dove sono conservati gli artefatti indirizzati per contenuto",
    language: "IT",
    family: "PARAPHRASE",
    expected: Object.freeze([
      "docs/adr/0007-use-a-local-content-addressed-artifact-store.md",
    ]),
    expectedHeading: null,
  },
  {
    id: "it-model-delivery",
    text: "perche serve una decisione sulla privacy verificabile prima di inviare al modello",
    language: "IT",
    family: "PARAPHRASE",
    expected: Object.freeze([
      "docs/adr/0017-require-an-inspectable-privacy-decision-before-model-delivery.md",
      "docs/development/model-delivery-authorization-corpus.md",
      "docs/development/model-delivery-authorization-observations.md",
    ]),
    expectedHeading: null,
  },
  {
    id: "it-restricted-data",
    text: "quali dati sono considerati riservati",
    language: "IT",
    family: "SECTION_LOCALIZATION",
    expected: Object.freeze(["docs/security/DATA_CLASSIFICATION.md"]),
    expectedHeading: "Restricted",
  },
  {
    id: "it-prompt-injection",
    text: "come ci difendiamo dall iniezione di istruzioni nei prompt",
    language: "IT",
    family: "SECTION_LOCALIZATION",
    expected: Object.freeze(["docs/security/THREAT_MODEL.md"]),
    expectedHeading: "Prompt injection and instruction confusion",
  },
  {
    id: "it-mapping-key",
    text: "come e protetta la chiave della mappatura locale",
    language: "IT",
    family: "PARAPHRASE",
    expected: Object.freeze([
      "docs/adr/0022-use-passphrase-wrapped-local-mapping-keys.md",
      "docs/development/local-mapping-key-custody-corpus.md",
      "docs/development/local-mapping-key-custody-observations.md",
    ]),
    expectedHeading: null,
  },
  {
    id: "it-dashboard",
    text: "come navigo il quadro di sintesi dello spazio di lavoro",
    language: "IT",
    family: "SYNONYM",
    expected: Object.freeze(["docs/user-guide/workspace-dashboard.md"]),
    expectedHeading: null,
  },
  {
    id: "it-import-transcripts",
    text: "come importo le mie trascrizioni locali",
    language: "IT",
    family: "PARAPHRASE",
    expected: Object.freeze([
      "docs/user-guide/local-transcripts.md",
      "docs/adr/0029-ingest-real-local-agent-transcripts-through-a-tolerant-adapter.md",
    ]),
    expectedHeading: null,
  },
  {
    id: "it-memoria-attiva",
    text: "come curo la memoria attiva del progetto",
    language: "IT",
    /**
     * Not LITERAL despite naming the feature exactly: the documents say "active
     * memory". An Italian question against an English document can never be
     * literal, which is itself part of what this measurement shows.
     */
    family: "PARAPHRASE",
    expected: Object.freeze([
      "docs/user-guide/active-memory.md",
      "docs/adr/0009-use-atomic-operation-logs-for-active-memory.md",
    ]),
    expectedHeading: null,
  },
  {
    id: "it-visione-moduli",
    text: "quali moduli architetturali aggiuntivi sono previsti",
    language: "IT",
    family: "SECTION_LOCALIZATION",
    expected: Object.freeze(["docs/AI_WORKSPACE_VISION_LONG_TERM_IT.md"]),
    expectedHeading: "1. Moduli architetturali aggiuntivi",
  },
  {
    id: "it-visione-inflessione",
    text: "decisione superata invalidata memoria",
    language: "IT",
    family: "INFLECTION",
    expected: Object.freeze([
      "docs/AI_WORKSPACE_DESIGN_PUBLIC_IT.md",
      "docs/product/EXPERIENCE_VISION_IT.md",
    ]),
    expectedHeading: null,
  },
  {
    id: "en-artifact-store",
    text: "content addressed artifact store",
    language: "EN",
    family: "LITERAL",
    expected: Object.freeze([
      "docs/adr/0007-use-a-local-content-addressed-artifact-store.md",
    ]),
    expectedHeading: null,
  },
  {
    id: "en-artifact-word-order",
    text: "store artifact addressed content local",
    language: "EN",
    family: "WORD_ORDER",
    expected: Object.freeze([
      "docs/adr/0007-use-a-local-content-addressed-artifact-store.md",
    ]),
    expectedHeading: null,
  },
  {
    id: "en-attempt-store",
    text: "separate local model attempt evidence store",
    language: "EN",
    family: "LITERAL",
    expected: Object.freeze([
      "docs/adr/0028-use-separate-local-model-attempt-store.md",
    ]),
    expectedHeading: null,
  },
  {
    id: "en-screening-inflection",
    text: "screening restricted records in the reader",
    language: "EN",
    family: "INFLECTION",
    expected: Object.freeze([
      "docs/adr/0030-screen-restricted-data-per-record-in-the-tolerant-reader.md",
    ]),
    expectedHeading: null,
  },
  {
    id: "en-restoration-typo",
    text: "psuedonymized output restoraton",
    language: "EN",
    family: "TYPO",
    expected: Object.freeze([
      "docs/adr/0025-use-strict-local-pseudonymized-output-restoration.md",
      "docs/user-guide/pseudonymized-output-restoration.md",
      "docs/development/privacy-output-restoration-corpus.md",
      "docs/development/privacy-output-restoration-observations.md",
    ]),
    expectedHeading: null,
  },
  {
    id: "en-threat-tampering",
    text: "evidence and memory tampering",
    language: "EN",
    family: "SECTION_LOCALIZATION",
    expected: Object.freeze(["docs/security/THREAT_MODEL.md"]),
    expectedHeading: "Evidence and memory tampering",
  },
  {
    id: "en-first-journey",
    text: "first guided journey in the graphical interface",
    language: "EN",
    family: "SYNONYM",
    expected: Object.freeze([
      "docs/user-guide/gui-first-journey.md",
      "docs/user-guide/README.md",
    ]),
    expectedHeading: null,
  },
  {
    id: "en-loopback-host",
    text: "why does the web host bind to loopback only",
    language: "EN",
    family: "PARAPHRASE",
    expected: Object.freeze([
      "docs/adr/0015-use-a-loopback-built-in-web-host-for-the-first-gui.md",
    ]),
    expectedHeading: null,
  },
]);

/**
 * Italian questions whose answers are in the three Italian documents of the
 * corpus. This is the case that matters for a workspace whose documents are
 * Italian: the questions above measure the language gap, these measure the
 * engine without it, with every English document left in as a distractor.
 *
 * Wording deliberately avoids the words of the target heading where the family
 * says SYNONYM or PARAPHRASE, so the question cannot be answered by repeating
 * the title.
 */
export const ITALIAN_QUERIES: readonly DocumentQuery[] = Object.freeze([
  {
    id: "it-it-dati-locali",
    text: "i miei dati restano sul mio computer",
    language: "IT",
    family: "SYNONYM",
    expected: Object.freeze(["docs/AI_WORKSPACE_DESIGN_PUBLIC_IT.md"]),
    expectedHeading: "2.1 Local-first",
  },
  {
    id: "it-it-consumo-modello",
    text: "come si riduce il consumo del modello",
    language: "IT",
    family: "PARAPHRASE",
    expected: Object.freeze(["docs/AI_WORKSPACE_DESIGN_PUBLIC_IT.md"]),
    expectedHeading: "3.3 Riduzione dei token",
  },
  {
    id: "it-it-scelte-non-sparire",
    text: "le scelte prese in chat non devono sparire",
    language: "IT",
    family: "SYNONYM",
    expected: Object.freeze(["docs/AI_WORKSPACE_DESIGN_PUBLIC_IT.md"]),
    expectedHeading: "3.4 Persistenza delle decisioni",
  },
  {
    id: "it-it-dati-sensibili",
    text: "protezione dei dati sensibili",
    language: "IT",
    family: "LITERAL",
    expected: Object.freeze(["docs/AI_WORKSPACE_DESIGN_PUBLIC_IT.md"]),
    expectedHeading: "3.5 Protezione dei dati sensibili",
  },
  {
    id: "it-it-ordine-parole",
    text: "sensibili dati protezione dei",
    language: "IT",
    family: "WORD_ORDER",
    expected: Object.freeze(["docs/AI_WORKSPACE_DESIGN_PUBLIC_IT.md"]),
    expectedHeading: "3.5 Protezione dei dati sensibili",
  },
  {
    id: "it-it-refuso",
    text: "riduzoine dei tokne",
    language: "IT",
    family: "TYPO",
    expected: Object.freeze(["docs/AI_WORKSPACE_DESIGN_PUBLIC_IT.md"]),
    expectedHeading: "3.3 Riduzione dei token",
  },
  {
    id: "it-it-inflessione",
    text: "decisione persistente durante la chat",
    language: "IT",
    family: "INFLECTION",
    expected: Object.freeze(["docs/AI_WORKSPACE_DESIGN_PUBLIC_IT.md"]),
    expectedHeading: "3.4 Persistenza delle decisioni",
  },
  {
    id: "it-it-cambio-assistente",
    text: "posso cambiare assistente senza ricominciare da capo",
    language: "IT",
    family: "PARAPHRASE",
    expected: Object.freeze([
      "docs/AI_WORKSPACE_DESIGN_PUBLIC_IT.md",
      "docs/product/EXPERIENCE_VISION_IT.md",
    ]),
    expectedHeading: null,
  },
  {
    id: "it-it-solo-programmatori",
    text: "serve solo a chi scrive programmi",
    language: "IT",
    family: "PARAPHRASE",
    expected: Object.freeze(["docs/product/EXPERIENCE_VISION_IT.md"]),
    expectedHeading: "3. Non è un prodotto per il codice",
  },
  {
    id: "it-it-chi-usa",
    text: "per chi è pensato questo prodotto",
    language: "IT",
    family: "PARAPHRASE",
    expected: Object.freeze(["docs/product/EXPERIENCE_VISION_IT.md"]),
    expectedHeading: "2. Chi apre il prodotto",
  },
  {
    id: "it-it-moduli-futuri",
    text: "quali moduli architetturali sono previsti in futuro",
    language: "IT",
    family: "SECTION_LOCALIZATION",
    expected: Object.freeze(["docs/AI_WORKSPACE_VISION_LONG_TERM_IT.md"]),
    expectedHeading: "1. Moduli architetturali aggiuntivi",
  },
  {
    id: "it-it-primo-traguardo",
    text: "qual è il primo traguardo di prodotto",
    language: "IT",
    family: "SYNONYM",
    expected: Object.freeze(["docs/AI_WORKSPACE_VISION_LONG_TERM_IT.md"]),
    expectedHeading: "MVP 1",
  },
]);

/**
 * Italian/English term pairs applied when a query term is absent from the
 * index. It keeps retrieval deterministic, offline, and explainable: a bridged
 * match says which pair produced it.
 *
 * Written after seeing which cross-language questions the lexical engine
 * missed, so its recall on those questions is optimistic by construction. The
 * honest signal is elsewhere: whether it costs precision on questions that
 * already worked, and whether it leaves the Italian-only questions untouched.
 */
export const BILINGUAL_GLOSSARY: readonly (readonly [string, string])[] =
  Object.freeze([
    ["memoria", "memory"],
    ["ricordo", "memory"],
    ["chiave", "key"],
    ["riservato", "restricted"],
    ["riservatezza", "confidentiality"],
    ["artefatto", "artifact"],
    ["credenziale", "credential"],
    ["iniezione", "injection"],
    ["prova", "evidence"],
    ["evidenza", "evidence"],
    ["decisione", "decision"],
    ["vincolo", "constraint"],
    ["progetto", "project"],
    ["ricerca", "search"],
    ["sessione", "session"],
    ["evento", "event"],
    ["archivio", "store"],
    ["indice", "index"],
    ["quadro", "dashboard"],
    ["sintesi", "summary"],
    ["cruscotto", "dashboard"],
    ["trascrizione", "transcript"],
    ["consegna", "delivery"],
    ["fornitore", "provider"],
    ["ambiente", "environment"],
    ["classificazione", "classification"],
    ["minaccia", "threat"],
    ["istruzione", "instruction"],
    ["riservati", "restricted"],
    ["passaggio", "handoff"],
    ["consegnare", "handoff"],
    ["attivita", "work item"],
    ["conversazione", "conversation"],
    ["interfaccia", "interface"],
    ["grafica", "graphical"],
    ["privatezza", "privacy"],
    ["anonimizzazione", "pseudonymization"],
    ["pseudonimo", "pseudonym"],
    ["ripristino", "restoration"],
    ["verifica", "verification"],
    ["fallimento", "failure"],
    ["errore", "error"],
    ["strumento", "tool"],
    ["registro", "log"],
    ["politica", "policy"],
    ["autorizzazione", "authorization"],
    ["confine", "boundary"],
    ["manomissione", "tampering"],
    ["origine", "provenance"],
    ["provenienza", "provenance"],
    ["contenuto", "content"],
    ["conservato", "stored"],
    ["locale", "local"],
    ["utente", "user"],
    ["percorso", "journey"],
    ["guidato", "guided"],
    ["navigare", "navigate"],
    ["importare", "ingest"],
    ["curare", "curate"],
    ["superato", "superseded"],
    ["invalidato", "invalidated"],
  ]);

const REPOSITORY_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Compares against a slash-separated form, because one excluded entry names a
 * directory below another and would otherwise stop matching wherever the path
 * separator differs.
 */
function isExcluded(path: string): boolean {
  const slashed = path.split(sep).join("/");
  return EXCLUDED_PATHS.some((excluded) => slashed.includes(excluded));
}

function collectMarkdownPaths(root: string): readonly string[] {
  const absolute = join(REPOSITORY_ROOT, root);
  if (isExcluded(absolute)) return Object.freeze([]);
  const stats = statSync(absolute, { throwIfNoEntry: false });
  if (stats === undefined) return Object.freeze([]);
  if (stats.isFile())
    return absolute.endsWith(".md")
      ? Object.freeze([relative(REPOSITORY_ROOT, absolute)])
      : Object.freeze([]);
  const found: string[] = [];
  for (const entry of readdirSync(absolute))
    found.push(...collectMarkdownPaths(join(root, entry)));
  return Object.freeze(found);
}

/** The declared corpus, sorted so every run sees the same order. */
export function collectDocuments(): readonly Readonly<{
  path: string;
  text: string;
}>[] {
  const paths = CORPUS_ROOTS.flatMap((root) => collectMarkdownPaths(root))
    .filter((path) => !isExcluded(path))
    .sort();
  if (paths.length === 0)
    throw new DocumentRetrievalMeasurementError(
      "the declared document corpus is empty",
    );
  return Object.freeze(
    paths.map((path) =>
      Object.freeze({
        path,
        text: readFileSync(join(REPOSITORY_ROOT, path), "utf8"),
      }),
    ),
  );
}

/**
 * Splits a document at Markdown headings. Fenced code blocks are skipped, so a
 * shell comment inside a fence is not mistaken for a heading. The heading chain
 * is kept because a section titled "Limitations" is meaningless without the
 * document it limits.
 */
export function splitIntoSections(
  path: string,
  text: string,
): readonly Readonly<{ headingPath: string; body: string }>[] {
  const sections: { headingPath: string; body: string[] }[] = [];
  const chain: string[] = [];
  let fenced = false;
  for (const line of text.split("\n")) {
    if (line.startsWith("```")) fenced = !fenced;
    const heading = fenced ? null : /^(#{1,6})\s+(.*\S)\s*$/u.exec(line);
    if (heading === null) {
      const current = sections.at(-1);
      if (current === undefined)
        sections.push({ headingPath: path, body: [line] });
      else current.body.push(line);
      continue;
    }
    const depth = (heading[1] ?? "").length;
    const title = heading[2] ?? "";
    chain.length = Math.max(0, depth - 1);
    chain[depth - 1] = title;
    sections.push({
      headingPath: chain.filter((part) => part !== undefined).join(" > "),
      body: [title],
    });
  }
  return Object.freeze(
    sections
      .map((section) =>
        Object.freeze({
          headingPath: section.headingPath,
          body: section.body.join("\n").trim(),
        }),
      )
      .filter((section) => section.body.length > 0),
  );
}

export function buildRecords(
  documents: readonly Readonly<{ path: string; text: string }>[],
  unit: IndexingUnit,
): readonly DocumentRecord[] {
  if (unit === "WHOLE_DOCUMENT")
    return Object.freeze(
      documents.map((document) =>
        Object.freeze({
          id: document.path,
          documentPath: document.path,
          headingPath: "",
          body: document.text,
          unit,
        }),
      ),
    );
  const records: DocumentRecord[] = [];
  for (const document of documents) {
    const sections = splitIntoSections(document.path, document.text);
    let index = 0;
    for (const section of sections) {
      const heading = section.headingPath;
      const weighted =
        unit === "SECTION_HEADING_WEIGHTED"
          ? `${`${heading}\n`.repeat(HEADING_WEIGHT)}${section.body}`
          : section.body;
      records.push(
        Object.freeze({
          id: `${document.path}#${String(index)}`,
          documentPath: document.path,
          headingPath: heading,
          body: weighted,
          unit,
        }),
      );
      index += 1;
    }
  }
  return Object.freeze(records);
}

type Posting = Readonly<{ record: number; frequency: number }>;

export type DocumentIndex = Readonly<{
  records: readonly DocumentRecord[];
  postings: ReadonlyMap<string, readonly Posting[]>;
  lengths: readonly number[];
  averageLength: number;
  terms: readonly string[];
}>;

export function buildDocumentIndex(
  records: readonly DocumentRecord[],
): DocumentIndex {
  const postings = new Map<string, Posting[]>();
  const lengths: number[] = [];
  records.forEach((record, position) => {
    const tokens = normalizeTokens(record.body).map(stem);
    lengths.push(tokens.length);
    const frequencies = new Map<string, number>();
    for (const token of tokens)
      frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    for (const [term, frequency] of frequencies) {
      const list = postings.get(term);
      if (list === undefined)
        postings.set(term, [{ record: position, frequency }]);
      else list.push({ record: position, frequency });
    }
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  return Object.freeze({
    records,
    postings,
    lengths: Object.freeze(lengths),
    averageLength: lengths.length === 0 ? 0 : total / lengths.length,
    terms: Object.freeze([...postings.keys()]),
  });
}

export type DocumentResult = Readonly<{
  id: string;
  documentPath: string;
  headingPath: string;
  score: number;
  because: string;
}>;

/**
 * Stemmed glossary, built once: query terms arrive stemmed, so the pairs must
 * be stemmed too or `memoria` would never meet the entry for `memoria`.
 */
const STEMMED_GLOSSARY: ReadonlyMap<string, readonly string[]> = new Map(
  BILINGUAL_GLOSSARY.reduce<[string, string[]][]>(
    (pairs, [italian, english]) => {
      const source = stem(normalizeTokens(italian).join(" "));
      const targets = normalizeTokens(english).map(stem);
      const existing = pairs.find(([key]) => key === source);
      if (existing === undefined) pairs.push([source, [...targets]]);
      else existing[1].push(...targets);
      return pairs;
    },
    [],
  ),
);

/**
 * Expands a query term to the indexed terms it should match: the term itself,
 * then bounded typo neighbours. Same rules as the conversation engine.
 *
 * With the glossary enabled the declared translation is added *in addition* to
 * the term, never as a fallback for a term the index does not know. The first
 * version of this function only bridged absent terms, and measured no effect at
 * all: `artefatto`, `credenziale`, and `riservato` are all present in the index,
 * because this repository does contain Italian prose, so the bridge never fired
 * even though the answer was in an English document. Presence of a term says
 * nothing about presence in the *right* document.
 */
function expandTerm(
  index: DocumentIndex,
  term: string,
  glossary: boolean,
): readonly string[] {
  const bridged = glossary
    ? (STEMMED_GLOSSARY.get(term) ?? []).filter((translated) =>
        index.postings.has(translated),
      )
    : [];
  if (index.postings.has(term)) return Object.freeze([term, ...bridged]);
  if (bridged.length > 0) return Object.freeze(bridged);
  if (term.length < 4) return Object.freeze([]);
  return Object.freeze(
    index.terms.filter((candidate) => isTypoOf(term, candidate)),
  );
}

export function retrieveDocuments(
  index: DocumentIndex,
  query: string,
  limit = RESULT_LIMIT,
  glossary = false,
): readonly DocumentResult[] {
  const queryTerms = contentTerms(query).map(stem);
  const scores = new Map<number, number>();
  const reasons = new Map<number, Set<string>>();
  for (const term of queryTerms)
    for (const matched of expandTerm(index, term, glossary)) {
      const list = index.postings.get(matched) ?? [];
      const inverseFrequency = Math.log(
        1 + (index.records.length - list.length + 0.5) / (list.length + 0.5),
      );
      for (const posting of list) {
        const length = index.lengths[posting.record] ?? 0;
        const denominator =
          posting.frequency +
          BM25_K1 *
            (1 - BM25_B + (BM25_B * length) / (index.averageLength || 1));
        const contribution =
          (inverseFrequency * (posting.frequency * (BM25_K1 + 1))) /
          (denominator || 1);
        scores.set(
          posting.record,
          (scores.get(posting.record) ?? 0) + contribution,
        );
        const reason = reasons.get(posting.record) ?? new Set<string>();
        reason.add(
          matched === term
            ? term
            : (STEMMED_GLOSSARY.get(term) ?? []).includes(matched)
              ? `${term} tradotto in ${matched}`
              : `${term}~${matched}`,
        );
        reasons.set(posting.record, reason);
      }
    }
  return Object.freeze(
    [...scores.entries()]
      .map(([position, score]) => {
        const record = index.records[position];
        if (record === undefined)
          throw new DocumentRetrievalMeasurementError(
            "scored a record that is not in the index",
          );
        return Object.freeze({
          id: record.id,
          documentPath: record.documentPath,
          headingPath: record.headingPath,
          score: Math.round(score * 1_000) / 1_000,
          because: `corrisponde ${[...(reasons.get(position) ?? [])].sort().join(", ")}`,
        });
      })
      .sort((left, right) =>
        right.score === left.score
          ? left.id.localeCompare(right.id)
          : right.score - left.score,
      )
      .slice(0, limit),
  );
}

export type Fts5Engine = Readonly<{
  retrieve: (query: string, limit?: number) => readonly DocumentResult[];
  close: () => void;
}>;

export function buildFts5DocumentEngine(
  records: readonly DocumentRecord[],
): Fts5Engine {
  const database = new DatabaseSync(":memory:");
  database.exec(
    `create virtual table sections using fts5(record_id unindexed, document_path unindexed, heading_path unindexed, body, tokenize = "unicode61 remove_diacritics 2")`,
  );
  const insert = database.prepare(
    "insert into sections (record_id, document_path, heading_path, body) values (?, ?, ?, ?)",
  );
  for (const record of records)
    insert.run(record.id, record.documentPath, record.headingPath, record.body);
  const select = database.prepare(
    "select record_id, document_path, heading_path, bm25(sections) as score from sections where sections match ? order by score, record_id limit ?",
  );
  return Object.freeze({
    retrieve: (query: string, limit = RESULT_LIMIT) => {
      const terms = contentTerms(query).filter((term) => term.length > 1);
      if (terms.length === 0) return Object.freeze([]);
      const expression = terms.map((term) => `${term}*`).join(" OR ");
      const rows = select.all(expression, limit);
      return Object.freeze(
        rows.map((row) => {
          const id = row["record_id"];
          const path = row["document_path"];
          const heading = row["heading_path"];
          const score = row["score"];
          if (
            typeof id !== "string" ||
            typeof path !== "string" ||
            typeof heading !== "string" ||
            typeof score !== "number"
          )
            throw new DocumentRetrievalMeasurementError(
              "FTS5 returned an unusable row",
            );
          return Object.freeze({
            id,
            documentPath: path,
            headingPath: heading,
            score: Math.round(-score * 1_000) / 1_000,
            because: `corrisponde ${terms.join(", ")}`,
          });
        }),
      );
    },
    close: () => {
      database.close();
    },
  });
}

export async function embed(
  texts: readonly string[],
): Promise<readonly (readonly number[])[]> {
  const response = await fetch(DENSE_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: DENSE_MODEL,
      input: texts.map((text) => text.slice(0, DENSE_CHARACTER_LIMIT)),
    }),
  });
  if (!response.ok)
    throw new DocumentRetrievalMeasurementError(
      `the embedding service answered ${String(response.status)}`,
    );
  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("embeddings" in payload) ||
    !Array.isArray(payload.embeddings)
  )
    throw new DocumentRetrievalMeasurementError(
      "the embedding service answered without embeddings",
    );
  return Object.freeze(
    payload.embeddings.map((vector: unknown) => {
      if (!Array.isArray(vector) || vector.some((v) => typeof v !== "number"))
        throw new DocumentRetrievalMeasurementError(
          "the embedding service answered a non-numeric vector",
        );
      return Object.freeze(vector as number[]);
    }),
  );
}

export function dot(left: readonly number[], right: readonly number[]): number {
  let total = 0;
  for (let position = 0; position < left.length; position += 1)
    total += (left[position] ?? 0) * (right[position] ?? 0);
  return total;
}

export function percentile(
  values: readonly number[],
  fraction: number,
): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const position = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(fraction * sorted.length) - 1),
  );
  return Math.round((sorted[position] ?? 0) * 1_000) / 1_000;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

type Retriever = (query: string) => readonly DocumentResult[];

export type EngineQuality = Readonly<{
  documentRecallPercent: number;
  precisionAtExpectedCountPercent: number;
  emptyResultQueries: number;
  worstFirstRelevantRank: number | null;
  sectionLocalizationPercent: number | null;
  perFamilyRecallPercent: Readonly<Record<DocumentFamily, number | null>>;
  perLanguageRecallPercent: Readonly<Record<QueryLanguage, number>>;
}>;

/**
 * Scores one retriever. Document recall asks whether the ranked list reaches a
 * document the person wanted. Section localization asks the harder question:
 * whether the top result lands in the section that answers, which is the only
 * useful outcome for a document of several thousand words.
 */
function scoreEngine(
  retrieve: Retriever,
  queries: readonly DocumentQuery[] = DOCUMENT_QUERIES,
): EngineQuality {
  let reached = 0;
  let empty = 0;
  let precisionTotal = 0;
  let worstRank: number | null = null;
  let localizationAsked = 0;
  let localizationHit = 0;
  const familyReached = new Map<
    DocumentFamily,
    { hit: number; asked: number }
  >();
  const languageReached = new Map<
    QueryLanguage,
    { hit: number; asked: number }
  >();
  for (const query of queries) {
    const results = retrieve(query.text);
    if (results.length === 0) empty += 1;
    const paths = results.map((result) => result.documentPath);
    const firstRelevant = paths.findIndex((path) =>
      query.expected.includes(path),
    );
    const hit = firstRelevant >= 0;
    if (hit) {
      reached += 1;
      const rank = firstRelevant + 1;
      worstRank = worstRank === null ? rank : Math.max(worstRank, rank);
    }
    const cut = paths.slice(0, query.expected.length);
    precisionTotal +=
      cut.filter((path) => query.expected.includes(path)).length /
      Math.max(1, query.expected.length);
    if (query.expectedHeading !== null) {
      localizationAsked += 1;
      const top = results.find((result) =>
        query.expected.includes(result.documentPath),
      );
      if (top?.headingPath.includes(query.expectedHeading) === true)
        localizationHit += 1;
    }
    const family = familyReached.get(query.family) ?? { hit: 0, asked: 0 };
    familyReached.set(query.family, {
      hit: family.hit + (hit ? 1 : 0),
      asked: family.asked + 1,
    });
    const language = languageReached.get(query.language) ?? {
      hit: 0,
      asked: 0,
    };
    languageReached.set(query.language, {
      hit: language.hit + (hit ? 1 : 0),
      asked: language.asked + 1,
    });
  }
  const total = queries.length;
  const families = Object.fromEntries(
    DOCUMENT_FAMILIES.map((family) => {
      const counted = familyReached.get(family);
      return [
        family,
        counted === undefined || counted.asked === 0
          ? null
          : round((counted.hit / counted.asked) * 100),
      ];
    }),
  ) as Record<DocumentFamily, number | null>;
  const languages = Object.fromEntries(
    QUERY_LANGUAGES.map((language) => {
      const counted = languageReached.get(language);
      return [
        language,
        counted === undefined || counted.asked === 0
          ? 0
          : round((counted.hit / counted.asked) * 100),
      ];
    }),
  ) as Record<QueryLanguage, number>;
  return Object.freeze({
    documentRecallPercent: round((reached / total) * 100),
    precisionAtExpectedCountPercent: round((precisionTotal / total) * 100),
    emptyResultQueries: empty,
    worstFirstRelevantRank: worstRank,
    sectionLocalizationPercent:
      localizationAsked === 0
        ? null
        : round((localizationHit / localizationAsked) * 100),
    perFamilyRecallPercent: Object.freeze(families),
    perLanguageRecallPercent: Object.freeze(languages),
  });
}

function fuseByReciprocalRank(
  lexical: readonly DocumentResult[],
  dense: readonly DocumentResult[],
  limit: number,
): readonly DocumentResult[] {
  const fused = new Map<string, { result: DocumentResult; score: number }>();
  const add = (results: readonly DocumentResult[], label: string): void => {
    results.forEach((result, position) => {
      const existing = fused.get(result.id);
      const contribution = 1 / (RRF_K + position + 1);
      if (existing === undefined)
        fused.set(result.id, {
          result: Object.freeze({
            ...result,
            because: `${result.because} (${label})`,
          }),
          score: contribution,
        });
      else
        fused.set(result.id, {
          result: Object.freeze({
            ...existing.result,
            because: `${existing.result.because} + ${label}`,
          }),
          score: existing.score + contribution,
        });
    });
  };
  add(lexical, "lessicale");
  add(dense, "denso");
  return Object.freeze(
    [...fused.values()]
      .sort((left, right) =>
        right.score === left.score
          ? left.result.id.localeCompare(right.result.id)
          : right.score - left.score,
      )
      .slice(0, limit)
      .map((entry) => Object.freeze({ ...entry.result, score: entry.score })),
  );
}

export type EngineMeasurement = Readonly<{
  engine: DocumentEngineName;
  unit: IndexingUnit;
  records: number;
  buildMilliseconds: number;
  perQueryP95Milliseconds: number;
  withinInteractiveBudget: boolean;
  availableWithoutRunningService: boolean;
  quality: EngineQuality | null;
  outcome: "MEASURED" | "SKIPPED_NO_SERVICE";
}>;

export type DocumentRetrievalReport = Readonly<{
  schemaVersion: number;
  corpusId: string;
  profile: "SMALL" | "REFERENCE";
  fingerprint: Readonly<{
    documents: number;
    sections: number;
    words: number;
    longestDocumentWords: number;
    italianDocuments: number;
    distinctSectionTerms: number;
  }>;
  counts: Readonly<{
    queries: number;
    italianQueries: number;
    englishQueries: number;
    expectedPairs: number;
    localizationQueries: number;
    sameLanguageItalianQueries: number;
  }>;
  engines: readonly EngineMeasurement[];
  unitComparison: Readonly<{
    bestUnit: IndexingUnit;
    wholeDocumentRecallPercent: number;
    sectionRecallPercent: number;
    wholeDocumentLocalizationPercent: number | null;
    sectionLocalizationPercent: number | null;
    conclusion: string;
  }>;
  languageGap: Readonly<{
    lexicalItalianRecallPercent: number;
    lexicalEnglishRecallPercent: number;
    denseItalianRecallPercent: number | null;
    denseEnglishRecallPercent: number | null;
    conclusion: string;
  }>;
  /**
   * The case of a workspace whose documents are in the language of the person
   * asking. Measured on the three Italian documents of the corpus, with every
   * English document still present as a distractor.
   */
  sameLanguageItalian: Readonly<{
    queries: number;
    targetDocuments: number;
    lexical: EngineQuality;
    dense: EngineQuality | null;
    conclusion:
      | "ITALIAN_SAME_LANGUAGE_LEXICAL_SUFFICIENT"
      | "ITALIAN_SAME_LANGUAGE_LEXICAL_INSUFFICIENT";
  }>;
  /** Effect of the bilingual glossary on the cross-language questions. */
  glossary: Readonly<{
    pairs: number;
    crossLanguageRecallBeforePercent: number;
    crossLanguageRecallAfterPercent: number;
    precisionBeforePercent: number;
    precisionAfterPercent: number;
    stillUnresolved: readonly string[];
    italianOnlyRecallUnchanged: boolean;
    conclusion: string;
  }>;
  dense: Readonly<{
    mode: DenseMode;
    outcome: "MEASURED" | "SKIPPED_BY_PROFILE" | "SERVICE_UNAVAILABLE";
    model: string;
    dimensions: number | null;
    sectionsEmbedded: number | null;
    sectionsSkippedTooShort: number | null;
    buildSeconds: number | null;
    /** Typical cost of embedding one query. */
    queryEmbeddingMedianMilliseconds: number | null;
    /**
     * With 18 questions, the 95th percentile is the second-slowest call, so it
     * reports the worst case rather than the typical one. Both are kept.
     */
    queryEmbeddingP95Milliseconds: number | null;
    queryEmbeddingMaxMilliseconds: number | null;
    queryEmbeddingWithinInteractiveBudget: boolean | null;
    truncatedSections: number | null;
    characterLimit: number;
  }>;
  recommendation: Readonly<{
    indexingUnit: IndexingUnit;
    primaryEngine: DocumentEngineName;
    secondaryEngine: DocumentEngineName | null;
    denseOnCriticalPath: boolean;
    unresolvedByLexical: readonly string[];
  }>;
  limits: readonly string[];
  effect: "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER";
}>;

function countWords(text: string): number {
  return text.split(/\s+/u).filter((word) => word.length > 0).length;
}

function looksItalian(text: string): boolean {
  return /\b(della|perch[ée]|senza|quando|nostro|questa)\b/iu.test(text);
}

export async function measureDocumentRetrieval(
  profile: "SMALL" | "REFERENCE" = "REFERENCE",
  denseMode: DenseMode = "IF_AVAILABLE",
): Promise<DocumentRetrievalReport> {
  const documents = collectDocuments();
  const wholeRecords = buildRecords(documents, "WHOLE_DOCUMENT");
  const sectionRecords = buildRecords(documents, "SECTION");
  const weightedRecords = buildRecords(documents, "SECTION_HEADING_WEIGHTED");

  const engines: EngineMeasurement[] = [];
  const measureLexical = (
    engine: DocumentEngineName,
    unit: IndexingUnit,
    records: readonly DocumentRecord[],
    glossary = false,
  ): EngineMeasurement => {
    const buildStart = performance.now();
    const index = buildDocumentIndex(records);
    const buildMilliseconds =
      Math.round((performance.now() - buildStart) * 1_000) / 1_000;
    const durations: number[] = [];
    for (const query of DOCUMENT_QUERIES) {
      const start = performance.now();
      retrieveDocuments(index, query.text, RESULT_LIMIT, glossary);
      durations.push(performance.now() - start);
    }
    const p95 = percentile(durations, 0.95);
    return Object.freeze({
      engine,
      unit,
      records: records.length,
      buildMilliseconds,
      perQueryP95Milliseconds: p95,
      withinInteractiveBudget: p95 <= INTERACTIVE_BUDGET_MILLISECONDS,
      availableWithoutRunningService: true,
      quality: scoreEngine((text) =>
        retrieveDocuments(index, text, RESULT_LIMIT, glossary),
      ),
      outcome: "MEASURED",
    });
  };

  engines.push(
    measureLexical("INVERTED_WHOLE_DOCUMENT", "WHOLE_DOCUMENT", wholeRecords),
    measureLexical("INVERTED_SECTION", "SECTION", sectionRecords),
    measureLexical(
      "INVERTED_SECTION_HEADING_WEIGHTED",
      "SECTION_HEADING_WEIGHTED",
      weightedRecords,
    ),
    measureLexical(
      "INVERTED_SECTION_GLOSSARY",
      "SECTION_HEADING_WEIGHTED",
      weightedRecords,
      true,
    ),
  );

  const fts5Start = performance.now();
  const fts5 = buildFts5DocumentEngine(sectionRecords);
  const fts5Build = Math.round((performance.now() - fts5Start) * 1_000) / 1_000;
  try {
    const durations: number[] = [];
    for (const query of DOCUMENT_QUERIES) {
      const start = performance.now();
      fts5.retrieve(query.text);
      durations.push(performance.now() - start);
    }
    const p95 = percentile(durations, 0.95);
    engines.push(
      Object.freeze({
        engine: "FTS5_SECTION_UNICODE61",
        unit: "SECTION",
        records: sectionRecords.length,
        buildMilliseconds: fts5Build,
        perQueryP95Milliseconds: p95,
        withinInteractiveBudget: p95 <= INTERACTIVE_BUDGET_MILLISECONDS,
        availableWithoutRunningService: true,
        quality: scoreEngine((text) => fts5.retrieve(text)),
        outcome: "MEASURED",
      }),
    );
  } finally {
    fts5.close();
  }

  const sectionIndex = buildDocumentIndex(sectionRecords);
  /** Kept outside the dense block so the Italian-only section can reuse it. */
  let denseResults: ReadonlyMap<string, readonly DocumentResult[]> | null =
    null;
  let dense: DocumentRetrievalReport["dense"] = Object.freeze({
    mode: denseMode,
    outcome: "SKIPPED_BY_PROFILE",
    model: DENSE_MODEL,
    dimensions: null,
    sectionsEmbedded: null,
    sectionsSkippedTooShort: null,
    buildSeconds: null,
    queryEmbeddingMedianMilliseconds: null,
    queryEmbeddingP95Milliseconds: null,
    queryEmbeddingMaxMilliseconds: null,
    queryEmbeddingWithinInteractiveBudget: null,
    truncatedSections: null,
    characterLimit: DENSE_CHARACTER_LIMIT,
  });

  if (denseMode !== "SKIP" && profile === "REFERENCE") {
    try {
      await embed(["riscaldamento del modello"]);
      const embeddable = sectionRecords.filter(
        (record) => countWords(record.body) >= 8,
      );
      const truncated = embeddable.filter(
        (record) => record.body.length > DENSE_CHARACTER_LIMIT,
      ).length;
      const buildStart = performance.now();
      const vectors: number[][] = [];
      const batch = 64;
      for (let start = 0; start < embeddable.length; start += batch) {
        const slice = embeddable.slice(start, start + batch);
        const embedded = await embed(
          slice.map((record) => `${record.headingPath}\n${record.body}`),
        );
        for (const vector of embedded) vectors.push([...vector]);
      }
      const buildSeconds =
        Math.round(((performance.now() - buildStart) / 1_000) * 100) / 100;
      const queryDurations: number[] = [];
      const denseRetrieve = async (
        text: string,
      ): Promise<readonly DocumentResult[]> => {
        const start = performance.now();
        const [queryVector] = await embed([text]);
        queryDurations.push(performance.now() - start);
        if (queryVector === undefined)
          throw new DocumentRetrievalMeasurementError(
            "the embedding service answered no query vector",
          );
        return Object.freeze(
          embeddable
            .map((record, position) => {
              const vector = vectors[position];
              return Object.freeze({
                id: record.id,
                documentPath: record.documentPath,
                headingPath: record.headingPath,
                score:
                  vector === undefined
                    ? 0
                    : Math.round(dot(queryVector, vector) * 10_000) / 10_000,
                because: "vicinanza semantica",
              });
            })
            .sort((left, right) =>
              right.score === left.score
                ? left.id.localeCompare(right.id)
                : right.score - left.score,
            )
            .slice(0, RESULT_LIMIT),
        );
      };
      const denseByQuery = new Map<string, readonly DocumentResult[]>();
      for (const query of [...DOCUMENT_QUERIES, ...ITALIAN_QUERIES])
        denseByQuery.set(query.text, await denseRetrieve(query.text));
      denseResults = denseByQuery;
      const denseQuality = scoreEngine(
        (text) => denseByQuery.get(text) ?? Object.freeze([]),
      );
      const hybridQuality = scoreEngine((text) =>
        fuseByReciprocalRank(
          retrieveDocuments(sectionIndex, text),
          denseByQuery.get(text) ?? Object.freeze([]),
          RESULT_LIMIT,
        ),
      );
      const queryP95 = percentile(queryDurations, 0.95);
      engines.push(
        Object.freeze({
          engine: "DENSE_SECTION",
          unit: "SECTION",
          records: embeddable.length,
          buildMilliseconds: Math.round(buildSeconds * 1_000),
          perQueryP95Milliseconds: queryP95,
          withinInteractiveBudget: queryP95 <= INTERACTIVE_BUDGET_MILLISECONDS,
          availableWithoutRunningService: false,
          quality: denseQuality,
          outcome: "MEASURED",
        }),
        Object.freeze({
          engine: "HYBRID_SECTION",
          unit: "SECTION",
          records: embeddable.length,
          buildMilliseconds: Math.round(buildSeconds * 1_000),
          perQueryP95Milliseconds: queryP95,
          withinInteractiveBudget: queryP95 <= INTERACTIVE_BUDGET_MILLISECONDS,
          availableWithoutRunningService: false,
          quality: hybridQuality,
          outcome: "MEASURED",
        }),
      );
      const median = percentile(queryDurations, 0.5);
      dense = Object.freeze({
        mode: denseMode,
        outcome: "MEASURED",
        model: DENSE_MODEL,
        dimensions: vectors[0]?.length ?? null,
        sectionsEmbedded: embeddable.length,
        sectionsSkippedTooShort: sectionRecords.length - embeddable.length,
        buildSeconds,
        queryEmbeddingMedianMilliseconds: median,
        queryEmbeddingP95Milliseconds: queryP95,
        queryEmbeddingMaxMilliseconds: percentile(queryDurations, 1),
        queryEmbeddingWithinInteractiveBudget:
          median <= INTERACTIVE_BUDGET_MILLISECONDS,
        truncatedSections: truncated,
        characterLimit: DENSE_CHARACTER_LIMIT,
      });
    } catch (error) {
      if (denseMode === "REQUIRE") throw error;
      dense = Object.freeze({
        ...dense,
        outcome: "SERVICE_UNAVAILABLE",
      });
    }
  }

  const byName = (name: DocumentEngineName): EngineMeasurement | undefined =>
    engines.find((engine) => engine.engine === name);
  const whole = byName("INVERTED_WHOLE_DOCUMENT");
  const section = byName("INVERTED_SECTION");
  const weighted = byName("INVERTED_SECTION_HEADING_WEIGHTED");
  const denseEngine = byName("DENSE_SECTION");
  if (whole?.quality === undefined || section?.quality === undefined)
    throw new DocumentRetrievalMeasurementError(
      "the lexical engines did not produce quality figures",
    );
  const wholeQuality = whole.quality;
  const sectionQuality = section.quality;
  if (wholeQuality === null || sectionQuality === null)
    throw new DocumentRetrievalMeasurementError(
      "the lexical engines did not produce quality figures",
    );

  const candidates = engines.filter(
    (engine) =>
      engine.availableWithoutRunningService && engine.quality !== null,
  );
  const best = candidates.reduce((left, right) => {
    const leftQuality = left.quality;
    const rightQuality = right.quality;
    if (leftQuality === null) return right;
    if (rightQuality === null) return left;
    if (
      rightQuality.documentRecallPercent !== leftQuality.documentRecallPercent
    )
      return rightQuality.documentRecallPercent >
        leftQuality.documentRecallPercent
        ? right
        : left;
    return (rightQuality.sectionLocalizationPercent ?? 0) >
      (leftQuality.sectionLocalizationPercent ?? 0)
      ? right
      : left;
  });

  /**
   * Unresolved is measured against the engine actually recommended, glossary
   * included. Reporting the misses of a weaker engine than the one recommended
   * would overstate what is left for the dense path to do.
   */
  const weightedIndex = buildDocumentIndex(weightedRecords);
  const bestIndex =
    best.unit === "WHOLE_DOCUMENT"
      ? buildDocumentIndex(wholeRecords)
      : best.unit === "SECTION"
        ? sectionIndex
        : weightedIndex;
  const bestUsesGlossary = best.engine === "INVERTED_SECTION_GLOSSARY";
  const unresolved = DOCUMENT_QUERIES.filter(
    (query) =>
      !retrieveDocuments(
        bestIndex,
        query.text,
        RESULT_LIMIT,
        bestUsesGlossary,
      ).some((result) => query.expected.includes(result.documentPath)),
  ).map((query) => query.id);

  const sections = sectionRecords.length;
  const words = documents.reduce(
    (sum, document) => sum + countWords(document.text),
    0,
  );

  const italianLexical = scoreEngine(
    (text) => retrieveDocuments(weightedIndex, text),
    ITALIAN_QUERIES,
  );
  const italianWithGlossary = scoreEngine(
    (text) => retrieveDocuments(weightedIndex, text, RESULT_LIMIT, true),
    ITALIAN_QUERIES,
  );
  const denseMap = denseResults;
  const italianDense =
    denseMap === null
      ? null
      : scoreEngine(
          (text) => denseMap.get(text) ?? Object.freeze([]),
          ITALIAN_QUERIES,
        );

  const crossLanguageQueries = DOCUMENT_QUERIES.filter(
    (query) => query.language === "IT",
  );
  const crossBefore = scoreEngine(
    (text) => retrieveDocuments(weightedIndex, text),
    crossLanguageQueries,
  );
  const crossAfter = scoreEngine(
    (text) => retrieveDocuments(weightedIndex, text, RESULT_LIMIT, true),
    crossLanguageQueries,
  );
  const stillUnresolved = crossLanguageQueries
    .filter(
      (query) =>
        !retrieveDocuments(weightedIndex, query.text, RESULT_LIMIT, true).some(
          (result) => query.expected.includes(result.documentPath),
        ),
    )
    .map((query) => query.id);

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    corpusId: DOCUMENT_CORPUS_ID,
    profile,
    fingerprint: Object.freeze({
      documents: documents.length,
      sections,
      words,
      longestDocumentWords: documents.reduce(
        (longest, document) => Math.max(longest, countWords(document.text)),
        0,
      ),
      italianDocuments: documents.filter((document) =>
        looksItalian(document.text),
      ).length,
      distinctSectionTerms: sectionIndex.terms.length,
    }),
    counts: Object.freeze({
      queries: DOCUMENT_QUERIES.length,
      italianQueries: DOCUMENT_QUERIES.filter(
        (query) => query.language === "IT",
      ).length,
      englishQueries: DOCUMENT_QUERIES.filter(
        (query) => query.language === "EN",
      ).length,
      expectedPairs: DOCUMENT_QUERIES.reduce(
        (sum, query) => sum + query.expected.length,
        0,
      ),
      localizationQueries: DOCUMENT_QUERIES.filter(
        (query) => query.expectedHeading !== null,
      ).length,
      sameLanguageItalianQueries: ITALIAN_QUERIES.length,
    }),
    engines: Object.freeze(engines),
    unitComparison: Object.freeze({
      bestUnit: best.unit,
      wholeDocumentRecallPercent: wholeQuality.documentRecallPercent,
      sectionRecallPercent: sectionQuality.documentRecallPercent,
      wholeDocumentLocalizationPercent: wholeQuality.sectionLocalizationPercent,
      sectionLocalizationPercent: sectionQuality.sectionLocalizationPercent,
      conclusion:
        sectionQuality.documentRecallPercent >
          wholeQuality.documentRecallPercent ||
        (sectionQuality.sectionLocalizationPercent ?? 0) >
          (wholeQuality.sectionLocalizationPercent ?? 0)
          ? "SECTION_LEVEL_INDEXING_REQUIRED"
          : "WHOLE_DOCUMENT_INDEXING_SUFFICIENT",
    }),
    languageGap: Object.freeze({
      lexicalItalianRecallPercent: (weighted?.quality ?? sectionQuality)
        .perLanguageRecallPercent.IT,
      lexicalEnglishRecallPercent: (weighted?.quality ?? sectionQuality)
        .perLanguageRecallPercent.EN,
      denseItalianRecallPercent:
        denseEngine?.quality?.perLanguageRecallPercent.IT ?? null,
      denseEnglishRecallPercent:
        denseEngine?.quality?.perLanguageRecallPercent.EN ?? null,
      conclusion:
        (weighted?.quality ?? sectionQuality).perLanguageRecallPercent.IT <
        (weighted?.quality ?? sectionQuality).perLanguageRecallPercent.EN
          ? "LEXICAL_RETRIEVAL_IS_LANGUAGE_BOUND"
          : "LEXICAL_RETRIEVAL_CROSSES_LANGUAGES",
    }),
    sameLanguageItalian: Object.freeze({
      queries: ITALIAN_QUERIES.length,
      targetDocuments: new Set(
        ITALIAN_QUERIES.flatMap((query) => query.expected),
      ).size,
      lexical: italianLexical,
      dense: italianDense,
      conclusion:
        italianLexical.documentRecallPercent >=
        (italianDense?.documentRecallPercent ??
          italianLexical.documentRecallPercent)
          ? "ITALIAN_SAME_LANGUAGE_LEXICAL_SUFFICIENT"
          : "ITALIAN_SAME_LANGUAGE_LEXICAL_INSUFFICIENT",
    }),
    glossary: Object.freeze({
      pairs: BILINGUAL_GLOSSARY.length,
      crossLanguageRecallBeforePercent: crossBefore.documentRecallPercent,
      crossLanguageRecallAfterPercent: crossAfter.documentRecallPercent,
      precisionBeforePercent: crossBefore.precisionAtExpectedCountPercent,
      precisionAfterPercent: crossAfter.precisionAtExpectedCountPercent,
      stillUnresolved: Object.freeze(stillUnresolved),
      italianOnlyRecallUnchanged:
        italianWithGlossary.documentRecallPercent ===
        italianLexical.documentRecallPercent,
      conclusion:
        crossAfter.documentRecallPercent > crossBefore.documentRecallPercent
          ? "GLOSSARY_RAISES_CROSS_LANGUAGE_RECALL"
          : "GLOSSARY_DOES_NOT_RAISE_CROSS_LANGUAGE_RECALL",
    }),
    dense,
    recommendation: Object.freeze({
      indexingUnit: best.unit,
      primaryEngine: best.engine,
      secondaryEngine:
        denseEngine?.outcome === "MEASURED" ? "HYBRID_SECTION" : null,
      denseOnCriticalPath: false,
      unresolvedByLexical: Object.freeze(unresolved),
    }),
    limits: Object.freeze([
      "GROUND_TRUTH_PREDECLARED_BY_READING_NOT_BY_QUERYING",
      "CORPUS_GROWS_WITH_THE_REPOSITORY_SO_FIGURES_ARE_STATE_DEPENDENT",
      "DENSE_SECTIONS_TRUNCATED_AT_THE_DECLARED_CHARACTER_LIMIT",
      "WHOLE_DOCUMENT_UNIT_CANNOT_LOCALIZE_A_SECTION_BY_CONSTRUCTION",
      "P95_OVER_EIGHTEEN_QUERIES_IS_THE_WORST_CASE_NOT_THE_TYPICAL",
      "ONLY_THREE_CORPUS_DOCUMENTS_ARE_ITALIAN_SO_SAME_LANGUAGE_ITALIAN_RETRIEVAL_IS_BARELY_PROBED",
      "GLOSSARY_WAS_WRITTEN_AFTER_SEEING_THE_UNRESOLVED_QUERIES_SO_ITS_CROSS_LANGUAGE_RECALL_IS_OPTIMISTIC",
      "GLOSSARY_IS_HAND_WRITTEN_AND_DOES_NOT_SCALE_TO_AN_UNSEEN_VOCABULARY",
      "NO_CODE_RECORDS_MEASURED_HERE",
    ]),
    effect: "DEVELOPMENT_ONLY_NO_PRODUCTION_CONSUMER",
  });
}

/** Strips timing so two runs can be compared for equality in a test. */
export function withoutElapsed(report: DocumentRetrievalReport): unknown {
  return {
    ...report,
    engines: report.engines.map((engine) => ({
      engine: engine.engine,
      unit: engine.unit,
      records: engine.records,
      withinInteractiveBudget: engine.withinInteractiveBudget,
      availableWithoutRunningService: engine.availableWithoutRunningService,
      quality: engine.quality,
      outcome: engine.outcome,
    })),
    dense: {
      ...report.dense,
      buildSeconds: null,
      queryEmbeddingP95Milliseconds: null,
      queryEmbeddingWithinInteractiveBudget: null,
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await measureDocumentRetrieval(), null, 2));

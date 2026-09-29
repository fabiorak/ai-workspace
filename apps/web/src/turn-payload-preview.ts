/**
 * Turns the exact protected payload into something a person can read before it
 * leaves the machine.
 *
 * The preview that existed before this module showed the draft alone, which
 * answered "does the message I am typing contain recognised data?" and not "what
 * is about to leave?". The two are far apart: the composed payload also carries
 * the kept handoff, up to 128 earlier readings and the active memory of linked
 * projects. A person cannot decide what to protect from material they never see.
 *
 * Nothing here composes, protects or sends: it receives the already-protected
 * text, the same bytes the turn would deliver, and only groups it. Grouping is a
 * reading aid, so it never changes, reorders or omits payload content.
 */

/** Which composition produced the payload. The two paths serialize differently,
 * and saying which one a person is reading is part of reading it honestly. */
export type TurnPayloadShape = "HANDOFF_CONTEXT" | "REDUCED_CONTEXT";

export type TurnPayloadSectionKey =
  | "PAYLOAD_PREAMBLE"
  | "PAYLOAD_SECTION"
  | "REDUCED_ENVELOPE"
  | "REDUCED_READINGS"
  | "REDUCED_MEMORY"
  | "REDUCED_QUESTION";

export type TurnPayloadSection = Readonly<{
  key: TurnPayloadSectionKey;
  /**
   * The heading the payload itself carries, when it has one: in the handoff
   * shape those words are sent, so they are shown rather than translated. A null
   * title means the grouping is ours, and the browser names it in the reader's
   * own language from the key.
   */
  title: string | null;
  text: string;
  /** How many items this section groups, when it groups items. */
  count: number | null;
}>;

export type TurnPayloadProjection = Readonly<{
  shape: TurnPayloadShape;
  sections: readonly TurnPayloadSection[];
}>;

const SECTION_SEPARATOR = "\n\n## ";

export function projectTurnPayload(
  protectedText: string,
): TurnPayloadProjection {
  const reduced = reducedEnvelope(protectedText);
  return reduced === null
    ? Object.freeze({
        shape: "HANDOFF_CONTEXT" as const,
        sections: handoffSections(protectedText),
      })
    : Object.freeze({
        shape: "REDUCED_CONTEXT" as const,
        sections: reducedSections(reduced),
      });
}

/**
 * The reduced path serializes one JSON envelope, which is unreadable as a single
 * line exactly when a person most needs to read it. Pseudonyms are plain text
 * inside the string values, so the protected payload is still the same JSON and
 * can be reopened without touching what it contains.
 */
function reducedEnvelope(
  protectedText: string,
): Record<string, unknown> | null {
  let value: unknown;
  try {
    value = JSON.parse(protectedText);
  } catch {
    return null;
  }
  return record(value) &&
    value.effect === "BOUNDED_REDUCED_CONVERSATION_CONTEXT" &&
    Array.isArray(value.readings) &&
    Array.isArray(value.linkedProjectMemory) &&
    typeof value.userText === "string"
    ? value
    : null;
}

function handoffSections(protectedText: string): readonly TurnPayloadSection[] {
  const [preamble, ...rest] = protectedText.split(SECTION_SEPARATOR);
  const sections: TurnPayloadSection[] = [];
  if (preamble !== undefined && preamble.trim())
    sections.push(
      section({ key: "PAYLOAD_PREAMBLE", title: null, text: preamble }),
    );
  for (const chunk of rest) {
    const divider = chunk.indexOf("\n\n");
    sections.push(
      section({
        key: "PAYLOAD_SECTION",
        title: divider < 0 ? chunk : chunk.slice(0, divider),
        text: divider < 0 ? "" : chunk.slice(divider + 2),
      }),
    );
  }
  return Object.freeze(
    sections.length > 0
      ? sections
      : [
          section({
            key: "PAYLOAD_PREAMBLE",
            title: null,
            text: protectedText,
          }),
        ],
  );
}

function reducedSections(
  envelope: Record<string, unknown>,
): readonly TurnPayloadSection[] {
  const readings = list(envelope.readings);
  const memory = list(envelope.linkedProjectMemory);
  const metadata = Object.fromEntries(
    Object.entries(envelope).filter(
      ([key]) => !["readings", "linkedProjectMemory", "userText"].includes(key),
    ),
  );
  const sections: TurnPayloadSection[] = [
    section({
      key: "REDUCED_ENVELOPE",
      title: null,
      text: JSON.stringify(metadata, null, 2),
    }),
  ];
  if (readings.length > 0)
    sections.push(
      section({
        key: "REDUCED_READINGS",
        title: null,
        count: readings.length,
        text: readings
          .map((reading) =>
            record(reading) ? JSON.stringify(reading, null, 2) : line(reading),
          )
          .join("\n\n"),
      }),
    );
  if (memory.length > 0)
    sections.push(
      section({
        key: "REDUCED_MEMORY",
        title: null,
        count: memory.length,
        text: memory
          .map((item) =>
            record(item) ? JSON.stringify(item, null, 2) : line(item),
          )
          .join("\n\n"),
      }),
    );
  sections.push(
    section({
      key: "REDUCED_QUESTION",
      title: null,
      text: text(envelope.userText),
    }),
  );
  return Object.freeze(sections);
}

function section(
  input: Readonly<{
    key: TurnPayloadSectionKey;
    title: string | null;
    text: string;
    count?: number;
  }>,
): TurnPayloadSection {
  return Object.freeze({
    key: input.key,
    title: input.title,
    text: input.text,
    count: input.count ?? null,
  });
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const list = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : [];
const text = (value: unknown): string =>
  typeof value === "string" ? value : "";
const line = (value: unknown): string =>
  typeof value === "string" ? value : JSON.stringify(value);

/**
 * How a text module becomes a catalogue.
 *
 * ADR-0035 splits user-facing text per area with both languages beside each key.
 * Keeping the pair together is the point: a sentence and its translation change
 * for the same reason, and holding them a thousand lines apart is how one of them
 * gets forgotten. This module transposes that shape into the per-locale
 * catalogues the client already consumes, so the split costs nothing downstream.
 */
import { SUPPORTED_LOCALES, type GuiLocale } from "../localization.ts";

/** One entry per key: every supported language, side by side. */
export type TextEntries = Readonly<
  Record<string, Readonly<Record<GuiLocale, string>>>
>;
export type Catalogues = Readonly<
  Record<GuiLocale, Readonly<Record<string, string>>>
>;

export function catalogues(entries: TextEntries): Catalogues {
  return Object.freeze(
    Object.fromEntries(
      SUPPORTED_LOCALES.map((locale) => [
        locale,
        Object.freeze(
          Object.fromEntries(
            Object.entries(entries).map(([key, value]) => [key, value[locale]]),
          ),
        ),
      ]),
    ),
  ) as Catalogues;
}

/**
 * Merges area catalogues onto the shared one.
 *
 * A duplicate key is a mistake, not a preference: two areas claiming one name
 * would make the winning sentence depend on merge order. Rather than resolve that
 * silently, the merge refuses.
 */
export function mergeCatalogues(
  base: Catalogues,
  ...areas: readonly Catalogues[]
): Catalogues {
  const merged = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, { ...base[locale] }]),
  ) as Record<GuiLocale, Record<string, string>>;
  for (const area of areas)
    for (const locale of SUPPORTED_LOCALES)
      for (const [key, value] of Object.entries(area[locale])) {
        if (Object.hasOwn(merged[locale], key))
          throw new Error(
            `Two text areas both define '${key}'. Rename one: which sentence wins must not depend on merge order.`,
          );
        merged[locale][key] = value;
      }
  return Object.freeze(
    Object.fromEntries(
      SUPPORTED_LOCALES.map((locale) => [
        locale,
        Object.freeze(merged[locale]),
      ]),
    ),
  ) as Catalogues;
}

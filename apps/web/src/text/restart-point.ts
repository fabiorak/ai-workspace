/**
 * Every sentence the restart point says, in both languages.
 *
 * Three rules shaped this vocabulary. It speaks of work, notes and moments, never
 * of packets, sections, digests or byte counts: those exist, and they stay on the
 * technical surface. It says out loud that composing saved nothing, because a
 * summary that appears by itself invites the question of where it went. And an
 * empty part says it is empty rather than disappearing — a reader deciding whether
 * this would be enough to pick the work up again has to see what is missing.
 */
import { catalogues } from "./catalog.ts";

export const RESTART_POINT_TEXT = Object.freeze({
  pointHeading: {
    en: "To pick this up again",
    it: "Per riprendere questo lavoro",
  },
  pointHelp: {
    en: "Composed just now from what is already stored here. It is not saved, and it does not leave this computer.",
    it: "Composto adesso da ciò che è già conservato qui. Non viene salvato e non lascia questo computer.",
  },
  pointComposing: { en: "Composing…", it: "Sto componendo…" },
  pointComposed: { en: "Composed at {when}.", it: "Composto alle {when}." },
  pointFailed: {
    en: "This could not be composed.",
    it: "Non è stato possibile comporre questo riepilogo.",
  },
  pointDoing: { en: "What you are doing", it: "Che cosa stai facendo" },
  pointDecisions: { en: "What was decided", it: "Che cosa è stato deciso" },
  pointConstraints: {
    en: "What has to hold",
    it: "Che cosa va rispettato",
  },
  pointFailures: {
    en: "What already went wrong",
    it: "Che cosa è già andato storto",
  },
  pointLookedAt: { en: "Where you were", it: "Dove eri arrivato" },
  pointRepository: {
    en: "How the repository stands",
    it: "Come sta il repository",
  },
  pointNoDecisions: {
    en: "Nothing is written down as decided.",
    it: "Non c'è niente annotato come deciso.",
  },
  pointNoConstraints: {
    en: "Nothing is written down as having to hold.",
    it: "Non c'è niente annotato come vincolo da rispettare.",
  },
  pointNoFailures: {
    en: "Nothing is written down as having gone wrong.",
    it: "Non c'è niente annotato come già andato storto.",
  },
  /** A note the person confirmed against evidence, said as a word rather than a state. */
  pointNoteVerified: { en: "confirmed", it: "confermata" },
  pointNoteUnverified: {
    en: "not confirmed yet",
    it: "ancora da confermare",
  },
  pointOnBranch: { en: "On branch {branch}", it: "Sul ramo {branch}" },
  pointNoBranch: {
    en: "The branch could not be read.",
    it: "Non è stato possibile leggere il ramo.",
  },
  pointRepositoryClean: {
    en: "nothing left unsaved",
    it: "nessuna modifica in sospeso",
  },
  pointRepositoryChanged: {
    en: "{count} files with unsaved changes",
    it: "{count} file con modifiche non salvate",
  },
  pointRepositoryOneChanged: {
    en: "one file with unsaved changes",
    it: "un file con modifiche non salvate",
  },
  pointOmittedNotes: {
    en: "{count} further notes are not included here.",
    it: "Altre {count} annotazioni non sono comprese qui.",
  },
  pointOmittedMoments: {
    en: "{count} earlier moments are not listed here; they are in the conversation above.",
    it: "{count} momenti precedenti non sono elencati qui: stanno nella conversazione qui sopra.",
  },
  /**
   * Why there is nothing to compose. Each of these says what is missing instead of
   * choosing a work item on the reader's behalf, which is the whole reason they are
   * separate sentences.
   */
  pointNotWork: {
    en: "These are notes, so there is no work to pick up here.",
    it: "Questi sono appunti: non c'è un lavoro da riprendere.",
  },
  pointNoWork: {
    en: "This conversation is not linked to any work, so there is no objective to carry over.",
    it: "Questa conversazione non è collegata a nessun lavoro, quindi non c'è un obiettivo da riportare.",
  },
  pointNothingImported: {
    en: "No moment of this conversation has arrived yet.",
    it: "Di questa conversazione non è ancora arrivato nessun momento.",
  },
});

export const RESTART_POINT_CATALOGUES = catalogues(RESTART_POINT_TEXT);

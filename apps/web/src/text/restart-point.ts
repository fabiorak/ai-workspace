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
  pointTests: { en: "How the tests stand", it: "Come stanno le prove" },
  /**
   * Said when the packet records no run at all. It states the absence instead of
   * leaving the part out, because a reader who sees nothing about the tests would
   * otherwise be free to assume they pass — which is the assumption that costs most.
   */
  pointNoTests: {
    en: "No test run is recorded here, so nothing says whether this works.",
    it: "Non è registrata nessuna esecuzione delle prove: niente dice se questo funziona.",
  },
  /**
   * Said instead of the sentence above when a kept summary does record a run. The
   * absence is still stated — this summary records nothing — but the second half of
   * the sentence above would be untrue, because the line beside it does say
   * something about whether this works.
   */
  pointNoTestsYet: {
    en: "Nothing about the tests is recorded in this summary yet.",
    it: "In questo riepilogo non è ancora registrata nessuna esecuzione delle prove.",
  },
  /**
   * The run stated the last time a summary was kept, quoted beside its own date.
   *
   * It is a fact of that day, said by the person, and it is the first thing somebody
   * resuming wants to know. Quoting it is not carrying it over: the outcome field is
   * never prefilled with it, because a value already chosen would be confirmed by
   * inertia and become a claim about today that nobody made.
   */
  pointTestsKept: {
    en: "You stated this when you kept the summary of {when}",
    it: "L'hai dichiarato quando hai conservato il riepilogo del {when}",
  },
  /**
   * Said beside the most recent moment that reported an outcome. Every imported
   * event is untrusted by construction, so the line is what was written in the
   * conversation and not something anybody observed: a reader deciding whether to
   * lean on it has to be told which of the two it is, exactly as with a note that
   * was never confirmed.
   */
  pointTestsSaid: {
    en: "Said in the conversation, not a recorded run",
    it: "Detto nella conversazione, non un'esecuzione registrata",
  },
  /** An outcome as a word. The stored constant never reaches a reader. */
  pointTestPassed: { en: "passed", it: "passate" },
  pointTestFailed: { en: "failed", it: "fallite" },
  pointTestNotRun: { en: "not run", it: "non eseguite" },
  pointTestObservedAt: {
    en: "recorded at {when}",
    it: "registrata alle {when}",
  },
  pointTestNotObserved: {
    en: "no time recorded",
    it: "nessun orario registrato",
  },
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
  pointNextAction: { en: "What to do next", it: "Che cosa fare adesso" },
  /**
   * Beside the field, not after it. ADR-0037 prefills the draft from local text and
   * asks that the obligation to review it stay visible; a reader who meets the
   * sentence before the text is less likely to take the text for a decision.
   */
  pointDraftReview: {
    en: "A draft, put together from what you already wrote. Read it and change it as you like: nothing is saved.",
    it: "Una bozza, messa insieme da ciò che hai già scritto. Leggila e cambiala come vuoi: non viene salvato niente.",
  },
  /** Where each part of the draft came from, so it reads as quotation and not as advice. */
  pointDraftFromObjective: {
    en: "from the objective of this work",
    it: "dall'obiettivo di questo lavoro",
  },
  pointDraftFromQuestion: {
    en: "from the last thing you asked",
    it: "dall'ultima cosa che hai chiesto",
  },
  pointDraftMadeOf: {
    en: "Put together {sources}.",
    it: "Messa insieme {sources}.",
  },
  pointTestCommand: { en: "Test command", it: "Comando delle prove" },
  pointTestOutcome: { en: "How it went", it: "Com'è andata" },
  pointTestWhen: { en: "When it ran", it: "Quando è stata eseguita" },
  /**
   * The default. An outcome nobody chose is not "not run": that is itself a claim,
   * and the difference between saying nothing and saying it did not run is the whole
   * reason this option is here.
   */
  pointTestOutcomeNone: { en: "not stated", it: "non dichiarato" },
  pointTestsOptional: {
    en: "Optional. Left empty, nothing about the tests is recorded — and nothing is guessed either.",
    it: "Facoltativo. Se lo lasci vuoto non viene registrato niente sulle prove, e niente viene indovinato.",
  },
  /** Said when the command comes back from the last summary that was fixed. */
  pointTestCommandRepeated: {
    en: "The command you recorded last time. The outcome is never carried over.",
    it: "Il comando che hai registrato l'ultima volta. L'esito non viene mai riportato.",
  },
  pointFix: { en: "Keep this summary", it: "Conserva questo riepilogo" },
  /**
   * Said before the gesture, not after it. Every other write in this product states
   * its effect where the control is, and this one is permanent: a kept summary is
   * never changed again, only followed by another.
   */
  pointFixEffect: {
    en: "Effect: writes one summary that is never changed again. Everything else on this screen stays as it is.",
    it: "Effetto: scrive un riepilogo che non verrà più modificato. Tutto il resto di questa schermata resta com'è.",
  },
  /** What this one would follow, said as a date because an identifier is not for reading. */
  pointFollows: {
    en: "This will follow the summary kept on {when}.",
    it: "Questo seguirà il riepilogo conservato il {when}.",
  },
  pointFollowsNothing: {
    en: "This would be the first summary kept for this work.",
    it: "Questo sarebbe il primo riepilogo conservato per questo lavoro.",
  },
  pointFixing: { en: "Keeping…", it: "Sto conservando…" },
  pointFixedAt: {
    en: "Kept at {when}. It will not change again.",
    it: "Conservato alle {when}. Non cambierà più.",
  },
  /**
   * The three refusals. None of them writes anything, and each says what to do about
   * it: something arrived while the person was reading, the field they were asked to
   * review is empty, or half a test observation was written.
   */
  pointFixMoved: {
    en: "Something arrived while you were reading, so nothing was kept. The summary above is up to date now: read it and confirm again.",
    it: "Mentre leggevi è arrivato qualcosa, quindi non è stato conservato niente. Il riepilogo qui sopra è ora aggiornato: rileggilo e conferma di nuovo.",
  },
  pointFixEmpty: {
    en: "Nothing was kept: what to do next cannot be empty.",
    it: "Non è stato conservato niente: che cosa fare adesso non può restare vuoto.",
  },
  pointFixHalfTest: {
    en: "Nothing was kept: a test needs both the command and how it went, or neither.",
    it: "Non è stato conservato niente: per le prove servono sia il comando sia com'è andata, oppure nessuno dei due.",
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
  /** A moment whose payload is kept as a file this view never opens. */
  pointMomentNoText: {
    en: "no text to quote here",
    it: "nessun testo da citare qui",
  },
  /**
   * Said when the stored envelope was not the canonical one, so the line is the raw
   * stored text. A reader weighing a quotation needs to know which of the two it is.
   */
  pointMomentRaw: {
    en: "raw stored text",
    it: "testo grezzo come è stato conservato",
  },
  /**
   * Said beside a line read out of a stored file, because the moment was longer than
   * ingestion inlines. A reader weighing a quotation is told where it was read from.
   */
  pointMomentFromFile: {
    en: "read from the stored file of this moment",
    it: "letto dal file conservato di questo momento",
  },
  /** The file is there and could not be read. Silence and failure must not look alike. */
  pointMomentFileUnreadable: {
    en: "the stored file of this moment could not be read",
    it: "il file conservato di questo momento non è leggibile",
  },
  /**
   * Said once, where imported text is shown.
   *
   * These lines come out of a transcript nobody verified, and a transcript records
   * whatever was on screen — including credentials somebody pasted or a tool printed.
   * Detection here is incomplete by construction, so the interface says so plainly
   * instead of implying that what is shown has been cleared.
   */
  pointImportedWarning: {
    en: "These lines are quoted from an imported transcript. It was not checked, and it can contain credentials or private data.",
    it: "Queste righe sono citate da un transcript importato. Non è stato controllato e può contenere credenziali o dati riservati.",
  },
  pointOmittedChangedFiles: {
    en: "{count} further files with unsaved changes are not listed here.",
    it: "Altri {count} file con modifiche non salvate non sono elencati qui.",
  },
  pointOmittedTests: {
    en: "{count} further recorded test runs are not listed here.",
    it: "Altre {count} esecuzioni registrate delle prove non sono elencate qui.",
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
   * Counted apart from the moments that simply did not fit, because they are left out
   * for a different reason: the call to a tool and its reply are how the work was
   * done, not where it had got to. Saying how many there were keeps the reader from
   * thinking the conversation was quieter than it was.
   */
  pointOmittedOperations: {
    en: "{count} operations — commands and their replies — are not listed here; they are in the conversation above.",
    it: "{count} operazioni — comandi e relative risposte — non sono elencate qui: stanno nella conversazione qui sopra.",
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
  /**
   * Saying what is missing and then stopping is a diagnosis without a remedy, and it
   * is what left a real transcript unlinked for thirty-five days. These sentences turn
   * that dead end into the one gesture that ends it, in the same place.
   *
   * The heading of the whole region changes with them: "to pick this up again"
   * promises a summary, and in this state there is nothing yet to pick up.
   */
  startHeading: {
    en: "Make this conversation a piece of work",
    it: "Fai di questa conversazione un lavoro",
  },
  startObjective: { en: "What is this work", it: "Che lavoro è questo" },
  /**
   * Which moments the record will cite, said before it cites them. It is the rule the
   * summary already follows — what a record cites is what somebody read — and here it
   * is stated rather than assumed, because these moments will be the evidence of every
   * packet this work ever produces.
   */
  startHelp: {
    en: "Written by you, in your own words. It will cite the most recent moments of this conversation, the ones shown above.",
    it: "Lo scrivi tu, con parole tue. Citerà i momenti più recenti di questa conversazione, quelli mostrati qui sopra.",
  },
  startButton: { en: "Declare this work", it: "Dichiara questo lavoro" },
  /** Said before the gesture, and it names both writes, because the gesture does both. */
  startEffect: {
    en: "Effect: creates the work and marks it as in progress. Nothing is sent anywhere.",
    it: "Effetto: crea il lavoro e lo segna come in corso. Non viene inviato niente da nessuna parte.",
  },
  startWorking: { en: "Declaring…", it: "Sto dichiarando…" },
  startDone: {
    en: "Created, and marked as in progress.",
    it: "Creato, e segnato come in corso.",
  },
  /**
   * The second write did not go through. A proposed Work Item is a real state, so the
   * screen says both halves of the truth instead of a failure that hides what exists.
   */
  startDoneNotActive: {
    en: "The work was created, but not marked as in progress. Its state below says so.",
    it: "Il lavoro è stato creato, ma non segnato come in corso. Lo stato qui sotto lo dice.",
  },
  startEmpty: {
    en: "Nothing was created: write what this work is.",
    it: "Non è stato creato niente: scrivi che lavoro è questo.",
  },
  startAlready: {
    en: "Nothing was created: this conversation already has work. Reload it to see the summary.",
    it: "Non è stato creato niente: questa conversazione ha già un lavoro. Ricaricala per vedere il riepilogo.",
  },
  pointNothingImported: {
    en: "No moment of this conversation has arrived yet.",
    it: "Di questa conversazione non è ancora arrivato nessun momento.",
  },
  /**
   * The kept summary, reread.
   *
   * Two summaries on one screen is the risk this vocabulary exists to manage. The
   * composed one stays open and speaks in the present; this one is opened on request
   * and carries its date in its own title, so a reader always knows which of the two
   * they are in.
   */
  keptOpen: {
    en: "Read the summary kept on {when}",
    it: "Rileggi il riepilogo conservato il {when}",
  },
  keptClose: {
    en: "Close the kept summary",
    it: "Chiudi il riepilogo conservato",
  },
  keptHeading: {
    en: "The summary kept on {when}",
    it: "Il riepilogo conservato il {when}",
  },
  /** Said inside it, so the photograph cannot be read as the state of now. */
  keptHelp: {
    en: "How things stood that day, as it was kept. It never changes, and it is not the state of now.",
    it: "Com'erano le cose quel giorno, come sono state conservate. Non cambia più, e non è lo stato di adesso.",
  },
  /** The confirmed text, which is not a draft and carries no obligation to review. */
  keptNextAction: {
    en: "What to do next, as it was confirmed",
    it: "Che cosa fare adesso, come è stato confermato",
  },
  keptFollowsOne: {
    en: "This one followed an earlier summary.",
    it: "Questo riepilogo ne segue uno precedente.",
  },
  /**
   * A moment the packet cites that cannot be read again. It is listed rather than
   * dropped: the citation is part of a permanent record, and a summary that quietly
   * loses one would look complete while missing what somebody leaned on.
   */
  keptMomentUnreadable: {
    en: "this moment can no longer be read here",
    it: "questo momento non è più leggibile qui",
  },
  keptNothing: {
    en: "No summary has been kept for this work yet.",
    it: "Per questo lavoro non è ancora stato conservato nessun riepilogo.",
  },
  keptFailed: {
    en: "The kept summary could not be read.",
    it: "Non è stato possibile rileggere il riepilogo conservato.",
  },
});

export const RESTART_POINT_CATALOGUES = catalogues(RESTART_POINT_TEXT);

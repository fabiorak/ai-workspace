import { catalogues, type TextEntries } from "./catalog.ts";
export const CONTINUATION_TEXT = {
  continueOpen: {
    en: "Continue with another assistant",
    it: "Continua con un altro assistente",
  },
  continueHeading: {
    en: "Prepare the continuation",
    it: "Prepara la continuazione",
  },
  continueLocal: {
    en: "Local preparation. Nothing is sent. Sending and saving the assistant's answer are not available yet.",
    it: "Preparazione locale. Non viene inviato nulla. L'invio e il salvataggio della risposta dell'assistente non sono ancora disponibili.",
  },
  continueBack: { en: "Back to the summary", it: "Torna al riepilogo" },
  continueQuestion: {
    en: "What would you like to ask next?",
    it: "Che cosa vuoi chiedere adesso?",
  },
  continueNames: {
    en: "Names to protect, one per line",
    it: "Nomi da proteggere, uno per riga",
  },
  continuePrepare: {
    en: "Prepare the privacy review",
    it: "Prepara la revisione privacy",
  },
  continueSetup: {
    en: "Set up the recipient",
    it: "Configura il destinatario",
  },
  continueSetupHelp: {
    en: "Choose a name and the model identifier, then select the local profile, privacy policy and instruction files you have reviewed. These settings last until the application restarts. They do not verify an account or a key.",
    it: "Scegli un nome e l'identificativo del modello, poi indica i file locali di profilo, policy privacy e istruzioni che hai verificato. Le impostazioni durano fino al riavvio dell'applicazione. Non verificano un account o una chiave.",
  },
  continueLabel: { en: "Recipient name", it: "Nome del destinatario" },
  continueModel: { en: "Model identifier", it: "Identificativo del modello" },
  continueProfile: {
    en: "Reviewed profile file",
    it: "File del profilo verificato",
  },
  continuePolicy: {
    en: "Reviewed privacy policy file",
    it: "File della policy privacy verificata",
  },
  continueInstructions: {
    en: "Reviewed instruction files, one per line",
    it: "File delle istruzioni verificate, uno per riga",
  },
  continueTask: {
    en: "Task name, if required by the profile",
    it: "Nome dell'attività, se richiesto dal profilo",
  },
  continueConfigure: {
    en: "Use these local settings",
    it: "Usa queste impostazioni locali",
  },
  continueLoading: {
    en: "Preparing locally...",
    it: "Preparazione locale in corso...",
  },
  continueReady: {
    en: "{label} / {model}. Starting from the summary kept on {date}.",
    it: "{label} / {model}. Punto di partenza: riepilogo conservato il {date}.",
  },
  continueChanged: {
    en: "The repository has changed since this summary. You can return to it and keep a successor; your question stays here.",
    it: "Il repository è cambiato dopo questo riepilogo. Puoi tornare al riepilogo e conservarne uno successivo; la domanda resta qui.",
  },
  continueOmitted: {
    en: "Some content did not fit the selected budgets. Review the omissions before continuing.",
    it: "Parte del contenuto non rientra nei limiti scelti. Controlla le omissioni prima di continuare.",
  },
  continueLimit: {
    en: "Detection is incomplete. Review every text, deselect unwanted suggestions, and select any missed words before making the protected version.",
    it: "Il rilevamento è incompleto. Rileggi tutti i testi, deseleziona le proposte non desiderate e seleziona le parole mancanti prima di creare la versione protetta.",
  },
  continueProtectSelection: {
    en: "Protect selected words",
    it: "Proteggi le parole selezionate",
  },
  continuePassphrase: {
    en: "Passphrase for restoring protected names (required when replacing words)",
    it: "Passphrase per ripristinare i nomi protetti (necessaria quando sostituisci parole)",
  },
  continueProtect: {
    en: "Create the protected local version",
    it: "Crea la versione protetta locale",
  },
  continuePreview: { en: "Exact prepared text", it: "Testo esatto preparato" },
  continueReview: {
    en: "Review the text and substitutions",
    it: "Rivedi il testo e le sostituzioni",
  },
  continueFailed: {
    en: "Preparation failed. Review the current summary and local settings, then try again. Nothing was sent.",
    it: "Preparazione non riuscita. Controlla il riepilogo attuale e le impostazioni locali, poi riprova. Non è stato inviato nulla.",
  },
  continueMissing: {
    en: "First declare this conversation as work and keep its summary using the existing controls below.",
    it: "Prima dichiara questa conversazione come lavoro e conserva il riepilogo con i comandi già presenti qui sotto.",
  },
  continueBlocked: {
    en: "The privacy policy blocks this content. Review the source and policy before preparing again.",
    it: "La policy privacy blocca questo contenuto. Controlla la fonte e la policy prima di preparare nuovamente.",
  },
  continueExpired: {
    en: "The proposal expired, was used, or its sources changed. Prepare it again with your question below.",
    it: "La proposta è scaduta, è già stata usata oppure le fonti sono cambiate. Preparala nuovamente con la domanda qui sotto.",
  },
} satisfies TextEntries;
export const CONTINUATION_CATALOGUES = catalogues(CONTINUATION_TEXT);

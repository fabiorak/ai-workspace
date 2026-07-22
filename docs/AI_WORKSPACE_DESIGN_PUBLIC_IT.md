# AI Workspace Control Plane

## Documento di progettazione

**Stato:** visione di prodotto in evoluzione  
**Licenza:** Apache License 2.0  
**Nota:** gli esempi usano nomi e identificativi fittizi.  
**Obiettivo:** realizzare una piattaforma open source, local-first, per coordinare agenti AI e modelli LLM, condividere il contesto tra strumenti diversi, ridurre il consumo di token, ricercare conoscenza storica e proteggere i dati sensibili.

Questo documento descrive la direzione di lungo periodo, non lo stato corrente
del prodotto né un impegno a implementare ogni componente citato. Le decisioni
architetturali accettate sono negli ADR, lo stato implementato è documentato
nell'architettura e nei piani di sprint, e la roadmap operativa corrente è in
[`ROADMAP.md`](../ROADMAP.md). Tecnologie, servizi e interfacce qui nominate
restano candidati finché un ADR evidence-led non li seleziona.

---

## 1. Visione

Il progetto nasce dall'esigenza di semplificare il lavoro con più coding agent e modelli LLM.

Un utente può usare strumenti diversi, per esempio Codex, Claude Code, Gemini CLI, Cursor o altri agenti. Può iniziare un'attività con un agente e volerla continuare con un altro, magari perché:

- ha terminato i token o il budget disponibile;
- un modello è più adatto alla pianificazione;
- un altro modello è più efficace nello sviluppo;
- vuole usare un modello diverso per revisione, test o debugging;
- vuole evitare di dipendere da un singolo fornitore.

Oggi il passaggio tra agenti richiede spesso di ricostruire il contesto del progetto. Questo comporta:

- consumo elevato di token;
- perdita di tempo;
- rischio di dimenticare decisioni già prese;
- ripetizione di analisi già svolte;
- difficoltà nel recuperare conversazioni, script, errori e soluzioni precedenti.

La piattaforma deve diventare un **control plane locale per il lavoro assistito da agenti AI**.

Non è un nuovo coding agent. È uno strato di orchestrazione che gestisce:

- progetti;
- sessioni;
- memoria;
- conoscenza storica;
- ricerca;
- contesto;
- privacy;
- modelli;
- costi;
- token;
- script riutilizzabili;
- automazioni;
- handoff tra agenti.

---

## 2. Principi guida

### 2.1 Local-first

I dati devono restare localmente, salvo esplicita configurazione diversa.

Devono essere locali almeno:

- indice dei progetti;
- conversazioni;
- memoria;
- mapping di anonimizzazione;
- documenti originali;
- script;
- artefatti;
- configurazioni;
- metriche di utilizzo.

### 2.2 Agent-agnostic

La piattaforma non deve dipendere da un singolo agente o modello.

Deve poter integrare:

- agenti CLI;
- agenti esposti tramite API;
- modelli locali;
- modelli cloud;
- strumenti compatibili MCP;
- gateway multi-provider.

### 2.3 Context minimization

Il sistema non deve inviare al modello tutto ciò che conosce.

Deve costruire il **minimo contesto sufficiente** per il task corrente.

### 2.4 Memoria verificabile

Le informazioni persistenti devono avere:

- origine;
- data;
- validità;
- livello di confidenza;
- stato;
- relazioni con decisioni successive;
- eventuale evidenza di test o verifica.

### 2.5 Privacy by design

Anonimizzazione, controllo dei dati e audit non devono essere funzionalità aggiunte successivamente, ma parte dell'architettura di base.

### 2.6 GUI-first e auto-esplicativa

L'interfaccia grafica è la superficie primaria per onboarding e uso quotidiano.
L'utente deve poter diventare operativo tramite pulsanti documentati,
spiegazioni inline, esempi, avanzamento, empty state e recovery azionabili,
senza dover prima leggere un manuale o memorizzare comandi CLI.

La CLI resta disponibile per automazione, diagnostica, test e workflow
avanzati. La documentazione offre approfondimento ma non sostituisce la
scopribilità nel prodotto. Ogni nuova capability user-facing richiede un piano
di consegna GUI o un'eccezione temporanea esplicita.

### 2.7 Open source e componibilità

La piattaforma deve preferire:

- componenti open source;
- formati aperti;
- storage sostituibili;
- protocolli standard;
- plugin;
- adapter;
- API documentate.

---

## 3. Problemi affrontati

### 3.1 Passaggio tra agenti

Un progetto iniziato con un agente deve poter essere ripreso rapidamente da un altro.

Il nuovo agente non deve rileggere tutta la cronologia, ma ricevere:

- obiettivo corrente;
- stato del lavoro;
- decisioni attive;
- file rilevanti;
- modifiche già effettuate;
- test eseguiti;
- errori ancora aperti;
- prossime attività.

### 3.2 Recupero di conoscenza storica

L'utente deve poter cercare qualsiasi informazione affrontata in passato:

- domande fatte in chat;
- risposte ricevute;
- errori;
- comandi;
- script;
- file;
- decisioni;
- soluzioni;
- tentativi falliti;
- progetti;
- commit;
- documenti.

### 3.3 Riduzione dei token

Il sistema deve ridurre il consumo di token attraverso:

- context building selettivo;
- compressione;
- deduplicazione;
- cache;
- progressive disclosure;
- indicizzazione del codice;
- riuso di script;
- sintesi degli output;
- routing verso modelli più piccoli;
- recupero mirato della conoscenza.

### 3.4 Persistenza delle decisioni

Le decisioni prese durante una chat non devono scomparire alla chiusura della sessione.

Devono poter essere trasformate in:

- fatti;
- decisioni;
- vincoli;
- task;
- procedure;
- failure memory;
- handoff;
- documentazione del progetto.

### 3.5 Protezione dei dati sensibili

Ogni input destinato a un modello esterno deve poter attraversare una pipeline
di pseudonimizzazione reversibile best-effort e controlli indipendenti di
policy e secret detection.

Le slice E7 implementate forniscono un preflight locale in sola lettura, span
UTF-8 revisionati esplicitamente, pseudonimi inerti reversibili, mapping
AES-256-GCM separati e chiavi casuali custodite in envelope protetti da
passphrase. Evidenza e Context Pack canonici non cambiano; nessun risultato
fornisce accesso al modello, permesso, consegna o esecuzione.

Sprint 28 misura inoltre, solo in sviluppo e su un corpus sintetico bilingue,
candidati deterministici per assistere una futura revisione. Gli alias esatti
configurati superano il corpus come `ADOPT_FOR_REVIEW`; la sintassi standard e
l'unione restano `REFINE` per un falso positivo telefonico nel codice. Nessun
recognizer è esposto alla GUI o alla trasformazione, e non viene rivendicato un
rilevamento PII completo.

Sprint 29 espone soltanto alias `CUSTOMER` configurati esatti tramite una
superficie locale di revisione transitoria. I suggerimenti contengono hash
correnti e intervalli UTF-8, non alias o testo corrispondente, restano
`SUGGESTED_NOT_REVIEWED` e sono deselezionati fino alla conferma individuale
nel form di revisione schema-v1 esistente. La pseudonimizzazione resta
un'azione separata. Gli alias `PROJECT` richiedono il boundary di compatibilità
schema v2 pianificato, con letture v1 permanenti e nessuna migrazione implicita.

Sprint 30 completa quel boundary tramite ADR-0024. Gli alias configurati esatti
`CUSTOMER` e `PROJECT` restano suggerimenti di revisione transitori, non
riecheggianti e deselezionati. La conferma di uno span progetto seleziona un
documento di review e mapping schema v2 separato; le review solo cliente
continuano a usare schema v1. I reader versionati conservano il comportamento
v1 permanente ed esatto, i mapping v2 autenticano schema e scope, gli envelope
di custodia restano schema v1 e nessuno stato viene migrato o ricifrato.

Sprint 31 completa tramite ADR-0025 un boundary separato per output arbitrari.
Il corpus sintetico bilingue accetta il ripristino rigoroso di token interi dopo
tre restore esatti, nove blocchi completi, un risultato senza token e nessun
output errato o parzialmente ripristinato nei casi bloccati. Un inspector locale
bounded ripristina soltanto token v1/v2 posseduti dal mapping dopo la validazione
completa; modelli, acquisizione di risposte, delivery, routing, permessi ed
esecuzione restano esclusi.

### 3.6 Riutilizzo degli strumenti

Gli script creati per automatizzare attività ripetitive devono essere catalogati e recuperabili senza chiedere nuovamente al modello di generarli.

---

## 4. Posizionamento

Una possibile descrizione sintetica del progetto:

> Local-first AI workspace for cross-agent memory, context optimization, privacy-preserving model access, project search and reusable automation.

Oppure:

> Un workspace locale che rende progetti, conoscenze, conversazioni, script e decisioni condivisibili tra agenti AI diversi, riducendo il contesto inviato ai modelli e proteggendo i dati sensibili.

---

## 5. Modello concettuale

La piattaforma deve distinguere chiaramente tra:

1. memoria attiva;
2. conoscenza storica;
3. artefatti;
4. indice di ricerca;
5. contesto temporaneo;
6. stato operativo del task.

```text
Progetti, conversazioni, file, log, script, commit
                         |
                         v
              Archivio storico completo
                         |
            +------------+------------+
            |                         |
            v                         v
   Historical Search            Memory Store
   ricerca di qualsiasi      informazioni consolidate
      evidenza storica          e attualmente valide
            |                         |
            +------------+------------+
                         |
                         v
                  Context Builder
                         |
             selezione e compressione
                         |
                         v
                    AI Agent
```

Il backend di ricerca storica conserva e rende recuperabile ciò che potrebbe
tornare utile. OpenSearch è un possibile adapter futuro, non una dipendenza
accettata per il Core MVP.

Il Memory Store conserva ciò che è considerato attivo, consolidato e rilevante.

Il Context Builder decide cosa inviare al modello.

---

## 6. Tipi di memoria

### 6.1 Memoria del progetto

Contiene informazioni relativamente stabili:

- stack;
- versioni;
- architettura;
- convenzioni;
- comandi;
- dipendenze;
- vincoli;
- struttura del repository;
- policy;
- criteri di test;
- modalità di rilascio.

Il progetto dovrebbe supportare file standard come `AGENTS.md`.

Esempio:

```text
project/
├── AGENTS.md
├── .ai-workspace/
│   ├── HANDOFF.md
│   ├── DECISIONS.md
│   ├── TASKS.md
│   ├── SESSIONS/
│   └── INDEX.json
└── ...
```

### 6.2 Memoria operativa

Rappresenta il punto in cui il lavoro si è interrotto.

File suggerito: `.ai-workspace/HANDOFF.md`.

```markdown
# Current handoff

## Objective
Implementare il rinnovo automatico del token OAuth2.

## Current state
Il client è funzionante, ma il retry su HTTP 401 non è ancora implementato.

## Files involved
- src/services/ServiceServiceClient.ts
- src/services/AuthService.ts

## Decisions
- Non usare async/await.
- Un solo retry dopo il refresh.
- Non modificare l'interfaccia pubblica del client.

## Next actions
1. Intercettare il 401.
2. Invalidare il token.
3. Ripetere la chiamata.
4. Aggiungere test.

## Verification
npm test -- ServiceClient
```

### 6.3 Memoria episodica

Contiene gli eventi delle sessioni:

- messaggi;
- tool call;
- file letti;
- file modificati;
- comandi;
- output;
- errori;
- test;
- commit;
- decisioni rilevate.

È opportuno usare un event log append-only, per esempio JSONL.

```json
{"type":"user_message","session":"s123","timestamp":"...","content":"..."}
{"type":"tool_call","tool":"grep","args":{},"result_ref":"blob:abc"}
{"type":"decision","content":"Non usare async/await","confidence":1}
{"type":"file_modified","path":"src/service-client.ts","git_diff_ref":"blob:def"}
```

### 6.4 Memoria semantica

Contiene conoscenza riutilizzabile tra sessioni e progetti:

- pattern tecnici;
- errori risolti;
- procedure;
- snippet;
- configurazioni;
- preferenze;
- vincoli ricorrenti;
- script;
- strumenti.

```yaml
type: solution
title: Ripristino dump PostgreSQL con owner inesistente
problem: pg_restore fallisce perché il ruolo originale non esiste
solution:
  - usare --no-owner
  - oppure creare temporaneamente il ruolo
tags:
  - postgres
  - pg_restore
verified: true
last_verified: 2026-07-09
```

### 6.5 Failure memory

Deve essere mantenuta anche la conoscenza dei tentativi falliti.

```yaml
attempt:
  action: Aggiornare una libreria alla versione corrente
  result: failed
  reason: Incompatibile con Node 8
  do_not_repeat: true
```

---

## 7. Modello dati della memoria

```typescript
interface MemoryItem {
    id: string;

    workspaceId?: string;
    projectId?: string;
    sessionId?: string;
    taskId?: string;

    type:
        | "fact"
        | "decision"
        | "procedure"
        | "task"
        | "summary"
        | "preference"
        | "failure"
        | "constraint";

    content: string;

    sourceRefs: string[];
    confidence: number;

    status:
        | "active"
        | "historical"
        | "superseded"
        | "invalidated";

    validFrom: string;
    validUntil?: string;
    supersededBy?: string;

    createdAt: string;
    updatedAt: string;
}
```

Il sistema deve supportare relazioni come:

```text
decision B SUPERSEDES decision A
```

---

## 8. Ricerca storica globale

La ricerca storica deve essere esposta attraverso una porta sostituibile. Il
primo adapter implementato esegue una scansione letterale bounded degli eventi
canonici validati; un indice locale leggero o OpenSearch potranno essere scelti
in seguito tramite ADR, sulla base di corpus, prestazioni e costi operativi.

La composizione globale implementata nella GUI enumera soltanto i progetti
registrati, normalizza fino a 100 project ID espliciti, esamina al massimo
10.000 eventi canonici, unisce i match prima di un unico limite di 1–100
risultati e identifica il progetto senza esporne il percorso. Il failure di un
progetto incluso interrompe l'intero report invece di restituire risultati
parziali fuorvianti. L'ispezione di evento e sorgente resta project-scoped dopo
una selezione utente esplicita. Questo chiude il gap del progetto dimenticato
senza scegliere un indice.

Il suo scopo non è diventare la memoria attiva dell'agente, ma consentire di recuperare qualsiasi evidenza precedente.

### 8.1 Contenuti indicizzati

- messaggi utente;
- risposte degli agenti;
- conversazioni;
- tool call;
- output sintetici dei tool;
- errori;
- stack trace;
- comandi;
- file;
- chunk di codice;
- diff;
- commit;
- decisioni;
- tentativi falliti;
- script;
- documenti;
- riassunti;
- handoff;
- configurazioni;
- manifest di tool;
- risultati di test.

### 8.2 Documento indicizzato

```json
{
  "id": "session-message-123",
  "documentType": "chat_message",
  "workspaceId": "default",
  "projectId": "sample-api",
  "sessionId": "session-2026-06-29",
  "agent": "codex",
  "model": "model-name",
  "role": "assistant",
  "content": "Usare pg_restore con --no-owner...",
  "contentAnonymized": "Usare pg_restore con --no-owner...",
  "timestamp": "2026-06-29T10:42:00Z",
  "tags": [
    "postgresql",
    "pg_restore",
    "docker"
  ],
  "entities": [
    "pg_restore",
    "PostgreSQL"
  ],
  "sourceRefs": [
    "artifact://session/session-2026-06-29"
  ],
  "git": {
    "repository": "sample-api",
    "branch": "main",
    "commit": "3ab21fc"
  },
  "status": "historical",
  "confidence": 1.0
}
```

### 8.3 Tipologie documentali

```text
chat_message
session_summary
decision
solution
failure
error
command
artifact
script
code_chunk
file
commit
handoff
task
```

### 8.4 Evoluzione del ranking

La visione di lungo periodo può combinare:

- ricerca full-text;
- phrase matching;
- ricerca semantica;
- filtri;
- recenza;
- affinità con il progetto;
- stato di validità;
- evidenza di verifica;
- frequenza di utilizzo.

```text
score =
    lexical_score
  + semantic_score
  + project_affinity
  + verification_score
  + source_quality
  + recency_score
  + usage_score
```

La recenza non deve prevalere automaticamente su una soluzione vecchia ma verificata.

Questa formula è illustrativa, non un contratto di implementazione. Il ranking
iniziale deve partire da ricerca lessicale, filtri obbligatori e al massimo un
boost motivato. Segnali ulteriori richiedono un golden set versionato di query
e risultati attesi, con misure di qualità prima e dopo ogni modifica.

### 8.5 Filtri di ricerca

```text
project:sample-api
agent:claude
type:error
after:2026-01-01
language:typescript
verified:true
status:active
```

### 8.6 Knowledge trail

La UI dovrebbe mostrare una sequenza ricostruita:

```text
Query:
"errore pg_restore ruolo non esistente"

1. Problema originale
2. Tentativo fallito
3. Soluzione verificata
4. Script creato
5. Commit associato
```

Azioni disponibili:

```text
[Apri conversazione]
[Apri progetto]
[Mostra file]
[Usa come contesto]
[Esegui script]
[Crea handoff]
```

### 8.7 Indici

Possibile organizzazione:

```text
ai-chat-*
ai-code-*
ai-decisions-*
ai-artifacts-*
ai-tools-*
ai-sessions-*
```

Alias comune:

```text
ai-global-search
```

Indici separati consentono mapping e analyzer specifici per:

- testo;
- codice;
- log;
- decisioni;
- script;
- documenti.

---

## 9. Archivio storico e artefatti

Il testo completo non deve necessariamente essere memorizzato interamente in OpenSearch.

OpenSearch può indicizzare:

- contenuto;
- estratti;
- metadati;
- riferimenti;
- embeddings.

Gli artefatti originali devono essere conservati in uno storage separato:

```text
Artifact store
├── raw transcripts
├── tool outputs
├── patches
├── git diffs
├── documents
├── generated files
├── test reports
└── anonymization maps
```

Ogni artefatto può essere identificato tramite hash:

```text
artifact://sha256/abc123
```

---

## 10. Context Builder

Il Context Builder è il cuore funzionale della piattaforma.

Riceve un task e costruisce il contesto minimo per l'agente.

### 10.1 Input

```text
"Implementa il retry OAuth2 del client"
```

### 10.2 Processo

1. identifica progetto e branch;
2. legge `AGENTS.md`;
3. legge `HANDOFF.md`;
4. recupera decisioni attive;
5. interroga OpenSearch;
6. interroga il code graph;
7. recupera file e simboli rilevanti;
8. esclude contenuti obsoleti;
9. deduplica;
10. applica un token budget;
11. comprime;
12. anonimizza;
13. costruisce il context pack;
14. invia il task all'agente.

### 10.3 Context pack

```yaml
context_pack:
  objective: Implementare retry OAuth2
  token_budget: 12000

  mandatory:
    - project_constraints
    - current_handoff
    - related_decisions

  code_context:
    symbols:
      - ServiceServiceClient.call
      - AuthService.getToken
    max_tokens: 5000

  previous_work:
    max_items: 5
    max_tokens: 2000
```

### 10.4 Progressive disclosure

```text
Level 0: project card
Level 1: handoff e decisioni
Level 2: firme dei simboli
Level 3: frammenti di codice
Level 4: file completi
Level 5: evidenza storica completa
```

Il modello riceve inizialmente solo i livelli necessari.

---

## 11. Handoff tra agenti

Il passaggio tra agenti deve essere indipendente dal provider.

Il sistema deve generare un task packet neutrale.

```json
{
  "task": "Implementare il retry OAuth2",
  "acceptanceCriteria": [
    "Un solo retry",
    "Test automatici",
    "Nessuna modifica alle API pubbliche"
  ],
  "constraints": [
    "Node 8",
    "No async/await"
  ],
  "relevantFiles": [
    "src/service-client.ts",
    "src/auth.ts"
  ],
  "decisions": [
    "Usare Q.Promise"
  ],
  "changesAlreadyMade": [],
  "tests": {
    "passed": [],
    "failed": []
  },
  "nextAction": "Implementare intercettazione HTTP 401"
}
```

### 11.1 Ruoli possibili

```text
Planner: Codex
Implementer: Claude
Reviewer: Codex
Test analyst: modello locale
```

### 11.2 Worktree separate

Per evitare conflitti:

```text
main
├── worktree/codex-plan
├── worktree/claude-implementation
└── worktree/codex-review
```

---

## 12. Integrazione con code graph

Un code graph può evitare letture ripetute e costose dell'intero repository.

Funzioni richieste:

```text
find_symbol
find_references
find_callers
find_callees
find_implementations
find_routes
impact_analysis
architecture_summary
```

### 12.1 Sincronizzazione

```text
Git repository
     |
     +-- file watcher
     +-- git diff watcher
     +-- periodic consistency check
             |
             v
         Code index
```

Il sistema deve scegliere dinamicamente tra:

- ricerca full-text;
- ricerca semantica;
- code graph;
- Git history;
- memoria;
- artefatti.

---

## 13. Pipeline di pseudonimizzazione reversibile

La pseudonimizzazione è una mitigazione best-effort, non una garanzia di
anonimato o di assenza di segreti. Entity detection e recognizer possono
produrre falsi negativi; un modello può alterare i placeholder; rinominare
identificatori nel codice può modificarne il significato. Per dati sensibili
sono quindi necessari ispezione umana, policy di uscita e secret detection
indipendenti dalla trasformazione del testo.

```text
input
  -> parsing
  -> entity detection
  -> custom recognizers
  -> anonymization
  -> context building
  -> agent
  -> model
  -> agent output
  -> deanonymization
  -> validation
  -> output
```

### 13.1 Entità standard

- persone;
- email;
- telefoni;
- codici fiscali;
- IBAN;
- indirizzi;
- coordinate;
- credenziali;
- token;
- IP;
- identificativi;
- hostname interni;
- nomi cliente;
- nomi progetto.

### 13.2 Dizionario personalizzato

```yaml
entities:
  - canonical: CUSTOMER_001
    aliases:
      - Customer Alpha
      - Customer Alpha Ltd.
      - CUSTOMER_ALPHA
    replacement: "[[CUSTOMER_001]]"

  - canonical: PROJECT_003
    aliases:
      - MyProject
      - myproject
    replacement: "[[PROJECT_003]]"
```

### 13.3 Proprietà del mapping

Il mapping deve essere:

- locale;
- cifrato;
- reversibile;
- deterministico;
- specifico per workspace;
- specifico per progetto, quando necessario;
- separato dai log.

### 13.4 Modalità

```text
OFF
PII_ONLY
PII_AND_SECRETS
STRICT_BUSINESS_DATA
CUSTOM
```

### 13.5 Privacy inspector

La UI deve mostrare:

```text
Originale | Anonimizzato | Risposta deanonimizzata
```

L'utente deve poter:

- accettare;
- modificare;
- correggere;
- aggiungere regole;
- marcare falsi positivi;
- escludere termini pubblici.

### 13.6 Indicizzazione e privacy

Configurazione possibile:

```yaml
indexing:
  mode: anonymized
  store_original: encrypted
  index_secrets: false
  index_tool_outputs: summarized
```

Una ricerca contenente dati reali deve essere trasformata nella forma anonimizzata prima della query OpenSearch.

---

## 14. Catalogo di script e automazioni

Gli script prodotti durante le sessioni devono essere registrati come strumenti riutilizzabili.

### 14.1 Manifest

```yaml
name: markdown-to-pdf
version: 1.2.0
description: Converte Markdown in PDF tramite Pandoc
runtime: python
entrypoint: main.py

inputs:
  - name: source
    type: file
    extensions:
      - md

outputs:
  - name: pdf
    type: file

dependencies:
  system:
    - pandoc

security:
  network: false
  filesystem:
    read:
      - "${input}"
    write:
      - "${outputDirectory}"

tags:
  - markdown
  - pdf
  - conversion

verified:
  last_run: 2026-07-10
  test_status: passed
```

### 14.2 Funzioni

- ricerca;
- esecuzione;
- anteprima;
- storico;
- versionamento;
- test;
- sandbox;
- deduplicazione;
- tagging;
- suggerimento automatico;
- promozione a tool verificato.

### 14.3 Recipe

```yaml
name: publish-technical-document
steps:
  - run: markdown-lint
  - run: markdown-to-pdf
  - run: generate-checksum
  - run: copy-to-release-directory
```

### 14.4 Suggerimento intelligente

Quando una procedura viene ripetuta:

```text
"È già presente lo strumento markdown-to-pdf.
Eseguirlo invece di chiedere al modello di rigenerare la procedura?"
```

---

## 15. Strategie di riduzione dei token

### 15.1 Compressione

- output CLI;
- log;
- test;
- stack trace;
- conversazioni;
- diff;
- documentazione.

### 15.2 Deduplicazione

Prima dell'invio:

```text
Warning:
- 22% del contesto è duplicato.
- È incluso un log già riassunto.
- Due decisioni sono obsolete.
```

### 15.3 Prompt e response caching

La chiave di cache deve includere almeno:

```text
prompt
+ commit hash
+ file hashes
+ tool version
+ model
+ system instructions
```

### 15.4 Modelli locali o piccoli

Adatti per:

- classificazione;
- tagging;
- embeddings;
- estrazione decisioni;
- deduplicazione;
- riassunti;
- routing;
- rilevamento PII;
- selezione del contesto.

### 15.5 Diff-first context

Per riprendere un'attività possono bastare:

- commit base;
- git diff;
- handoff;
- decisioni;
- test;
- errori.

### 15.6 Output referenziabili

```text
[Test output omitted: artifact://sha256/abc123]

Summary:
- 238 tests passed
- 2 tests failed
- failures in AuthService.spec.ts
```

### 15.7 Token budget per categoria

```yaml
budget:
  total: 20000
  instructions: 2000
  handoff: 1500
  decisions: 1500
  code: 10000
  history: 2500
  tool_results: 2500
```

---


---

## 16. Instruction Management

La piattaforma deve gestire un sistema di istruzioni componibili, applicabili in modo coerente a tutti i modelli e agenti.

L'obiettivo è evitare la duplicazione delle stesse regole nei diversi strumenti e garantire che i vincoli globali siano sempre rispettati.

### 16.1 Gerarchia delle istruzioni

Le istruzioni devono poter essere definite a più livelli:

```text
Global instructions
        ↓
Workspace instructions
        ↓
Project instructions
        ↓
Model-specific instructions
        ↓
Agent-specific instructions
        ↓
Task-specific instructions
```

Esempio di struttura globale:

```text
~/.ai-workspace/
├── instructions/
│   ├── GLOBAL.md
│   ├── workspace.md
│   ├── models/
│   │   ├── claude.md
│   │   ├── codex.md
│   │   └── gemini.md
│   └── agents/
│       ├── architect.md
│       ├── developer.md
│       ├── reviewer.md
│       └── tester.md
```

Esempio a livello di progetto:

```text
project/
├── AGENTS.md
├── CLAUDE.md
├── CODEX.md
└── .ai-workspace/
    ├── instructions.md
    ├── HANDOFF.md
    ├── DECISIONS.md
    └── skills/
```

### 16.2 Compatibilità con file nativi

La piattaforma non deve imporre esclusivamente formati proprietari.

Deve poter leggere, normalizzare e generare:

- `AGENTS.md`;
- `CLAUDE.md`;
- file specifici di Codex;
- file di configurazione di altri agenti;
- istruzioni IDE;
- configurazioni MCP;
- istruzioni proprie della piattaforma.

Internamente, tutte le sorgenti devono essere trasformate in un modello uniforme.

```typescript
interface InstructionSource {
    id: string;

    scope:
        | "global"
        | "workspace"
        | "project"
        | "model"
        | "agent"
        | "task";

    target?: string;
    path?: string;
    priority: number;
    rules: InstructionRule[];
}
```

### 16.3 Regole sovrascrivibili e non sovrascrivibili

Le istruzioni devono distinguere tra:

#### Vincoli

Non possono essere annullati da livelli inferiori.

Esempi:

- non inviare segreti;
- non operare fuori dal progetto;
- non eseguire comandi distruttivi senza conferma;
- non effettuare deploy non autorizzati;
- rispettare policy legali o di licenza.

#### Preferenze

Possono essere modificate da livelli più specifici.

Esempi:

- linguaggio preferito;
- stile del codice;
- framework;
- formato dei commit;
- livello di dettaglio;
- strategia di test.

Modello suggerito:

```yaml
rules:
  - id: security.no-secrets
    type: constraint
    overridable: false
    content: Non inviare credenziali a modelli esterni.

  - id: coding.preferred-language
    type: preference
    overridable: true
    content: Preferire TypeScript.
```

### 16.4 Ordine di precedenza

Ordine suggerito:

```text
task
> agent
> model
> project
> workspace
> global
```

L'ordine di precedenza si applica solo alle regole sovrascrivibili.

I vincoli non sovrascrivibili devono restare sempre attivi nella composizione,
ma la loro presenza nel prompt non costituisce enforcement di sicurezza.
Permessi su tool, filesystem, rete, azioni distruttive e trasferimenti verso
modelli esterni devono essere applicati da boundary deterministici. Nel prompt
possono essere espresse preferenze e istruzioni difensive, non garanzie.

### 16.5 Prompt Composer

Un modulo dedicato deve produrre le istruzioni effettive per una specifica esecuzione.

Esempio:

```text
GLOBAL.md
+ workspace.md
+ AGENTS.md
+ CLAUDE.md
+ reviewer.md
+ task instructions
```

Il risultato deve essere:

- deterministico;
- tracciabile;
- versionato;
- ispezionabile;
- riproducibile.

### 16.6 Anteprima delle istruzioni effettive

La UI deve mostrare il prompt di istruzioni realmente composto.

Esempio:

```text
Instructions effective for:
Project: sample-backend
Model: Claude
Agent: Reviewer
```

Sezioni visualizzabili:

```text
Global
Workspace
Project
Model
Agent
Task
```

Ogni regola deve mostrare:

- sorgente;
- scope;
- priorità;
- stato;
- possibilità di override;
- eventuale regola che l'ha sostituita.

Deve essere disponibile anche una vista diff.

```diff
+ Claude: usa risposte concise durante le review
- Codex: genera prima un piano strutturato
```

---

## 17. Agent Registry

La piattaforma deve gestire un catalogo di agenti configurabili e selezionabili dalla UI.

Esempi:

```text
Architect
Planner
Developer
Reviewer
Tester
Security Reviewer
Documentation Writer
Database Specialist
DevOps Engineer
```

Un agente non deve essere rappresentato soltanto da un prompt, ma da una configurazione completa e versionata.

```yaml
id: security-reviewer
name: Security Reviewer
description: Analizza codice e configurazioni dal punto di vista della sicurezza.

instructions: agents/security-reviewer.md

allowed_tools:
  - code_search
  - read_file
  - git_diff
  - dependency_scan

forbidden_tools:
  - shell_write
  - deploy
  - delete_file

preferred_models:
  - claude
  - codex

context_profile:
  include:
    - git_diff
    - dependencies
    - security_decisions
  exclude:
    - unrelated_history

output_schema:
  type: security-review
```

### 17.1 Proprietà di un agente

Un agente deve poter definire:

- nome;
- descrizione;
- versione;
- istruzioni;
- modelli preferiti;
- modelli consentiti;
- skill abilitate;
- tool consentiti;
- tool vietati;
- policy di contesto;
- budget token;
- livello di autonomia;
- formato di output;
- conferme richieste;
- test;
- autore;
- licenza;
- provenienza;
- checksum o firma.

---

## 18. Skill Registry

La piattaforma deve distinguere chiaramente tra:

- **agent**: ruolo che interpreta un obiettivo e coordina il lavoro;
- **skill**: capacità specifica e riutilizzabile;
- **tool**: operazione concreta eseguibile;
- **recipe**: sequenza di tool o skill.

Esempio:

```text
Agent: Backend Developer

Skills:
- TypeScript refactoring
- PostgreSQL migration
- API design
- Unit test generation

Tools:
- read_file
- write_file
- run_tests
- codegraph_find_references
```

### 18.1 Definizione di una skill

```yaml
id: postgres-restore
name: PostgreSQL Restore
description: Ripristina un dump PostgreSQL gestendo owner e ruoli mancanti.

instructions: skills/postgres-restore.md

required_tools:
  - shell
  - docker
  - artifact_store

inputs:
  - dump_file
  - database
  - container

risk_level: medium

requires_confirmation:
  - drop_database
  - overwrite_existing_data
```

### 18.2 Relazioni

```text
Agent
  ├── uses Skill
  │      └── requires Tool
  └── follows Instruction Set
```

La selezione di una skill deve poter modificare:

- strumenti disponibili;
- contesto recuperato;
- token budget;
- policy;
- input richiesti;
- output atteso;
- controlli di sicurezza.

---

## 19. Editor visuale di agenti e skill

La UI deve consentire di creare, modificare, duplicare, importare ed esportare agenti e skill.

Sezioni suggerite:

```text
General
Instructions
Models
Tools
Skills
Context
Permissions
Output
Tests
Versioning
```

### 19.1 Modalità di editing

L'editor dovrebbe offrire:

```text
[Form] [Markdown] [YAML] [Effective Prompt] [Test]
```

- **Form**: modifica guidata dei metadati;
- **Markdown**: istruzioni testuali;
- **YAML**: configurazione avanzata;
- **Effective Prompt**: anteprima delle istruzioni composte;
- **Test**: esecuzione di casi di prova.

### 19.2 Esempio UI

```text
Nome: PostgreSQL Specialist

Modelli preferiti:
✓ Claude
✓ Codex

Skill:
✓ PostgreSQL Restore
✓ Query Optimization
✓ Schema Review

Tool:
✓ Read file
✓ Shell
✓ Docker
✗ Deploy
✗ Delete repository
```

### 19.3 Validazione

L'editor deve verificare:

- riferimenti a tool inesistenti;
- skill mancanti;
- conflitti tra permessi;
- modelli non disponibili;
- output schema non valido;
- istruzioni contraddittorie;
- override di vincoli non consentiti;
- dipendenze cicliche;
- compatibilità di versione.

---

## 20. Test di agenti e skill

Agenti e skill devono poter essere testati prima dell'uso.

```yaml
tests:
  - name: non modifica file durante una review
    input: Analizza questa patch
    expected:
      forbidden_tool_calls:
        - write_file

  - name: segnala SQL injection
    fixture: fixtures/sql-injection.ts
    expected_contains:
      - SQL injection
```

La UI deve mostrare:

```text
Security Reviewer v1.3

✓ 12 test superati
✗ 1 test fallito
```

Tipologie di test:

- tool consentiti;
- tool vietati;
- formato output;
- rilevamento di problemi;
- rispetto dei vincoli;
- uso corretto del contesto;
- comportamento con input malevoli;
- resistenza a prompt injection;
- consumo token;
- regressioni tra versioni.

---

## 21. Selezione di agenti e skill nella UI

All'avvio di un task, l'utente deve poter selezionare facilmente:

- modello;
- agente;
- skill;
- tool;
- policy di privacy;
- istruzioni;
- budget token;
- profilo di contesto.

Esempio:

```text
Project: sample-api
Task: Ripristinare il database di sviluppo

Model:
[Codex ▼]

Agent:
[PostgreSQL Specialist ▼]

Skills:
[x] PostgreSQL Restore
[x] Docker Management
[ ] Schema Migration

Instructions:
✓ Global
✓ Project
✓ Codex
✓ PostgreSQL Specialist

Privacy:
PII_AND_SECRETS

Context:
8.420 token
```

Azioni:

```text
[Preview instructions]
[Preview context]
[Preview anonymization]
[Start]
```

### 21.1 Suggerimento automatico

Il sistema può suggerire agenti e skill sulla base del task.

```text
Task rilevato: ripristino dump PostgreSQL

Agente suggerito:
PostgreSQL Specialist

Skill suggerite:
- PostgreSQL Restore
- Docker Database Management
```

La selezione automatica non deve eseguire azioni sensibili senza conferma.

---

## 22. Relazione tra agenti, skill e Context Builder

La scelta di agente e skill deve influenzare il Context Builder.

```yaml
agent: backend-developer

context_policy:
  mandatory:
    - AGENTS.md
    - HANDOFF.md
    - architecture_decisions

  retrieve:
    - type: code
      limit: 8

    - type: previous_solution
      limit: 3

  exclude:
    - long_chat_history
    - unrelated_documents
```

Una skill può aggiungere requisiti specifici.

```yaml
skill: postgres-restore

additional_context:
  - docker-compose.yml
  - database version
  - previous restore errors
  - available scripts
```

La selezione di un agente non deve limitarsi alla modifica del system prompt.

Deve influenzare:

- istruzioni;
- modelli;
- strumenti;
- retrieval;
- budget;
- policy;
- output;
- validazioni;
- livello di autonomia.

---

## 23. Package Registry e condivisione comunitaria

In una fase successiva, agenti e skill potranno essere distribuiti come pacchetti.

```text
@workspace/security-reviewer
@workspace/java-legacy-specialist
@workspace/angular-migration
@workspace/kubernetes-deployer
```

Struttura possibile:

```text
agent-package/
├── agent.yaml
├── instructions.md
├── skills/
├── tests/
├── fixtures/
├── README.md
├── LICENSE
└── SIGNATURE
```

Comandi possibili:

```bash
workspace agent install github:user/security-reviewer
workspace skill install ./skills/postgres-restore
workspace agent validate security-reviewer
workspace agent test security-reviewer
```

### 23.1 Sicurezza dei pacchetti

Devono essere supportati:

- checksum;
- firma;
- provenienza;
- permessi dichiarati;
- dipendenze;
- compatibilità;
- sandbox;
- review;
- trust level;
- blocco di tool pericolosi.

---

## 24. Modello dati per istruzioni, agenti e skill

Tabelle indicative:

```text
instruction_sources
instruction_rules
instruction_versions
agents
agent_versions
skills
skill_versions
tools
agent_skills
skill_tools
agent_models
agent_tests
skill_tests
package_sources
package_signatures
```

Esempio di modello agente:

```typescript
interface AgentDefinition {
    id: string;
    name: string;
    description: string;
    version: string;

    instructionSourceIds: string[];
    skillIds: string[];

    preferredModels: string[];
    allowedModels?: string[];

    allowedTools: string[];
    forbiddenTools: string[];

    contextProfileId?: string;
    outputSchemaId?: string;

    autonomyLevel:
        | "suggest"
        | "confirm"
        | "execute";

    source?: string;
    license?: string;
    checksum?: string;

    createdAt: string;
    updatedAt: string;
}
```

---

## 25. Moduli architetturali aggiuntivi

Aggiungere alla piattaforma:

```text
packages/
├── instruction-manager/
├── prompt-composer/
├── agent-registry/
├── skill-registry/
├── policy-engine/
├── package-registry/
└── agent-test-runner/
```

Responsabilità:

### Instruction Manager

- scoperta file;
- parsing;
- normalizzazione;
- priorità;
- override;
- versionamento.

### Prompt Composer

- composizione deterministica;
- controllo conflitti;
- output finale;
- provenance.

### Agent Registry

- catalogo;
- versioni;
- associazioni;
- selezione;
- import/export.

### Skill Registry

- capacità;
- input;
- tool;
- rischi;
- dipendenze.

### Policy Engine

- permessi;
- privacy;
- sicurezza;
- conferme;
- modelli autorizzati.

### Agent Test Runner

- test funzionali;
- test di sicurezza;
- regressioni;
- metriche.

---

## 26. ADR aggiuntivi

```text
ADR-011 Hierarchical instruction composition
ADR-012 Non-overridable global constraints
ADR-013 Agent as versioned configuration
ADR-014 Separation between agents, skills, tools and recipes
ADR-015 Visual editor with YAML portability
ADR-016 Agent and skill testing
ADR-017 Signed community packages
ADR-018 Context policy bound to agent and skill
```

---

## 27. Orizzonte di prodotto

Questa sequenza esprime dipendenze concettuali di lungo periodo e non sostituisce
la roadmap operativa in `ROADMAP.md`. Il Core MVP alpha resta software-only:
Project Registry, ingestion controllata, ricerca storica bounded, active memory
curata, Work Item e handoff verificabili. La GUI foreground loopback
implementata copre ora il primo journey progetto/ricerca/source e il lifecycle
completo dell'active memory source-linked; ADR-0015 ne registra il boundary
browser locale. La GUI copre ora anche Work Item, handoff, localizzazione
inglese/italiano, anteprima delle effective instruction e una prima anteprima
Context Pack read-only con budget exact-byte e input espliciti. La misurazione
developer implementata riporta ora byte esatti candidati,
inclusi e omessi su un corpus Context Pack sintetico deterministico; non cambia
la policy di selezione e non avanza claim di rilevanza o produzione. Un
confronto di granularità solo sperimentale conserva metadata completi di
sezione e identità di risoluzione immutabile nei livelli reference, outline e
full. Il risultato negativo sul budget standard non abilita alcun livello nel
builder di produzione. Un confronto exact-byte successivo espande in modo
lossless le alternative con source table e tabella completa dei metadata nelle
stesse sezioni logiche. ADR-0016 accetta la source table come direzione per un
Context Pack versionato: crea l'unico nuovo fit compact sul budget standard ed
è più piccola della tabella metadata completa in ogni profilo. Sprint 17 la
implementa come schema v2 con compatibilità schema v1 esplicita, accounting
marginale deterministico dei byte condivisi, espansione lossless e ispezione
GUI bilingue. Persistenza, delivery ed esecuzione restano assenti.
Sprint 18 aggiunge il primo boundary portabile schema v1 per agenti e skill: un
bundle JSON project-scoped esplicito contiene un agente ed esattamente le skill
abilitate, valida versioni e relazioni modello/tool/contesto/conferma e compie
round trip JSON canonici. La GUI bilingue ispeziona input sintetici locali con
digest pinning come dati descrittivi `USER_CONFIGURED`. Non vengono abilitati
registry, installazione, risoluzione disponibilità, selezione, permessi,
delivery o esecuzione.
Sprint 19 aggiunge il boundary successivo di composizione in sola lettura.
L'utente seleziona esplicitamente un profilo revisionato, l'insieme esatto
delle sorgenti istruzioni dichiarate, un modello consentito e un handoff
immutabile. Il profilo fornisce il target AGENT e i budget exact-byte di
continuità/istruzioni; il composer deterministico e il Context Builder schema
v2 invariato producono un envelope transiente con digest del profilo,
provenance delle dichiarazioni e delle regole, elementi inclusi, omissioni e
accounting. I selettori context include/exclude restano descrittivi e non
risolti. Non vengono abilitati registry, selezione automatica, verifica di
disponibilità, persistenza, permessi, delivery o esecuzione.
Sprint 20 misura, senza attivare, un mapping uno-a-uno fra otto selector
profilo `handoff.*` e le sezioni di continuità esistenti. Un safety floor non
escludibile di obiettivo/repository/prossima azione/riferimenti sorgente
conserva identità del task e provenance. Su nove casi policy/profilo e 27
budget, i fit passano da 9 a 12 e i byte candidati storici ripetuti scendono del
49,89% con perdita floor zero. La decisione `adapt` mantiene projection e
report bilingue solo come misurazione perché non esistono evidenze di
rilevanza/qualità resume né accounting source-table schema v2 che giustifichino
semantica di produzione. Selector arbitrari, retrieval, permessi e comportamento
Context Builder restano invariati. Sprint 21 congela sei consumer sintetici
digest-pinned prima di applicare tali policy. La valutazione exact e model-free
conserva 0/9 risposte richieste per floor-only, 5/9 per focused e 7/9 per
risk-aware; tutte conservano 6/6 prime azioni attese, mentre la copertura source
richiesta è rispettivamente 0/15, 9/15 e 13/15. Nessuna policy preserva il
corpus. L'accounting schema v2 separato include l'unione marginale della source
table canonica e coincide con il builder di produzione sulle baseline complete,
ma i fit v1 e v2 restano entrambi 18/54. Le decisioni su evidenza e fit sono
entrambe `no change`: non vengono introdotti ADR, attivazione policy, modifiche
builder/schema, controlli GUI, persistenza, delivery o esecuzione. Backend
indicizzati, model access, retrieval Context Builder più ampio e orchestrazione
richiedono ancora vertical slice e ADR dedicati.

### MVP 1 — Project Memory

- scansione repository;
- session acquisition;
- backend di ricerca sostituibile;
- ricerca globale;
- AGENTS.md;
- HANDOFF.md;
- decision log;
- UI minima;
- MCP di ricerca.

### MVP 2 — Instruction and Agent Management

- file globale di istruzioni;
- istruzioni workspace e progetto;
- estensioni per modello;
- Prompt Composer;
- anteprima istruzioni effettive;
- Agent Registry;
- Skill Registry;
- selezione da UI;
- editor Markdown/YAML;
- permessi;
- configurazioni versionate.

### MVP 3 — Context Optimization

- Context Builder;
- token budget;
- progressive disclosure;
- deduplicazione;
- compressione;
- code graph;
- artifact store;
- metriche.

### MVP 4 — Privacy Proxy

- anonimizzazione;
- recognizer personalizzati;
- mapping reversibile;
- cifratura;
- privacy inspector;
- policy per modello.

### MVP 5 — Tool Registry

- catalogo script;
- manifest;
- ricerca;
- esecuzione;
- sandbox;
- recipe;
- test;
- suggerimenti automatici.

### MVP 6 — Multi-agent Orchestration

- planner;
- implementer;
- reviewer;
- adapter agenti;
- worktree;
- routing;
- fallback;
- handoff automatici.

### MVP 7 — Community Registry

- pacchetti agenti;
- pacchetti skill;
- firma;
- trust;
- marketplace o catalogo;
- installazione da repository;
- aggiornamenti e compatibility check.



---

## 28. Repository documentali

La piattaforma deve supportare non soltanto repository software, ma anche workspace composti prevalentemente da documenti.

Un repository documentale può essere:

- una cartella locale;
- un repository Git;
- un archivio di progetto;
- un'esportazione da un documentale;
- un insieme di PDF, DOCX, ODT, Markdown, fogli di calcolo, presentazioni, email e allegati;
- un workspace misto contenente codice e documentazione.

L'obiettivo è consentire all'utente di:

- indicizzare grandi raccolte documentali;
- ricercare contenuti storici;
- analizzare documenti;
- confrontare versioni;
- estrarre requisiti;
- individuare contraddizioni e lacune;
- aggiungere osservazioni persistenti;
- generare documenti derivati;
- riprendere analisi interrotte senza ricaricare ogni volta tutte le fonti nel modello.

### 28.1 Tipi di repository

Il progetto deve supportare almeno i seguenti profili:

```text
SOFTWARE
DOCUMENTS
MIXED
LEGAL
TECHNICAL
RESEARCH
TENDER
QUALITY
POLICY
```

Un repository `MIXED` può contenere:

- codice;
- documentazione tecnica;
- capitolati;
- verbali;
- diagrammi;
- fogli di calcolo;
- manuali;
- note progettuali;
- allegati.

### 28.2 Parallelismo tra codice e documenti

| Repository software | Repository documentale |
|---|---|
| file sorgenti | documenti |
| simboli e funzioni | sezioni, paragrafi, tabelle e concetti |
| dipendenze tra moduli | riferimenti e relazioni tra documenti |
| commit e diff | revisioni e modifiche |
| errori e test | incongruenze, lacune e verifiche |
| code review | revisione critica |
| patch | proposta di modifica |
| `HANDOFF.md` | stato dell'analisi |
| decisioni architetturali | osservazioni e conclusioni |

Questa equivalenza deve riflettersi nell'architettura, nei Work Item, nel Context Builder e nella UI.

---

## 29. Pipeline documentale

```text
Cartella documenti
        ↓
Rilevamento file
        ↓
Parsing e normalizzazione
        ↓
Anonimizzazione
        ↓
Chunking strutturale
        ↓
Estrazione metadati
        ↓
Indicizzazione OpenSearch
        ↓
Estrazione relazioni
        ↓
Analisi tramite agenti
        ↓
Annotazioni e documenti derivati
```

### 29.1 Formati supportati

Formati iniziali:

- PDF;
- DOCX;
- ODT;
- Markdown;
- TXT;
- HTML;
- CSV;
- XLSX;
- PPTX;
- email;
- immagini;
- PDF scansionati tramite OCR opzionale.

### 29.2 Parsing strutturale

I documenti non devono essere trattati come testo piatto.

Per ogni contenuto devono essere conservati, quando disponibili:

- documento;
- versione;
- pagina;
- sezione;
- titolo;
- paragrafo;
- tabella;
- nota;
- allegato;
- autore;
- data;
- riferimenti;
- posizione originale;
- coordinate o bounding box;
- hash del contenuto;
- lingua;
- stato di validità.

Esempio:

```json
{
  "documentType": "document_chunk",
  "repositoryId": "sample-tender-2026",
  "documentId": "technical-specification",
  "file": "Technical-Specification.pdf",
  "page": 17,
  "section": "4.2 Requisiti di sicurezza",
  "content": "Il fornitore deve garantire...",
  "contentHash": "sha256:...",
  "version": "2026-06-14",
  "sourceRef": "artifact://sha256/..."
}
```

### 29.3 Chunking documentale

Il chunking deve seguire la struttura logica.

Per i documenti:

- sezione;
- sottosezione;
- paragrafo;
- tabella;
- elenco;
- nota;
- allegato;
- blocco normativo;
- requisito.

Per le chat collegate:

- domanda e risposta;
- messaggi consecutivi;
- tool call con relativo risultato.

Ogni chunk deve mantenere il riferimento alla fonte originale.

---

## 30. Indicizzazione documentale in OpenSearch

OpenSearch deve consentire di recuperare:

- parole esatte;
- frasi;
- concetti;
- sezioni;
- requisiti;
- riferimenti;
- note;
- osservazioni;
- versioni precedenti;
- documenti correlati.

### 30.1 Tipologie documentali aggiuntive

```text
document
document_chunk
document_version
document_section
requirement
annotation
observation
question
risk
contradiction
traceability_link
generated_document
```

### 30.2 Ricerca documentale

Query possibili:

```text
"tempo massimo di ripristino"
type:requirement
repository:sample-tender-2026
section:"sicurezza"
status:open
severity:high
```

La ricerca deve combinare:

- full-text;
- phrase matching;
- semantic search;
- filtri;
- metadati;
- relazioni;
- versione;
- stato;
- provenienza.

### 30.3 Risultati con provenienza

Ogni risultato deve mostrare almeno:

- file;
- pagina;
- sezione;
- versione;
- data;
- estratto;
- tipo;
- stato;
- fonte originale.

---

## 31. Annotazioni persistenti

Le osservazioni non devono restare soltanto nella chat.

Ogni annotazione deve poter essere collegata a una posizione precisa del documento.

```typescript
interface DocumentAnnotation {
    id: string;
    repositoryId: string;
    documentId: string;
    versionId: string;

    location: {
        page?: number;
        section?: string;
        paragraph?: string;
        textRange?: string;
        boundingBox?: number[];
    };

    type:
        | "note"
        | "issue"
        | "question"
        | "contradiction"
        | "requirement"
        | "suggestion"
        | "risk";

    content: string;

    severity?:
        | "low"
        | "medium"
        | "high"
        | "critical";

    sourceRefs: string[];

    status:
        | "open"
        | "resolved"
        | "obsolete";

    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
```

### 31.1 Tipi di annotazione

- nota;
- criticità;
- domanda;
- contraddizione;
- requisito;
- suggerimento;
- rischio;
- assunzione;
- evidenza;
- decisione.

### 31.2 File di supporto

Possibile struttura:

```text
.ai-workspace/
├── HANDOFF.md
├── ANALYSIS.md
├── OBSERVATIONS.md
├── QUESTIONS.md
├── SOURCES.md
├── DECISIONS.md
└── TRACEABILITY.csv
```

Le annotazioni possono essere conservate nel database ed esportate nei file.

---

## 32. Agent e skill per i documenti

Il registry deve supportare agenti specializzati in analisi documentale.

### 32.1 Agenti possibili

```text
Document Analyst
Critical Reviewer
Legal Reviewer
Technical Reviewer
Requirements Analyst
Consistency Checker
Evidence Collector
Report Writer
Executive Summary Writer
Compliance Reviewer
```

### 32.2 Skill possibili

```text
Compare documents
Extract requirements
Detect contradictions
Find missing information
Build traceability matrix
Summarize sections
Extract obligations
Generate critical observations
Produce revision comments
Draft final report
```

### 32.3 Esempio di agente

```yaml
id: requirements-analyst
name: Requirements Analyst
description: Estrae e normalizza requisiti da documenti tecnici e capitolati.

instructions: agents/requirements-analyst.md

skills:
  - requirement-extraction
  - document-comparison
  - traceability-matrix

allowed_tools:
  - document_search
  - document_read
  - annotation_create
  - traceability_link_create

context_profile:
  include:
    - active_documents
    - document_versions
    - previous_observations
    - project_constraints

output_schema:
  type: requirement-analysis
```

---

## 33. Workflow documentali

### 33.1 Analisi di copertura requisiti

Esempio:

```text
/progetti/sample-tender/
├── tender-rules.pdf
├── capitolato.docx
├── clarifications.pdf
├── technical-proposal.docx
└── internal-notes.md
```

Work Item:

```text
Analizzare il capitolato e verificare se l'offerta tecnica
copre tutti i requisiti obbligatori.
```

Il sistema deve poter:

1. indicizzare tutti i documenti;
2. estrarre i requisiti;
3. assegnare un identificativo a ogni requisito;
4. collegare ogni requisito alle sezioni dell'offerta;
5. segnalare requisiti non coperti;
6. evidenziare coperture ambigue;
7. generare una matrice di tracciabilità;
8. produrre un documento di osservazioni;
9. conservare fonti e provenienza.

Esempio:

```text
REQUIREMENT-042
Fonte: capitolato, § 6.3, pagina 28
Stato: parzialmente coperto

Evidenza:
technical-proposal.docx, § 4.1

Osservazione:
La proposta descrive il backup giornaliero, ma non specifica
il tempo massimo di ripristino richiesto dal capitolato.
```

### 33.2 Revisione critica

Il sistema deve poter:

- individuare affermazioni prive di evidenza;
- evidenziare contraddizioni;
- rilevare terminologia incoerente;
- segnalare lacune;
- proporre domande;
- produrre osservazioni;
- generare un documento revisionato.

### 33.3 Analisi comparativa

Confronto tra:

- offerte;
- versioni;
- capitolati;
- policy;
- contratti;
- manuali;
- relazioni;
- proposte progettuali.

### 33.4 Ripresa del lavoro

Quando un'analisi viene riaperta, il sistema deve recuperare:

- stato corrente;
- documenti coinvolti;
- versioni;
- osservazioni aperte;
- decisioni;
- domande;
- output già prodotti;
- fonti citate;
- prossime attività.

---

## 34. Confronto tra versioni

La piattaforma deve supportare il versionamento dei documenti.

Esempio:

```text
Technical-Specification_v1.pdf
Technical-Specification_v2.pdf
```

Il sistema deve rilevare:

- sezioni aggiunte;
- sezioni eliminate;
- requisiti modificati;
- valori numerici cambiati;
- scadenze cambiate;
- allegati sostituiti;
- riferimenti aggiornati;
- implicazioni sulle analisi precedenti.

Non deve limitarsi al diff testuale.

Deve poter produrre un diff semantico:

```text
La versione 2 riduce il tempo massimo di ripristino
da 8 ore a 4 ore.
```

### 34.1 Invalidazione delle analisi

Quando una fonte cambia, il sistema deve individuare:

- annotazioni potenzialmente obsolete;
- requisiti modificati;
- osservazioni da riesaminare;
- documenti derivati da rigenerare;
- decisioni dipendenti dalla versione precedente.

---

## 35. Document Graph

L'equivalente documentale del code graph è un Document Graph.

### 35.1 Nodi

- repository;
- documenti;
- versioni;
- sezioni;
- requisiti;
- persone;
- organizzazioni;
- normative;
- sistemi;
- decisioni;
- osservazioni;
- rischi;
- domande;
- output derivati.

### 35.2 Relazioni

```text
DOCUMENT CONTAINS SECTION
SECTION CONTAINS REQUIREMENT
DOCUMENT REFERENCES DOCUMENT
DOCUMENT REFERENCES REGULATION
OFFER_SECTION SATISFIES REQUIREMENT
OBSERVATION CRITICIZES SECTION
ANNOTATION REFERS_TO DOCUMENT_VERSION
VERSION SUPERSEDES VERSION
DECISION BASED_ON DOCUMENT
GENERATED_DOCUMENT DERIVED_FROM SOURCE
```

### 35.3 Query possibili

```text
Quali osservazioni dipendono da un requisito modificato
nell'ultima versione del capitolato?
```

```text
Quali requisiti obbligatori non hanno ancora una sezione
di copertura nell'offerta tecnica?
```

```text
Quali conclusioni dipendono esclusivamente da una fonte
ora obsoleta?
```

---

## 36. Generazione di documenti derivati

La piattaforma deve poter produrre:

- relazione critica;
- report di conformità;
- matrice requisiti/copertura;
- executive summary;
- elenco delle lacune;
- domande di chiarimento;
- verbale;
- documento revisionato;
- risposta a un capitolato;
- piano di adeguamento;
- confronto tra alternative;
- documento con note e osservazioni.

Ogni affermazione generata deve mantenere la provenienza.

Esempio:

```markdown
## Osservazione 12

Il documento non specifica il requisito di disponibilità
del servizio.

Fonti:

- Capitolato, § 8.2, pagina 41
- Offerta tecnica, § 5.4, pagina 33
```

### 36.1 Formati di output

- Markdown;
- DOCX;
- PDF;
- HTML;
- CSV;
- XLSX;
- JSON strutturato.

### 36.2 Verificabilità

Ogni output deve mantenere:

- fonti;
- riferimenti;
- versioni;
- agenti coinvolti;
- modello utilizzato;
- istruzioni applicate;
- timestamp;
- eventuali approvazioni dell'utente.

---

## 37. Context Builder documentale

Il Context Builder deve poter costruire context pack documentali.

Esempio:

```yaml
context_pack:
  objective: Verificare la copertura dei requisiti di sicurezza

  repository:
    type: DOCUMENTS
    id: sample-tender-2026

  mandatory:
    - active_requirements
    - current_observations
    - latest_document_versions

  retrieve:
    - type: document_section
      query: sicurezza
      limit: 12

    - type: requirement
      status: active
      limit: 50

    - type: observation
      status: open
      limit: 20

  token_budget:
    total: 20000
    sources: 12000
    observations: 3000
    instructions: 2500
    output_constraints: 2500
```

Il sistema deve evitare di inviare ogni volta l'intero repository documentale.

---

## 38. Risparmio token nei repository documentali

Le strategie principali sono:

- indicizzazione preventiva;
- retrieval mirato;
- chunking strutturale;
- progressive disclosure;
- riuso delle osservazioni;
- riuso dei riassunti;
- cache;
- deduplicazione;
- confronto incrementale tra versioni;
- artifact store;
- modelli locali per classificazione ed estrazione preliminare.

Flusso:

1. OpenSearch trova le sezioni rilevanti;
2. il Document Graph ricostruisce le relazioni;
3. il Context Builder seleziona le fonti;
4. il modello riceve un context pack ridotto;
5. le osservazioni già validate vengono riutilizzate;
6. gli output precedenti restano disponibili.

---

## 39. Estensione del Work Item

Il Work Item deve essere indipendente dal tipo di repository.

```text
Work Item
├── obiettivo
├── repository
├── tipo repository
├── fonti
├── versioni
├── agenti
├── skill
├── istruzioni
├── contesto
├── annotazioni
├── evidenze
├── output
├── verifiche
└── handoff
```

Tipi di Work Item possibili:

```text
CODE_CHANGE
CODE_REVIEW
DOCUMENT_ANALYSIS
DOCUMENT_COMPARISON
REQUIREMENT_EXTRACTION
CRITICAL_REVIEW
REPORT_GENERATION
COMPLIANCE_CHECK
MIXED_ANALYSIS
```

La forma unificata descritta sopra è una direzione di estensibilità successiva,
non il confine di accettazione del Core MVP. Il primo handoff cross-agent
supporta soltanto un Work Item software esplicito con stato dell'obiettivo
limitato e snapshot di handoff additivi. Analisi documentale, repository misti,
budget del Context Builder, skill, cost accounting e orchestrazione restano
incrementi successivi e non sono requisiti per completare il Core MVP alpha.

---

## 40. Interfaccia per repository documentali

### 40.1 Document Explorer

La UI deve mostrare:

- struttura delle cartelle;
- documenti;
- versioni;
- sezioni;
- annotazioni;
- osservazioni;
- requisiti;
- relazioni;
- output derivati.

### 40.2 Viewer

Il viewer deve permettere:

- visualizzazione documento;
- navigazione per pagina e sezione;
- evidenziazione delle fonti;
- annotazioni;
- collegamenti tra documenti;
- confronto versioni;
- apertura dei risultati di ricerca.

### 40.3 Pannello analisi

```text
Repository: sample-tender-2026
Work Item: Verifica copertura requisiti

Agent:
Requirements Analyst

Skills:
✓ Extract requirements
✓ Compare documents
✓ Build traceability matrix

Sources:
✓ Technical-Specification.pdf
✓ Technical-Proposal.docx
✓ Chiarimenti.pdf

Open observations:
14

Context:
12.340 token
```

### 40.4 Azioni

```text
[Search]
[Compare versions]
[Extract requirements]
[Add observation]
[Generate report]
[Preview context]
[Export]
```

---

## 41. Persistenza aggiuntiva per documenti

Tabelle indicative:

```text
document_repositories
documents
document_versions
document_sections
document_chunks
document_annotations
requirements
requirement_links
traceability_links
document_relations
generated_documents
document_analysis_runs
```

OpenSearch deve indicizzare:

- documento;
- versione;
- chunk;
- annotazione;
- requisito;
- osservazione;
- output derivato.

L'Artifact Store deve conservare:

- file originali;
- file convertiti;
- OCR;
- estrazioni strutturate;
- versioni;
- output generati.

---

## 42. Moduli architetturali aggiuntivi per documenti

```text
packages/
├── document-registry/
├── document-parser/
├── document-indexer/
├── document-graph/
├── annotation-manager/
├── requirement-manager/
├── traceability/
├── document-diff/
└── document-generator/
```

### Document Registry

- repository;
- documenti;
- versioni;
- metadati;
- stato.

### Document Parser

- parsing;
- conversione;
- estrazione struttura;
- OCR opzionale.

### Document Indexer

- chunking;
- OpenSearch;
- embeddings;
- aggiornamento incrementale.

### Document Graph

- entità;
- riferimenti;
- relazioni;
- dipendenze.

### Annotation Manager

- note;
- osservazioni;
- domande;
- rischi;
- workflow di risoluzione.

### Requirement Manager

- estrazione;
- normalizzazione;
- stato;
- priorità;
- provenienza.

### Traceability

- collegamento requisito-evidenza;
- matrici;
- copertura;
- lacune.

### Document Diff

- diff testuale;
- diff strutturale;
- diff semantico;
- invalidazione analisi.

### Document Generator

- template;
- output;
- citazioni;
- esportazione;
- provenance.

---

## 43. ADR aggiuntivi per repository documentali

```text
ADR-019 Documents as first-class repositories
ADR-020 Structural document chunking
ADR-021 Persistent annotations
ADR-022 Document Graph
ADR-023 Semantic version comparison
ADR-024 Provenance for generated documents
ADR-025 Requirement traceability
ADR-026 Unified Work Item for code and documents
```

---

## 44. Roadmap documentale

### Document MVP 1

- registrazione cartelle documentali;
- parsing PDF, DOCX, Markdown e TXT;
- OpenSearch;
- ricerca full-text;
- viewer;
- annotazioni;
- provenance.

### Document MVP 2

- semantic search;
- estrazione requisiti;
- agenti documentali;
- report con citazioni;
- Context Builder documentale.

### Document MVP 3

- confronto versioni;
- Document Graph;
- matrice di tracciabilità;
- invalidazione automatica delle osservazioni.

### Document MVP 4

- OCR;
- fogli di calcolo;
- presentazioni;
- email;
- workflow di compliance;
- repository misti codice-documenti.


## 45. Interfaccia utente

### 45.1 Home

- progetto corrente;
- agenti;
- task;
- handoff;
- token;
- costi;
- tool suggeriti;
- errori di sincronizzazione;
- stato privacy.

### 45.2 Project Explorer

- repository;
- branch;
- worktree;
- AGENTS;
- handoff;
- decisioni;
- sessioni;
- documenti;
- task;
- script;
- code graph.

### 45.3 Universal Search

```text
Ctrl+K

> postgres owner restore
> @project:myproject oauth retry
> type:script markdown pdf
> decision:"no async/await"
```

### 45.4 Session Cockpit

```text
Project: sample-backend
Branch: feature/oauth-retry
Agent: Claude Code
Privacy: PII_AND_SECRETS
Context budget: 14.200 / 20.000

Context included:
✓ AGENTS.md
✓ HANDOFF.md
✓ 3 decisions
✓ 6 code symbols
✓ 1 previous error
```

### 45.5 Privacy Inspector

Tre viste:

```text
Originale
Anonimizzato
Deanonimizzato
```

### 45.6 Token Analytics

- token originali stimati;
- token inviati;
- token risparmiati;
- cache hit;
- output compressi;
- costi;
- distribuzione per modello;
- distribuzione per progetto;
- tempo di ripresa.

---

## 46. Osservabilità e metriche

Metriche suggerite:

```text
token_input_original_estimated
token_input_sent
compression_ratio
retrieval_tokens
cache_hit_tokens
tool_output_tokens_avoided
context_reconstruction_tokens_avoided
cost_actual
cost_baseline
time_to_first_useful_change
number_of_repeated_attempts
handoff_success_rate
context_precision
```

Le misure devono distinguere valori esatti, valori osservati dalle API dei
provider e stime. Finché non esistono invocazioni reali, gli exact UTF-8 bytes
sono la baseline primaria riproducibile e ogni conversione in token resta
esplicitamente stimata. Claim comparativi richiedono una baseline nominata,
fixture riproducibili e risultati negativi pubblicati.

### 46.1 Time-to-resume

Tempo tra:

- apertura del progetto;
- prima azione corretta dell'agente.

### 46.2 Baseline

Ogni risparmio deve dichiarare la baseline.

```text
Risparmio stimato rispetto a:
sessione completa non compressa
```

---

## 47. Sicurezza

### 47.1 Threat model

Il progetto deve considerare:

- accesso non autorizzato al disco;
- furto del mapping di anonimizzazione;
- prompt injection;
- script malevoli;
- tool che accedono alla rete;
- fuga di credenziali;
- log contenenti segreti;
- modelli cloud non autorizzati;
- plugin non affidabili;
- repository malevoli;
- output deanonimizzati incorrettamente.

### 47.2 Requisiti

- cifratura dei dati sensibili;
- secret store;
- sandbox per gli script;
- capability model;
- autorizzazioni per file e rete;
- audit log;
- policy per modello;
- conferma per azioni distruttive;
- firma o checksum degli artefatti;
- isolamento tra workspace;
- redazione dei log.

### 47.3 Policy per modello

```yaml
models:
  local:
    allowed_data:
      - all

  enterprise_cloud:
    allowed_data:
      - source_code
      - pseudonymized_business_data

  public_cloud:
    allowed_data:
      - anonymized_text
    forbidden:
      - credentials
      - customer_documents
```

---

## 48. Architettura logica

```text
┌─────────────────────────────────────────────────────────┐
│                    Web / Desktop UI                     │
│ projects · search · sessions · privacy · costs · tools │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                    Control Plane API                    │
│                                                        │
│ Project Registry         Context Builder               │
│ Session Manager          Task/Handoff Manager          │
│ Search Service           Script/Recipe Registry        │
│ Privacy Policy           Cost & Token Analytics        │
│ Model Router             Agent Adapter Manager         │
└───────┬──────────┬────────────┬─────────────┬───────────┘
        │          │            │             │
        ▼          ▼            ▼             ▼
  Memory Layer  Presidio    Code Graph    Model Gateway
        │          │            │             │
        └──────────┴──────┬─────┴─────────────┘
                          ▼
            Claude · Codex · Gemini · Local
```

---

## 49. Candidati di persistenza

Le sezioni seguenti descrivono opzioni per incrementi futuri, non dipendenze
del Core MVP. La baseline accettata usa file locali schema-versionati dietro
porte sostituibili. Una nuova tecnologia di persistenza richiede un bisogno
verticale, misure operative e un ADR.

### 49.1 PostgreSQL candidato

Tabelle indicative:

```text
workspaces
projects
repositories
sessions
events
tasks
handoffs
memories
decisions
failures
tools
recipes
executions
anonymization_rules
anonymization_maps
usage_metrics
model_policies
artifacts
```

### 49.2 OpenSearch candidato

- ricerca full-text;
- ricerca ibrida;
- filtri;
- aggregazioni;
- indicizzazione storica.

### 49.3 Vector store

Per un MVP:

- OpenSearch vector search;
- oppure PostgreSQL con pgvector.

Evitare inizialmente datastore ridondanti senza necessità.

### 49.4 Object store o filesystem

Per:

- trascrizioni;
- file;
- log;
- diff;
- report;
- output;
- mapping cifrati.

---

## 50. Architettura tecnologica iniziale

Possibile stack:

### Backend

- TypeScript;
- Node.js;
- API REST e/o GraphQL;
- WebSocket o SSE per eventi;
- MCP server;
- plugin system.

### Frontend

- Angular o React;
- applicazione web locale;
- eventuale wrapper Tauri.

### Servizi candidati

- PostgreSQL;
- OpenSearch;
- servizio Python per anonimizzazione;
- code graph;
- model gateway;
- daemon locale.

La presenza in questo elenco non autorizza l'introduzione di runtime, database,
listener, framework o servizi. Il default resta un modular monolith locale;
ogni componente viene selezionato separatamente quando un caso d'uso misurato
lo richiede.

### Deploy

- Docker Compose per sviluppo;
- binario o installer desktop in seguito;
- immagini container versionate;
- configurazione tramite file YAML e variabili ambiente.

---

## 51. Componenti integrabili

Componenti da valutare senza replicarne inutilmente le funzionalità:

| Esigenza | Componente candidato |
|---|---|
| Compressione e memoria cross-agent | Headroom |
| Riduzione output CLI | RTK |
| Gateway multi-modello | LiteLLM |
| Code graph | CodeGraph |
| Standard istruzioni progetto | AGENTS.md |
| Anonimizzazione | Microsoft Presidio |
| Memory layer generalista | Mem0 / OpenMemory |
| Protocollo tool | MCP |
| Tracing | OpenTelemetry / Langfuse |
| Ricerca | OpenSearch |
| Vector search | OpenSearch / pgvector |
| Modelli locali | Ollama / llama.cpp |

L'integrazione deve avvenire tramite adapter, evitando dipendenze rigide.

---

## 52. Entità centrale: Work Item

L'oggetto centrale della piattaforma dovrebbe essere il Work Item.

```text
WORK ITEM
```

Contiene:

```text
obiettivo
progetto
repository
branch
worktree
stato
decisioni
vincoli
contesto
agenti
modelli
output
verifiche
handoff
costi
token
artefatti
```

Flusso principale:

```text
CERCA
  -> RIPRENDI
  -> COMPONI CONTESTO
  -> SCEGLI AGENTE
  -> ESEGUI
  -> VERIFICA
  -> CONSOLIDA
  -> RIUTILIZZA
```

---

## 53. Evoluzione della roadmap

La roadmap originale è stata consolidata nell'orizzonte di prodotto della
sezione 27 e nella roadmap operativa versionata del repository. La precedente
numerazione parallela non è più normativa, perché rendeva ambiguo l'ordine tra
Context Builder, privacy, tool e orchestrazione.

Le aree future restano memoria e ricerca storica; istruzioni, agenti e skill;
Context Builder e ottimizzazione misurata; privacy gateway; tool registry con
enforcement; workflow documentali; orchestrazione multi-agent; e distribuzione
comunitaria. Quest'ultima resta una direzione senza scadenza finché non esiste
evidenza d'uso sufficiente a giustificare firma, review e trust dei pacchetti.

---

## 54. Requisiti non funzionali

### Prestazioni

- ricerca percepita come immediata;
- indicizzazione incrementale;
- aggiornamento code graph incrementale;
- context building entro pochi secondi;
- nessun blocco dell'utente durante l'indicizzazione.

### Affidabilità

- event log append-only;
- elaborazioni idempotenti;
- retry;
- recupero dopo crash;
- versionamento schema;
- backup;
- reindex.

### Portabilità

- Linux prioritario;
- supporto successivo a macOS e Windows;
- containerizzazione;
- storage configurabili.

### Estendibilità

- plugin;
- adapter;
- hook;
- API;
- MCP;
- manifest;
- eventi.

### Manutenibilità

- modular monolith iniziale;
- confini chiari;
- migrazioni;
- test;
- documentazione;
- observability.

---

## 55. Struttura repository proposta

```text
ai-workspace/
├── apps/
│   ├── server/
│   ├── web/
│   ├── desktop/
│   └── cli/
│
├── packages/
│   ├── core/
│   ├── project-registry/
│   ├── session-manager/
│   ├── context-builder/
│   ├── search/
│   ├── memory/
│   ├── privacy/
│   ├── model-router/
│   ├── agent-adapters/
│   ├── tool-registry/
│   ├── artifact-store/
│   ├── telemetry/
│   └── shared/
│
├── services/
│   ├── presidio/
│   └── codegraph/
│
├── integrations/
│   ├── headroom/
│   ├── codex/
│   ├── claude-code/
│   ├── litellm/
│   └── mcp/
│
├── deploy/
│   ├── docker-compose/
│   ├── docker/
│   └── kubernetes/
│
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── security/
│   ├── development/
│   └── user-guide/
│
├── examples/
├── scripts/
├── AGENTS.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── LICENSE
└── README.md
```

Per il primo MVP può essere preferibile un monorepo semplice.

---

## 56. Decisioni architetturali iniziali

Le decisioni importanti dovrebbero essere registrate come ADR.

Esempi:

```text
ADR-001 Local-first architecture
ADR-002 OpenSearch for historical retrieval
ADR-003 PostgreSQL as transactional store
ADR-004 Separation between memory and historical index
ADR-005 Artifact store for large payloads
ADR-006 Agent adapters
ADR-007 Reversible anonymization
ADR-008 Work Item as aggregate root
ADR-009 Modular monolith for MVP
ADR-010 MCP as tool integration protocol
```

---

## 57. Strategia open source

### 57.1 Obiettivi

- rendere il progetto installabile localmente;
- favorire contributi;
- consentire integrazioni;
- evitare lock-in;
- supportare self-hosting;
- costruire una comunità tecnica.

### 57.2 Licenza

Il progetto usa la **Apache License 2.0**. I termini permissivi e la concessione
esplicita sui brevetti favoriscono l'adozione, l'uso commerciale e
l'integrazione con ecosistemi di agenti, modelli e plugin.

### 57.3 File iniziali

- `README.md`;
- `LICENSE`;
- `CONTRIBUTING.md`;
- `CODE_OF_CONDUCT.md`;
- `SECURITY.md`;
- `GOVERNANCE.md`;
- `ROADMAP.md`;
- `ARCHITECTURE.md`;
- `CHANGELOG.md`;
- issue templates;
- pull request template;
- decision log;
- threat model.

### 57.4 Governance

Definire:

- maintainer;
- processo di approvazione;
- policy per breaking change;
- release;
- sicurezza;
- gestione plugin;
- compatibilità;
- supporto versioni.

---

## 58. Questioni aperte

1. Come acquisire in modo affidabile le sessioni dei diversi agenti?
2. Quali agenti espongono hook o transcript riutilizzabili?
3. Headroom può diventare il proxy principale o deve essere un adapter opzionale?
4. OpenSearch deve gestire anche gli embeddings o è preferibile pgvector?
5. Gli originali sensibili devono essere indicizzati localmente o solo conservati cifrati?
6. Qual è il modello di sandbox per gli script?
7. Come distinguere automaticamente decisioni, ipotesi e fatti?
8. Quando una memoria deve essere invalidata?
9. Come verificare che un handoff descriva lo stato reale?
10. Come misurare in modo credibile i token risparmiati?
11. Qual è il livello di supporto per agenti CLI non controllabili tramite API?
12. L'MVP deve essere daemon + web UI oppure applicazione desktop?
13. Quale meccanismo usare per importare conversazioni storiche?
14. Come impedire che contenuti indicizzati provochino prompt injection durante il retrieval?

---

## 59. Success criteria dell'MVP

L'MVP può essere considerato utile quando consente di:

1. registrare più repository locali;
2. acquisire una sessione di almeno due agenti diversi;
3. cercare una conversazione o soluzione precedente;
4. aprire il progetto corretto;
5. generare un handoff;
6. creare un context pack;
7. passare il task a un agente diverso;
8. evitare il caricamento completo della vecchia sessione;
9. mostrare token stimati risparmiati;
10. mantenere la provenienza di ogni informazione recuperata.

---

## 60. Possibile naming

Caratteristiche desiderabili:

- facile da ricordare;
- non legato a un singolo modello;
- coerente con memoria, continuità e orchestrazione;
- nome e dominio disponibili;
- assenza di conflitti con progetti esistenti.

Direzioni semantiche:

- handoff;
- relay;
- continuity;
- workspace;
- context;
- memory;
- bridge;
- compass;
- nexus;
- atlas;
- loom;
- switchboard.

Il naming dovrà essere verificato prima della pubblicazione.

---

## 61. Conclusione

La piattaforma deve risolvere un problema più ampio della semplice memoria degli agenti.

Il suo valore è creare continuità operativa tra:

- progetti;
- sessioni;
- agenti;
- modelli;
- strumenti;
- documenti;
- automazioni;
- decisioni.

La distinzione fondamentale è:

> La memoria conserva ciò che è attivo e consolidato.  
> OpenSearch conserva e rende ricercabile qualsiasi evidenza storica.  
> Il Context Builder decide cosa è utile inviare al modello.

Il risultato atteso è un **local-first AI workbench** con:

- memoria verificabile;
- ricerca universale;
- handoff tra agenti;
- context engineering automatico;
- privacy gateway;
- catalogo di automazioni;
- misurazione dei costi;
- riduzione concreta del consumo di token.

### Incremento implementato per l'ambito General

La GUI locale include una Posta `GENERAL`, indipendente dai progetti, per
domande esplicitamente scritte dall'utente. General non è un progetto
sintetico. Gli eventi immutabili usano uno store JSON atomico, separato e
bounded, integrità su byte UTF-8/hash esatti, provenance esplicita, stato
`UNVERIFIED` e classificazione predefinita `CONFIDENTIAL`. La ricerca letterale
bounded supporta `GENERAL_ONLY` e `ALL_SCOPES`; la ricerca project-only resta
isolata. La cattura non invoca modelli, non crea risposte assistant e non
promuove, consegna o esegue contenuto. Ricerca semantica e indicizzata restano
governate da evidenze.

ADR-0020 implementa anche link di provenance immutabili ed espliciti da
`GENERAL` a `PROJECT` in un secondo store schema-v1 atomico e bounded. Un link
lega l'hash esatto di un evento General a un progetto registrato scelto
esplicitamente e a una motivazione scritta dall'utente. La ricerca valida
entrambi gli ambiti, annota i risultati General e può filtrare per progetto
associato esplicito senza cambiare la proprietà `GENERAL`. I link non copiano
evidenza e non creano memoria attiva, istruzioni, permessi, consegna,
invocazione di modelli o esecuzione.

Sprint 25 ha misurato questo percorso canonico General/link con un corpus
sintetico development-only predefinito. Due run con 240 eventi e 120 link hanno
prodotto conteggi identici, zero miss esatti known-item, totali cold inferiori
a 88 ms, p95 warm su cinque query inferiore a 91 ms e pressione massima del
2,4% sui bound di produzione nell'host di sviluppo. La decisione `NO_CHANGE`
non aggiunge ADR FTS5/index né superfici runtime. I tempi sono osservazioni
locali; conteggi e gate deterministici sono riproducibili con
`npm run measure:general-links`.

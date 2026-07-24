# AI Workspace — Visione a lungo periodo

**Stato:** orizzonte esplorativo, non impegno di consegna  
**Licenza:** Apache License 2.0  
**Nota:** gli esempi usano nomi e identificativi fittizi.

Questo documento conserva la parte della visione che **non** appartiene
all'orizzonte di consegna corrente. È stato estratto senza modifiche dal
[documento di progettazione](AI_WORKSPACE_DESIGN_PUBLIC_IT.md) perché quel
documento era diventato molto più grande della capacità di consegna del
progetto, e mescolare ciò che viene costruito con ciò che è soltanto
immaginato rendeva impossibile capire quale delle due cose si stesse
leggendo.

Il contenuto qui raccolto resta valido come direzione e non è stato ridotto:
moduli architetturali aggiuntivi, ADR futuri, orizzonte di prodotto e
l'intero blocco dei workspace documentali. Niente di ciò che segue è
pianificato, deciso o promesso. Ogni componente citato diventa reale solo
attraverso un ADR evidence-led e uno sprint che lo implementi.

Per lo stato effettivo del prodotto:

- il documento di progettazione contiene la visione dell'orizzonte corrente;
- [`ROADMAP.md`](../ROADMAP.md) contiene il piano operativo corrente;
- [`docs/adr/`](adr/README.md) contiene le decisioni accettate;
- [`docs/architecture/README.md`](architecture/README.md) contiene ciò che è
  realmente implementato.

---

## 1. Moduli architetturali aggiuntivi

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

## 2. ADR aggiuntivi

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

## 3. Orizzonte di prodotto

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

## 4. Repository documentali

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

| Repository software      | Repository documentale                 |
| ------------------------ | -------------------------------------- |
| file sorgenti            | documenti                              |
| simboli e funzioni       | sezioni, paragrafi, tabelle e concetti |
| dipendenze tra moduli    | riferimenti e relazioni tra documenti  |
| commit e diff            | revisioni e modifiche                  |
| errori e test            | incongruenze, lacune e verifiche       |
| code review              | revisione critica                      |
| patch                    | proposta di modifica                   |
| `HANDOFF.md`             | stato dell'analisi                     |
| decisioni architetturali | osservazioni e conclusioni             |

Questa equivalenza deve riflettersi nell'architettura, nei Work Item, nel Context Builder e nella UI.

---

## 5. Pipeline documentale

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

## 6. Indicizzazione documentale in OpenSearch

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

## 7. Annotazioni persistenti

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

  severity?: "low" | "medium" | "high" | "critical";

  sourceRefs: string[];

  status: "open" | "resolved" | "obsolete";

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

## 8. Agent e skill per i documenti

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

## 9. Workflow documentali

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

## 10. Confronto tra versioni

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

## 11. Document Graph

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

## 12. Generazione di documenti derivati

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

## 13. Context Builder documentale

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

## 14. Risparmio token nei repository documentali

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

## 15. Estensione del Work Item

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

## 16. Interfaccia per repository documentali

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

## 17. Persistenza aggiuntiva per documenti

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

## 18. Moduli architetturali aggiuntivi per documenti

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

## 19. ADR aggiuntivi per repository documentali

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

## 20. Roadmap documentale

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

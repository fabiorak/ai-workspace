# AI Workspace — Long-Term Vision

**Status:** exploratory horizon, not a delivery commitment  
**License:** Apache License 2.0  
**Note:** all examples use fictional names and identifiers.

This document preserves the part of the vision that does **not** belong to the
current delivery horizon. It was extracted unchanged from the
[design document](AI_WORKSPACE_DESIGN_PUBLIC_EN.md), because that document had
grown far larger than the project's delivery capacity, and mixing what is being
built with what is merely imagined made it impossible to tell which one you were
reading.

The content collected here remains a valid direction and has not been reduced:
it is the complete document-workspace horizon. Nothing that follows is planned,
decided, or promised. Every component named here becomes real only through an
evidence-led ADR and a sprint that implements it.

For the actual state of the product:

- the design document holds the current-horizon vision;
- [`ROADMAP.md`](../ROADMAP.md) holds the current operational plan;
- [`docs/adr/`](adr/README.md) holds the accepted decisions;
- [`docs/architecture/README.md`](architecture/README.md) holds what is actually
  implemented.

---

## 1. Document Repositories

The platform should treat document repositories as first-class workspaces.

A document repository may be:

- a local folder;
- a Git repository;
- an exported document management archive;
- a collection of PDFs, DOCX files, spreadsheets, presentations, email, and attachments;
- a mixed repository containing both code and documents.

Repository profiles:

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

### 22.1 Code and document parallels

| Software repository    | Document repository                    |
| ---------------------- | -------------------------------------- |
| source files           | documents                              |
| symbols and functions  | sections, paragraphs, tables, concepts |
| module dependencies    | references and document relationships  |
| commits and diffs      | revisions and changes                  |
| errors and tests       | inconsistencies, gaps, verification    |
| code review            | critical review                        |
| patch                  | proposed revision                      |
| handoff                | analysis state                         |
| architecture decisions | observations and conclusions           |

---

## 2. Document Processing Pipeline

```text
Document folder
        ↓
File discovery
        ↓
Parsing and normalization
        ↓
Anonymization
        ↓
Structural chunking
        ↓
Metadata extraction
        ↓
OpenSearch indexing
        ↓
Relationship extraction
        ↓
Agent analysis
        ↓
Annotations and derived documents
```

### 23.1 Supported formats

Initial support should include:

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
- images;
- scanned PDFs through optional OCR.

### 23.2 Structural parsing

Documents must not be reduced to plain text.

Where available, preserve:

- document;
- version;
- page;
- section;
- heading;
- paragraph;
- table;
- note;
- attachment;
- author;
- date;
- references;
- original position;
- bounding box;
- content hash;
- language;
- validity status.

```json
{
  "documentType": "document_chunk",
  "repositoryId": "sample-tender-2026",
  "documentId": "technical-specification",
  "file": "Technical-Specification.pdf",
  "page": 17,
  "section": "4.2 Security Requirements",
  "content": "The supplier must guarantee...",
  "contentHash": "sha256:...",
  "version": "2026-06-14",
  "sourceRef": "artifact://sha256/..."
}
```

### 23.3 Structural chunking

Chunk boundaries should follow:

- section;
- subsection;
- paragraph;
- table;
- list;
- note;
- attachment;
- regulatory clause;
- requirement.

Every chunk must preserve source provenance.

---

## 3. Document Search and Annotations

OpenSearch should retrieve:

- exact phrases;
- concepts;
- sections;
- requirements;
- references;
- notes;
- observations;
- previous versions;
- related documents.

Example filters:

```text
"maximum recovery time"
type:requirement
repository:sample-tender-2026
section:"security"
status:open
severity:high
```

### 24.1 Persistent annotations

Annotations should be stored outside the chat and linked to precise document locations.

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

Suggested project files:

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

---

## 4. Document Agents and Skills

Possible agents:

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

Possible skills:

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

Example:

```yaml
id: requirements-analyst
name: Requirements Analyst
description: Extract and normalize requirements from technical documents.

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

## 5. Document Workflows

### 26.1 Requirements coverage analysis

Example repository:

```text
/projects/sample-tender/
├── tender-rules.pdf
├── Technical-Specification.pdf
├── clarifications.pdf
├── Technical-Proposal.docx
└── internal-notes.md
```

Work Item:

```text
Analyze the specification and verify whether the technical
proposal covers all mandatory requirements.
```

The system should:

1. index all documents;
2. extract requirements;
3. assign a stable identifier to each requirement;
4. connect requirements to proposal sections;
5. flag missing coverage;
6. flag ambiguous coverage;
7. generate a traceability matrix;
8. produce an observations report;
9. preserve provenance.

```text
REQUIREMENT-042
Source: specification, § 6.3, page 28
Status: partially covered

Evidence:
Technical-Proposal.docx, § 4.1

Observation:
The proposal describes daily backups but does not specify
the required maximum recovery time.
```

### 26.2 Critical review

The system should detect:

- unsupported claims;
- contradictions;
- inconsistent terminology;
- missing information;
- unclear obligations;
- unresolved assumptions.

### 26.3 Comparative analysis

Compare:

- offers;
- versions;
- specifications;
- policies;
- contracts;
- manuals;
- reports;
- project proposals.

### 26.4 Work resumption

When reopening an analysis, restore:

- current state;
- active document versions;
- open observations;
- decisions;
- questions;
- generated outputs;
- cited sources;
- next actions.

---

## 6. Document Version Comparison

The system should detect:

- added sections;
- removed sections;
- changed requirements;
- changed values;
- changed deadlines;
- replaced attachments;
- updated references;
- impact on previous analysis.

It must support semantic differences, not only textual diffs.

```text
Version 2 reduces the maximum recovery time from 8 hours to 4 hours.
```

When a source changes, the platform should identify:

- potentially obsolete annotations;
- changed requirements;
- observations requiring review;
- derived documents requiring regeneration;
- decisions based on superseded content.

---

## 7. Document Graph

The document equivalent of a code graph should model:

### Nodes

- repositories;
- documents;
- versions;
- sections;
- requirements;
- people;
- organizations;
- regulations;
- systems;
- decisions;
- observations;
- risks;
- questions;
- generated outputs.

### Relationships

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

Example queries:

```text
Which observations depend on a requirement changed in the latest version?
```

```text
Which mandatory requirements still lack supporting evidence?
```

---

## 8. Derived Document Generation

The platform should generate:

- critical reports;
- compliance reports;
- requirement coverage matrices;
- executive summaries;
- gap lists;
- clarification questions;
- meeting minutes;
- revised documents;
- tender responses;
- remediation plans;
- alternative comparisons.

Every generated claim should preserve provenance.

```markdown
## Observation 12

The document does not specify the service availability requirement.

Sources:

- Technical Specification, § 8.2, page 41
- Technical Proposal, § 5.4, page 33
```

Supported outputs:

- Markdown;
- DOCX;
- PDF;
- HTML;
- CSV;
- XLSX;
- structured JSON.

---

## 9. Document Context Builder

```yaml
context_pack:
  objective: Verify coverage of security requirements

  repository:
    type: DOCUMENTS
    id: sample-tender-2026

  mandatory:
    - active_requirements
    - current_observations
    - latest_document_versions

  retrieve:
    - type: document_section
      query: security
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

The system must not resend the complete document repository for every task.

---

## 10. Unified Work Item

The Work Item is the central aggregate.

```text
Work Item
├── objective
├── repository
├── repository type
├── branch or document version
├── sources
├── agents
├── skills
├── instructions
├── context
├── annotations
├── evidence
├── outputs
├── verification
├── costs
└── handoff
```

Possible types:

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

The unified shape above is a later extensibility direction, not the Core MVP
acceptance boundary. The first cross-agent handoff supports only an explicit
software Work Item containing bounded objective state and additive handoff
snapshots. Document analysis, mixed repositories, Context Builder budgets,
skills, cost accounting, and orchestration remain later increments and cannot
be required to complete the Core MVP alpha.

Main flow:

```text
SEARCH
  -> RESUME
  -> BUILD CONTEXT
  -> SELECT AGENT
  -> EXECUTE
  -> VERIFY
  -> CONSOLIDATE
  -> REUSE
```

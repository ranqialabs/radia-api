# radia-api

> **Status:** Under active development

Radia is an autonomous **organizational memory and task suggestion system** for [RanqIA](https://github.com/ranqialabs). It continuously observes the company's knowledge sources — meetings, documents, and messages — and does two things:

1. **Builds and maintains a queryable knowledge graph** representing the current and historical state of the company: decisions made, direction changes, technical context, people, and responsibilities.

2. **Suggests GitHub issues** across `ranqialabs` repositories based on action items and decisions identified from meetings, cross-referencing existing issues to avoid duplicates.

## How it works

- Ingests content from Google Meet transcripts, Google Docs, and Google Drive
- Parses and extracts decisions, action items, and named entities using AI agents
- Stores knowledge in a temporal graph (via [Graphiti](https://github.com/getzep/graphiti)) backed by FalkorDB
- Suggests issues with full traceability back to the source meeting segment
- All suggested issues go through **human review** before being created on GitHub

## Principles

- **Never auto-create issues** — human approval is always required
- **Full traceability** — every suggestion points to its source
- **Idempotency** — reprocessing the same meeting never duplicates data
- **Extensible by design** — new sources (Slack, WhatsApp, email) plug in without touching the core pipeline

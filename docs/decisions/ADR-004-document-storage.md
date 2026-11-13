# ADR-004: IRP/CCMP storage backend

## Status
Proposed

## Date
2026-09-05

## Context
Documents need upload, soft/hard delete, audit. App may run Docker single-node or cloud.

## Options
### A — Local/container filesystem volume
Pros: simple Docker; Cons: multi-instance hard.
### B — S3-compatible object storage
Pros: durable, lifecycle policies; Cons: more ops.
### C — Postgres BYTEA
Pros: one DB; Cons: DB bloat, backup cost for large PDFs.

## Decision
**Dev/Docker default: A** with volume.  
**Production target: B** when deploying beyond single node. Abstract behind `DocumentStorage` interface in Slice B.

## Consequences
Retention worker must delete storage key + clear extracted text; audits remain in Postgres.

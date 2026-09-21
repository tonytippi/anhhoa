---
status: accepted
date: 2026-09-21
decision: asynchronous, resumable CollectionRun generation with durable server progress
authority: Tony, 2026-09-21
---

# Decision - Story 5.6 resumable CollectionRun generation

## Decision

CollectionRun generate is an asynchronous Finance-owned Operation. The command snapshots the authoritative eligible roster at enqueue time, creates a durable generation job and returns its `PENDING` Operation immediately. A database-claimed worker stages that immutable snapshot in batches and exposes server-authoritative progress through the actor-scoped Operation read. The job can be paused and resumed cooperatively; a process crash or expired lease resumes from its durable checkpoint without a new roster read.

`CollectionRun` keeps the existing business lifecycle `DRAFT -> READY -> GENERATED -> CLOSED`. It stays `READY` while a generation job is queued, running or paused. Only the final atomic publish inserts the staged Invoice snapshots, transitions the run to `GENERATED`, creates the lifecycle/audit facts and completes the original Operation. This preserves the rule that an already `GENERATED` run may accept a newly eligible Student with no Invoice through its separate idempotent command.

## Progress Contract

`GET /operations/:operationId` returns a server-persisted progress DTO for generation: job status, `total`, `processed`, `eligible`, `skipped`, and terminal error when applicable. The Admin portal polls this endpoint after generate or timeout and renders text progress only from this DTO. It never estimates success, counters or completion locally.

## Failure And Resume Boundary

Pause applies between durable batches. A paused or recoverable leased job remains `PENDING` at the original Operation and `READY` at its CollectionRun; resume continues the original immutable item set. A non-recoverable validation or lifecycle failure marks the job and original Operation `FAILED`, retains a structured server error, and does not publish any Invoice. No Invoice becomes business-visible until final publish, so a partial stage is never a partial CollectionRun outcome.

## Invariants

- Snapshot eligibility, selection provenance, and roster facts at enqueue; never re-evaluate them during resume.
- Retain same-School authorization, reauthorization at publish, UUID idempotency, actor/membership provenance, audit, unique `(schoolId, studentId, collectionRunId)` and immutable Invoice rules.
- The worker has no Teacher, Parent, attendance, service enrollment, promotion, settlement or Payroll dependency.
- A job is unique per run. An unrelated new generate request must reconcile or conflict rather than creating another job.

---
status: accepted
date: 2026-09-21
decision: preserve canonical Epic 5.3 generated-run student addition
authority: Tony, 2026-09-21
---

# Decision - Story 5.3 generated-run student addition

## Decision

> **Superseded clarification (2026-09-24):** The generated-student command now creates one populated `DRAFT` solely from the immutable `CollectionRun` template snapshot. It must not read template or catalog live data; display order is server-deterministic `amount DESC` with stable UUID tie-breaker and has no business semantics.

`CollectionRun` `GENERATED` locks Students that already have an Invoice. Finance may add a same-School Student only when the server proves the Student is eligible at the run roster-as-of date and the Student has no Invoice for that run. The command creates exactly one empty `DRAFT` Invoice through the same Finance Operation, authorization, idempotency, audit, snapshot and tenant-boundary rules as initial generation.

## Rationale

This preserves the canonical Epic 5.3 acceptance contract. It does not permit changing generated Students, editing historical snapshots, adding Invoice lines, creating a supplemental run, or modifying issued content.

## Implementation Boundary

- The server owns eligibility, Invoice-existence checks and roster snapshots.
- The command is a distinct idempotent mutation and reports created/skipped outcomes.
- `CLOSED` remains locked; `DRAFT` and `READY` use the existing selection/generate flow.

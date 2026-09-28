# Decision: Apply prepaid coverage from Invoice DRAFT

**Date:** 2026-09-28

## Decision

- `PREPAID_COVERAGE` remains a fulfillment mode of `PromotionPolicy`; it is not a separate promotion, balance, or CollectionRun type.
- A `PREPAID_COVERAGE` policy version has one positive consecutive-month term. The term belongs to the version and applies uniformly to every Receivable target. A policy may target multiple same-School Receivables.
- Finance applies a selected policy while editing one Student's `DRAFT` Invoice. The API derives the start period solely from that Invoice's `CollectionRun.billingMonth`; Finance cannot select individual coverage months.
- Direct agreement with a Parent is an offline operational prerequisite. The system neither creates nor stores a Parent-agreement record or reference.
- Selecting an effective same-School `PREPAID_COVERAGE` version on the Student's `DRAFT` Invoice is sufficient; this fulfillment mode does not require a pre-existing `StudentPromotionAssignment`.
- The Student must have an effective same-School `StudentEnrollment` in the Invoice SchoolYear that fully contains every derived future service interval. A missing or partial interval rejects the entire DRAFT coverage mutation.
- To Finance, `DISCOUNT` and `PREPAID_COVERAGE` are both discounts. At most one promotion policy may reduce a given Student/Receivable/period. `PREPAID_COVERAGE` suppresses normal discount evaluation for its covered facts; unrelated Invoice lines continue through normal discount evaluation.
- Future facts reserved by a `DRAFT` or `ISSUED` Invoice prevent a second Invoice from reserving the same Student/SchoolYear/Receivable/period. Only coverage issued by an exact close suppresses a later normal monthly charge. Cancellation or replacement releases only the unissued source's reservations.

## Consequences

- The CollectionRun preview/batch-selection workflow in the PRD, Architecture Spine and reviewed UX contracts must be superseded by a follow-up change artifact before their `final` text is changed.
- The prepaid term must move from target-level `appliedQuantity` semantics to a version-level field in the implementation and migration contract.
- Applying, replacing, or removing prepaid coverage facts is a high-impact, idempotent Invoice-DRAFT mutation with a School-scoped Operation and audit record.

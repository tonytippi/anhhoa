# Decision: Story 5.12 PromotionPolicy contract

**Date:** 2026-09-25

## Decision

Implement Story 5.12 theo approved Sprint Change Proposal `sprint-change-proposal-2026-09-25-promotion-policy-phase-1b.md`.

`PromotionPolicyVersion` owns one or more same-School Receivable targets and one shared discount rule. Versions transition `DRAFT -> ACTIVE -> RETIRED`; active and retired configuration is immutable. Version intervals and Student assignment intervals use half-open storage, while UI end-date input is inclusive. Version overlap within a policy and assignment overlap for the same Student/policy are rejected.

Assignments belong to active versions and can be created in an all-or-nothing batch with a common interval and mandatory reason. Assignments are ended, never deleted. Pha 1b evaluates only a monthly CollectionRun billing month and excludes charge cadence, target unit/quantity, fulfillment modes, operational eligibility and all coverage/settlement behavior.

## Rationale

This keeps the reviewed Finance surface within the existing monthly CollectionRun model while allowing a durable policy such as staff-child discount to receive newly enrolled Students over time. It gives Stories 5.13-5.14 deterministic inputs without inventing Kidsonline charge cadence semantics.

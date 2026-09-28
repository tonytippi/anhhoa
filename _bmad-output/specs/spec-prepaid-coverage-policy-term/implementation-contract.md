# Implementation Contract

## Data Model

| Entity | Required change | Invariant |
|---|---|---|
| `PromotionPolicyTarget` | Add an applied unit fixed to `MONTH` for this scope and positive `appliedQuantity`. | `(schoolId, versionId, receivableId)` remains unique; ACTIVE/RETIRED target configuration remains immutable. |
| `PromotionPolicyVersion` | `PREPAID_COVERAGE` must have one or more month-based targets; `DISCOUNT` does not acquire prepaid term behavior. | Every target in one coverage version uses a valid positive term; differing target terms need an explicit future contract, not implicit browser behavior. |
| `CollectionRunCoverageSelection` | Replace `studentId + versionId + billingMonth` input semantics with Student/version intent for a run. | The stored/requested period is never client-authoritative; if persistence needs period facts, it derives them from `run.billingMonth` and the version target term. |
| `InvoicePromotionCoverageFact` | Persist one fact per derived Student/Receivable/period. | Facts form each target's complete consecutive range, retain original price/reduction/calendar/service interval and stay append-only. |

## API And UX

- The policy create/version payload accepts each target's `appliedUnit` and `appliedQuantity`; validation requires `MONTH` and an integer greater than zero for `PREPAID_COVERAGE`.
- The selection command accepts selected Student IDs and a `versionId`; it must not accept a caller-calculated coverage period list or money values.
- The Finance policy modal conditionally shows the prepaid term beside each target only when fulfillment is `PREPAID_COVERAGE`, with explanatory copy that the run month is the start month.
- The CollectionRun surface replaces “Kỳ được coverage” with policy/version selection for a Student or a batch. Preview displays the derived contiguous periods and server-returned gross, reduction and net before READY/generate.
- Existing timeout behavior remains: retain Operation ID, reconcile `GET /operations/:operationId`, then retry only if reconciliation permits it.

## Server Derivation

1. Lock the School-scoped run, policy/version, assignments, targets and coverage graph inside the existing mutation/preview transaction boundary.
2. For every selected Student/version target, set period zero to `run.billingMonth`; derive exactly `appliedQuantity` consecutive calendar months.
3. For every derived period, verify it is within the run SchoolYear, has an effective ACTIVE version and assignment, has a valid calendar with eligible operating days, and has no issued coverage for the same Student/SchoolYear/Receivable/period.
4. Derive price and discount from authoritative target/version facts, snapshot the service interval contained by the derived month, and reject the complete command if any fact fails.
5. Include the complete derivation in preview/READY fingerprint and regenerate it inside generate and exact-close boundaries. Persist no partial Invoice/fact/coverage result.

## Acceptance Matrix

| Given | When | Then |
|---|---|---|
| A six-month target and a September run | Finance selects the Student and policy version | API derives September through February without a browser month list. |
| A policy version or assignment ends during a derived range | Preview, READY, or generate runs | Server rejects/stales the whole outcome before Invoice writes. |
| A range extends beyond SchoolYear, has no eligible operating day, or includes issued coverage | Finance selects the policy | Server returns a safe validation/conflict outcome and writes no partial selection or fact. |
| An Invoice with derived facts is closed non-exactly | Receipt posting runs | No Receipt, difference, carry, or coverage is created for that Invoice. |
| An Invoice with derived facts is closed exactly | Receipt posting commits | One immutable coverage record issues per derived fact, with same-School paid provenance. |
| A later normal monthly run is generated | A covered period is reached | Only the matching Student/Receivable/period is skipped; unrelated lines remain billable. |

## Verification

- Add unit, controller and PostgreSQL integration coverage for policy term validation, contiguous derivation, SchoolYear/interval/calendar/overlap failures, atomic rollback, idempotent replay and tenant isolation.
- Update Admin Finance tests to prove no month-picker/manual period request is emitted and that preview renders only server-derived coverage periods and monetary values.
- Run `pnpm --filter @passionedu/api test`, the Finance integration suite using `.env.test`, `pnpm --filter @passionedu/admin-web test -- src/finance/finance-workspace.test.tsx`, `pnpm typecheck`, and `git diff --check`.

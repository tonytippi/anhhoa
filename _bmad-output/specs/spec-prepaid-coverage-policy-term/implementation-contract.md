# Implementation Contract

## Data Model

| Entity | Required change | Invariant |
|---|---|---|
| `PromotionPolicyTarget` | Remains one same-School Receivable target per `(schoolId, versionId, receivableId)`; it has no prepaid-term field. | ACTIVE/RETIRED target configuration remains immutable. |
| `PromotionPolicyVersion` | Add one positive `prepaidTermMonths` for `PREPAID_COVERAGE`; `DISCOUNT` does not acquire prepaid term behavior. | All targets in a coverage version use the same term because the term belongs to the version. |
| `InvoicePromotionCoverageFact` | Persist one fact per derived Student/Receivable/period; create, replace, or remove unissued facts only through an idempotent Invoice `DRAFT` mutation selecting a coverage version. | The requested period is never client-authoritative; facts derive from `invoice.collectionRun.billingMonth` and `prepaidTermMonths`. DRAFT facts form each target's complete consecutive range; issued facts retain original price/reduction/calendar/service interval and are append-only. |

## API And UX

- The policy create/version payload accepts `prepaidTermMonths`; validation requires a positive integer only for `PREPAID_COVERAGE`.
- The Invoice DRAFT coverage command accepts an Invoice ID and `versionId`; it must not accept Student IDs, a caller-calculated coverage period list, assignment ID, or money values.
- The Finance policy modal shows one prepaid term for a `PREPAID_COVERAGE` version and its targets. The Invoice DRAFT editor presents it as an ưu đãi, with explanatory copy that the Invoice run month is the start month.
- The Invoice DRAFT editor lets Finance select, replace, or remove one coverage policy. The server returns derived contiguous periods and gross, reduction and net before the DRAFT is saved; Finance does not need to distinguish prepaid coverage from a normal discount.
- Existing timeout behavior remains: retain Operation ID, reconcile `GET /operations/:operationId`, then retry only if reconciliation permits it.

## Server Derivation

1. Lock the School-scoped DRAFT Invoice, its run, policy/version, targets, existing DRAFT/ISSUED fact reservations and issued coverage graph inside the mutation transaction; re-authorize `FINANCE_MANAGE` there.
2. For the Invoice Student and every version target, set period zero to `invoice.collectionRun.billingMonth`; derive exactly `prepaidTermMonths` consecutive calendar months.
3. For every derived period, verify it is within the Invoice SchoolYear, has an effective ACTIVE version, has a valid calendar with eligible operating days, and has a same-School StudentEnrollment in that SchoolYear fully containing the derived service interval. Also verify it has no other policy reduction for the same Student/Receivable/period and no DRAFT/ISSUED reservation or issued coverage from another Invoice.
4. Derive price and discount from authoritative target/version facts, snapshot the service interval contained by the derived month, and reject the complete command if any fact fails. Do not evaluate a normal `DISCOUNT` for the covered facts; evaluate unrelated current-month lines normally.
5. Replace the Invoice's unissued coverage facts atomically, audit the change, persist an Operation fingerprint/result, and return only server-derived facts and money. Re-derive and compare the complete fact graph in Issue and exact-close boundaries; persist no partial Invoice/fact/coverage result.

## Acceptance Matrix

| Given | When | Then |
|---|---|---|
| A six-month version with tuition and meal targets and a September Invoice DRAFT | Finance selects the policy version | API derives September through February for each target without a browser month list. |
| A policy version ends during a derived range | Finance saves the DRAFT coverage policy or issues the Invoice | Server rejects/stales the whole outcome before a partial DRAFT write or Issue. |
| The StudentEnrollment ends or starts inside a derived service interval | Finance selects the policy on the Invoice DRAFT | Server rejects the whole mutation; it creates no partial future facts. |
| A range extends beyond SchoolYear, has no eligible operating day, has a different policy reduction, or is reserved/issued elsewhere | Finance selects the policy on the Invoice DRAFT | Server returns a safe validation/conflict outcome and writes no partial fact. |
| An Invoice with derived facts is closed non-exactly | Receipt posting runs | No Receipt, difference, carry, or coverage is created for that Invoice. |
| An Invoice with derived facts is closed exactly | Receipt posting commits | One immutable coverage record issues per derived fact, with same-School paid provenance. |
| A later normal monthly run is generated | A covered period is reached | Only the matching Student/Receivable/period is skipped; unrelated lines remain billable. |

## Verification

- Add unit, controller and PostgreSQL integration coverage for version term validation, multi-target contiguous derivation, SchoolYear/enrollment/interval/calendar/reservation/overlap failures, atomic rollback, idempotent replay and tenant isolation.
- Update Admin Finance tests to prove no month-picker/manual period request or StudentPromotionAssignment is emitted and that the Invoice DRAFT editor renders only server-derived coverage periods and monetary values.
- Run `pnpm --filter @passionedu/api test`, the Finance integration suite using `.env.test`, `pnpm --filter @passionedu/admin-web test -- src/finance/finance-workspace.test.tsx`, `pnpm typecheck`, and `git diff --check`.

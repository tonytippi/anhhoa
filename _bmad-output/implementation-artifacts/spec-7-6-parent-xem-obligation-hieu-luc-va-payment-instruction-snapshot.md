---
title: 'Story 7.6: Parent xem obligation hiệu lực và Payment instruction snapshot'
type: 'feature'
created: '2026-09-27'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '2b932bdb64eb81deae14561efa993eb389941bbb'
context:
  - '_bmad-output/implementation-artifacts/epic-7-context.md'
  - '_bmad-output/implementation-artifacts/decision-story-7-6-parent-obligation-contract-2026-09-27.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/parent/parent.html'
---

<frozen-after-approval reason="human-owned intent -- do not modify unless human renegotiates">

## Intent

**Problem:** Finance has immutable issued Invoice/payment snapshots and settlement facts, but Parent has no safe obligation read model. Reusing Finance Admin DTOs would expose receipt, revision, ledger, promotion/refund and live-bank provenance; client-side calculation would make payment authority unsafe.

**Approach:** Add immutable issued obligation code and versioned Parent access policy, then export a Finance-owned minimum projection for active-link authorized Parent routes. The server selects only the current-effective invoice, derives effective time/outstanding/retention from Finance facts, and returns immutable payment snapshot; the Parent portal displays read-only obligation/list detail with no payment or finance mutation affordance.

## Boundaries & Constraints

**Always:** Finance owns lineage, outstanding, retention facts, VND integer calculation and Parent projection. Invoice issue generates immutable School-unique `OBL-YYYYMM-<sequence>` obligation code snapshot. Parent routes re-authorize active ParentProfile/School and `StudentParent` for every invoice student, return `private, no-store`, use JSON-safe VND strings and expose only current-effective `ISSUED` outstanding or retained `CLOSED` obligations. `CANCELLED` source records are omitted; replacement is the only record. `effectiveAt` is server-derived from issued, receipt, settlement-transfer and debt-transfer lifecycle instants without exposing provenance. Payment instruction uses issued Invoice snapshots, never live BankAccount. `CLOSED` record snapshot is read-only; payment invitation exists only for positive server outstanding.

**Ask First:** Stop if retention period/policy semantics, obligation code format/uniqueness, Finance outstanding inputs, coverage-refund settlement predicate, Parent DTO fields, payment snapshot display for closed records, or the reviewed no-payment-action UX must change.

**Never:** Do not reuse Finance Admin DTO/controller, calculate money in Parent client, return lines/receivables/class/student code/collection run, receipt/allocation/settlement/debt/carry/revision/promotion/coverage/refund/audit provenance, live bank or bank IDs. Do not add Parent POST/PATCH/DELETE finance routes, “I paid”, QR, copy, bank deep link, refund/package/promotion controls or offline cache/queue.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Issued outstanding | Active link to Invoice student; current-effective `ISSUED` outstanding | Minimum obligation with distinct issued total/current outstanding and issued snapshot instruction | Cross-child/School/revoke never leaks record |
| Closed retained | Current-effective `CLOSED` inside policy or unresolved coverage refund/reversal | Minimum historical obligation/payment snapshot, zero outstanding and no invitation/action | Server retention determines visibility |
| Revision/cancel | Cancelled source with replacement, including closed-source settlement transfer | Source absent; replacement only, server-derived effective state/time/outstanding | No revision/transfer provenance returned |
| Retention | Issued unsettled, settled closed inside/outside policy, unresolved refund/reversal | Unsettled/relevant unresolved remains; completed closed follows effective policy | Expired list omits and direct detail safely denies |
| Context loss | Student link revoke, School change, `401`/`403`/`404` during list/detail | Clear obligation/instruction before chooser/signed-out safe fallback | No stale finance state or payment affordance |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` and migrations -- Invoice issued snapshot, Receipt/Settlement/Debt/Coverage graph; add obligation code and effective-dated Parent access policy persistence.
- `apps/api/src/modules/finance/finance.service.ts` -- issue/revision/receipt/settlement lifecycle and Finance money conventions; create a narrow Parent projection export instead of reusing Admin DTOs.
- `apps/api/src/modules/parents/parents.controller.ts` and `parents.service.ts` -- Parent-audience, no-store endpoints; re-authorize each projected invoice student with active StudentParent link.
- `apps/api/src/integration/finance.integration.test.ts` and `release-gate.integration.test.ts` -- create issued/closed/cancelled/revision/settlement/coverage/refund fixtures and prove Parent DTO/retention/isolation.
- `apps/parent-web/src/auth-session.ts` -- reuse credentialed `parentGet()` no-store behavior only.
- `apps/parent-web/src/main.tsx`, styles and tests -- add read-only obligation view/list/detail, explicit issued/outstanding labels and safe fallback; no mutation state.
- `apps/parent-web/vite.config.ts`/test and `apps/web/e2e/release-gate.spec.ts` -- preserve no protected cache and prove browser authorization/read-only behavior.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` and new migrations -- add Invoice obligation code snapshot/School uniqueness and effective-dated audited Parent access policy -- establishes immutable identity and server retention policy.
- [x] `apps/api/src/modules/finance/finance.service.ts` and Finance tests -- generate code at issue; implement narrow Finance-owned Parent projection that derives current-effective state/outstanding/effectiveAt/retention from authoritative facts -- prevents Parent/Admin DTO or client formula leakage.
- [x] `apps/api/src/modules/parents/{parents.service,parents.controller}.ts` and tests -- add no-store Parent list/detail endpoints with per-invoice active-link authorization and exact allowlisted DTO -- preserves Parent boundary and safe deep links.
- [x] `apps/api/src/integration/{finance,release-gate}.integration.test.ts` -- prove code/retention/lineage/settlement/coverage-refund, same-School sibling/cross-School/revoke denial, DTO redaction and no Parent finance mutation -- validates Finance and tenant contracts.
- [x] `apps/parent-web/src/{main,auth-session}.ts`, styles and tests -- render read-only obligation list/detail/instruction with issued vs outstanding labels, no CTA at zero and clear-on-denial -- implements reviewed Parent surface safely.
- [x] `apps/parent-web/vite.config.test.ts` and `apps/web/e2e/release-gate.spec.ts` -- prove no finance cache/action and deployed list/detail/revoke safe fallback -- protects release behavior.

**Acceptance Criteria:**
- Given Parent has active link to a Student with a current-effective `ISSUED` outstanding Invoice or retained `CLOSED` Invoice, when list/detail loads, then API returns only obligation code, period, issued total, server-derived actual receipt/outcome/outstanding/state/effective time and issued payment snapshot under active-link authorization.
- Given Invoice source is `CANCELLED` or has a replacement, when Parent loads list/detail, then source/provenance is absent and only effective replacement is visible; outstanding/effective time are Finance-derived without Parent calculation.
- Given live BankAccount/catalog/Finance Admin data changes after issue, when Parent reads obligation, then issued payment/obligation snapshots remain unchanged and no live/internal Finance field is returned.
- Given settled closed retention, unresolved coverage refund/reversal, policy boundary, cross-School/cross-child/revoke or expired direct detail, when Parent reads, then server applies retention/authorization and UI clears to safe fallback with no stale record/action.
- Given Parent renders obligation/instruction, when accessibility/cache/action checks run, then issued/current outstanding labels are distinct, zero outstanding has no payment invitation, and no confirmation/QR/copy/deep-link/refund/package/receipt/payment mutation or authenticated cache is exposed.

## Design Notes

The Parent DTO is a Finance projection, not a simplified Invoice serialization. It exposes stable issued facts and a derived current outcome while hiding the ledger graph that produced it. Parent list/detail requests are read-only and always re-authorize the invoice student; a replacement’s visibility never reveals why or from which source it replaced another record.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate && pnpm --filter @passionedu/api build` -- expected: policy/code migrations and API compile.
- `pnpm --filter @passionedu/api test -- finance.service.test.ts parents.service.test.ts parents.controller.test.ts --run` -- expected: projection/code/retention unit-controller behavior passes.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration -- --runInBand` -- expected: PostgreSQL Finance lineage/retention/Parent isolation proof passes.
- `pnpm --filter @passionedu/parent-web test -- --run` -- expected: Parent obligation read-only/safe-fallback tests pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/admin-web exec playwright test --grep "Parent"` -- expected: shared browser harness proves Parent obligation flow.
- `pnpm lint && pnpm typecheck` -- expected: workspace checks pass.

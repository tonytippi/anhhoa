---
title: 'Ghi actual Receipt, đóng Invoice và carry chênh lệch'
type: 'feature'
created: '2026-09-25'
status: 'done'
baseline_commit: '25d5ef38d29014e757d36f6d7159b3c94332b7d7'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Finance chưa thể ghi số tiền thực nhận để đóng một Invoice đã phát hành. Chênh lệch thu thiếu/thừa hiện không có ledger immutable hoặc cơ chế chuyển có provenance vào hóa đơn monthly kế tiếp.

**Approach:** Bổ sung settlement một-Invoice, append-only và server-authoritative từ persistence đến Admin Finance UI. Receipt đóng Invoice `ISSUED`, server suy ra outcome/difference; generation của DRAFT monthly kế tiếp tự materialize carry còn lại trong đúng tenant/student/năm học.

## Boundaries & Constraints

**Always:** Re-authorize active `FINANCE_MANAGE` membership trong transaction trước aggregate lookup; scope mọi lookup, unique constraint, audit và Operation theo School. VND là PostgreSQL `BIGINT` và JSON-safe integer/string DTO, không float. Mutation bắt buộc origin, double-submit CSRF, UUID `Idempotency-Key`, Operation fingerprint/replay và reconciliation. Một Receipt chỉ đóng một Invoice `ISSUED` cùng Student/School/SchoolYear; transaction atomically append Receipt, đổi Invoice sang `CLOSED`, derive `EXACT`/`SHORTFALL`/`OVERPAYMENT`, và chỉ non-exact mới append chính xác một `SettlementDifference` source-linked. Carry chỉ tự materialize một lần vào Invoice `DRAFT` thuộc `MONTHLY` run kế tiếp đủ điều kiện, giữ source provenance và remainder; overpayment không làm total target âm.

**Block If:** Contract Epic 5 không thể được mở rộng để cho phép `ISSUED -> CLOSED` và terminal `CLOSED` mà vẫn giữ immutability/direct-write guards, hoặc carry không thể được đặt tại điểm generation trước khi Invoice DRAFT được expose.

**Never:** Không partial allocation, unallocated Receipt, generic balance, `StudentPrepayment`, manual carry, multi-Invoice Receipt, client-calculated outcome/difference/carry, cross-Student/School/SchoolYear use, Parent finance mutation/provenance exposure, hoặc sửa ledger/snapshot lịch sử.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Exact close | Finance Manager xác thực gửi actual amount bằng issued total cho một Invoice `ISSUED` | Một Receipt immutable, Invoice `CLOSED` outcome `EXACT`, Operation result server-returned; không có Difference | Same-key retry replay Operation result |
| Non-exact close | Actual amount thấp/cao hơn issued total | Invoice `CLOSED`, đúng một Difference signed dương/âm linked Receipt/Invoice, không balance/prepayment | Concurrent hoặc trạng thái đã đổi bị replay/reject an toàn |
| Next monthly draft | Same Student/School/SchoolYear có remaining Difference và MONTHLY run kế tiếp tạo DRAFT | Tạo `SHORTFALL_CARRY`/`OVERPAYMENT_CARRY` một lần, source-linked; negative adjustment capped, residue giữ source | Target sai tenant/year/non-DRAFT hoặc đã materialize thì không áp dụng |
| UI timeout | Posting timeout hoặc Operation pending | UI giữ operation id, reconcile server trước retry, hiển thị issued/actual/outcome/difference/carry từ response | Không double-submit hay suy diễn client-side |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- Invoice/InvoiceLine/Operation schema; thêm terminal close, Receipt, SettlementDifference và carry provenance/index/FK School-scoped.
- `apps/api/prisma/migrations/20260922000004_harden_invoice_revision_guards/migration.sql` -- lifecycle/direct-write guard cần cho phép duy nhất server-driven `ISSUED -> CLOSED` nhưng giữ snapshot immutable.
- `apps/api/src/modules/finance/finance.controller.ts` -- REST mutation protection và Operation route; thêm receipt-close endpoint.
- `apps/api/src/modules/finance/finance.service.ts` -- `actor`, `transactionActor`, `mutate`, BigInt DTO/validation, invoice issuance/generation and locks are reuse points for settlement/carry.
- `apps/api/src/modules/finance/finance.service.test.ts` and `finance.controller.test.ts` -- unit/controller conventions for validation, CSRF and idempotency forwarding.
- `apps/api/src/integration/finance.integration.test.ts` -- PostgreSQL proof for lifecycle guards, tenant isolation, idempotency and concurrent Finance writes.
- `apps/web/src/finance/finance-workspace.tsx` -- Admin Invoice detail and persisted Operation reconciliation; add receipt dialog only for eligible Invoice and render server result.
- `apps/web/src/finance/finance-workspace.test.tsx` -- Finance UI test conventions for timeout/reconciliation and safe rendering.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma` and a new Finance migration -- model terminal close, immutable Receipt/Difference and source-linked carry constraints/guards -- makes unsafe cross-scope or duplicate ledger states unrepresentable.
- `apps/api/src/modules/finance/finance.service.ts` and `finance.controller.ts` -- implement protected idempotent one-Invoice receipt close, server DTO projection and next-month DRAFT carry materialization with consistent transaction locking -- keeps authority and finance lifecycle in API.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, and `apps/api/src/integration/finance.integration.test.ts` -- test amounts/outcomes, lifecycle/tenant boundaries, replay/concurrency and bounded one-time carry against test PostgreSQL -- proves system-level invariants.
- `apps/web/src/finance/finance-workspace.tsx` and `finance-workspace.test.tsx` -- add Finance-only receipt confirmation/result UI and Operation reconciliation -- provides reviewable server-driven workflow without manual allocation/carry.

**Acceptance Criteria:**
- Given a Finance Manager selects one selected-School `ISSUED` Invoice, when they submit a verified actual amount with a valid idempotency key, then one transaction creates its Receipt, closes it and returns only server-derived exact/shortfall/overpayment result.
- Given the actual amount differs, when posting commits, then exactly one immutable signed Difference is linked to the Invoice/Receipt and no generic, partial or cross-scope entitlement exists.
- Given remaining Difference and an eligible later monthly DRAFT Invoice, when generation exposes that DRAFT, then one bounded, source-linked carry is materialized without a negative Invoice total and residue remains available only at its source.
- Given duplicate, timeout, concurrent, cancelled, non-issued or unauthorized/cross-tenant requests, when processed, then the outcome replays or rejects safely without an extra Receipt, Difference or carry.
- Given the Admin Finance UI renders a settlement, when a result or timeout occurs, then it displays server-returned issued/actual/outcome/difference/carry and reconciles its Operation before retrying; Parent has no control or internal lineage.

## Design Notes

Settlement is not an allocation workflow. Lock sources in a single documented order inside the transaction and make carry application part of authoritative monthly DRAFT construction, so a browser cannot select a target, amount or lineage.

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 12 (high 6, medium 5, low 1)
- defer: 0
- reject: 4
- addressed_findings:
  - `[high]` `[patch]` Strengthened PostgreSQL ledger and lifecycle guards so a closed Invoice is Receipt-backed, ledger records stay append-only, and carry is source-bounded, scoped and monthly-next eligible.
  - `[high]` `[patch]` Made carry selection deterministic for the earliest eligible monthly DRAFT and serialized source visibility/materialization.
  - `[high]` `[patch]` Blocked run closure while any issued Invoice still requires settlement and enabled receipt posting for issued replacement Invoices.
  - `[medium]` `[patch]` Aligned issued and receipt JSON-safe VND bounds and added controller, UI and integration coverage for settlement paths.
  - `[medium]` `[patch]` Completed receipt dialog accessibility, Vietnamese result/carry wording, timeout reconciliation cleanup and focus restoration.

## Auto Run Result

**Summary:** Hoàn tất Story 6.1 với actual Receipt một-Invoice, Invoice `CLOSED`, immutable SettlementDifference, bounded next-month carry và Admin Finance reconciliation.

**Files changed:**
- `apps/api/prisma/schema.prisma` và migrations `20260925000005` đến `20260925000009` -- persistence, lifecycle và ledger/carry guards.
- `apps/api/src/modules/finance/finance.service.ts` và `finance.controller.ts` -- protected receipt posting, DTO và carry materialization.
- `apps/api/src/modules/finance/*.test.ts` và `src/integration/*.test.ts` -- validation, controller protection, tenant/lifecycle/concurrency/carry proof.
- `apps/web/src/finance/finance-workspace.tsx` và test -- Finance-only receipt workflow, safe close state và accessibility/reconciliation.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Story 6.1 completion tracker.

**Review findings:** 12 patches applied (high 6, medium 5, low 1), 0 deferred, 4 rejected. Follow-up review recommendation: `true`; patch score is `6 high` (automatically recommended).

**Verification:** API Finance unit/controller tests passed; API typecheck passed; Admin Finance tests passed (108 tests); full PostgreSQL API integration passed on `.env.test` target `anhhoa_test` (133 tests); `git diff --check` passed.

**Residual risks:** Clean-install migration reset was not run because Prisma CLI rejects reset in this AI runtime; upgrade deployment and full integration suite applied and verified all settlement migrations on the isolated test database.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test -- src/modules/finance/finance.service.test.ts src/modules/finance/finance.controller.test.ts` -- expected: Finance unit/controller tests pass.
- `TARGET_INTEGRATION_DATABASE_URL="$TARGET_INTEGRATION_DATABASE_URL" pnpm --filter @passionedu/api test:integration` -- expected: all API integration tests pass using `.env.test` database only.
- `pnpm --filter @passionedu/api typecheck` -- expected: API typecheck passes after Prisma/client regeneration.
- `pnpm --filter @passionedu/admin-web test -- src/finance/finance-workspace.test.tsx` -- expected: Admin receipt/reconciliation tests pass.

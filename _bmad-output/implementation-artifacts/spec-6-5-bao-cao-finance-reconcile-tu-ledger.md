---
title: 'Báo cáo Finance reconcile từ ledger'
type: 'feature'
created: '2026-09-25'
status: 'done'
baseline_commit: '3ee1c72be899ae492f30fe26fef3fad163935676'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
warnings: []
deferred: []
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Canonical Story 6.5 chưa có runtime production: Finance không có projection ledger đủ thời điểm để aggregate an toàn theo `asOf`, không có API bốn workspace hay CSV re-authorized/audited. Mockup UX đã có nhưng không thể là nguồn tính tiền, authorization hoặc completion evidence.

**Approach:** Thêm projection ledger append-only cùng export record scoped `School`, ghi các immutable reporting facts trong finance posting transaction, rồi expose report/CSV read-only server-authoritative và Admin workspace chỉ render DTO được cấp quyền.

## Boundaries & Constraints

**Always:** `School` là tenant root: authorize active `FINANCE_MANAGE` membership trước mọi report/export lookup và re-authorize lúc download; mọi predicate/record/audit scoped `schoolId`. Ledger facts, Invoice snapshot và VND `BIGINT` là authority; JSON trả integer string, client không aggregate/tạo CSV. Report gồm overview, CollectionRun reconciliation, outstanding/debt và cash/adjustment; trả `asOf`, `generatedAt`, `Asia/Ho_Chi_Minh`, normalized filters, definition version và source provenance. Chỉ event posted `<= asOf` được tính; billed theo `Invoice.billingMonth`, cash/reversal/refund theo posting time; cancelled/replacement vẫn có lineage nhưng obligation chỉ current-effective tại cutoff. CSV tạo từ chính server result, opaque/expiring, audit request/download, protected `private, no-store`, không direct URL.

**Ask First:** Hỏi trước khi thêm dashboard/custom/scheduled report, PDF/XLSX, Payroll/Parent field, period close/reopen, thay đổi settlement/promotion/debt lifecycle, hoặc storage provider/object URL.

**Never:** Không trust path/filter/export ID/browser state như authorization; không live-join catalog/Student/Class/policy/BankAccount để rewrite historical fact; không client total/Blob CSV; không cross-School export/download; không sửa append-only source event, retroactively infer cancellation time, hay thay mockup thành finance authority.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Report hợp lệ | Finance actor, School context, workspace/filter/asOf hợp lệ | Server re-authorize rồi trả snapshot reconciliation và metadata/facts đúng cutoff | Invalid workspace/filter được normalize hoặc reject safe, không trả stale data |
| Cutoff/revision | Event trước/sau `asOf`, replacement/cancellation, receipt/refund/carry/debt/coverage | Chỉ fact posted đúng cutoff được tính; lineage vẫn drill-down được, obligation dùng projection effective | Không suy diễn từ live status hay catalog hiện tại |
| Empty/revoke | Không có event hoặc capability/membership bị revoke | Empty giữ metadata/filter; request sau revoke bị deny trước result/export lookup | UI xóa result/export cũ, hiện state accessible |
| CSV | Result authorized, opaque reference còn hạn | CSV bytes/metadata đúng result; audit request và download; download re-authorize | Cross-School, expired hoặc revoked reference không stream bytes |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `Invoice`, Receipt, Difference, Carry, Transfer, Coverage, Reversal và DebtTransfer là source immutable; thêm `FinanceLedgerEvent`/`FinanceReportExport` scoped School với index cutoff/filter và graph an toàn.
- `apps/api/prisma/migrations/20260925000005_actual_receipt_settlement_carry` đến `20260925000022_prior_debt_transfer_hardening` -- pattern forward-only, append-only guard và tenant composite constraints; thêm migration, không sửa migration cũ.
- `apps/api/src/modules/finance/finance.service.ts` -- `actor`, `transactionActor`, `mutate`, `audit`, posting paths `issueInvoice`, revision, `closeInvoice`, carries, coverage/reversal, debt transfer; ghi projection cùng transaction và implement canonical report/export query.
- `apps/api/src/modules/finance/finance.controller.ts` -- bổ sung Finance-only GET report, CSV request và opaque download response/header; giữ cookie identity và mutation protection chỉ nơi command thực sự cần.
- `apps/api/src/modules/finance/finance.service.test.ts` và `finance.controller.test.ts` -- BigInt DTO, capability-before-query, filter/CSV header contract.
- `apps/api/src/integration/finance.integration.test.ts` -- fixture PostgreSQL có receipt/difference/carry, revision, coverage/reversal, debt và hai School; proof cutoff, reconcile, export/audit/isolation.
- `apps/api/src/integration/finance-release-scope.integration.test.ts` -- thay guard Story 6.4 cấm report bằng allowed-surface và forbidden-capability proof của 6.5.
- `apps/web/src/school-context.tsx` -- thêm Finance report destination server-gated, reset protected report state khi School/access đổi.
- `apps/web/src/finance/finance-reports-workspace.tsx` và test mới -- read-only API consumer cho four workspace, metadata/table/safe states/CSV opaque lifecycle; không tính Finance ở browser.
- `apps/web/e2e/finance-release-gate.spec.ts` và seed -- kiểm thử Admin report flow, School switch và protected export tại surface thật.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` và migration Finance mới -- thêm append-only ledger projection, historical filter snapshots/cutoff facts và opaque expiring export record có School-bound relation/index/guards -- làm `asOf` và export durable, không phụ thuộc state sống.
- [x] `apps/api/src/modules/finance/finance.service.ts` -- dual-write reporting facts tại mọi posting/revision boundary, backfill an toàn từ immutable source nơi timestamp đã tồn tại, và tạo one canonical query/CSV artifact -- bốn workspace reconcile từ cùng authority.
- [x] `apps/api/src/modules/finance/finance.controller.ts`, service/controller tests -- expose report/result-bound CSV request/download với capability recheck, audit và secure response headers -- bảo vệ tenant/export lifecycle.
- [x] `apps/api/src/integration/finance.integration.test.ts` và `finance-release-scope.integration.test.ts` -- prove PostgreSQL cutoff, effective revision, provenance, filter, four-workspace reconciliation, VND serialization, tenant/revoke/expiry/download-audit boundaries -- release evidence thay vì fixture assertion.
- [x] `apps/web/src/school-context.tsx`, `apps/web/src/finance/finance-reports-workspace.tsx` và tests -- add authorized report route/tabs/filter/safe state and opaque CSV action; clear stale data on School/access/export changes -- UI chỉ render server DTO theo mockup approved.
- [x] `apps/web/e2e/finance-release-gate.spec.ts`, seed và `_bmad-output/implementation-artifacts/sprint-status.yaml` -- prove production surface và chỉ mark 6.5 done sau all verification/review pass.

**Acceptance Criteria:**
- Given a Finance Manager or School Admin with a valid School context, when requesting any of the four report workspaces with valid filters, then API authorizes before every aggregate and returns only School-scoped ledger/snapshot facts plus normalized cutoff metadata and JSON-safe VND.
- Given events before and after a requested `asOf`, a revision/cancellation, receipt/difference/carry, debt, coverage and posted reversal/refund, when reports reconcile, then all workspace totals/provenance reflect the same immutable ledger cutoff and current-effective obligation rule.
- Given a result is authorized, when CSV is requested then downloaded, then bytes represent that exact result and metadata, request/download are audited, opaque expiry/revocation/cross-School access are denied before bytes, and no direct URL/client CSV/PDF/XLSX is exposed.
- Given report loading, empty, invalid, denied, expired export or School switch states, when Admin renders, then it retains only safe current filter context, clears stale protected rows/export, exposes accessible metadata/loading/error/empty states and never claims a collection total without server `asOf` context.

## Design Notes

`FinanceLedgerEvent` is a reporting projection, not a replacement settlement model: each existing immutable source remains its provenance. Its timestamp records the committed business posting/cancellation boundary so report code never reconstructs past truth from current `Invoice.status`. A CSV record snapshots the canonical DTO/output at request time; download only obtains it after a fresh same-School capability check.

### 2026-09-26 Decision: outstanding and CSV access

`_bmad-output/implementation-artifacts/decision-story-6-5-reporting-outstanding-export-2026-09-26.md` resolves the report policy. Outstanding is the effective Invoice obligation at cutoff minus Receipt and SettlementTransfer only. Difference, carry, DebtTransfer, coverage and reversal/refund are separate immutable reconciliation facts; only a materialized Invoice line creates a new obligation. Any re-authorized same-School `FINANCE_MANAGE` actor may download an opaque export; the audit records its creator provenance and actual downloader. Refund/reversal reduces cash/reconciliation only and never reopens Invoice outstanding.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: reporting schema client generates.
- `pnpm --filter @passionedu/api test -- src/modules/finance/finance.service.test.ts src/modules/finance/finance.controller.test.ts` -- expected: report/export unit contracts pass.
- `pnpm --filter @passionedu/api test:integration` -- expected: `.env.test` PostgreSQL report, cutoff, audit and tenant/revoke/expiry proof passes.
- `pnpm --filter @passionedu/api typecheck` -- expected: API compiles.
- `pnpm --filter @passionedu/admin-web test -- src/finance/finance-reports-workspace.test.tsx` -- expected: report UI safe-state contracts pass.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: Admin portal compiles.
- `pnpm --filter @passionedu/admin-web test:e2e -- finance-release-gate.spec.ts` -- expected: production report/export surface passes with deterministic fixtures.
- `git diff --check` -- expected: no whitespace errors.

## Review Triage Log

### 2026-09-26 - Review passes
- intent_gap: 0
- bad_spec: 0
- patch: 24 (high 15, medium 7, low 2)
- defer: 0
- reject: 9 (medium 6, low 3)
- addressed_findings:
  - `[high] [patch]` Added CSRF protection for CSV creation, append-only ledger storage, source-key uniqueness, and same-School re-authorized export download audit.
  - `[high] [patch]` Replaced timezone-dependent ledger cutoff storage with `TIMESTAMPTZ`, backfilled timestamped immutable Finance sources, and never invented legacy cancellation timing.
  - `[high] [patch]` Implemented approved effective-Invoice outstanding policy, workspace-specific projections, strict School-scoped filters, full CSV result metadata, and stale export/report response guards.
  - `[medium] [patch]` Added report UI rendering/test coverage, collection-run reconciliation rows, source provenance and Finance workspace lifecycle refresh regression coverage.

## Auto Run Result

**Status:** done

**Summary:** Hoàn tất canonical Story 6.5 bằng Finance ledger projection append-only, four-workspace server report `FINANCE_LEDGER_V3`, effective-Invoice outstanding theo decision đã duyệt, và CSV opaque có expiry/re-authorization/audit. Admin chỉ render DTO server-authoritative và xóa/invalidate report-export stale khi School/context thay đổi.

**Files changed:** Prisma schema và migrations reporting/historical repair; Finance service/controller/authorization; PostgreSQL integration and controller/service tests; Admin report workspace, School route, Finance lifecycle refresh and UI tests; deterministic E2E seed/report proof; Story spec, decision và sprint tracker.

**Review findings:** 24 patches applied (high 15, medium 7, low 2), 0 deferred, 9 rejected. Các patch bảo vệ tenant, CSRF, append-only ledger, absolute cutoff time, historical provenance, workspace projection, CSV lifecycle và stale browser state.

**Verification completed:** Prisma generation; API unit/controller tests and typecheck; Admin report suite 125 tests and typecheck; PostgreSQL `.env.test` integration 155 tests; deterministic Playwright Finance report/export E2E; `git diff --check` all pass.

**Residual risks:** Invoice legacy đã `CANCELLED` trước ledger không có persisted cancellation timestamp, nên report giữ source facts nhưng không khẳng định interval effective giả định. Không có PDF/XLSX, custom/scheduled/Payroll report, period close/reopen hay generic balance workflow.

## Suggested Review Order

**Ledger Authority**

- Ledger records immutable, source-keyed facts at absolute posting instants.
  [`finance.service.ts:83`](../../apps/api/src/modules/finance/finance.service.ts#L83)

- Reporting derives all workspace totals and effective obligations server-side.
  [`finance.service.ts:96`](../../apps/api/src/modules/finance/finance.service.ts#L96)

- Schema binds reporting facts to School and stores timestamps as instants.
  [`schema.prisma:1258`](../../apps/api/prisma/schema.prisma#L1258)

- Forward migration backfills only timestamped immutable historical source facts.
  [`migration.sql:1`](../../apps/api/prisma/migrations/20260926000002_finance_ledger_timestamptz_and_full_backfill/migration.sql#L1)

**Protected Export**

- CSV request/download remains capability-scoped, opaque, expiring and audited.
  [`finance.service.ts:120`](../../apps/api/src/modules/finance/finance.service.ts#L120)

- Controller applies cookie mutation protection before creating export records.
  [`finance.controller.ts:25`](../../apps/api/src/modules/finance/finance.controller.ts#L25)

**Admin Surface**

- Four report workspaces display server metadata and never calculate Finance locally.
  [`finance-reports-workspace.tsx:11`](../../apps/web/src/finance/finance-reports-workspace.tsx#L11)

- Export responses are invalidated across School/context changes before navigation.
  [`finance-reports-workspace.tsx:15`](../../apps/web/src/finance/finance-reports-workspace.tsx#L15)

**Evidence**

- PostgreSQL suite proves cutoff, export audit/revoke and cross-School boundaries.
  [`finance.integration.test.ts:2615`](../../apps/api/src/integration/finance.integration.test.ts#L2615)

- Browser flow verifies report metadata, opaque CSV headers and School switch clearing.
  [`finance-release-gate.spec.ts:84`](../../apps/web/e2e/finance-release-gate.spec.ts#L84)

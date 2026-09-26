---
title: 'Chuyển prior debt và year-end settlement an toàn'
type: 'feature'
created: '2026-09-25'
status: 'done'
baseline_commit: '6150af7f8677e1430a9f622a5383bd3c8066b02d'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Finance chưa thể chuyển một phần công nợ còn mở thành nghĩa vụ `PRIOR_DEBT` trong Invoice khác, nên không có provenance source/target hay bảo vệ thu trùng khi đối soát cuối năm. Công nợ cũng không được tự chuyển sang SchoolYear mới.

**Approach:** Bổ sung debt-transfer append-only trong cùng finance posting boundary: server khóa, kiểm tra graph cùng School/Student/SchoolYear, giảm outstanding nguồn và ghi target `PRIOR_DEBT` trong một transaction idempotent. Target tiếp tục dùng actual-receipt contract hiện hữu; chỉ cung cấp các nguồn read-only đã được UX report quy định, không tự thiết kế workflow cuối năm mới.

## Boundaries & Constraints

**Always:** `School` là tenant root; re-authorize Finance Manager active trong transaction, không tin path `schoolId` hay object ID. Money là `BIGINT`/JSON-safe integer. Debt transfer, Invoice line/projection, audit và Operation append-only, có reason, actor và fingerprint. Mutation dùng origin, double-submit CSRF, UUID `Idempotency-Key`, shared lock order và Operation reconciliation. Source/target phải cùng School, Student, SchoolYear; source outstanding không âm và target được expose chỉ sau source reduction commit.

**Block If:** Prisma graph/migration forward-only không thể bảo đảm DB-level same-School source-target provenance, bounded outstanding và append-only writes mà không làm yếu guard settlement/correction hiện hữu.

**Never:** Không auto-carry debt qua SchoolYear; không generic balance, Student prepayment, unallocated/mixed Receipt, client-calculated debt/carry, direct balance edit, cross Student/School/SchoolYear source, Parent mutation/DTO, hay tự thêm write-off/adjustment/payment year-end workflow ngoài audit boundary đã có.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Chuyển debt hợp lệ | Finance Manager, source outstanding và target Invoice cùng tenant/student/year, reason và idempotency key | Một transaction giảm nguồn, append provenance và line `PRIOR_DEBT` trên target; Operation replay được | Không lỗi; target chưa thấy nếu transaction rollback |
| Retry hoặc đồng thời | Cùng request/key, fingerprint đổi, hoặc hai transfer cạnh tranh một source | Replay cùng fingerprint; key đổi bị conflict; chỉ amount còn lại được chuyển một lần | Reject atomic, không double collection hay negative source |
| Graph/lifecycle sai | Source/target khác School, Student hoặc SchoolYear, source không open, target không hợp lệ | Không tạo line/provenance hay đổi outstanding | Trả validation/conflict scoped-safe |
| Thu target | Target có `PRIOR_DEBT` và Finance post actual Receipt | `closeInvoice` hiện hữu tạo EXACT/SHORTFALL/OVERPAYMENT và Difference/carry source-linked | Không có debt collection hay carry luồng riêng |
| Cuối SchoolYear | Finance mở balances/debt hoặc tạo SchoolYear mới | Debt hiện hữu chỉ hiện qua nguồn/report được cấp quyền; không tự sinh prior debt năm mới | Direct write-off/adjustment/payment không được phép sửa balance |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `Invoice`, `InvoiceLine` và `SettlementTransfer` là graph/provenance hiện hữu; thêm biểu đạt `PRIOR_DEBT` cùng relation composite School an toàn.
- `apps/api/prisma/migrations/20260925000005_actual_receipt_settlement_carry/migration.sql` đến `20260925000020_*` -- pattern forward-only cho immutable settlement, DB guard và composite tenant constraints; tạo migration mới, không sửa lịch sử.
- `apps/api/src/modules/finance/finance.service.ts` -- tái dùng `transactionActor`, `mutate`, `closeInvoice`, `invoiceDto`, lock School/Invoice và finance posting boundary để command debt transfer/replay/audit/projection.
- `apps/api/src/modules/finance/finance.controller.ts` -- tái dùng `mutation` origin/CSRF/idempotency boundary và `GET .../operations/:operationId`; thêm Finance-only transfer/read route cần thiết.
- `apps/api/src/modules/finance/finance.service.test.ts` và `apps/api/src/modules/finance/finance.controller.test.ts` -- convention validation VND, capability, reason, headers và response contract.
- `apps/api/src/integration/finance.integration.test.ts` -- PostgreSQL proof cho atomic source reduction, tenant/year/student graph, retry/concurrency, target actual close và no-auto-carryover.
- `apps/api/src/integration/finance-release-scope.integration.test.ts` -- cập nhật release scope để debt transfer được phép theo guard Story 6.4 thay vì bị deny như phạm vi 6.3.
- `apps/web/src/finance/finance-workspace.tsx` và `apps/web/src/finance/finance-workspace.test.tsx` -- chỉ tái dùng command/reconcile/source trail nếu API bề mặt hiện hành cần render `PRIOR_DEBT`; giữ layout/mockup report và không thêm year-end mutation UI.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma` và migration Finance mới -- persist source-to-target `PRIOR_DEBT` immutable, same-School/Student/SchoolYear constraints, bounded remaining outstanding và direct-write guards -- bảo toàn tenant/provenance.
- `apps/api/src/modules/finance/finance.service.ts` và `finance.controller.ts` -- thêm idempotent Finance debt-transfer command/read projection trong shared posting transaction và expose Operation reconciliation -- source giảm trước target exposure, không có writer debt riêng.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, `apps/api/src/integration/finance.integration.test.ts`, `finance-release-scope.integration.test.ts` -- chứng minh matrix, rollback, replay/fingerprint, cross-graph deny, concurrency, actual target settlement và no-auto-carryover trên PostgreSQL `.env.test`.
- `apps/web/src/finance/finance-workspace.tsx` và `finance-workspace.test.tsx` -- nếu server DTO mới xuất hiện trên invoice/source trail đã có, render server provenance và timeout reconciliation theo UX hiện hành; không tạo interaction/layout mới.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chỉ mark Story 6.4 done sau review và verification pass.

**Acceptance Criteria:**
- Given a valid same-School/Student/SchoolYear source outstanding and target Invoice, when a Finance Manager transfers debt with reason and idempotency key, then one append-only `PRIOR_DEBT` provenance is created and source outstanding is atomically reduced before target becomes observable.
- Given retries, changed fingerprints or concurrent debt transfers, when they contend for a source, then identical retries replay and all other requests reject or remain bounded without double collection, negative source, or cross-tenant/year graph.
- Given a target Invoice containing `PRIOR_DEBT`, when Finance posts actual receipt, then it follows the existing actual-receipt close contract and any non-exact outcome has source-linked SettlementDifference/carry rather than a separate debt-payment path.
- Given SchoolYear end or a new SchoolYear, when Finance views debt/open balances or year setup runs, then no debt is automatically carried into the new year and no direct balance mutation/write-off workflow is exposed.
- Given Finance sees transfer provenance or an uncertain request, when the UI/API responds, then it shows server-returned source facts only and reconciles the persisted Operation before a retry.

## Design Notes

Debt transfer is an obligation movement, not payment. Its target line is deliberately settled by `closeInvoice()` so `EXACT`, `SHORTFALL`, `OVERPAYMENT`, Difference and carry retain the one-Invoice actual-receipt invariant. The existing Finance report debt workspace is the authorized read surface; Story 6.4 must not invent a year-end close workflow.

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 14 (high 8, medium 6)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high]` `[patch]` Made `PRIOR_DEBT` target lines immutable in service and database; blocked direct edits/deletes, coverage-source transfers, closed target lifecycle and source/target revision.
  - `[high]` `[patch]` Hardened source-specific transfer locking and bounded direct/concurrent writes; added tenant, student, SchoolYear and no-auto-carryover PostgreSQL proof.
  - `[medium]` `[patch]` Corrected source versus target read projections and receipt default so UI uses server-confirmed source outstanding without inventing a transfer workflow.

## Auto Run Result

**Status:** done

**Summary:** Hoàn tất Story 6.4 với `DebtTransfer` append-only và dòng `PRIOR_DEBT` bất biến. Finance transfer dùng shared posting boundary, idempotency/Operation/audit, giới hạn source outstanding và graph cùng School/Student/SchoolYear; Invoice target vẫn close theo actual-receipt contract hiện hữu.

**Files changed:** Prisma Finance graph cùng migrations `20260925000021` và `20260925000022`; Finance service/controller/tests và PostgreSQL integration/release-scope proof; Finance workspace source/target provenance; Story spec và sprint tracker.

**Review findings:** 14 patches applied (high 8, medium 6), 0 deferred, 0 rejected. Follow-up review recommendation: `true`; patch score is `24`.

**Verification completed:** Prisma generate; API typecheck; Finance unit/controller tests; Admin typecheck và workspace suite 117 tests; full `.env.test` PostgreSQL integration 154 tests; `git diff --check` all pass. Matrix rows are covered by the integration/UI suites, including replay/fingerprint, concurrent bounded transfer, tenant/student/year/lifecycle guards, immutable provenance, actual settlement and no automatic carryover.

**Residual risks:** Year-end write-off, adjustment and payment remain deliberately out of scope as audited workflows to be specified separately. The Finance workspace exposes server-returned source/target provenance only because approved UX does not define a new debt-transfer form.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: Prisma client generates from the new prior-debt graph.
- `pnpm --filter @passionedu/api test -- src/modules/finance/finance.service.test.ts src/modules/finance/finance.controller.test.ts` -- expected: Finance command/controller contract passes.
- `pnpm --filter @passionedu/api test:integration` -- expected: `.env.test` PostgreSQL integration proves debt transfer isolation, idempotency and concurrency.
- `pnpm --filter @passionedu/api typecheck` -- expected: API typecheck passes.
- `pnpm --filter @passionedu/admin-web test -- src/finance/finance-workspace.test.tsx` -- expected: Finance source/reconciliation UI regression passes when changed.
- `git diff --check` -- expected: no whitespace errors.

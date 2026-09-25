---
title: 'Đóng exact Invoice có promotion coverage'
type: 'feature'
created: '2026-09-25'
status: 'done'
baseline_commit: 'a966d64d0302557858a5bb72257d00d2dd762e23'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Settlement hiện chỉ đóng Invoice bằng Receipt và cho phép chênh lệch, trong khi Finance chưa thể chọn `PREPAID_COVERAGE`, snapshot các kỳ tương lai, hoặc phát hành coverage sau khi nhận đúng tiền. Các monthly run tương lai cũng chưa biết chỉ bỏ qua fact đã được coverage phát hành.

**Approach:** Mở rộng policy/version, monthly-run preview/generation, Invoice snapshot và exact Receipt close để server tạo immutable future facts, yêu cầu exact toàn transaction và issue `StudentPromotionalCoverage` append-only với paid provenance. Admin Finance chỉ review/chọn dữ liệu server-returned và reconcile Operation.

## Boundaries & Constraints

**Always:** Re-authorize active same-School `FINANCE_MANAGE` trong transaction trước aggregate lookup; scope School cho query, FK/unique/guard, lock, audit và Operation. Giữ `MONTHLY` normal run, một Receipt cho một Invoice, VND `BIGINT`/JSON-safe, origin + double-submit CSRF + UUID `Idempotency-Key`, fingerprint/replay và reconciliation. Future fact/coverage phải snapshot policy version, Student/SchoolYear/Receivable, original price/reduction, service interval, calendar version/timezone, Invoice/Receipt exact provenance; issued data append-only. Invoice có future fact phải reject toàn bộ posting nếu actual amount không bằng outstanding, không tạo Receipt/Difference/carry/coverage. Chỉ normal run sau đó skip fact coverage đã issue, cùng Student/School/SchoolYear/Receivable/period và không overlap.

**Block If:** Contract monthly preview/READY/generation hiện hữu không thể persist future fact snapshot trước khi Invoice DRAFT lộ ra, hoặc PostgreSQL không thể enforce immutable same-School provenance và coverage overlap mà không làm yếu Story 6.1 settlement guard.

**Never:** Không tạo PREPAID CollectionRun riêng, direct coverage create, client-derived eligibility/period/price/discount/total, partial/excess/unallocated/multi-Invoice Receipt, generic balance, `StudentPrepayment`, manual coverage/carry, cross-Student/School/SchoolYear use, Parent selection/payment/internal coverage DTO, hay refund/reversal workflow của Story 6.3.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Snapshot coverage | Finance chọn effective same-School `PREPAID_COVERAGE` trong preview `MONTHLY` hợp lệ | Server derive future receivable-period facts, fingerprint/recheck và persist immutable fact cùng Invoice DRAFT | Invalid policy/version/assignment/calendar/period từ chối trước DRAFT expose |
| Exact close | Invoice `ISSUED` có future facts, actual amount đúng outstanding | Một transaction tạo Receipt/allocation provenance, đóng `CLOSED` `EXACT`, issue coverage/facts và Operation result | Same key replay cùng outcome |
| Non-exact coverage close | Actual thấp/cao hơn outstanding hoặc Invoice cancelled/stale | Không ghi Receipt, Allocation, Difference, carry hay coverage | Reject toàn transaction; UI refresh/reconcile Operation |
| Future monthly generation | Coverage fact đã issue cho Student/SchoolYear/Receivable/period | Chỉ fact đó bị skip; các line/fact không liên quan vẫn bill bình thường | Overlap/cross-scope/invalid source bị reject |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `PromotionPolicyVersion`, CollectionRun selection/generation, Invoice/Receipt và promotion models; thêm fulfillment mode, immutable Invoice future-fact/issued-coverage graph và School-scoped relations.
- `apps/api/prisma/migrations/20260925000005_actual_receipt_settlement_carry/migration.sql` và `20260925000009_actual_receipt_final_guard_repair/migration.sql` -- mẫu Receipt/lifecycle immutable guard; tạo migration mới, không sửa lịch sử, để enforce coverage provenance, append-only và overlap.
- `apps/api/src/modules/finance/finance.service.ts` -- `closeInvoice`, `invoiceDto`, `selectionPreview`, `promotionFacts`, `readyRun`, `generateRun`, `invoiceData`, `insertInvoices`, `materializeCarries`, `transactionActor` và `mutate` là các điểm tái sử dụng cho snapshot, exact gate, locking, audit và Operation.
- `apps/api/src/modules/finance/finance.controller.ts` -- receipt endpoint đã có origin/CSRF/idempotency boundary; chỉ mở rộng preview/READY/generate contract hoặc thêm command selection nếu request hiện hữu không biểu đạt selection an toàn.
- `apps/api/src/modules/finance/finance.service.test.ts` và `finance.controller.test.ts` -- validation, JSON-safe DTO, protected mutation/idempotency forwarding.
- `apps/api/src/integration/finance.integration.test.ts` -- settlement fixture Story 6.1 cho proof PostgreSQL atomicity, tenant/year isolation, retry, concurrency và guards.
- `apps/api/src/integration/finance-release-scope.integration.test.ts` -- gate Pha 1b hiện cấm coverage; thay thế assertion đó bằng scope gate Story 6.2, vẫn cấm tính năng ngoài contract.
- `apps/web/src/finance/finance-workspace.tsx` -- preview, Invoice detail, receipt dialog, `command` và `reconcile`; hiển thị exact-only/facts/outcome server-returned, không optimistic coverage.
- `apps/web/src/finance/finance-workspace.test.tsx` -- invoice coverage render, exact settlement, timeout reconciliation, School-switch và accessibility regression.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md` và `mockups/MOCKUP-COVERAGE.md` -- read-only UX contract: Finance chọn version sau Parent agreement, Invoice DRAFT snapshot future fact và coverage chỉ issue sau exact close.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma` và migration Finance mới -- thêm fulfillment mode, immutable future coverage facts và `StudentPromotionalCoverage`/fact provenance cùng composite School constraints, append-only guards và anti-overlap -- làm trạng thái paid coverage unsafe không thể biểu diễn.
- `apps/api/src/modules/finance/finance.service.ts` và `finance.controller.ts` -- server-authoritative selection/preview/READY/generation, skip issued facts, exact-only receipt gate và atomically issue coverage with Operation/audit -- giữ authority và one-Invoice settlement boundary trong API.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, `apps/api/src/integration/finance.integration.test.ts` và `finance-release-scope.integration.test.ts` -- chứng minh validation, lifecycle, immutable DB guards, replay/concurrency, tenant graph, exact failure rollback, overlap và selective future skip trên `.env.test` PostgreSQL.
- `apps/web/src/finance/finance-workspace.tsx` và `finance-workspace.test.tsx` -- expose Finance-only server facts/selection and exact-confirmation/result/reconciliation UI theo mockup -- không cung cấp partial, generic credit hoặc Parent action.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chuyển `epic-6` và Story 6.2 sang trạng thái hoàn thành sau review/verification đạt.

**Acceptance Criteria:**
- Given Finance chọn một version `PREPAID_COVERAGE` hợp lệ trong monthly-run preview, when server READY/generate Invoice DRAFT, then future receivable-period facts được snapshot immutable trước khi Invoice expose và mọi policy/assignment/calendar/fact input được recheck/fingerprinted.
- Given Finance đóng exact một Invoice `ISSUED` có future facts, when posting commit, then một Receipt/allocation provenance append-only đóng Invoice `CLOSED` outcome `EXACT` và issue một coverage cho từng fact với policy, paid source, price/reduction, interval và calendar snapshot.
- Given actual amount không exact hoặc source cancelled/stale/cross-scope/overlap, when request xử lý, then toàn posting reject, không tạo bất kỳ Receipt, Difference, carry hoặc coverage nào; retry/concurrency chỉ replay hoặc reject an toàn.
- Given normal monthly run kế tiếp generate, when kiểm tra facts issued, then chỉ receivable-period đã coverage cho đúng Student/School/SchoolYear bị skip, còn line/fact không liên quan không bị loại.
- Given Admin Finance review preview, Invoice hoặc kết quả Operation, when UI render/timeout/retry, then UI hiển thị policy version, facts, original price, reduction, exact outstanding và issued/as-of result server-returned, reconcile trước retry và không lộ control/data nội bộ cho Parent.

## Design Notes

Coverage selection là intent cho Invoice DRAFT, không phải coverage entitlement. Chỉ snapshot fact gắn Invoice và `CLOSED + EXACT` trong cùng transaction mới materialize entitlement; điều này phân biệt pending selection với issued coverage và bảo toàn policy/calendar lịch sử khi cấu hình live thay đổi.

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 18 (high 9, medium 7, low 2)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high]` `[patch]` Trả coverage selection/fact server-derived trong run/preview, giữ multi-period selection an toàn và tách `PREPAID_COVERAGE` khỏi discount evaluator.
  - `[high]` `[patch]` Re-derive fact future theo kỳ/service calendar, chặn overlap/issued duplicate/stale source và bảo vệ issue, line mutation, revision, PostgreSQL invariant.
  - `[medium]` `[patch]` Hoàn thiện form fulfillment mode, Finance UI fact/exact messaging và controller/UI/integration regression coverage.

## Auto Run Result

**Summary:** Hoàn tất Story 6.2: Finance chọn `PREPAID_COVERAGE` trong normal monthly run, server snapshot fact future immutable, chỉ close exact mới atomically issue `StudentPromotionalCoverage`, và run sau chỉ skip đúng receivable-period đã issue.

**Files changed:**
- `apps/api/prisma/schema.prisma` và migrations `20260925000010` đến `20260925000012` -- fulfillment mode, coverage graph và PostgreSQL immutable/provenance/period guards.
- `apps/api/src/modules/finance/finance.service.ts` và `finance.controller.ts` -- authoritative selection/preview/generation, exact settlement/Operation, coverage issuance và validation.
- `apps/api/src/modules/finance/*.test.ts` và `apps/api/src/integration/*.test.ts` -- controller, lifecycle, concurrency, rollback, tenant/provenance và scope proof.
- `apps/web/src/finance/finance-workspace.tsx` và test -- Finance-only selection, server facts và exact-close review/reconciliation UI.
- `_bmad-output/implementation-artifacts/epic-6-context.md` và `sprint-status.yaml` -- refreshed Epic context và completion tracker.

**Review findings:** 18 patches applied (high 9, medium 7, low 2), 0 deferred, 0 rejected. Follow-up review recommendation: `true`; patch score is `9 high`.

**Verification:** Prisma generate, API Finance unit/controller tests, API typecheck, Admin Finance tests (110 tests), full PostgreSQL integration on `.env.test` target `anhhoa_test` (140 tests), and `git diff --check` passed.

**Residual risks:** Integration emits an existing `pg` deprecation warning for overlapping `client.query()` execution. Future effective-dated receivable pricing is not modeled; future coverage price is re-derived from the authoritative receivable price at READY/generation.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: Prisma client sinh từ schema coverage thành công.
- `pnpm --filter @passionedu/api test -- src/modules/finance/finance.service.test.ts src/modules/finance/finance.controller.test.ts` -- expected: Finance unit/controller coverage tests pass.
- `TARGET_INTEGRATION_DATABASE_URL="$TARGET_INTEGRATION_DATABASE_URL" pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL integration suite dùng `.env.test` pass, gồm settlement/coverage guards.
- `pnpm --filter @passionedu/api typecheck` -- expected: API typecheck pass.
- `pnpm --filter @passionedu/admin-web test -- src/finance/finance-workspace.test.tsx` -- expected: Admin Finance coverage UI/reconciliation tests pass.
- `git diff --check` -- expected: no whitespace errors.

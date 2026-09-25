---
title: 'Story 5.13: Preview và generate ưu đãi authoritative'
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: 'b07a19bcd4ffb5baf34d721e8b197c0cafcf05a3'
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/implementation-artifacts/decision-story-5-12-promotion-policy-contract-2026-09-25.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-25-promotion-policy-phase-1b.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Preview/generate CollectionRun hiện chỉ tính roster và template gross, không đánh giá PromotionPolicy hoặc phát hiện policy/target/assignment đã đổi. Điều này có thể tạo Invoice DRAFT không phản ánh ưu đãi hợp lệ của học sinh tại billing month.

**Approach:** Server đánh giá deterministic policy ACTIVE và assignment hiệu lực cho từng Student/template line, trả gross/discount/net cùng provenance server-returned, và đưa toàn bộ fact liên quan vào fingerprint stale. Generate snapshot kết quả evaluation trước worker để Invoice DRAFT không đọc lại policy live.

## Boundaries & Constraints

**Always:** Dùng duy nhất `CollectionRun.billingMonth` (ngày đầu tháng) làm as-of. Áp dụng FIXED_VND trước PERCENTAGE, priority giảm dần, tie-break policy ID; EXCLUSIVE loại policy khác trên cùng Receivable trong kỳ. Mọi discount cap tại gross, net không âm, VND BIGINT trả JSON-safe string. Browser chỉ gửi fingerprint opaque hoặc request generate hiện hữu, không gửi formula/money. READY/generate re-authorize, lock/re-evaluate policy facts trong transaction; fact policy/version/target/assignment liên quan đổi phải tạo `PREVIEW_STALE`. Draft line persist gross/discount/net và evaluation provenance để worker/publish không suy diễn policy live.

**Block If:** Cần semantics mới cho cadence, target quantity/unit, fulfillment, auto eligibility, partial settlement/coverage hoặc thay đổi rule stacking/exclusivity đã duyệt.

**Never:** Không tạo immutable `InvoicePromotionApplication` lúc Issue, Issue recheck, Receipt, settlement/carry/refund, PREPAID_COVERAGE, Class/service/attendance eligibility, client-calculated money hoặc policy cross-School.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Evaluate deterministic | Student eligible, nhiều policy ACTIVE/assignment/target hợp lệ | Preview per Student/line trả gross, applied policy/reason, discount, net theo thứ tự fixed rồi percentage/priority/policy ID | Discount bị cap gross; line không target có discount 0 |
| Exclusive policy | Một EXCLUSIVE và policy khác cùng Receivable/kỳ | Sau policy exclusive, policy khác không áp dụng trên Receivable đó | Không tạo dòng âm hoặc generic credit |
| Preview stale | Policy/version/target/assignment relevant đổi sau preview | READY và generate recompute fingerprint, từ chối fingerprint cũ | `PREVIEW_STALE`, không ghi transition/generation/Invoice partial |
| Async generate | READY fingerprint hiện hành | Staged snapshot mang calculated lines; worker persist đúng DRAFT total | Retry replay Operation; worker không đọc live policy |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `InvoiceLine` hiện chỉ có `amount`; thêm gross/discount/net và evaluation provenance cho DRAFT snapshot.
- `apps/api/prisma/migrations/` -- migration additive cho calculation snapshot, không sửa migration Story 5.12.
- `apps/api/src/modules/finance/finance.service.ts` -- `selectionPreview()`, `readyRun()`, `generateRun()`, `addGeneratedStudent()`, `invoiceData()` và `insertInvoices()` là flow evaluator/fingerprint/snapshot; tái dùng `actor()`, `transactionActor()`, locks, Operation/audit.
- `apps/api/src/modules/finance/finance.controller.ts` -- giữ route preview/ready/generate và mutation boundary hiện hữu, cập nhật DTO test mock nếu contract response mở rộng.
- `apps/api/src/modules/finance/finance.service.test.ts` và `finance.controller.test.ts` -- deterministic ordering, cap, stale fact, authoritative request/DTO boundary.
- `apps/api/src/integration/finance.integration.test.ts` -- PostgreSQL proof evaluation, tenant isolation, READY/generate stale và staged snapshot.
- `apps/web/src/finance/finance-workspace.tsx` -- type/render preview and Invoice calculated values, không local calculate; preserve CSRF, Operation reconciliation và School response guard.
- `apps/web/src/finance/finance-workspace.test.tsx` -- server-only presentation, stale and School-switch regression proof.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma` và migration mới -- persist calculated InvoiceLine DRAFT snapshot (`grossAmount`, `discountAmount`, `netAmount`, evaluation provenance) while `amount`/Invoice total equal net.
- `apps/api/src/modules/finance/finance.service.ts` -- load School-scoped applicable policy/version/target/assignment facts at billing month, evaluate each eligible Student/template line deterministically, include relevant facts/result in preview fingerprint, and stage calculated snapshots for generate/add-generated-student.
- `apps/api/src/modules/finance/finance.controller.ts` -- preserve protected preview/readiness/generate route inputs and expose expanded server DTO through existing service calls.
- `apps/web/src/finance/finance-workspace.tsx` -- render server-returned per-student gross/discount/net and policy reason in preview/invoice without formula or client totals.
- `apps/api/src/modules/finance/*.test.ts`, `apps/api/src/integration/finance.integration.test.ts`, `apps/web/src/finance/finance-workspace.test.tsx` -- cover matrix, JSON-safe VND, policy stale, staged generation, tenant/retry and UI switch safety.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- mark 5.13 done only after tests and review pass.

**Acceptance Criteria:**
- Given eligible Student and applicable active policies, when preview/generate runs, then API alone returns and persists deterministic per-line gross, discount, net and server provenance, with Invoice total equal net sum.
- Given FIXED/PERCENTAGE, priority ties, STACKABLE/EXCLUSIVE and excess discount, when evaluated, then approved order/rules apply, discount never exceeds gross and no negative line exists.
- Given a relevant promotion fact changes after preview, when READY or generate runs, then it returns `PREVIEW_STALE` before partial writes; unrelated School data cannot affect or leak into evaluation.
- Given Finance views preview or reconciles generate, when rendering or switching School, then only server-returned values for current School appear and browser never sends calculated values.

## Design Notes

`amount` remains the existing line/Invoice total basis and becomes net amount for generated DRAFT lines. New explicit gross/discount/net fields preserve the calculation explanation without creating the Issue-time immutable application model owned by Story 5.14. Generated-student insertion evaluates at its own command time using the frozen run template and current facts at the run billing month.

## Review Triage Log

### 2026-09-25 - Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 7 (high 2, medium 5)
- defer: 0
- reject: 5
- addressed_findings:
  - [high] [patch] Thêm advisory lock transaction-scoped theo School cho mutation/evaluation promotion để không có fact mới chen giữa revalidation và staging.
  - [high] [patch] Loại toàn bộ phép cộng BigInt/reduce ở browser; preview chỉ render từng calculated line server-returned và reason server-returned.
  - [medium] [patch] Persist provenance đầy đủ interval version/assignment và hiển thị assignment reason thay vì policy UUID.
  - [medium] [patch] Cho phép CollectionRun đóng khi chỉ còn Invoice DRAFT net 0; DRAFT total dương vẫn chặn close.
  - [medium] [patch] Bổ sung proof integration cho tie-break policy ID, generated student, calculated snapshot staged, zero-net close và advisory lock.
  - [medium] [patch] Bổ sung test UI cho gross/discount/net/reason server-returned.
  - [medium] [patch] Sửa assertion EXCLUSIVE để policy exclusive là policy duy nhất áp dụng cho Receivable/kỳ theo contract.

## Auto Run Result

Summary: Story 5.13 thêm evaluator ưu đãi deterministic vào preview, READY, generate và thêm Student sau generate. InvoiceLine DRAFT lưu gross/discount/net cùng evaluation provenance; fingerprint bao gồm fact promotion và worker chỉ persist staged snapshot.

Files changed:
- `apps/api/prisma/schema.prisma` và `apps/api/prisma/migrations/20260925000001_invoice_line_promotion_evaluation_snapshot/migration.sql` -- calculated line snapshot, invariant gross/net và finality cho Draft 0 VND.
- `apps/api/src/modules/finance/finance.service.ts` -- evaluator, stale fingerprint, advisory lock School-scoped, staged snapshot và zero-net close handling.
- `apps/api/src/modules/finance/finance.service.test.ts` và `apps/api/src/integration/finance.integration.test.ts` -- ordering, exclusive/cap, stale, worker, generated-student, zero-net và concurrency proof.
- `apps/web/src/finance/finance-workspace.tsx` và `apps/web/src/finance/finance-workspace.test.tsx` -- calculated values/reason server-returned without browser totals.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Story 5.13 completion.

Review findings breakdown: 7 patches applied (high 2, medium 5; score 17), 0 deferred, 5 rejected as out-of-contract/manual-DRAFT concerns or unspecified calculation semantics.

Follow-up review recommendation: true (patched high findings; score 17).

Verification performed:
- `pnpm typecheck && pnpm test && git diff --check` -- pass; API 17 files / 128 tests, Admin 9 files / 103 tests.
- `set -a && source .env.test && set +a && pnpm test:integration` from `apps/api` -- pass; 8 files / 128 PostgreSQL integration tests on `anhhoa_test`.

Residual risks: Existing `pg` concurrent-query deprecation warning and React `act(...)` warning remain non-failing test-runtime warnings. Story 5.14 still owns Issue-time promotion recheck and immutable issued application snapshot.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test` -- expected: Finance service/controller tests pass.
- `set -a && source .env.test && set +a && pnpm test:integration` from `apps/api` -- expected: PostgreSQL evaluator/generate integration passes on test DB.
- `pnpm --filter @passionedu/admin-web test` -- expected: Finance workspace tests pass.
- `pnpm typecheck && pnpm test && git diff --check` -- expected: workspace checks and whitespace pass.

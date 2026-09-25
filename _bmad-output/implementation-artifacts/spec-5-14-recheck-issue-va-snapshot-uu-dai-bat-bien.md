---
title: 'Story 5.14: Recheck Issue và snapshot ưu đãi bất biến'
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '1f4fd2bd694cb3aafed4567a40d4cc640ce8ce26'
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/implementation-artifacts/decision-story-5-12-promotion-policy-contract-2026-09-25.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-25-promotion-policy-phase-1b.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Invoice DRAFT hiện có calculation provenance tạm thời từ generate, nhưng Issue không tái đánh giá policy/target/assignment và không có application snapshot bất biến. Fact ưu đãi đổi giữa generate và Issue có thể khiến Invoice phát hành âm thầm theo kết quả cũ.

**Approach:** Trong transaction Issue, server khóa cùng phạm vi với mutation promotion, tái đánh giá authoritative theo billing month và chỉ phát hành khi kết quả khớp DRAFT. Khi phát hành, tạo application snapshot School-scoped bất biến cho từng application; outcome khác trả yêu cầu review mới mà không ghi một phần.

## Boundaries & Constraints

**Always:** Dùng first day của `CollectionRun.billingMonth` làm as-of; tái dùng evaluator deterministic của Story 5.13 (FIXED_VND trước PERCENTAGE, priority giảm, policy ID tie-break, EXCLUSIVE, cap gross). Cả Issue thường và issue revision phải cùng bảo vệ. Tất cả graph/read/write/unique/audit/Operation scope School, `FINANCE_MANAGE`, CSRF/origin, UUID `Idempotency-Key` và reconciliation giữ nguyên. VND `BIGINT` trả string JSON-safe; application snapshot copy đủ policy/version/target/outcome và assignment provenance, không phụ thuộc fact live sau Issue.

**Block If:** Cần thay đổi semantics đã duyệt của manual DRAFT line, cadence/quantity target, stacking/exclusivity, lifecycle revision, hoặc cần endpoint refresh/review mới thay vì Issue trả review-required.

**Never:** Không tạo browser-calculated money/formula, negative discount/generic credit, partial application snapshot, mutation snapshot issued, `PREPAID_COVERAGE`, Receipt/settlement/carry/refund/debt/report, hay eligibility Class/service/attendance/Parent/Teacher.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Issue khớp recheck | Invoice DRAFT có calculated provenance, fact policy không đổi | Transaction tái đánh giá và Issue; persist một immutable application snapshot cho mỗi application, cùng payment/obligation snapshot | Idempotency replay trả cùng Operation, không duplicate snapshot |
| Outcome đã đổi | Policy/version/target/assignment relevant đổi sau generate | Issue không đổi Invoice khỏi DRAFT và yêu cầu review mới | `PROMOTION_REVIEW_REQUIRED`, rollback application/audit/Issue outcome |
| Fact live đổi sau Issue | Invoice đã ISSUED rồi policy/assignment/catalog đổi | Detail DTO vẫn lấy issued application snapshot và amount đã snapshot | Không rewrite snapshot hay suy diễn lại từ live graph |
| Concurrent issue/policy mutation | Cùng School, Issue và promotion mutation chạy đồng thời | Cùng advisory lock serializes recheck và write; chỉ outcome nhất quán được Issue | Không có partial/duplicate application snapshot |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `Invoice`/`InvoiceLine` tại khoảng 844-929 đang có DRAFT calculation provenance; thêm relation/model issued application với composite School references và immutable copied fields.
- `apps/api/prisma/migrations/` -- thêm migration forward-only; migration `20260925000001_invoice_line_promotion_evaluation_snapshot` đã áp dụng, không sửa. Theo guard finality của `20260921000013_invoice_line_cleanup_guard` và `20260921000014_invoice_issue_snapshot_coherence`.
- `apps/api/src/modules/finance/finance.service.ts` -- `issueInvoice()` khoảng 288-313 và `issueRevision()` khoảng 346-374 là transaction boundary; tái dùng `promotionLock()`, `promotionFacts()`, `evaluatePromotionLine()`, `lineDto()`/`invoiceDto()` và `mutate()` để recheck, snapshot và Operation rollback/replay.
- `apps/api/src/modules/finance/finance.controller.ts` -- issue routes khoảng 38-40 đã có CSRF/idempotency boundary; chỉ mở rộng DTO/error handling khi service contract cần thiết, không nhận money/promotion input.
- `apps/api/src/modules/finance/finance.service.test.ts` và `finance.controller.test.ts` -- thêm proof recheck outcome, review-required và controller boundary nếu error/DTO mở rộng.
- `apps/api/src/integration/finance.integration.test.ts` -- hiện có promotion staged DRAFT, Issue snapshot/idempotency và finality tests; thêm PostgreSQL proof changed fact rollback, immutable application, retry/concurrency và same-School graph.
- `apps/web/src/finance/finance-workspace.tsx` -- Issue body hiện chỉ gửi `bankAccountId`; hiển thị server-returned review-required/application snapshot nếu DTO thay đổi, giữ named confirmation, reconciliation và School response guard.
- `apps/web/src/finance/finance-workspace.test.tsx` -- mở rộng server-only UI proof cho review-required/issued provenance và School-switch safety.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chỉ mark 5.14 done sau implementation, review và verification pass.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma` và migration mới -- tạo issued promotion application School-scoped với provenance/outcome copied, composite integrity, uniqueness/order và DB finality tương ứng Invoice issued state.
- `apps/api/src/modules/finance/finance.service.ts` -- dùng lock và evaluator chung để recheck tất cả calculated DRAFT line trước Issue/issue revision; reject atomic bằng `PROMOTION_REVIEW_REQUIRED` khi result lệch, còn khi khớp persist application snapshots rồi issue.
- `apps/api/src/modules/finance/finance.controller.ts` và DTO service -- giữ request server-authoritative, expose only server-returned review/snapshot information cần render.
- `apps/web/src/finance/finance-workspace.tsx` -- render response review-required và issued application provenance từ API; không local recalculate hoặc resubmit không đối soát.
- `apps/api/src/modules/finance/*.test.ts`, `apps/api/src/integration/finance.integration.test.ts`, `apps/web/src/finance/finance-workspace.test.tsx` -- cover matrix, retry, finality, tenant graph, concurrency và response guard.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- mark 5.14 done sau khi test và review pass.

**Acceptance Criteria:**
- Given Invoice DRAFT có promotion application từ preview/generate, when Finance Issue với Idempotency-Key, then server re-evaluate policy/target/assignment trong transaction trước khi snapshot gross, discount, net, version/target/outcome và assignment provenance.
- Given một promotion fact liên quan làm outcome khác DRAFT, when Issue hoặc issue revision chạy, then API trả yêu cầu review mới và Invoice, Operation/audit issue cùng application table không có partial write.
- Given Invoice đã ISSUED, when catalog/policy/version/assignment sau đó thay đổi, then issued application snapshot và display server DTO không bị live fact rewrite.
- Given retry hoặc concurrent policy mutation trong cùng School, when Issue chạy, then idempotency/reconciliation và advisory lock không tạo application snapshot duplicate hoặc cross-School provenance.
- Given Finance render Issue/review result hoặc chuyển School, when response về, then browser chỉ hiển thị server-returned value của School hiện hành và không gửi discount/total/formula.

## Design Notes

DRAFT `promotionEvaluationProvenance` là evidence có thể bị stale; application table là record issued độc lập, chỉ được tạo trong cùng Issue transaction sau equality recheck. So sánh phải bao quát calculated gross/discount/net và application provenance theo deterministic order, không chỉ tổng Invoice, để một policy/version/assignment thay đổi nhưng tổng ngẫu nhiên bằng nhau không lọt qua.

## Review Triage Log

### 2026-09-25 - Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 5 (medium 5)
- defer: 0
- reject: 13
- addressed_findings:
  - [medium] [patch] Thêm School-scoped promotion advisory lock vào `issueRevision()` để recheck không chạy song song mutation policy.
  - [medium] [patch] Khi `PROMOTION_REVIEW_REQUIRED`, đóng dialog, reset confirmation và reload Invoice hiện hành theo School trước khi cho Finance rà soát.
  - [medium] [patch] Render issued/cancelled application snapshot thay vì DRAFT evaluation provenance.
  - [medium] [patch] Bổ sung integration proof retry idempotent cùng direct DB trigger proof cho DRAFT và invoice/line mismatch.
  - [medium] [patch] Thắt DB constraint ordinal/priority và same-invoice line guard cho immutable application.

## Auto Run Result

Summary: Story 5.14 tái đánh giá ưu đãi trong transaction Issue và issue revision, từ chối outcome thay đổi bằng `PROMOTION_REVIEW_REQUIRED`, rồi lưu issued application snapshot School-scoped bất biến khi kết quả khớp.

Files changed:
- `apps/api/prisma/schema.prisma` và `apps/api/prisma/migrations/20260925000002_invoice_promotion_application_snapshot/migration.sql` -- issued application model, composite tenant integrity và DB finality.
- `apps/api/src/modules/finance/finance.service.ts` -- Issue/revision lock, authoritative recheck, snapshot write và issued DTO projection.
- `apps/api/src/integration/finance.integration.test.ts` -- snapshot, stale rollback, idempotency và direct database guard proofs.
- `apps/web/src/finance/finance-workspace.tsx` và `apps/web/src/finance/finance-workspace.test.tsx` -- review-required UX và issued snapshot rendering server-returned.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Story 5.14 completion.

Review findings breakdown: 5 patches applied (medium 5; score 15), 0 deferred, 13 rejected as legacy-backfill, speculative DB hardening beyond contract, or duplicated test requests.

Follow-up review recommendation: false (patched high 0, medium 5, low 0; score 15).

Verification performed:
- `pnpm --filter @passionedu/api test` -- pass; 17 files / 128 tests.
- `set -a && source ../../.env.test && set +a && pnpm test:integration` from `apps/api` -- pass; 8 files / 131 PostgreSQL integration tests on `anhhoa_test`.
- `pnpm --filter @passionedu/admin-web test` -- pass; 9 files / 105 tests.
- `pnpm typecheck && pnpm test && git diff --check` -- pass on retry. Lần chạy trước có flake không liên quan tại `school-context.test.tsx` (`opens the independent parent list`); lần chạy lại toàn bộ workspace pass.

Residual risks: Test database đã có migration snapshot trước khi thêm constraint hardening trong migration source, nên constraint mới sẽ được xác thực đầy đủ trên database fresh/deployment. Cảnh báo runtime có sẵn từ `pg` concurrent query và React `act(...)` không làm fail suite.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test` -- expected: Finance service/controller tests pass.
- `set -a && source .env.test && set +a && pnpm test:integration` from `apps/api` -- expected: PostgreSQL Issue recheck/application snapshot tests pass on test DB.
- `pnpm --filter @passionedu/admin-web test` -- expected: Finance workspace tests pass.
- `pnpm typecheck && pnpm test && git diff --check` -- pass on retry; workspace checks and whitespace pass.

---
title: 'Finance: Release hardening cho promotion policy Pha 1b'
type: 'bugfix'
created: '2026-09-25'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: 'c20b4c4ebbd4243a7209c6e2b5047f4b81a4fa5e'
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/implementation-artifacts/spec-5-12-cau-hinh-uu-dai-theo-khoan-thu-va-gan-hoc-sinh.md'
  - '_bmad-output/implementation-artifacts/spec-5-13-preview-va-generate-uu-dai-authoritative.md'
  - '_bmad-output/implementation-artifacts/spec-5-14-recheck-issue-va-snapshot-uu-dai-bat-bien.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Review Pha 1b phát hiện test database drift và các lỗ hổng trong integrity/finality của promotion snapshot. InvoiceLine DRAFT thêm hoặc sửa thủ công cũng bỏ qua policy evaluator, tạo kết quả ưu đãi không nhất quán với quyền lợi Student theo Receivable.

**Approach:** Khôi phục test database từ migration chain hợp lệ, thêm migration forward-only bảo vệ graph và immutable issued application, đồng thời chạy evaluator cho mọi DRAFT line. Mở rộng snapshot và regression tests để các policy backdate trước Issue vẫn được recheck authoritative.

## Boundaries & Constraints

**Always:** Mọi InvoiceLine DRAFT, gồm generated và manual add/edit, được server evaluate theo billing month. Một Receivable chỉ áp dụng tối đa một PERCENTAGE policy: percentage có priority cao nhất, tie-break policy ID; FIXED_VND vẫn chạy trước percentage. Backdate policy/assignment được phép trước Issue với audit và Issue recheck. Issued application snapshot copy gross/discount/net cùng provenance và chỉ được tạo trong Issue transaction. School-scoped composite relations, advisory lock, VND BIGINT và idempotency/Operation giữ nguyên.

**Ask First:** Không có.

**Never:** Không sửa migration lịch sử, không cho browser gửi formula/money, không mở sang Receipt, settlement, carry, refund, coverage, attendance/service eligibility hay Parent/Teacher route.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Manual DRAFT line | Student có assignment/policy active cho Receivable | Add/edit server persist gross/discount/net/provenance; Issue recheck tương tự generated line | Fact đổi trước Issue trả `PROMOTION_REVIEW_REQUIRED`, không ghi partial |
| Percentage stacking | Nhiều percentage STACKABLE áp dụng cùng Receivable | Chỉ percentage priority cao nhất, policy-ID tie-break, được áp dụng sau fixed discounts | Không có percentage thứ hai trong application snapshot |
| Issued snapshot | Issue thành công | Mỗi application persist full money outcome và immutable graph-consistent provenance | Insert/update/delete sau Issue bị DB từ chối |
| Test database | `anhhoa_test` reset từ `.env.test` | All migration directories have `migration.sql`; deploy, seed, integration suite run | Không đụng development hoặc E2E database |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- add full monetary fields and composite relations for issued application and assignment/version/policy graph.
- `apps/api/prisma/migrations/20260925000000_promotion_policy_phase_1b/migration.sql` -- read-only historical evidence; new migration must repair graph integrity forward-only.
- `apps/api/prisma/migrations/20260925000002_invoice_promotion_application_snapshot/migration.sql` -- read-only historical evidence; existing trigger permits post-Issue inserts.
- `apps/api/src/modules/finance/finance.service.ts` -- `addInvoiceLine()`, `editInvoiceLine()`, `promotionFacts()`, `evaluatePromotionLine()`, `recheckPromotion()` and `createIssuedPromotionApplications()` own authoritative calculation and snapshots.
- `apps/api/src/integration/finance.integration.test.ts` -- existing multi-School PostgreSQL fixture and Finance lifecycle tests; extend for manual evaluation, graph/finality and Issue/revision races.
- `apps/api/src/modules/finance/finance.service.test.ts` -- fast evaluator order/cap checks.
- `apps/api/src/integration/finance-release-scope.integration.test.ts` -- retain Pha 1b forbidden-scope proof.
- `apps/web/src/finance/finance-workspace.tsx` -- promotion assignment current state and field error projection must be server-authoritative/accessibly rendered.
- `apps/web/src/finance/finance-workspace.test.tsx` -- verify promotion error scope and current-state rendering.
- `apps/api/scripts/test-integration.ts` -- migration deploy/seed/test workflow; test database must be reset externally only with `.env.test` target URL.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/api/prisma/schema.prisma` and a new forward-only migration -- add composite assignment-policy-version integrity, monetary application snapshot fields, and a controlled Issue-only application finality guard.
- [ ] `apps/api/src/modules/finance/finance.service.ts` -- evaluate manual DRAFT add/edit with the shared evaluator; choose at most one percentage after fixed reductions; recheck all evaluated DRAFT lines; persist full issued outcome.
- [ ] `apps/api/src/integration/finance.integration.test.ts` and `apps/api/src/modules/finance/finance.service.test.ts` -- prove manual evaluation, percentage selection, assignment end, normal/revision stale recheck, concurrent mutation serialization, database finality and graph integrity.
- [ ] `apps/web/src/finance/finance-workspace.tsx` and `.test.tsx` -- render server-projected current assignments and attach promotion form validation to its own accessible field-error scope.
- [ ] `apps/api/prisma/migrations/` -- remove only untracked empty migration residue that blocks clean reset; do not alter published migration files.

**Acceptance Criteria:**
- Given an eligible Student has a generated, added, or edited DRAFT line, when the line is saved or issued, then server-derived gross/discount/net and provenance use the same evaluator and stale facts atomically reject Issue.
- Given fixed and multiple percentage policies target one Receivable, when evaluation occurs, then fixed policies apply first and only the highest-priority percentage policy applies, using policy ID as deterministic tie-break.
- Given an application is issued, when a later direct write attempts mismatched policy/version provenance or any additional/update/delete application, then PostgreSQL rejects it; the stored application contains gross, discount and net copied at Issue.
- Given a clean `anhhoa_test` reset with `.env.test`, when migrations, seed and integration tests run, then promotion tables exist and the suite passes without using development or E2E database URLs.
- Given Finance views assignments or promotion validation fails, when browser clock differs or API returns field errors, then server-projected current state and promotion-specific accessible errors render without cross-School stale state.

## Design Notes

The Issue application table is a historical explanation, not a live relation. It retains immutable copied IDs and facts for provenance, while the database independently validates line ownership, ordering and finality. Policy/version relational integrity belongs to the live configuration graph and is enforced by a composite relation.

## Verification

**Commands:**
- `set -a && source .env.test && set +a && DATABASE_URL="$TARGET_INTEGRATION_DATABASE_URL" NODE_ENV=development PRISMA_SEED=true pnpm exec prisma migrate reset --force` from `apps/api` -- expected: fresh `anhhoa_test` reset and seeded migration chain.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL Finance and release-scope tests pass.
- `pnpm --filter @passionedu/api test` -- expected: Finance unit/controller tests pass.
- `pnpm --filter @passionedu/admin-web test` -- expected: promotion UI tests pass.
- `pnpm typecheck && pnpm test && git diff --check` -- expected: workspace checks pass.

---
title: 'Story 5.10: Generate Invoice DRAFT có dòng template'
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: 'e8e6d215424f1b921c91c369115313e0f5cbc56d'
baseline_commit: 'e8e6d215424f1b921c91c369115313e0f5cbc56d'
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Generate hiện đã tạo InvoiceLine từ template, nhưng `READY` chưa lưu một bằng chứng catalog template đã được xác nhận. Catalog thay đổi giữa READY và generate có thể làm generate dùng facts khác preview mà không báo stale.

**Approach:** Chốt fingerprint template/catalog authoritative khi chuyển `READY`, đối chiếu lại trong transaction generate trước khi tạo generation, và mở rộng PostgreSQL proof cho Invoice DRAFT populated, snapshot bất biến, retry và isolation per-Student.

## Boundaries & Constraints

**Always:** Finance command chỉ dành cho `FINANCE_MANAGE` trong School context server-authorize, dùng origin/CSRF, UUID idempotency, Operation, audit và transaction. Generate chỉ nhận run ID; server tự tính VND `BIGINT`, snapshot Receivable code/name/unit/default price/quantity/amount và tạo tối đa một Invoice gốc cho mỗi Student/run. Generated/late Student chỉ dùng immutable run template snapshot.

**Block If:** Mockup canonical hoặc contract Finance thay đổi yêu cầu preview/generate dùng pricing live sau `READY` thay vì từ chối stale.

**Never:** Không nhận line, price, amount, total, Student/Class scope hay discount từ browser; không thêm PromotionPolicy, Receipt, settlement, service/attendance pricing, Parent/Teacher route hoặc sửa migration lịch sử.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Generate template hợp lệ | Run `READY`, template active 35.000 x 22, Student eligible | Mỗi Invoice DRAFT có populated InvoiceLine snapshot amount 770.000 và total server-derived | Retry cùng key replay Operation, không duplicate |
| Catalog thay đổi sau READY | Giá/tên/unit hoặc lifecycle template đổi trước generate | Transaction không tạo generation/Invoice/line từ facts khác preview đã xác nhận | `PREVIEW_STALE` hoặc validation conflict trước write |
| Thêm Student sau GENERATED | Catalog live inactive/đổi giá, run có templateSnapshot | Tạo đúng một populated DRAFT từ snapshot immutable | Existing Invoice replay thành `INVOICE_EXISTS` |
| Ngoại lệ DRAFT một Student | Sửa line Invoice A | Chỉ Invoice A/total/audit thay đổi; template snapshot và Invoice B giữ nguyên | Issued/cross-School bị từ chối |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `CollectionRun` chứa template snapshot; thêm field fingerprint đã xác nhận ở READY nếu cần giữ proof qua transaction generate.
- `apps/api/prisma/migrations/20260924000000_collection_run_template_snapshot/migration.sql` -- migration lịch sử có guard snapshot; không sửa.
- `apps/api/prisma/migrations/20260925000000_collection_run_ready_template_fingerprint/migration.sql` -- migration mới cho field preview fingerprint READY.
- `apps/api/src/modules/finance/finance.service.ts` -- `templateSnapshot()`, `readyRun()`, `generateRun()`, `invoiceData()` và `insertInvoices()` là boundary cho stale check, populated snapshot, tenant locking và atomic generation.
- `apps/api/src/integration/finance.integration.test.ts` -- PostgreSQL proof catalog stale sau READY, populated InvoiceLine/total, immutable late Student snapshot và per-Invoice adjustment isolation.
- `apps/api/src/modules/finance/finance.controller.test.ts` -- generate surface không nhận body pricing và vẫn yêu cầu browser mutation proof.
- `apps/web/src/finance/finance-workspace.tsx` -- UI hiện có chỉ render API template/generate outcome; không mở rộng client authority.
- `apps/web/e2e/finance-release-gate.spec.ts` -- approved flow template -> preview -> READY -> populated DRAFT.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chuyển Story 5.10 sang `done` sau verification/review.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma` và migration mới -- persist nullable READY template fingerprint, không thay đổi historical migration/immutable generated snapshot guard.
- `apps/api/src/modules/finance/finance.service.ts` -- lưu preview fingerprint khi READY và revalidate template/catalog/roster trong generate transaction trước generation/Invoice writes; giữ late Student snapshot path.
- `apps/api/src/integration/finance.integration.test.ts` -- thêm regression proof populated DRAFT snapshots, stale READY catalog, idempotent/no-partial generation và adjustment isolation.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- đánh dấu done chỉ sau toàn bộ checks và review pass.

**Acceptance Criteria:**
- Given run `READY`, preview đã xác nhận và template active không rỗng, when Finance generate, then mỗi Student eligible có tối đa một Invoice DRAFT với đầy đủ InvoiceLine snapshot template và VND total do server derive.
- Given catalog/template fact đã xác nhận ở READY đổi trước generate, when command chạy, then transaction từ chối trước generation/invoice/line write và không dùng live fact lệch preview.
- Given run `GENERATED` và Student eligible chưa có Invoice, when catalog live đổi hoặc inactive, then add Student dùng độc quyền `templateSnapshot` và không rewrite Invoice/template đã tồn tại.
- Given Finance điều chỉnh DRAFT của một Student, when server persist line change, then Invoice Student khác và run template snapshot không thay đổi; issued/cross-School write bị từ chối.

## Design Notes

Fingerprint READY là proof transient của live template/catalog, khác `templateSnapshot`: fingerprint chỉ dùng để reject generate lệch preview; snapshot chứa đúng facts historical cần materialize Invoice và không chứa lifecycle internals.

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3 (medium 3)
- defer: 0
- reject: 25
- addressed_findings:
  - `[medium] [patch]` Thêm PostgreSQL proof READY fingerprint được persist và DB trigger từ chối thay đổi proof sau xác nhận.
  - `[medium] [patch]` Thêm regression Receivable template inactive sau READY trả `PREVIEW_STALE` trước generation/Invoice write.
  - `[medium] [patch]` Sửa E2E fixture cleanup để xóa template line qua guard cleanup trước khi xóa CollectionRun.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test` -- expected: Finance unit/controller contracts pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL populated snapshot, stale and tenant/idempotency proofs pass on test DB.
- `pnpm --filter @passionedu/admin-web test` -- expected: Admin server-rendered finance tests pass.
- `pnpm --filter @passionedu/admin-web exec playwright test e2e/finance-release-gate.spec.ts` -- expected: approved populated-DRAFT workflow passes.
- `pnpm typecheck && pnpm test && git diff --check` -- expected: workspace checks and whitespace pass.

## Auto Run Result

Status: done

Summary: Story 5.10 chốt preview fingerprint server-authoritative khi CollectionRun chuyển READY. Generate khóa và tính lại template/catalog/roster facts trước mọi write, từ chối `PREVIEW_STALE` nếu facts đã đổi, và chỉ sau đó snapshot InvoiceLine populated. Generated late Student vẫn dùng immutable `templateSnapshot`.

Files changed:
- `apps/api/prisma/schema.prisma` -- thêm READY preview fingerprint trên CollectionRun.
- `apps/api/prisma/migrations/20260925000000_collection_run_ready_template_fingerprint/migration.sql` -- persist fingerprint và mở rộng trigger immutable.
- `apps/api/src/modules/finance/finance.service.ts` -- persist/revalidate READY proof trước generation; loại lifecycle version nội bộ khỏi preview facts.
- `apps/api/src/integration/finance.integration.test.ts` -- proof populated VND snapshot, catalog/roster/lifecycle stale và immutable fingerprint.
- `apps/api/scripts/seed-e2e-release-gate.ts` -- cleanup CollectionRun template lines theo DB guard.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- đánh dấu Story 5.10 done.

Review findings: 3 patches medium đã áp dụng; 0 deferred; 25 rejected là non-actionable, pre-existing hoặc đã được proof hiện hữu bao phủ. Follow-up review recommendation: true; patched score là 9 (`3 * 3`).

Verification performed:
- `pnpm --filter @passionedu/api test` -- pass, 17 files / 121 tests.
- `set -a && source ../../.env.test && set +a && pnpm --filter @passionedu/api test:integration` từ `apps/api` -- pass, 8 files / 120 tests trên `anhhoa_test`.
- `pnpm --filter @passionedu/admin-web test` -- pass, 9 files / 99 tests.
- `pnpm typecheck && pnpm test && git diff --check` -- pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/admin-web exec playwright test e2e/finance-release-gate.spec.ts` -- pass trong full E2E run.

Residual risks: Full `pnpm test:e2e` chạy 9 tests có 1 failure pre-existing ngoài Story 5.10 tại `apps/web/e2e/release-gate.spec.ts:223`, không tìm thấy `Đã trả trẻ lúc` sau Teacher handover reconciliation; Finance E2E của story pass. Runtime warning `pg` concurrent `client.query()` và Vite bundle-size warning vẫn không blocking.

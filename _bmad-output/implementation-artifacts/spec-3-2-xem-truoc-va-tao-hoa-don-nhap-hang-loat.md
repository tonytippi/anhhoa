---
title: 'Story 3.2: Xem trước và tạo Hóa đơn nháp hàng loạt'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'fd3caf889c34da9cb2bda3477dafa7d4792d93b3'
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: []
deferred:
  - summary: >-
      Batch timeout reconciliation has no bounded recovery state when an operation remains PENDING indefinitely.
    evidence: |-
      The modal polls GET /operations/:operationId while the operation remains PENDING, which can keep it locked if the server never reaches a terminal state.
    location: >-
      apps/web/src/features/invoices/page.tsx:34
    severity: medium
  - summary: >-
      Batch integration coverage verifies overlap sequentially rather than forcing simultaneous transactions.
    evidence: |-
      The test confirms the final duplicate-prevention result but does not deterministically exercise a PostgreSQL serialization retry path.
    location: >-
      apps/api/src/modules/invoices/invoices.integration.test.ts
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Admin mới chỉ xem được danh sách Hóa đơn; chưa thể biết phạm vi nào đủ điều kiện hoặc tạo các bản nháp tháng một cách nguyên tử, chống trùng. Điều này chặn quy trình thu phí tháng.

**Approach:** Bổ sung API preview/create batch dựa trên Học sinh, Lớp và Mẫu hóa đơn hiện hành, lưu snapshot DRAFT và idempotency trong một transaction; thay CTA placeholder bằng modal chọn tháng/phạm vi, preview và kết quả tạo.

## Boundaries & Constraints

**Always:** API là nguồn eligibility, tổng và snapshot; `billingMonth` là `YYYY-MM`/ngày đầu tháng UTC; chỉ Học sinh ACTIVE thuộc Lớp ACTIVE trong phạm vi mới eligible. Preview và create phải từ chối template không có dòng bằng `INVOICE_TEMPLATE_EMPTY`. Create dùng `Idempotency-Key` UUID, transaction serializable/retry, PostgreSQL unique `(studentId,billingMonth)`, trả created/skipped chính xác và replay cùng Admin/route/key/fingerprint. DRAFT chỉ snapshot Học sinh, Lớp, từng dòng template theo position và giá trị học phí hiện tại; không đặt payment/bank account. Web chỉ invalidates query sau kết quả xác nhận, và timeout phải đối soát operation trước retry.

**Block If:** Cần đổi REST contract của Story 3.1, sửa migration đã commit, hoặc phát hiện schema không thể thêm snapshot dòng invoice bằng migration forward-only.

**Never:** Không triển khai editor DRAFT, payment, transition, QR hay completion. Không tạo Hóa đơn rỗng, không tin tổng client, không dùng float, không lấy snapshot từ nguồn sau thời điểm create, không cho chọn Lớp archived.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Preview | Tháng hợp lệ, toàn trường hoặc danh sách Lớp ACTIVE | Trả eligible và skip theo `inactiveStudent`, `missingClass`, `archivedClass`, `existingInvoice` | Scope UUID/giá trị tháng không hợp lệ theo error shape chuẩn |
| Template trống | Preview hoặc create, singleton không có items | Không tạo record nào | `INVOICE_TEMPLATE_EMPTY` |
| Create | Eligible students và UUID key mới | Transaction tạo một DRAFT mỗi `(student, month)`, snapshot dòng ordered, result created/skipped + operationId | Retry serializable/unique conflict; không có eligible không gửi create từ UI và API từ chối an toàn |
| Concurrent/replay | Scope chồng lấp hoặc cùng key | Không trùng invoice; response cuối phản ánh created/skipped; cùng fingerprint replay | Khác route/Admin/fingerprint với key trả `IDEMPOTENCY_CONFLICT` |
| Kết quả không chắc chắn | Timeout sau create | UI khóa modal, gọi `GET /operations/:operationId`, rồi hiển thị kết quả hoặc chỉ cho retry khi chưa áp dụng | Giữ lỗi gần action, không phát lại mù quáng |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `Invoice` hiện chỉ có snapshot header/total; thêm `InvoiceItem` snapshot và relation, giữ unique/index của Story 3.1.
- `apps/api/prisma/migrations/20260819110000_add_invoice_monthly_order_index/migration.sql` -- migration đã commit, chỉ thêm migration forward-only mới.
- `apps/api/src/modules/invoices/invoices.dto.ts` -- đang validate list/id; thêm DTO preview/create với month và toàn trường hoặc danh sách class UUID không rỗng.
- `apps/api/src/modules/invoices/invoices.controller.ts` -- thêm action endpoints trước `:id`, kiểm tra header UUID và lấy `CurrentAdmin`.
- `apps/api/src/modules/invoices/invoices.service.ts` -- reuse serialize/month helpers; thêm eligibility phân loại, snapshot line amounts, transaction/idempotency và retry P2034/P2002.
- `apps/api/src/modules/invoices/invoices.module.ts` -- import `OperationsModule` để inject service thay vì controller/domain khác.
- `apps/api/src/modules/operations/operations.service.ts` -- reuse fingerprint, acquire/replay, complete và `/operations/:id`; không thay đổi protocol.
- `apps/api/src/modules/classes/classes.service.ts` -- mẫu serializable idempotent transaction/retry và route-bound fingerprint.
- `apps/api/src/modules/invoices/invoices.service.test.ts`, `invoices.integration.test.ts` -- mở rộng unit/integration test cho eligibility, empty template, snapshots, uniqueness và replay.
- `apps/web/src/features/invoices/api.ts` -- mở rộng parser/hook cho preview/create/operation và kết quả batch, theo defensive response parsing hiện có.
- `apps/web/src/features/invoices/page.tsx` -- CTA disabled placeholder ở empty state trở thành trigger modal; giữ list URL behavior của Story 3.1.
- `apps/web/src/features/classes/api.ts` -- `useActiveClassesForPicker` đã phân trang chỉ Lớp ACTIVE, tái dùng trong modal scope picker.
- `apps/web/src/features/classes/page.tsx` -- mẫu Base UI dialog, pending lock, focus return và error state.
- `apps/web/src/features/invoices/{api.test.ts,page.test.tsx}` và `apps/web/e2e/invoices.spec.ts` -- mở rộng contract/UI/browser coverage cho modal batch.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*_add_invoice_items/migration.sql` -- thêm persistence dòng snapshot ordered có description, fee group, amount BIGINT và position -- bảo toàn dữ liệu DRAFT được tạo.
- `apps/api/src/modules/invoices/{invoices.dto.ts,invoices.controller.ts,invoices.service.ts,invoices.module.ts}` -- implement preview/create resources, classification, template validation, immutable snapshots và idempotent serializable create -- cung cấp batch API authoritative.
- `apps/api/src/modules/invoices/{invoices.dto.test.ts,invoices.service.test.ts,invoices.integration.test.ts}` -- test validation, no-empty-template, eligible/skips, class tuition snapshot, concurrent uniqueness và idempotent replay -- khóa matrix và persistence invariants.
- `apps/web/src/features/invoices/{api.ts,api.test.ts,page.tsx,page.test.tsx}` -- parse batch contracts, build accessible modal choose scope/month, preview then create with UUID/reconciliation/result link -- cung cấp luồng Admin không gửi khi zero eligible.
- `apps/web/e2e/invoices.spec.ts` -- cover trigger, preflight/result navigation and disabled no-eligible state -- xác minh bề mặt browser chính.

**Acceptance Criteria:**
- Given Admin mở modal, when chọn tháng và toàn trường hoặc Lớp active, then UI hiển thị eligible/skips từ `POST /invoices/batch-preview` và không tạo khi eligible là zero.
- Given template có dòng và scope hợp lệ, when Admin tạo bằng UUID idempotency, then API atomically tạo DRAFT snapshot độc nhất, trả created/skipped và UI link về danh sách tháng lọc `DRAFT`.
- Given request timeout, when kết quả chưa biết, then modal không thể đóng/gửi lại, đối soát operation và chỉ mở retry sau khi server xác nhận chưa áp dụng.

## Design Notes

`batch-preview` và batch create cùng dùng eligibility nhưng create phải tính lại trong transaction; preview là hướng dẫn UI, không phải quyền tạo. Result giữ danh sách/tổng created và skip theo reason để concurrent create vẫn trả trung thực.

## Verification

**Commands:**
- `pnpm --filter api test` -- expected: invoice DTO/service tests pass.
- `pnpm --filter api test:integration` -- expected: PostgreSQL batch, snapshot, uniqueness and replay tests pass.
- `pnpm --filter web test` -- expected: invoice modal/API tests pass.
- `pnpm --filter web test:e2e` -- expected: invoice batch browser flow passes.
- `pnpm lint && pnpm typecheck && pnpm build` -- expected: workspace has no lint, TypeScript, or build failure.

## Spec Change Log

### 2026-08-19 -- Review repair

- Finding: batch UI could create a changed, un-previewed scope, and could be dismissed or submitted repeatedly while create was pending.
- Amendment: preserve the existing contract and make preview state input-bound; lock the dialog through create and reconciliation.
- Avoids: creating an unexpected batch or losing an uncertain operation result.
- KEEP: retain the compact existing operation/idempotency protocol and Base UI modal pattern.

## Review Triage Log

### 2026-08-19 -- Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 4 (high 0, medium 4, low 0)
- defer: 2 (high 0, medium 2, low 0)
- reject: 8
- addressed_findings:
  - `[medium]` `[patch]` Reset preview when batch input changes, so create cannot submit an un-previewed month or scope.
  - `[medium]` `[patch]` Lock the modal while batch create is in flight and prevent repeat submission.
  - `[medium]` `[patch]` Offer one creation CTA for non-empty invoice lists as well as the empty state.
  - `[medium]` `[patch]` Reject any zero-eligible batch on the API and add component/integration coverage for preview, create, result, and zero eligibility.

## Auto Run Result

Status: done

Summary: Added authoritative batch invoice preview/create, persisted ordered DRAFT line snapshots, idempotency-backed serializable creation, and the invoice creation modal with reconciliation.

Files changed:

- `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/20260819120000_add_invoice_items/migration.sql` -- persist immutable invoice line snapshots.
- `apps/api/src/modules/invoices/*` -- batch API validation, eligibility, snapshots, operation replay, tests, and module wiring.
- `apps/api/src/common/errors/domain.exception.ts` -- batch/template domain error codes.
- `apps/api/src/modules/{classes,students}/*.integration.test.ts` -- remove dependent invoices before source records in integration cleanup.
- `apps/web/src/features/invoices/*` and `apps/web/e2e/invoices.spec.ts` -- batch modal, defensive parsing, focused workflow tests, and enabled CTA expectation.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- mark Story 3.2 done.

Review findings: 4 medium patches applied; 2 medium items deferred; 8 findings rejected as non-blocking or outside the current compact story implementation. Follow-up review recommendation: true (patched score 12 = 3 x 4 medium).

Verification performed:

- `pnpm --filter api test` -- pass, 81 tests.
- `pnpm --filter api test:integration` -- pass, 29 tests; migration applied from a clean PostgreSQL integration database.
- `pnpm --filter web test` -- pass, 71 tests.
- `pnpm --filter web test:e2e` -- pass, 22 tests.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` -- all pass.

Residual risks: timeout reconciliation polls a pending operation until it resolves, and batch integration coverage verifies serialized overlap/replay rather than forcing two truly simultaneous database transactions.

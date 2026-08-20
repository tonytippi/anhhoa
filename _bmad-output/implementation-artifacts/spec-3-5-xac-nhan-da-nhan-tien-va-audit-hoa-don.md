---
title: 'Story 3.5: Xác nhận đã nhận tiền và audit Hóa đơn'
type: 'feature'
created: '2026-08-20'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'b1fc616b47121cbbc1b7e97642228ba9458fa4e8'
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Hóa đơn `PENDING` chưa thể được xác nhận đã thu tiền, nên hệ thống chưa có trạng thái cuối cùng hay dấu vết Admin/thời điểm xác nhận để đối soát.

**Approach:** Bổ sung completion idempotent và audit bất biến ở API, rồi cung cấp modal xác nhận có reconciliation khi kết quả request không chắc chắn trên trang chi tiết.

## Boundaries & Constraints

**Always:** Chỉ Admin xác thực hoàn tất `PENDING` có total dương. Transaction serializable phải lưu `COMPLETED`, Admin xác nhận, timestamp và operation response nguyên tử; cùng Admin/route/key/fingerprint replay response, fingerprint khác conflict. `COMPLETED` không thể sửa, trả nháp hay hoàn tất lại. Web sinh UUID, chỉ invalidate sau kết quả đã xác nhận hoặc reconciliation, và modal bị khóa khi gửi/đối soát.

**Block If:** Migration forward-only không thể thêm audit completion hoặc contract `GET /operations/:operationId` hiện có không thể replay completion response.

**Never:** Không thêm thu thiếu/thừa, trả góp, hoàn tiền, hủy, mở lại, automated bank reconciliation, hay đọc payment audit từ dữ liệu nguồn thay vì snapshot hóa đơn.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Hoàn tất lần đầu | `PENDING`, total dương, UUID mới | `COMPLETED`, audit Admin/timestamp và response operation được lưu cùng transaction | Không có lỗi |
| Retry cùng request | Cùng Admin, route, UUID, fingerprint | Replay đúng detail đã hoàn tất, không ghi audit lần hai | Không có mutation mới |
| Key hoặc trạng thái sai | UUID dùng với fingerprint khác; `DRAFT`/`COMPLETED`; total không dương | Không đổi Hóa đơn | Conflict/domain error chuẩn |
| Timeout client | Request completion không có response | Modal khóa, đối soát operation ID; cập nhật nếu completed, chỉ retry nếu 404 | Hiển thị `Đang kiểm tra kết quả` hoặc lỗi phù hợp |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `Admin` hiện chỉ relation creator; `Invoice` có status/payment snapshot nhưng thiếu confirmer/timestamp. Thêm relation audit và cột completion forward-only.
- `apps/api/prisma/migrations/*/migration.sql` -- migrations invoice đã commit; tạo migration mới, không sửa migration cũ.
- `apps/api/src/modules/invoices/invoices.controller.ts` -- batch là mẫu bắt buộc/validate `Idempotency-Key`; thêm completion action trước resource detail.
- `apps/api/src/modules/invoices/invoices.service.ts` -- tái dùng serializable retry, `serializeDetail`, `OperationsService` pattern từ `createBatch`; completion phải trả InvoiceDetail đã có audit.
- `apps/api/src/modules/operations/operations.service.ts` -- `acquireOrReplay`/`complete` giữ owner-route-fingerprint replay contract; không thay đổi ownership semantics.
- `apps/api/src/modules/invoices/{invoices.service.test.ts,invoices.integration.test.ts}` -- mở rộng lifecycle/audit/idempotency PostgreSQL coverage theo fixtures hiện có.
- `apps/web/src/features/invoices/api.ts` -- parser `InvoiceDetail`, lifecycle hook và batch operation parser là REST/cache pattern; thêm completion request/header và operation result parser.
- `apps/web/src/features/invoices/detail-page.tsx` -- PENDING action/revert, readonly completed layout là điểm gắn dialog, audit và timeout reconciliation.
- `apps/web/src/features/invoices/{api.test.ts,detail-page.test.tsx}` -- cover contract parser, dialog copy/lock/retry/completed audit.
- `apps/web/e2e/invoices.spec.ts` -- thêm browser-observable completion modal/detail audit flow với route mocks.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*_add_invoice_completion_audit/migration.sql` -- persist confirmer Admin relation và completion timestamp bằng migration forward-only -- giữ audit lịch sử bất biến.
- [x] `apps/api/src/modules/invoices/{invoices.controller.ts,invoices.service.ts}` -- expose `POST /invoices/:id/complete`, validate UUID header, run idempotent serializable `PENDING -> COMPLETED`, and serialize audit -- làm API là nguồn lifecycle chính thức.
- [x] `apps/api/src/modules/invoices/{invoices.service.test.ts,invoices.integration.test.ts}` -- verify state/positive-total guards, one-time audit, replay and fingerprint conflict -- khóa edge cases tài chính.
- [x] `apps/web/src/features/invoices/{api.ts,detail-page.tsx}` -- parse completion audit, send UUID completion, reconcile operation uncertainty, render focused confirmation dialog and immutable audit -- hoàn thiện bề mặt Admin.
- [x] `apps/web/src/features/invoices/{api.test.ts,detail-page.test.tsx}` and `apps/web/e2e/invoices.spec.ts` -- verify parser, idempotency request, modal accessibility/lock/reconciliation, and visible completed state -- bảo vệ REST/UI behavior.

**Acceptance Criteria:**
- Given Admin mở Hóa đơn `PENDING`, when chọn xác nhận, then modal nêu Học sinh, tháng, payment snapshot, total; Hủy không đổi hóa đơn, dialog trap/return focus và không auto-focus confirm.
- Given Admin xác nhận với UUID, when API xử lý, then chỉ `PENDING` total dương trở thành `COMPLETED`, ghi confirmer/timestamp đúng một lần và replay cùng request không đổi audit.
- Given completion đã được xác nhận, when xem chi tiết, then badge `Đã hoàn tất`, creator/confirmer/timestamps, total và payment snapshot hiển thị read-only, không có action lifecycle.

## Design Notes

Completion endpoint dùng operation route cố định riêng với fingerprint body rỗng. Reconciliation tái sử dụng `GET /operations/:operationId`: response completed được parse cùng Invoice detail, còn operation `PENDING` giữ dialog khóa; chỉ HTTP 404 mới chứng minh có thể tạo UUID mới và gửi lại.

## Review Triage Log

### 2026-08-20 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 7 (high 0, medium 5, low 2)
- defer: 0
- reject: 8
- addressed_findings:
  - `[medium]` `[patch]` Poll lại operation completion khi trạng thái còn `PENDING` hoặc lỗi đối soát tạm thời để dialog không bị khóa vĩnh viễn.
  - `[medium]` `[patch]` Retry serializable completion khi race tạo operation trả Prisma `P2002`, kèm integration test hai request cùng key.
  - `[medium]` `[patch]` Đặt focus vào dialog, hỗ trợ Escape/backdrop lúc idle và giữ focus trap/return focus khi khóa hoặc đóng.
  - `[medium]` `[patch]` Assert browser request dùng đúng endpoint completion, `POST` và `Idempotency-Key` UUID; thêm test hủy không mutation.
  - `[medium]` `[patch]` Thêm test parser completion audit và request client completion.
  - `[low]` `[patch]` Cập nhật coverage concurrent replay để chứng minh audit chỉ được ghi một lần.
  - `[low]` `[patch]` Cập nhật coverage dialog cancel/focus bằng E2E theo bề mặt người dùng.

## Auto Run Result

Status: done

Summary: Hoàn tất lifecycle `PENDING -> COMPLETED` idempotent với audit bất biến và modal xác nhận/reconciliation cho hóa đơn.

Files changed:

- `apps/api/prisma/schema.prisma` và `apps/api/prisma/migrations/20260820000000_add_invoice_completion_audit/migration.sql` -- lưu Admin và timestamp xác nhận bằng migration forward-only.
- `apps/api/src/modules/invoices/{invoices.controller.ts,invoices.service.ts}` -- thêm endpoint completion, transaction serializable, replay operation và serialize audit.
- `apps/api/src/modules/invoices/{invoices.service.test.ts,invoices.integration.test.ts}` -- cover lifecycle, total dương, replay và race completion cùng key.
- `apps/web/src/features/invoices/{api.ts,detail-page.tsx}` -- parse audit, gửi completion UUID và render modal có focus/reconciliation.
- `apps/web/src/features/invoices/{api.test.ts,detail-page.test.tsx}` và `apps/web/e2e/invoices.spec.ts` -- verify REST contract, parser audit, modal cancel và browser completion flow.
- `apps/web/src/app/api/client.ts` -- tạo UUID v4 qua Web Crypto fallback khi `randomUUID` không có.

Review findings: 7 patches applied (high 0, medium 5, low 2); 0 deferred; 8 rejected. Follow-up review recommendation: true (score 17).

Verification performed:

- `pnpm --filter api test` -- pass, 86 tests.
- `pnpm --filter api test:integration` -- pass, 33 PostgreSQL-backed tests with fresh migrations.
- `pnpm --filter web test` -- pass, 80 tests.
- `pnpm --filter web test:e2e` -- pass, 24 Playwright tests.
- `pnpm lint && pnpm typecheck && pnpm build` -- all pass.
- `git diff --check` -- pass.

Residual risks: Đối soát sẽ tiếp tục poll mỗi giây khi operation còn `PENDING` hoặc endpoint đối soát gặp lỗi tạm thời; đây là hành vi an toàn nhưng có thể giữ dialog khóa nếu server/operation không hồi phục. Audit được bất biến qua service lifecycle và completion state guard; migration không thêm database trigger để chặn direct SQL cập nhật audit.

## Verification

**Commands:**
- `pnpm --filter api test` -- expected: invoice lifecycle unit tests pass.
- `pnpm --filter api test:integration` -- expected: fresh migrations plus completion/audit/idempotency PostgreSQL tests pass.
- `pnpm --filter web test` -- expected: invoice API and detail component tests pass.
- `pnpm --filter web test:e2e` -- expected: mocked browser completion flow passes.
- `pnpm lint && pnpm typecheck && pnpm build` -- expected: workspace checks pass.

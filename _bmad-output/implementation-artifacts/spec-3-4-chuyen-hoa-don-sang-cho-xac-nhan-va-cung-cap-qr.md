---
title: 'Story 3.4: Chuyển Hóa đơn sang chờ xác nhận và cung cấp QR'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'e08dafd5d72a20c83d7dabb3024781dc6fa2b3d2'
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Hóa đơn `DRAFT` đã có editor nhưng chưa thể khóa thông tin nhận tiền trước khi đối chiếu, và thông tin tài khoản hiện đọc từ dữ liệu nguồn nên không thể là lịch sử bất biến.

**Approach:** Thêm lifecycle `DRAFT -> PENDING` và `PENDING -> DRAFT` tại API cùng snapshot payment độc lập; trang chi tiết dùng resource snapshot để hiển thị trạng thái khóa và QR chuyển khoản ổn định.

## Boundaries & Constraints

**Always:** Chỉ Admin xác thực gọi API. Transition chỉ chạy trong transaction serializable có retry; `DRAFT -> PENDING` cần tổng `> 0` và `<= 100_000_000`, cash không có tài khoản, transfer dùng tài khoản `ACTIVE`. Khi thành công, snapshot phương thức và bank code/số tài khoản/tên chủ tài khoản vào Hóa đơn; QR và nội dung `Họ tên [biệt danh] Lớp chuyển tiền` chỉ dùng total cùng snapshot Hóa đơn. `PENDING -> DRAFT` là reversal duy nhất của story, editor mở lại và lần pending sau chụp snapshot mới. Tiền là `BIGINT`/JSON integer an toàn; web chỉ invalidate sau response thành công.

**Block If:** Cần thay migration đã commit, thay list contract Story 3.1, hoặc lựa chọn payment DRAFT của Story 3.3 không thể được snapshot bằng migration forward-only.

**Never:** Không triển khai `PENDING -> COMPLETED`, idempotency/audit completion, modal xác nhận nhận tiền, automated reconciliation, thay line/total khi PENDING, hoặc lấy QR/payment PENDING từ BankAccount, Student, Class hiện hành.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Khóa tiền mặt | `DRAFT`, total dương trong giới hạn, `CASH`, không account | Chuyển `PENDING`, snapshot method cash, line/total/payment read-only | Không có lỗi |
| Khóa chuyển khoản | `DRAFT`, total hợp lệ, `TRANSFER`, account ACTIVE | Chuyển `PENDING`, snapshot account và trả QR/content từ snapshot | Không có lỗi |
| Payment/tổng không hợp lệ | Total `<= 0` hoặc `> 100_000_000`; cash có account; transfer thiếu/inactive account | Không đổi trạng thái hay snapshot | API conflict/domain error; UI giữ dữ liệu và nêu đúng section cần sửa |
| Dữ liệu nguồn đổi | `PENDING` transfer, BankAccount/Student/Class bị sửa hoặc account ngừng dùng | Detail, QR và content giữ snapshot khi đã khóa | Không truy vấn dữ liệu nguồn để dựng payment/QR |
| Trả về nháp | `PENDING` chưa completed | Chuyển `DRAFT`, editor và selection draft mở lại | Transition từ trạng thái khác bị từ chối |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `Invoice` dòng 97-121 hiện chỉ có draft `paymentMethod`/`bankAccountId`; thêm các cột snapshot payment forward-only, giữ relation để editor DRAFT chọn account.
- `apps/api/prisma/migrations/20260819130000_add_invoice_draft_payment/migration.sql` -- bằng chứng migration draft selection đã commit, chỉ tạo migration mới cho snapshot.
- `apps/api/src/modules/invoices/invoices.dto.ts` -- `InvoiceIdDto` dùng cho action params; thêm DTO action tối thiểu nếu cần, không nhận total/payment từ client khi transition.
- `apps/api/src/modules/invoices/invoices.controller.ts` -- `InvoicesController` có PATCH và GET detail; thêm static/action routes lifecycle trước `:id` phù hợp REST hiện có.
- `apps/api/src/modules/invoices/invoices.service.ts` -- `serializeDetail`, `get`, `update` và retry transaction là điểm tái dùng cho snapshot response, lifecycle guard, total/payment validation và QR content.
- `apps/api/src/modules/invoices/{invoices.dto.test.ts,invoices.service.test.ts,invoices.integration.test.ts}` -- mở rộng test action, snapshot persistence và source-change stability; integration hiện chưa có fixture BankAccount.
- `apps/web/src/features/invoices/api.ts` -- `InvoiceDetail`/`parseInvoiceDetail` và `useUpdateInvoice` là REST contract và cache pattern; thêm parser snapshot/QR cùng lifecycle mutations.
- `apps/web/src/features/invoices/detail-page.tsx` -- editor DRAFT/read-only PENDING hiện có; thay summary live-account bằng payment resource, thêm CTA pending/revert, error section và QR/copy card.
- `apps/web/src/index.css` -- tái dùng layout `.invoice-detail-grid`/`.invoice-summary`; thêm QR card nhỏ, accessible copy feedback và responsive spacing.
- `apps/web/src/features/invoices/{api.test.ts,detail-page.test.tsx}` và `apps/web/e2e/invoices.spec.ts` -- cover API parser/action, pending/revert/QR UI và browser lifecycle chính.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*_add_invoice_payment_snapshots/migration.sql` -- thêm cột snapshot phương thức/tài khoản payment theo migration forward-only -- giữ dữ liệu PENDING độc lập nguồn.
- [x] `apps/api/src/modules/invoices/{invoices.dto.ts,invoices.controller.ts,invoices.service.ts}` -- thêm action `DRAFT -> PENDING`/`PENDING -> DRAFT`, transaction retry, validate total/payment, serialize snapshot và dựng QR/content chỉ từ invoice -- sở hữu lifecycle ở API.
- [x] `apps/api/src/modules/invoices/{invoices.dto.test.ts,invoices.service.test.ts,invoices.integration.test.ts}` -- test state guards, total/payment boundary, snapshot bank/source mutation và QR stability -- khóa invariant tài chính/lịch sử.
- [x] `apps/web/src/features/invoices/{api.ts,detail-page.tsx,api.test.ts,detail-page.test.tsx}` -- parse payment snapshot/QR, gọi lifecycle API và hiển thị controls theo state với copy action được gắn nhãn -- cung cấp bề mặt vận hành.
- [x] `apps/web/src/index.css`, `apps/web/e2e/invoices.spec.ts` -- style QR card responsive và test luồng chuyển pending/revert chính -- xác minh presentation/browser flow.

**Acceptance Criteria:**
- Given DRAFT có tổng/payment hợp lệ, when Admin chuyển sang chờ xác nhận, then API atomically chuyển thành `PENDING`, snapshot payment và UI khóa line/total/payment.
- Given PENDING transfer, when detail render, then QR card nêu total, tài khoản và copyable transfer content từ snapshot, không đổi sau source changes.
- Given transition bị từ chối hoặc PENDING được trả nháp, when Admin tiếp tục thao tác, then UI giữ dữ liệu/lỗi ở section đúng và editor chỉ mở lại sau `PENDING -> DRAFT` thành công.

## Design Notes

Giữ selection DRAFT (`paymentMethod`, `bankAccountId`) tách với snapshot PENDING. Reversal không cần sửa source selection: nó chỉ mở lại selection hiện có; transition pending tiếp theo ghi đè snapshot bằng giá trị hợp lệ tại thời điểm khóa. Điều này vừa giữ editor Story 3.3 nhỏ, vừa bảo đảm QR không có dependency live data.

## Review Triage Log

### 2026-08-19 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 7 (high 0, medium 5, low 2)
- defer: 0
- reject: 10
- addressed_findings:
  - `[medium]` `[patch]` Chỉ dựng QR cho payment transfer đã khóa và làm parser từ chối QR/payment không hợp lệ theo trạng thái.
  - `[medium]` `[patch]` Chặn transition khi draft có thay đổi chưa lưu, đồng thời khóa action khi picker tài khoản chưa sẵn sàng.
  - `[medium]` `[patch]` Hiển thị lỗi lifecycle và feedback sao chép cho cả pending; feedback thành công dùng live region không phải alert lỗi.
  - `[medium]` `[patch]` Hiển thị đầy đủ bank code, số tài khoản và tên chủ tài khoản trong QR card.
  - `[medium]` `[patch]` Backfill snapshot cho hóa đơn PENDING legacy từ payment selection và BankAccount trong migration forward-only.
  - `[low]` `[patch]` Bổ sung test cash lifecycle và state parser/UI cho QR.
  - `[low]` `[patch]` Giữ QR `null` sau khi trả về DRAFT để detail không trình bày payment instruction chưa khóa.

## Auto Run Result

Status: done

Summary: Added the draft-to-pending lifecycle with immutable payment snapshots, snapshot-backed VietQR instructions, and a pending-to-draft reversal without extending into payment completion.

Files changed:

- `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/20260819140000_add_invoice_payment_snapshots/migration.sql` -- persist and backfill payment snapshots for pending invoices.
- `apps/api/src/modules/invoices/invoices.{controller,service}.ts` -- expose lifecycle actions, enforce transaction-safe state/payment rules, and serialize snapshot QR details.
- `apps/api/src/modules/invoices/*.{test,integration.test}.ts` and `apps/api/src/modules/bank-accounts/bank-accounts.integration.test.ts` -- cover lifecycle validation, snapshot stability, cash flow, and fixture cleanup.
- `apps/web/src/features/invoices/{api,detail-page}.{ts,tsx}` and related tests -- parse lifecycle resources, protect unsaved drafts, render pending QR/payment details, and provide accessible feedback.
- `apps/web/src/index.css` and `apps/web/e2e/invoices.spec.ts` -- style the QR card and update invoice detail fixtures for the expanded API contract.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- mark Story 3.4 implementation activity.

Review findings: 7 patches applied (medium 5, low 2); 0 deferred; 10 rejected. Follow-up review recommendation: true (score 17).

Verification performed:

- `pnpm --filter api test` -- pass, 84 tests.
- `pnpm --filter api test:integration` -- pass, 31 PostgreSQL-backed tests and fresh migration application.
- `pnpm --filter web test` -- pass, 78 tests.
- `pnpm --filter web test:e2e` -- pass, 22 Playwright tests.
- `pnpm lint && pnpm typecheck && pnpm build` -- all pass.
- `git diff --check` -- pass.

Residual risks: QR is served by `img.vietqr.io`; the detail retains the payment snapshot and transfer content if that external image cannot load. The existing mock E2E harness does not perform an end-to-end lifecycle mutation, while the API transition is covered by PostgreSQL integration tests and the UI state is covered by component tests.

## Verification

**Commands:**
- `pnpm --filter api test` -- expected: invoice DTO/service lifecycle tests pass.
- `pnpm --filter api test:integration` -- expected: migration, snapshot, transition và QR stability PostgreSQL tests pass.
- `pnpm --filter web test` -- expected: API parser và invoice detail lifecycle tests pass.
- `pnpm --filter web test:e2e` -- expected: invoice transition/QR browser flow pass.
- `pnpm lint && pnpm typecheck && pnpm build` -- expected: workspace checks pass.

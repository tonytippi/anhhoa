---
title: 'Đối chiếu và xác nhận UX tài chính cho kế toán'
type: 'feature'
created: '2026-10-05'
status: 'in-progress'
review_loop_iteration: 0
baseline_commit: 'd2c8ff8f3d6a662eabffb189e142f8820606859a'
context:
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-30-taxed-receivables-and-two-payment-channels.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Kế toán không thể đối chiếu tổng đợt thu với VAT hiển thị trong preview, bộ lọc Thu tiền yêu cầu UUID năm học, và các dialog tài chính yêu cầu gõ lại tên/tháng thay vì trình bày thông tin xác nhận đủ rõ. Vị trí rà soát và trạng thái phát hành trong đợt chưa cho biết tiến độ xử lý.

**Approach:** Hiển thị các số tiền, VAT và tổng do API trả về xuyên suốt preview/READY; thay xác nhận gõ bằng modal named confirmation có dữ kiện nghiệp vụ; cải thiện tiến độ, nhãn tiếng Việt và định dạng theo mockup đã duyệt mà không thay đổi lifecycle, quyền hoặc phép tính ở client.

## Boundaries & Constraints

**Always:** API là nguồn duy nhất của VAT, tổng VND integer, channel và trạng thái; mọi query/mutation School-scoped; giữ Idempotency-Key, Operation reconciliation, validation lý do bắt buộc và modal backdrop/focus trap/Esc/return focus. Mọi số tiền hiển thị dùng `đ`, ngày `dd/mm/yyyy`, tháng `mm/yyyy`; payload tiếp tục ISO. Dialog xác nhận không nhập lại tên/tháng, nêu đối tượng và dữ kiện server, focus đầu tiên ở Hủy/tiêu đề, và nút chính disabled khi pending. Hậu quả dialog chỉ nêu behavior xác minh được từ hệ thống; trạng thái/giao diện người dùng không lộ từ tiếng Anh `Operation`, `coverage`, `DRAFT`, `ACTIVE`, `RETIRED`.

**Ask First:** Dừng nếu mockup mâu thuẫn với yêu cầu mới hoặc nếu API không thể xuất dữ kiện xác nhận mà không thay đổi hợp đồng nghiệp vụ/lifecycle.

**Never:** Không sửa artifact final, mockup, schema/lifecycle settlement, tính VAT/tổng ở browser, thêm phát hành hàng loạt, thay đổi receipt fields, tính tiền ăn theo ngày, gộp preview theo học sinh, hay preview chênh lệch điều chỉnh dòng.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Preview có VAT | DRAFT/READY có dòng VAT_5 | API trả subtotal trước thuế, VAT và tổng; UI cộng đúng `Cần thu dự kiến` theo tổng server | Không có phép tính tiền client |
| Xác nhận phát hành | Hóa đơn nháp một/hai channel | Modal nêu học sinh, tháng, lớp, tổng gồm VAT và tài khoản; không có textbox xác nhận | Thiếu tài khoản giữ nút phát hành disabled; Esc/Hủy đóng dialog |
| Tạo hóa đơn | RUN READY có summary server | Modal nêu đủ điều kiện, bỏ qua, cần thu dự kiến và nút `Tạo N hóa đơn nháp`; nhắc server đánh giá lại trước khi tạo | Pending khóa nút, timeout tiếp tục reconciliation |
| Phát hành xong | Còn hóa đơn nháp của cùng đợt | Mở hóa đơn nháp kế tiếp theo thứ tự server và hiển thị i/n | Không còn nháp giữ hóa đơn hiện tại |
| Hàng chờ thu | API trả schoolYear filter | Select hiển thị nhãn năm học, dùng UUID trong request | Server default được phản ánh vào select |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/finance/finance.service.ts` -- `previewSummary`, `previewLineSummaries`, `previewExtracurricularSummaries`, `preview` và `run` đang có VAT từng line nhưng trả total summary/table không đủ để UI đối chiếu; bổ sung tổng VAT/tổng từng summary từ các line server-derived.
- `apps/web/src/finance/finance-workspace.tsx` -- catalog đã trả `schoolYears`; tái dùng nguồn School-scoped này cho Receipt Queue thay vì thêm field vào receiptQueue DTO.
- `apps/api/src/integration/finance-channels.integration.test.ts` -- proof hiện có về expectedTotal/VAT per line; mở rộng DTO preview/READY reconciliation.
- `apps/web/src/finance/finance-workspace.tsx` -- types, preview/READY tables, metrics, invoice queue navigation, dialogs issue/revision/close/generate/add student, labels/formatting and template edit hint.
- `apps/web/src/finance/receipt-queue-workspace.tsx` -- filter, result coverage copy, date/month/money display; fetch school years only through authorized API DTO.
- `apps/web/src/finance/finance-workspace.test.tsx` -- command mocks and accessibility/dialog coverage for server facts, no typing confirmation, focus, progress and format.
- `apps/web/src/finance/receipt-queue-workspace.test.tsx` -- select labels/default plus Vietnamese coverage/date/month assertions.
- `apps/web/e2e/finance-release-gate.spec.ts` -- remove typing confirmations; assert VAT reconciliation, confirmation details, next draft auto-open and issue progress.
- `apps/web/playwright.config.ts` -- existing local change makes all E2E portal ports environment-configurable; defaults remain existing CI ports.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/api/src/modules/finance/finance.service.ts` and finance integration tests -- return server-derived preview/READY VAT and reconciliation totals; preserve VND bigint snapshots and no browser arithmetic.
- [ ] `apps/web/src/finance/finance-workspace.tsx` and tests -- render VAT columns/totals and server grand total; format amounts/dates/statuses; preselect a current/sole year; correct fixed-template editing context/unit; add server-fact confirmation modals with exact action labels, issue progression and review/list progress; remove English operation/status terminology from user-facing output.
- [ ] `apps/web/src/finance/receipt-queue-workspace.tsx` and tests -- load the existing School-scoped receivable catalog for labelled SchoolYear select, use Vietnamese prepaid-promotion copy and mockup formatting.
- [ ] `apps/web/e2e/finance-release-gate.spec.ts` -- exercise new dialog semantics and finance lifecycle using independent ports and `.env.test`.

**Acceptance Criteria:**
- Given a VAT_5 line in a DRAFT preview or READY run, when Finance compares table totals, then server-returned subtotal, VAT and final total reconcile exactly to `Cần thu dự kiến` and each row’s `Tổng phải thu` includes its returned VAT.
- Given any of issue, revision, close, generate or generated-student addition is requested, when its modal opens, then it names the target, presents relevant server facts/consequence, has no typed-name/month confirmation, focuses a non-primary dismiss target, accepts Esc and disables its clearly named primary action while pending: `Phát hành hóa đơn`, `Chuẩn bị bản điều chỉnh`, `Đóng đợt thu mm/yyyy`, `Tạo hóa đơn nháp cho N học sinh`, or `Thêm học sinh vào đợt`.
- Given a notice is issued while a same-run draft remains, when server confirms issue, then the next draft in server list order opens automatically; list and review surfaces show issued/completed x/y and student i/n. Given no next draft, then the opened invoice remains and the UI says all run invoices have been issued.
- Given the receipt queue loads, when its server default has a SchoolYear, then Finance sees a labelled SchoolYear select rather than UUID text and requests retain the selected ID.
- Given finance labels render, when dates/months/amounts/statuses/prepaid promotion are displayed, then they use Vietnamese labels, `dd/mm/yyyy`, `mm/yyyy` and `đ` without changing API payload values; no user-visible finance string contains `Operation`, `coverage`, `DRAFT`, `ACTIVE`, or `RETIRED`, and promotion states read `Nháp`, `Đang áp dụng`, or `Đã ngừng`.

## Design Notes

The reviewed mockup already specifies preview columns `Thuế GTGT` and `Tổng phải thu`, generated-list progress `118/125 hóa đơn đã phát hành hoặc hoàn tất`, and modal confirmations with a concrete target. The implementation may add current server facts requested by the user, but keeps the table-first desktop presentation and modal visual language.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test -- finance-channels.integration.test.ts` -- expected: server VAT preview/READY DTO tests pass against `.env.test` configuration.
- `pnpm --filter @passionedu/admin-web test -- finance-workspace.test.tsx receipt-queue-workspace.test.tsx` -- expected: UI/dialog/select behavior passes.
- `pnpm typecheck` and `pnpm lint` -- expected: no TypeScript/lint errors.
- `set -a && . ./.env.test && set +a && E2E_API_PORT=3100 E2E_APP_PORT=5180 E2E_PARENT_APP_PORT=5181 E2E_TEACHER_APP_PORT=5182 E2E_OPS_APP_PORT=5183 NODE_ENV=test DATABASE_URL="$E2E_DATABASE_URL" pnpm --filter @passionedu/admin-web exec playwright test e2e/finance-release-gate.spec.ts` -- expected: isolated finance lifecycle passes.

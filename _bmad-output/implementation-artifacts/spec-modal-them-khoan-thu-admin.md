---
title: 'Hiển thị form thêm khoản thu trong modal Admin'
type: 'bugfix'
created: '2026-09-27'
status: 'done'
review_loop_iteration: 0
baseline_commit: '7b2c24e9f7bd6120dc08fae385da89180029d1ce'
context:
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Trên trang Khoản thu của Admin, thao tác "Thêm khoản thu" hiển thị form theo normal document flow bên dưới bảng, trái với mockup và quy ước table-first/modal của Admin. Điều này làm mất ngữ cảnh thao tác và không nhất quán với dialog Quản lý nhóm.

**Approach:** Đưa form tạo khoản thu hiện có vào overlay modal theo đúng pattern dialog Finance đang dùng, giữ nguyên dữ liệu form, API mutation, validation, focus management và lifecycle hiện hữu.

## Boundaries & Constraints

**Always:** Bám mockup `receivable-configuration.html`; dialog giữ `role="dialog"`, `aria-modal`, tiêu đề được gắn nhãn, focus trap/Escape/return-focus và các lỗi server accessible. Tái sử dụng `.dialog-backdrop` và `.dialog` hiện có. Money VND và authority/API contract không đổi.

**Ask First:** Dừng để hỏi nếu việc bọc modal buộc phải thay đổi form fields, thêm bước xác nhận mới, thay đổi API, hoặc làm sai khác visual language đã duyệt.

**Never:** Không chuyển form thành route riêng hoặc inline form; không thay API, server validation, idempotency/Operation, catalog lifecycle, model dữ liệu hay dependency dialog mới.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mở tạo khoản thu | Admin có capability Finance nhấn "Thêm khoản thu" | Form xuất hiện trên backdrop trong card modal, focus vào trường đầu tiên | Không có thay đổi dữ liệu |
| Đóng không lưu | Dialog đang mở, người dùng nhấn Escape hoặc Hủy | Dialog đóng, draft reset và focus trở về CTA đã mở | Không gọi mutation |
| Lưu hợp lệ | Người dùng gửi form hợp lệ | Giữ request/API hiện có, dialog đóng sau outcome thành công và bảng cập nhật như trước | Hiển thị lỗi hiện có nếu server từ chối |
| Bàn phím | Dialog đang mở, focus tại phần tử đầu/cuối | Tab/Shift+Tab vẫn quay vòng trong dialog | Không cho focus rơi xuống bảng nền |

</frozen-after-approval>

## Code Map

- `apps/web/src/finance/finance-workspace.tsx:190,528-578` -- state, auto-focus, focus trap, Escape và return-focus dùng chung cho managed Finance dialogs; phải giữ nguyên.
- `apps/web/src/finance/finance-workspace.tsx:843-863` -- `saveReceivable` gọi API tạo khoản thu; chỉ là evidence read-only cho thay đổi presentation.
- `apps/web/src/finance/finance-workspace.tsx:1068-1074` -- CTA "Thêm khoản thu" mở `catalogDialog="receivable"`.
- `apps/web/src/finance/finance-workspace.tsx:1539-1569` -- form receivable hiện có bị thiếu `.dialog-backdrop`/`.dialog`; các dialog Group kề bên là golden pattern markup.
- `apps/web/src/finance/finance-workspace.test.tsx:64-81,174-223,272-283` -- coverage toolbar, submit/return-focus, managed-dialog autofocus và Escape; bổ sung assertion modal cho Receivable tại đây.
- `apps/web/src/index.css:558-604` -- CSS backdrop/card và actions chuẩn, đã được Finance Group dialogs dùng; không sửa style nếu markup chuẩn tái sử dụng đúng.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html:5-10` -- mockup canonical: create receivable là dialog, không phải form inline.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/finance/finance-workspace.tsx` -- bọc riêng nhánh dialog tạo Receivable bằng backdrop và card class theo dialog Group lân cận, giữ toàn bộ handler, ARIA, refs và form fields -- đưa form ra khỏi normal flow mà không đổi business behavior.
- [x] `apps/web/src/finance/finance-workspace.test.tsx` -- mở rộng test dialog Receivable để chứng minh CTA render backdrop/card modal và giữ focus/close behavior -- ngăn hồi quy thành form dưới bảng.

**Acceptance Criteria:**
- Given Admin mở trang Khoản thu, when nhấn "Thêm khoản thu", then form chỉ xuất hiện trong centered modal trên backdrop và bảng không bị đẩy xuống.
- Given modal thêm khoản thu đang mở, when nhấn Escape hoặc Hủy, then draft bị reset, không có mutation và focus quay lại CTA mở dialog.
- Given người dùng gửi form hợp lệ hoặc server trả validation error, when luồng submit chạy, then API/reconciliation và lỗi accessible giữ nguyên hành vi trước thay đổi.
- Given keyboard user ở modal thêm khoản thu, when Tab hoặc Shift+Tab đi qua boundary, then focus vẫn được trap trong modal.

## Design Notes

Finance đã có dialog nhóm dùng markup và CSS chuẩn ngay cạnh form Receivable. Chỉ khác biệt presentation cần thiết là bọc nhánh Receivable bằng `.dialog-backdrop` và gắn `.dialog` lên phần tử dialog hiện hữu; không cần bổ sung primitive hoặc CSS mới.

## Verification

**Commands:**
- `pnpm --filter @passionedu/admin-web test -- src/finance/finance-workspace.test.tsx` -- expected: Finance workspace test pass, gồm modal Receivable.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: không có TypeScript error.
- `pnpm --filter @passionedu/admin-web build` -- expected: Vite production build thành công.
- `pnpm test:mockups` -- expected: mockup contract suite pass.

## Suggested Review Order

**Modal presentation**

- Tái dùng wrapper chuẩn để form không còn render theo document flow.
  [`finance-workspace.tsx:1539`](../../apps/web/src/finance/finance-workspace.tsx#L1539)

**Regression coverage**

- Khóa cấu trúc modal, focus trap, dismiss và lỗi server accessible.
  [`finance-workspace.test.tsx:189`](../../apps/web/src/finance/finance-workspace.test.tsx#L189)

- Xác nhận submit thành công vẫn đóng dialog và trả focus CTA.
  [`finance-workspace.test.tsx:174`](../../apps/web/src/finance/finance-workspace.test.tsx#L174)

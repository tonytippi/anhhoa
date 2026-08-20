---
title: 'Sửa bố cục phạm vi tạo hóa đơn'
type: 'bugfix'
created: '2026-08-20'
status: 'done'
route: 'plan-code-review'
baseline_commit: '90ede0073dd230126d7f89064aba6ec593eac177'
---

# Sửa bố cục phạm vi tạo hóa đơn

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Radio chọn phạm vi trong modal `Tạo hóa đơn tháng` đang nhận các CSS chung của dialog. Mỗi radio bị kéo rộng toàn dòng và nhãn dùng grid, khiến control và nội dung lệch thành các hàng riêng như ảnh người dùng cung cấp.

**Approach:** Đặt scope rõ ràng cho nhóm phạm vi của modal, override tối thiểu style radio/checkbox về kích thước native và bố cục ngang. Chuẩn hóa hai radio cùng native group và xác nhận luồng chọn Lớp vẫn gửi đúng phạm vi đến batch preview.

## Boundaries & Constraints

**Always:** Giữ nguyên luồng tạo, trạng thái React, request REST và style của các dialog/field khác. Các radio và checkbox trong nhóm phạm vi phải căn ngang với text, có khoảng cách dễ đọc và vẫn dùng được bằng bàn phím.

**Ask First:** Mở rộng thay đổi thành hệ thống form/radio dùng chung hoặc thay đổi cấu trúc modal ngoài nhóm chọn phạm vi.

**Never:** Không thay đổi API batch, không thay control native bằng một primitive mới, không sửa các thay đổi seed hiện có.

</frozen-after-approval>

## Code Map

- `apps/web/src/features/invoices/page.tsx:45-55` -- `BatchDialog` chứa fieldset phạm vi, radio toàn trường/chọn lớp và checkbox lớp.
- `apps/web/src/index.css:33,37-38,56` -- rule dialog tổng quát gây lỗi; là vị trí thêm override theo scope.
- `apps/web/src/features/invoices/page.test.tsx:61-78` -- test modal/batch preview hiện hữu; mở rộng cho phạm vi chọn Lớp.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/features/invoices/page.tsx` -- gắn class scope cho fieldset và `name` chung cho hai radio -- tách CSS radio khỏi rule form tổng quát, giữ semantic native radio group.
- [x] `apps/web/src/index.css` -- thêm rule scope cho label radio/checkbox và input tương ứng -- căn control và text trên cùng hàng mà không tác động dialog khác.
- [x] `apps/web/src/features/invoices/page.test.tsx` -- kiểm thử chọn phạm vi Lớp và payload preview -- bảo vệ hành vi sau thay đổi markup/style.

**Acceptance Criteria:**
- Given Admin mở modal tạo hóa đơn, when xem phần Phạm vi, then mỗi radio hiển thị cạnh nhãn của nó với kích thước native thay vì chiếm toàn chiều rộng dialog.
- Given Admin chọn `Chọn lớp`, when chọn một Lớp và xem trước, then request batch preview chứa `allActiveClasses: false` và danh sách `classIds` đã chọn.
- Given các field khác trong dialog, when modal hiển thị, then style input tháng, nút và hành vi hiện hữu không thay đổi.

## Verification

**Commands:**
- `pnpm --filter web test -- --run src/features/invoices/page.test.tsx` -- expected: invoice page tests pass.
- `pnpm --filter web typecheck` -- expected: TypeScript completes without errors.

## Suggested Review Order

**Phạm vi và phản hồi tải lớp**

- Gom radio native vào một nhóm và giữ trạng thái phạm vi được kiểm soát.
  [`page.tsx:510`](../../apps/web/src/features/invoices/page.tsx#L510)

- Hiển thị lỗi có thể thử lại, tránh phạm vi chọn Lớp bị kẹt vô cớ.
  [`page.tsx:539`](../../apps/web/src/features/invoices/page.tsx#L539)

**Bố cục control**

- Override theo scope, không thay đổi quy tắc input chung của dialog.
  [`index.css:536`](../../apps/web/src/index.css#L536)

**Bảo vệ hành vi**

- Xác nhận payload phạm vi Lớp và khôi phục khi tải danh sách lỗi.
  [`page.test.tsx:326`](../../apps/web/src/features/invoices/page.test.tsx#L326)

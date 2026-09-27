---
title: 'Đồng nhất thanh filter và action Tài chính'
type: 'refactor'
created: '2026-09-27'
status: 'done'
baseline_commit: '969ed6736062e5f09c42ecba773bada12d889ebc'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/promotion-configuration.html'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Các action của Khoản thu, Ưu đãi và Đợt thu đang đứng rời rạc; ở Đợt thu, nút tạo còn tách khỏi bộ lọc trạng thái. Cách trình bày này không nhất quán với trang Quản lý học sinh, nơi control list quét được trong một hàng responsive.

**Approach:** Đưa filter sẵn có và các action quản lý của từng danh sách Tài chính vào một thanh điều khiển chung, dùng cùng cấu trúc grid, khoảng cách và CTA chính của Quản lý học sinh. Không mở rộng chức năng lọc hay thay đổi API trong đợt chỉnh bố cục này.

## Boundaries & Constraints

**Always:** Giữ nguyên route, authorization, API call, state dialog, thao tác menu từng dòng và keyboard/focus behavior. Dùng CSS runtime của Admin và lớp `primary-action` hiện hữu; thanh điều khiển phải tự xuống hàng, không làm vỡ bảng ở màn hình hẹp. Giữ filter trạng thái Đợt thu hoạt động y hệt trước đây; Khoản thu và Ưu đãi chỉ có action hiện hữu vì chưa có filter được API/UI hỗ trợ.

**Ask First:** Thêm search, filter mới, filter phía client/server, pagination, cột bảng, hoặc sửa mockup planning artifact để phản ánh layout mới. Mockup hiện đặt action header tách filter list; yêu cầu mới này là ngoại lệ layout runtime cần được ghi nhận bởi spec này, không âm thầm sửa artifact final.

**Never:** Không tạo control lọc chỉ có giao diện nhưng không có hành vi rõ ràng; không sửa backend, query contract, dialog hay lifecycle finance; không dùng stylesheet mockup trong ứng dụng.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Khoản thu | Admin mở danh sách | `Quản lý nhóm` và `Thêm khoản thu` nằm trong thanh control chung; CTA tạo dùng style chính. | Nút pending vẫn disabled như trước. |
| Ưu đãi | Admin mở danh sách | `Thêm chính sách` nằm trong thanh control cùng hệ layout; không xuất hiện filter giả. | Dialog và focus trigger giữ nguyên. |
| Đợt thu | Admin chọn trạng thái hoặc thu hẹp viewport | Select trạng thái và `Tạo đợt thu` ở cùng thanh; grid tự xuống hàng mà không che control. | Đổi trạng thái vẫn xóa selection/queue và tải lại như trước. |

</frozen-after-approval>

## Code Map

- `apps/web/src/finance/finance-workspace.tsx:1059-1104` -- ba bề mặt list cần thay markup action/filter bằng một wrapper form/control dùng chung; chỉ Đợt thu có select filter với state và handler hiện hữu.
- `apps/web/src/roster/roster-workspace.tsx:2448-2471` -- mẫu runtime cho grid filter và action trên cùng một flow.
- `apps/web/src/index.css:1360-1372` -- style `.roster-list-filters` và responsive list controls; mở rộng selector hoặc thêm lớp finance tương đương tại đây.
- `apps/web/src/finance/finance-workspace.test.tsx:44-98` -- test load trang và hành vi lọc Đợt thu; bổ sung assertion cấu trúc toolbar mà không thay đổi test dialog/menu.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/{receivable-configuration,promotion-configuration,invoice-generation}.html` -- bằng chứng mockup hiện tách CTA và filter; chỉ đọc trong scope này.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/finance/finance-workspace.tsx` -- nhóm action/filter của ba danh sách vào thanh control semantic, đưa CTA chính vào `primary-action` -- đồng nhất hierarchy và flow với Quản lý học sinh nhưng giữ nguyên behavior.
- [x] `apps/web/src/index.css` -- tái dùng hoặc mở rộng grid filter runtime cho Finance, gồm action group co giãn -- bảo đảm desktop một hàng khi đủ chỗ và mobile wrap an toàn.
- [x] `apps/web/src/finance/finance-workspace.test.tsx` -- kiểm tra mỗi destination render control toolbar và Đợt thu giữ filter/CTA trong cùng toolbar -- ngăn hồi quy bố cục và hành vi filter.

**Acceptance Criteria:**
- Given Admin mở Khoản thu, when danh sách được tải, then hai action quản lý thuộc cùng thanh control responsive và `Thêm khoản thu` là CTA chính.
- Given Admin mở Ưu đãi, when danh sách được tải, then action tạo chính sách thuộc thanh control cùng pattern mà không thêm filter không có contract.
- Given Admin mở Đợt thu, when quét controls hoặc đổi trạng thái, then select trạng thái và CTA tạo cùng thanh control, request/filter side effect không đổi.
- Given viewport hẹp, when thanh control không đủ ngang, then control wrap theo grid, vẫn click/focus được và bảng giữ cơ chế scroll hiện có.

## Design Notes

`roster-list-filters` là grid auto-fit theo cột tối thiểu 150px và đã là visual language runtime được duyệt. Finance dùng cùng quy tắc để action không cần một layout riêng; group nhiều action trong một ô linh hoạt thay vì buộc chúng chiếm cột độc lập trên mobile.

## Verification

**Commands:**
- `pnpm --filter @passionedu/admin-web test -- finance-workspace.test.tsx` -- expected: các test Finance qua, gồm filter Đợt thu và dialog focus.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: không có TypeScript error.
- `pnpm --filter @passionedu/admin-web build` -- expected: Vite build hoàn tất.
- `git diff --check` -- expected: không có lỗi whitespace.

**Manual checks:**
- Mở lần lượt Khoản thu, Ưu đãi, Đợt thu tại desktop và viewport hẹp; xác nhận action/filter cùng flow, CTA chính đúng màu và không có overflow control.

## Suggested Review Order

**Thanh điều khiển Finance**

- Gom action/filter theo đúng flow list, không thay đổi handler hiện hữu.
  [`finance-workspace.tsx:1059`](../../apps/web/src/finance/finance-workspace.tsx#L1059)

- Tái sử dụng grid runtime và cho action group tự wrap.
  [`index.css:1360`](../../apps/web/src/index.css#L1360)

**Kiểm chứng hồi quy**

- Bao phủ toolbar của ba destination và request filter Đợt thu.
  [`finance-workspace.test.tsx:64`](../../apps/web/src/finance/finance-workspace.test.tsx#L64)

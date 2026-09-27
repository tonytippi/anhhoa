---
title: 'Điều chỉnh cột bảng Khoản thu Admin'
type: 'refactor'
created: '2026-09-27'
status: 'done'
review_loop_iteration: 0
context:
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Bảng Khoản thu hiện tách tên, đơn vị, đơn giá và trạng thái theo bố cục cũ, không khớp thứ tự cột người dùng đã cung cấp. Người dùng cần một bảng catalog dễ đối chiếu hơn theo ảnh tham chiếu, chỉ dùng dữ liệu catalog hiện có.

**Approach:** Chỉ đổi surface trình bày của bảng bằng dữ liệu catalog hiện có: thêm số thứ tự, gộp giá với đơn vị và resolve tên nhóm từ `groupId`. Không render cột nào khi catalog chưa có dữ liệu nguồn.

## Boundaries & Constraints

**Always:** Giữ nguyên API, model Finance, query, VND server-authoritative, lifecycle và row menu. Chỉ render các dữ liệu catalog hiện có: `#`, Tên khoản thu, Mã, Giá / đơn vị, Nhóm khoản thu, Trạng thái và Tùy chọn. Render tất cả receivables và groups, kể cả inactive; không lọc theo `available`. Bảng phải cuộn ngang trong vùng bảng trên màn hình hẹp, không làm tràn toàn trang.

**Ask First:** Dừng để hỏi nếu cần thêm cột chưa có dữ liệu server, hoặc nếu muốn đổi contract/mockup canonical Finance.

**Never:** Không thay database/API/form tạo khoản thu, không thêm placeholder hay suy diễn tax/refund từ Invoice/FinancePolicy, không ẩn dữ liệu inactive, không đổi thao tác menu hoặc focus/keyboard lifecycle.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Catalog đầy đủ | Receivable có code, group hợp lệ, giá và đơn vị | Render 7 cột: #, tên, mã, giá/đơn vị, nhóm, trạng thái, tùy chọn | Không có cột không được catalog cung cấp |
| Dữ liệu tùy chọn thiếu | `code` null hoặc `groupId` không tìm thấy | Mã/tên nhóm hiển thị `-`, bảng vẫn render | Không lộ UUID hoặc crash |
| Group/receivable inactive | Catalog có item inactive | Dòng và tên nhóm vẫn xuất hiện; menu lifecycle giữ nguyên | Không lọc item khỏi danh sách |
| Bảng rỗng hoặc màn hình hẹp | Không có receivable hoặc viewport nhỏ | Empty row span đủ 7 cột; bảng cuộn ngang trong container | Không tràn layout trang |

</frozen-after-approval>

## Code Map

- `apps/web/src/finance/finance-workspace.tsx:3-14` -- DTO browser đủ `groupId`, giá, đơn vị và catalog groups; không cần thay API.
- `apps/web/src/finance/finance-workspace.tsx:1068-1107` -- bảng Khoản thu hiện hữu, row menu/lifecycle và empty state cần đổi markup/colSpan.
- `apps/web/src/index.css:287-314` -- `.table-scroll` là pattern overflow ngang; tái sử dụng thay vì CSS table mới.
- `apps/web/src/finance/finance-workspace.test.tsx:45-80,269-280` -- fixture/baseline Finance và proof row-menu lifecycle cần giữ; thêm coverage bảy cột ở đây.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html:5-8` -- table-first và row menu canonical; ảnh người dùng được ưu tiên cho thứ tự cột mới.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/finance/finance-workspace.tsx` -- render bảy cột có dữ liệu, tạo lookup group-name an toàn, gộp giá/đơn vị, cập nhật empty span và bọc `.table-scroll` -- đúng layout mà không đổi Finance authority.
- [x] `apps/web/src/finance/finance-workspace.test.tsx` -- thêm fixture/assertion cho thứ tự header, số thứ tự, VND/đơn vị, lookup/fallback, trạng thái inactive, empty span và menu lifecycle -- khóa đúng dữ liệu presentation.

**Acceptance Criteria:**
- Given catalog có khoản thu và nhóm, when Admin mở Khoản thu, then bảng hiển thị đúng bảy cột có dữ liệu và giá đi kèm đơn vị.
- Given API chưa trả giá hoàn trả hoặc thuế suất, when Admin xem bảng, then hai cột này không được render và không có giá trị client-suy diễn.
- Given mã thiếu, group không resolve hoặc item inactive, when bảng render, then fallback là `-`, item vẫn thấy được và lifecycle menu hoạt động.
- Given viewport hẹp hoặc catalog rỗng, when bảng render, then chỉ vùng bảng cuộn ngang và empty state phủ đủ bảy cột.

## Design Notes

`catalog.groups` và `catalog.receivables` được trả cùng response, nên lookup `groupId -> name` là presentation-only và không tạo thêm authority. Trạng thái là dữ liệu catalog hiện có, nên giữ cột này để không mất tín hiệu lifecycle.

## Verification

**Commands:**
- `pnpm --filter @passionedu/admin-web test -- src/finance/finance-workspace.test.tsx` -- expected: Finance workspace tests pass, gồm coverage bảng bảy cột.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: không có TypeScript error.
- `pnpm --filter @passionedu/admin-web build` -- expected: production build thành công.

## Suggested Review Order

**Bố cục catalog**

- Sắp cột theo dữ liệu có sẵn, giữ lifecycle và menu dòng.
  [`finance-workspace.tsx:1068`](../../apps/web/src/finance/finance-workspace.tsx#L1068)

- Lookup tên nhóm an toàn với response catalog chưa đầy đủ.
  [`finance-workspace.tsx:1040`](../../apps/web/src/finance/finance-workspace.tsx#L1040)

**Regression coverage**

- Khóa đúng header và nội dung từng dòng, gồm fallback/inactive.
  [`finance-workspace.test.tsx:56`](../../apps/web/src/finance/finance-workspace.test.tsx#L56)

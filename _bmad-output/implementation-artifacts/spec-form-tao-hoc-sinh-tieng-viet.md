---
title: 'Chuẩn hóa biểu mẫu tạo học sinh bằng tiếng Việt'
type: 'feature'
created: '2026-09-23'
status: 'done'
review_loop_iteration: 0
baseline_commit: '6e066244ae789eccda3756417e97ee3872a473fa'
context:
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/student-enrollment.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Biểu mẫu tạo học sinh hiện có hierarchy chưa rõ: thông tin bắt buộc, hồ sơ, ghi danh và phụ huynh bị trộn hoặc tách rời. Một số nhãn nhìn thấy vẫn dùng thuật ngữ tiếng Anh `enrollment`, không phù hợp với giao diện vận hành tiếng Việt.

**Approach:** Sắp xếp lại biểu mẫu hiện hữu thành bốn nhóm thông tin có nhãn tiếng Việt ngắn, áp dụng grid riêng để hết xô lệch trên desktop và một cột trên mobile. Chuẩn hóa toàn bộ copy hiển thị của luồng danh sách/tạo học sinh sang thuật ngữ `ghi danh`, giữ nguyên API và logic nghiệp vụ hiện tại.

## Boundaries & Constraints

**Always:** Dùng tiếng Việt cho mọi nhãn, tiêu đề, trạng thái và mô tả nhìn thấy trong luồng học sinh; giữ visible School/SchoolYear context; giữ validation server-side, field error, focus summary, input retention, Operation reconciliation và switch guard hiện hữu. Dialog có tên, chỉ một lớp, có dismiss path rõ ràng và không tràn viewport desktop/mobile. Giữ input `aria-*`, handlers, field error mapping, file accept list, state, endpoint và JSON payload hiện có.

**Ask First:** Thay đổi trường dữ liệu, requiredness, thứ tự submit/photo/parent staging, lifecycle ghi danh, endpoint hay payload; thay đổi ngoài bề mặt tạo/danh sách học sinh.

**Never:** Không đổi quyền/API/server authorization; không dịch mã kỹ thuật hoặc enum gửi tới API; không lưu draft client-side; không thêm thư viện UI; không dùng copy tiếng Anh nhìn thấy như `enrollment` hay `Enrollment`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mở biểu mẫu | Nhấn `Thêm học sinh` trong năm học hoạt động | Dialog `Tạo học sinh và ghi danh` hiển thị bốn nhóm: thông tin cơ bản, hồ sơ, ghi danh, phụ huynh tùy chọn | Nút đóng đóng dialog như hiện tại |
| Chọn chờ xếp lớp | Chọn `Chờ xếp lớp` | Ẩn chọn lớp và xóa class ID như logic hiện hữu | Không tạo local enrollment/ghi danh |
| Server từ chối | Server trả field error cho học sinh, ảnh hoặc phụ huynh | Error summary được focus; lỗi cạnh đúng input; giá trị đã nhập còn nguyên | Không hiển thị thành công local hay gửi lại tự động |
| Màn hình hẹp | Viewport dưới 768px | Các trường, lựa chọn ghi danh và nút hành động xếp một cột, dialog cuộn nội bộ không tràn ngang | Nút tạo và đóng vẫn truy cập được |

</frozen-after-approval>

## Code Map

- `apps/web/src/roster/roster-workspace.tsx:2128-2239` -- hai bản markup tạo học sinh: dialog cho `section="students"` và form toàn trang cho `section="all"`; tái dùng một cấu trúc form nội bộ để tránh copy/layout lệch nhau, nhưng giữ handlers và payload `createStudent()` ở dòng 790.
- `apps/web/src/roster/roster-workspace.tsx:2240-2250` -- tiêu đề cột danh sách còn `Enrollment hiện tại`; đổi thành `Ghi danh hiện tại`.
- `apps/web/src/roster/roster-workspace.tsx:2235-2239` -- thông báo năm học không hoạt động còn dùng `enrollment`; đổi sang `ghi danh`.
- `apps/web/src/index.css:1178-1276` -- hệ thống grid form chung; không thay đổi ảnh hưởng các form danh bộ khác.
- `apps/web/src/index.css:1317-1345, 1499-1504` -- modal intake và action hiện hữu; bổ sung selector form intake riêng cho grid section, chiều cao viewport và responsive.
- `apps/web/src/roster/roster-workspace.test.tsx:19-28, 118-198, 243-249` -- regression cho dialog, submit, field errors và copy; cập nhật text assertion, thêm assertions section/tiếng Việt và giữ payload không đổi.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md:135-192` -- nhãn tiếng Việt ngắn, hierarchy bề mặt, dialog sober một tầng.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md:59, 101, 149, 166-172` -- effective date, validation/input retention, dialog accessibility và Admin responsive.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/roster/roster-workspace.tsx` -- thay markup tạo học sinh bằng form cấu trúc dùng chung cho dialog và view toàn trang; nhóm chính xác các input đang có thành `Thông tin cơ bản`, `Thông tin hồ sơ`, `Ghi danh`, `Phụ huynh (tùy chọn)`; thay toàn bộ copy nhìn thấy `enrollment` bằng `ghi danh` -- loại bỏ thuật ngữ tiếng Anh và ngăn hai entry point lệch nhau.
- [x] `apps/web/src/index.css` -- thêm style được scope cho form intake: grid hai cột cho input ngắn, full-width cho địa chỉ/tệp/khối ghi danh, radio rõ ràng, actions nhất quán và dialog max-height/overflow nội bộ; về một cột dưới 768px -- tạo hierarchy gọn, không xô lệch và usable trên mobile mà không ảnh hưởng roster form khác.
- [x] `apps/web/src/roster/roster-workspace.test.tsx` -- cập nhật assertions dialog/copy, kiểm tra bốn section tiếng Việt, luồng `Chờ xếp lớp` và payload submit không đổi -- khóa bề mặt mới cùng hành vi hiện có.

**Acceptance Criteria:**
- Given School Admin mở form trong năm học hoạt động, when dialog render, then title là `Tạo học sinh và ghi danh`, có bốn section tiếng Việt theo thứ tự hồ sơ-nghiệp vụ và không có text hiển thị `enrollment`/`Enrollment` trong luồng này.
- Given School Admin điền thông tin cơ bản, when chọn `Xếp lớp`, then chọn lớp và ngày hiệu lực thuộc cùng section `Ghi danh`; when chọn `Chờ xếp lớp`, then chọn lớp không hiển thị và class ID được xóa như trước.
- Given cùng dữ liệu form, when submit ở dialog hoặc entry point danh bộ toàn trang, then request giữ nguyên endpoint, keys và values payload hiện có; không đổi photo/parent staging hoặc reconciliation.
- Given server trả field error, when form render lại, then error summary nhận focus, field có `aria-invalid`/`aria-describedby` đúng, input giữ giá trị và section chứa field còn nhìn thấy.
- Given viewport desktop, when dialog mở, then trường ngắn thẳng hàng theo hai cột và trường dài chiếm toàn hàng; given viewport dưới 768px, when dialog mở, then chỉ một cột, không có horizontal overflow và action luôn thao tác được.
- Given năm học không hoạt động hoặc bảng học sinh render, when UI hiển thị copy, then dùng `ghi danh` thay vì thuật ngữ tiếng Anh.

## Design Notes

Giữ thứ tự thao tác tự nhiên: nhận diện trẻ trước, bổ sung hồ sơ sau, quyết định ghi danh/lớp và ngày hiệu lực kế tiếp, cuối cùng là liên hệ phụ huynh tùy chọn. `Ảnh hồ sơ` vẫn được tải sau khi server xác nhận Student; biểu mẫu chỉ thay cách trình bày, không thay đổi boundary đó.

## Verification

**Commands:**
- `pnpm --filter @passionedu/admin-web test -- roster-workspace.test.tsx` -- expected: toàn bộ test roster pass, bao gồm dialog/copy/submit/error regression.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: không lỗi TypeScript.
- `pnpm --filter @passionedu/admin-web build` -- expected: Vite build hoàn tất.
- `git diff --check` -- expected: không lỗi whitespace.

**Manual checks:**
- BrowserMCP ở desktop: mở `Thêm học sinh`, kiểm tra nhãn Việt, grid thẳng hàng, section rõ và dialog cuộn trong viewport.
- BrowserMCP ở viewport mobile: mở cùng dialog, kiểm tra một cột, không tràn ngang, radio và hai nút rõ ràng.

## Suggested Review Order

**Biểu mẫu dùng chung**

- Một cấu trúc giữ hai entry point đồng nhất mà không đổi state, handlers hay payload.
  [`roster-workspace.tsx:1235`](../../apps/web/src/roster/roster-workspace.tsx#L1235)

- Copy hiển thị trong danh bộ dùng nhất quán thuật ngữ ghi danh.
  [`roster-workspace.tsx:2089`](../../apps/web/src/roster/roster-workspace.tsx#L2089)

**Bố cục responsive**

- Grid intake riêng tạo hai cột desktop và một cột mobile, không ảnh hưởng form khác.
  [`index.css:1335`](../../apps/web/src/index.css#L1335)

**Regression**

- Dialog, bốn section, copy tiếng Việt, chờ xếp lớp và payload được khóa bằng test.
  [`roster-workspace.test.tsx:19`](../../apps/web/src/roster/roster-workspace.test.tsx#L19)

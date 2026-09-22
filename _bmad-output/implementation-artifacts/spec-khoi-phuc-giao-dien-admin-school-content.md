---
title: 'Khôi phục giao diện Admin cho school-content'
type: 'bugfix'
created: '2026-09-22'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '0479dff4d3a580a43ed5727e5d31b1d86c2f86fd'
context:
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Trang Admin tại `http://localhost:5173/#school-content` hiện chỉ hiển thị các phần tử HTML mặc định khi đã vào ngữ cảnh Trường. Cấu trúc React hiện không đặt lớp layout cho khung chọn Trường, điều hướng và dialog; vì vậy các quy tắc trong stylesheet hiện hữu cho sidebar/page/card không thể áp dụng. Trải nghiệm lệch rõ rệt khỏi mockup PassionEdu đã được duyệt.

**Approach:** Hoàn thiện lớp trình bày riêng cho Admin workspace bằng các class semantic trên shell và SchoolContext, sau đó bổ sung CSS responsive dùng hệ màu, typography, surface và mật độ vận hành của mockup. Không đổi API, quyền hạn, state transition, navigation capability hay luồng chọn/đổi Trường.

## Boundaries & Constraints

**Always:** Giữ nguyên `SchoolContext` là nơi gọi API và quyết định quyền; màn chưa có session, đang tải, không có trường, lỗi và dialog đổi Trường đều phải có presentation nhất quán, dễ đọc và keyboard-focus rõ. Dùng font/tokens màu PassionEdu đang có trong `index.css`, bố cục desktop sidebar 232px và content max-width hiện hữu, đồng thời không che mất nội dung ở breakpoint tablet/mobile. Nút điều hướng hiện tại vẫn là button và giữ `aria-current`; skip link vẫn truy cập được bằng bàn phím. CSS chỉ trình bày, không dựa vào `schoolId`, browser state hoặc class để authorize. Tái sử dụng ngôn ngữ mockup: nền kem yên tĩnh, bề mặt trắng, viền trung tính, xanh lá cho hành động/chọn hiện hành, card bo góc vừa phải và khoảng cách rõ ràng.

**Ask First:** Hỏi trước khi thay đổi copy sản phẩm, thêm icon/library/component design system, đổi trật tự navigation do API trả về, sửa contract session/API, hoặc thay đổi hành vi chọn Trường, guard dirty/pending hay dialog xác nhận.

**Never:** Không sao chép trực tiếp asset/branding của ảnh tham khảo; không thêm Tailwind utility rải rác hoặc stylesheet thứ hai không có ownership; không dùng inline style để vá riêng route; không làm session/loading vô hình; không thay đổi authorization, capability, URL semantics, mutation hay Operation reconciliation; không đụng vào mockup historical/final để đổi yêu cầu.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Vào Admin chưa chọn Trường | Session hợp lệ, danh sách Trường đã tải | Thấy app shell, sidebar/brand, khối chọn Trường nổi bật và trạng thái hướng dẫn; không còn text dồn ở góc trên trái | Khi không có trường, hiển thị empty state trong cùng content surface |
| Đã chọn Trường | Context và navigation được API trả về | Header tên Trường, thanh điều hướng và workspace con căn trong layout giống mockup; tab hiện hành có active state rõ | Capability thiếu vẫn không render workspace như hiện tại |
| Đổi Trường có draft/pending | Người dùng chọn Trường khác | Dialog phủ nền, surface, heading, copy và hai hành động phân cấp rõ; focus hiện có vẫn hoạt động | Không tự bỏ nội dung hay thay đổi status callback |
| Màn hẹp | Viewport dưới 1024px hoặc 768px | Không còn left margin dành cho sidebar ẩn; controls, navigation và action wrap/stack, không overflow ngang trang | Table/workspace con tiếp tục tự quản lý horizontal scroll hiện hữu |
| Loading hoặc unauthenticated | Bootstrap session chưa xong hoặc không có session | Nội dung trạng thái nằm giữa canvas/card, typography và CTA nhất quán | Không ảnh hưởng redirect Google hay callback logout |

</frozen-after-approval>

## Code Map

- `apps/web/src/main.tsx:61-102` -- `AdminShell` import stylesheet nhưng render `main` trần ở mọi trạng thái; thêm class semantic cho auth/loading shell, app shell, skip link và logout action mà không đổi gọi session.
- `apps/web/src/school-context.tsx:38-290` -- nguồn markup của trạng thái chọn Trường, heading, navigation, workspace và dialog; gắn className/structure tối thiểu để stylesheet có điểm áp dụng, giữ nguyên fetch, capability gates và dirty guard.
- `apps/web/src/index.css:19-984` -- stylesheet Admin duy nhất, đã có font, token palette, desktop/mobile sidebar, button/card/dialog patterns; thêm nhóm rule scoped cho `admin-*`/`school-context` để không làm regress roster, finance, settings và attendance workspaces.
- `apps/web/src/school-context.test.tsx` -- kiểm tra hành vi SchoolContext; cập nhật assertion class/semantic DOM chỉ khi test đang khóa markup, bảo toàn các test về authorization, race/switch và guard.
- `apps/web/src/shell.test.tsx` -- kiểm tra AdminShell authentication states; bổ sung assertion presentation hooks cho loading/login nếu phù hợp, không mock CSS như behavior.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.css:1-11` -- chuẩn tham chiếu visual: canvas/surface/tint, typography Be Vietnam Pro, card, sidebar và responsive; chỉ diễn dịch vào React stylesheet hiện tại.
- `_bmad-output/implementation-artifacts/spec-tach-shell-mockup-admin.md` -- đọc-only để giữ ranh giới shell mockup và xác nhận không làm thay đổi API/domain chỉ vì presentation.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/main.tsx` -- áp class semantic cho tất cả trạng thái Admin shell và đưa skip/logout vào chrome hợp lý -- cho CSS tạo được khung nhất quán từ lúc bootstrap đến lúc có context.
- [x] `apps/web/src/school-context.tsx` -- áp class semantic lên chooser, heading, navigation, messages, workspace host và confirmation dialog -- biến markup hiện có thành surface có thể style mà không đổi logic nghiệp vụ.
- [x] `apps/web/src/index.css` -- thêm stylesheet scoped cho Admin shell/SchoolContext với desktop, tablet và mobile layouts, controls, nav active, status/empty/error surfaces và dialog -- khớp mockup PassionEdu đồng thời tránh phạm vi ảnh hưởng sang workspace con.
- [x] `apps/web/src/school-context.test.tsx` và/hoặc `apps/web/src/shell.test.tsx` -- bổ sung regression test cho class presentation hooks và giữ suite behavior xanh -- phát hiện việc trả về markup trần trong tương lai.

**Acceptance Criteria:**
- Given người dùng mở `/#school-content` với session hợp lệ, when danh sách Trường sẵn sàng nhưng chưa chọn Trường, then trang hiển thị shell/canvas, chooser và trạng thái có phân cấp thị giác theo mockup thay vì HTML mặc định dồn ở góc.
- Given người dùng đã chọn Trường, when SchoolContext render heading, navigation và workspace, then content nằm đúng trong layout desktop/mobile, active navigation nhận biết được và không có thay đổi capability/API.
- Given user dùng bàn phím, when tab đến skip link, navigation, chooser hoặc dialog, then focus outline rõ, các control có kích thước chạm tối thiểu và hành vi focus/dialog cũ không đổi.
- Given viewport tablet/mobile, when sidebar không hiển thị, then content không giữ margin desktop, navigation và action không tràn ngang canvas.
- Given các test Admin hiện hữu chạy, when kiểm tra session, chọn/đổi Trường và workspace status, then chúng vẫn pass mà không cần đổi backend hay fixture.

## Design Notes

Ưu tiên cấu trúc bề mặt vận hành thay vì dashboard marketing: shell sáng, sidebar trắng, vùng chính rộng rãi; chooser là card có label rõ; navigation là segmented control nhẹ. Các workspace con đã có style riêng nên chỉ định style cho chrome và tránh selector tổng quát như `main button` hoặc `section button`.

## Verification

**Commands:**
- `pnpm --filter @passionedu/admin-web test` -- expected: toàn bộ regression test Admin pass.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: TypeScript không lỗi.
- `pnpm --filter @passionedu/admin-web build` -- expected: Vite build CSS/React thành công.
- `git diff --check` -- expected: không có whitespace error.

**Manual checks:**
- Mở `http://localhost:5173/#school-content` bằng browsermcp ở desktop và viewport hẹp; xác nhận chooser, active navigation, loading/login, empty/error và dialog đổi Trường đều có bề mặt PassionEdu thay vì UA styles.

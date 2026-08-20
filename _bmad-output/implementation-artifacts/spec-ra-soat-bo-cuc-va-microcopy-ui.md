---
title: 'Rà soát bố cục và microcopy UI quản trị'
type: 'refactor'
created: '2026-08-20'
status: 'done'
baseline_commit: 'c5b07fe72d8fe3e9ed7efed72cefbf494ce28199'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-anhhoa-2026-08-18/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-anhhoa-2026-08-18/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Giao diện quản trị đã đủ chức năng nhưng một số vùng còn mang cảm giác bản dựng: toolbar hóa đơn phân bổ sai chiều rộng, hành động trang chi tiết thiếu nhất quán, trạng thái rỗng chưa phân biệt rõ nguyên nhân, và nhiều nhãn tiếng Việt dùng thuật ngữ kỹ thuật hoặc viết hoa danh từ chung thiếu tự nhiên.

**Approach:** Rà soát các bề mặt hiện có như một hệ thống thống nhất, điều chỉnh nhịp bố cục và responsive bằng CSS/chỉnh markup nhỏ, đồng thời biên tập microcopy theo giọng ngắn, trực tiếp của UX spine. Giữ nguyên luồng nghiệp vụ, API và hệ nhận diện đã chốt.

## Boundaries & Constraints

**Always:** Giữ nguyên màu, font và nguyên tắc desktop-first trong design spine; mỗi trang có đúng một `h1`; duy trì label, caption, live region, focus restore và touch target tối thiểu 40px; dùng từ ngữ nghiệp vụ quen thuộc với quản trị trường mầm non; phân biệt trạng thái “chưa có dữ liệu” với “không tìm thấy kết quả”; cập nhật test phụ thuộc accessible name hoặc nội dung hiển thị.

**Ask First:** Thay đổi cấu trúc điều hướng, thêm/xóa chức năng, thay đổi thuật ngữ nghiệp vụ có ảnh hưởng API/dữ liệu, hoặc thay Unicode icon bằng một thư viện icon mới.

**Never:** Thay đổi API, validation hoặc quy tắc hóa đơn; thêm dashboard-card trang trí, gradient hay animation không phục vụ thao tác; sửa planning artifact đã `final`; làm mất hành động trên mobile hoặc chỉ cho hiện action khi hover.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Danh sách có dữ liệu | Desktop và mobile, có/không có filter | Heading, CTA, bộ lọc, bảng và phân trang có thứ bậc ổn định; ô tìm kiếm nhận phần chiều rộng linh hoạt | Bảng vẫn cuộn ngang trên màn hẹp, không làm mất action |
| Danh sách rỗng | Chưa có bản ghi hoặc filter không khớp | Copy nêu đúng nguyên nhân và chỉ có một CTA phù hợp | Không gợi ý tạo mới khi chỉ cần đổi/xóa filter |
| Nội dung bất đồng bộ | Loading, lỗi, dữ liệu cũ trong lúc tải tháng mới | Copy ngắn, nêu rõ dữ liệu đang hiển thị và hành động thử lại | Giữ `aria-live`/`role=alert`, không che mất dữ liệu cũ hợp lệ |
| Dialog nghiệp vụ | Tạo/sửa/xác nhận | Tiêu đề và nút dùng động từ + đối tượng cụ thể, câu giải thích nêu tác động thực tế | Giữ dữ liệu nhập và focus behavior hiện có khi lỗi |

</frozen-after-approval>

## Code Map

- `apps/web/src/index.css` -- design system và toàn bộ layout desktop/mobile; trọng tâm `.page-heading`, `.table-toolbar`, `.table-card`, `.row-actions`, `.pagination`, `.dialog`, `.invoice-*` và media query.
- `apps/web/src/features/{overview,classes,students,invoices,invoice-template,bank-accounts,reports}/page.tsx` -- heading, toolbar, empty/error/loading state và microcopy của các trang chính.
- `apps/web/src/features/classes/detail-page.tsx` -- đưa hành động lớp vào hierarchy trang chi tiết và chuẩn hóa thuật ngữ.
- `apps/web/src/features/invoices/detail-page.tsx` -- thay jargon “snapshot”, làm rõ editor, tóm tắt và lifecycle action mà không đổi nghiệp vụ.
- `apps/web/src/features/auth/login-page.tsx`, `apps/web/src/app/app.tsx` -- rà câu chữ đăng nhập/trạng thái phiên.
- `apps/web/src/**/*.test.tsx`, `apps/web/e2e/*.spec.ts` -- bằng chứng hành vi và accessible copy cần cập nhật cùng UI.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/index.css` -- chuẩn hóa container, heading/toolbar, table state, action và responsive spacing; sửa việc field đầu tiên luôn chiếm flex trên toolbar hóa đơn.
- [x] `apps/web/src/features/**/*.tsx`, `apps/web/src/components/*.tsx` -- biên tập copy và sắp xếp markup nhỏ trên các bề mặt hiện có; chuẩn hóa chữ thường cho danh từ chung, nhãn trạng thái và thuật ngữ ảnh chụp hóa đơn.
- [x] `apps/web/src/**/*.test.tsx`, `apps/web/e2e/*.spec.ts` -- cập nhật assertion bị ảnh hưởng và bổ sung coverage cho bố cục/copy quan trọng nếu còn khoảng trống.

**Acceptance Criteria:**
- Given người dùng quét bất kỳ trang danh sách nào, when trang hiển thị dữ liệu, loading, lỗi hoặc rỗng, then tiêu đề, hành động, bộ lọc và thông báo dùng cùng một thứ bậc và câu chữ cho biết rõ trạng thái.
- Given trang hóa đơn ở desktop, when toolbar hiển thị tháng, tìm kiếm, trạng thái và lớp, then ô tìm kiếm là vùng co giãn chính còn các control khác giữ chiều rộng sử dụng được.
- Given màn hình dưới 768px, when người dùng mở danh sách hoặc dialog, then nội dung xếp dọc hợp lý, bảng cuộn ngang và mọi action vẫn nhìn thấy, thao tác được.
- Given người dùng đọc nội dung UI, when gặp thông tin lịch sử hóa đơn, trạng thái hoặc xác nhận, then không còn jargon “snapshot/bề mặt/luồng mới” và danh từ chung không bị viết hoa tùy tiện.
- Given thay đổi hoàn tất, when chạy kiểm tra web, then typecheck, lint và unit test đều thành công.

## Spec Change Log

## Design Notes

Đây là công cụ vận hành nên ưu tiên mặt phẳng dữ liệu, đường căn và khoảng trắng hơn card/trang trí. CTA cấp trang nằm cùng heading khi đủ chỗ và xuống hàng trên mobile; toolbar dùng grid/flex theo vai trò thay vì vị trí phần tử. Copy ưu tiên “Lớp tại thời điểm lập hóa đơn”, “Tên gọi”, “Đang dùng”, “Chuyển về bản nháp” và câu trạng thái nêu nguyên nhân cụ thể.

## Verification

**Commands:**
- `pnpm --filter web typecheck` -- không có lỗi TypeScript.
- `pnpm --filter web lint` -- không có lint warning/error.
- `pnpm --filter web test` -- toàn bộ unit test web thành công.
- `pnpm --filter web test:e2e` -- các flow UI desktop/mobile liên quan thành công trong môi trường Playwright đã cấu hình.

**Manual checks (if no CLI):**
- So sánh các trang ở 1440px và 390px; kiểm tra hierarchy, overflow bảng, dialog, focus keyboard và câu chữ trong loading/error/empty state.

## Suggested Review Order

**Bố cục và responsive**

- Điểm vào chính của hệ layout: container, toolbar, trạng thái và breakpoint mobile.
  [`index.css:130`](../../apps/web/src/index.css#L130)

- Toolbar hóa đơn gán vai trò co giãn theo chức năng thay vì vị trí.
  [`page.tsx:166`](../../apps/web/src/features/invoices/page.tsx#L166)

**Microcopy và trạng thái dữ liệu**

- Thông tin lịch sử hóa đơn bỏ thuật ngữ kỹ thuật nhưng giữ nghĩa snapshot.
  [`detail-page.tsx:104`](../../apps/web/src/features/invoices/detail-page.tsx#L104)

- Danh sách học sinh thống nhất “tên gọi” và phân biệt rỗng với không khớp.
  [`page.tsx:31`](../../apps/web/src/features/students/page.tsx#L31)

- Lớp không có dữ liệu và lớp không khớp bộ lọc có hướng xử lý khác nhau.
  [`classes/page.tsx:21`](../../apps/web/src/features/classes/page.tsx#L21)

- Tài khoản nhận tiền áp dụng cùng quy tắc empty state.
  [`bank-accounts/page.tsx:14`](../../apps/web/src/features/bank-accounts/page.tsx#L14)

**Bằng chứng kiểm chứng**

- E2E đo hierarchy chiều rộng toolbar trên desktop và giữ kiểm tra mobile.
  [`invoices.spec.ts:37`](../../apps/web/e2e/invoices.spec.ts#L37)

- Unit test khóa các nhãn lịch sử hóa đơn đã biên tập.
  [`detail-page.test.tsx:35`](../../apps/web/src/features/invoices/detail-page.test.tsx#L35)

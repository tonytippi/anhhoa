---
title: 'Tổ chức lại mockup theo portal'
type: 'refactor'
created: '2026-09-07'
status: 'done'
baseline_commit: '94910e0bb1692b884fad4c6f9e8d06efefb17856'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/MOCKUP-COVERAGE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Các mockup Admin/Nhân viên, Phụ huynh và Vận hành nền tảng nằm lẫn ở thư mục gốc `mockups/`; riêng roster đã ở `mockups/admin/roster/`. Cấu trúc này không phản ánh portal sở hữu và khó tìm màn hình khi review.

**Approach:** Tổ chức toàn bộ HTML theo portal: Admin vào `mockups/admin/`, Phụ huynh vào `mockups/parent/`, Vận hành nền tảng vào `mockups/ops/`. Giữ `review.html` và tài nguyên dùng chung tại `mockups/`, giữ roster ở `mockups/admin/roster/`, rồi cập nhật toàn bộ liên kết runtime và tài liệu tham chiếu.

## Boundaries & Constraints

**Always:** Giữ nguyên nội dung, hành vi và phạm vi từng mockup; `prototype.css` và `prototype.js` tiếp tục ở `mockups/` vì được tất cả portal và Review dùng chung; `admin-shell.js` tiếp tục ở `mockups/admin/`; mọi link giữa portal, link từ review và đường dẫn tài liệu phải trỏ đến vị trí mới; các trang phải còn mở được trực tiếp qua `file://` và VS Code Preview.

**Ask First:** Di chuyển `review.html` hoặc tài nguyên dùng chung ra khỏi `mockups/`; thay đổi nội dung hoặc giao diện mockup trong quá trình tổ chức lại.

**Never:** Không thay đổi UX contract, navigation/capability, dữ liệu mô phỏng, lifecycle tài chính hoặc các constraint security; không thêm redirect, build step, framework hay phụ thuộc mạng để tương thích path mới.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Mở trang Admin trực tiếp | Một HTML Admin đã chuyển vào `mockups/admin/` | CSS, script shell và script chung nạp được qua đường dẫn tương đối; sidebar/header/render dialog giữ nguyên. | Không có request runtime hoặc phụ thuộc web server. |
| Mở trang Parent hoặc Ops trực tiếp | Một HTML dưới `mockups/parent/` hoặc `mockups/ops/` | `prototype.css` và `prototype.js` được nạp qua `../`; nội dung, hash navigation và dialog giữ nguyên. | Không có request runtime hoặc phụ thuộc web server. |
| Điều hướng trong Admin | Trang workspace, finance hoặc roster render `admin-shell.js` | Mọi destination Admin trỏ đúng tệp mới; route roster vẫn dùng độ sâu path phù hợp và có đúng một link active. | Route không nhận diện không active link nào nhưng vẫn giữ main content. |
| Bắt đầu từ review/tài liệu | Reviewer mở `review.html` hoặc link Markdown tới mockup | Entry point và path/anchor dẫn đến thư mục portal tương ứng. | Không để lại link tới HTML portal cũ ở gốc `mockups/`. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin-staff.html` -- workspace Admin cần chuyển thành `admin/admin-staff.html`; asset shared đổi thành `../prototype.css` và `../prototype.js`, shell cùng cấp, link roster thành `roster/roster.html`.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/receivable-configuration.html` -- mockup khoản thu cần chuyển vào Admin và đổi ba asset references; finance links cùng cấp giữ nguyên.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/invoice-generation.html` -- mockup đợt thu cần chuyển vào Admin và đổi ba asset references; finance links cùng cấp giữ nguyên.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/invoice-detail-review.html` -- mockup rà soát hóa đơn cần chuyển vào Admin và đổi ba asset references.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin-operational-queue.html` và `finance-run-preview.html` -- mock mốc cũ của Admin cần chuyển vào Admin, chỉ có inbound references cần đổi vì dùng CSS inline.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js` -- `root` cho route `roster` phải đổi từ `../../` thành `../`; destination Danh bộ từ Admin root đổi thành `roster/roster.html`.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/*.html` -- đã ở đúng vị trí; giữ `../../prototype.css`, `../admin-shell.js`, `../../prototype.js`.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/parent.html`, `parent-home.html`, `parent-inbox.html` -- chuyển thành `parent/<tên-tệp>` và đổi asset shared thành `../prototype.css`, `../prototype.js`; nội dung/hash nội bộ giữ nguyên.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/ops.html` -- chuyển thành `ops/ops.html` và đổi asset shared thành `../prototype.css`, `../prototype.js`.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/review.html` -- entry point đổi sang `admin/admin-staff.html`, `parent/parent.html` và `ops/ops.html`.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` và `EXPERIENCE.md` -- chuẩn hóa inventory, asset guidance và legacy paths sang cấu trúc mới.
- `_bmad-output/implementation-artifacts/spec-mockup-goi-nop-truoc.md`, `spec-mockup-danh-bo-chi-tiet.md`, `spec-tach-shell-mockup-admin.md`, `spec-mockup-tai-chinh-chi-tiet.md`, `spec-viet-hoa-mockup-passionedu.md` -- cập nhật path text và Markdown links đã ghi nhận mockup portal; không thay đổi frozen intent.

## Tasks & Acceptance

**Execution:**
- [x] `.../mockups/admin/` -- Di chuyển sáu HTML Admin còn ở gốc vào thư mục này -- tạo một nơi chứa duy nhất cho toàn bộ mockup Admin.
- [x] `.../mockups/admin/admin-staff.html`, `receivable-configuration.html`, `invoice-generation.html`, `invoice-detail-review.html` -- Điều chỉnh asset và navigation relative paths sau di chuyển -- bảo toàn việc mở trực tiếp và luồng Admin.
- [x] `.../mockups/admin/admin-shell.js` -- Điều chỉnh base path của roster và destination Danh bộ -- giữ navigation shell đúng ở mọi độ sâu thư mục.
- [x] `.../mockups/parent/` -- Di chuyển ba HTML Parent vào thư mục này và đổi asset relative paths -- thống nhất sở hữu portal mà không đổi nội dung.
- [x] `.../mockups/ops/ops.html` -- Di chuyển mockup Ops và đổi asset relative paths -- thống nhất cấu trúc portal.
- [x] `.../mockups/review.html`, `MOCKUP-COVERAGE.md`, `EXPERIENCE.md` -- Cập nhật entry point, inventory và đường dẫn UX -- tránh documentation/runtime link cũ.
- [x] `_bmad-output/implementation-artifacts/spec-*.md` được nêu trong Code Map -- Cập nhật các path/reference mockup portal -- giữ artifacts reviewable sau tái tổ chức.

**Acceptance Criteria:**
- Given reviewer duyệt thư mục `mockups/`, when tìm một màn hình portal, then mọi HTML Admin, Parent và Ops lần lượt nằm dưới `mockups/admin/`, `mockups/parent/` và `mockups/ops/`; Admin bao gồm finance, workspace, legacy và roster.
- Given một trang Admin bất kỳ được mở bằng `file://` hoặc VS Code Preview, when tài liệu tải, then stylesheet, shell và dialog script cần thiết vẫn hoạt động mà không cần server.
- Given một trang Parent hoặc Ops được mở bằng `file://` hoặc VS Code Preview, when tài liệu tải, then stylesheet và dialog script dùng chung vẫn hoạt động mà không cần server.
- Given navigation render từ workspace, finance hoặc roster, when reviewer chọn destination Admin, then URL tương đối mở đúng tệp trong `mockups/admin/` và active route không thay đổi.
- Given reviewer bắt đầu ở `review.html` hoặc lần theo tài liệu UX/implementation, when chọn mockup portal, then không có link còn trỏ đến HTML portal cũ ở gốc `mockups/`.

## Design Notes

Giữ asset chia sẻ và entry point review tại gốc để tất cả portal chỉ cần quay lên một cấp. `admin-shell.js` được đánh giá path theo URL trang đang mở: trang trực tiếp dưới `admin/` dùng các đích cùng cấp, còn roster sâu hơn một cấp phải quay lên `../` trước khi đi tới Admin root.

## Verification

**Commands:**
- `git diff --check` -- expected: không có lỗi whitespace.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js` -- expected: shell hợp lệ.
- `! rg -n 'href="(admin-staff|receivable-configuration|invoice-generation|invoice-detail-review|admin-operational-queue|finance-run-preview|parent|parent-home|parent-inbox|ops)\.html' _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/*.html` -- expected: không còn inbound HTML link cũ tại root.

**Manual checks:**
- Mở `mockups/review.html`, vào workspace Admin rồi lần lượt kiểm tra Khoản thu, Đợt thu, Rà soát hóa đơn và Danh bộ.
- Mở một trang roster trực tiếp, kiểm tra sidebar dẫn tới các trang Admin root và asset shared vẫn tải đúng.
- Mở `mockups/parent/parent.html` và `mockups/ops/ops.html` trực tiếp, kiểm tra CSS, dialog và hash navigation vẫn hoạt động.

## Suggested Review Order

**Điểm vào portal**

- Các entry point đưa reviewer vào đúng thư mục portal.
  [`review.html:15`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/review.html#L15)

- Inventory mô tả cấu trúc, tài nguyên chung và ngoại lệ legacy.
  [`MOCKUP-COVERAGE.md:3`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md#L3)

**Điều hướng Admin**

- Shell phân biệt chính xác trang Admin root và roster sâu hơn.
  [`admin-shell.js:7`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js#L7)

- Workspace Admin dùng tài nguyên shared ở parent directory.
  [`admin-staff.html:1`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-staff.html#L1)

**Portal độc lập**

- Parent quay lên một cấp để dùng stylesheet và hành vi chung.
  [`parent.html:1`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/parent/parent.html#L1)

- Ops dùng cùng quy ước path của Parent.
  [`ops.html:1`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/ops/ops.html#L1)

**Tài liệu theo dõi**

- Đường dẫn tham chiếu trong UX theo cấu trúc portal mới.
  [`EXPERIENCE.md:34`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md#L34)

- Navigation legacy được ghi nhận riêng để xử lý ở scope sau.
  [`deferred-work.md:4`](deferred-work.md#L4)

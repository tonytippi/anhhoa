---
title: 'Chuẩn hóa UX mockup Tài chính'
type: 'refactor'
created: '2026-09-07'
status: 'done'
baseline_commit: '77ba9af5b10056f3fbf1cd80a6d131d7c365d901'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/specs/spec-passionedu/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Các mockup Tài chính đang lộ mã nội bộ, trạng thái tiếng Anh và diễn giải implementation dài trên bề mặt mặc định. Điều này khiến thao tác quản lý khó quét và không tuân theo UX spine vừa cập nhật.

**Approach:** Chuẩn hóa bốn mockup Tài chính thành giao diện tiếng Việt ngắn gọn, table-first và chỉ hiển thị fact nghiệp vụ cần cho thao tác. Mã đối soát, API/lifecycle và chi tiết kỹ thuật được ẩn khỏi bề mặt mặc định nhưng các ràng buộc server-authoritative, exact settlement và immutable snapshot vẫn giữ bằng copy ngắn hoặc disclosure phù hợp.

## Boundaries & Constraints

**Always:** Giữ shell Admin, links, HTML static direct-open và tất cả số tiền VND nguyên. Hiển thị trạng thái bằng tiếng Việt: Nháp, Sẵn sàng, Đã tạo, Đã phát hành, Đã thanh toán, Đã hủy, Đang hoạt động, Ngừng áp dụng. Bảng hiện có cho khoản thu, preview, dòng hóa đơn và nộp trước được giữ table-first; cột/action dùng nhãn ngắn. Các mã `AH-*`, `CR-*`, `MH-*`, `OP-*`, `CAL-*`, `RULE-*`, `LINE-*`, `BANK-*`, `PP-*`, `RCPT-*`, `ALLOC-*`, `SPC-*`, `OBL-*` không hiện mặc định. Khi cần đối soát, dùng disclosure chỉ đọc `Thông tin đối soát`, không đặt mã vào heading/bảng thao tác. Giữ các link `invoice-generation.html`, `invoice-generation.html#prepaid`, `receivable-configuration.html` và shell route `receivables`/`runs`/`invoice-review`.

**Ask First:** Đổi PRD, lifecycle, finance policy, yêu cầu audit, API/quyền, amount computation, settlement logic hoặc thêm cột/chức năng quản lý mới.

**Never:** Không làm UI gợi ý trình duyệt tự tính tiền, tự phát hành/thanh toán hóa đơn hoặc retry trước khi kiểm tra kết quả; không biến nộp trước thành lựa chọn Parent; không xóa thông tin cần thiết về hóa đơn đã chốt, thanh toán đủ theo một học sinh, quyền quản trị viên trường và program ngừng áp dụng.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Quản lý khoản thu | Finance mở Khoản thu | Bảng nhóm, tên khoản thu, đơn vị, đơn giá, trạng thái và action tiếng Việt ngắn. | Rule/hóa đơn đã chốt và program ngừng dùng có ghi chú ngắn, không dùng mã kỹ thuật. |
| Xem trước/tạo đợt thu | Đợt thu tháng 09 | Bảng học sinh, khoản thu, nợ cũ, tổng và lý do bỏ qua hiển thị bằng tiếng Việt. | Nếu chưa có kết quả tạo, UI yêu cầu kiểm tra trạng thái thao tác trước khi gửi lại. |
| Rà soát hóa đơn | Hóa đơn nháp hoặc đã phát hành | Bảng dòng tiền, tài khoản nhận tiền và nộp trước dùng nhãn nghiệp vụ; mã chỉ trong disclosure đối soát. | Hóa đơn đã phát hành là chỉ đọc; payment chỉ cho đúng học sinh và đúng toàn bộ số tiền. |
| Nộp trước | Quản trị viên trường mở luồng nộp trước | Program, kỳ, ưu đãi và khoản thu hiển thị tiếng Việt; Parent không có action. | Program ngừng áp dụng, sai phạm vi hoặc thanh toán chưa đủ không tạo quyền miễn thu. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html` -- đã có list table-first; rút các `data-action-*` và copy còn kỹ thuật, ẩn mã tham chiếu trong rule/notice nếu còn.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html:14-82` -- Việt hóa lifecycle/preview/nộp trước, ẩn mã học sinh/đợt/phiên bản/lịch và rút Operation guidance.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-detail-review.html:14-77` -- Việt hóa review/issue/nộp trước, giữ bảng và exact settlement; chuyển mã đối soát khỏi bề mặt mặc định.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/finance-run-preview.html:2` -- legacy preview cần ẩn mã học sinh và state tiếng Anh, giữ bảng và copy đối soát ngắn.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md:17-19` -- cập nhật mô tả nếu naming/copy thay đổi.

## Tasks & Acceptance

**Execution:**
- [x] `.../admin/receivable-configuration.html` -- Chuẩn hóa copy còn lại và mã kỹ thuật -- hoàn thiện catalog tiếng Việt ngắn.
- [x] `.../admin/invoice-generation.html`, `invoice-detail-review.html`, `finance-run-preview.html` -- Việt hóa bề mặt mặc định, ẩn internal IDs và rút helper text -- làm luồng Tài chính dễ quét nhưng giữ finance boundaries.
- [x] `.../mockups/MOCKUP-COVERAGE.md` -- Đồng bộ mô tả screens nếu cần -- giữ review inventory đúng.

**Acceptance Criteria:**
- Given Finance Manager mở bất kỳ mockup Tài chính nào, when quét title, status, bảng và action, then tất cả copy mặc định là tiếng Việt ngắn, không có mã nội bộ hoặc lifecycle/API tiếng Anh.
- Given reviewer cần thông tin technical để đối soát, when mở disclosure tương ứng, then mã tham chiếu vẫn có thể xem nhưng không chen vào bảng/hành động mặc định.
- Given luồng đợt thu, phát hành hay nộp trước, when timeout, inactive program, issued snapshot hoặc settlement xuất hiện, then UI vẫn nêu rõ hành động an toàn/ngăn chặn cần thiết mà không dùng jargon kỹ thuật.
- Given viewport hẹp, when bảng Tài chính không đủ ngang, then định danh nghiệp vụ, VND và trạng thái vẫn có horizontal-scroll treatment hiện có.

## Design Notes

Copy tài chính dùng ngôn ngữ thao tác: `Xem trước`, `Tạo hóa đơn`, `Đã phát hành`, `Đã thanh toán`, `Tất toán đủ`, `Thông tin đối soát`. Mã kỹ thuật là dữ liệu audit, không phải label người dùng. Giữ card cho tổng, cảnh báo và xác nhận; dùng bảng cho các tập bản ghi so sánh được.

## Verification

**Commands:**
- `git diff --check` -- expected: không có lỗi whitespace.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: JavaScript chung hợp lệ.
- `npx --yes html-validate _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-detail-review.html _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/finance-run-preview.html` -- expected: HTML hợp lệ.

**Manual checks:**
- Mở từng mockup Tài chính từ sidebar/review, kiểm tra link, status và table copy không lộ mã nội bộ hoặc tiếng Anh mặc định.
- Kiểm tra các notice nộp trước, phát hành và thanh toán đủ vẫn hướng dẫn hành động an toàn bằng tiếng Việt ngắn.

## Suggested Review Order

**Đợt thu**

- Xem trước dùng shared Admin shell, bảng và hành động tạo an toàn.
  [`finance-run-preview.html:13`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/finance-run-preview.html#L13)

- Luồng tạo hiển thị lý do bỏ qua và điều kiện đóng đợt thu ngắn gọn.
  [`invoice-generation.html:14`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html#L14)

**Hóa đơn và nộp trước**

- Rà soát hóa đơn giữ bảng dòng tiền và điều chỉnh có lý do.
  [`invoice-detail-review.html:14`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-detail-review.html#L14)

- Nộp trước chỉ áp dụng sau thanh toán đủ và giữ thông tin đã chốt.
  [`invoice-detail-review.html:30`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-detail-review.html#L30)

**Khoản thu**

- Catalog dùng bảng, nhãn ngắn và trạng thái nộp trước rõ ràng.
  [`receivable-configuration.html:14`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html#L14)

---
title: 'Thiết kế lại mockup Khoản thu'
type: 'refactor'
created: '2026-09-07'
status: 'done'
baseline_commit: '77ba9af5b10056f3fbf1cd80a6d131d7c365d901'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-passionedu/SPEC.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Mockup `Khoản thu` đang trình bày catalog, rule giá, giảm giá, chương trình nộp trước và coverage trong ba khối dọc. Người quản trị khó nhanh chóng trả lời khoản thu nào đang hoạt động, thuộc nhóm nào, có đơn giá/rule nào và cần thao tác gì.

**Approach:** Thiết kế lại màn hình thành danh sách khoản thu dễ quét, tham khảo cấu trúc chức năng của Kidsonline trong ảnh cung cấp: header, thêm mới, tìm kiếm, lọc, nhóm, đơn vị, đơn giá và action theo dòng. Đây là nguồn cảm hứng về khả năng quét danh sách, không sao chép giao diện, thương hiệu hay contract nghiệp vụ Kidsonline.

## Boundaries & Constraints

**Always:** Giữ shell Admin/Nhân viên, sidebar `Khoản thu` active, School/Năm học hiện hành, link tới `invoice-generation.html` và `invoice-generation.html#prepaid`. Danh sách chính phải group theo `ReceivableGroup` và có tìm kiếm, lọc Nhóm/Trạng thái/Loại tính, sort, count và clear filters ở dạng mockup; mỗi dòng hiển thị Khoản thu/mã, đơn vị-loại tính, đơn giá rule hiện hành do máy chủ trả về, rule/precedence, hiệu lực, trạng thái, audit và action bằng văn bản. Dùng VND nguyên căn phải; ghi rõ đơn giá là giá mặc định/rule hiện hành cho kỳ mới, không phải tổng invoice hay client-calculated value. Rule/discount mở theo một khoản thu phải thể hiện scope, precedence, hiệu lực, audit và không sửa snapshot đã issued. Giữ `PrepaidPaymentPromotionProgram` là view/section phụ tách khỏi catalog, chỉ School Admin có entry tạo source, coverage/refund chỉ đọc và CTA chuyển sang luồng PREPAID hiện có.

**Ask First:** Thay đổi DESIGN/EXPERIENCE/PRD hoặc finance lifecycle; thêm hành vi thực, query persistence, API, quyền mới, bulk action, import/export, VAT/tax hay mô hình giá/quy tắc mới.

**Never:** Không sao chép visual identity, copy, icon hoặc interaction của Kidsonline; không biến catalog thành invoice template, không tự tính phí từ attendance/handover/service enrollment, không để Parent chọn nộp trước, không đưa action client đổi state Invoice/settlement, không tạo discount dòng âm/credit không định danh, và không dùng School context/browser state làm authorization.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Danh sách mặc định | Finance Manager mở route Khoản thu | Các group khoản thu, result count, đơn giá VND hiện hành, rule summary, hiệu lực, trạng thái và audit đọc được trong một bảng chính. | Notice xác nhận list/filter/version do máy chủ trả về; không có tổng client-calculated. |
| Lọc và tìm | Tên/mã, Nhóm, Trạng thái hoặc Loại tính | Toolbar thể hiện tiêu chí, count kết quả và nút xóa filter; mockup nói rõ implementation giữ state trong URL. | Empty/loading/error/không có quyền có copy rõ và không biến dữ liệu cũ thành kết quả có thẩm quyền. |
| Xem rule khoản thu | Reviewer mở chi tiết Học phí tháng | Rule School/Class/Student hiện precedence, ngày hiệu lực, VND, DiscountPolicy và audit; snapshot invoice đã issued giữ read-only. | Rule cùng precedence hoặc phạm vi/hiệu lực không hợp lệ là lỗi máy chủ, không tự resolve tại trình duyệt. |
| Nộp trước | Reviewer chuyển section Program nộp trước | Program active/inactive, receivable, fixed term, giảm giá gốc và audit tách khỏi catalog; CTA mở đúng source flow. | Program inactive/overlap/context sai bị server từ chối; coverage chỉ xuất hiện sau exact settlement. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html:14-45` -- thay ba khối bảng dọc bằng route header, toolbar/list grouped, disclosure rule và section PREPAID phụ; giữ asset, route và outbound links hiện có.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js:17-20,34-36` -- chỉ đọc: giữ canonical route `receivables`, active navigation, skip link và School header.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html:15-20,58-75` -- chỉ đọc: destination cho CTA tạo đợt thu và source PREPAID; không kéo preview/generation vào list.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.css` -- tái dùng `.route-head`, `.button`, `.filters`, `.filter`, `.table-wrap`, `.money`, `.badge`, `.notice`, `.summary`, `.card`; chỉ thêm CSS tối thiểu nếu component hiện có không đủ.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- chỉ đọc: giữ dialog, focus, idempotency/Operation reconciliation và School-switch guard; không optimistic-update hàng danh sách.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md:17-19` -- cập nhật mô tả Khoản thu phản ánh list catalog có thể quét và ranh giới rule/program/run.

## Tasks & Acceptance

**Execution:**
- [x] `.../mockups/admin/receivable-configuration.html` -- Thiết kế lại thành danh sách `Receivable` grouped, toolbar và states tĩnh -- ưu tiên quét nhanh catalog trước chi tiết rule.
- [x] `.../mockups/prototype.css` -- Không cần bổ sung style: `table-wrap`, toolbar, card, button hiện có đã đáp ứng responsive/disclosure/action và giữ visual language hiện hữu.
- [x] `.../mockups/MOCKUP-COVERAGE.md` -- Mô tả list Khoản thu và section nộp trước tách biệt -- giữ tài liệu review đúng scope.

**Acceptance Criteria:**
- Given Finance Manager mở Khoản thu, when nhìn màn hình không cuộn sâu, then thấy CTA thêm, CTA tạo đợt thu, search/filter/group/sort, result count và danh sách khoản thu grouped.
- Given một dòng khoản thu, when reviewer quét bảng, then nhận biết được mã, nhóm, loại tính/đơn vị, giá VND do server trả về, rule, hiệu lực, trạng thái, audit và action không chỉ dựa vào icon/màu.
- Given reviewer mở chi tiết rule hoặc section nộp trước, when xem dữ liệu, then catalog/rule/program/coverage tách ranh giới và vẫn tuân thủ server-authoritative, immutable snapshot, exact settlement và School Admin-only source creation.
- Given viewport hẹp, when bảng thiếu ngang, then table treatment giữ được tên/mã, VND và trạng thái; action vẫn keyboard-reachable.

## Design Notes

Màn hình ưu tiên câu hỏi vận hành “có khoản gì và dùng được không” trước câu hỏi cấu hình sâu. Cột giá không đại diện giá invoice mà là rule hiệu lực cho phạm vi đang chọn; rule detail giải thích precedence thay vì lặp toàn bộ rule ở bảng chính. Program nộp trước vẫn nằm cùng route để reviewer thấy quan hệ với receivable, nhưng tách view để không bị hiểu như khoản thu định kỳ hoặc quyền chọn Parent.

## Verification

**Commands:**
- `git diff --check` -- expected: không có lỗi whitespace.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: JavaScript chung vẫn hợp lệ.
- `rg -n 'invoice-generation\.html(#prepaid)?|data-admin-route="receivables"|Tìm tên hoặc mã khoản thu|Không có khoản thu|Không có quyền' _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html` -- expected: route, CTA và list states xuất hiện.

**Manual checks:**
- Mở `mockups/admin/receivable-configuration.html` ở desktop và viewport hẹp; kiểm tra list scan, disclosure, action, trạng thái và CTA finance.
- Mở từ sidebar Khoản thu và quay lại Đợt thu/Nguồn PREPAID; kiểm tra active route, links và shell không đổi.

## Suggested Review Order

**Catalog quét nhanh**

- Header giải thích ranh giới giá và đặt CTA vận hành chính.
  [`receivable-configuration.html:14`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html#L14)

- Toolbar minh họa query URL, trạng thái sắp xếp và filter catalog.
  [`receivable-configuration.html:28`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html#L28)

- Bảng grouped ưu tiên mã, VND, rule, hiệu lực, audit và action có nhãn.
  [`receivable-configuration.html:44`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html#L44)

**Ranh giới tài chính**

- Disclosure rule giải thích scope, precedence, discount và snapshot immutable.
  [`receivable-configuration.html:99`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html#L99)

- PREPAID tách khỏi catalog và gate theo capability School Admin.
  [`receivable-configuration.html:114`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html#L114)

**Tài liệu coverage**

- Ma trận mockup ghi nhận catalog list, history và reconciliation mới.
  [`MOCKUP-COVERAGE.md:17`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md#L17)

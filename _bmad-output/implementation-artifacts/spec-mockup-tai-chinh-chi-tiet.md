---
title: 'Mockup chi tiết luồng tài chính PassionEdu'
type: 'feature'
created: '2026-09-07'
status: 'done'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Mockup Admin hiện chỉ trình bày tóm tắt cho các phần tài chính quan trọng, chưa đủ chi tiết để review cách cấu hình khoản thu, tạo hóa đơn và rà soát hóa đơn trước khi phát triển.

**Approach:** Tạo ba trang mockup HTML độc lập, dùng chung design system hiện có và liên kết từ Admin/Nhân viên: cấu hình khoản thu và `StudentPromotionalCoverage`, tạo hóa đơn nháp qua đợt thu và rà soát hóa đơn theo lifecycle. Các trang mô phỏng dữ liệu do máy chủ trả về, không tạo trạng thái tài chính phía trình duyệt.

## Boundaries & Constraints

**Always:** Hiển thị rõ Trường, năm học và kỳ thu trong mọi heading tài chính; dùng tiếng Việt có dấu; tiền VND nguyên; mọi tổng, trạng thái, điều kiện, preview và thứ tự ưu tiên phải được ghi rõ là do máy chủ xác nhận. Dùng lifecycle Đợt thu `DRAFT → READY → GENERATED → CLOSED`, Invoice `DRAFT`, `ISSUED`, `PAID`, `VOIDED`, và không mô phỏng partial payment. Phần `StudentPromotionalCoverage` phải cho thấy Học sinh, năm học, các cặp khoản thu-kỳ được chọn, service interval, giá/giảm giá snapshot, lý do, kết quả overlap/eligibility và trạng thái chờ Invoice nguồn tất toán đủ; nó không phải catalog định kỳ và Parent không được chọn. Liên kết từ Admin/Nhân viên phải mở được từng mockup mới và có đường quay lại luồng tài chính liên quan.

**Ask First:** Bất kỳ thay đổi nào đối với DESIGN.md, EXPERIENCE.md, PRD, lifecycle tài chính, quy tắc settlement chính xác hoặc thêm hành động tài chính ngoài contract hiện có.

**Never:** Không hiển thị tổng tiền do trình duyệt tự tính như authoritative; không đưa nút để client tự đổi Invoice sang đã thanh toán; không dùng query/UUID như bằng chứng quyền; không thêm catalog ưu đãi cho Parent, partial/unallocated/mixed-Student receipt, tự động tính phí attendance/handover, hoặc thay đổi mock mốc cũ.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cấu hình khoản thu | Finance Manager trong Trường Ánh Hoa | Danh mục, phạm vi, ngày hiệu lực, trạng thái và thứ tự ưu tiên được trình bày bằng tiếng Việt. | Rule cùng mức ưu tiên hiển thị là bị từ chối do máy chủ xác nhận. |
| Ưu đãi nộp nhiều kỳ | `StudentPromotionalCoverage` đang chờ nguồn thanh toán đủ | Hiển thị từng Học sinh, khoản thu-kỳ, khoảng dịch vụ, snapshot giá/giảm giá, lý do và nguồn Invoice/Receipt. | Overlap, kỳ không đủ điều kiện hoặc số ngày hoạt động không dương bị máy chủ từ chối; chưa có nguồn tất toán đủ thì chưa phát hành coverage. |
| Xem trước đợt thu | Đợt thu `READY` tháng 09/2026 | Có phạm vi, điều kiện, skip categories, nợ cũ, tổng VND, thời điểm và phiên bản tính. | Preview cũ/không hợp lệ dẫn về sửa cấu hình hoặc tải lại preview. |
| Tạo hóa đơn nháp | Xác nhận tạo từ `READY` | Dialog nêu Trường, kỳ, số lượng và tổng máy chủ tính; kết quả dẫn đến hóa đơn nháp. | Timeout khóa gửi lại và yêu cầu đối soát thao tác trước retry. |
| Rà soát hóa đơn | Hóa đơn `DRAFT` | Các dòng, override/adjustment có lý do, tổng do máy chủ tính và hành động phát hành được hiển thị. | Trạng thái lock/validation giữ dữ liệu server trả về, không tự cập nhật cục bộ. |
| Hóa đơn đã phát hành | Hóa đơn `ISSUED` | Snapshot nghĩa vụ, ngân hàng và nội dung chuyển khoản bị khóa; chỉ dẫn về Thu tiền/Công nợ. | Không có action đổi trạng thái thanh toán hoặc sửa dòng hóa đơn. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin-staff.html` -- Shell Admin/Nhân viên và các điểm điều hướng tài chính cần liên kết trang mới.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.css` -- Token, shell, table, stepper, dialog và responsive treatment dùng chung.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- Dialog xác nhận và đối soát thao tác có thể tái dùng, không tự đổi state finance.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` -- Ma trận màn hình được cập nhật để chỉ ra ba mockup tài chính chuyên biệt.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md` -- Contract luồng CollectionRun, Invoice, settlement và lifecycle; chỉ đọc.

## Tasks & Acceptance

**Execution:**
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/receivable-configuration.html` -- Tạo mockup cấu hình danh mục, khoản thu, giảm giá, quy tắc tính, `StudentPromotionalCoverage` nhiều kỳ và trạng thái hiệu lực -- cho phép review trước các inputs tạo invoice.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/invoice-generation.html` -- Tạo mockup wizard đợt thu từ cấu hình đến preview và confirmation tạo nháp -- làm rõ server-authoritative calculation và idempotent reconciliation.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/invoice-detail-review.html` -- Tạo mockup rà soát `DRAFT` và snapshot `ISSUED` khóa -- review được issue boundary và handoff sang thu tiền.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin-staff.html` -- Liên kết sidebar, tóm tắt tài chính và kết quả đợt thu đến mockup riêng -- cho phép đi qua flow từ workspace hiện tại.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` -- Bổ sung coverage và entry point cho các mockup tài chính -- giữ tài liệu review đúng phạm vi.

**Acceptance Criteria:**
- Given người review mở `admin-staff.html`, when chọn Khoản thu, Đợt thu hoặc một hóa đơn nháp, then trang tương ứng mở được với ngữ cảnh Trường hiển thị rõ.
- Given người review mở cấu hình khoản thu, when xem rule/discount/catalog, then trạng thái active/inactive, phạm vi, precedence và giới hạn không tự động tính phí được hiển thị bằng tiếng Việt.
- Given Finance Manager tạo ưu đãi theo nhiều kỳ cho một Học sinh, when chọn các cặp khoản thu-kỳ và khoảng dịch vụ, then mockup hiển thị snapshot giá/giảm giá, lý do, kiểm tra overlap/eligibility và trạng thái chờ nguồn Invoice/Receipt tất toán đủ trước khi coverage được phát hành.
- Given đợt thu `READY`, when xem preview hoặc xác nhận tạo nháp, then tổng/số lượng/lý do skip có ngữ cảnh server và timeout dẫn tới đối soát thao tác trước retry.
- Given hóa đơn `DRAFT` hoặc `ISSUED`, when xem trang rà soát, then chỉ `DRAFT` hiển thị edit/issue review; `ISSUED` giữ snapshot và chỉ dẫn tới Thu tiền/Công nợ, không có partial payment hay client-set status.
- Given mobile/desktop review, when bảng tài chính không đủ chiều ngang, then dữ liệu nhận dạng và số VND vẫn đọc được qua treatment responsive hiện có.

## Design Notes

Mỗi mockup mới dùng shell desktop của Admin/Nhân viên nhưng chỉ tập trung một quyết định tài chính. Trang cấu hình bắt đầu bằng danh mục và các rule đang hiệu lực để phân biệt rule “có thể dùng cho kỳ mới” khỏi snapshot lịch sử; cùng trang có khu vực `StudentPromotionalCoverage` cho ưu đãi theo từng Học sinh, khoản thu-kỳ và khoảng dịch vụ, không biến nó thành gói catalog hay quyền chọn của Parent. Trang tạo hóa đơn lấy preview do máy chủ tính làm trung tâm và coi xác nhận tạo nháp là action rủi ro cần Operation. Trang rà soát đặt dữ liệu invoice line và các snapshot lên trước action phát hành; sau phát hành chỉ còn read-only facts và handoff tới so cai.

## Verification

**Commands:**
- `git diff --check` -- expected: không có lỗi whitespace.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: JavaScript dùng chung vẫn hợp lệ.

**Manual checks:**
- Mở `admin-staff.html`, đi qua tất cả liên kết tài chính mới và quay lại workspace.
- Xem các mockup ở desktop và viewport hẹp để xác nhận bảng finance vẫn đọc được.

## Suggested Review Order

**Ưu đãi và cấu hình**

- Bắt đầu từ danh mục và coverage nhiều kỳ để kiểm tra nguồn dữ liệu tạo hóa đơn.
  [`receivable-configuration.html:1`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/receivable-configuration.html#L1)

**Đợt thu authoritative**

- Kiểm tra wizard, preview, skip categories, nợ cũ và điều kiện đóng đợt thu.
  [`invoice-generation.html:1`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/invoice-generation.html#L1)

**Rà soát và phát hành**

- Kiểm tra boundary nháp/phát hành, snapshot khóa và handoff exact settlement.
  [`invoice-detail-review.html:1`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/invoice-detail-review.html#L1)

**Điểm vào workspace**

- Xác nhận các liên kết từ Admin/Nhân viên đi đúng vào ba mockup chuyên biệt.
  [`admin-staff.html:25`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin-staff.html#L25)

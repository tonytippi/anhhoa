---
title: 'Đồng bộ mockup Finance với gói nộp trước'
type: 'feature'
created: '2026-09-07'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'f3ed3dd13791e97caa1d5cef04de636345bf05ad'
context:
  - '{project-root}/_bmad-output/specs/spec-passionedu/SPEC.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/epics-passionedu.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Mockup Finance hiện diễn tả `StudentPromotionalCoverage` được tạo trực tiếp và Receipt excess chuyển thành `Student Prepayment`. Cách trình bày này mâu thuẫn với contract mới: School cấu hình chương trình nộp trước, School Admin chọn chương trình sau thỏa thuận trực tiếp, và source Invoice của `PREPAID` run phải tất toán chính xác trước khi coverage được phát hành.

**Approach:** Đồng bộ các mockup Finance và điểm vào Admin để reviewer có thể theo dõi trọn luồng chương trình trả trước: cấu hình program, chọn program/tháng bắt đầu, `PREPAID` CollectionRun, source Invoice nhiều kỳ, exact settlement và coverage/refund snapshot. Giữ các mockup là dữ liệu minh họa do máy chủ trả về, không mô phỏng quyền hay tính tiền ở trình duyệt.

## Boundaries & Constraints

**Always:** Dùng tiếng Việt có dấu, VND nguyên, Trường/Năm học/Kỳ rõ ràng và các nhãn xác nhận máy chủ. Program là School-scoped, có active/deactivate, số tháng dương lịch liên tiếp cố định, receivable áp dụng, giảm `%` hoặc VND nguyên trên giá gốc, không cộng dồn `DiscountPolicy`. Chỉ School Admin chọn program active và tháng bắt đầu sau thỏa thuận; thao tác tạo `PREPAID` run, phát hành Invoice và settle source dùng UI xác nhận/Operation reconciliation. Source Invoice có một Student, School, SchoolYear, bao gồm toàn bộ fact tương lai và chỉ issue coverage sau exact Receipt/Allocation. Coverage giữ snapshot program, giá gốc, giảm trừ, service interval, calendar, Invoice/Receipt provenance; thay đổi catalog/lớp/dịch vụ chỉ dẫn tới correction/refund review, không tự chuyển đổi.

**Ask First:** Thay đổi `DESIGN.md`, `EXPERIENCE.md`, product/architecture contract, tạo thêm mockup độc lập ngoài các trang Finance hiện có, hoặc thêm Parent action/hiển thị chi tiết coverage.

**Never:** Không thêm `Student Prepayment`, Receipt excess/generic balance, partial/unallocated/mixed-Student settlement, chọn gói từ Parent, nhập tay số tháng hay mức giảm trên source Invoice, coverage phát hành ngay khi issue Invoice, client-calculated total/eligibility, hay sửa mockup historical ngoài phạm vi liên kết Finance.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cấu hình program | School Admin tạo program 6 tháng active | Hiển thị receivable, kỳ hạn cố định, giảm trên giá gốc, trạng thái/hiệu lực/audit. | Program inactive không chọn được cho source Invoice mới; snapshot cũ không đổi. |
| Tạo nguồn trả trước | Admin chọn program active và tháng 09/2026 cho một Student | Hiển thị `PREPAID` run, các tháng liên tiếp/fact, original price, reduction và tổng server trả về. | Overlap, sai SchoolYear/receivable hoặc client total bị server từ chối. |
| Tất toán nguồn | Source Invoice `ISSUED` có exact outstanding | Receipt/Allocation dẫn tới `PAID`, sau đó issue coverage provenance cho từng fact. | Partial/excess, cross-Student/School/SchoolYear và timeout không tạo coverage; UI đối soát Operation. |
| Đổi dịch vụ hoặc hoàn | Coverage issued, dịch vụ thay đổi hoặc Student rút/chuyển/hủy dịch vụ hợp lệ | Snapshot read-only, đường dẫn correction/refund theo ngày vận hành còn lại. | Không tự chuyển coverage; override/refund hiển thị nguồn và audit policy. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/receivable-configuration.html` -- Trang cấu hình catalog/rule và coverage hiện tại; thay section tạo coverage trực tiếp bằng catalog `PrepaidPaymentPromotionProgram`, giữ provenance read-only.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/invoice-generation.html` -- Wizard ordinary CollectionRun; thêm biến thể/entry `PREPAID` cho Student, program, start month, fixed facts và preview server-authoritative.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/invoice-detail-review.html` -- DRAFT/ISSUED review; thể hiện source Invoice PREPAID, snapshot và coverage chỉ issue sau exact settlement.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin-staff.html` và `mockups/admin/admin-shell.js` -- Điều hướng/CTA Finance cần làm rõ entry chương trình trả trước và source pending settlement.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` -- Ma trận review cần mô tả contract program -> PREPAID -> exact-paid -> coverage.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.css` -- Tái dùng `route-head`, `notice`, `grid`, `table-wrap`, `badge`, `metric`; không tạo visual system mới.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- Tái dùng `data-idempotent-action` cho mock action tạo/chốt prepaid source và reconciliation; tránh action chỉ đổi state cục bộ.

## Tasks & Acceptance

**Execution:**
- [x] `receivable-configuration.html` -- Thay quản lý coverage trực tiếp bằng catalog program và read-only source/coverage provenance -- phản ánh đúng điểm cấu hình và quyền chọn.
- [x] `invoice-generation.html` -- Bổ sung flow `PREPAID` cạnh monthly wizard, với program/start month/fixed facts/server preview -- review được source Invoice nhiều kỳ mà không lẫn ordinary run.
- [x] `invoice-detail-review.html` -- Cập nhật source DRAFT/ISSUED và exact-settlement outcome -- chặn hiểu nhầm issue Invoice là issue coverage.
- [x] `admin-staff.html`, `admin/admin-shell.js`, `MOCKUP-COVERAGE.md` -- Cập nhật entry point và review matrix -- giúp reviewer tìm được luồng và contract mới.
- [x] `prototype.js` nếu cần -- Đưa action mới vào idempotent confirmation/reconciliation pattern -- không mô phỏng finance mutation authoritative ở client.

**Acceptance Criteria:**
- Given reviewer mở cấu hình khoản thu, when xem chương trình trả trước, then thấy program active/inactive, kỳ hạn cố định, receivable, giảm giá gốc và không có form tạo coverage trực tiếp.
- Given School Admin chọn program/start month, when mở preview source, then thấy `PREPAID` run, một Student, các tháng/fact liên tiếp và tổng do máy chủ xác nhận.
- Given source Invoice `ISSUED`, when reviewer xem settle state, then coverage được biểu diễn là chờ exact Receipt/Allocation và chỉ hiện issued provenance sau `PAID`.
- Given amount không exact hoặc context sai, when reviewer xem state/error, then mockup nêu partial/excess/cross-context bị từ chối và hướng dẫn Operation reconciliation.
- Given coverage đã issue, when xem thay đổi dịch vụ hoặc refund, then snapshot bất biến và correction/refund review được trình bày, không auto-convert coverage.

## Design Notes

Không thêm một portal hoặc visual language mới. Dùng cùng shell Finance: catalog program là điểm bắt đầu; `PREPAID` là biến thể CollectionRun có source Invoice riêng; trang Invoice là nơi tách rõ `ISSUED` khỏi `PAID`/coverage issued. Ordinary monthly wizard vẫn giữ skip `COVERED_BY_PROMOTIONAL_COVERAGE` chỉ cho fact đã issued.

## Verification

**Commands:**
- `git diff --check` -- expected: không có lỗi whitespace.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: JavaScript mockup hợp lệ.

**Manual checks:**
- Mở các trang Finance tại desktop và viewport hẹp; xác nhận table/card vẫn đọc được và link Admin đi đúng trang.
- Đi qua program -> PREPAID source -> exact settlement -> issued coverage; xác nhận không có Parent selection, Prepayment hay client-set state.

**Kết quả kiểm tra:** `git diff --check` và `node --check` đã pass. Static audit xác nhận các mock action PREPAID dùng `data-idempotent-action`, không còn form tạo coverage trực tiếp và không còn luồng `Student Prepayment`. Chưa chạy viewport browser do workspace không có browser executable; mockup tái dùng shell, table/card responsive hiện có.

## Suggested Review Order

**Catalog và quyền chọn**

- Bắt đầu từ program để kiểm tra active/deactivate, kỳ hạn và giảm giá gốc.
  [`receivable-configuration.html:34`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/receivable-configuration.html#L34)

- Xác nhận điểm vào Finance dẫn reviewer tới source trả trước.
  [`admin-staff.html:127`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin-staff.html#L127)

**Source Invoice Và Coverage**

- Kiểm tra `PREPAID` run có Student, program, tháng bắt đầu và sáu fact độc lập.
  [`invoice-generation.html:58`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/invoice-generation.html#L58)

- Kiểm tra boundary DRAFT, ISSUED, exact settlement và coverage sau PAID.
  [`invoice-detail-review.html:45`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/invoice-detail-review.html#L45)

**Review Contract**

- Đối chiếu ma trận mockup với chuỗi program đến coverage issued.
  [`MOCKUP-COVERAGE.md:17`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md#L17)

- Xác nhận điều hướng Finance gọi đúng biến thể nộp trước.
  [`admin-shell.js:15`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js#L15)

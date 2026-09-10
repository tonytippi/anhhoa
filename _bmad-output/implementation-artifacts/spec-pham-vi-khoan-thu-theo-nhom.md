---
title: 'Cấu hình phạm vi khoản thu theo nhóm'
type: 'refactor'
created: '2026-09-09'
status: 'in-progress'
baseline_commit: '1b1cfe5260cf023c63f90aa7aa79a22255cfa2da'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-passionedu/SPEC.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Phạm vi áp dụng đang bị đặt thành một tab độc lập. Vì đây là thuộc tính của khoản thu, vị trí đó không khớp luồng tạo/sửa khoản thu. Đồng thời, dịch vụ tự chọn như Học thứ 7 cần phân công riêng theo từng học sinh.

**Approach:** Giữ table Danh sách khoản thu và hiển thị phạm vi áp dụng ngay trên từng dòng. Action Thêm mới hoặc Sửa mở biểu mẫu của chính khoản thu trong tab Danh sách khoản thu. Biểu mẫu chứa thông tin khoản thu, thời gian áp dụng, phạm vi áp dụng và cách tính số lượng. Thêm tab Bảng khoản thu theo lớp, là ma trận theo kỳ/lớp: mỗi hàng là học sinh, mỗi cột là mọi khoản thu đang áp dụng cho lớp, gồm khoản chung Trường, theo Khối, theo Lớp và dịch vụ chọn riêng. Khoản thu theo phạm vi hiển thị chỉ đọc; Kế toán bật hoặc bỏ dịch vụ chọn riêng. Ma trận không đặt giá riêng, không thay khoản thu theo phạm vi và không tự tạo hóa đơn. Phạm vi cho chọn một loại: Toàn trường, Khối, Lớp hoặc Nhóm học sinh. Khối gồm Nhà trẻ/Mẫu giáo; Nhóm học sinh chỉ cho Học thử, Chờ phân lớp, Sắp vào lớp, Trong lớp và Bảo lưu. Nghỉ học/Tốt nghiệp không phải lựa chọn tạo khoản thu mới. Lớp ngoại khóa không thuộc release này.

## Boundaries & Constraints

**Always:** Đây là mockup UX, không tạo API, persistence, entitlement hay data model Khối/nhóm học sinh. Mọi dữ liệu thật vẫn School-scoped và server-authoritative; browser/URL không là authorization. Thể hiện rõ phạm vi được áp dụng cho một khoản thu và thời gian áp dụng; thay đổi không sửa Invoice đã phát hành. Giữ `ChargeRule.quantity` chỉ `FIXED` hoặc `MANUAL`; giá mặc định thuộc Receivable và chỉ override có audit khi Invoice còn `DRAFT`. Toàn trường/Lớp/Phân công theo học sinh khớp contract canonical; Khối và Nhóm học sinh là taxonomy mockup được Product xác định, phải có change contract trước API. Tab Phân công chỉ chọn áp dụng khoản thu tự chọn cho học sinh/kỳ, không đặt giá riêng hay tự tạo Invoice. Nộp trước, giảm trừ, exact settlement và phí đón muộn không đổi.

**Ask First:** Hiện thực backend/DB cho Khối hoặc Nhóm học sinh, thêm loại phạm vi mới ngoài Phân công theo học sinh vào PRD/SPEC, cho phép Nghỉ học/Tốt nghiệp nhận khoản thu mới, đưa Lớp ngoại khóa vào phạm vi, hoặc đổi quantity/price/lifecycle Finance.

**Never:** Không cấu hình giá riêng mặc định theo học sinh, không tự tính tiền, không tạo credit/generic balance/partial settlement, và không sao chép visual identity hoặc copy Kidsonline. Ma trận chỉ dùng để phân công khoản thu tự chọn theo học sinh và kỳ áp dụng.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Mở biểu mẫu | Finance chọn Thêm mới hoặc Sửa Học phí tháng | Hiện biểu mẫu của khoản thu trong tab Danh sách khoản thu, gồm phạm vi áp dụng và cách tính số lượng. | Không ngụ ý cập nhật client-side hay sửa Invoice đã phát hành. |
| Bảng khoản thu theo lớp | Finance chọn kỳ/lớp | Ma trận hiển thị mọi khoản thu áp dụng cho lớp theo từng học sinh; khoản theo phạm vi được đánh dấu chỉ đọc, dịch vụ chọn riêng có thể bật hoặc bỏ. | Đơn giá lấy từ khoản thu; server kiểm tra học sinh, khoản thu, kỳ và không sửa Invoice đã phát hành. |
| Toàn trường | Chọn Toàn trường | Không yêu cầu lựa chọn bổ sung; copy nêu áp dụng theo kết quả server. | Không dùng browser state làm quyền hoặc eligibility. |
| Khối/Lớp | Chọn Khối hoặc Lớp | Hiện lựa chọn Nhà trẻ/Mẫu giáo hoặc danh sách lớp; cho chọn một/nhiều đối tượng. | Server kiểm tra hiệu lực/xung đột khi lưu. |
| Nhóm học sinh | Chọn Nhóm học sinh | Chỉ hiện Học thử, Chờ phân lớp, Sắp vào lớp, Trong lớp, Bảo lưu. | Không hiển thị Nghỉ học/Tốt nghiệp như đối tượng thu mới. |
| Phân công theo học sinh | Chọn loại phạm vi Phân công theo học sinh | Hướng dẫn tới tab Phân công khoản thu để chọn theo kỳ/lớp. | Không đặt giá riêng hoặc tự tạo Invoice ở trình duyệt. |
| Cách tính | Mở tab Cách tính số lượng | Hiện `Cố định`/`Nhập khi lập hóa đơn` và ranh giới giá/override theo Invoice DRAFT. | Không thêm engine tính giá/số lượng tự động. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html:20-65` -- Danh sách catalog, biểu mẫu thêm/sửa khoản thu và bảng khoản thu theo lớp.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js:499-522` -- mở/đóng biểu mẫu ngay trong tab Danh sách khoản thu, không thêm route/API.
- `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs:68-98` -- thay assertions mức riêng/rule thắng bằng four scope types, status exclusions và `FIXED`/`MANUAL` copy.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md:18` -- mô tả phạm vi theo khoản thu và ranh giới mockup-only.

## Tasks & Acceptance

**Execution:**
- [ ] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html` -- đặt phạm vi và cách tính vào biểu mẫu Thêm mới/Sửa; thêm bảng khoản thu theo lớp gồm khoản theo phạm vi và dịch vụ chọn riêng -- tạo góc nhìn đối chiếu toàn bộ khoản thu của học sinh.
- [ ] `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- kiểm tra scope options, exclusions, ma trận toàn bộ khoản thu và không có giá riêng -- ngăn rollback phạm vi hoặc lẫn giá vào phân công.
- [ ] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` -- cập nhật mô tả phạm vi nhóm -- giữ inventory review khớp màn hình.

**Acceptance Criteria:**
- Given Finance mở Danh sách khoản thu, when quét table, then thấy phạm vi áp dụng của từng khoản thu trước khi chọn thao tác.
- Given Finance chọn Thêm mới hoặc Sửa một khoản thu, when biểu mẫu mở, then thấy biểu mẫu của chính khoản thu đó với thông tin, phạm vi áp dụng và cách tính số lượng.
- Given Finance mở Bảng khoản thu theo lớp, when lọc một kỳ và lớp, then thấy ma trận học sinh với mọi khoản thu đang áp dụng cho lớp; chỉ dịch vụ chọn riêng có thể bật hoặc bỏ, không có giá riêng.
- Given Finance chọn Khối, Lớp, Nhóm học sinh hoặc Phân công theo học sinh, when chọn phạm vi, then chỉ các lựa chọn đã chốt hiển thị; Nhóm học sinh không có Nghỉ học/Tốt nghiệp và không có Lớp ngoại khóa.
- Given Finance chọn Toàn trường, when xem form, then không cần chọn học sinh/lớp/nhóm; copy ghi rõ server kiểm tra phạm vi và thời gian áp dụng.
- Given Finance mở Cách tính số lượng, when xem lựa chọn, then chỉ thấy Cố định/Nhập khi lập hóa đơn và không có giá riêng hay tính tự động.
- Given contract test chạy, when đọc mockup, then xác minh được bốn loại phạm vi, exclusions, taxonomy mockup-only và ranh giới Finance không đổi.

## Verification

**Commands:**
- `node _bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- expected: mockup contract checks passed.
- `git diff --check` -- expected: không có lỗi whitespace.
</frozen-after-approval>

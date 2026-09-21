---
title: 'Cấu hình phạm vi khoản thu theo nhóm'
type: 'refactor'
created: '2026-09-09'
status: 'superseded'
baseline_commit: '1b1cfe5260cf023c63f90aa7aa79a22255cfa2da'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-passionedu/SPEC.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Artifact này mô tả rule/scope/matrix để tự động áp khoản thu, nhưng Finance Admin MVP đã được giảm scope theo quyết định 2026-09-21: kế toán chọn khoản và quantity trực tiếp trên Invoice DRAFT.

**Approach:** Superseded. Giữ artifact/mockup chỉ để truy vết Finance automation enhancement; không triển khai theo artifact này trong MVP.

## Boundaries & Constraints

**Always:** Không dùng artifact này làm build input. Finance Admin MVP chỉ quản lý catalog và để Finance chọn Receivable/quantity dương trên Invoice DRAFT; mọi automation scope/rule cần contract mới.

**Ask First:** Bất kỳ khôi phục hoặc triển khai scope/rule/matrix automation nào.

**Never:** Không triển khai từ artifact superseded này.

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
- `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs:68-98` -- historical mockup assertions cho scope/rule automation; không chạy như MVP acceptance.
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

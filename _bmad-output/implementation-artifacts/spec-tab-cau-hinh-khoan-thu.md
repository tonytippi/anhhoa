---
title: 'Chia tab cấu hình Khoản thu'
type: 'refactor'
created: '2026-09-09'
status: 'done'
baseline_commit: '9875211195e31ce661c29942a2c73a4650efc98a'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-passionedu/SPEC.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md'
  - '{project-root}/_bmad-output/implementation-artifacts/decision-late-pickup-server-pricing-2026-09-09.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Route Khoản thu đang dồn catalog, phạm vi, phí đón muộn, phí nộp muộn và chương trình nộp trước theo chiều dọc. Người dùng không thể chuyển trực tiếp giữa các nhóm cấu hình chính theo cấu trúc quen thuộc của Kidsonline; danh sách phạm vi kiểu ma trận Học sinh × Khoản thu có thể tăng vô hạn và khó hiểu.

**Approach:** Chuyển route thành điều hướng hash trong cùng trang với bốn tab: Danh sách khoản thu, Phạm vi khoản thu, Khoản giảm trừ và Phí đón muộn. Danh sách khoản thu là bảng catalog gọn với Thêm mới/Sửa/Ngừng áp dụng. Phạm vi khoản thu là danh sách rule theo khoản thu với bộ lọc Khoản thu/Lớp/Học sinh/Trạng thái, cộng một vùng đối chiếu khi chọn học sinh hoặc lớp để thấy rule thắng cho các khoản thu liên quan. Giữ tab đầu là mặc định, nộp trước là entry phụ từ danh sách khoản thu; không giữ phí nộp tiền muộn như tab vì contract hiện hành chưa có policy fee.

## Boundaries & Constraints

**Always:** Dùng các hash ổn định `#receivables`, `#charge-scopes`, `#discount-policies`, `#late-pickup`, nav link có nhãn và trạng thái active/focus rõ, hỗ trợ deep link/back-forward. Bốn tab chỉ là tổ chức UI: School/Năm học luôn hiển thị; server vẫn là nguồn authorization, VND integer, price, precedence, snapshot, audit và Operation. Danh sách khoản thu là table catalog như Kidsonline: tên/mã, nhóm, đơn vị/đơn giá, hiệu lực, trạng thái, cập nhật và action bằng chữ Thêm mới/Sửa/Ngừng áp dụng; không cần disclosure rule trong table. ChargeRule giữ `SCHOOL`/`CLASS`/`STUDENT`, precedence Học sinh > Lớp > Trường và server rejection. Phạm vi khoản thu phải list rule-first, không dựng cross-product Học sinh × Khoản thu; bộ lọc hẹp danh sách theo khoản thu/lớp/học sinh/trạng thái, còn đối chiếu một học sinh hoặc lớp chỉ trả rule thắng và rule bị che khuất do server xác định. Khoản giảm trừ biểu đạt `DiscountPolicy` có Receivable cụ thể, scope, `%` hoặc VND, hiệu lực, trạng thái/audit và snapshot; không tạo dòng âm/credit. Phí đón muộn giữ policy block/entry point thống kê và browser không tính phí. Nộp trước là link phụ School Admin-only, không stack DiscountPolicy và exact settlement contract không đổi.

**Ask First:** Biến tab thành API/page route riêng, thêm capability/quyền, thay đổi PRD/SPEC/Finance lifecycle, bật fee nộp muộn, hoặc thay decision draft đón muộn thành implementation contract.

**Never:** Không sao chép UI/brand/copy Kidsonline; không dùng hash, URL hay browser state làm bằng chứng authorization; không thêm client calculation, pricing engine, generic balance, partial/excess/unallocated/mixed-Student settlement hoặc sửa Invoice issued.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Mở route | Không có hash hoặc `#receivables` | Tab Danh sách khoản thu visible và active; ba tab khác ẩn. | Catalog state giữ loading/empty/error/no-permission copy. |
| Deep link tab | Mở `#charge-scopes`, `#discount-policies` hoặc `#late-pickup` | Chỉ tab tương ứng visible, heading được focus và nav active. | Hash không nhận diện không tạo state quyền hay dữ liệu cũ. |
| Lọc phạm vi | Finance Manager chọn Khoản thu hoặc Lớp/Học sinh | Thấy danh sách `ChargeRule` thu hẹp với scope, precedence, hiệu lực, đơn giá và audit. | Conflict/overlap do server từ chối, browser không tự resolve. |
| Đối chiếu phạm vi | Finance Manager chọn một học sinh hoặc lớp và kỳ thu | Thấy mỗi khoản thu liên quan một rule thắng do server xác nhận, cùng rule bị che khuất và lý do precedence. | Không trả ma trận toàn bộ học sinh-khoản thu; scope/School vẫn được API kiểm tra. |
| Xem giảm trừ | Finance Manager mở tab Khoản giảm trừ | Thấy policy scope/Receivable/value/effective/status/audit và boundary snapshot/no credit. | Conflict/overlap do server từ chối, browser không tự resolve. |
| Nộp trước | Người dùng ở tab Danh sách khoản thu | Entry phụ dẫn tới source PREPAID; không xuất hiện như tab hoặc lẫn DiscountPolicy. | Capability/settlement vẫn do server enforce. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html:14-145` -- chuyển section dọc thành nav hash và bốn `.route-state`; rút catalog về table/action, thay scope detail theo khoản thu bằng rule-first filter + matching fixture, đổi deferred late-payment thành DiscountPolicy fixture; nộp trước thành entry phụ.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js:344-392` -- tái dùng route-state/hash/focus; chỉ mở rộng active nav nếu chưa tự phản ánh link hash.
- `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs:68-89` -- thay assertion taxonomy cũ và xác minh nav/hash, tab discount cùng late-pickup/prepaid boundaries.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md:18-19,36` -- đổi mô tả bốn vùng theo tab và giữ đường tới thống kê.

## Tasks & Acceptance

**Execution:**
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html` -- thêm điều hướng hash và bốn tab; giữ catalog table gọn/action, tạo scope rule-first với matching fixture, tạo DiscountPolicy fixture và chuyển nộp trước về entry phụ -- giảm cuộn và tránh ma trận Học sinh × Khoản thu.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- đồng bộ active nav/hash route-state nếu cần -- deep link không mất focus hoặc mở nhiều tab.
- [x] `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- kiểm tra route IDs, nav, DiscountPolicy và ranh giới Finance -- ngăn regression về layout dồn/fee engine ngầm.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` -- mô tả tab và ranh giới program/late pickup -- giữ review inventory chính xác.

**Acceptance Criteria:**
- Given Finance Manager mở Khoản thu, when không có hash, then Danh sách khoản thu là tab active duy nhất và link nộp trước vẫn là entry phụ.
- Given reviewer chọn hay deep-link từng hash tab, when tab đổi, then đúng panel visible, focus/active state đồng bộ và nội dung tab khác không còn trong luồng đọc.
- Given Finance Manager mở Danh sách khoản thu, when quét table, then thấy tên/mã, nhóm, đơn vị/đơn giá, hiệu lực, trạng thái, audit và action Thêm mới/Sửa/Ngừng áp dụng mà không phải đọc rule detail.
- Given Finance Manager mở Phạm vi khoản thu, when lọc theo khoản thu, lớp hoặc học sinh, then thấy rule-first list giới hạn theo filter thay vì ma trận toàn bộ Học sinh × Khoản thu.
- Given Finance Manager đối chiếu một học sinh hoặc lớp, when xem các khoản thu liên quan, then mỗi khoản chỉ hiện rule thắng và rule bị che khuất/lý do precedence do server trả về.
- Given reviewer mở Khoản giảm trừ, when xem fixture, then thấy Receivable, scope, `%`/VND, hiệu lực, status/audit, server conflict và không có credit/dòng âm.
- Given reviewer mở Phí đón muộn, when xem policy hoặc mở thống kê, then block/source-server boundary và link thống kê không đổi.
- Given contract test chạy, when đọc mockup, then xác minh được bốn tabs, deep-link, discount boundaries, prepaid riêng và không còn tab phí nộp tiền muộn.

## Verification

**Commands:**
- `node _bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- expected: mockup contract checks passed.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: JavaScript hợp lệ.
- `git diff --check` -- expected: không có lỗi whitespace.
</frozen-after-approval>

## Suggested Review Order

**Tab Và Điều Hướng**

- Bốn panel hash cô lập nội dung và giữ nộp trước ngoài tab.
  [`receivable-configuration.html:20`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html#L20)

- Đồng bộ panel, active state và focus khi deep-link hoặc Back/Forward.
  [`prototype.js:350`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js#L350)

- Trạng thái tab active và focus rõ trên desktop lẫn mobile.
  [`prototype.css:7`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.css#L7)

**Ranh Giới Finance**

- Catalog gọn, rule-first fixture và DiscountPolicy không tạo credit.
  [`receivable-configuration.html:28`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html#L28)

- Contract test khóa hash, precedence, DiscountPolicy và ranh giới prepaid/late-payment.
  [`test-rendered-mockup-contracts.mjs:68`](test-rendered-mockup-contracts.mjs#L68)

**Tài Liệu Rà Soát**

- Inventory phản ánh bốn tab, fixture đối chiếu và nguồn server.
  [`MOCKUP-COVERAGE.md:18`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md#L18)

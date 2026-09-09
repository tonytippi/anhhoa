---
title: 'Làm cứng mockup HTML sau review render'
type: 'bugfix'
created: '2026-09-09'
status: 'done'
baseline_commit: '62f5a76e989158ab5bd31861aebc96b23558a45e'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Bộ mockup PassionEdu hiện render sai trên mobile Admin, hiển thị đồng thời các route/state loại trừ nhau, làm hỏng một số deep link và để các thao tác payroll/thu tiền đi tiếp khi dữ liệu chưa đủ. Các lỗi này khiến mockup không còn là contract đáng tin cậy cho implementation.

**Approach:** Sửa runtime HTML/CSS/JS và fixture liên quan để mỗi route chỉ hiển thị một trạng thái hợp lệ, responsive đúng contract, binding đúng School/Student và các CTA nghiệp vụ được khóa theo điều kiện đã mô tả. Bổ sung kiểm thử hành vi và render lại desktop/mobile.

## Boundaries & Constraints

**Always:** Giữ bốn portal tách biệt; School luôn hiện rõ; Parent chỉ hiển thị dữ liệu của Student được chọn; bảng tài chính chỉ scroll trong container; VND là số nguyên hiển thị từ fixture/server; mutation high-impact vẫn dùng confirmation và Operation reconciliation; touch target Parent tối thiểu 44×44px; mockup tiếp tục chạy qua HTTP tĩnh/classic deferred scripts.

**Ask First:** Tạo module sản phẩm mới ngoài mockup hiện có; thay đổi lifecycle hoặc phân quyền trong PRD/Architecture/UX contract; thêm dependency runtime mới.

**Never:** Sửa application code; dùng client state làm nguồn authorization/domain truth; cho phép partial/excess/mixed-Student settlement; gộp các trạng thái DRAFT/ISSUED/PAID vào cùng màn hình active; che lỗi bằng cách bỏ responsive hoặc bỏ action cần thiết.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Admin mobile | Viewport 390px | Body không tràn ngang; navigation mở bằng sheet; table tự scroll | Menu đóng bằng Escape/link và trả focus |
| Admin deep link | Trang non-workspace với local hash | Giữ hash và focus đúng section | Hash không hợp lệ không bị chuyển sang overview khác trang |
| Parent child | Chọn Bé An hoặc Bé Minh | Chỉ một route hiện và nội dung đúng Student | Student/hash không hợp lệ về trạng thái Parent an toàn |
| School switch | Dirty form hoặc Operation pending | Cho ở lại, bỏ draft hoặc đối soát; sau chọn cập nhật School/SchoolYear | Không giữ nội dung School cũ sau switch |
| Payroll review | Còn unresolved item | Submit/continue bị khóa và có đường tới lỗi | Chỉ mở sau trạng thái review hoàn tất |
| Invoice lifecycle | DRAFT, PREPAID unpaid hoặc ISSUED | Chỉ state hiện hành và action hợp lệ xuất hiện | Account không hợp lệ hoặc thiếu Receipt data khóa submit |
| Exact receipt | PREPAID outstanding 8.100.000đ | Receipt có ngày, phương thức, reference/evidence và amount readonly rồi phân bổ đủ | Không có partial, excess, unallocated hay mixed Student |

</frozen-after-approval>

## Code Map

- `_bmad-output/.../mockups/prototype.css:1-3` -- shell, responsive, table overflow, touch target và badge semantics.
- `_bmad-output/.../mockups/admin/admin-shell.js:10-55` -- navigation destinations, shell renderer, active route và mobile sheet.
- `_bmad-output/.../mockups/prototype.js:148-163,273-342` -- school switch guard, route parser/rendering và lỗi redirect local hash.
- `_bmad-output/.../mockups/parent/parent.html:22-207` -- Parent routes, Student links/binding và bottom navigation.
- `_bmad-output/.../mockups/admin/payroll-timekeeping-import.html:19-28` -- unresolved mappings/workdays và calculate gate.
- `_bmad-output/.../mockups/admin/payroll-run-review.html:19-31` -- unresolved count, employee details và approval gate.
- `_bmad-output/.../mockups/admin/invoice-detail-review.html:13-46` -- invoice state fixtures, BankAccount selection và Receipt capture.
- `_bmad-output/.../mockups/admin/invoice-generation.html:20-43` -- categorized skips; giữ generate hợp lệ khi server preview vẫn READY.
- `_bmad-output/implementation-artifacts/test-admin-workspace-queue.mjs` -- VM harness tái sử dụng cho hash guard.

## Tasks & Acceptance

**Execution:**
- [x] `mockups/prototype.css`, `mockups/admin/admin-shell.js` -- sửa containment và thêm navigation sheet accessible.
- [x] `mockups/prototype.js`, `mockups/parent/parent.html` -- cô lập route, giữ local hash, bind Student và hoàn thiện School switch.
- [x] `mockups/admin/payroll-*.html` -- khóa calculate/submit theo unresolved state và làm mọi employee detail link có đích.
- [x] `mockups/admin/invoice-detail-review.html`, `admin-shell.js` -- tách lifecycle, thêm BankAccount selector, Receipt form và destination Finance rõ ràng.
- [x] `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- kiểm thử matrix và regression routing.

**Acceptance Criteria:**
- Given mọi Admin mockup ở 390px, when render, then body width bằng viewport và chỉ table được horizontal scroll.
- Given một route/state được chọn, when hash thay đổi, then chỉ nội dung tương ứng hiện, navigation/focus phản ánh đúng route.
- Given payroll còn đối soát, when người dùng xem CTA, then CTA bị khóa kèm lý do; khi fixture hoàn tất thì CTA mới khả dụng.
- Given PREPAID source chưa paid, when Finance ghi nhận thu, then UI thu đủ Receipt facts và chỉ cho exact settlement cùng Student/School/SchoolYear.

## Spec Change Log

## Design Notes

Mockup có thể dùng fixture tĩnh nhưng phải mô phỏng ranh giới server: route chỉ quyết định fixture đang xem, không tự cấp quyền hoặc tự tính trạng thái. Finance skips đã được server phân loại không đồng nghĩa payroll unresolved; vì vậy CollectionRun READY vẫn có thể generate khi skip được giải thích, còn payroll mapping/reconciliation phải khóa bước tiếp theo.

## Verification

**Commands:**
- `node --check .../prototype.js && node --check .../admin/admin-shell.js` -- JavaScript hợp lệ.
- `node _bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- tất cả contract assertions pass.
- `git diff --check` -- không có lỗi whitespace.

**Manual checks:**
- Render 12 trang đại diện ở 1440×900 và 390×844; kiểm tra overflow, menu sheet, route isolation, focus, Student binding và CTA gating.

## Suggested Review Order

**Runtime và ranh giới tenant**

- Entry point điều phối route, validation và xóa dữ liệu tenant cũ.
  [`prototype.js:148`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js#L148)

- Shell giữ navigation responsive, inert workspace và active deep link.
  [`admin-shell.js:35`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js#L35)

- Containment thực sự ngăn body overflow, table tự sở hữu scroll.
  [`prototype.css:2`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.css#L2)

**Route và binding người dùng**

- Parent chỉ render route và Student đã chọn.
  [`parent.html:22`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/parent/parent.html#L22)

- Invoice tách DRAFT, Receipt và ISSUED thành fixture độc quyền.
  [`invoice-detail-review.html:12`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-detail-review.html#L12)

**Gating nghiệp vụ**

- Receipt exact-settlement thu đủ dữ kiện trước confirmation.
  [`invoice-detail-review.html:36`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-detail-review.html#L36)

- Payroll chỉ mở submit sau khi hai đối soát hoàn tất.
  [`payroll-run-review.html:18`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/payroll-run-review.html#L18)

- Timekeeping khóa calculate tới khi mapping và ngày công sẵn sàng.
  [`payroll-timekeeping-import.html:25`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/payroll-timekeeping-import.html#L25)

**Kiểm thử**

- Contract test phủ tám hàng edge-case matrix và regression nguồn.
  [`test-rendered-mockup-contracts.mjs:1`](test-rendered-mockup-contracts.mjs#L1)

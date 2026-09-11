---
title: 'Đổi lịch hoạt động thành danh sách kỳ nghỉ'
type: 'refactor'
created: '2026-09-11'
status: 'done'
review_loop_iteration: 0
baseline_commit: '49d7857fe15941e8404de98da15d06712f06d36b'
context:
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tab `Lịch hoạt động` đang mô phỏng việc đổi lịch làm việc qua một policy version proposal, khiến thao tác `Kiểm tra đề xuất` không rõ nghĩa. Thực tế Trường mặc định hoạt động Thứ hai đến Thứ bảy; người quản trị chỉ cần quản lý các kỳ nghỉ lễ kéo dài theo khoảng ngày.

**Approach:** Thay policy proposal trong tab này bằng thông tin lịch mặc định chỉ đọc và bảng kỳ nghỉ lễ. School Admin thêm một kỳ nghỉ bằng tên, ngày bắt đầu và ngày kết thúc; hệ thống xác nhận phạm vi/ngày và ghi lịch sử. Các kỳ nghỉ là source calendar cho non-operating date, leave eligibility, meal adjustment exclusion và calendar snapshot, nhưng mockup không thêm backend/API.

## Boundaries & Constraints

**Always:** Lịch mặc định hiển thị `Thứ hai đến Thứ bảy`; Chủ nhật là ngày không hoạt động. Kỳ nghỉ có `Tên kỳ nghỉ`, `Ngày bắt đầu`, `Ngày kết thúc`, phạm vi bao gồm cả hai ngày và status text. Server kiểm tra cùng School/timezone, date order, overlap/conflict và ảnh hưởng trước terminal Operation; timeout dùng reconciliation, historical snapshot/audit không bị sửa. Ngày nghỉ khiến UI hiển thị calendar/non-operating label và không suy diễn missing attendance; attendance/leave/Finance tiếp tục lấy calendar server-side/snapshot as-of, không browser-calculated.

**Ask First:** Hỏi trước khi đổi default workweek, thêm half-day/ngoại lệ theo lớp, cho xóa/sửa kỳ nghỉ đã có ảnh hưởng, thay policy/calendar backend model hoặc đổi Finance refund/adjustment calculation.

**Never:** Không còn form hay button `Kiểm tra đề xuất` cho lịch tuần; không cho Admin ghi attendance/handover; không tính operating day, eligibility hoặc money trên mockup; không sửa final historical artifacts để thay requirement.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Xem lịch | School Admin mở tab Lịch hoạt động | Thấy lịch mặc định Thứ hai-Thứ bảy và bảng kỳ nghỉ | N/A |
| Thêm kỳ nghỉ hợp lệ | Tên, bắt đầu `<=` kết thúc | Named confirmation gửi tạo kỳ nghỉ; table chỉ cập nhật sau terminal result | Timeout giữ Operation reconciliation |
| Khoảng ngày đảo | Bắt đầu sau kết thúc | Server validation giữ form, nêu lỗi cạnh ngày kết thúc | Không tạo local row |
| Chồng lấn | Khoảng mới giao với kỳ nghỉ đã có | Server conflict giữ input và nêu kỳ nghỉ/xung đột | Không thay lịch/snapshot cũ |
| Ngày nghỉ đang được dùng | Holiday/calendar snapshot đã có | Lịch sử chỉ đọc/audit vẫn truy vết; UI không cho sửa lịch sử ngầm | Không rewrite attendance, leave, Invoice, coverage/refund facts |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html:28-32` -- tab Calendar hiện là policy table/proposal; thay bằng default schedule, holiday table và add form/dialog.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js:93-109,672-715` -- existing idempotent Operation/reconciliation and form handling; reuse for named holiday creation, remove calendar policy-conflict fixture wiring.
- `_bmad-output/implementation-artifacts/test-school-settings-ux.mjs:20-100` -- Settings tab and policy matrix; replace calendar proposal conflict test with holiday valid/invalid/overlap lifecycle checks.
- `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs:125-139` -- static Settings tab/policy assertions; change calendar assertions to default schedule and holiday structure.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md:26,93-94,220` -- calendar/non-operating behavior requiring concise contract update.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md:11,38` -- Settings inventory and calendar state explanation.

## Tasks & Acceptance

**Execution:**
- [x] `mockups/admin/school-settings.html` -- replace Calendar policy proposal/table with a read-only Monday-Saturday schedule, holiday table, and named add-holiday form with name/start/end -- align surface to actual School task.
- [x] `mockups/prototype.js` -- remove Calendar policy proposal wiring; add server-fixture holiday creation validation/conflict/reconciliation with no optimistic row/calendar calculation -- preserve operation boundary.
- [x] `EXPERIENCE.md` and `MOCKUP-COVERAGE.md` -- define fixed workweek plus inclusive School holiday ranges as calendar source facts -- retain downstream calendar semantics.
- [x] `test-school-settings-ux.mjs` -- replace calendar-policy assertions with default schedule, holiday field validation/overlap, reconciliation and no optimistic update tests -- cover I/O matrix.
- [x] `test-rendered-mockup-contracts.mjs` -- assert calendar tab holiday structure and absence of weekly-schedule proposal UI -- prevent old model regression.

**Acceptance Criteria:**
- Given School Admin opens Lịch hoạt động, when it renders, then it states Thứ hai đến Thứ bảy as the default schedule and lists named holiday ranges.
- Given School Admin chooses Thêm kỳ nghỉ, when name/start/end are valid and confirmation reaches a terminal result, then the server-confirmed holiday appears in the table with its inclusive range; before that it does not appear.
- Given date order is invalid or the proposed range overlaps an existing holiday, when validation returns, then the form retains values and surfaces the relevant error without changing calendar facts.
- Given a holiday is used by Attendance/Finance history, when calendar tab is reviewed, then the UI preserves audit/read-only history and does not imply changing past attendance, leave, Invoice or coverage calculations.
- Given Settings contracts run, when calendar and tabs are checked, then holiday calendar behavior passes while BankAccount/policy tab behavior remains green.

## Design Notes

The top of the tab uses a one-line rule, `Lịch mặc định: Thứ hai đến Thứ bảy`, not an editable weekly policy. The table has `Tên kỳ nghỉ`, `Từ ngày`, `Đến ngày`, `Số ngày`, `Trạng thái`, `Tùy chọn`; `Số ngày` is server-returned presentation data. `Thêm kỳ nghỉ` opens the compact form or inline detail with only the three requested fields. Existing holidays expose audit/history through a disclosure rather than an implicit edit/delete path.

## Verification

**Commands:**
- `node _bmad-output/implementation-artifacts/test-school-settings-ux.mjs` -- expected: holiday calendar, other Settings tabs and BankAccount lifecycle pass.
- `node _bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- expected: Settings calendar structure and shared contracts pass.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: JavaScript syntax hợp lệ.
- `git diff --check` -- expected: không có whitespace error.

## Suggested Review Order

**Lịch và tạo kỳ nghỉ**

- Thay policy tuần bằng lịch cố định và bảng kỳ nghỉ theo khoảng ngày bao gồm.
  [`school-settings.html:28`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html#L28)

- Chỉ chèn hàng sau terminal Operation; lỗi giữ nguyên input và focus error summary.
  [`prototype.js:38`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js#L38)

- Tạo fixture kiểm tra required, thứ tự ngày, overlap và đối soát.
  [`prototype.js:698`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js#L698)

**Hợp đồng và kiểm thử**

- Nêu rõ holiday range là nguồn calendar server-side, không phải phép tính trình duyệt.
  [`EXPERIENCE.md:59`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md#L59)

- Kiểm thử behavioral matrix cho create, timeout reconciliation, date order và overlap.
  [`test-school-settings-ux.mjs:81`](test-school-settings-ux.mjs#L81)

- Khóa cấu trúc tab mới và loại trừ policy proposal cũ trong Calendar.
  [`test-rendered-mockup-contracts.mjs:125`](test-rendered-mockup-contracts.mjs#L125)

---
title: 'Chuẩn hóa tổng quan vận hành theo ngày'
type: 'refactor'
created: '2026-09-11'
status: 'done'
review_loop_iteration: 0
baseline_commit: '30403c2145f025947bbc370a5c48e71dbdfd6b21'
context:
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sidebar Vận hành đang đặt `Xin nghỉ` và `Bàn giao` là top-level menu, trong khi School Admin cần một điểm vào theo ngày để quan sát tình hình Trường. Overview hiện chỉ có hai queue card, dùng copy `bàn giao`, và không cho thấy sĩ số/điểm danh hay sự khác biệt giữa trẻ chưa đến lớp, nghỉ có đơn và nghỉ không phép.

**Approach:** Sidebar Vận hành chỉ giữ `Tổng quan`. Chuyển overview thành dashboard read-only, server-returned theo School/ngày: tình hình lớp, trẻ đã được đón, nghỉ có đơn, trạng thái vắng theo quy tắc ngày và danh sách đơn xin nghỉ. Danh sách đơn vẫn là detail contextual mở từ overview, không là sidebar entry.

## Boundaries & Constraints

**Always:** Giữ School/date context rõ ràng và aggregates server-authoritative; Teacher/lễ tân vẫn là audience duy nhất ghi attendance và giờ đón; Admin dashboard không có attendance/handover mutation, không suy diễn quyền đón hoặc phí. Hôm nay, trẻ chưa có attendance `PRESENT`/`ABSENT` được xác nhận được gọi là `Chưa đến lớp`. Ngày quá khứ, `Nghỉ không phép` chỉ là attendance `ABSENT` đã xác nhận không có đơn nghỉ được duyệt. `NOT_RECORDED` quá khứ là `Chưa ghi nhận`, không phải vắng không phép. Không dùng chữ `bàn giao` trên Admin overview; dùng `Đã được đón` cho fact giờ đón đã xác nhận.

**Ask First:** Hỏi trước khi thêm API/backend, cho Admin mutation attendance/handover, thay đổi lifecycle leave/attendance, hoặc suy ra nghỉ không phép từ dữ liệu chưa ghi nhận.

**Never:** Không giữ `Xin nghỉ` hoặc `Bàn giao` là sidebar menu; không biến Dashboard thành source tính phí/late pickup; không sửa completed historical specs để đổi yêu cầu; không dùng zero thay cho loading/error/no authorized data.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Hôm nay | School/date hiện tại, Student chưa có `PRESENT`/`ABSENT` | Summary/table hiển thị `Chưa đến lớp`, không gắn nhãn nghỉ không phép | Giữ count/context server-returned; không tự đổi local |
| Ngày quá khứ | `ABSENT` xác nhận và không có leave approved | Hiển thị/count `Nghỉ không phép` | Không tính `NOT_RECORDED` vào nhóm này |
| Ngày quá khứ chưa ghi nhận | Không có attendance record | Hiển thị/count `Chưa ghi nhận`, tách biệt với nghỉ không phép | Không suy diễn vắng |
| Nghỉ có đơn | Leave approved cho ngày đã chọn | Hiển thị/count `Nghỉ có đơn`; card mở danh sách đơn với date/status URL | Danh sách empty giữ School/date/filter |
| Trẻ đã được đón | Handover/picked-up fact đã xác nhận | Hiển thị count `Đã được đón`, read-only | Không có CTA ghi nhận giờ đón trên Admin |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js:10-30,51-68` -- sidebar Vận hành và hash-route whitelist/active state; bỏ direct task navigation nhưng giữ contextual leave destination hợp lệ.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-staff.html:12-46` -- overview fixture, leave detail và obsolete handover route; thay summary và bảng theo day-state đã chốt.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js:344-408,459-483` -- route focus và server-fixture filter behavior; giữ URL-backed leave list, không thêm local aggregate calculation.
- `_bmad-output/implementation-artifacts/test-admin-workspace-queue.mjs:21-135` -- harness hiện cover overview/leave/handover and reconciliation; cập nhật route set và assertions dashboard semantics.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md:24,43,57,73-75,93-94,174-181` -- canonical Admin overview, neutral `NOT_RECORDED`, queue and Teacher-only mutation constraints.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md:10,37` -- mockup inventory and Teacher-only attendance entry statement.

## Tasks & Acceptance

**Execution:**
- [x] `mockups/admin/admin-shell.js` -- remove `Xin nghỉ` and `Bàn giao` sidebar entries; retain `Tổng quan` as sole Vận hành entry and accept only overview plus contextual leave hash routes -- align navigation with workspace IA.
- [x] `mockups/admin/admin-staff.html` -- replace narrow queue/cards and Admin handover mutation section with a table-first daily operations overview: class headcount/attendance, `Đã được đón`, `Nghỉ có đơn`, `Chưa đến lớp`/`Nghỉ không phép`/`Chưa ghi nhận` fixtures and leave-request table -- make School Admin decision context scanable.
- [x] `mockups/prototype.js` -- preserve contextual leave deep-link filtering/focus after sidebar routes are removed; do not derive counts or attendance state in browser -- retain server-authoritative behavior.
- [x] `EXPERIENCE.md` and `MOCKUP-COVERAGE.md` -- document the daily overview metrics, date-sensitive absence terminology and non-mutation boundary -- make the decision canonical.
- [x] `test-admin-workspace-queue.mjs` -- update harness and assertions for removed handover route, sidebar absence, today/past attendance labels and leave-list URL filter -- protect the semantic matrix.

**Acceptance Criteria:**
- Given Admin opens the Vận hành sidebar, when navigation renders, then only `Tổng quan` is available and no direct `Xin nghỉ` or `Bàn giao` link is rendered.
- Given overview opens for today, when a Student has no confirmed attendance, then the UI says `Chưa đến lớp`, not `Nghỉ không phép` or `Vắng mặt`.
- Given overview opens for a past date, when a Student has confirmed `ABSENT` without approved leave, then the UI says `Nghỉ không phép`; when no attendance was recorded, then it says `Chưa ghi nhận`.
- Given handover facts exist, when overview renders, then it presents read-only `Đã được đón` count without Admin record/update action or fee implication.
- Given an operator opens leave requests from overview, when a date/status card is selected, then the list route retains its URL filter, table, empty state and School/date context.
- Given mockup tests run, when sidebar/overview/leave routes are checked, then the date-sensitive labels and absence of Admin handover mutation pass.

## Design Notes

Use a short metrics strip only to summarize the next review; the class table carries comparable facts. For the selected date, each class row exposes `Sĩ số`, `Đã có mặt`, `Chưa đến lớp` or `Nghỉ không phép`/`Chưa ghi nhận`, `Nghỉ có đơn`, and `Đã được đón`. Fixtures may show today and a dated past-state section, but browser code must not calculate or relabel records; actual API determines date relative to School timezone and returns the display facts.

## Verification

**Commands:**
- `node _bmad-output/implementation-artifacts/test-admin-workspace-queue.mjs` -- expected: Admin overview routes, filters and date-state semantics pass.
- `node _bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- expected: shared rendered mockup contracts still pass.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js` -- expected: JavaScript syntax hợp lệ.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: JavaScript syntax hợp lệ.
- `git diff --check` -- expected: không có whitespace error.

## Suggested Review Order

**Workspace Navigation**

- Vận hành giữ một entry; leave remains a contextual child route.
  [`admin-shell.js:10`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js#L10)

- Contextual leave keeps the overview navigation state active.
  [`admin-shell.js:49`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js#L49)

**Daily Facts**

- Today and past dates render separate server-returned fixtures and terms.
  [`admin-staff.html:13`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-staff.html#L13)

- Overview and leave routes are mutually exclusive; unknown dates show empty state.
  [`prototype.js:379`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js#L379)

**Regression Protection**

- Queue harness checks sidebar removal, daily labels and contextual filtering.
  [`test-admin-workspace-queue.mjs:70`](test-admin-workspace-queue.mjs#L70)

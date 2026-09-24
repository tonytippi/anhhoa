---
title: 'Khôi phục Tổng quan Admin theo ngày'
type: 'feature'
created: '2026-09-24'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'ececf20e920c871e05c7d0404458aa99a9d4cd88'
context:
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-staff.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Admin portal hiện không nhận route hoặc render mục `Tổng quan`, dù API authorization vẫn cấp navigation này. Trường vì thế mất điểm vào xem nhanh các fact vận hành quan trọng như sĩ số, nhân sự và tình hình điểm danh theo ngày.

**Approach:** Khôi phục `Tổng quan` thành trang đầu tiên của Admin workspace. Trang gọi một API read-only, server-authoritative theo School/ngày để hiển thị dải chỉ số và bảng theo lớp theo mockup đã duyệt; không tính aggregate trong browser.

## Boundaries & Constraints

**Always:** API xác thực session App và active membership/School/staff/position từ server trước mọi query; mọi query scope `schoolId` đã authorize. Overview trả DTO aggregate không PII, không mutation, không optimistic update. Ngày và nhãn trạng thái được server quyết định theo timezone Trường: hôm nay thiếu attendance xác nhận là `Chưa đến lớp`; quá khứ `ABSENT` không có nguồn nghỉ hợp lệ là `Nghỉ không phép`; thiếu record quá khứ là `Chưa ghi nhận`; `Đã được đón` chỉ là fact read-only. Sĩ số theo lớp chỉ tính enrollment `ENROLLED` và class assignment còn hiệu lực trong ngày. Tổng số nhân viên là count StaffProfile active theo School.

**Ask First:** Hỏi trước khi thêm CTA/mutation điểm danh hoặc bàn giao, expose học sinh/nhân sự cá nhân hay bằng chứng, thay đổi lifecycle attendance/leave/handover, hoặc mở rộng overview thành leave-review có filter URL-backed.

**Never:** Không dùng route danh sách có phân trang để browser tự cộng số liệu; không tin `schoolId`, slug hoặc date query là bằng chứng authorization; không dùng zero thay cho trạng thái loading/error/no data; không sửa historical spec đã done hoặc mockup để đổi yêu cầu.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Xem hôm nay | School authorized, học sinh không có attendance `PRESENT`/`ABSENT` | Row lớp và metric trả `Chưa đến lớp`; không gọi là nghỉ không phép | UI render nguyên fact server trả về |
| Xem ngày quá khứ | `ABSENT` xác nhận, không có leave source hợp lệ | Row lớp trả `Nghỉ không phép` | Không cộng `NOT_RECORDED` vào nhóm này |
| Quá khứ chưa ghi nhận | Không có attendance record | Row lớp trả `Chưa ghi nhận` riêng biệt | Không suy diễn vắng mặt |
| Nghỉ được duyệt và đã có mặt | Leave source bị loại trừ bởi attendance `PRESENT` | Không tính học sinh vào `Nghỉ có đơn` | Dùng source không có exclusion từ server |
| Không có dữ liệu/lỗi/từ chối | Lớp không có roster, request lỗi hoặc 401/403/404 | Empty/loading/error rõ ràng; từ chối quay về chọn Trường | Không hiển thị metric zero giả tạo |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/attendance/attendance.controller.ts:11-35` -- app audience routes; thêm GET overview cạnh read endpoints, dùng App session và schoolId route chỉ làm selector.
- `apps/api/src/modules/attendance/attendance.service.ts:407-501,538-551,797-854` -- query roster/attendance/handover, authorization helpers và quy tắc calendar hiện hữu; tạo aggregate read-only, không tái dùng DTO Teacher.
- `apps/api/prisma/schema.prisma:120-154,348-403` -- `StaffProfile`, `Student`, `StudentEnrollment` và hiệu lực phân lớp là nguồn count School/date.
- `apps/web/src/school-context.tsx:9-31,74-109,219-228` -- danh sách route, authorization navigation, default destination, nav và workspace switch; khôi phục `overview` làm entry đầu tiên khi context cho phép.
- `apps/web/src/attendance/leave-review-workspace.tsx` -- mẫu fetch/read-only status handling và denied callback có thể theo cho workspace mới.
- `apps/web/src/school-context.test.tsx:24-98` -- kiểm thử URL canonical, tenant mismatch, denied và browser history cần bổ sung overview.
- `apps/api/src/integration/attendance.integration.test.ts:118-216` -- fixtures attendance/leave/handover và integration conventions để bảo vệ semantic matrix, School isolation.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-staff.html:12-45` -- layout canonical: ngày được chọn, metrics ngắn, bảng theo lớp, loading/error/empty; Admin không mutation.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/modules/attendance/attendance.controller.ts` và `apps/api/src/modules/attendance/attendance.service.ts` -- thêm endpoint overview App read-only, validate ngày, authorize School context tối thiểu, rồi aggregate staff và facts theo lớp/ngày từ queries School-scoped -- giữ server là nguồn duy nhất của count/nhãn.
- [x] `apps/api/src/integration/attendance.integration.test.ts` và test service phù hợp -- cover tenant isolation, enrollment/class assignment hiệu lực, hôm nay/quá khứ, leave exclusion, handover và request date không hợp lệ -- bảo vệ các fact operational.
- [x] `apps/web/src/overview/overview-workspace.tsx` và stylesheet/module theo convention hiện hành -- render heading ngày, dải metrics tổng học sinh/tổng nhân viên và bảng lớp từ DTO; có loading/error/empty, chỉ GET -- khôi phục surface theo mockup.
- [x] `apps/web/src/school-context.tsx` -- thêm route/navigation/view overview, đưa nó thành default authorized destination và mount workspace -- đảm bảo chooser/deep-link/authorization guard tiếp tục dùng slug và server context.
- [x] `apps/web/src/school-context.test.tsx` và test component overview -- cover deep link, fallback authorized route, loading/error/empty, fact render và không gửi mutation -- chống regression giao diện/route.

**Acceptance Criteria:**
- Given App member có `SCHOOL_CONTEXT_READ`, when mở một School từ chooser hoặc `/schools/:slug/overview`, then `Tổng quan` là entry Vận hành đầu tiên và render trong context School đã authorize.
- Given overview loads, when server trả aggregate, then UI hiển thị tổng học sinh, tổng nhân viên và bảng lớp với sĩ số, có mặt, nghỉ có đơn, đã được đón và bucket trạng thái ngày từ DTO.
- Given actor không còn authorized hoặc response context không khớp, when request overview bị 401/403/404, then protected state bị xóa và UI quay về chooser như các workspace hiện có.
- Given overview open, when quan sát network interaction, then chỉ có GET read request; không có attendance/handover/leave mutation hay client aggregate từ paginated lists.

## Design Notes

DTO nên truyền `date`, `isToday`, `metrics` và `classes`; mỗi class có một `unresolved` object `{ label, count }` để browser chỉ render wording do server quyết định. `metrics` bao gồm `students`, `staff`, `present`, `approvedLeave`, `pickedUp` và unresolved tổng; không cần trả ID học sinh hoặc nhân viên.

## Verification

**Commands:**
- `pnpm --filter api test -- attendance` -- expected: unit/integration attendance including overview semantics pass with `.env.test` database configuration.
- `pnpm --filter web test -- school-context` -- expected: route, tenant guard and overview UI tests pass.
- `pnpm --filter api lint && pnpm --filter web lint` -- expected: type/lint checks pass for changed portal/API code.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Server Facts**

- Single server snapshot protects date semantics and School-scoped aggregate facts.
  [`attendance.service.ts:407`](../../apps/api/src/modules/attendance/attendance.service.ts#L407)

- HTTP endpoint exposes the read-only aggregate only to the App audience.
  [`attendance.controller.ts:32`](../../apps/api/src/modules/attendance/attendance.controller.ts#L32)

**Admin Experience**

- Workspace validates the DTO, preserves date context, and prevents stale response rendering.
  [`overview-workspace.tsx:17`](../../apps/web/src/overview/overview-workspace.tsx#L17)

- School router restores authorized overview navigation and URL-backed selected date.
  [`school-context.tsx:24`](../../apps/web/src/school-context.tsx#L24)

- Portal wiring passes the date query to the overview without weakening School guards.
  [`school-context.tsx:231`](../../apps/web/src/school-context.tsx#L231)

**Regression Coverage**

- Service tests cover operational date semantics, empty roster, and placement overlap.
  [`attendance.service.test.ts:134`](../../apps/api/src/modules/attendance/attendance.service.test.ts#L134)

- Workspace tests verify GET-only loading, recovery, date selection, and rendered facts.
  [`overview-workspace.test.tsx:8`](../../apps/web/src/overview/overview-workspace.test.tsx#L8)

---
title: 'Hàng đợi vận hành buổi sáng'
type: 'feature'
created: '2026-09-23'
status: 'done'
review_loop_iteration: 0
baseline_commit: '904c382267e5c66f517b5a51883e670781845360'
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
  - '_bmad-output/implementation-artifacts/decision-story-4-6-morning-operational-queue-2026-09-23.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-operational-queue.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** School Admin va Staff duoc cap quyen chua co tong quan server-authoritative de biet lop/ngay nao thieu diem danh hoac co don nghi `PENDING`; Admin cung khong co destination read-only de xem danh sach attendance gap da loc.

**Approach:** Tao `OPERATIONAL_QUEUE_READ`, API queue/destination School-scoped theo ngay va Class scope server-side, va Admin overview table-first chi doc. Queue chi co attendance gap va pending leave; URL filters la selector de API re-authorize, khong la bang chung quyen.

## Boundaries & Constraints

**Always:** Resolve capability, active School, binding, Position va Class assignment tren server moi request. School Admin/Finance co queue scope toan School; Staff co capability chi thay Class assignment hieu luc tai ngay. Attendance gap la `ENROLLED` placement hieu luc khong co AttendanceRecord va khong co leave `AUTO_APPROVED`/`APPROVED`; `PENDING` la count rieng. Mac dinh ngay theo `Asia/Ho_Chi_Minh`, chap nhan ISO date hop le; ngay khong van hanh tra queue rong thanh cong voi giai thich. UI hien School/date, text count, giai thich, accessible loading/empty/error; loi khong bao gio hien nhu zero da xac nhan. Sau attendance/leave decision, query lai server va xoa content School cu truoc response moi.

**Ask First:** Doi scope capability, dua handover/Finance vao queue, doi precedence attendance/leave, hoac them mutation Admin/Staff vao destination read-only.

**Never:** Khong tao local/optimistic count, khong dung `staffType`, role name, browser state hay URL filter de authorize; khong expose evidence, Parent data, VND, Invoice hay Finance action; khong dieu huong Admin sang Teacher mutation workspace.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Queue hop le | School, ngay van hanh va actor co capability | Count attendance gap/pending leave theo Class va School/date context; Staff chi nhan Class duoc phan cong | Cross-School Class/filter, revoke hay capability sai bi tu choi truoc query |
| Ngay khong van hanh | ISO date hop le la holiday/non-operating | Queue rong co giai thich va context ro rang | Khong gia zero attendance da xac nhan |
| Destination va refresh | Card/hang chon date/class/status, sau do attendance/leave doi | URL filter mo read-only list; lan GET sau tra server state moi | Error/denied giu context hoac quay safe chooser, khong giu data School cu |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/authorization/authorization.service.ts` -- capability catalog, audience filtering, navigation va `resolve()` School/Position/binding authorization; them queue capability va nav projection.
- `apps/api/src/modules/attendance/attendance.service.ts` -- `teacherRoster()` da dinh nghia precedence `NOT_RECORDED`, `teacherList()` da validate Class assignment, `appList()`/`approver()` la pattern Admin School-scoped; trich xuat/read model aggregate khong goi N+1 roster.
- `apps/api/src/modules/attendance/attendance.controller.ts` -- them read-only app queue va filtered attendance/leave destination adapters, validate query date/class/status.
- `apps/api/prisma/schema.prisma` -- `StudentEnrollment`, placement/Class, `AttendanceRecord` unique/index va `LeaveRequestDay`; aggregate phai match `schoolId` va as-of date.
- `apps/web/src/school-context.tsx` -- Admin School lifecycle, stale-response protection, switch guard va workspace denial; them overview/URL view state va queue nav khong pha roster/settings/finance.
- `apps/web/src/attendance/leave-review-workspace.tsx` -- reuse denied/status/reload conventions, mo rong de nhan queue filter va giu decision capability tach khoi read-only list.
- `apps/api/src/modules/attendance/attendance.service.test.ts`, `apps/api/src/integration/attendance.integration.test.ts`, `apps/web/src/school-context.test.tsx` -- unit, PostgreSQL tenant graph va portal stale/denied/switch test patterns.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma`, `apps/api/src/modules/authorization/authorization.service.ts`, `apps/api/src/modules/roster/roster.service.ts`, `apps/api/src/modules/ops/ops.service.ts` -- add, validate and seed `OPERATIONAL_QUEUE_READ` Position grant; project it only to the authorized audience/navigation.
- [x] `apps/api/src/modules/attendance/attendance.service.ts` and controller -- implement School-scoped queue aggregate plus read-only filtered attendance-gap/pending-leave lists, with effective-date Class scope and server date validation.
- [x] `apps/web/src/attendance/` and `apps/web/src/school-context.tsx` -- implement Admin table-first overview and URL-backed read-only destinations, preserving School switch/denial/race behavior and server refresh.
- [x] API unit/PostgreSQL integration/Admin portal tests -- prove counts/precedence/non-operating context, restricted Staff Class scope, revocation/cross-School denial, filtered URL destinations, error-not-zero and stale-response clearing.

**Acceptance Criteria:**
- Given an authorized actor opens Overview, when the selected School/date loads, then the server returns only authorized Class queue counts and the UI renders School/date/text explanation without optimistic changes.
- Given an actor opens a queue row, when it selects attendance gap or pending leave, then the destination URL contains date/class/status and the server re-authorizes the filtered list before returning it.
- Given attendance is recorded, a leave is decided, a request is denied, or School changes, when the queue refreshes, then it shows fresh server state or an accessible contextual error and never stale cross-School content or inferred zero.

## Design Notes

Use the existing attendance read precedence: an AttendanceRecord wins; otherwise confirmed leave renders `ON_LEAVE`; only the remaining effective placements are `NOT_RECORDED`. Aggregate that same meaning in one database-backed read model so queue cards and destination list cannot disagree.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: Prisma client generation succeeds.
- `pnpm --filter @passionedu/api typecheck && pnpm --filter @passionedu/api test` -- expected: API types and unit tests pass.
- `pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL integration suite passes using `apps/api/.env.test`.
- `pnpm --filter @passionedu/admin-web typecheck && pnpm --filter @passionedu/admin-web test && pnpm --filter @passionedu/admin-web build` -- expected: Admin queue types, tests and production build pass.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Authorization And Scope**

- Resolve queue capability and Class scope server-side for every read.
  [`attendance.service.ts:335`](../../../apps/api/src/modules/attendance/attendance.service.ts#L335)

- Project only audited bindings and authorized queue navigation.
  [`authorization.service.ts:19`](../../../apps/api/src/modules/authorization/authorization.service.ts#L19)

- Seed School context and queue access for initial Finance positions.
  [`ops.service.ts:39`](../../../apps/api/src/modules/ops/ops.service.ts#L39)

**Read-Only Queue**

- Aggregate effective placements using attendance and leave precedence.
  [`attendance.service.ts:833`](../../../apps/api/src/modules/attendance/attendance.service.ts#L833)

- Expose distinct Admin and Teacher REST read endpoints.
  [`attendance.controller.ts:21`](../../../apps/api/src/modules/attendance/attendance.controller.ts#L21)

- Render table-first queue and URL-filtered destination without mutations.
  [`operational-queue-workspace.tsx:11`](../../../apps/web/src/attendance/operational-queue-workspace.tsx#L11)

- Mount server-projected overview within existing School lifecycle guards.
  [`school-context.tsx:328`](../../../apps/web/src/school-context.tsx#L328)

**Verification**

- Prove queue tenant scope, pending separation, cross-School denial and revoke.
  [`attendance.integration.test.ts:149`](../../../apps/api/src/integration/attendance.integration.test.ts#L149)

- Prove URL filters, contextual errors and stale date response suppression.
  [`operational-queue-workspace.test.tsx:1`](../../../apps/web/src/attendance/operational-queue-workspace.test.tsx#L1)

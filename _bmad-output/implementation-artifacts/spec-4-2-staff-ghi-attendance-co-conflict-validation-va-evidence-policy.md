---
title: 'Staff ghi attendance có conflict validation và evidence policy'
type: 'feature'
created: '2026-09-20'
status: 'done'
review_loop_iteration: 0
baseline_commit: '3896a5bee5ab8cb8f414550c5183d64c4aa1fd1f'
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
  - '_bmad-output/implementation-artifacts/decision-story-4-2-attendance-precedence-2026-09-20.md'
warnings: []
deferred: []
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Teacher portal va API chua co attendance persistence, write/read surface hay server validation cho School/Class/Student/ngay. Staff can ghi ket qua thuc te an toan theo Position capability, assignment, calendar va evidence policy; leave da duyet la ke hoach va khong duoc ghi de ket qua thuc te.

**Approach:** Them AttendanceRecord School-scoped va REST Teacher workspace. Server transaction tu xac minh audience, tenant graph, Position capability, Staff binding, Class assignment, enrollment placement, calendar va policy; luu state/audit/Operation, va tra projection server-authoritative.

## Boundaries & Constraints

**Always:** `AttendanceRecord` unique theo `(schoolId, classId, studentId, attendanceOn)` va chi persist `PRESENT`/`ABSENT`. Dung `Asia/Ho_Chi_Minh` va interval `[effectiveFrom, effectiveTo)`. Teacher write phai resolve active SchoolMembership, audited active StaffProfile binding, active primary SchoolPosition co `ATTENDANCE_WRITE`, effective StaffClassAssignment dung Class/ngay, Student `ENROLLED` co placement dung Class, School calendar operating day va AttendancePolicy effective trong cung transaction. Route/filter/UUID/browser state chi la selector, khong la authorization. `PRESENT` can opaque `evidenceId` hop le khi policy `REQUIRED`; `ABSENT` khong can evidence. Evidence DTO khong co URL/storage key/media. Cookie mutation can origin validation, double-submit CSRF, UUID `Idempotency-Key`, actor-scoped Operation va reconciliation truoc retry. Integration suite nap `TARGET_INTEGRATION_DATABASE_URL` tu `apps/api/.env` vao process environment; khong ghi secret vao repository.

**Ask First:** Dung lai neu opaque evidence reference khong the validate theo School ma khong nhan URL/storage key tu browser, hoac PostgreSQL khong the enforce School-scoped integrity/unique write trong transaction.

**Never:** Khong authorize tu `staffType`, preset role, ten/code Position hay capability tu client. Khong ghi non-operating day, Student khong ENROLLED/khong placed, assignment sai/het han, hoac actor bi revoke. Khong tao ClassSession, revision aggregate, public evidence upload/read, retention cleanup, notification source, Parent endpoint, Finance adjustment/pricing hay Admin attendance mutation; cac phan nay thuoc story sau.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Write hop le | Teacher co capability/binding/assignment, Student ENROLLED dung Class, ngay operating va policy hop le | Upsert `PRESENT`/`ABSENT`, luu policy/actor provenance, audit va Operation; tra state server-confirmed | Khong loi |
| Authorization revoke | Position/grant/binding/membership/Staff inactive hoac assignment sai Class/ngay | Tu choi truoc domain read/write | `CAPABILITY_DENIED`; khong record/audit/Operation |
| Roster conflict | Holiday/non-operating, calendar/policy thieu, Student khong ENROLLED/placement khac Class | Khong ghi state | Typed validation/conflict fact |
| Required evidence | `PRESENT` va policy `REQUIRED` nhung evidence reference thieu/foreign/invalid | Khong ghi state | Field error `evidenceId` |
| Leave precedence | Confirmed leave va AttendanceRecord cung ngay | AttendanceRecord `PRESENT`/`ABSENT` la state thuc te; leave giu context/audit | Khong loi |
| Idempotent retry | Cung teacher/key/fingerprint sau thanh cong | Replay exact outcome; body khac conflict | `IDEMPOTENCY_CONFLICT` |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma:100-193,272-309,468-542,611-626` -- graph Staff/Position/assignment, enrollment placement, Operation/audit va versioned policy de AttendanceRecord tham chieu bang composite School FK.
- `apps/api/prisma/migrations/20260919000000_leave_domain/migration.sql` -- mau trigger tenant/history PostgreSQL va cleanup integration cua attendance domain; mirror convention, khong sua leave behavior.
- `apps/api/src/modules/attendance/attendance.service.ts:312-383,466-527` -- teacher leave authorization, calendar resolver va mutation pattern can tach thanh teacher attendance helper transaction-safe.
- `apps/api/src/modules/attendance/attendance.controller.ts:13-22` -- cookie audience/CSRF guard; them teacher attendance write, roster read va Operation reconciliation.
- `apps/api/src/modules/authorization/authorization.service.ts:19-54` -- `ATTENDANCE_WRITE` da co trong teacher capability catalog; them navigation Teacher neu can, khong tin navigation de authorize.
- `apps/api/src/modules/roster/roster.service.ts:1897-1937,2146` -- mau enforce Position grant va StaffClassAssignment effective-date.
- `apps/api/src/integration/attendance.integration.test.ts` -- fixture leave hien co; mo rong Position/grant/binding/assignment, record constraint va revoke test PostgreSQL.
- `apps/api/scripts/test-integration.ts:3-9` -- target integration DB workflow: map `TARGET_INTEGRATION_DATABASE_URL` sang `DATABASE_URL`, migrate, seed, Vitest.
- `apps/teacher-web/src/school-context.tsx` va `main.tsx` -- shell School switch/dirty guard hien co; thay demo dirty bang attendance workspace state thuc te.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` va migration attendance moi -- them enum/model `AttendanceRecord`, evidence reference opaque School-scoped, policy/actor snapshot, composite FK, unique `(schoolId, classId, studentId, attendanceOn)`, index roster va constraint/trigger can thiet de chong graph cheo School.
- [x] `apps/api/src/modules/attendance/attendance.service.ts` -- them teacher authorization va write transaction, policy/calendar/enrollment/placement validation, evidence reference validation, Operation idempotency/audit, roster projection uu tien record thuc te roi leave confirmed roi `NOT_RECORDED`.
- [x] `apps/api/src/modules/attendance/attendance.controller.ts` va `authorization.service.ts` -- them REST roster/write/reconcile Teacher, giu CSRF/origin va actor scope; expose navigation attendance khi co capability ma khong tao quyen moi.
- [x] `apps/api/src/modules/attendance/attendance.service.test.ts` va `apps/api/src/integration/attendance.integration.test.ts` -- cover matrix, same-key replay/fingerprint conflict, precedence, revocation truoc write, effective-date/class/tenant denial, policy evidence va PostgreSQL unique/composite constraints.
- [x] `apps/teacher-web/src/attendance/attendance-workspace.tsx`, test va `school-context.tsx` -- them mobile-first Class/day roster, state server-confirmed, evidence requirement, accessible summary/field error, dirty/switch guard va timeout reconciliation; khong optimistic override hay media URL.

**Acceptance Criteria:**
- Given Teacher co `ATTENDANCE_WRITE`, binding va Class assignment effective, when ghi `PRESENT` hoac `ABSENT` cho Student ENROLLED dung School/Class/ngay operating, then API persist state server-confirmed cung policy/actor provenance, audit va Operation.
- Given Position, grant, Staff, binding, membership bi revoke; Class/date khong effective; Student placement/enrollment/School sai, when Teacher write/read, then API deny truoc domain write va khong tao AttendanceRecord, audit hay Operation moi.
- Given AttendancePolicy `REQUIRED`, when Teacher ghi `PRESENT` khong co evidence reference opaque hop le, then API reject voi field error; when policy `OPTIONAL` hoac ghi `ABSENT`, then API khong bat buoc evidence va DTO khong tra URL/media.
- Given AttendanceRecord cung ngay voi confirmed leave, when Teacher roster doc projection, then record `PRESENT`/`ABSENT` la attendance state; when Parent projection sau nay doc cung fact, then no cung uu tien record, con chi leave khong record moi suy ra `ON_LEAVE`.
- Given retry identical sau timeout, when Teacher reconcile Operation, then API tra outcome cua dung teacher actor; given same key va fingerprint khac, then API tra `IDEMPOTENCY_CONFLICT`.

## Design Notes

`LeaveRequest` bieu dien ke hoach da xac nhan, con `AttendanceRecord` bieu dien quan sat thuc te. Khong sua/huy leave de "lam sach" du lieu sau khi tre den lop: audit giu du ca du bao va ket qua. API read model, khong phai client, quyet dinh precedence. Story nay luu `evidenceId` opaque de policy co the enforce; Story 4.3 moi duoc quy dinh route media va retention.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- Prisma client sinh thanh cong.
- `pnpm --filter @passionedu/api typecheck` -- API compile type-safe.
- `pnpm --filter @passionedu/api test` -- unit/controller attendance pass.
- `set -a; source apps/api/.env; set +a; pnpm --filter @passionedu/api test:integration` -- migration va PostgreSQL integration suite pass tren target database local.
- `pnpm --filter @passionedu/teacher-web test` -- Teacher workspace va School switch behavior pass.
- `git diff --check` -- khong co whitespace error.

## Review Triage Log

### 2026-09-20
- intent_gap: 0; bad_spec: 0; patch: 10; defer: 0; reject: 6.
- Da patch roster non-operating/policy validation, audited Staff binding, Operation reconciliation theo Class/date, audit previous attendance facts, evidence validation cho `PRESENT`, timeout/idempotency reconciliation va protected state reset cua Teacher workspace.
- Bo sung service-boundary integration cover write, audit, replay, fingerprint conflict va precedence `AttendanceRecord` tren confirmed leave.
- Phat hien va sua race co san trong roster: lifecycle activation lock Class va reject Class da archive, lam full PostgreSQL suite on dinh.

## Auto Run Result

Status: done

Summary: Da them AttendanceRecord School-scoped, Teacher REST roster/write/reconcile, policy evidence opaque, projection attendance-first, Teacher workspace va PostgreSQL proof. Leave confirmed la context ke hoach; attendance thuc te co uu tien trong projection.

Verification: `pnpm --filter @passionedu/api prisma:generate`, API typecheck/unit, Teacher typecheck/test, `set -a; source apps/api/.env; set +a; pnpm --filter @passionedu/api test:integration` va `git diff --check` pass. Full integration: 7 files, 53 tests.

## Suggested Review Order

**Attendance Domain**

- Teacher write, authorization, idempotency and precedence live in one service boundary.
  [`attendance.service.ts:386`](../../apps/api/src/modules/attendance/attendance.service.ts#L386)

- PostgreSQL preserves School graph and roster-day uniqueness.
  [`schema.prisma:635`](../../apps/api/prisma/schema.prisma#L635)

- Migration enforces enrolled placement before durable attendance facts.
  [`migration.sql:12`](../../apps/api/prisma/migrations/20260920000000_attendance_records/migration.sql#L12)

**Teacher Surface**

- REST routes retain Teacher audience, CSRF, idempotency and reconciliation boundaries.
  [`attendance.controller.ts:19`](../../apps/api/src/modules/attendance/attendance.controller.ts#L19)

- Workspace renders server-confirmed states and reconciles uncertain writes.
  [`attendance-workspace.tsx:9`](../../apps/teacher-web/src/attendance/attendance-workspace.tsx#L9)

**Proof**

- Integration proves write/replay/audit and attendance-over-leave precedence.
  [`attendance.integration.test.ts:101`](../../apps/api/src/integration/attendance.integration.test.ts#L101)

- Class lock prevents archive and lifecycle activation racing into invalid state.
  [`roster.service.ts:1273`](../../apps/api/src/modules/roster/roster.service.ts#L1273)

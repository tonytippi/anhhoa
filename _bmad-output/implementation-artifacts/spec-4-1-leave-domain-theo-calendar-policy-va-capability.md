---
title: 'Leave domain theo calendar, policy và capability'
type: 'feature'
created: '2026-09-19'
status: 'done'
review_loop_iteration: 1
baseline_revision: '76b5121785004d0cdff621f82399b8e95b4ada3d'
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
  - '_bmad-output/implementation-artifacts/decision-story-4-1-leave-policy-2026-09-19.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** School chua co domain leave server-authoritative. Parent can tao don nghi nhieu ngay cho tre duoc uy quyen; giao vien lop va actor co quyen phai xem/dinh doat dung School, Class, calendar va policy ma khong tin ID tu client.

**Approach:** Tao versioned LeavePolicy va attendance leave domain, luu snapshot ngay van hanh/policy, bat buoc Operation idempotent cho moi mutation. Mo Parent write/read toi ownership cua ParentProfile, teacher read toi StaffProfile-membership binding va Class assignment hieu luc, va app approval/rejection cho School Admin/Finance Manager.

## Boundaries & Constraints

**Always:** Dung `Asia/Ho_Chi_Minh`; School la tenant root; route parameter chi la selector. Input la `startsOn`/`endsOn` inclusive va strict `YYYY-MM-DD`. Loai Sunday/holiday theo calendar version hieu luc tung ngay, tra excluded-date conflict facts, va reject neu khong con ngay van hanh. Snapshot LeavePolicy hieu luc tai luc create; chi so sanh deadline `HH:mm` inclusive voi ngay truoc ngay van hanh dau tien. Auto-approve chi khi moi ngay van hanh cua don chi la ngay van hanh ke tiep va request truoc/den deadline; con lai `PENDING`. Luu `PENDING`, `AUTO_APPROVED`, `APPROVED`, `REJECTED`; reject bat buoc reason. Create/approve/reject bat buoc UUID Idempotency-Key va Operation actor-scoped, audit va reconcile-safe replay. Parent chi tao/doc don cua ParentProfile qua StudentParent ACTIVE; giao vien chi doc Student thuoc Class assignment hieu luc cua StaffProfile da bind SchoolMembership active; School Admin/Finance Manager approve/reject.

**Block If:** Contract da chot trong decision artifact; halt neu implementation phat hien xung dot voi no hoac khong the enforce School-scoped authorization trong database transaction.

**Never:** Khong tin browser role, email, School/Class/Student UUID de authorize. Khong them Parent access toi approval internals, Staff identity hay evidence. Khong doi enrollment lifecycle, tao attendance, notification, Finance adjustment hay Invoice. Khong re-evaluate policy deadline cua don da tao khi approve/reject.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Auto approval | Parent co ACTIVE link, range chi chua next operating day, policy 15:00, submit 15:00 | Don `AUTO_APPROVED`, luu operating-day va policy snapshot, Operation/audit | Khong loi |
| Pending range | Range co ngay van hanh sau next operating day hoac submit sau deadline | Don `PENDING` | Khong loi |
| Excluded dates | Range gom Sunday/holiday va ngay hoc | Chi luu ngay hoc, response tra excluded conflict facts | Khong loi |
| No operating date | Range chi Sunday/holiday | Khong tao Operation/audit/domain record | `VALIDATION_ERROR` |
| Missing policy | Khong co LeavePolicy effective khi create | Khong tao record | `LEAVE_POLICY_NOT_CONFIGURED` |
| Authority | Parent link revoked/cross-School; teacher khong bind/khong phan cong; non-approver approve | Khong lo information/khong mutate | Tenant/capability denial |
| Retry and decision | Same actor/key/body retry; changed body; reject khong reason; decide terminal request | Replay exact outcome; changed key rejected; only pending transitions | Idempotency/validation/state conflict |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- tenant graph cho versioned policies, StudentParent, StaffClassAssignment va Operation; them LeavePolicy, leave request/day facts va membership-bound assignment.
- `apps/api/prisma/migrations/20260918000006_school_settings_versioned/migration.sql` -- mau unique/effective policy, FK composite va append-only settings trigger can duoc mirror cho LeavePolicy.
- `apps/api/src/modules/settings/settings.service.ts:17-33,53-63` -- strict date/HCM convention va create/read versioned settings; mo rong LeavePolicy dto/read/write.
- `apps/api/src/modules/settings/settings.controller.ts:10-23` -- app session, CSRF/origin va idempotent Settings mutation route.
- `apps/api/src/modules/roster/roster.service.ts:25-37,55-58` -- staff-class assignment lifecycle; them membership binding duoc validate/audit thay vi suy ra email.
- `apps/api/src/modules/parents/parents.service.ts:50-64` -- ParentProfile identity/link authorization va PARENT_PROFILE provenance pattern can tai su dung cho leave.
- `apps/api/src/modules/common/mutation-protection.ts` and `apps/api/src/modules/common/operation-idempotency.ts` -- canonical fingerprint, CSRF va replay/collision semantics bat buoc.
- `apps/api/src/modules/memberships/memberships.service.ts:59-70` -- Operation reconciliation shape; Parent route phai scope ParentProfile, app route scope actor membership.
- `apps/api/src/integration/settings.integration.test.ts` and `apps/api/src/integration/roster.integration.test.ts` -- PostgreSQL tenant graph, temporal policy, audit va idempotency fixtures.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma` and new Prisma migration -- add append-only effective-dated `LeavePolicy`, leave status/request/day snapshot records, and SchoolMembership-bound StaffClassAssignment with School composite keys/indexes/constraints -- persist tenant-safe temporal facts.
- `apps/api/src/modules/settings/settings.service.ts` and `settings.controller.ts` -- create/read `LeavePolicy` versions with `effectiveFrom`, validated `HH:mm` deadline and idempotent School Admin audit -- make policy configurable server-side.
- `apps/api/src/modules/roster/roster.service.ts`, controller/tests -- require a School membership when assigning a staff profile to a Class, validate it belongs to the School and audit it -- prove the teacher identity boundary.
- `apps/api/src/modules/attendance/*` and `app.module.ts` -- add Parent create/read/reconcile, teacher/app read, and app approve/reject routes/service. Evaluate policy snapshot/calendar operating dates and deadline in HCM; authorize and mutate inside locked transactions with actor-appropriate Operations/audit -- deliver leave domain without cross-tenant leakage.
- `apps/api/src/modules/attendance/*.test.ts` and `apps/api/src/integration/attendance.integration.test.ts` -- cover all matrix rows, policy history/validation, range/calendar projection, role/link/assignment denial, terminal state, audit, replay/fingerprint and concurrent idempotency -- protect release behavior.

**Acceptance Criteria:**
- Given ParentProfile co StudentParent ACTIVE trong School, when submit date range co policy va enrollment `ENROLLED`, then server chi luu cac ngay van hanh va tra state server-authoritative cung excluded conflict facts.
- Given ngay van hanh dau tien la ngay ke tiep va submit den deadline HCM, when create, then state la `AUTO_APPROVED`; given request sau deadline hoac co ngay muon hon, then state la `PENDING`.
- Given policy khong ton tai, range khong co ngay van hanh, cross-School student/link, hoac enrollment khong eligible, when Parent create, then server tu choi truoc khi tao leave/audit/Operation.
- Given `PENDING` request, when School Admin hoac Finance Manager approve/reject voi UUID idempotency headers, then dung mot transition/audit/Operation duoc luu; reject can reason va terminal request khong the doi lai.
- Given teacher session, when doc leave, then server chi tra Student cua Class assignment hieu luc bound voi active membership; Parent chi doc/reconcile request va Operation cua chinh ParentProfile.
- Given retry cung actor/key/body, when mutation da hoan tat, then replay tra exact Operation outcome; given body khac, then server tra `IDEMPOTENCY_CONFLICT`.

## Spec Change Log

### 2026-09-19
- User clarified that StaffProfile is the business source of truth: it owns employment status, teacher classification, and an audited optional login binding; class assignment selects StaffProfile only. This avoids the known-bad state where an unrelated active SchoolMembership can impersonate an assigned StaffProfile.

## Design Notes

`LeavePolicy` la policy cua thoi diem submit, khong phai policy tinh tung ngay cua range. Calendar van resolve tung requested day de immutable day facts giu dung ngay hoc thuc te. Parent Operation must use `PARENT_PROFILE` and never expose app-member operations. StaffProfile owns employment/type and an audited optional login binding; class assignment remains a StaffProfile relation.

## Review Triage Log

### 2026-09-19 — Review pass
- intent_gap: 1 (high 1)
- bad_spec: 0
- patch: 14 (high 4, medium 8, low 2)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high]` `[patch]` Chuyen sang StaffProfile-first binding, loai membership khoi class assignment va enforce ACTIVE/TEACHER cho teacher authorization.
  - `[high]` `[patch]` Enforce enrollment tren tung leave day, parent active-link read, replay re-authorization, route idempotency approve/reject rieng va tenant-scoped decision provenance.
  - `[medium]` `[patch]` Them state checks, calendar/policy snapshot FKs, range bound, strict missing-calendar failure va typed LeavePolicy delegate.
  - `[medium]` `[patch]` Them composite StudentParent FK de LeaveRequest khong the ton tai khi Parent khong co authorization edge voi Student.

## Auto Run Result

Status: done

Summary: Da them LeavePolicy versioned, Parent leave create/read/reconcile, teacher/app operational read, approval/rejection idempotent, Staff-first teacher authorization va PostgreSQL tenant/provenance constraints.

Files changed: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260919000000_leave_domain/migration.sql`, `apps/api/src/modules/attendance/`, `apps/api/src/modules/roster/roster.service.ts`, `apps/api/src/modules/settings/`, `apps/api/src/app.module.ts`, va cac test Settings/attendance.

Review findings: 14 patches da ap dung; khong con finding high-impact sau final review. Follow-up review recommendation: true (high patch count 4; score 12).

Verification: `pnpm --filter @passionedu/api typecheck`, `pnpm --filter @passionedu/api test`, `pnpm --filter @passionedu/api exec prisma validate --schema prisma/schema.prisma`, va `git diff --check` deu pass. Da load bien moi truong cuc bo tu `apps/api/.env` va chay `pnpm test:integration`: 8 test files, 67 tests pass; migration `20260919000000_leave_domain` duoc ap dung thanh cong. `apps/api/src/integration/attendance.integration.test.ts` prove StudentParent provenance, calendar snapshot FK, enrolled-day trigger, state check, LeavePolicy append-only/unique va cross-School rejection tren PostgreSQL.

Residual risks: Khong co residual risk da biet trong scope Story 4.1. Working tree van uncommitted theo dung yeu cau hien tai; khong co secret duoc ghi vao artifact.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: Prisma client sinh thanh cong.
- `pnpm --filter @passionedu/api typecheck` -- expected: API typecheck thanh cong.
- `pnpm --filter @passionedu/api test` -- expected: unit/controller tests, gom leave matrix, pass.
- `TARGET_INTEGRATION_DATABASE_URL=... pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL tenant, temporal, idempotency va audit tests pass khi database duoc cau hinh.

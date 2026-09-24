---
title: 'Khắc phục review cho hàng đợi vận hành buổi sáng'
type: 'bugfix'
created: '2026-09-23'
status: 'done'
review_loop_iteration: 0
baseline_commit: '3235f7d6d6bb7d3b4fc34845f3be454127bd5028'
context:
  - '_bmad-output/implementation-artifacts/spec-4-6-hang-doi-van-hanh-buoi-sang.md'
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Review Story 4.6 phat hien hang doi co the hien thi lop zero trong ngay khong van hanh, doc aggregate khong cung snapshot, va Admin portal co the publish response/error cu sau khi nguoi dung da chon ngay hoac School moi. Cac duong regression quan trong chua duoc kiem thu day du.

**Approach:** Giu nguyen capability, precedence va read-only scope cua Story 4.6; harden API queue de tra empty non-operating queue va doc nhat quan, harden client stale guards/contextual errors, va them regression tests o API, provisioning va School context.

## Boundaries & Constraints

**Always:** Queue van School-scoped, authorize server-side moi request, giu Staff effective Class scope, va chi co `NOT_RECORDED`/`PENDING`. Ngay khong van hanh thanh cong voi `classes: []` va explanation; `classId` hop le/in-scope van duoc resolve truoc khi empty response. Aggregate placement, attendance va leave dung cung database snapshot. Client chi publish data, denial hoac error khi request va School con current; `404 CLASS_NOT_FOUND` la contextual error, khong phai School-context denial. Tests dung test database qua `.env.test`.

**Ask First:** Thay doi precedence attendance/leave, capability scope, them mutation, hoac thay doi contract destination.

**Never:** Khong dua zero count de thay the loading/error, khong expose cross-School content, khong trust URL cho authorization, va khong sua frozen intent Story 4.6.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Ngay khong van hanh | Sunday/holiday, Class hop le trong scope | Queue thanh cong, explanation va `classes: []`; destination tra students rong | Class khong thuoc scope van `CLASS_NOT_FOUND` |
| Response cu | Date/School moi bat dau khi fetch, JSON parse hoac failure cu ket thuc | Chi response cua request hien tai duoc render | Bo qua stale payload va stale error |
| Destination | Effective unrecorded va PENDING students trong cung Class | `NOT_RECORDED` va `PENDING` tra dung tap tach biet | Invalid/stale class giu context va hien error phu hop |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/attendance/attendance.service.ts` -- `queueRows()` can resolve authorized class scope before returning non-operating emptiness; use Prisma repeatable-read transaction for calendar, class, placement, record and leave reads. `operationalQueue*()` must distinguish valid scoped class from empty queue data.
- `apps/api/src/modules/attendance/attendance.service.test.ts` -- mocked interactive transaction supports unit tests for empty non-operating response and scoped class behavior.
- `apps/api/src/integration/attendance.integration.test.ts` -- persisted tenant graph test can prove `NOT_RECORDED` semantic destination, PENDING separation and scope.
- `apps/web/src/attendance/operational-queue-workspace.tsx` -- `load()`/`open()` need current-token checks after every await and contextual treatment of class-not-found responses.
- `apps/web/src/attendance/operational-queue-workspace.test.tsx` -- deferred fetch and JSON tests prove stale data/error suppression.
- `apps/web/src/school-context.tsx` and `apps/web/src/school-context.test.tsx` -- server navigation chooses Overview and mounts queue workspace only for `OPERATIONAL_QUEUE_READ`.
- `apps/api/src/integration/ops.provision.integration.test.ts` -- provisioning assertion must persist Finance School context and queue capability grants.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/modules/attendance/attendance.service.ts` -- return empty non-operating queue after scoped-class validation and derive every operating aggregate read under repeatable-read snapshot.
- [x] `apps/web/src/attendance/operational-queue-workspace.tsx` -- suppress stale payloads/errors after fetch and JSON parsing; retain School/date context for destination validation errors.
- [x] `apps/api/src/modules/attendance/attendance.service.test.ts`, `apps/api/src/integration/attendance.integration.test.ts` -- prove non-operating empty queue and distinct NOT_RECORDED/PENDING destination content.
- [x] `apps/api/src/integration/ops.provision.integration.test.ts` -- assert initial Finance grant set.
- [x] `apps/web/src/attendance/operational-queue-workspace.test.tsx`, `apps/web/src/school-context.test.tsx` -- prove stale suppression and authorized overview mounting.

**Acceptance Criteria:**
- Given an authorized actor chooses a non-operating date and an in-scope Class, when it reads queue or destination, then the server returns successful empty work data with an explanation while denying an out-of-scope Class.
- Given concurrent roster, attendance or leave activity, when the queue aggregate runs, then every returned count and student list derives from one repeatable-read database snapshot.
- Given a user changes date or School while an older queue or item request is parsing or failing, when the older work settles, then it cannot render data or an alert over the current context.
- Given Finance is provisioned and an authorized Admin context loads, when queue access is resolved, then Finance has the needed grants and the Admin overview mounts and fetches the selected School queue.

## Design Notes

Use the existing Prisma interactive transaction pattern with `RepeatableRead`; keep actor authorization before aggregate reads. The authorization result and the queue result must be distinct so a valid selected Class remains valid when a non-operating queue deliberately returns no rows.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api typecheck` -- expected: API types pass.
- `pnpm --filter @passionedu/api test` -- expected: API unit tests pass.
- `pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL integration tests pass using `apps/api/.env.test`.
- `pnpm --filter @passionedu/admin-web typecheck && pnpm --filter @passionedu/admin-web test && pnpm --filter @passionedu/admin-web build` -- expected: Admin queue tests and build pass.
- `git diff --check` -- expected: no whitespace errors.

---
title: 'Quyet dinh leave ngan va nguon immutable cho Finance'
type: 'feature'
created: '2026-09-21'
status: 'ready-for-dev'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-21-leave-finance-boundary.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-21-defer-service-enrollment-to-finance.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** School Admin va Finance Manager chua co capability dung de quyet dinh leave ngan `PENDING`, va Epic 5 chua co immutable leave-day source an toan de dung cho meal adjustment sau nay. Codebase da co LeaveRequest, attendance precedence, Operation/audit va enrollment lifecycle.

**Approach:** Mo rong attendance domain voi capability `LEAVE_REQUEST_DECIDE`, quyet dinh leave idempotent va read projection immutable leave-day khong lien ket Finance. Service enrollment thuoc Finance catalog cua Epic 5, khong nam trong Story 4.5.

## Boundaries & Constraints

**Always:** Authorization phai resolve server-side tu active School, membership, audited Staff binding, primary Position va capability; short leave fact chi ap dung ngay operating cho `AUTO_APPROVED`/`APPROVED`, loai tru `PRESENT`; Finance khong duoc nhan receivable, VND, Invoice hay CollectionRun reference. Bao luu van do roster va `ROSTER_MANAGE` so huu, khong co lifecycle song song. Service enrollment chi duoc Finance catalog Epic 5 so huu.

**Block If:** Active Position capability, audited binding, idempotent Operation/audit, hoac School-scoped leave/attendance query khong the ket hop ma khong lam yeu tenant boundary hay xuat Finance field.

**Never:** Khong tao `LongLeaveRequest`, `StudentServiceEnrollment`, service catalog, Parent service-cancel route, hay Finance behavior; khong tu dong doi enrollment, CollectionRun, Invoice, hoc phi, refund hay phi khoi phuc; khong dung role name, browser state hay client capability de authorize.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Decide late leave | Pending leave sau deadline va actor co `LEAVE_REQUEST_DECIDE` | Operation/audit actor-scoped, identical replay tra ket qua ban dau | Changed fingerprint, revoke va terminal race bi tu choi truoc write |
| Export meal source | Leave auto-approved/approved ngay operating | Fact theo School/Student/day/leave provenance, khong co Finance reference | Confirmed `PRESENT` loai tru fact; `ABSENT` khong loai tru |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- co `LeaveRequest`, `LeaveRequestDay`, `AttendanceRecord` va `StudentEnrollment`; leave source projection doc tu School-scoped facts, khong them service enrollment o Story nay.
- `apps/api/src/modules/attendance/attendance.service.ts` -- `create`, `decide`, `leaveCreateFacts`, `teacherRoster`, `record` va idempotent mutation patterns; `approver` hien dung `SETTINGS_MANAGE`, can thay bang resolver capability moi khi implementation duoc unblock.
- `apps/api/src/modules/attendance/attendance.controller.ts` -- cookie mutation guard va leave decision adapters.
- `apps/api/src/modules/authorization/authorization.service.ts` va `apps/api/src/modules/roster/roster.service.ts` -- capability catalogs/Position grant validation can bo sung `LEAVE_REQUEST_DECIDE`.
- `apps/api/src/modules/roster/roster.service.ts` -- `changeLifecycle` so huu `ENROLLED <-> ON_LEAVE`; read-only boundary cho Story 4.5.
- `apps/api/src/integration/attendance.integration.test.ts` va `apps/api/src/modules/attendance/attendance.service.test.ts` -- co leave/attendance precedence va PostgreSQL patterns de mo rong cho leave decision/source.
- `apps/web/src/roster/roster-workspace.tsx` -- mau Admin effective-date, CSRF/idempotency, timeout Operation reconciliation; chua co service/leave-decision workspace.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/api/src/modules/authorization/authorization.service.ts`, `apps/api/src/modules/roster/roster.service.ts` va `apps/api/src/modules/ops/ops.service.ts` -- them/seed/validate `LEAVE_REQUEST_DECIDE` cho Position grant -- dung capability server-side thay `SETTINGS_MANAGE`.
- [ ] `apps/api/src/modules/attendance/attendance.service.ts` va controller -- them resolver leave decider co audited binding, quyet dinh idempotent va School-scoped immutable leave-day source projection -- thuc thi server authority.
- [ ] `apps/web/src/school-context.tsx` va Admin leave-review workspace moi -- expose pending short leave review, UUID/CSRF, validation, School-switch guard va Operation reconciliation -- khong co service mutation.
- [ ] API/unit/PostgreSQL/Admin portal tests -- prove revoke, replay, tenant isolation, PRESENT exclusion, no-Finance payload va Parent khong co decision route -- release evidence dung database `apps/api/.env`.

**Acceptance Criteria:**
- Given pending late short leave va active Position co `LEAVE_REQUEST_DECIDE`, when actor approve/reject voi UUID `Idempotency-Key`, then API re-authorize, persist Operation/audit, replay identical outcome va reject changed fingerprint.
- Given confirmed leave ngay operating, when Epic 5 doc source, then source chi chua School/Student/day/leave provenance va eligibility; confirmed `PRESENT` loai tru source va payload khong co receivable, amount, Invoice hay CollectionRun.

## Auto Run Result

Status: ready-for-dev

Resolution: User approved deferring service enrollment to Finance catalog in Epic 5. Canonical PRD, Architecture Spine, UX, Epic 4/5 backlog and sprint change proposal now assign it there. Story 4.5 is unblocked as the leave-decision and immutable leave-day-source slice.

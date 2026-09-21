---
title: 'Quyet dinh leave ngan va nguon immutable cho Finance'
type: 'feature'
created: '2026-09-21'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'cadbfcb7ab3438dc129fc3e32809326f8f916372'
followup_review_recommended: true
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

**Approach:** Mo rong attendance domain voi capability `LEAVE_REQUEST_DECIDE`, quyet dinh leave idempotent va persist immutable leave-day source/exclusion provenance khong lien ket Finance. Service enrollment thuoc Finance catalog cua Epic 5, khong nam trong Story 4.5.

## Boundaries & Constraints

**Always:** Authorization phai resolve server-side tu active School, membership, audited Staff binding, primary Position va capability; short leave fact chi phat hanh mot lan cho ngay operating `AUTO_APPROVED`/`APPROVED`, giu leave provenance va exclusion provenance bat bien khi co `PRESENT`; Finance khong duoc nhan receivable, VND, Invoice hay CollectionRun reference. Bao luu van do roster va `ROSTER_MANAGE` so huu, khong co lifecycle song song. Service enrollment chi duoc Finance catalog Epic 5 so huu.

**Block If:** Active Position capability, audited binding, idempotent Operation/audit, hoac School-scoped leave/attendance query khong the ket hop ma khong lam yeu tenant boundary hay xuat Finance field.

**Never:** Khong tao `LongLeaveRequest`, `StudentServiceEnrollment`, service catalog, Parent service-cancel route, hay Finance behavior; khong tu dong doi enrollment, CollectionRun, Invoice, hoc phi, refund hay phi khoi phuc; khong dung role name, browser state hay client capability de authorize.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Decide late leave | Pending leave sau deadline va actor co `LEAVE_REQUEST_DECIDE` | Operation/audit actor-scoped, identical replay tra ket qua ban dau | Changed fingerprint, revoke va terminal race bi tu choi truoc write |
| Export meal source | Leave auto-approved/approved ngay operating | Fact persist theo School/Student/day/leave provenance, khong co Finance reference | Confirmed `PRESENT` append exclusion; `ABSENT` khong loai tru |

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
- [x] `apps/api/src/modules/authorization/authorization.service.ts`, `apps/api/src/modules/roster/roster.service.ts` va `apps/api/src/modules/ops/ops.service.ts` -- them/seed/validate `LEAVE_REQUEST_DECIDE` cho Position grant -- dung capability server-side thay `SETTINGS_MANAGE`.
- [x] `apps/api/src/modules/attendance/attendance.service.ts` va controller -- them resolver leave decider co audited binding, quyet dinh idempotent va School-scoped immutable leave-day source projection -- thuc thi server authority.
- [x] `apps/web/src/school-context.tsx` va Admin leave-review workspace moi -- expose pending short leave review, UUID/CSRF, validation, School-switch guard va Operation reconciliation -- khong co service mutation.
- [x] API/unit/PostgreSQL/Admin portal tests -- prove revoke, replay, tenant isolation, PRESENT exclusion, no-Finance payload va Parent khong co decision route -- release evidence dung database `apps/api/.env`.

**Acceptance Criteria:**
- Given pending late short leave va active Position co `LEAVE_REQUEST_DECIDE`, when actor approve/reject voi UUID `Idempotency-Key`, then API re-authorize, persist Operation/audit, replay identical outcome va reject changed fingerprint.
- Given confirmed leave ngay operating, when Epic 5 doc source, then source chi chua School/Student/day/leave provenance va eligibility; confirmed `PRESENT` loai tru source va payload khong co receivable, amount, Invoice hay CollectionRun.

## Review Triage Log

### 2026-09-21 -- Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 11 (high 5, medium 6)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high]` `[patch]` Leave-day source is now a durable append-only source with immutable `PRESENT` exclusion provenance, rather than a live attendance projection.
  - `[high]` `[patch]` Durable source uniqueness is School/Student/operating day; migration backfill deterministically keeps one confirmed source.
  - `[high]` `[patch]` Source export has stable cursor pagination and continuation metadata instead of silent truncation.
  - `[high]` `[patch]` Leave-review persists its Operation before submit and supplies bounded/manual reconciliation across uncertain responses.
  - `[medium]` `[patch]` Decision writes are composite School-scoped; source list uses student name/code; migration validates Parent audit provenance.

## Auto Run Result

Status: done

Summary: Da them `LEAVE_REQUEST_DECIDE` cho Position capability, quyet dinh leave PENDING server-authoritative voi Operation/audit/replay, va Admin review workspace co CSRF, idempotency, switch guard va reconciliation. Leave confirmed phat hanh `LeaveDaySource` durable theo School/Student/ngay; `PRESENT` append exclusion provenance ma khong sua/xoa source. Service enrollment van de Epic 5.

Files changed:
- `apps/api/prisma/schema.prisma` va migrations `20260921000000_leave_request_decide_capability`, `20260921000001_durable_leave_day_sources` -- capability rollout, durable source/exclusion, tenant FK, append-only guard va historical backfill.
- `apps/api/src/modules/attendance/attendance.service.ts` va controller -- leave decider, School-scoped Operation read, cursor source export, source/exclusion issuance va API adapters.
- `apps/api/src/modules/authorization/authorization.service.ts`, `apps/api/src/modules/roster/roster.service.ts`, `apps/api/src/modules/ops/ops.service.ts` -- catalog, Position validation, navigation va provisioning grants.
- `apps/web/src/attendance/leave-review-workspace.tsx`, `apps/web/src/school-context.tsx` -- Admin review surface, student identifier, pending persistence, bounded/manual reconciliation va switch safety.
- `apps/api/src/integration/attendance.integration.test.ts`, service tests va Admin portal tests -- durable source, `PRESENT` exclusion, authorization/replay/pagination/reconciliation coverage.

Review: 11 patches applied (5 high, 6 medium), 0 deferred, 0 rejected. Follow-up review recommendation: true (score 15).

Verification:
- `pnpm --filter @passionedu/api prisma:generate`, `typecheck`, `test`, `build` -- pass.
- `pnpm --filter @passionedu/admin-web typecheck`, `test`, `build` -- pass; 6 files, 57 tests.
- Fresh reset `anhhoa_test`, deploy all 28 migrations, seed, then `pnpm --filter @passionedu/api test:integration` -- pass; 7 files, 59 tests.
- `git diff --check` -- pass.

Residual risk: Finance mapping/materialization of these source facts remains intentionally owned by Epic 5; Parent leave edit/cancel/projection remains Epic 7.

---
title: 'Story 4.10: Teacher portal queue va release gate van hanh lop'
type: 'feature'
created: '2026-09-24'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: 'ff065ca530012f37cd4720271530399e9a78cb76'
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/teacher/teacher.html'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Teacher API da co operational queue va server navigation `overview`, nhung Teacher portal chua render surface nay, nen giao vien khong the theo doi attendance chua ghi nhan hay leave dang cho xu ly trong cac Class duoc phan cong. Release proof hien tai cung chua kiem tra queue tren browser Teacher thuc.

**Approach:** Them workspace queue read-only vao Teacher shell khi va chi khi server navigation cap `overview`; reuse endpoints queue da co va giữ URL `date`, `classId`, `status`. Mo rong fixture va E2E/integration proof cho authorization, revoke va clear stale cross-School state ma khong tao domain endpoint hay mutation moi.

## Boundaries & Constraints

**Always:** API la authorization authority: moi queue/list request re-authorize Teacher audience, active StaffProfile/primary Position/membership binding, `OPERATIONAL_QUEUE_READ`, School va Class assignment effective. Hien School/date/Class, text status/count va server-confirmed list; `NOT_RECORDED` luon neutral, khong phai absence. Error/empty giu context va khong thay unresolved response bang zero. School switch/revoke phai xoa data protected cu truoc safe fallback. Dung `.env.test` cho test can database.

**Block If:** Endpoint/API projection hien co khong tra duoc queue/list theo contract canonical ma can thay doi authorization ownership, data model hoac mockup layout ngoai queue route reviewed.

**Never:** Khong them attendance, handover, DailyJournal, leave decision, Finance, VND/fee, optimistic/local status override hay mutation vao queue. Khong tin query/browser state lam bang chung authorization; khong reuse session/audience portal khac; khong sua Admin queue behavior ngoai regression proof can thiet.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Teacher queue | Active Teacher co queue grant va assignment | Queue hien cards count server-confirmed theo School/date/Class duoc cap. | Loading khong hien zero. |
| URL detail | Teacher chon `NOT_RECORDED` hoac `PENDING` card | URL giu date/classId/status; list read-only dung scope/status. | Foreign/inaccessible Class bi API deny, UI giu context va hien server error. |
| Revoke/switch | Capability/assignment bi revoke hoac doi School khi request dang mo | Request tiep theo deny; UI xoa cards/rows School cu truoc fallback. | Khong render stale row hay retry mutation. |
| Release gate | Hai School, Teacher browser va operational mutation timeout | Queue re-authorize; E2E xac nhan focus error, switch guard/reconciliation va khong co mutation/fee UI. | Test fail neu queue exposure vuot scope hoac session/audience bi dung cheo. |

</intent-contract>

## Code Map

- `apps/api/src/modules/attendance/attendance.controller.ts` -- `teacherOperationalQueue` va `teacherOperationalQueueItems` la REST surface Teacher can dung lai; khong tao route moi.
- `apps/api/src/modules/attendance/attendance.service.ts` -- `operationalQueue`, `operationalQueueItems` va `queueActor` da validate date/status/Class va capability/assignment theo request.
- `apps/api/src/integration/attendance.integration.test.ts` -- regression PostgreSQL cho queue counts, Class scope va revoke; bo sung Teacher-specific assertion neu coverage chua bao phu matrix.
- `apps/teacher-web/src/school-context.tsx` -- shell chi render workspace tu server navigation va owner School switch guard; diem gan `overview` queue.
- `apps/teacher-web/src/attendance/attendance-workspace.tsx` va `apps/web/src/attendance/operational-queue-workspace.tsx` -- mau Teacher refresh/reconciliation va Admin queue read-only de adapt, khong import portal kia.
- `apps/teacher-web/src/school-context.test.tsx` va queue workspace test moi -- proof navigation server-driven, URL state, error/revoke/switch stale clearing.
- `apps/api/scripts/seed-e2e-release-gate.ts` -- them `OPERATIONAL_QUEUE_READ` va queue facts cho Teacher two-School fixture.
- `apps/web/e2e/release-gate.spec.ts` -- browser release proof Teacher audience, queue URL detail, safe switch/revoke va no-mutation boundary.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/teacher/teacher.html` -- reviewed Teacher queue visual/interaction contract; giu mobile-first table/card behavior.

## Tasks & Acceptance

**Execution:**
- `apps/teacher-web/src/attendance/operational-queue-workspace.tsx` va CSS/test moi -- adapt read-only queue theo Teacher endpoints, URL filters, loading/error/empty/revoke state va accessible table/card UI theo mockup.
- `apps/teacher-web/src/school-context.tsx` va test -- render queue chi khi server navigation co `overview`; reset protected queue/list state qua School switch va permission refresh.
- `apps/api/src/integration/attendance.integration.test.ts` -- prove Teacher `OPERATIONAL_QUEUE_READ`, Class scope va capability/binding/assignment revoke khong tra queue/list protected data.
- `apps/api/scripts/seed-e2e-release-gate.ts` va `apps/web/e2e/release-gate.spec.ts` -- tao two-School queue fixture va browser proof URL detail, error focus, stale clearing, no mutation/fee va timeout reconciliation.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chi mark `4.10` done sau review va verification pass.

**Acceptance Criteria:**
- Given Teacher co navigation `overview` server-returned va authorization active, when mo Hang doi lop, then UI render queue read-only theo mockup voi School/date/Class scope va counts/status server-confirmed.
- Given Teacher mo queue card, when URL chua date/classId/status, then API re-authorize va UI chi hien filtered list read-only; foreign Class, missing grant hay assignment khong the expose data.
- Given response fail, permission bi revoke hoac School doi, when portal refresh/request tiep theo, then context an toan duoc giu va protected state cu bi xoa, khong co zero suy dien hay stale cross-School rows.
- Given integration va browser release gate chay voi Teacher two-School fixture, when queue va operational mutation scenarios duoc kiem tra, then queue isolation/revoke/URL/focus/no-mutation proof va timeout reconciliation deu pass.

## Design Notes

Teacher queue la ham read-model cua `attendance`, khong phai shortcut vao mutation workspace. Navigation `overview` la projection capability server cap; client khong hard-code permission. Cards la destination link, detail la list; ca hai deu can re-authorize server-side.

## Verification

**Commands:**
- `pnpm --filter @passionedu/teacher-web test` -- expected: queue UI, URL state, error/revoke/switch behavior pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL Teacher queue tenant/Class/revoke matrix pass.
- `set -a && source .env.test && set +a && pnpm test:release-gate` -- expected: browser release gate including Teacher queue pass.
- `pnpm typecheck && git diff --check` -- expected: workspace types va whitespace pass.

## Auto Run Result

Status: done

Summary: Da them Teacher operational queue read-only, reuse API queue va server navigation `overview`, giu URL `date/classId/status`, clear toan bo Teacher protected context khi queue bi deny, va mo rong fixture/integration/browser release proof.

Verification performed:
- `pnpm --filter @passionedu/teacher-web test` -- pass: 17 tests.
- `pnpm --filter @passionedu/teacher-web typecheck` -- pass.
- `pnpm --filter @passionedu/api typecheck` -- pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration` -- pass: 114 PostgreSQL integration tests.
- `git diff --check` -- pass.
- `set -a && source .env.test && set +a && pnpm test:release-gate` -- pass: API integration 114, Admin unit 98, Teacher unit 17, Parent unit 4, Ops unit 6 va Playwright 9 scenarios, bao gom Teacher queue URL/detail, denial fallback, stale clear va no-mutation boundary.

Review findings: applied 4 patch findings (high 2, medium 2); deferred 0; rejected 0. Follow-up review is recommended: patch score 8.

Residual risk: Queue UI va API release proof xanh. Kich thuoc Vite chunk Admin lon hon 500 kB la warning build co san, khong fail gate.

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4 (high 2, medium 2)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high]` `[patch]` Queue denial gio clear toan bo Teacher protected context va hydrate lai chooser thay vi chi hien error noi bo.
  - `[high]` `[patch]` PostgreSQL integration cover ca queue detail sau assignment va capability revoke.
  - `[medium]` `[patch]` Queue URL state dung browser history va restore detail khi Back/Forward.
  - `[medium]` `[patch]` Admin foreground chooser refresh clear protected context neu School da bi rut quyen.

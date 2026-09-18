---
title: 'Hoàn tất review repairs cho Story 2.5 roster transition và close-year'
type: 'bugfix'
created: '2026-09-18'
status: 'done'
baseline_commit: '6e70bf763079f3ddfe613e44ae6ebbf6c5bfa39e'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/spec-2-5-chuyen-lop-chuyen-nam-va-close-year-bang-preview-co-doi-soat.md'
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Phan implementation dang do cua Story 2.5 chua bao toan finality khi close-year, co the de placement nguon mo sau year transition, va Admin UI binding/coverage chua du de su dung transition an toan.

**Approach:** Hoan tat cac invariant service transaction, close-year read-only boundary va Admin preview/confirmation surface, sau do bo sung proof controller, browser va PostgreSQL cho cac failure/race da duoc review phat hien.

## Boundaries & Constraints

**Always:** School la tenant root; resolve `ROSTER_MANAGE` truoc lookup va recheck membership/School active trong transaction. Placement dung `[effectiveFrom,effectiveTo)` theo `Asia/Ho_Chi_Minh`; class/year transition dong placement nguon dung effective date va giu enrollment/snapshot nguon. Close-year khoa va revalidate write set trong transaction, sau do roster cua nam da dong chi doc. Preview POST va command deu qua Origin/double-submit CSRF; command dung idempotency/Operation va timeout chi reconcile. UI chi render server-confirmed placement/history, khong force selected excluded record hay render stale School/SchoolYear state.

**Ask First:** Khong co quyet dinh nghiep vu con mo; dung canonical Story 2.5 contract va blocked spec lam authority.

**Never:** Khong reset/revert cac thay doi Story 2.5 dang co; khong update sprint status truoc khi full verification pass; khong cho mutation sau close-year, khong ghi de source enrollment/class snapshot, khong auto-replay timeout, khong them lifecycle/authorization ngoai Story 2.5.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Year transition | Placement nguon mo, nam/lop dich successor hop le | Dong placement nguon va tao enrollment/placement dich atomically | Preview stale, duplicate destination, graph sai hoac nam dong fail khong co write mot phan |
| Close-year race | Transition va close-year cung tranh cap nhat nam | Mot command commit tren write set da khoa; command con lai conflict/review lai | Khong con placement mo sai, khong mutation sau close |
| Closed-year mutation | Rename/archive class, lifecycle, assignment hoac transition sau close | API va UI chi cho xem lich su | Tra stable conflict, khong doi durable state |
| Admin wizard | Preview co movable/excluded, doi School/Year, timeout | State source/doc lap, mot destination control dung ngữ canh, named confirmation va reconcile | Field errors/preview giu duoc, stale response bi bo, khong POST lai |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/roster/roster.service.ts` -- `transitionEnrollments`, `transitionPreview`, `previewCloseYear`, `closeYear`, `openYear`, class/lifecycle/assignment writes la cac finality va locking anchors.
- `apps/api/src/modules/roster/roster.controller.ts` va `roster.controller.test.ts` -- preview POST CSRF/delegation boundary.
- `apps/api/src/integration/roster.integration.test.ts` -- PostgreSQL proof cho source closure, stale/foreign inputs, rollback va transition-close race.
- `apps/web/src/roster/roster-workspace.tsx` -- tách transition state, generation guard, preview error/reconcile, closed-year read-only va placement history.
- `apps/web/src/roster/roster-workspace.test.tsx` -- browser proof cho wizard, excluded rows, timeout, stale context va close-year.
- `apps/api/prisma/migrations/20260918000003_roster_close_year_finality/migration.sql` -- existing School-scoped close provenance va temporal bounds trigger; khong tao migration thay the neu service invariant du.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/modules/roster/roster.service.ts` -- refactor preview/revalidation de dung transaction client va lock SchoolYear/placement theo ordering nhat quan; close source placement ca class/year transition; guard tat ca roster write cua nam dong -- dam bao atomic finality va race safety.
- [x] `apps/api/src/modules/roster/roster.controller.ts` va `roster.controller.test.ts` -- bao ve va prove preview CSRF/delegation -- moi cookie POST deu qua mutation boundary.
- [x] `apps/api/src/integration/roster.integration.test.ts` -- mo rong temporal, tenant, stale, rollback va concurrent close proofs -- PostgreSQL chay cac matrix row quan trong.
- [x] `apps/web/src/roster/roster-workspace.tsx` va `roster-workspace.test.tsx` -- sua binding/state/error/history/read-only va prove preview-confirm-reconcile -- Admin chi co the hoan tat server-authoritative flow.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- danh dau `2-5` done va cap nhat timestamp chi sau khi tat ca verification dat.

**Acceptance Criteria:**
- Given an `ENROLLED` Student moves to a successor SchoolYear, when the confirmed command commits, then source placement ends exactly at the effective date, source enrollment remains readable, and exactly one destination enrollment/placement is created.
- Given close-year and a transition contend for the same SchoolYear, when both commands execute, then locking/revalidation lets only a consistent write set commit and the losing command leaves no partial enrollment or open placement.
- Given a SchoolYear is closed, when any roster mutation targets it, then API rejects it and Admin exposes history as read-only while preserving placement/lifecycle history.
- Given a transition or close preview includes validation errors, excluded rows, uncertain command result, or stale context, when the Admin responds, then it preserves usable server feedback, submits only valid preview selections after typed confirmation, reconciles once after timeout, and never renders stale data.

## Spec Change Log

- 2026-09-18: Hoan tat repair finality: command khoa SchoolYear theo thu tu nhat quan, close preview duoc revalidate trong transaction, year transition dong placement nguon, roster writes nam da dong bi chan, va Admin render nam da dong read-only.
- 2026-09-18: Final review repairs: placement temporal duoc dung cho class roster/history, mutation va close-year dung chung year lock, provenance close Operation duoc rang buoc composite theo School, va wizard co preview/confirmation/reconcile/stale-response proof.
- 2026-09-18: Final-review repairs: closeOperationId co FK toi Operation; service van tao School-scoped Operation truoc khi ghi close provenance, nen FK khong tao vong phu thuoc. Database FK khong bieu dien duoc cung School qua Operation.id don nhat, nhung service ghi operation trong cung School-scoped transaction.

## Design Notes

Lock source and destination SchoolYears before their Classes and placements for every command. This gives transition and close-year a shared serialization boundary. Preview remains read-only, but command recomputes it through the same helper using the locked transaction client before comparing its fingerprint. `StudentEnrollment.classId` stays a historical enrollment snapshot; current placement/listing/history must derive from `EnrollmentClassAssignment`.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: schema and migrations generate client.
- `pnpm --filter @passionedu/api test` -- expected: controller/service route suites pass.
- `pnpm --filter @passionedu/admin-web test` -- expected: transition and close-year browser tests pass.
- `set -a && . apps/api/.env && set +a && pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL finality/race suite passes.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- expected: workspace quality gates pass.
- `git diff --check` -- expected: no whitespace errors.

## Review Result

- Final adversarial review: khong con finding high-severity ve tenant graph, close-year locking, temporal transition, roster class filter hay UI request contract.
- Patches da ap dung trong cac vong review: source placement closure, locked close-year revalidation, closed-year immutable writes, composite School-Operation provenance, current class roster filter, temporal lifecycle closure, va Admin stale/timeout handling.

## Auto Run Result

Status: done

Da hoan tat Story 2.5: class/year transition va close-year server-authoritative, temporal placement history, School-scoped Operation/audit, preview confirmation/reconciliation va Admin read-only history sau close-year. Tracker Story 2.5 da chuyen sang `done`.

Verification passed:

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- `set -a && . apps/api/.env && set +a && pnpm --filter @passionedu/api test:integration` -- 6 files, 58 tests
- `pnpm --filter @passionedu/admin-web test` -- 4 files, 43 tests
- `git diff --check`

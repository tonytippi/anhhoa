---
title: 'Story 2.5: Chuyển lớp, chuyển năm và close-year bằng preview có đối soát'
type: 'feature'
created: '2026-09-18'
status: 'blocked'
baseline_revision: '6e70bf763079f3ddfe613e44ae6ebbf6c5bfa39e'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/roster-transition.html'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Danh bo chua the chuyen lop hoac chuyen nam hoc ma giu lich su lop hoc, va chua co quy trinh close-year duoc server doi soat. Ghi de `StudentEnrollment.classId` se lam mat nguon lich su, trong khi tao enrollment thu hai cung nam bi chan boi unique invariant.

**Approach:** Them lich su phan lop temporal va close-year provenance, sau do cung cap server-authoritative preview va transactional command cho class transfer, year transition, close-year. Admin workspace thuc hien wizard preview, named confirmation va Operation reconciliation, khong co optimistic state.

## Boundaries & Constraints

**Always:** Resolve `ROSTER_MANAGE` truoc lookup; moi relation, query, write, audit va Operation scope theo School da resolve. Date dung `Asia/Ho_Chi_Minh` va interval `[effectiveFrom,effectiveTo)`. Source enrollment/assignment va snapshot luon doc duoc; destination chi tao khi server chap thuan. Command high-impact bat buoc UUID `Idempotency-Key` va `X-Operation-Id`, recheck active School Admin trong transaction, audit actor/reason/provenance, replay fingerprint trung va reject reuse khac fingerprint. Cookie mutation phai qua Origin + double-submit CSRF.

**Block If:** PostgreSQL khong the enforce tenant graph, interval history va close-year one-time state ma khong lam yeu migration contract cua danh bo.

**Never:** Khong tin client verdict/selected excluded record/School ID lam authorization; khong ghi de source `classId` de gia lap lich su; khong force move excluded record; khong auto-replay sau timeout; khong dat `GRADUATED` khi close-year; khong them Teacher authorization, finance/attendance behavior, hay hard-delete roster history.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Preview chuyen lop | Enrollment `ENROLLED`, lop dich active cung SchoolYear, ngay/reason hop le | Tra per-student movable/excluded, source history, destination va preview fingerprint | Foreign/archived/wrong-year/lifecycle invalid bi exclude hoac validation, khong write |
| Xac nhan transition | Preview con hien hanh, named confirmation, UUID keys | Transaction ket thuc assignment nguon va tao assignment/enrollment dich; audit, Operation completed | Preview stale, mapping khac, overlap hay graph sai tra conflict va buoc preview lai |
| Chuyen nam | Source `ENROLLED`, lop dich active nam dich | Tao enrollment moi nam dich, giu enrollment nam nguon va snapshots | Student da co enrollment nam dich bi exclude, khong tao trung |
| Close-year | Year chua dong, selected assignment/enrollment hop le | Ket thuc assignment lop, danh dau close va giu enrollment `ENROLLED` doc duoc | Close lai/concurrent change fail atomically, khong graduation |
| Timeout/context change | POST uncertain hay doi School/SchoolYear | Chi reconcile Operation cua actor, refresh server-confirmed state | Khong replay POST va khong render preview/row stale |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `StudentEnrollment` dang chi co `classId`; them assignment temporal va close-year provenance/relation, giu composite School graph.
- `apps/api/prisma/migrations/20260917000001_student_enrollment_history/migration.sql` -- mau DATE/FK/snapshot; migration moi dung exclusion `[)` cho enrollment class assignment.
- `apps/api/src/modules/roster/roster.service.ts` -- owner cua authorization, DTO, lock, audit va `mutate()`; them preview, revalidation va batch writes.
- `apps/api/src/modules/roster/roster.controller.ts` -- them read preview va mutation routes, giu `mutation()` boundary.
- `apps/api/src/modules/roster/roster.controller.test.ts` va `apps/api/src/integration/roster.integration.test.ts` -- proof CSRF va PostgreSQL tenant/history/idempotency/concurrency.
- `apps/web/src/roster/roster-workspace.tsx` -- reuse generation guard, `post()` uncertain reconciliation, error summary va switch status de them wizard.
- `apps/web/src/roster/roster-workspace.test.tsx` -- them accessible preview/confirmation, excluded rows, timeout, stale context proof.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma` va migration moi -- persist EnrollmentClassAssignment temporal, SchoolYear close metadata va composite tenant/date/exclusion constraints -- DB bao toan source history va chan overlap/cross-tenant.
- `apps/api/src/modules/roster/roster.service.ts` va `roster.controller.ts` -- implement School-scoped preview, class transfer, year transition, close-year -- server revalidates preview/current graph under locks, writes atomically and returns reconciliation outcome.
- `apps/api/src/modules/roster/roster.controller.test.ts` va `apps/api/src/integration/roster.integration.test.ts` -- cover mutation boundary, graph, interval/history, excluded candidates, replay/collision and batch rollback.
- `apps/web/src/roster/roster-workspace.tsx` va `roster-workspace.test.tsx` -- add accessible transition wizard with source/destination/date/reason, server preview, typed named confirmation and pending reconciliation -- browser cannot force excluded candidates or stale data.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- mark Story 2.5 done only after all checks pass.

**Acceptance Criteria:**
- Given a permitted School Admin, when the transition wizard requests a preview, then each candidate is server-categorized with source history, destination, effective date and reason, and a client cannot confirm an excluded record.
- Given a confirmed valid class transfer or year transition, when its idempotent command commits, then source records remain readable, only approved destination assignments/enrollments exist, all writes/audits share the School-scoped Operation, and changed idempotency reuse conflicts.
- Given a SchoolYear is closed, when roster history is read later, then class assignments are ended and enrollment history remains `ENROLLED`; close-year neither graduates children nor permits a duplicate/concurrent close.
- Given invalid graph/date/lifecycle, stale preview, timeout, or changed School/SchoolYear, when API or UI handles it, then no invalid batch is durable, inputs/preview are preserved where applicable, reconciliation precedes retry, and stale context never renders.

## Spec Change Log

## Review Triage Log

### 2026-09-18 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 18: (high 7, medium 9, low 2)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high] [patch]` Them CSRF cho preview, temporal placement read, tenant FK close provenance va trigger temporal bounds.
  - `[high] [patch]` Chua hoan tat close-year finality, transition locking va UI/test repair truoc khi timebox autonomous run ket thuc.

## Design Notes

`StudentEnrollment.classId` remains the original enrollment snapshot for compatibility while `EnrollmentClassAssignment` is the authoritative temporal placement. Creating an enrollment also creates its first assignment. A preview fingerprint is derived from a canonical server snapshot and must match the command's freshly recalculated preview; this prevents a client from converting a previously excluded or stale row into a mutation target.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: generated Prisma client accepts roster transition schema.
- `pnpm --filter @passionedu/api test` -- expected: roster controller and unit suites pass.
- `set -a && . apps/api/.env && set +a && pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL transition invariant suite passes with configured DB.
- `pnpm --filter @passionedu/admin-web test` -- expected: roster UI tests pass.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- expected: workspace gates pass.
- `git diff --check` -- expected: no whitespace errors.

## Auto Run Result

Status: blocked

Blocking condition: Review repair chua hoan tat. Con lai source placement closure cho `YEAR_TRANSITION`, guard va serialization sau close-year, revalidation preview trong transaction, transition-vs-close race safety, UI transition state/binding/read-only/history, va test controller/browser/integration tuong ung. Khong cap nhat sprint tracker de tranh bao `done` sai.

Da hoan tat mot phan: `EnrollmentClassAssignment` temporal history, preview/command API, Operation idempotency, close-year provenance, CSRF preview, placement read authoritative, va PostgreSQL temporal bounds. Da pass `pnpm --filter @passionedu/api prisma:generate`, `pnpm --filter @passionedu/api typecheck`, `pnpm --filter @passionedu/admin-web typecheck`; truoc review repair, full workspace gates va integration suite da pass voi 52 integration tests.

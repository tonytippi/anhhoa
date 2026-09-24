---
title: 'Story 4.7: Kiểm thử release gate cho vận hành lớp'
type: 'feature'
created: '2026-09-24'
status: 'draft'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
  - '_bmad-output/implementation-artifacts/decision-story-4-7-present-overrides-confirmed-leave-2026-09-24.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Release owner can only release class operations when automated PostgreSQL and portal proof establishes the authorization, conflict, evidence-retention, notification, and finance-boundary invariants. The current suite contains useful focused coverage but no composed Story 4.7 release-gate fixture or attendance/handover browser proof.

**Approach:** Extend the dedicated PostgreSQL and browser release gates using a two-School operational fixture, proving the Story 4.7 matrix at API and portal surfaces without weakening authorization, evidence, idempotency, or Finance ownership boundaries.

## Boundaries & Constraints

**Always:** Use `.env.test` for database-backed verification. Prove authorization from active same-School binding, StaffProfile, primary Position, typed capability, and effective Class assignment where required; never from `staffType`, role names, URL state, or browser state. Preserve School-scoped PostgreSQL reads/writes/audit/Operation behavior, Parent evidence minimization, server-confirmed portal errors, reconciliation, switch guarding, and the separation between operational facts and Finance pricing/materialization.

**Block If:** A requested release-gate change would make a confirmed leave effective or Finance-source eligible after an authorized `PRESENT` record for the same Student/day.

**Never:** Do not reject an otherwise valid `PRESENT` solely because a confirmed short leave exists, rewrite leave history, add Parent delivery testing before Epic 7, expose evidence to Parent, introduce automatic fee UI/pricing, or move Finance source-target/duplicate-adjustment ownership into attendance.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Operational release fixture | Two Schools with effective policy, enrollment, leave, evidence, capability, Position, binding, assignment, and immutable source facts | API tests prove authorized actions and all required tenant/capability/evidence/retention boundaries | Rejected requests create no unauthorized record, audit, or Operation outcome |
| Attendance/handover browser flow | Teacher switches Schools or receives server validation, conflict, denial, or timeout | UI renders server-confirmed reason, focuses accessible error, protects switch state, and reconciles retained Operation before retry | It never infers success, local override, zero state, fee, or stale cross-School class data |
| Confirmed leave and `PRESENT` | A confirmed leave already exists for the same Student/day and an authorized valid attendance write records `PRESENT` | `PRESENT` is the effective operational state; leave history remains auditable but is excluded from effective leave and immutable Finance-source meaning | Other calendar, evidence, capability, Class, tenant, and idempotency errors remain rejected |

</intent-contract>

## Code Map

- `apps/api/src/integration/attendance.integration.test.ts` -- PostgreSQL fixture and service-level operational proof; extend authorization, class scope, handover, evidence, cleanup, notification, and no-write assertions after the blocked rule is decided.
- `apps/api/src/integration/release-gate.integration.test.ts` -- authenticated release-gate HTTP fixture currently covers roster authorization only; add Parent-negative routes and attendance-domain authorization proof, or create a focused sibling release-gate suite.
- `apps/api/src/modules/attendance/attendance.service.ts` -- `teacher()`, `handoverTeacher()`, `teacherList()`, evidence readers, and `attendanceFacts()` implement the operational boundaries; current `attendanceFacts()` treats `PRESENT` as winning over confirmed leave.
- `apps/api/scripts/seed-e2e-release-gate.ts` -- two-School seed lacks attendance/handover policies, effective assignments, evidence, leave, and relevant teacher grants required by Story 4.7 browser coverage.
- `apps/web/e2e/release-gate.spec.ts` -- generic portal E2E lacks attendance/handover flow, operational timeout reconciliation, validation/conflict, and workspace switch assertions.
- `apps/teacher-web/src/attendance/attendance-workspace.tsx` and `attendance-workspace.test.tsx` -- attendance waits for server refresh but needs error-focus and switch/reconciliation coverage parity with handover.
- `apps/teacher-web/src/handover/handover-workspace.test.tsx` and `school-context.test.tsx` -- extend server denial/timeout/dirty-switch and capability-navigation evidence.
- `apps/api/src/modules/finance/` -- source-target mismatch and duplicate adjustment remain Finance-owned materialization proof; attendance only issues/excludes immutable source facts.

## Tasks & Acceptance

**Execution:**
- `apps/api/src/integration/attendance.integration.test.ts` and `apps/api/src/integration/release-gate.integration.test.ts` -- add explicit two-School PostgreSQL and authenticated API release evidence for the complete Story 4.7 authorization, evidence, cleanup, notification, Parent-minimum-DTO, and Finance-boundary matrix, including `PRESENT` precedence/source exclusion -- prevents a composed gate from relying on implementation assumptions.
- `apps/api/scripts/seed-e2e-release-gate.ts`, `apps/web/e2e/release-gate.spec.ts`, and Teacher workspace tests -- seed operational fixtures and prove attendance/handover capability, validation, reconciliation, accessibility, and School-switch behavior through real portal boundaries -- closes the current E2E gap.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- change Story 4.7 to `done` only after the decision is recorded and all release-gate commands pass -- keeps sprint tracking truthful.

**Acceptance Criteria:**
- Given a two-School PostgreSQL fixture, when the Story 4.7 release suite runs, then every specified authorization, evidence, cleanup, notification, Parent DTO, and Finance-boundary rejection is asserted at its owning API or database surface, while valid `PRESENT` wins over confirmed leave and excludes its effective/source meaning.
- Given the seeded Teacher release fixture, when attendance and handover encounter missing capability, validation/conflict, timeout, and School switch, then the browser shows the server-confirmed accessible state, reconciles Operations, and contains no fee UI, local override, or stale cross-School data.

## Auto Run Result

Status: draft

Resolved decision: `decision-story-4-7-present-overrides-confirmed-leave-2026-09-24.md` establishes that a valid authorized `PRESENT` is an operational correction with highest precedence. The confirmed leave remains auditable but is excluded from effective leave and immutable Finance-source meaning.

## Verification

**Commands to run after the decision and implementation:**
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test` -- expected: attendance unit tests pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration` -- expected: dedicated PostgreSQL target applies migrations and all integration release evidence passes.
- `pnpm --filter @passionedu/teacher-web test` -- expected: Teacher workspace capability, accessible error, reconciliation, and School-switch tests pass.
- `set -a && source .env.test && set +a && pnpm test:release-gate` -- expected: configured API, portal, and browser release gate passes.
- `pnpm typecheck && git diff --check` -- expected: workspace types and whitespace validation pass.

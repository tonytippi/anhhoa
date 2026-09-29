---
title: 'Story 7.4: Parent tạo và quản lý leave request được phép'
type: 'feature'
created: '2026-09-27'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '6181212f188bfc755a5ae33265e64ea546b7f081'
context:
  - '_bmad-output/implementation-artifacts/epic-7-context.md'
  - '_bmad-output/implementation-artifacts/decision-story-7-4-parent-leave-lifecycle-2026-09-27.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/parent/parent.html'
---

<frozen-after-approval reason="human-owned intent -- do not modify unless human renegotiates">

## Intent

**Problem:** Parent can create a short leave request but cannot manage a pending request, and the existing create path does not reject a day already confirmed `PRESENT`. Deleting a pending request would erase operational history and using rejection for withdrawal would misrepresent the lifecycle.

**Approach:** Add the terminal `CANCELLED` lifecycle and Parent-only pending edit/cancel commands, all through the existing CSRF/idempotency/Operation boundary. Revalidate calendar, enrollment, active link and `PRESENT` on every create/edit; render the reviewed child-detail leave form and pending controls from server responses only, reconciling Operations before a timeout retry.

## Boundaries & Constraints

**Always:** API remains authority for authorization, HCM calendar/policy, transition, audit, Operation and Parent DTO. Create/edit/cancel require Parent audience, bound ParentProfile, active School/StudentParent link, valid UUID `Idempotency-Key` and `X-Operation-Id`, Origin validation and double-submit CSRF. Only originating ParentProfile can act and only `PENDING` can edit/cancel. Edit stays `PENDING`, re-snapshots server calendar/policy/date facts and rejects confirmed `PRESENT`; cancel persists `CANCELLED` without hard-delete. UI retains field input/error, uses 44px targets, focus management and server-confirmed states.

**Ask First:** Stop if a change needs edit auto-approval, cancellation of a terminal request, long-leave/preservation behavior, service/finance effect, another lifecycle state, new Parent policy field, or a departure from the reviewed `Đơn xin nghỉ` interaction.

**Never:** Do not expose Staff identity, deadline/approval internals, audit/reason, evidence, finance outcome or attendance mutation. Do not issue `LeaveDaySource`, Finance adjustment, service/enrollment change or long-leave workflow for pending create/edit/cancel. Do not optimistic-complete or retry an uncertain mutation with a new key before GET Operation reconciliation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create | Active Parent child and valid short range | Server returns only Parent leave result; late submission may be pending per existing policy | Non-operating-only, enrollment/policy/link/PRESENT conflict has field/server error with retained form input |
| Pending edit | Originating Parent owns `PENDING` request | Revalidate and replace operating/calendar/policy snapshots; state stays `PENDING` | Terminal/foreign/sibling/revoked request denies without changing history |
| Pending cancel | Originating Parent owns `PENDING` request | Persist terminal `CANCELLED`, audit and Operation outcome; no source/finance effect | Confirmation focus returns; repeat/retry replays identical Operation only |
| Timeout | Mutation response uncertain | Keep Operation ID, disable duplicate submit and reconcile GET operation before retry | No local success/failure claim until server terminal outcome |
| Context loss | `401`/denied/revoke/Switch during form or reconciliation | Clear form/list/dialog/pending operation before safe fallback | No stale request or child data renders |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/` -- add `CANCELLED` to leave lifecycle and preserve tenant/database constraints.
- `apps/api/src/modules/attendance/attendance.service.ts` -- `create()`, `leaveCreateFacts()`, `parentMutate()`, `parentList()`, `parentRead()` and `parentOperation()` are the Parent lifecycle, validation and reconciliation boundary.
- `apps/api/src/modules/attendance/attendance.controller.ts` -- existing Parent create/list/read/operation endpoints and `mutation()` provide route/audience/CSRF/idempotency shape for edit/cancel.
- `apps/api/src/modules/common/mutation-protection.ts` -- cookie mutation Origin/CSRF/UUID validation; retain before service invocation.
- `apps/api/src/integration/attendance.integration.test.ts` and `apps/api/src/integration/release-gate.integration.test.ts` -- extend PostgreSQL/HTTP lifecycle, tenant, source-effect and operation proof.
- `apps/parent-web/src/auth-session.ts` -- extend Parent JSON mutation helper for method/body/idempotency/operation and safe Operation GET reconciliation.
- `apps/parent-web/src/main.tsx` -- existing protected child/detail workspace owns form, modal, abort/generation, focus and fallback; add only leave UI in child detail.
- `apps/parent-web/src/shell.test.tsx` and `apps/parent-web/src/auth-session.test.ts` -- cover field errors, pending-only affordances, timeout reconciliation, safe clear and transport headers.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` and a new `apps/api/prisma/migrations/*/migration.sql` -- add `CANCELLED` terminal leave status and any database transition protection needed -- preserves append-only Parent withdrawal history.
- [x] `apps/api/src/modules/attendance/attendance.service.ts` and `apps/api/src/modules/attendance/attendance.controller.ts` -- add Parent pending edit/cancel routes/services, route-aware Operation reconciliation and `PRESENT` conflict validation for create/edit -- centralizes lifecycle and mutation authority.
- [x] `apps/api/src/modules/attendance/*.test.ts` and `apps/api/src/integration/{attendance,release-gate}.integration.test.ts` -- prove lifecycle, re-snapshot, source/finance absence, idempotency replay/conflict, concurrency, CSRF, operation/revoke and exact Parent DTOs -- validates transaction/tenant boundary.
- [x] `apps/parent-web/src/{auth-session,main}.ts`, Parent styles and tests -- implement reviewed child-detail form/pending edit/cancel/confirmation and Operation reconciliation with clear-before-fallback -- provides accessible Parent workflow without optimistic authority.
- [x] `apps/web/e2e/release-gate.spec.ts` and release fixture only where needed -- prove create/error/pending management and denied/timeout-safe behavior in deployed Parent shell -- validates browser interaction.

**Acceptance Criteria:**
- Given an active ParentSchoolContext and active link, when Parent creates or edits a short leave request, then the API validates child authorization, enrollment, calendar, policy and confirmed `PRESENT`, and returns only Parent-visible state without internal/finance facts.
- Given a Parent owns a `PENDING` request, when it edits or cancels with valid CSRF/idempotency/Operation headers, then edit remains `PENDING` with fresh server snapshots and cancel becomes `CANCELLED`; neither operation creates leave/finance/enrollment/service side effects.
- Given a request is terminal, cross-School/cross-child/foreign, revoked or has changed idempotency fingerprint, when Parent mutation/reconcile is attempted, then server denies it and no lifecycle/history data changes.
- Given a create/edit/cancel result times out, when Parent reconciles with its retained Operation ID, then UI uses server terminal result before enabling retry and never reports local completion.
- Given Parent views the leave surface, when validation, confirmation, cancellation, revoke or switch occurs, then input/error/focus and protected-state clearing follow the reviewed Parent child-detail flow; no long-leave, preservation, attendance, service or finance affordance exists.

## Design Notes

The `CANCELLED` state represents Parent withdrawal of an unresolved notification, while `REJECTED` remains a School decision. Pending edit reuses the same server validation as create but deliberately does not rerun auto-approval to avoid silently changing the approval workflow. The client keeps an Operation ID across uncertain results and treats any timeout as unknown until reconciliation completes.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate && pnpm --filter @passionedu/api build` -- expected: migration schema/client/API compile.
- `pnpm --filter @passionedu/api test -- attendance.service.test.ts attendance.controller.test.ts --run` -- expected: Parent leave lifecycle unit/controller tests pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration -- --runInBand` -- expected: PostgreSQL lifecycle, source/finance absence and Parent HTTP mutation proof pass.
- `pnpm --filter @passionedu/parent-web test -- --run` -- expected: Parent leave form, reconciliation and fallback tests pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/admin-web exec playwright test --grep "Parent"` -- expected: shared browser harness proves Parent leave interaction.
- `pnpm lint && pnpm typecheck` -- expected: all workspace checks pass.

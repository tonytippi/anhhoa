---
title: 'Story 7.5: Parent tự cập nhật số điện thoại có audit'
type: 'feature'
created: '2026-09-27'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '325ee634ce1e30e557fbaa1904a6e873c9c2f8e8'
context:
  - '_bmad-output/implementation-artifacts/epic-7-context.md'
  - '_bmad-output/implementation-artifacts/decision-story-7-5-parent-phone-contract-2026-09-27.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
---

<frozen-after-approval reason="human-owned intent -- do not modify unless human renegotiates">

## Intent

**Problem:** Parent contact phone is stored on the bound global ParentProfile, but Parents cannot maintain it through the Parent portal. A generic profile mutation would risk changing identity, email binding, links or access and would lack a School-scoped audit/reconciliation trail.

**Approach:** Add a purpose-built, School-authorized phone-only PATCH command and extend the shared Parent Operation reader for its reconciliation. The API trims and validates the existing supported phone format, atomically updates only the bound ParentProfile phone, audits old/new values under the authorizing School and returns a minimum outcome; a minimal accessible profile/contact sheet uses the existing mutation/timeout-safe patterns.

## Boundaries & Constraints

**Always:** Authorize via Parent audience, bound ParentProfile, active School and at least one active StudentParent link in the route School. Update only `ParentProfile.phone`; global phone effect is intentional, while Operation/audit remain scoped to the authorizing School. Trim input and validate `^[0-9+() .-]{6,30}$`. Require Origin, double-submit CSRF, UUID Idempotency-Key and operation ID. Replay equal fingerprint, conflict changed reuse, retain/reconcile uncertain operation before retry, audit actor/timestamp/old/new phone/operation ID, and return only phone outcome. Protected reads/mutations are `private, no-store`.

**Ask First:** Stop if phone normalization/E.164, non-global phone behavior, email/Google/link/access editing, new profile fields/history, a separate Operation endpoint, or a layout beyond the minimal contact sheet is required.

**Never:** Do not accept ParentProfile ID, email, identity, StudentParent, School context or authorization fields in body. Do not use Admin roster endpoint, optimistic completion, client authorization, offline queue or retry with new keys after timeout. Do not expose audit history or other Parent profile data.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid update | Bound Parent with active link in selected School; trimmed valid phone | Only bound ParentProfile phone changes; School-scoped Operation/audit records old/new values | UI renders server-confirmed phone |
| Invalid input | Blank, unsupported chars, <6 or >30 chars | No update/Operation/audit; field error for `phone` | Error summary receives focus; input retained |
| Idempotency | Same Parent/School/route/key/fingerprint repeated | Same Operation/outcome replays; changed phone with same key conflicts | No duplicate audit/write |
| Timeout | Network or timeout/gateway response after submission | Operation ID stays locked; GET reconciliation determines terminal outcome | No new-key retry/local success claim |
| Context loss | Missing CSRF/origin, inactive/revoked link, wrong School or reconciliation after revoke | No write/outcome; protected form/state clears to safe fallback | Email/identity/link/access remain unchanged |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `ParentProfile.phone`, School-scoped `Operation` and `AuditRecord` are existing persistence; no schema change is expected.
- `apps/api/src/modules/parents/parents.service.ts` and `apps/api/src/modules/parents/parents.module.ts` -- owning ParentProfile boundary; add purpose-built phone command and Parent context resolver/controller, not a generic profile mutation.
- `apps/api/src/modules/attendance/attendance.controller.ts` and `attendance.service.ts` -- existing Parent cookie mutation and Operation query patterns; extend shared reconciliation authorization deliberately without duplicate routes.
- `apps/api/src/modules/common/mutation-protection.ts` and `common/audit.ts` -- reuse Origin/CSRF/UUID and audit provenance patterns.
- `apps/api/src/integration/release-gate.integration.test.ts` -- Parent HTTP fixture for two-School authorization, revoke, exact outcome/header/audit and idempotency proof.
- `apps/parent-web/src/auth-session.ts` -- reuse `parentMutation()` unknown/validation handling and Parent GET Operation reconciliation.
- `apps/parent-web/src/main.tsx`, styles and tests -- add independent phone form/operation state to Parent workspace, error focus and safe fallback without coupling leave state.
- `apps/web/e2e/release-gate.spec.ts` -- shared browser proof for field validation, success and timeout reconciliation.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/modules/parents/{parents.service,parents.module}.ts` and a Parent controller -- implement School-authorized phone-only mutation plus minimum profile read/outcome and shared Parent Operation reconciliation extension -- preserves ParentProfile ownership and prevents generic profile writes.
- [x] `apps/api/src/modules/attendance/attendance.service.ts` and controller as needed -- extend the shared Parent Operation reader for phone route while retaining active-link authorization for pending/completed Operations -- avoids duplicate reconciliation endpoint semantics.
- [x] `apps/api/src/modules/parents/*.test.ts`, `apps/api/src/modules/attendance/*.test.ts`, and integration HTTP tests -- prove validation, phone-only update, old/new audit, idempotency/replay/conflict, CSRF/origin, School/link/revoke isolation, no-store and timeout/pending reconciliation -- enforces the mutation boundary.
- [x] `apps/parent-web/src/{auth-session,main}.ts`, styles and tests -- implement minimal phone contact sheet with accessible validation/focus and dedicated Operation lock/polling -- keeps client state safe and non-optimistic.
- [x] `apps/web/e2e/release-gate.spec.ts` -- prove deployed Parent phone validation, successful outcome and timeout reconciliation/lockout -- protects browser workflow.

**Acceptance Criteria:**
- Given a valid Parent session and active School link, when Parent submits a valid phone, then only the bound ParentProfile phone changes and server audits old/new values, actor, timestamp, Operation and authorized School context.
- Given body includes invalid phone or unsupported profile/access fields, when API validates, then it rejects before write with accessible `phone` field error and no identity/email/link/access modification.
- Given missing CSRF/origin, invalid idempotency metadata, wrong School, revoked/no active link or a foreign Operation, when Parent mutates/reconciles, then server denies with no update/audit leakage; valid global phone update remains authorized only through the selected School.
- Given the same idempotency request repeats or changes fingerprint, when API receives it, then it replays the same outcome or returns conflict; timeout/gateway uncertainty stays locked until GET Operation reconciliation returns server state.
- Given Parent opens the contact sheet, when validation, success, timeout or context loss occurs, then field error focus, visible reconciliation state and protected-state clearing meet Parent accessibility/no-cache rules without email, identity, link or audit-history affordance.

## Design Notes

The phone is global by model design, but a current School link is evidence that the Parent may make the mutation and anchors the audit/Operation. Pending phone Operations are readable by the same authorized Parent context even before an outcome exists; completed outcomes are additionally guarded against post-revoke access. The UI has one phone field and no general profile editor.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api build` -- expected: Parent API/controller compiles.
- `pnpm --filter @passionedu/api test -- parents.service.test.ts attendance.service.test.ts attendance.controller.test.ts --run` -- expected: phone/Operation unit-controller behavior passes.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration -- --runInBand` -- expected: Parent phone PostgreSQL/HTTP isolation and audit proof passes.
- `pnpm --filter @passionedu/parent-web test -- --run` -- expected: form/transport/reconciliation/fallback tests pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/admin-web exec playwright test --grep "Parent"` -- expected: shared browser harness proves phone workflow.
- `pnpm lint && pnpm typecheck` -- expected: workspace checks pass.

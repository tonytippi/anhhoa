---
title: 'Story 7.1: Khởi tạo Parent context đa trường an toàn'
type: 'feature'
created: '2026-09-27'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'b402c894029dd5c67f0df678f8fe82408fee3236'
context:
  - '_bmad-output/implementation-artifacts/epic-7-context.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/parent/parent.html'
---

<frozen-after-approval reason="human-owned intent -- do not modify unless human renegotiates">

## Intent

**Problem:** Parent admission is already fail-closed at the API, but the Parent portal currently treats each StudentParent link as a selectable context, initializes an arbitrary protected view, and does not revalidate or clear all protected state on foreground return. This can render a stale School or child surface after a link is revoked.

**Approach:** Keep API admission and its minimum session DTO authoritative, then make the Parent shell own a School-level context lifecycle. A single eligible School enters its home directly; multiple eligible Schools begin at an accessible chooser; every revalidation, denial, logout, switch, and foreground transition clears protected client state before rendering any next safe state.

## Boundaries & Constraints

**Always:** Reuse Parent callback admission and `GET /api/parent/auth/session` as the authority; only active `StudentParent` links in active Schools may appear. Treat URL, selected School, browser state, and client grouping only as selectors. Preserve credentialed `no-store` Parent requests and the PWA denylist. Keep the reviewed mobile-first Parent visual language, visible selected School, route `h1`, focus handling, Vietnamese copy, and no stale protected render before a fallback.

**Ask First:** Stop for a decision if implementation requires changing the final Parent DTO contract, OAuth/cookie audience policy, a persistence schema/migration, or the reviewed mockup's layout/interaction rather than adding the required minimal multi-School chooser state.

**Never:** Do not issue a session, infer access, or expose a School/child from client state; do not add a cross-portal import, service-worker cache for protected data, local placeholder data, optimistic context switch, or any Parent domain mutation. Do not broaden this story into attendance, journal, inbox, leave, phone, or finance projections.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Single-School admission | Session context has one distinct eligible School, with one or more linked children | Enter that School home directly; children are limited to that School; no chooser is rendered | Clear pending/protected views before first render |
| Multi-School admission | Session context has active links at two or more Schools | Render chooser containing each distinct server-authorized School only; no child surface renders until selection | Invalid selection remains unavailable; every future route request re-authorizes server-side |
| Context transition | Parent selects another School or refresh returns a changed context | Clear active child, journal objects, query/memory and prior School UI before entering chooser or the new School | Abort obsolete requests and ignore stale responses |
| Revocation or denial | Foreground refresh, `401`, `403`, expiry, logout, or active link removal | Re-fetch session context; no eligible School goes to signed-out/access-denied; multiple remaining Schools go to chooser | Do not leave old content, dialog, object URL, or retry state visible |
| One link revoked, alternative survives | Active link for the current School is revoked while another School remains eligible | Clear the revoked School and return to chooser with only remaining eligible Schools | Never silently select or display the previous School |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/auth/auth.service.ts` -- `AuthService.callback()` already calls Parent admission before issuing the Parent cookie; preserve the transaction and audience boundary.
- `apps/api/src/modules/parents/parents.service.ts` -- `admit()` locks/rechecks active links and active Schools; `context()` returns the minimum active-link School/child context used for bootstrap.
- `apps/api/src/modules/auth/auth.controller.ts` -- `GET /api/parent/auth/session` is the required revalidation endpoint; logout continues using origin and double-submit CSRF validation.
- `apps/parent-web/src/auth-session.ts` -- Parent session types and credentialed `no-store` bootstrap/logout/fetch boundary; extend only as needed to support lifecycle-safe context refresh.
- `apps/parent-web/src/main.tsx` -- `ParentShell`, `ParentWorkspace`, and `ChildJournal` currently own bootstrap, per-link selection, abort handling, and partial denial cleanup; refactor to School-level selection and centralized protected-state clearing.
- `apps/parent-web/src/styles.css` and `apps/parent-web/src/journal.css` -- preserve the established Parent shell and responsive visual language when introducing chooser/safe state styling.
- `apps/parent-web/vite.config.ts` -- preserve `parentWorkbox` protected-resource denylist and empty runtime caching.
- `apps/parent-web/src/auth-session.test.ts` and `apps/parent-web/src/shell.test.tsx` -- extend client tests for direct entry, chooser, clear-before-fallback, and foreground/session denial behavior.
- `apps/api/src/integration/roster.integration.test.ts`, `apps/api/src/integration/attendance.integration.test.ts`, and `apps/api/src/integration/release-gate.integration.test.ts` -- existing Parent link/revoke and HTTP session fixtures; add only the Story 7.1 multi-School context/revoke proof needed at API level.
- `apps/web/e2e/release-gate.spec.ts` -- existing browser fixture has a Parent with two School contexts; extend or move the Parent-focused assertions without weakening the release gate.

## Tasks & Acceptance

**Execution:**
- [x] `apps/parent-web/src/auth-session.ts` and `apps/parent-web/src/main.tsx` -- derive School groups solely from the server-returned active-link session DTO; replace per-link initial selection with an explicit School chooser/direct-entry state machine, centralized clear/abort cleanup, and foreground revalidation -- prevents stale protected content while retaining server authority.
- [x] `apps/parent-web/src/styles.css` and focused Parent shell markup -- add only the accessible mobile-first chooser/safe-state treatment required by the reviewed Parent shell -- makes authorized School selection visible without changing the approved Parent visual language.
- [x] `apps/parent-web/src/auth-session.test.ts` and `apps/parent-web/src/shell.test.tsx` -- cover one-School direct home, multi-School restricted chooser, School switch cleanup, `401`/logout/revoke safe fallback, and foreground refresh -- proves the I/O matrix at the state-owner boundary.
- [x] `apps/api/src/integration/release-gate.integration.test.ts` and the closest existing Parent graph fixture -- prove session context returns only active eligible Schools, revocation removes the next-request context, and alternate active Schools remain usable -- protects the API authority relied on by the portal.
- [x] `apps/web/e2e/release-gate.spec.ts` or a focused Parent E2E suite -- exercise the server-seeded multi-School chooser and final-link revoke fallback in a browser -- proves no prior protected context remains rendered across lifecycle transitions.

**Acceptance Criteria:**
- Given a Google identity bound to a ParentProfile completes the Parent callback, when it has no active StudentParent link in an active School, then no Parent session is issued and the portal renders only its signed-out/access-denied safe state.
- Given a valid Parent session has active links in exactly one distinct School, when the shell resolves the authorized context, then it enters that School home without a School chooser, including when that School has multiple authorized children.
- Given a valid Parent session has active links at multiple Schools, when the shell resolves context or returns after a School removal, then the chooser lists only distinct server-returned eligible Schools and no protected child surface renders before selection.
- Given the Parent changes School, returns to the foreground, logs out, receives `401`/`403`, expires, or loses a StudentParent link, when session context is refreshed, then requests and protected memory are cleared before a safe fallback; zero Schools leads to signed-out/access-denied and multiple Schools lead to chooser.
- Given a School or child selector is forged or a link is revoked, when a Parent API route is called, then the API re-authorizes from active links on that request and returns no protected data for the denied context.

## Design Notes

The session response can remain link-shaped because it is a minimum authorization projection. The portal may group those links by `schoolId` for display only, but that grouping must never become an authorization cache: every protected read remains under the chosen School route and the server independently rechecks the active link. A single clear function should cancel in-flight work and erase the former context before the shell moves to another route, chooser, or safe signed-out state.

## Verification

**Commands:**
- `pnpm --filter @passionedu/parent-web test -- --run` -- expected: Parent shell/session tests pass without rendering stale protected context.
- `pnpm --filter @passionedu/api test:integration -- --runInBand` -- expected: run with `.env.test`; Parent active-link, multi-School, and revoke assertions pass.
- `pnpm --filter @passionedu/admin-web test:e2e -- --grep "Parent"` -- `@passionedu/admin-web` owns the shared Playwright release harness that starts and asserts the Parent portal; expected: seeded browser flow proves chooser/direct-entry and safe revocation fallback.
- `pnpm lint && pnpm typecheck` -- expected: workspace lint and TypeScript checks pass.

## Suggested Review Order

**Safe Context Lifecycle**

- Clear state and abort requests before every session-derived transition.
  [`main.tsx:39`](../../apps/parent-web/src/main.tsx#L39)

- Group only server-returned links into display-only School contexts.
  [`main.tsx:9`](../../apps/parent-web/src/main.tsx#L9)

- Force a revalidation before School selection or switching.
  [`main.tsx:52`](../../apps/parent-web/src/main.tsx#L52)

**Session Authority**

- Bootstrap context with credentialed no-store request semantics.
  [`auth-session.ts:7`](../../apps/parent-web/src/auth-session.ts#L7)

- Preserve active-link and active-School filtering at the API boundary.
  [`parents.service.ts:425`](../../apps/api/src/modules/parents/parents.service.ts#L425)

**Proof**

- Cover single-School entry, chooser isolation, and foreground denial locally.
  [`shell.test.tsx:15`](../../apps/parent-web/src/shell.test.tsx#L15)

- Prove server context removes a revoked School while retaining another.
  [`release-gate.integration.test.ts:49`](../../apps/api/src/integration/release-gate.integration.test.ts#L49)

- Exercise chooser selection and safe browser fallback after foreground denial.
  [`release-gate.spec.ts:50`](../../apps/web/e2e/release-gate.spec.ts#L50)

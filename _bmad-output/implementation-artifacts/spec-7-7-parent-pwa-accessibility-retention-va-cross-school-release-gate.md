---
title: 'Story 7.7: Parent PWA accessibility, retention và cross-school release gate'
type: 'feature'
created: '2026-09-27'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '59c299463705c835adb05220e44dba9c86420dd3'
context:
  - '_bmad-output/implementation-artifacts/epic-7-context.md'
  - '_bmad-output/implementation-artifacts/decision-story-7-7-parent-release-gate-2026-09-27.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/parent/parent.html'
---

<frozen-after-approval reason="human-owned intent -- do not modify unless human renegotiates">

## Intent

**Problem:** Parent domain stories implement individual authorization and read boundaries, but no Parent-specific release gate proves the full cross-School/retention/PWA/cache/mobile interaction matrix. Mobile navigation is incomplete and leave confirmation lacks a keyboard-safe dialog baseline.

**Approach:** Add a Parent release runner and a deterministic two-School fixture matrix, then make Parent PWA behavior verifiable across API/PostgreSQL/browser/cache/offline states. Complete the reviewed mobile navigation and dialog/focus/touch-target baseline without adding new Parent business features; formal all-portal WCAG and pilot performance remain Story 7.8.

## Boundaries & Constraints

**Always:** Parent release gate proves every request re-authorizes School and returned/requested Student, prevents cross-School/cross-child/UUID/filter/deep-link leakage, and clears protected state before safe fallback on revoke/expiry/denial. Test all Parent read surfaces: context, profile, attendance/journal/media, inbox, leave/Operation, phone/Operation and obligation/payment snapshot. Enforce server retention for operations, inbox, journal/media and Finance. Build/run the actual Parent PWA; authenticated responses/media/payment/evidence must not be stored in Cache Storage or queued offline. Maintain `private, no-store`, Workbox runtime cache empty, API/payment/media/evidence fallback denylist, 44px targets, one `h1`, text status, visible focus, keyboard-only operation and no-hover access.

**Ask First:** Stop if formal all-portal WCAG sign-off, performance benchmark, a new Parent business surface, changed retention policy, expanded payment capability, messaging/contact feature, or navigation outside the approved four mobile items is required.

**Never:** Do not add Parent mutation beyond issued stories, cache protected response/blob/object URL, fall back API/payment/media/evidence to app shell, use client authorization/money calculation, make offline claim successful, expose Finance/operational provenance or weaken denial to a client-only redirect.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tenant/child isolation | Parent has School A/B, authorized child and sibling/foreign IDs | Each Parent API/view returns only active-linked Student in selected School | UUID/filter/route/deep-link denial clears protected UI before chooser/signed-out |
| Retention | Ended enrollment, 30-day journal/media/attendance boundary, 30-day inbox, Finance policy/refund/settlement states | Server returns only records retained by its authoritative policy | Expired list omits and direct detail/media/payment safely denies |
| PWA/cache | Built Parent PWA reads protected APIs/media/payment then goes offline/logs out/revokes | Cache Storage contains no protected request or response; no queued mutation | Offline shows safe non-completion state and no protected residue |
| Mobile accessibility | 360px viewport, keyboard, dialog/form/empty/error views | Four-item navigation, one route h1, text status, 44px controls, focus/error/dialog behavior work without hover | Escape/close returns focus when safe; pending mutation remains locked |
| Obsolete surface | Cancelled/replaced/expired obligation or revoked inbox/media URL | Detail/action disappears and safe fallback is server-confirmed | No stale snapshot/action remains after response race |

</frozen-after-approval>

## Code Map

- `apps/parent-web/src/main.tsx` -- Parent workspace/context/fallback/request lifecycle; add mobile navigation and dialog keyboard/focus baseline without changing domain authority.
- `apps/parent-web/src/styles.css` -- enforce Parent 44px targets and focus styles including `input`; preserve reviewed visual language.
- `apps/parent-web/vite.config.ts` and `vite.config.test.ts` -- Workbox denylist/runtime cache contract and build output proof.
- `apps/parent-web/src/{shell,auth-session}.test.tsx` -- focused unit matrix for focus, dialog, offline/denial and protected-state reset.
- `apps/api/src/integration/{attendance,finance,release-gate}.integration.test.ts` -- deterministic Parent two-School, retention, Finance lineage/DTO and forbidden-mutation HTTP/PostgreSQL gate.
- `apps/api/scripts/seed-e2e-release-gate.ts` -- seeded active/revoked Parents, children, events, media and Finance lifecycle fixture.
- `apps/parent-web/e2e/` and package scripts/config -- Parent-owned browser/PWA release runner and Cache Storage/offline matrix; avoid placing new Parent gate only in Admin project.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/integration/{attendance,finance,release-gate}.integration.test.ts` and Parent fixture helpers -- create/expand deterministic two-School Parent matrix for every issued Parent route, retention boundary, DTO redaction and forbidden mutation -- makes cross-tenant and server-retention proof release-blocking.
- [x] `apps/parent-web/src/main.tsx` and `styles.css` -- add four-item reviewed mobile navigation, 44px targets, input focus and keyboard-safe confirmation dialog behavior -- completes Parent-only mobile accessibility baseline without new business capability.
- [x] `apps/parent-web/vite.config.ts`, tests and Parent PWA browser runner/config -- build/run Parent PWA, assert Workbox/cache/offline protected-data behavior -- proves config matches shipping output.
- [x] `apps/parent-web/src/{shell,auth-session}.test.tsx` and Parent E2E -- test keyboard/focus/error/dialog/mobile/denial/expiry/race states including no stale protected content -- validates client safe-state behavior.
- [x] root/package release scripts and CI-facing test docs as needed -- run Parent-specific API/PWA/browser gate in a repeatable release command -- makes Story 7.7 gate executable independently of Admin E2E.

**Acceptance Criteria:**
- Given Parent fixture with two Schools, multiple children, active/revoked links, event/media/leave/phone/obligation lifecycles, when PostgreSQL/HTTP and Parent release suites run, then every route/UUID/filter/deep-link/mutation is authorized per School and Student; all forbidden fields/actions and cross-context data are denied.
- Given operational/Finance retention boundaries, cancelled/replaced obligation, unresolved settlement/refund and revoke after prior load, when Parent list/detail/media/payment/inbox APIs and browser surfaces run, then server retention/authorization determines visibility and protected state is cleared before fallback.
- Given actual Parent PWA build and protected navigation, when Cache Storage/service worker/offline checks run, then no authenticated API/media/payment/evidence data is cached or queued; no protected fallback or fake completion renders after offline/logout/revoke.
- Given Parent at mobile viewport and keyboard-only interaction, when navigating Today/Inbox/Obligations/Contact, submitting error form or opening leave confirmation, then one route heading, text status, 44px targets, input/dialog focus management, Escape/focus return and no-hover operation pass.
- Given Parent payment instruction/notification is unauthorized, obsolete, expired, cancelled or revoked, when it is opened/raced/refreshed, then detail/action is absent and a server-confirmed safe fallback renders; Epic 7 cannot complete while any Parent gate assertion fails.

## Design Notes

This story is a Parent release gate, not a new product domain. Four-item mobile navigation wires existing views: Contact only opens existing phone contact sheet. The gate proves PWA behavior from a real Parent build, because Workbox config alone cannot prove cached response absence. Story 7.8 owns formal all-portal WCAG and pilot performance.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test:integration -- --runInBand` with `.env.test` -- expected: Parent cross-School/retention/Finance HTTP/PostgreSQL matrix passes.
- `pnpm --filter @passionedu/parent-web test -- --run` -- expected: Parent keyboard/focus/dialog/mobile/safe-state unit tests pass.
- `pnpm --filter @passionedu/parent-web build` -- expected: real PWA build succeeds with Workbox output.
- Parent PWA release command added by this story -- expected: browser mobile/cache/offline/revoke release matrix passes.
- `pnpm lint && pnpm typecheck` -- expected: workspace checks pass.

---
title: 'Story 7.2: Parent xem Today, attendance và DailyJournal được ủy quyền'
type: 'feature'
created: '2026-09-27'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: 'ec64fc1be986b86afe69fbc27a32d90fa105dae6'
context:
  - '_bmad-output/implementation-artifacts/epic-7-context.md'
  - '_bmad-output/implementation-artifacts/decision-story-7-2-parent-attendance-history-2026-09-27.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/parent/parent.html'
---

<frozen-after-approval reason="human-owned intent -- do not modify unless human renegotiates">

## Intent

**Problem:** The Parent shell can establish a safe School context but provides no server-authorized daily child view. Parents therefore cannot see attendance or the current DailyJournal without either relying on placeholder content or exposing operational fields that are not theirs.

**Approach:** Add a narrow Parent attendance projection for one active linked child over a server-validated maximum 31-day range, and integrate it with the existing re-authorized DailyJournal/media projections. Render mobile-first Today cards and a child/date detail only from these read models; lazy-load media after an explicit action and clear all child data and object URLs before any context denial or transition.

## Boundaries & Constraints

**Always:** Keep all Parent reads under `/api/parent/schools/:schoolId/`; re-authorize bound ParentProfile, active School, and active StudentParent for each requested/returned child. Enforce `Asia/Ho_Chi_Minh`, ISO dates, ordered inclusive range of at most 31 days, and server-side operational retention. Attendance DTOs contain only child ID/display-name snapshot, date, `PRESENT | ABSENT | ON_LEAVE | NOT_RECORDED`, necessary update time, and optional non-operating calendar label. Reuse the existing DailyJournal current-version/media authorization and `private, no-store` response rules. Preserve the Story 7.1 context lifecycle, Parent Workbox denylist, one route `h1`, focus, explicit Vietnamese text status, 44px targets, and loading/error/denied states.

**Ask First:** Stop if delivery requires changing the finalized range/DTO decision, DailyJournal retention policy, School calendar semantics, attendance/leave precedence, Parent session/cookie policy, or reviewed Parent visual interaction beyond a Today card and child/day detail.

**Never:** Do not expose Class, Teacher/Staff, evidence, handover, internal reasons, audit/version, storage key, permanent media URL, attendance mutation, or client-derived attendance authority. Do not preload or service-worker-cache journal media. Do not broaden into inbox, leave, contact, payment, or finance work.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Authorized Today | Active Parent link and School; authorized children | One server-backed Today card per authorized child, with explicit attendance state | Skeleton/empty state never shows prior School or child content |
| Attendance range | Authorized child with valid inclusive `from`/`to` up to 31 days | Minimum per-day projection; actual record wins applicable leave; no record yields `NOT_RECORDED` | Invalid/reversed/oversized range is rejected before projection |
| Non-operating date | Authorized child and calendar says no operation | Calendar label, no attendance state; UI does not call it missing or absent | Calendar facts remain server-returned |
| Journal and media | Current retained journal with media metadata | Text/current metadata renders; bytes fetch only after explicit image action | Revoke/auth/denied clears text, dialog, image URLs and returns safe context |
| Retention and forged child | Ended enrollment beyond retention, sibling/foreign/revoked child or School | No data for unauthorized/expired context | API denies before protected DTO/blob; UI removes stale response |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/attendance/attendance.controller.ts` -- owns existing Parent DailyJournal/media GET routes and their cache headers; add the Parent attendance read route beside them.
- `apps/api/src/modules/attendance/attendance.service.ts` -- `parent()`, `parentDailyJournals()`, `parentDailyJournal()`, `readParentDailyJournalMedia()`, retention helper, calendar/leave lookup, and Teacher roster precedence are the reusable server-side authorization/source boundaries.
- `apps/api/prisma/schema.prisma` -- `AttendanceRecord`, approved leave, School calendar and DailyJournal graph are existing source facts; no schema change is expected.
- `apps/api/src/integration/attendance.integration.test.ts` and `apps/api/src/integration/release-gate.integration.test.ts` -- PostgreSQL/HTTP fixtures for Parent links, journal current-only media, revoke, retention and tenant isolation.
- `apps/parent-web/src/main.tsx` -- Story 7.1 owns School context clear/refresh; add protected child/day read state so School changes, foreground denial and unmount abort attendance/journal/media work and revoke object URLs.
- `apps/parent-web/src/auth-session.ts` -- reuse `parentGet()` and `parentMedia()` credentialed `no-store` boundaries; distinguish auth/denied from safe retry errors.
- `apps/parent-web/src/shell.test.tsx` and `apps/parent-web/src/auth-session.test.ts` -- extend client coverage for authorized cards, status labels, no lazy-media preload, stale-response/denial clearing, and transport behavior.
- `apps/parent-web/vite.config.ts` and `apps/parent-web/vite.config.test.ts` -- preserve no protected runtime caching for attendance/journal/media paths.
- `apps/web/e2e/release-gate.spec.ts` -- shared harness must prove the deployed Parent view loads authorized data and clears it on a denied refresh.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/modules/attendance/attendance.service.ts` and `apps/api/src/modules/attendance/attendance.controller.ts` -- implement read-only Parent attendance range projection with validation, per-child active-link re-authorization, retention, calendar label and actual-attendance-over-leave precedence -- establishes the missing server authority without leaking operational fields.
- [x] `apps/api/src/modules/attendance/attendance.service.test.ts`, `apps/api/src/integration/attendance.integration.test.ts`, and `apps/api/src/integration/release-gate.integration.test.ts` -- prove DTO redaction, range bounds, state precedence, non-operating dates, cross-School/cross-child/revoke denial, retention and cache headers -- protects the Parent data boundary in unit and PostgreSQL/HTTP layers.
- [x] `apps/parent-web/src/main.tsx`, `apps/parent-web/src/auth-session.ts`, and Parent styles -- render Today and child/day attendance/journal states from server DTOs; fetch protected media only on intent and centralize abort/object-URL cleanup into Story 7.1 transitions -- prevents stale or cached child data.
- [x] `apps/parent-web/src/shell.test.tsx`, `apps/parent-web/src/auth-session.test.ts`, and `apps/parent-web/vite.config.test.ts` -- cover all matrix states, no edit affordance, media laziness, accessible status/copy, route focus and cache policy -- verifies client behavior without mock protected alternatives.
- [x] `apps/web/e2e/release-gate.spec.ts` -- cover authorized Today/detail and denial clearing through the shared browser harness -- proves deployed Parent boundary behavior.

**Acceptance Criteria:**
- Given a valid Parent School context and active link for each child, when home or child history loads, then every returned/requested child is independently authorized and only the minimum attendance DTO is visible.
- Given an authorized child/date range, when the Parent requests no more than 31 inclusive calendar days, then actual attendance takes precedence over leave, operating dates without a fact return neutral `NOT_RECORDED`, and non-operating dates return only a calendar label.
- Given a retained current DailyJournal, when Parent opens Today or child detail, then only text, date/update time and minimum media metadata are returned; media bytes are separately re-authorized, explicitly requested and never preloaded or permanently addressed.
- Given an unauthorized, revoked, expired, foreign, sibling, retention-expired, or denied context, when a list/detail/media request or stale response is processed, then no child data/media remains visible and the shell follows the Story 7.1 safe fallback.
- Given Parent views the new surfaces, when navigation/accessibility/cache checks run, then statuses have exact text including neutral `Trường chưa ghi nhận`, no attendance/journal edit action exists, route focus is managed, and authenticated attendance/journal/media data is never cached or queued offline.

## Design Notes

The attendance endpoint deliberately returns a bounded day projection rather than an unbounded history or Teacher DTO. `NOT_RECORDED` is a genuine server result for operating dates, while a non-operating date carries no attendance state. The client may format dates/statuses but cannot infer either. Journal media metadata is not an image source: the client obtains a Blob only after the Parent presses the image action and revokes its temporary URL on every ownership change.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test -- attendance.service.test.ts --run` -- expected: Parent attendance unit and controller behavior pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration -- --runInBand` -- expected: Parent attendance/journal isolation, retention and headers pass against test PostgreSQL.
- `pnpm --filter @passionedu/parent-web test -- --run` -- expected: Today/detail/media lifecycle and safe fallback tests pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/admin-web exec playwright test --grep "Parent"` -- expected: shared browser harness proves the Parent portal flow.
- `pnpm lint && pnpm typecheck` -- expected: all workspace checks pass.

## Suggested Review Order

**Parent authorization and projection**

- Re-authorizes the bound Parent and child before projecting each bounded attendance range.
  [`attendance.service.ts:285`](../../apps/api/src/modules/attendance/attendance.service.ts#L285)

- Exposes the Parent-only, no-store attendance route beside existing journal projections.
  [`attendance.controller.ts:21`](../../apps/api/src/modules/attendance/attendance.controller.ts#L21)

**Protected client lifecycle**

- Clears aborted reads and temporary media URLs across School/context transitions.
  [`main.tsx:33`](../../apps/parent-web/src/main.tsx#L33)

- Renders server-authoritative Today cards, history, journal text, and intent-only media.
  [`main.tsx:35`](../../apps/parent-web/src/main.tsx#L35)

- Keeps all protected fetches credentialed and explicitly no-store.
  [`auth-session.ts:10`](../../apps/parent-web/src/auth-session.ts#L10)

**Verification**

- Proves attendance precedence, calendar labels, and input bounds at the service boundary.
  [`attendance.service.test.ts:54`](../../apps/api/src/modules/attendance/attendance.service.test.ts#L54)

- Proves PostgreSQL active-link authorization, redaction, cross-School denial, and revoke behavior.
  [`attendance.integration.test.ts:135`](../../apps/api/src/integration/attendance.integration.test.ts#L135)

- Proves deployed Parent Today/detail navigation and safe foreground denial.
  [`release-gate.spec.ts:50`](../../apps/web/e2e/release-gate.spec.ts#L50)

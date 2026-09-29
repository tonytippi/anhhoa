---
title: 'Story 7.3: Parent inbox attendance có re-authorization'
type: 'feature'
created: '2026-09-27'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '6b611265019d3ba7fcdacf43fb6eff6d68dbbd42'
context:
  - '_bmad-output/implementation-artifacts/epic-7-context.md'
  - '_bmad-output/implementation-artifacts/decision-story-7-3-parent-inbox-contract-2026-09-27.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/parent/parent-inbox.html'
---

<frozen-after-approval reason="human-owned intent -- do not modify unless human renegotiates">

## Intent

**Problem:** Attendance and confirmed-handover source events exist but a Parent cannot safely discover or open them. A source event can belong to several ParentProfiles, links can be revoked after emission, and a current Student name cannot replace the event-time child display snapshot.

**Approach:** Persist the minimum immutable display snapshot at source emission and a School-scoped Parent-specific read record. Add server-authorized inbox list and CSRF-protected idempotent open resolver, then add reviewed mobile inbox and deep-link behavior that clears stale content before re-authorized child/date navigation.

## Boundaries & Constraints

**Always:** Keep `NotificationSourceEvent` append-only and idempotent. Store `studentDisplayNameSnapshot` at attendance/confirmed-handover source emission. Read state is only `ParentInboxEventRead` with School composite integrity and unique ParentProfile/source event pair. Inbox list/open re-authorize Parent audience, bound ParentProfile, active School, active StudentParent per event, 30 inclusive business-calendar days from `attendanceOn` in `Asia/Ho_Chi_Minh`, and child operational retention. List uses `private, no-store`; open validates Origin and double-submit CSRF and returns only `{ studentId, date }`. The Parent route is `/inbox`; `/children/:studentId/days/:date` is a selector requiring open/API authorization before content renders.

**Ask First:** Stop if implementation needs different inbox retention, a non-Parent-specific read model, a current-name replacement for the immutable snapshot, a different mutation protection tier, additional notification channels, or a reviewed visual/interaction change beyond the approved Parent inbox and deep-link states.

**Never:** Do not expose Staff, Class, reasons, raw source payload, source-record ID, evidence, media, audit, storage data or unapproved notification channel. Do not let GET mutate read state, trust URL/client state as authority, cache/queue authenticated inbox data, or broaden to payment/leave/contact features.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Authorized inbox | Active link and retained attendance/handover sources | Server returns only eligible minimum event DTOs and unread count | Empty state when no eligible events remain |
| Independent read | Two ParentProfiles linked to same child/source | Opening by one records only that ParentProfile read state | Other Parent remains unread |
| Open/deep link | Retained active-link event | POST re-authorizes, marks read and returns child/date; client clears old detail before navigation | URL alone never renders child data |
| Revoke/expiry | Link revoked, School inactive, source older than 30 days, or child operational retention expires | List/open omit or deny event; badge excludes it | Clear inbox/detail and render safe fallback, never stale event |
| Mutation protection | Open with invalid/missing Origin or CSRF | No read row is written and no destination is returned | Client retains no claimed read/navigation state |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `NotificationSourceEvent` source graph; add immutable child snapshot and Parent-specific read relation with tenant composite keys.
- `apps/api/prisma/migrations/` -- add migration for the source snapshot and read model; preserve existing source events safely without inventing event-time names.
- `apps/api/src/modules/attendance/attendance.service.ts` -- `record()`, `recordHandover()`, notification source writers, `parent()`, Parent attendance/journal retention helpers and read patterns are the owning boundary for source and Parent projection.
- `apps/api/src/modules/attendance/attendance.controller.ts` -- add Parent inbox GET/open routes beside existing Parent reads; use existing cookie mutation protection for open.
- `apps/api/src/modules/auth/auth.service.ts` and existing source-event tests -- preserve Parent audience isolation and idempotent source event behavior.
- `apps/api/src/integration/attendance.integration.test.ts` and `apps/api/src/integration/release-gate.integration.test.ts` -- extend PostgreSQL/HTTP proof for source snapshot, per-Parent read isolation, retention, revoke, CSRF and exact DTO/cache boundary.
- `apps/parent-web/src/main.tsx` -- Story 7.1/7.2 owns School and protected child state; add inbox view, abort/generation cleanup and resolver-first child/date navigation.
- `apps/parent-web/src/auth-session.ts` -- add a credentialed `no-store` Parent mutation helper that carries CSRF and classifies abort/auth/denied/recoverable failure.
- `apps/parent-web/src/shell.test.tsx`, `apps/parent-web/src/auth-session.test.ts`, and `apps/web/e2e/release-gate.spec.ts` -- prove unread display, no stale navigation, denied/revoked fallback, CSRF transport and browser focus behavior.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` and a new `apps/api/prisma/migrations/*/migration.sql` -- add immutable event display snapshot and Parent-specific read model with School-scoped uniqueness/FKs -- preserves per-Parent unread semantics and tenant graph integrity.
- [x] `apps/api/src/modules/attendance/attendance.service.ts` and `apps/api/src/modules/attendance/attendance.controller.ts` -- emit snapshots idempotently; implement retained active-link-filtered inbox list and CSRF-protected re-authorizing open resolver -- makes API the sole authority for events, read state and destination.
- [x] `apps/api/src/modules/attendance/*.test.ts` and `apps/api/src/integration/{attendance,release-gate}.integration.test.ts` -- prove exact DTO allowlist, snapshot persistence, independent Parent reads, event/operational retention, tenant/sibling/revoke denial, CSRF, headers and source idempotency -- covers the full security matrix.
- [x] `apps/parent-web/src/{main,auth-session}.ts`, Parent styles and tests -- add reviewed accessible inbox/badge/empty state and resolver-first navigation with stale-state cleanup -- implements mobile Parent interaction without client authorization or cached event data.
- [x] `apps/web/e2e/release-gate.spec.ts` and release-gate seed only where required -- prove deployed list/open/read transition and denied deep-link fallback -- validates browser-facing authorization boundary.

**Acceptance Criteria:**
- Given idempotent attendance or confirmed handover source emission, when Parent inbox is queried, then only active-link authorized, retained events appear with immutable child display snapshot, server text/date/time and that ParentProfile's unread/read state.
- Given two Parents share an eligible child/event, when one opens it, then only that ParentProfile read state changes and the other Parent's unread count remains correct.
- Given Parent opens an inbox item or receives its deep link, when the resolver runs, then School, child link, event and operational retention are re-authorized before a minimum `{ studentId, date }` destination is returned; old detail clears before navigation.
- Given an event/link/child context is revoked, expired, foreign or sibling-unauthorized, when list/open/deep-link occurs, then no event/destination/protected child data is returned and badge/list/detail follow the safe fallback.
- Given Parent open is attempted without valid Origin/CSRF, when the API handles it, then no read mutation occurs; successful inbox responses are no-store, accessible, use text unread state and expose no non-allowlisted data or external delivery channel.

## Design Notes

Inbox read state must not live on `NotificationSourceEvent`: one source can be visible to several ParentProfiles. Source snapshot fields make the inbox immutable at delivery semantics while list/open still re-authorize the current link and retention. The client clears the old child/date view, calls the POST resolver, and only then requests the existing Story 7.2 child/day data; a URL is never sufficient proof of access.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate && pnpm --filter @passionedu/api build` -- expected: schema client and API compile after migration.
- `pnpm --filter @passionedu/api test -- attendance.service.test.ts attendance.controller.test.ts --run` -- expected: source/list/open unit/controller behavior passes.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration -- --runInBand` -- expected: PostgreSQL inbox isolation, retention and HTTP mutation proof passes.
- `pnpm --filter @passionedu/parent-web test -- --run` -- expected: inbox UI, resolver lifecycle and transport tests pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/admin-web exec playwright test --grep "Parent"` -- expected: shared browser harness proves Parent inbox/re-authorization.
- `pnpm lint && pnpm typecheck` -- expected: all workspace checks pass.

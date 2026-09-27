# Epic 7 Context: Parent portal đa trường, read-first
<!-- Compiled from canonical PRD/addendum, Architecture Spine, SPEC, final UX DESIGN/EXPERIENCE, final epic backlog, and repository constraints. Scope: developer context for Epic 7 only. -->

## Goal

Deliver the separate, mobile-first Parent PWA at `parent.passionedu.org`. A verified Parent can safely enter only Schools and children with an active `StudentParent` link, then read the minimum authorized view of daily attendance, current DailyJournal and protected media, in-app operational updates, and current effective financial obligations with their immutable payment instruction snapshot. Parents may submit and manage their own permitted short leave requests and update their phone number. The portal is read-first: it must never become a route to operational, finance, service, payment-confirmation, or authorization administration.

## Stories

- **7.1 Parent context đa trường an toàn:** issue and maintain Parent context only where active links exist; direct entry for one School and chooser for multiple Schools.
- **7.2 Today, attendance và DailyJournal được ủy quyền:** present the authorized child/day view and history without internal or other-child data.
- **7.3 Inbox attendance có re-authorization:** expose authorized in-app attendance and handover updates with safe deep-link behavior.
- **7.4 Leave request được phép:** allow Parent-owned short leave request create, edit, and cancellation while pending only.
- **7.5 Tự cập nhật số điện thoại có audit:** allow a Parent to maintain only their own contact phone number.
- **7.6 Obligation hiệu lực và Payment instruction snapshot:** show the authorized, current-effective obligation/payment read model only.
- **7.7 PWA accessibility, retention và cross-school release gate:** prove authorization, retention, safe client state handling, mobile accessibility, and no protected offline cache.
- **7.8 Pilot performance và accessibility release gate:** include Parent in the cross-portal pilot performance and WCAG verification gate.

## Requirements & Constraints

- Parent session issue requires a verified Google identity bound to `ParentProfile` and an active `StudentParent` recheck. No active link at any School denies a Parent session. A one-School Parent goes directly to that School home; a multi-School Parent sees only eligible Schools in the chooser.
- Every Parent route is under `/api/parent/schools/:schoolId/`. `ParentSchoolContext` must verify Parent audience, bound profile, and an active link in that School before scoped lookup. The selected School, route UUID, filter, header, or browser state are selectors only, never authorization evidence.
- Every returned or requested child, including list rows, history, media, inbox destinations, and finance records, must be independently joined/filtered to the active `StudentParent` link. Revoke, session expiry, `401`, School change, foreground return, or denied deep link clears protected memory/query state before any alternative content renders.
- Parent operational data is retained only through 30 calendar days after `StudentEnrollment.endedOn`; inbox events also disappear after 30 days. Parent finance visibility follows the server-enforced versioned Parent access policy: issued finance remains while unsettled and otherwise uses the 12-month default; required coverage-refund settlement can retain the minimum obligation state. The API enforces retention, not UI configuration.
- Attendance read data is limited to child ID, display-name snapshot, date, `PRESENT`, `ABSENT`, `ON_LEAVE`, or `NOT_RECORDED`, plus necessary update time. `NOT_RECORDED` means the School has not recorded attendance, never absence. Non-operating dates carry a calendar label rather than an inferred missing status.
- DailyJournal access is limited to the current authorized journal text, date/update time, and minimum protected media metadata. Never reveal Staff identity, Class facts, internal reasons, audit/version history, storage keys, attendance/handover evidence, or permanent media URLs.
- Attendance and confirmed-handover in-app events are projected only when the active link still exists at read/delivery time. Event content is limited to School context, child snapshot, permitted event text/date/time, and read state; handover can include only confirmed picked-up time. No SMS, email, Zalo, or chat delivery.
- Parents have no mutation for attendance, handover, DailyJournal, finance, service enrollment/cancellation, payment confirmation, refund, policy, authorization, or Google/email binding. Long-leave preservation remains a School-admin roster workflow, not a Parent form.
- Parent short leave creation and pending-only edit/cancel require server validation of Parent/child authorization, enrollment, calendar, and leave policy. A confirmed `PRESENT`, non-operating day, policy conflict, cross-School/child request, or non-pending mutation is rejected without implying a finance adjustment. Parent sees only pending, approved, or rejected result, not internal deadline, decision mechanics, or Staff identity.
- Phone update changes only the bound ParentProfile phone and records old/new value, actor, timestamp, and audit. It cannot alter identity, link, School context, or access.
- Parent obligation data is a minimum read model for authorized effective `ISSUED` outstanding or retained `CLOSED` invoices: obligation code, period, issued total snapshot, server-derived actual receipt/outcome/current outstanding VND, state/update time, receiving bank, account number, account holder, and transfer content. `CANCELLED` obligations are never payable; expose the current effective replacement only. Do not expose ledger/allocation details, correction rationale, carry, settlement difference, promotion coverage provenance, refunds, or live bank data.
- Cookie mutations require origin validation and double-submit CSRF. Parent leave and phone mutations require UUID `Idempotency-Key`, School-scoped ParentProfile Operation/audit context, replay for the identical fingerprint, conflict for changed reuse, and `GET /operations/:operationId` reconciliation before retry. Timeouts are uncertain, not failures.

## Technical Decisions

- `apps/parent-web` is a separately deployed application. It may share only pure contracts, formatters, and stateless UI primitives; it cannot import another portal or API internals. `apps/api` remains the sole source of authorization, state, policy, retention, audit, Operations, and finance values.
- Parent access uses the `parents`, `parent-auth`, and `parent-portal` boundaries. Parent APIs expose purpose-built minimum DTOs and never reuse Admin business endpoints. Tenant relations and mutations remain School-scoped; composite tenant graph integrity and same-transaction checks prevent cross-School references.
- Parent cookies are audience-specific, host-only `Secure`/`httpOnly`/`SameSite=Lax`; only the Parent audience accepts them. `parent-web` must never service-worker cache authenticated Parent responses, payment instructions, DailyJournal media, evidence URLs, or protected alternatives. Media is fetched only after child/date re-authorization and has no permanent blob URL.
- Finance amounts are server-returned whole VND safe JSON integers backed by PostgreSQL `BIGINT`; the client neither calculates authoritative totals nor treats local payment state as authoritative.
- Test with `.env.test`, never the development database. Required integration and E2E proof includes cross-School and same-School cross-child denial via routes, UUIDs, filters, and deep links; active-link recheck and revoke; operational and finance retention; forbidden fields/media/mutations; notification re-authorization; effective-invoice-only payment visibility; logout/expiry/`401` state clearing; and no protected cache.

## UX & Interaction Patterns

- Preserve the reviewed Parent visual language: calm, trustworthy, Vietnamese-first, single-column mobile-first reading surface with 16px mobile gutters and a 640px maximum reading width. Use the selected School name visibly; show a chooser/switcher only for multiple eligible Schools. Today presents one card per authorized child, then child/day detail, inbox, and obligation destinations.
- Use explicit text status beside semantic color. Attendance labels include `Đã ghi nhận có mặt`, `Đang nghỉ`, and neutral `Trường chưa ghi nhận`; do not use red, icon-only treatment, or safety claims for an unrecorded state. Child cards stay focused on one child/date and never show class lists, Teacher identity, evidence, or audit history.
- Inbox has a text unread badge and 30-day empty state. Opening an event re-authorizes child, School, and retention; unavailable content returns to safe inbox context, never stale detail. DailyJournal media is never preloaded and can render only after re-authorization.
- Payment instruction is read-only and distinguishes issued total from current outstanding amount. It has no “I paid”, VietQR, copy-field, bank deep link, package selection, receipt, or refund action.
- Use one route `h1`, announced route/context changes, visible 3px focus, keyboard navigation, accessible field error summary/focus, and at least 44x44 CSS-pixel Parent touch targets. Do not rely on hover. On denied/revoked access, clear content, close sheets/dialogs, and show the safe chooser or signed-out/access-denied state. Offline never queues or claims completion of a mutation.

## Cross-Story Dependencies

- Epic 1 supplies Parent audience/session isolation, School-scoped authorization, Operations, cookie/CSRF controls, audit, and tenant isolation.
- Epic 2 supplies `ParentProfile`, active/revocable `StudentParent` links, Student/enrollment history, and Parent identity binding; link revocation must take effect on the next Parent request.
- Epic 3 supplies the calendar, Parent-access baseline, and typed attendance/leave policies used by Parent read and leave behavior.
- Epic 4 supplies attendance, handover, current DailyJournal/media, short leave workflow, retention inputs, and idempotent notification source events. Parent is a projection consumer only and never receives evidence.
- Epics 5 and 6 supply issued/current-effective obligation snapshots, payment instruction snapshots, actual settlement/outstanding outcome, cancellation/replacement lineage, and finance retention facts. Parent reads only the effective minimum projection.

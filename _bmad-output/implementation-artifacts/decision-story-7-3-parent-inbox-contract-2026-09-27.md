# Decision: Parent inbox projection and re-authorization contract

**Date:** 2026-09-27

## Decision

Story 7.3 uses a server-authoritative, Parent-specific inbox projection for attendance and confirmed-handover source events.

### Read state

Add `ParentInboxEventRead` with School-scoped composite integrity and unique `[schoolId, parentProfileId, notificationSourceEventId]`.

- `readAt` records when a specific ParentProfile opened an eligible event.
- One Parent reading an event never changes unread state for another ParentProfile.
- Unread count is derived server-side only from events that remain active-link authorized and retained at read time.

### Event retention and display snapshot

- Event retention is 30 inclusive calendar days measured from business event date (`attendanceOn`) in `Asia/Ho_Chi_Minh`, not source creation time.
- `NotificationSourceEvent` stores immutable `studentDisplayNameSnapshot` when attendance or confirmed handover emits the source event.
- Parent inbox uses the snapshot and never joins current Student name as a substitute.

### Routes and mutation protection

- `GET /api/parent/schools/:schoolId/inbox` returns only currently authorized, retained Parent inbox DTOs and server-derived unread count.
- `POST /api/parent/schools/:schoolId/inbox/:eventId/open` re-authorizes School, ParentProfile, StudentParent link, event retention and child operational retention before marking that ParentProfile's event read and returning `{ studentId, date }`.
- Open requires cookie mutation origin validation and double-submit CSRF.
- Open is idempotent and low-impact; it does not require `Idempotency-Key` or an Operation.
- Parent routes are `/inbox` and `/children/:studentId/days/:date`. Route parameters are selectors only; the open resolver/API remains authorization authority.

## Parent DTO Boundary

Each inbox item includes only opaque event ID, School context, Student ID, immutable display-name snapshot, event type, server-derived Vietnamese text, event date/time and Parent-specific unread/read state. It never exposes Staff, Class, reason, source-record ID, raw payload, evidence, media, audit or storage fields.

## Rationale

The inbox must remain correct when a source event belongs to multiple Parents, a child's name later changes, or a link is revoked after event creation. Parent-specific read rows preserve server authority and immutable source snapshots make the delivered event comprehensible without leaking current operational data. Business-date retention aligns the 30-day inbox behavior with the actual attendance/handover event rather than delayed source creation.

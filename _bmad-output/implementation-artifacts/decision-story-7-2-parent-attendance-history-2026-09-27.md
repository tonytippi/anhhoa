# Decision: Parent attendance history contract

**Date:** 2026-09-27

## Decision

Parent attendance history uses a bounded date-range query:

`GET /api/parent/schools/:schoolId/students/:studentId/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD`

- The requested inclusive range is limited to 31 calendar days in the School business timezone, `Asia/Ho_Chi_Minh`.
- The default Parent UI requests the most recent 30 calendar days, including today.
- This release has no pagination or unbounded history endpoint.
- Each date returns only `studentId`, Student display-name snapshot, `date`, `status`, necessary `updatedAt`, and optional `calendarLabel`.
- A non-operating date returns a calendar label and no attendance status.
- An operating date with no attendance record or applicable leave returns `NOT_RECORDED` and is displayed as neutral `Trường chưa ghi nhận`.

## Rationale

The reviewed Parent mockup needs a readable day history, but an unbounded projection would enlarge child-data exposure and require pagination semantics not present in the finalized story contract. A 31-day bounded server query supports Today and recent history while keeping the authorization and retention surface constrained.

## Guardrails

- `schoolId`, `studentId`, `from`, and `to` remain selectors only. Every request re-authorizes Parent audience, bound ParentProfile, active School, and active `StudentParent` for the requested child.
- The server validates ISO dates, range ordering, maximum span, business timezone, Parent operational retention, calendar, and attendance/leave precedence.
- The response never includes class, Staff, evidence, handover, internal reason, audit, version, media URL, or storage fields.
- This is a read-only Parent projection. It does not introduce Parent attendance mutation, offline queueing, or client-calculated attendance state.

# Decision: `PRESENT` overrides confirmed short leave

Date: 2026-09-24

## Decision

For the same School, Student, and operational day, a confirmed attendance record with status `PRESENT` has the highest operational precedence over an `AUTO_APPROVED` or `APPROVED` short `LeaveRequest`.

The attendance write is an authorized operational correction when it passes the normal attendance authorization, calendar, policy, and evidence validation. The overlapping confirmed leave is retained as historical request/decision data, but it is not counted as an effective leave for the day and must not issue, retain, or feed an immutable leave source fact for Finance.

## Consequences

- Attendance read models and operational queues render `PRESENT` for the day.
- A release-gate test must prove the confirmed leave remains auditable but is excluded from effective leave and immutable source issuance after `PRESENT` is recorded.
- The release gate must not expect the `PRESENT` write to be rejected solely because of the confirmed leave.
- Holiday/non-operating-day, capability, Class assignment, required evidence, tenant, and idempotency validation remain independently enforced.

## Rationale

An actual confirmed presence is the highest-confidence operational record for the day. Keeping the leave request history while excluding it from effective operational and Finance-source meaning preserves both auditability and correct downstream behavior.

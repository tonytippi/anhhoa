# Epic 4 Context: Vận hành lớp học có kiểm soát

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver controlled classroom operations: authorized Staff record attendance and handover, authorized School actors manage short leave, and the system preserves evidence, conflicts, and immutable operational facts. This gives Finance safe inputs for later review without turning attendance, handover, leave, or enrollment preservation into an automatic pricing, fee, or CollectionRun engine. Finance catalog owns service enrollment in Epic 5.

## Stories

- Story 4.1: Leave domain theo calendar, policy và capability
- Story 4.2: Staff ghi attendance có conflict validation và evidence policy
- Story 4.3: Evidence lifecycle và notification source an toàn
- Story 4.4: Staff ghi handover School-wide như operational reference
- Story 4.5: Quyết định leave ngắn và nguồn immutable cho Finance
- Story 4.6: Hàng đợi vận hành buổi sáng
- Story 4.7: Kiểm thử release gate cho vận hành lớp

## Requirements & Constraints

All operational data, queries, mutations, unique constraints, audit records, and Operations must be School-scoped; reject cross-School IDs, routes, filters, and tenant graphs before data access. The API is authoritative for authorization, calendars, effective policies, conflicts, transitions, evidence eligibility, and returned state. Use `Asia/Ho_Chi_Minh` for business dates and effective intervals.

Short leave is day-based. Validate the Student's enrollment, School calendar, and policy as of the requested date. Leave before its deadline auto-approves; a late pending request can be approved or rejected only by a School-wide `LEAVE_REQUEST_DECIDE` capability. Clients must not choose an approved state. Parent-facing leave edit/cancel, status projection, and notification delivery are outside this epic's Staff/Admin scope.

Attendance accepts writes only for an `ENROLLED` Student on a valid operating date. Confirmed leave, especially a `PRESENT` conflict, must be rejected or returned as a server conflict; no local override is permitted. A required attendance evidence policy rejects `PRESENT` without valid evidence. Keep only an access-controlled evidence reference in operational records.

Handover records a confirmed picked-up time as an operational reference only. It must not authorize pickup, calculate or suggest a late fee, or create a finance posting. Its required/optional evidence policy is independent of attendance. Finance catalog owns effective-dated service enrollment in Epic 5; Parent has no service cancellation action.

Confirmed `AUTO_APPROVED` or `APPROVED` short leave produces an immutable daily meal-eligibility fact only when it is an operating day and no `PRESENT` attendance is confirmed. That source contains School, Student, day, leave provenance, and eligibility, but no receivable, amount, Invoice, or CollectionRun reference. Finance alone later maps it to a receivable and materializes an idempotent negative adjustment on an eligible Invoice `DRAFT`.

Enrollment preservation remains the roster-owned `ENROLLED <-> ON_LEAVE` transition, restricted to School Admin with `ROSTER_MANAGE`, effective date, reason, Operation, and audit. It must not automatically change tuition, CollectionRun eligibility, invoices, refunds, return fees, or Finance policy. Do not hard-code a leave duration, reduction percentage, or return fee.

Evidence is never exposed to Parent DTOs, events, media routes, or unprivileged actors. Authorized capability-bearing Staff and School Admin may read same-School evidence only. Delete the evidence blob and preview two calendar months after confirmation while retaining audited deletion metadata and showing an audit-safe expiration message. Successful attendance or handover writes emit exactly one idempotent notification source event with minimal School/Student/date facts; Parent projection rechecks active `StudentParent` later in Epic 7.

High-impact approvals, enrollment preservation transitions, and relevant operational writes require a UUID `Idempotency-Key`, transactional actor-scoped Operation and audit trail. Replay an identical request outcome, reject a changed fingerprint, and reconcile `GET /operations/:operationId` before retrying after timeout. Cookie mutations require origin validation and double-submit CSRF.

## Technical Decisions

The NestJS `attendance` domain owns leave, attendance, handover, evidence, immutable leave-day facts, and notification source events. `roster` owns StudentEnrollment preservation and supplies enrollment/as-of facts; `settings` supplies typed effective calendar, AttendancePolicy, and HandoverPolicy; `finance` owns the service catalog, StudentServiceEnrollment, receivable mapping, VND, Invoice DRAFT adjustments, and all finance outcomes. Domains interact through narrow service/query contracts, never controllers or direct aggregate ownership leaks.

Resolve every Staff request server-side from an active same-School StaffProfile, active primary SchoolPosition, active audited SchoolMembership/UserIdentity binding, and the Position's active Platform-catalog capability. Do not authorize from `staffType`, preset roles, Position names, client-provided capability, browser state, or assignment alone. `ATTENDANCE_WRITE` and `CLASS_LEAVE_READ` additionally require an effective StaffClassAssignment for the requested Class and as-of date. `HANDOVER_WRITE` is School-wide, does not require a Class assignment, and still validates Staff, School, Student enrollment, date, policy, evidence, and existing record state on every write. Revoke or inactive Staff, Position, binding, capability, or required assignment denies the next request before domain lookup/write.

SchoolPosition is the sole long-term Staff authorization source after the one-way migration from legacy `StaffType`/preset grants. Position changes retain history and audit snapshots; no dual authorization source may remain. All multi-record state changes run in PostgreSQL transactions and retain School, actor, timestamp, provenance, and required reason in audit data.

## UX & Interaction Patterns

Attendance and handover mutations are Teacher-portal-only, mobile-first flows. Show visible School, Class where applicable, and date context; attendance is available only after the server confirms the effective Class assignment, while handover must not ask for or infer one. Present current server status, required-evidence state, permission state, conflict explanation, and confirmed update time. Refresh from server after a conflict, validation failure, revoke, or existing record; never show a local status override or automatic-fee affordance.

The Admin morning queue is read-only and table-first: show server-returned attendance-gap and pending-leave counts by School, date, and Class, with a text count and short explanation. Cards navigate to URL-prefiltered date/class/status destinations, which re-authorize on the server. Keep School/date context in loading, empty, denied, and error states; an error must not be displayed as a confirmed zero.

Use the shared switch guard for dirty or uncertain mutations: remain, discard only before submit, or reconcile the Operation. Do not auto-save or silently change School. Validation uses a focusable error summary and adjacent field errors; dialogs trap and restore focus. Use text labels with status colors, keyboard-accessible tables, responsive scroll/cards, and WCAG 2.1 AA behavior. Evidence expiry is visible to Staff/Admin as `Tệp bằng chứng đã hết hạn`, never to Parent.

## Cross-Story Dependencies

Epic 4 depends on Epic 1 for tenant isolation, audience/session, CSRF, Operations, and School context; Epic 2 for Student enrollment, Staff binding, SchoolPosition, and effective Class assignments; and Epic 3 for calendar and typed evidence policies. Story 2.4's one-way SchoolPosition migration must complete before Stories 4.2 and 4.4 rely on capability authorization; Story 4.1's completed legacy authorization behavior is not a reason to retain it.

Stories 4.1 and 4.2 supply leave/calendar conflict facts consumed by Story 4.5; Stories 4.2 and 4.4 supply evidence and idempotent event sources governed by Story 4.3; Story 4.6 reads their server state. Story 4.5 supplies immutable leave facts only. Epic 5 owns service enrollment and conversion of leave facts into Invoice DRAFT meal adjustments, and Epic 7 later owns Parent leave entry, notification delivery, and all Parent projections.

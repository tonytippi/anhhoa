# Epic 4 Context: Vận hành lớp học có kiểm soát

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable authorized School staff to operate daily class records safely: manage short leave, record attendance and handover, preserve evidence and operational source facts, and surface the morning work queue. The epic must preserve tenant isolation, authorization, policy, audit, and historical meaning while keeping attendance and handover strictly operational: they must never become a client-side or automatic pricing, tuition-reduction, CollectionRun, pickup-authorization, or Finance-posting mechanism.

## Stories

- Story 4.1: Leave domain theo calendar, policy và capability
- Story 4.2: Staff ghi attendance có conflict validation và evidence policy
- Story 4.3: Evidence lifecycle và notification source an toàn
- Story 4.4: Staff ghi handover School-wide như operational reference
- Story 4.5: Quyết định leave ngắn và nguồn immutable cho Finance
- Story 4.6: Hàng đợi vận hành buổi sáng
- Story 4.7: Kiểm thử release gate cho vận hành lớp

## Requirements & Constraints

- All operational data, reads, writes, audit records, unique constraints, and Operations are School-scoped. Resolve authorization server-side on every request; URLs, UUIDs, selected School, filters, headers, position names, and browser state are selectors only, never proof of access.
- Use the School calendar, enrollment status, typed policy version, and `Asia/Ho_Chi_Minh` business date as-of the operational date. Only a valid `ENROLLED` student may participate by default. Holidays/non-operating dates and confirmed leave conflicts must be handled by the server; confirmed leave excludes `PRESENT`.
- Short daily leave before the policy deadline auto-approves. A late pending short leave can be approved or rejected only by an active SchoolPosition capability `LEAVE_REQUEST_DECIDE`; the client cannot select an approved outcome. Parent-facing approval mechanics and Parent edit/cancel behavior are outside this epic.
- Confirmed `AUTO_APPROVED` or `APPROVED` short leave produces an immutable School/Student/day operational fact with leave provenance and eligibility. It contains no receivable, VND amount, Invoice, or CollectionRun target. Finance may later consume it only after its catalog exists, and must own receivable mapping and idempotent DRAFT adjustment materialization.
- Enrollment preservation is exclusively the roster-owned effective-dated `ENROLLED <-> ON_LEAVE` transition, authorized by `ROSTER_MANAGE`. It retains history, reason, audit, and Operation behavior but never creates fees, discounts, refunds, Invoice changes, policy application, or future CollectionRun effects automatically.
- Attendance requires `ATTENDANCE_WRITE`; class leave access requires `CLASS_LEAVE_READ`. Both require active StaffProfile, active primary SchoolPosition, active same-School login binding, the relevant active capability, and effective StaffClassAssignment for the requested Class and date. Revocation or inactivation denies the next request before lookup or write.
- Handover requires `HANDOVER_WRITE` plus the active StaffProfile, Position, and binding in the School, but is School-wide and deliberately does not require Class assignment. Every write still validates School, Student enrollment, date, state, HandoverPolicy, and evidence. It records confirmed picked-up time as an operational reference only, never pickup authorization or an automatic late-pickup fee.
- Attendance and handover policies independently allow only `REQUIRED` or `OPTIONAL` photo evidence. When required, reject a `PRESENT` attendance or picked-up time without valid evidence. Evidence references are access-controlled; Parent DTOs, events, routes, and media responses must not disclose evidence, previews, Staff identity, or internal reasons.
- Delete evidence blobs/previews two calendar months after confirmation while retaining audited deletion metadata. Later authorized staff/admin reads show the audit-safe expired-evidence state.
- Attendance and handover writes emit exactly one idempotent in-app notification source event. The source includes only School, Student, date, and confirmed picked-up time where applicable; Parent delivery/projection is deferred to Epic 7 and requires a fresh active StudentParent check.
- Mutations use origin validation and double-submit CSRF. Approval/rejection and other high-impact workflows require a UUID `Idempotency-Key`, transactional actor-scoped Operation/audit outcome, identical-retry replay, changed-fingerprint conflict, and `GET /operations/:operationId` reconciliation before a retry after timeout.
- Release evidence must include unit tests for transitions and PostgreSQL integration tests for tenant graph isolation, capability/Position/binding revocation, class restriction, School-wide handover, calendar/leave conflicts, evidence access and cleanup, idempotent notification source, immutable leave facts, and the absence of automatic pricing. Portal E2E must prove server-confirmed errors, timeout reconciliation, switch guarding, and no stale cross-School class data.

## Technical Decisions

- Implement within the modular-monolith ownership boundary: `attendance` owns leave, attendance, handover, evidence, and notification source facts; `roster` owns enrollment preservation; `settings` supplies typed effective-dated attendance/handover policies and calendar; `authorization` resolves operational capability; `finance` owns all receivables, VND, Invoice DRAFT adjustments, and posting. Controllers call their owning service only; cross-domain access uses narrow service/query contracts.
- Teacher operational UI belongs only in the separately deployed `teacher-web` REST client. Admin is review-only for operational queue and must not gain attendance, handover, or DailyJournal mutation destinations. Portal code does not import API internals or another portal.
- Use PostgreSQL transactions to verify the complete tenant graph and persist state transition, audit, and Operation consistently. Match record ID and `schoolId` together; use composite tenant graph keys/foreign keys where available.
- The authorization migration in Story 2.4 is a prerequisite for Stories 4.2 and 4.4. Do not retain or reintroduce `staffType` or preset-role authorization: SchoolPosition capability resolution is the sole ongoing source. Story 4.1's completed historical contract must not be rewritten beyond the approved migration follow-up.
- Operational history is retained rather than hard-deleted. Policy changes do not rewrite confirmed facts, evidence decisions, audit, or Operation snapshots.

## UX & Interaction Patterns

- Follow the Teacher mobile-first class/day flow. Show selected School and date, current server status, explicit text status, policy-required evidence state, conflict explanation, permission state, and server-confirmed update time. Attendance controls cannot locally override a conflict or represent an unconfirmed row update as final.
- Handover UI is available based on server capability in the selected School, without requesting or inferring Class assignment. Label it explicitly as an operational reference; never offer pickup authorization or late-fee calculation/suggestion.
- The Admin morning queue is read-only and table-first: show server-returned attendance-gap and pending-leave counts with visible School/date and a one-line explanation. Cards navigate to URL-backed class/date/status filters; counts and lists refresh from the server after mutations. Do not substitute zero on an unresolved error.
- On validation errors, retain input, place `fieldErrors` beside controls, and focus the error summary. On timeout, disable duplicate submit, state that the system is checking the result, and reconcile the Operation before retry. School switching from dirty or uncertain mutation state offers remain, discard only before submission, or Operation reconciliation; it never auto-saves or shows stale School content.
- Use the established calm operational visual system, short Vietnamese labels, text-plus-color status, visible focus, keyboard-accessible tables/actions, dialogs with focus trap/return, and responsive table scroll/cards. Evidence expiry must render the audit-safe message for authorized Staff/Admin only.

## Cross-Story Dependencies

- Epic 1 provides audience/session isolation, School-scoped authorization, audit, Operation/idempotency, CSRF/origin protection, tenant graph integrity, and the release-gating tenant-isolation proof.
- Epic 2 provides SchoolYear/Class/StudentEnrollment history, StaffProfile/login binding, effective StaffClassAssignment, and the required one-way SchoolPosition capability migration. Epic 3 provides effective-dated calendar and evidence policies.
- Story 4.5 depends on the roster lifecycle from Epic 2 but must not create a parallel long-leave aggregate. Finance consumption of leave facts is a later enhancement after the Epic 5 catalog; it cannot make Epic 4 depend on Invoice or CollectionRun behavior.
- Story 4.3's notification source is consumed only by Epic 7, which performs Parent authorization, retention, delivery, and deep-link re-authorization. Parent remains unable to access evidence or operational mutation in this epic.

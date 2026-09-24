# Epic 4 Context: Vận hành lớp học có kiểm soát

<!-- Compiled from canonical planning artifacts and approved change proposals. -->

## Goal

Enable authorized staff to operate daily class records safely: short leave, attendance, handover, evidence, DailyJournal, immutable operational facts, and the read-only morning queue. Preserve tenant isolation, authorization, calendar/policy-as-of behavior, audit, and history. Attendance, handover, leave, preservation, and service coverage must never become automatic pricing, tuition reduction, CollectionRun eligibility, pickup authorization, or Finance posting.

## Stories

- Story 4.1: Leave domain theo calendar, policy và capability
- Story 4.2: Staff ghi attendance có conflict validation và evidence policy
- Story 4.3: Evidence lifecycle và notification source an toàn
- Story 4.4: Staff ghi handover School-wide như operational reference
- Story 4.5: Quyết định leave ngắn và nguồn immutable cho Finance
- Story 4.6: Hàng đợi vận hành buổi sáng
- Story 4.7: Kiểm thử release gate cho vận hành lớp

## Requirements & Constraints

- All reads, writes, aggregates, unique constraints, audit, and Operations are School-scoped. The API resolves authorization on every request; route, UUID, selected School, filter, header, capability label, Position name, and browser state are never proof of access.
- Use `Asia/Ho_Chi_Minh`, the School calendar, enrollment lifecycle, and typed policy effective as of the operational date. Only `ENROLLED` is eligible by default. The server handles holiday/non-operating dates and leave conflicts; confirmed `PRESENT` excludes the corresponding approved-leave source fact.
- Short leave before the deadline auto-approves. A late `PENDING` request is approved/rejected only by an active SchoolPosition capability `LEAVE_REQUEST_DECIDE`; decision workflows require `Idempotency-Key`, actor-scoped Operation/audit, identical-retry replay, changed-fingerprint conflict, and reconciliation before retry. Parent approval mechanics, edit/cancel, and delivery belong to Epic 7.
- `AUTO_APPROVED`/`APPROVED` leave creates an immutable School/Student/day fact with leave provenance and eligibility only. It contains no Receivable, VND, Invoice, CollectionRun, or target. In the later Finance enhancement, Finance alone maps it to a Receivable and idempotently materializes a source-linked negative DRAFT adjustment.
- Preservation is only the roster-owned effective-dated `ENROLLED <-> ON_LEAVE` transition authorized by `ROSTER_MANAGE`; it retains history, reason, Operation, and audit but creates no automatic discount, return fee, refund, Invoice change, or Finance-policy application. Epic 4 does not create service catalog, `StudentServiceEnrollment`, service-cancel route, or Finance behavior; these belong to Epic 5.
- Attendance, DailyJournal, and class leave require the `teacher` audience, active StaffProfile, active primary SchoolPosition, active same-School membership binding, the relevant active capability, and effective StaffClassAssignment for the requested Class/date. `ATTENDANCE_WRITE`, `DAILY_JOURNAL_WRITE`, and `CLASS_LEAVE_READ` are class-scoped. Inactive/revoked Staff, Position, binding, capability, or assignment denies the next request before lookup/write.
- Handover requires `HANDOVER_WRITE` with active StaffProfile, Position, binding, and teacher audience in the School, but deliberately requires no Class assignment. Each write re-authorizes School, Student enrollment, date, state, HandoverPolicy, and evidence. Confirmed picked-up time is an operational reference, never pickup authorization or an automatic late-pickup fee.
- AttendancePolicy and HandoverPolicy independently allow only `REQUIRED` or `OPTIONAL` photo evidence. `REQUIRED` rejects `PRESENT` or picked-up time without valid evidence. Evidence is capability- and School-scoped; Parent DTOs, events, media routes, and responses never disclose evidence, previews, Staff identity, or internal reasons. Delete evidence blob/preview two calendar months after confirmation while retaining audited deletion metadata and an authorized Staff/Admin expired state.
- `attendance` owns one current DailyJournal per `(schoolId, studentId, journalDate)`, immutable versions for same-day edits, and distinct journal media. Journal/media are School/Class/Student/date scoped; uploads accept only server-verified JPEG, PNG, or WEBP up to 10 MB each, with no per-journal count limit. Journal media never reuses attendance/handover evidence or a permanent blob URL. Parent projection is deferred to Epic 7 and re-authorizes active StudentParent and operational retention.
- Successful attendance or handover write/replay emits exactly one idempotent in-app notification source event containing only School, Student, date, and confirmed picked-up time when applicable. Epic 7 alone authorizes, retains, projects, and delivers it after a fresh active StudentParent check; no SMS, email, Zalo, or chat.
- Cookie-auth mutations use origin validation and double-submit CSRF. Use PostgreSQL transactions for tenant graph validation and consistent transition, audit, and Operation persistence. Preserve confirmed facts and snapshots; policy changes never rewrite them.
- Release proof includes unit transition tests; PostgreSQL integration tests for tenant graph/isolation, Position/binding/capability revocation, class restriction, School-wide handover, calendar/leave conflicts, required evidence, evidence/journal access and cleanup, idempotent notification source, immutable leave facts, and no automatic pricing; and E2E for server-confirmed errors, timeout reconciliation, switch guard, responsive behavior, and no stale cross-School data.

## Technical Decisions

- The modular-monolith ownership boundary is: `attendance` owns short leave, attendance, handover, evidence, DailyJournal, and notification-source facts; `roster` owns enrollment preservation; `settings` supplies typed calendar/evidence policies as of date; `authorization` resolves capability; `finance` owns Receivables, service enrollment, VND, Invoice DRAFT adjustments, and posting. Controllers call only their owning service; cross-domain access uses narrow service/query exports.
- Teacher operational mutation UI exists only in separately deployed `teacher-web`, a REST client. Admin has only the read-only operational queue and must not gain attendance, handover, or DailyJournal mutation destinations. Portals do not import API internals or each other.
- Story 2.4's one-way SchoolPosition migration is a prerequisite for Stories 4.2 and 4.4. Do not retain/reintroduce `staffType` or preset-role authorization. Story 4.1's released persistence, Parent boundary, idempotency, and login binding are not rewritten beyond the approved authorization migration.
- Match record ID and `schoolId` together in transactions; use composite tenant graph integrity where available. Operational history is retained rather than hard-deleted, and Position/capability changes do not rewrite existing audit or Operation snapshots.

## UX & Interaction Patterns

- Follow the Teacher mobile-first class/day flow. Show selected School, Class where applicable, date, current server status, explicit text status, policy-required evidence, conflict/permission reason, and server-confirmed update time. Never present an unconfirmed local row update or conflict override as final.
- Handover is shown only from server capability in the selected School, without requesting or inferring Class assignment. Label it as an operational reference; never offer pickup authorization or late-fee calculation/suggestion.
- DailyJournal shows visible School/Class/date, per-Student current journal, accessible multi-image validation, and server-confirmed version/update state. It is separate from evidence and cannot become Parent-visible until confirmed and separately authorized in Epic 7.
- The Admin morning queue is read-only and table-first: server-returned attendance-gap and pending-leave counts with visible School/date, explanatory text, and URL-backed class/date/status destinations. Refresh counts/lists from the server after mutations; never substitute zero for an unresolved error.
- Retain input and focus the error summary with adjacent `fieldErrors`. On timeout, prevent duplicate submission, state that reconciliation is in progress, then reconcile the Operation before retry. Dirty/uncertain School switching offers remain, discard only before submit, or reconciliation; never auto-saves or displays stale School data.
- Follow the established calm operational visual system: short Vietnamese labels, text plus semantic color, visible focus, keyboard-accessible tables/actions, dialog focus trap/return, and responsive scroll/card behavior. Only authorized Staff/Admin see the evidence-expired message.

## Cross-Story Dependencies

- Epic 1 supplies audience/session isolation, tenant-scoped authorization, audit, Operation/idempotency, CSRF/origin controls, tenant graph integrity, and the release-gating tenant-isolation proof.
- Epic 2 supplies SchoolYear/Class/StudentEnrollment history, StaffProfile/login binding, effective StaffClassAssignment, and the required SchoolPosition capability migration. Epic 3 supplies effective-dated calendar, evidence, and DailyJournal policies.
- Story 4.5 consumes roster preservation but does not create a parallel long-leave aggregate. Finance consumption of immutable short-leave facts occurs only after the Epic 5 catalog and never makes Epic 4 depend on Invoice/CollectionRun behavior.
- Story 4.3 notification sources and DailyJournal/attendance/handover Parent projections are consumed in Epic 7 only, which re-authorizes Parent access, retention, media, and deep links. Parent remains unable to access evidence or mutate operational records in Epic 4.

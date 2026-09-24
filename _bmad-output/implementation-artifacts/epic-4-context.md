# Epic 4 Context: Vận hành lớp học có kiểm soát

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

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
# Epic 4 Context: Vận hành lớp học có kiểm soát

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable controlled classroom operations: authorized staff record attendance and school-wide handover, while authorized School Admin or Finance actors manage short-leave decisions and operational review. Preserve calendar, policy, evidence, conflict, audit, and immutable source facts without turning attendance, handover, leave, or enrollment preservation into an automatic pricing, fee, tuition-reduction, or pickup-authorization system.

## Stories

- Story 4.1: Leave domain theo calendar, policy và capability
- Story 4.2: Staff ghi attendance có conflict validation và evidence policy
- Story 4.3: Evidence lifecycle và notification source an toàn
- Story 4.4: Staff ghi handover School-wide như operational reference
- Story 4.5: Quyết định leave ngắn và nguồn immutable cho Finance
- Story 4.6: Hàng đợi vận hành buổi sáng
- Story 4.7: Kiểm thử release gate cho vận hành lớp

## Requirements & Constraints

All records, reads, writes, audit entries, evidence access, source facts, and Operations must be scoped to the School and re-authorized server-side. Calendar and typed policy are evaluated as of the business date in `Asia/Ho_Chi_Minh`; only a valid `ENROLLED` enrollment is normally eligible for attendance. Holidays/non-operating dates and confirmed leave conflicts must be enforced by the API, including a `PRESENT` conflict with confirmed leave. The client presents server-confirmed status and explanations only, with no local override.

Short leave before the policy deadline auto-approves; a late request remains pending until an actor with `LEAVE_REQUEST_DECIDE` approves or rejects it. Approval/rejection is idempotent, audited, and reconciled through its Operation after a timeout. Approved leave is an immutable per-day meal-adjustment source only: it must not alter enrollment, future CollectionRun eligibility, issued Invoices, tuition, or fees. Finance may later map an eligible same-School source to a receivable and idempotently materialize a source-linked negative DRAFT adjustment; the operational domain never selects a receivable, amount, Invoice, or CollectionRun.

Attendance requires `ATTENDANCE_WRITE`, an active StaffProfile, active primary SchoolPosition, active same-School login binding, and effective StaffClassAssignment for the requested Class/date. Handover requires `HANDOVER_WRITE` and the same active Staff/Position/binding chain, but applies School-wide without Class assignment. Never authorize from staff type, role preset, Position label, request UUID, URL, header, or browser state. Revoking a Position, capability, StaffProfile, binding, membership, or required assignment must deny the next request before domain access.

Separate typed attendance and handover photo-evidence policies allow only `REQUIRED` or `OPTIONAL`. A required policy rejects `PRESENT` or picked-up time without valid evidence. Evidence is capability-controlled within its School, never exposed in Parent DTOs or media URLs, and has blob/preview deleted two calendar months after confirmation while audited deletion metadata remains. Each successful or replayed attendance/handover write emits exactly one minimal in-app notification source event; Parent delivery/projection remains a later, re-authorized boundary.

Handover is an audited operational reference, not pickup authorization and never a late-pickup fee trigger. Roster alone owns audited `ENROLLED <-> ON_LEAVE` preservation transitions, authorized by `ROSTER_MANAGE`; these transitions cannot create finance effects. The morning queue provides server-returned attendance-gap and pending-leave counts by School/date/Class, including explicit loading, error, and empty states rather than inferred zero.

## Technical Decisions

The API owns authorization, policy evaluation, state transitions, evidence lifecycle, audit, idempotency, notification source events, and Finance-facing source facts. Attendance belongs to the `attendance` domain; enrollment preservation remains in `roster`; cross-domain access uses narrow service/query contracts rather than direct aggregate ownership. Multi-record state changes run in PostgreSQL transactions. Cookie mutations require origin validation and double-submit CSRF; high-impact mutations require UUID `Idempotency-Key`, School/route/actor-scoped fingerprinted Operations, identical-outcome replay, changed-fingerprint conflict, and `GET /operations/:operationId` reconciliation before retry.

Attendance, handover, DailyJournal, and class leave execute only in the separate Teacher audience and UI. Staff operational routes resolve School context and the Staff/Position/binding/capability graph per request. Attendance, DailyJournal, and class leave additionally resolve effective Class assignment; handover validates the eligible Student enrollment, date, HandoverPolicy, and evidence per request but never requires an assignment. The prerequisite one-way migration in Story 2.4 must replace legacy `StaffType`/preset-role authorization with active SchoolPosition capability grants before Stories 4.2 and 4.4; no dual authorization source remains afterward.

DailyJournal is a separate attendance-domain aggregate: one current journal per School/Student/date, same-day edits append audited immutable versions, and its media never shares attendance/handover evidence. Journal files are server-verified JPEG, PNG, or WEBP, at most 10 MB each, with no per-journal image limit; Parent access is a separate authorized projection with operational retention and no permanent media URL.

Release proof must cover cross-tenant and revoked-capability denial, class restrictions for attendance/journal/leave, School-wide same-School cross-class handover, required-evidence and calendar/leave conflict rejection, two-month cleanup with audit retention, source/target and duplicate-adjustment denial, idempotent notification emission, and absence of Parent-accessible evidence fields. Portal E2E must cover permission loss, conflict, validation, timeout reconciliation, School switching, accessible error/focus behavior, and stale-data prevention.

## UX & Interaction Patterns

Use the reviewed Teacher and Admin operational-queue mockups together with the UX spines. Teacher is mobile-first and prioritizes Class/day actions; Admin is desktop-first, table-first, and may review the morning queue but has no attendance, handover, or DailyJournal mutation destination. Always show the selected School and contextual Class/date. Attendance controls show text status, evidence requirement, disabled/permission state, conflict explanation, and server-confirmed update time. `NOT_RECORDED` is a neutral “Trường chưa ghi nhận” state, never inferred as absence or rendered red by default.

Evidence-required flows must require the file before submission and expose accessible validation. Handover clearly labels itself as an operational reference and offers no automatic-fee or pickup-authorization affordance. Queue cards navigate to date/Class/status-prefiltered URL destinations; destination requests re-authorize and refresh from the server. Preserve visible School/date context in empty and error states; do not substitute an unresolved result with zero. Use accessible error summaries, keyboard operation, responsive tables/cards, and the existing School-switch guard for dirty or uncertain mutations.

## Cross-Story Dependencies

Epic 4 depends on Epic 1 tenant/audience/session, CSRF, Operation, audit, and School-context guarantees; Epic 2 SchoolYear, Class, enrollment, Staff binding, Position capability, assignment, and roster-lifecycle contracts; and Epic 3 calendar plus attendance/handover evidence policy versions. Story 2.4's authorization migration is required before attendance or handover writes. Stories 4.2 and 4.4 create evidence and notification sources governed by Story 4.3; Story 4.5 exposes short-leave source facts for the later Finance enhancement without changing Finance Admin MVP snapshots. Story 4.6 consumes current attendance/leave state, and Story 4.7 validates the entire Epic boundary. Parent leave entry, Parent projections, and notification delivery are deferred to Epic 7.

# Epic 4 Context: Vận hành lớp học có kiểm soát

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver controlled classroom operations: authorized Teachers record attendance, handover, and daily journals; authorized School users manage short-leave decisions and roster preservation; and the School can prioritize daily gaps. Operational facts must remain tenant-safe, policy-aware, auditable, and usable as immutable finance references without becoming an automatic pricing, fee, or invoice-mutation engine.

## Stories

- Story 4.1: Leave domain theo calendar, policy và capability
- Story 4.2: Staff ghi attendance có conflict validation và evidence policy
- Story 4.3: Evidence lifecycle và notification source an toàn
- Story 4.4: Staff ghi handover School-wide như operational reference
- Story 4.5: Quyết định leave ngắn và nguồn immutable cho Finance
- Story 4.6: Hàng đợi vận hành buổi sáng
- Story 4.7: Kiểm thử release gate cho vận hành lớp
- Story 4.8: Teacher ghi DailyJournal co version và media được kiểm soát
- Story 4.9: DailyJournal media lifecycle và Parent projection an toàn
- Story 4.10: Teacher portal queue và release gate vận hành lớp

## Requirements & Constraints

- All classroom operations are School-scoped. The API must authorize each request from the active tenant graph; client-supplied School, Class, Student, date, UUID, capability, or browser state is never authorization proof.
- Attendance, class leave access, and DailyJournal writes require the Teacher audience, an active StaffProfile, active primary SchoolPosition and membership/login binding, the route capability, and an effective StaffClassAssignment for the requested Class and business date. Handover requires the Teacher audience and `HANDOVER_WRITE` in the School but is deliberately School-wide and does not require a Class assignment.
- Authorize from active SchoolPosition capability grants only, never `staffType`, preset role, position name, or legacy authorization. A revoked/inactive StaffProfile, Position, binding, capability, or required assignment must deny the next request before protected lookup or write.
- Resolve business dates and calendar policy in `Asia/Ho_Chi_Minh`. Only an `ENROLLED` Student is normally eligible for attendance. Reject or return server-authoritative conflicts for non-operating dates and confirmed leave versus `PRESENT`; the UI cannot locally override a conflict.
- Leave before the configured deadline auto-approves; a pending late short leave may be approved or rejected only with `LEAVE_REQUEST_DECIDE`. Decision workflows require UUID `Idempotency-Key`, actor-scoped Operation/audit, replay for an identical retry, conflict for a changed request fingerprint, and Operation reconciliation before retry after timeout.
- Attendance and handover each enforce their own typed evidence mode. `REQUIRED` rejects `PRESENT` or confirmed picked-up time without valid evidence. Evidence is accessible only to the appropriate capability-bearing Staff or School Admin in the same School, never to Parent DTOs, events, routes, caches, or media URLs. Delete evidence blobs/previews two calendar months after confirmation while retaining deletion audit metadata and an audit-safe expired-file state.
- Attendance or handover success, including an idempotent retry, creates exactly one minimal in-app notification source event. Parent delivery/projection is deferred to its authorization boundary and must recheck active StudentParent; no SMS, email, Zalo, or chat is introduced.
- A handover is an audited operational reference only. It neither authorizes pickup nor creates, calculates, suggests, or posts late-pickup fees.
- Confirmed short leave supplies immutable, School/Student/day-scoped meal-adjustment source facts, excluding dates with confirmed `PRESENT`. It must not select receivables, carry amounts, change enrollment or future CollectionRun eligibility, mutate issued invoices, or infer tuition reduction, credit, refund, or fee. A later Finance enhancement alone maps a source to a receivable and idempotently materializes a negative adjustment on an eligible DRAFT invoice.
- Roster preservation remains an effective-dated `ENROLLED <-> ON_LEAVE` transition owned by roster and authorized by `ROSTER_MANAGE`, with reason, Operation, and audit. It cannot create finance effects. Service enrollment is Finance-owned; Parent cannot cancel it.
- DailyJournal has one current journal per School/Student/date; every same-day edit creates an immutable audited version. Journal media is separate from evidence, scoped to School/Class/Student/date, server-verified JPEG, PNG, or WebP, at most 10 MB per file, with no per-journal image limit. Parent can later access only the current authorized journal/media within 30 days after enrollment ended, through protected no-store requests, without Teacher/Class identity, audit/history, storage keys, direct URLs, or evidence.
- Release proof must cover tenant and Class isolation, revocation, evidence requirements and cleanup, leave/calendar conflicts, idempotent notification creation, adjustment provenance, media validation, Parent exclusion, and timeout/reconciliation behavior using PostgreSQL integration and portal E2E tests.

## Technical Decisions

- Use the API modular monolith as the sole owner of authorization, policy evaluation, transactions, transitions, snapshots, audit, and Operations. Classroom aggregates belong to `attendance`; enrollment preservation belongs to `roster`; Finance consumes only narrow immutable source facts rather than attendance tables or pricing logic.
- Every query, write, unique constraint, audit entry, and School-scoped Operation includes `schoolId`; updates/deletes constrain record ID and School ID together in one transaction. Cookie mutations require origin validation and double-submit CSRF.
- Implement all portal behavior through REST. Attendance, handover, and DailyJournal mutation UI exists only in `teacher-web`; Admin has no such mutation destination. Separate portal session audiences may not be interchanged.
- Parent projections are minimum DTOs and re-authorize active StudentParent per requested or returned Student. Authenticated Parent responses and protected journal media use no service-worker caching; clear protected state on revoke, expiry, unauthorized response, or School change.
- Preserve immutable authorization, audit, and Operation snapshots after Position/capability changes. SchoolPosition migration in Story 2.4 is a prerequisite for Stories 4.2 and 4.4; do not retain or assume legacy dual authorization after that migration.

## UX & Interaction Patterns

- Follow the reviewed Teacher mobile-first workspace for class/day actions; visibly show School, Class where applicable, date, current server status, policy/evidence state, conflict explanation, and server-confirmed update/version time. Do not present an unconfirmed local save as final.
- Use explicit text with semantic attendance color. `NOT_RECORDED` is neutral "Chưa ghi nhận", never inferred as absence or rendered as a red error.
- The Admin morning queue is server-counted by School/date/Class for attendance gaps and pending leave. Cards route to URL-prefiltered date/class/status destinations; refresh counts/lists from the server after relevant actions and never replace errors with a confirmed zero or retain cross-School stale data.
- Teacher's operational queue is mobile-first and read-only for assigned Classes. Its detail URL carries date, classId, and status; it must not expose mutation, Finance, fee, or local override actions.
- Handover must be explicitly labeled as an operational reference, never pickup authorization or automatic fee calculation. DailyJournal editor shows accessible multi-image validation and is visually/functionally distinct from attendance evidence.
- Apply the shared switch guard to dirty or uncertain mutation context: offer remain, discard-before-submit, or Operation reconciliation, never auto-save. Empty, error, permission, conflict, and revocation states retain visible School/date context, move focus appropriately, and clear protected stale rows/drafts before safe fallback.

## Cross-Story Dependencies

- Epic 4 depends on Epic 1 tenant/session isolation, Epic 2 SchoolYear/Class/Student/enrollment and Staff assignment history, and Epic 3 versioned calendar, attendance, and handover policies.
- Story 2.4's one-way migration from legacy `staffType`/preset-role authorization to active primary SchoolPosition capability and effective StaffClassAssignment must complete before Stories 4.2 and 4.4.
- Stories 4.2 and 4.4 provide evidence and operational-write sources for Story 4.3 notification/retention behavior; Story 4.5 provides immutable leave facts for a later Finance enhancement, without changing Epic 5's existing DRAFT or issued Finance snapshots.
- Story 4.6 Admin queue and Story 4.10 Teacher queue consume the current attendance/leave state and require server re-authorization. Story 4.7 and Story 4.10 jointly gate the Epic's integration and browser proof.
- Story 4.9 exposes DailyJournal to Parent only through Epic 7's Parent authorization, retention, and protected projection boundary.

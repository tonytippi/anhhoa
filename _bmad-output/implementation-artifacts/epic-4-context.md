# Epic 4 Context: Vận hành lớp học có kiểm soát

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable capability-authorized staff to operate an assigned class safely: manage leave against the School calendar and effective policies, record attendance and handover with protected evidence, and provide audited service, long-leave, and adjustment-eligibility facts to Finance. This establishes reliable daily operations without turning attendance, handover, or service data into an automatic pricing engine or exposing child evidence to Parent users.

## Stories

- Story 4.1: Leave domain theo calendar, policy và capability
- Story 4.2: Teacher ghi attendance có conflict validation và evidence policy
- Story 4.3: Evidence lifecycle và notification source an toàn
- Story 4.4: Teacher ghi handover như operational reference
- Story 4.5: Service enrollment và long leave làm nguồn Finance có kiểm soát
- Story 4.6: Hàng đợi vận hành buổi sáng
- Story 4.7: Kiểm thử release gate cho vận hành lớp

## Requirements & Constraints

- Leave requests must be evaluated by the server using the selected School's calendar, enrollment eligibility, and effective policy for the requested date. Pre-deadline leave auto-approves; later requests require the configured approval capability. Clients must not choose an approved state.
- Attendance writes are limited to `ENROLLED` Students on operating dates. A confirmed leave conflicts with `PRESENT`; holiday/non-operating dates and other conflicts must be server-rejected or returned as server-authoritative conflict facts.
- Attendance `PRESENT` and handover `pickedUpAt` require valid evidence whenever their respective effective policy is `REQUIRED`. Attendance and handover policies are distinct and only allow `REQUIRED` or `OPTIONAL`.
- Handover records a confirmed picked-up time as an operational reference only. It must never imply pickup authorization, calculate or suggest a late-pickup fee, or create a finance charge.
- Service enrollment is effective-dated and manageable only by authorized School Admin or Finance actors; Parent users have no service-cancellation action. Approved long leave uses an effective date no earlier than its request date and removes the Student from future CollectionRun eligibility. Issued obligations remain immutable.
- Attendance owns immutable, provenance-bearing meal-adjustment eligibility sources by School, Student, day, and receivable. Finance alone can materialize a source-linked negative adjustment on a later eligible DRAFT Invoice; no eligible target, issued/cancelled target, retries, and duplicate sources are explicit server outcomes. Attendance, handover, and service data never auto-price charges.
- Evidence is accessible only to appropriately capable Staff or School Admin within the same School. Parent DTOs, events, and media routes must never expose evidence URLs, previews, Staff identity, or internal reasons. Confirmed attendance/handover evidence blobs and previews are deleted after two calendar months, while deletion audit metadata remains and authorized operators see an audit-safe expiry notice.
- Successful attendance or handover writes emit exactly one idempotent in-app notification source event containing only School, Student, date, and, for handover, confirmed picked-up time. Parent projection and delivery are deferred to Epic 7 and must recheck active StudentParent authorization.
- The daily operational queue returns server-authoritative attendance-gap and pending-leave counts scoped by School, date, and Class. Queue destinations retain date/class/status filters in the URL and are re-authorized before returning their lists.
- Release proof must cover cross-School and missing-capability denial, leave/calendar conflicts, required-evidence rejection, evidence cleanup, absence of Parent-accessible evidence, idempotent notification emission, and duplicate or mismatched adjustment-source rejection.

## Technical Decisions

- Implement this vertical slice in the API `attendance` domain. It owns leave, attendance eligibility sources, evidence lifecycle, handover, DailyJournal, and narrow exports; it never writes Invoice lines. Controllers call their owning service only, while Finance consumes narrow attendance contracts.
- Teacher operational UI belongs exclusively in `teacher-web`; Admin has review/queue surfaces but no attendance, handover, or DailyJournal mutation destination. All portals consume REST and cannot own authorization, policy evaluation, transitions, snapshots, or finance calculations.
- Every staff operational route uses `/schools/:schoolId/`, but server authorization resolves active membership and capability for every request. Attendance and handover additionally require the `teacher` session audience, an audited active StaffProfile-to-membership/UserIdentity binding, and an effective Class assignment for the requested Class and as-of date. Revoking any of these denies the next request.
- `School` is the tenant root: each query, write, relation, unique constraint, audit record, and Operation is School-scoped. Updates and deletes match record ID and School ID in one transaction; client route parameters, UUIDs, filters, headers, and selected browser state are selectors, never authorization proof.
- Use `Asia/Ho_Chi_Minh` for operational dates and `[effectiveFrom, effectiveTo)` for temporal facts. Consume typed, effective-dated calendar, attendance, and handover policy results from Settings; later policy changes must not rewrite confirmed records, evidence references, adjustment sources, or audit history.
- Multi-record and approval workflows run in PostgreSQL transactions. Leave approval/rejection and long-leave approval/rejection require a UUID `Idempotency-Key`, persist a School- and actor-scoped Operation with request fingerprint/outcome, replay an identical retry, reject a changed fingerprint, and require `GET /operations/:operationId` reconciliation before retry after timeout. Audit includes School, actor, time, provenance, and required reason.
- Store only access-controlled evidence references on operational records. Evidence read/upload and cleanup must re-authorize the tenant graph and relevant actor; records are retained through lifecycle/status rather than hard deletion.
- REST uses camelCase JSON; lists return `{ data, meta }`, actions `{ data }`, and errors `{ error: { code, message, fieldErrors? } }`. Unit tests cover transitions and conflicts; PostgreSQL integration tests prove tenant graph, authorization, idempotency, and cleanup behavior; E2E covers portal behavior.

## UX & Interaction Patterns

- Teacher is a mobile-first class/day workspace. Show visible School, Class, and date context, current server status, leave/calendar conflict, evidence requirement, permission state, and server-confirmed update time. Do not treat a local row update as final.
- Attendance and handover use explicit Vietnamese text statuses alongside semantic color. `NOT_RECORDED` is neutral and means the School has not recorded attendance, never absence. Handover is visibly labeled as an operational reference, with no fee affordance.
- The Admin morning queue is a desktop-first, table-first read-only overview with visible School/date, server-returned text counts, concise explanation, and direct filtered destinations. Do not substitute zero for loading, denied, or failed results; do not make Finance the primary queue.
- On validation failure, retain entered input, show adjacent `fieldErrors`, and move focus to a focusable error summary. Conflict, permission, and already-recorded responses explain the server result and refresh the record.
- On mutation timeout, disable repeat submission, show reconciliation rather than failure, and fetch the saved Operation before offering retry. A School switch during a dirty form or pending/uncertain mutation offers remain, discard before submit, or Operation reconciliation; never auto-save or silently switch context.
- Use the established calm operational design: visible School context, short Vietnamese labels, text-plus-color statuses, WCAG 2.1 AA contrast/focus, keyboard-accessible date controls and tables, dialog focus trap/return, and responsive table scroll or cards. Route changes move focus to the route `h1`.
- Evidence expiry is shown only to authorized Staff/Admin as `Tệp bằng chứng đã hết hạn`. Parent evidence must be absent from DOM, routes, caches, alternate text, and notification content.

## Cross-Story Dependencies

- Epic 1 supplies School-scoped authorization, teacher audience/session isolation, capability enforcement, audit, Operations, CSRF/origin protections, and the tenant-isolation gate.
- Epic 2 supplies SchoolYear/Class/Student enrollment lifecycle, active StaffProfile binding, and effective-dated Class assignment needed to determine the eligible Student and Teacher context.
- Epic 3 supplies typed, effective-dated School calendar, AttendancePolicy, and HandoverPolicy consumed at operational write time.
- Epic 5 consumes Epic 4's immutable adjustment eligibility sources and is solely responsible for idempotent negative Invoice DRAFT materialization. Epic 4 must not create, find, or mutate Invoice DRAFTs.
- Epic 7 consumes notification sources and operational read models only through a Parent projection that re-authorizes active StudentParent links; Parent leave entry/edit/cancel and Parent notification delivery are outside this epic.

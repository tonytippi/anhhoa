# Epic 4 Context: Vận hành lớp học có kiểm soát

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver trustworthy School-scoped classroom operations: authorized Staff record leave, attendance, and handover under effective policy and roster context; School Admin/Finance manage service enrollment and long leave as auditable eligibility facts. The epic preserves evidence, conflict, and adjustment provenance without turning operational data into a client-controlled or automatic pricing engine, so later Finance and Parent experiences can consume safe server-owned facts.

## Stories

- Story 4.1: Leave domain theo calendar, policy và capability
- Story 4.2: Staff ghi attendance có conflict validation và evidence policy
- Story 4.3: Evidence lifecycle và notification source an toàn
- Story 4.4: Staff ghi handover School-wide như operational reference
- Story 4.5: Service enrollment và long leave làm nguồn Finance có kiểm soát
- Story 4.6: Hàng đợi vận hành buổi sáng
- Story 4.7: Kiểm thử release gate cho vận hành lớp

## Requirements & Constraints

- All operational facts, source records, audit entries, and Operations are School-scoped. The API must authorize each request from the active School context; IDs, routes, filters, headers, browser state, and cached data never prove access. Keep the full tenant graph in the same transaction and retain historical operational records rather than hard-deleting them.
- Use `Asia/Ho_Chi_Minh` for business dates and effective intervals. Leave and attendance must validate the Student enrollment, School calendar, and policy as of the requested date. Holidays/non-operating dates and confirmed leave conflicts cannot be locally overridden; a confirmed `PRESENT` conflicts with approved leave and excludes that day from meal-adjustment eligibility.
- Leave before the configured deadline is automatically approved. A late leave requires the configured approval capability. Approval/rejection and long-leave decisions are high-impact: UUID `Idempotency-Key`, actor-scoped Operation, replay for an identical fingerprint, conflict for a changed fingerprint, audit, and reconciliation before retry are required. The client never selects an approved outcome.
- Attendance requires the `teacher` audience and an active StaffProfile, active primary SchoolPosition, active audited login binding, `ATTENDANCE_WRITE`, and an effective StaffClassAssignment for the requested Class/date. Capability must be resolved server-side, never from legacy `staffType`, preset roles, Position names, or browser state. Revoking/inactivating the Position, capability, Staff, binding, membership, or assignment denies the next request before a domain write.
- Attendance policy can require evidence for `PRESENT`. Evidence is an access-controlled reference, never a Parent or unprivileged media URL. Corresponding capability-bearing Staff and School Admin may read it only in the same School; blob and preview are removed two calendar months after confirmation while deletion audit metadata remains. Post-cleanup operational views show an audit-safe expiration state.
- Handover uses `teacher` audience plus active StaffProfile, primary Position, binding, and `HANDOVER_WRITE`, but is School-wide and deliberately does not require a Class assignment. Every write still validates School, Student enrollment, date/state, HandoverPolicy, evidence, and duplicate/already-recorded conditions. It records a confirmed picked-up time as an audited operational reference only, not pickup authorization and never an automatic late-pickup fee.
- School Admin/Finance manage effective-dated StudentServiceEnrollment; Parent has no service-cancellation action. Parent or School Admin may initiate long leave, but only School Admin approves/rejects an effective date no earlier than the request date. Approval removes future CollectionRun eligibility without editing an issued Invoice.
- Attendance owns immutable eligibility sources and never writes Invoice lines. It exposes source-linked leave/long-leave meal-adjustment facts by School, Student, day, and receivable. Finance alone later materializes an idempotent negative line on the next eligible DRAFT Invoice and records no-target, issued/cancelled-target, and retry outcomes. Attendance, handover, and service data remain references for Finance MANUAL decisions; no automatic fee calculation or charge affordance is permitted.
- Successful attendance or handover writes emit exactly one idempotent in-app notification source event with only permitted School/Student/date facts and confirmed handover time when applicable. The event carries neither evidence nor internal facts; Parent delivery and active-link reauthorization belong to Epic 7.
- The morning queue is read-only and server-authoritative: return attendance-gap and pending-leave counts by School/date/Class, navigate using URL-backed filters, and refresh after actions. Do not show unresolved errors as confirmed zero or make Finance the primary operational queue.
- Cookie mutations require origin validation and double-submit CSRF. Use API-owned transitions, policy evaluation, audit, and REST responses; clients show server-confirmed state, retain input on validation failure, and do not optimistic-override operational conflicts.

## Technical Decisions

- Implement classroom writes in the `attendance` domain module. Controllers remain HTTP adapters and call their owning service only; use narrow exports from `roster`, `authorization`, `settings`, `operations`, and later `finance` rather than controller coupling or direct cross-domain ownership.
- SchoolPosition is the sole long-term Staff authorization source. Story 2.4 must complete its one-way migration from `StaffType`/`staffType` and preset-role authorization before Stories 4.2 and 4.4. Story 4.1's completed legacy persistence and boundaries are not to be rewritten; after migration, `CLASS_LEAVE_READ` also resolves from active Position capability plus effective Class assignment.
- Enforce typed `AttendancePolicy.photoEvidenceMode` and `HandoverPolicy.photoEvidenceMode` (`REQUIRED | OPTIONAL`) at their respective server write boundaries. Keep attendance and handover evidence separate from Parent-accessible content and from DailyJournal media.
- Operation reads authorize only the same actor context that created them. Operation/audit snapshots preserve historical actor/capability context even when a Position or grant later changes.
- Release proof must include unit transition/conflict coverage, PostgreSQL integration for tenant graph, cross-School Position/capability and assignment denial, revocation/inactive denial before writes, evidence access and cleanup, idempotent notification sources, and no duplicate/mismatched adjustment source. Portal E2E must cover permission denial, validation/conflict, timeout reconciliation, School-switch guard, protected-state clearing, accessible errors/focus, and absence of automatic-fee UI.

## UX & Interaction Patterns

- Attendance and handover mutation surfaces exist only in the mobile-first Teacher portal, never the Admin shell. Teacher class/day views show visible School, Class where applicable, date, server-confirmed text status, conflict explanation, required-evidence state, and update time.
- Attendance is available only for assigned Class context. Handover is explicitly labeled an operational reference and can select eligible Students across the selected School without inferring or requesting Class assignment. Missing permission, revoked Position/binding, required evidence, conflict, duplicate, or validation error refreshes server state and explains the reason without a local override.
- The Admin morning overview is desktop-first and table-first: show selected School/date, short server-returned counts, and direct prefiltered destinations. It is review-only, with no attendance, handover, or journal mutation controls.
- Keep selected School visible in operational headings and move focus to the route `h1`. Cold loads never render stale content from another School; validation focuses an error summary with adjacent field errors. On revoke or `401`, clear protected memory and close dialogs before routing to a safe context.
- On a mutation timeout, disable repeat submit and show “Đang kiểm tra kết quả với hệ thống”; reconcile the Operation before enabling retry. School switching during dirty or uncertain work offers remain, discard only before submission, or reconciliation, never autosave.
- Apply the established calm green/surface tokens, Vietnamese labels, text-plus-color statuses, WCAG 2.1 AA, keyboard-accessible tables/dialogs, and responsive table scroll or cards. Evidence expiration appears only to authorized Staff/Admin as “Tệp bằng chứng đã hết hạn”; it must never enter Parent DOM, routes, cache, or alternate text.

## Cross-Story Dependencies

- Epic 4 depends on Epic 1 tenant/audience/Operation protections, Epic 2 Student enrollment and StaffProfile/SchoolPosition/binding/Class assignment, and Epic 3 calendar plus typed attendance, handover, and journal policy versions.
- Story 4.1 is completed under the earlier authorization contract; Story 2.4 migration is a hard prerequisite for the Position-capability authorization used by Stories 4.2 and 4.4 and the post-migration leave-read path.
- Story 4.2 and Story 4.4 produce evidence/event sources consumed by Story 4.3; Story 4.7 validates their combined authorization, retention, idempotency, and UI behavior.
- Story 4.5 supplies immutable eligibility sources only. Epic 5 owns Invoice DRAFT targeting and idempotent adjustment materialization; Epic 6 owns refunds and ledger settlement. Epic 7 owns Parent notification projection, leave entry/editing, and Parent reauthorization/DTO boundaries.

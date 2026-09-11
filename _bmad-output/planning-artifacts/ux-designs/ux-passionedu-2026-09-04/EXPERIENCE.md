---
name: PassionEdu
status: final
updated: 2026-09-08
sources:
  - ../../../specs/spec-passionedu/SPEC.md
  - ../../prds/prd-passionedu-2026-09-04/prd.md
  - ../../architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md
design: DESIGN.md
---

# PassionEdu - Experience Spine

## Foundation

Multi-surface web: Admin and Ops are desktop-first responsive PWAs; Teacher and Parent are mobile-first responsive PWAs. `DESIGN.md` owns visual identity; this document owns behavior. The four portals have separate sessions and never switch audience in one shell. Spines win on conflict with mockups.

## Information Architecture

| Surface | Audience | Purpose |
| --- | --- | --- |
| Ops School list and provision | Platform Operator | Create, suspend/reactivate School; bootstrap owner; never read School business data. |
| School chooser / switcher | Admin/Staff, Parent with multiple active Schools | Select an authorized School before scoped work. A Parent with one active School enters its home directly; a Parent with no active StudentParent link is denied a Parent session. |
| Tổng quan | Admin | Tổng quan vận hành theo School/ngày, read-only: sĩ số/lớp, điểm danh do server trả về, trẻ đã được đón và đơn nghỉ; không là nơi mutation điểm danh, giờ đón hay nhật ký. |
| Danh bộ | School Admin | SchoolYear, Class, Student enrollment, Parent links, Staff assignments. |
| Cấu hình trường | School Admin | Typed School, calendar, finance, attendance and Parent-access policy. |
| Khoản thu / Đợt thu | Finance | Catalog, CollectionRun setup, preview, generate and issue review. |
| Thu tiền / Công nợ / Báo cáo | Finance | Exact ledger posting, debt, prepaid-payment coverage, correction and school-scoped report. |
| Lương & Nhân sự | Payroll-enabled School Admin, Finance Manager Accountant | Employment terms, common payroll policy, machine-code mapping, file timekeeping review, payroll reconciliation, separated approval/payout and correction. “Kế toán” is a persona label for `FINANCE_MANAGER`, not a role. Hidden when the server does not grant Payroll entitlement and the action capability. |
| Teacher home / Class day | Teacher | Assigned-Class attendance, handover and daily-journal progress for the selected date. |
| Parent home | Parent | Today cards for authorized children, current daily journals, unread inbox badge and outstanding obligations. |
| Child detail | Parent | Daily attendance, current daily journals, leave requests, authorized obligations and snapshot instruction. |
| Parent inbox | Parent | 30-day attendance events; deep-link to authorized child/date. |

Admin/Staff navigation only shows capabilities the server grants. Parent child filters and content remain within the selected School; a child never persists visually after School switch or revoke. See `mockups/admin/admin-operational-queue.html`, `mockups/admin/finance-run-preview.html`, `mockups/admin/payroll-overview.html`, `mockups/admin/payroll-timekeeping-import.html`, `mockups/admin/payroll-run-review.html`, `mockups/admin/payroll-correction.html`, `mockups/parent/parent-home.html`, and `mockups/parent/parent-inbox.html`.

The desktop shell starts with a skip link, then `banner`, named `navigation`, contextual `main` and optional complementary queue/summary. The active navigation item uses `aria-current`; route change moves focus to the route `h1`. Bell, inbox item, sidebar link, stepper navigation and mock actions are buttons/links with names, never decorative text containers.

## Voice and Tone

| Situation | Say | Avoid |
| --- | --- | --- |
| Not recorded attendance | "Trường chưa ghi nhận" | "Vắng mặt" |
| Attendance present | "Đã ghi nhận có mặt" | "Con bạn an toàn" |
| Leave result | "Đang chờ duyệt" / "Đã duyệt" / "Đã từ chối" | Explaining internal deadline or approval mechanics |
| Timeout | "Đang kiểm tra kết quả với hệ thống" | "Thao tác thất bại, hãy gửi lại" |
| Revoked access | "Bạn không còn quyền xem nội dung này" | "Không tìm thấy dữ liệu" |
| Suspended School | "Trường này hiện đang tạm ngưng" | Global sign-out or ambiguous error |

Operational and management copy is direct, short and Vietnamese-first. Prefer task nouns and familiar actions such as `Thêm`, `Sửa`, `Lọc`, `Tìm kiếm`, `Trạng thái` and `Tùy chọn`. Daily Admin/Ops work communicates through columns, values, text status and labeled buttons, not instructional paragraphs. Do not show English terms, internal codes, API names, lifecycle labels or implementation detail by default; place an essential technical fact in a short help message, a disclosure or a protected audit/detail view only when the task requires it.

## Component Patterns

| Component | Use | Behavioral rules |
| --- | --- | --- |
| School context switcher | Admin/Staff, Parent | Visible name is mandatory. On dirty form or pending/uncertain mutation, open switch guard: remain, discard, or reconcile Operation. No auto-save draft. |
| Tổng quan theo ngày | Admin | Dải chỉ số ngắn và bảng theo lớp hiển thị sĩ số, đã có mặt, nghỉ có đơn, đã được đón và trạng thái chưa đến lớp. Count/nhãn/date context là dữ liệu server, không optimistic hay tự tính trên browser. Hôm nay chưa có `PRESENT`/`ABSENT` xác nhận là `Chưa đến lớp`; ngày quá khứ `ABSENT` xác nhận không có đơn duyệt là `Nghỉ không phép`, còn không có bản ghi là `Chưa ghi nhận`. Card nghỉ có đơn mở danh sách đơn với filter URL-backed. |
| SchoolYear setup | School Admin | Creates one active SchoolYear through a named confirmation. Class, Student, pending Parent link and Staff assignment forms show effective date and server validation; Staff profile never implies a login grant. |
| Policy change form | School Admin | Shows active policy, effective date, required reason and server-returned impact. A pending version cannot silently replace active policy; conflict/validation keeps both values visible for correction. |
| Roster transition wizard | School Admin | Preview -> confirm -> Operation reconciliation. Source history stays visible; records excluded by server cannot be force-moved. |
| CollectionRun list and detail | Finance | Finance sidebar opens only list/configuration workspaces, never a fixture Invoice or Receipt. Default view is a compact table of operating collection runs with filter and create action. Selecting a run opens a Student table with charge snapshot, gross/discount/due/paid/outstanding, text Invoice status and an Invoice/projection action. Detail hides landing actions and retains only run title plus Back. Preview/generate remains server-authoritative; timeout goes to Operation reconciliation. |
| Invoice review and receipt | Finance | Invoice review and Receipt are contextual deep destinations only after selecting a Student and Invoice from CollectionRun detail. Receipt starts from one selected Student and server-returned eligible issued Invoices. The exact total required for every selected Invoice is shown; partial, excess, mixed-Student and unallocated posting are rejected as one posting. No independent Student balance is offered. |
| Promotion policy and debt transfer | School Admin, Finance | Finance manages effective-dated policy versions with targets, quantity/unit, discount, fulfillment and stacking. School Admin selects an eligible `PREPAID_COVERAGE` policy/start month after offline Parent agreement; the server creates the dedicated `PREPAID` run/source Invoice. Debt transfer names source and target obligation; it is an auditable movement, not an editable balance. |
| Student promotion coverage | School Admin, Finance | Back-office review shows policy-version-derived Student/SchoolYear receivable-period facts, service intervals, snapshot price/discount/calendar, overlap/eligibility and waiting-for-exact-paid state. Coverage is issued by the server only after the source Invoice is fully paid; no direct create action exists. Parent has no policy catalog, assignment, request or selection action. |
| Ledger correction dialog | Finance | Names source amount and impact. Existing posting is never editable. Với policy `DIRECT`, School Admin hoặc Finance Manager được cấp quyền xác nhận và post ngay sau named confirmation. Với `SCHOOL_ADMIN_APPROVAL`, Finance Manager tạo request, requester không thấy approve action và School Admin khác người tạo mới approve/refuse. Cả hai nhánh dùng Operation reconciliation. |
| Finance report | Finance | Requires School and report period context, displays ledger-derived as-of time and supports filter/empty/error states. Export is not offered. |
| Payroll entitlement state | Platform Ops, School Admin, Finance Manager Accountant | Payroll navigation and destinations remain absent without entitlement and the route capability; deep links/jobs are denied server-side before record disclosure. `PILOT_ENABLED` carries “Đang thử nghiệm”; `SUSPENDED`/`RETIRED` deny new work and retain only authorized historical read/export. Entitlement never grants role/capability. |
| Employment terms | School Admin, authorized Finance Manager Accountant | Management table separates base/probation salary, insurance contribution base and fixed allowances. Every change has effective date; a value referenced by a calculated Payroll version is visible as history, not inline-editable. |
| Timekeeping import and review | Finance Manager Accountant, School Admin | Upload -> preview -> resolve machine-code mapping/row errors -> commit -> review workdays/late-care -> calculate. Each action is capability-gated. Source name is comparison aid only; committed raw events are immutable and manual correction requires reason. |
| Payroll reconciliation | Finance Manager Accountant | A `FINANCE_MANAGER` with prepare/reconcile capability sees the server version, components/source snapshots, adjustments and submit action. After submit the view is read-only until a different-identity School Admin decides. |
| Payroll approval and payout | School Admin, Finance Manager Accountant | Only a different-identity School Admin with `PAYROLL_APPROVE` sees approve/refuse; the submitter never does even through another grant. School Admin with `PAYROLL_REOPEN` may reopen approved unpaid work. After approval only Finance Manager with `PAYROLL_PAYOUT_CONFIRM` sees payout confirmation naming Staff/count, total, method and reference. |
| Payroll correction | Finance Manager Accountant, School Admin | Finance Manager prepares/submits from a paid source version; a different-identity School Admin approves/refuses; Finance Manager confirms resulting payout. Original paid Payroll remains read-only and every step uses Operation reconciliation. |
| Management list | Admin/Staff, Ops, Finance | Default pattern for comparable records: concise Vietnamese column labels, search/filter/sort, explicit pagination, text status and labeled row actions in the final column. A compact summary may precede the table only when it helps prioritize work. Technical identifiers and verbose policy explanations remain outside the default row surface. |
| Attendance entry | Teacher | Requires evidence before `PRESENT` when policy requires it. Calendar/leave conflicts show server result and do not let the user override locally. |
| Handover entry | Teacher | Records server-validated picked-up time for one Student. Missing capability or effective Class assignment shows no action; correction/error refreshes server state. It is explicitly labeled operational reference, never automatic fee calculation. |
| Daily journal editor | Teacher | One current journal per Student/date in an assigned Class. Same-day edits create audited versions. Multi-image upload accepts only JPEG/PNG/WebP up to 10 MB per file; UI does not set Parent-visible state until server confirms. |
| Daily journal | Parent | Shows only the current authorized text and protected images of one child/date within retention. It never shows Teacher identity, journal versions/audit, Class facts or attendance evidence. |
| Service and long leave | School Admin, Finance, Parent | Admin/Finance manage effective-dated service enrollment; Parent/Admin can start long leave, but only School Admin approves/rejects effective date. Parent sees request result, not finance internals. |
| Adjustment and promotional refund review | Finance | Shows immutable source, target DRAFT Invoice or no/issued/voided target outcome, server-returned negative amount and refund path. Promotional withdrawal/transfer refund shows coverage fact/Invoice/Receipt, service interval, calendar version, operating days used/remaining, calculated amount and remaining paid-source limit; editable approved amount is non-negative, cannot exceed that limit and needs a reason when overridden. Finance cannot create a duplicate or automatic non-source-linked adjustment. |
| Suspend/reactivate dialog | Platform Operator | Names School, current status and result of the next-request block. Requires confirmation, uses Operation reconciliation on timeout, and never offers business-data access after completion. |
| Today card | Parent | One per authorized child. Opens child attendance and daily journal for today. Status text is always explicit; `NOT_RECORDED` is neutral. |
| Attendance history | Parent | Date-first list; each entry contains only allowed child snapshot, date, status and update time. No Staff, reason, media or class content. |
| Leave request | Parent | Create from child detail; edit/cancel only `PENDING`. Result is pending/approved/rejected without deadline explanation. |
| Parent inbox | Parent | Bell badge counts unread in-app events. Events retain 30 days, mark read on open, and deep-link to the authorized child/date. Revoked/ineligible event data disappears. |
| Payment instruction | Parent | Read-only snapshot text for outstanding obligation: obligation code, period, issued Invoice total snapshot, server-returned current outstanding VND, current state, update time, receiving bank, account number, account-holder name and transfer content. Issued total and current outstanding are separately labeled. No “I paid” action; VietQR/copy/deep links are not part of this release. |

## State Patterns

| State | Treatment |
| --- | --- |
| Cold load | Skeleton matches the destination layout; never shows stale content from another School. |
| No authorized Parent data | Gentle `{components.illustration-panel}` empty state with signed-out/safe next action; no child names remain. |
| No attendance on a working day | `NOT_RECORDED` text label and update context; never infer absence. |
| Holiday / non-operating date | Date history labels the calendar status instead of implying missing attendance. |
| Permission denied / revoke / `401` | Clear protected memory, close sheets/dialogs, then route to safe chooser or signed-out state. |
| School suspended | Keep identity session; replace School content with suspended explanation and allowed alternative School chooser. |
| Validation error | Error summary receives focus and links to fields; `fieldErrors` appear adjacent to the field. |
| Mutation timeout | Disable repeat submit, show reconciliation state, request Operation result before retry is offered. |
| Operation completed with skips | Result screen lists created/skipped categories and links to affected filtered records. |
| Evidence unavailable after retention | Staff/Admin sees audit-safe "Tệp bằng chứng đã hết hạn"; Parent never sees this state. |
| Offline | Read-only chrome may remain, but protected Parent API data is never service-worker cached. Mutations show offline state and do not pretend to queue or complete. |
| Provision failure | Ops shows no partial School/owner success. The failed form remains editable with field/action error; retry is explicit. |
| Roster transition conflict | Wizard preserves server preview, names records that cannot move and blocks confirmation until a new preview succeeds. |
| Finance lifecycle conflict | Draft/issue/void/settlement actions refresh server state and explain why the action is unavailable; no local state override. |
| No report data | Report retains School, period and filter context and says no ledger activity matches; it does not show zero as a confirmed collection result without an as-of context. |
| Handover unavailable | Missing permission, already-recorded state or validation error names the reason and refreshes the child/day record; no late-fee suggestion appears. |
| Daily Admin overview | Shows selected School/date and server-returned loading, error or no-authorized-data state; it never substitutes zero for an unresolved state or offers attendance/handover mutation. |
| Parent inbox empty | Bell opens "Chưa có thông báo điểm danh trong 30 ngày gần đây." |
| Policy conflict | Form keeps active and proposed effective-dated values visible, focuses server validation, and does not claim policy changed until confirmed. |
| Adjustment unavailable | Finance sees source reason and target state such as no eligible DRAFT Invoice, issued or voided; no manual fallback is implied. |
| Payroll not enabled | Do not render Payroll navigation or an empty data screen. Direct/deep link explains "Trường này chưa được bật tính lương" and offers a safe School context action; no record detail is revealed. |
| Payroll pilot | A restrained text badge "Đang thử nghiệm" appears near the route heading. It does not imply reduced authorization, audit or correction requirements. |
| Timekeeping review required | Batch summary names unresolved machine codes and row errors; calculate is unavailable until server reports review completion. Source display name mismatch is shown as comparison context, never as a selectable identity. |
| Payroll calculation conflict | Keep the returned version/source time visible. Recalculate creates a new draft version; no row total changes optimistically in the browser. |
| Payroll awaiting approval | Finance Manager submitter sees read-only summary. Only a different-identity School Admin with `PAYROLL_APPROVE` sees approve/refuse; the server rejects same-identity approval across grants. |
| Payroll approved unpaid | Components/source facts are locked. School Admin with `PAYROLL_REOPEN` sees reopen; Finance Manager with `PAYROLL_PAYOUT_CONFIRM` sees payout. Neither action is inferred from entitlement or the other role. |
| Payroll paid | Original version is read-only. Payout date/method/reference and any correction links are visible; reopen is absent. |
| Payroll correction | The original paid version remains visible as source. Correction shows signed delta, reason, approval/payout state and no affordance to alter the original. |
| Suspend/reactivate timeout | Ops shows reconciliation and disables duplicate action; School list refreshes from server before another action. |

### Finance Lifecycle States

| Server state | Visible facts | Permitted UI actions | Locked/unavailable treatment |
| --- | --- | --- | --- |
| CollectionRun `DRAFT` | Editable configuration and scope | Edit, preview | Generate is unavailable until server accepts `READY`. |
| CollectionRun `READY` | Server preview, calculation time/version, totals and skips | Return to edit, final-confirm generate | Rule change returns to `DRAFT`; client cannot alter preview result. |
| CollectionRun `GENERATED` | Locked rule/scope, generated results | Review DRAFT Invoice; add eligible Student without an Invoice | Existing scope/rule cannot edit; only server permits eligible addition. |
| CollectionRun `CLOSED` | Final run summary | Read/filter/report | Create/edit is unavailable with server explanation. |
| Invoice `DRAFT` | Editable authorized overrides, adjustment reasons | Edit, choose active BankAccount, issue | Server blocks invalid price/quantity/state. |
| Invoice `ISSUED` | Immutable obligation/Payment instruction snapshot and outstanding | Read, receive/allocate permitted settlement | Content edit and BankAccount change are unavailable. |
| Invoice `PAID` | Ledger-derived full settlement and as-of time | Read; permitted refund/reversal workflow | UI never lets client set payment status; normal partial payment does not exist. |
| Invoice `VOIDED` | Void reason and prior immutable snapshot | Read audit trail | New allocation, promotional coverage issue or Payment instruction is unavailable. |
| No outstanding | Settlement summary | Read history | Parent Payment instruction action is hidden; no payment invitation remains. |
| Reversal/refund `DIRECT` | Source, reason, server-returned impact and current policy | Authorized School Admin/Finance Manager posts after named confirmation | Promotional refund shows calculated/approved amount and required override reason; Operation reconciliation refreshes ledger and source remains immutable. |
| Reversal/refund pending | Source, reason, required approver and current request state | Requester views/cancels only if server permits; different School Admin approves in `SCHOOL_ADMIN_APPROVAL` policy | Promotional refund also shows calculated/approved amount and required override reason; request creator never sees approve action; refusal/approval refreshes ledger. |

## Interaction Primitives

- Desktop tables support keyboard row navigation, sort/filter controls and explicit pagination; mobile uses cards or horizontal table scroll with identifying columns retained.
- Management tasks with comparable records use a table first. Cards support summaries, confirmations, exceptions and non-tabular decisions; they do not replace a list merely to explain each record.
- A daily operational detail replaces its landing header/actions with a single contextual title and Back action. Do not leave create/configure actions visible when they cannot act on the selected record.
- Keep table cells scannable: one primary value, short secondary context only where necessary, and a labeled button/link for the next task. Put long explanation, source provenance and audit identifiers behind a disclosure or destination view.
- Dialogs trap focus, have one obvious dismiss path and never stack. Destructive, issue, settlement, reversal and discard actions require a named confirmation.
- Date controls are keyboard reachable and announce selected day/calendar status. Status filters use text labels, not color-only chips.
- Parent notification deep-links re-authorize child and School before rendering; if unavailable, show safe inbox context rather than stale detail.
- Parent has no attendance edit affordance. Finance totals/statuses always display API-returned values.
- Parent journal media is requested only after child/date authorization, never preloaded or service-worker cached; a retention/revoke denial clears journal text, thumbnails and dialog before safe fallback.
- All protected navigation re-evaluates School and child authorization after deep link, foreground return or inbox action. A denied destination removes previous child/date content before presenting the safe fallback.

## Accessibility Floor

- WCAG 2.1 AA across all portals; token combinations in `DESIGN.md` meet contrast targets.
- One `h1` per route includes selected School where operationally relevant; route change announces purpose and context.
- Every status has text; `NOT_RECORDED` cannot use red/error iconography.
- Touch targets are at least 44 by 44 CSS pixels in Parent PWA. Parent does not rely on hover.
- Tables use captions, headers and keyboard-reachable row actions. Dialog focus returns to the launching control.
- Attendance evidence is inaccessible in Parent DOM, route, cache or alternate text. Authorized DailyJournal media is separately protected and rendered only after Parent child/date re-authorization.

## Responsive & Platform

| Breakpoint | Admin/Staff and Ops | Parent |
| --- | --- | --- |
| `>= 1024px` | Persistent sidebar; queue and finance summaries may use two columns. | Centered single reading column. |
| `768-1023px` | Collapsed navigation; tables retain scroll. | Single column with full-width cards. |
| `< 768px` | Navigation sheet; operational actions remain available but dense finance tables use responsive cards/scroll. | Primary target: today cards, attendance history, leave, inbox and obligation detail. |

## Inspiration & Anti-patterns

- **Reference:** Kidsonline login screenshot informs a reassuring kindergarten feeling: clean sky/green warmth and illustration as welcome support, not copied layout or branding.
- **Keep:** calm bordered surfaces, operational status labels, VND hierarchy, mobile Parent cards, explicit timeout reconciliation.
- **Reject:** childlike finance controls, gamification, payment countdowns, red-by-default absence, child/class evidence in Parent views, and auto-save that silently crosses School context.

## Key Flows

### Flow 1 - Morning operational queue (Hoa, School Admin, 07:20)

1. Hoa signs into `app.passionedu.org` and selects Anh Hoa if she has more than one School membership.
2. Tổng quan opens to attendance gaps and pending leave for today's classes, with visible School and date.
3. Hoa opens a queue card for a class; its filter remains in the URL and shows which Students still need attendance.
4. She opens a pending leave record and sees the server result after approval.
5. **Climax:** The queue count and class list refresh from the server; Hoa knows which class still needs attention without checking a finance screen.
6. Failure: Hoa attempts to switch School while an approval mutation times out. The switch guard offers to remain and reconcile the Operation, discard only before submit, or cancel switching.

### Flow 1b - Provision and owner bootstrap (Linh, Platform Operator)

1. Linh opens Ops and sees only School list, provision action and suspend/reactivate controls.
2. She enters School identity and first-owner email, then reviews the named School and owner before confirming.
3. The result shows provisioning in progress or completed; it never opens the new School business dashboard for Linh.
4. The owner signs in with Google and reaches the new School shell after identity binding.
5. **Climax:** Linh sees School provisioned and owner bootstrap status without receiving a School membership herself.
6. Failure: provision or identity binding fails. The form gives a clear retryable error and never claims a partial owner or School is ready.

### Flow 1e - Suspend or reactivate School (Linh, Platform Operator)

1. Linh opens a School row in Ops and sees its current active or suspended state.
2. She selects suspend/reactivate and confirms the named School and consequence.
3. The action submits through an Operation; Ops does not open tenant data while waiting.
4. **Climax:** The list refreshes with server-confirmed status. A suspended School's next business request is blocked, while other authorized contexts remain usable.
5. Failure: timeout enters reconciliation and duplicate action remains unavailable until outcome returns.

### Flow 1c - SchoolYear and roster transition (Hoa, School Admin)

1. Hoa opens Danh bộ in visible School and SchoolYear context.
2. She begins a transition wizard, selects source Students and maps each to a destination Class.
3. Server preview identifies records that move and records that cannot move; Hoa confirms through an idempotent action.
4. **Climax:** Destination enrollment history appears while source history remains readable and unchanged.
5. Failure: timeout or conflicting enrollment enters Operation reconciliation; Hoa cannot switch School or submit a second batch until it resolves.

### Flow 1d - School foundation setup (Hoa, School Admin)

1. Hoa creates the active SchoolYear from Cấu hình trường and confirms its visible date boundary.
2. She creates Classes for that SchoolYear, then creates a Student enrollment with server-generated code.
3. Hoa adds a pending Parent link with required contact information and an effective-dated Staff assignment where needed.
4. The forms show field-level server errors and retain entered values after validation failure.
5. **Climax:** Danh bộ shows the new Student in the correct SchoolYear/Class with pending Parent status; the Staff assignment does not imply that Staff can sign in.
6. Failure: another active SchoolYear or invalid effective date is returned by the server; the form explains the field conflict and does not create a local placeholder record.

### Flow 1f - Versioned School policy (Hoa, School Admin)

1. Hoa opens a typed calendar, finance, attendance, handover or Parent-access policy.
2. She sees active value, effective date and proposed change; money/access/attendance changes require a reason.
3. She submits the server-validated version and reviews any conflict with another effective policy.
4. **Climax:** The policy history shows the new effective version without rewriting past snapshots.
5. Failure: a conflict or invalid date keeps active/proposed values visible and focuses the returned field error.

### Flow 2 - CollectionRun preview and issue (Minh, Finance Manager, end of month)

1. Minh enters a School-scoped CollectionRun wizard and chooses the period/scope.
2. Server preview returns eligible rows, prior debt context and categorized skips; Minh does not edit a client total.
3. Minh generates drafts with an idempotent submission.
4. A timeout occurs; the screen says it is checking the result and reconciles the saved Operation ID before enabling another submission.
5. Minh reviews a draft, records a reason for an adjustment, selects an active BankAccount and issues it.
6. **Climax:** The issued detail shows immutable obligation and Payment instruction snapshots with ledger-derived outstanding amount.
7. Failure: server-returned reversal mode controls the path. `DIRECT` posts only after named confirmation; `SCHOOL_ADMIN_APPROVAL` lets Minh submit a request but not approve it.

### Flow 2b - Ledger correction (Minh, Finance Manager)

1. Minh opens a receipt or prepayment detail and sees immutable posting facts, current allocation/outstanding and audit context.
2. He starts reversal/refund, enters source-linked amount and required reason, and reviews server-returned impact.
3. In two-step policy, he submits a request and sees "Chờ School Admin khác duyệt" instead of an approve action.
4. **Climax:** After approval/posting, the original record remains readable and a new ledger entry explains the correction.
5. Failure: concurrent settlement changes source balance. The dialog refreshes the server outcome and asks Minh to review a newly permitted action; it never edits the old posting.

### Flow 2c - Receipt, allocation and debt (Minh, Finance Manager)

1. Minh opens Thu tiền for the visible School and period, then records a Receipt from the verified amount received.
2. The server returns eligible outstanding Invoices for one Student; Minh selects whole Invoices and sees the exact total required to settle each from the server.
3. Partial, excess, mixed-Student and unallocated posting are rejected in full. A prepaid-payment source Invoice follows the same exact-settlement rule and never creates an independent Student balance.
4. When prior debt is included, Minh opens the source trail rather than editing a balance.
5. **Climax:** The ledger detail and report refresh show receipt, allocation, prepaid-payment coverage and outstanding as separate values with an as-of time.
6. Failure: a concurrent allocation changes availability; the form refreshes server limits and prevents an over-allocation submission.

### Flow 2d - Service, long leave and meal adjustment (Hoa and Minh)

1. Hoa or Minh creates an effective-dated StudentServiceEnrollment; Parent cannot cancel it directly.
2. Mai or Hoa starts long leave; only Hoa as School Admin approves/rejects and confirms an effective date.
3. Approval excludes future CollectionRun eligibility. Finance opens the immutable source and sees the server-selected next DRAFT target, or an issued/voided/no-target outcome.
4. **Climax:** Minh posts the source-linked negative adjustment or refund path; the original source and outcome remain traceable.
5. Failure: there is no eligible DRAFT target. The UI names that outcome and does not invent a manual credit or automatic charge.

### Flow 3 - Parent checks today's attendance (Mai, Parent, 08:40)

1. Mai opens `parent.passionedu.org`; she selects the School containing her child if needed.
2. Parent home shows a Today card for each authorized child. Mai sees "Đã ghi nhận có mặt" with update time.
3. She taps the card to see date history. A date without a record says "Trường chưa ghi nhận", not absence.
4. She opens the bell inbox; an unread attendance event opens the same child/date after authorization recheck.
5. **Climax:** Mai sees the current-day state of her own child without seeing Staff, class activity, evidence or another child's data.
6. Failure: her link is revoked while history is open; the app clears the detail and returns her to a safe authorized context.

### Flow 4 - Parent sends leave request (Mai, Parent, evening)

1. From child detail, Mai starts a leave request for an authorized child and date.
2. The form validates required input and submits one request.
3. The detail shows `Đang chờ duyệt`, `Đã duyệt` or `Đã từ chối`; it does not expose internal approval mechanics.
4. **Climax:** While still `PENDING`, Mai can correct or cancel the request from the same detail.
5. Failure: attendance is already confirmed `PRESENT`; the server returns the conflict and the UI preserves the submitted request state without implying a finance adjustment.

### Flow 5 - Teacher records attendance (An, 08:05)

1. An opens `teacher.passionedu.org`, then a class/day only after the server confirms his effective assignment.
2. Each Student shows current server status and leave/calendar conflict.
3. When School policy requires evidence, selecting `PRESENT` requires evidence before submit.
4. An submits attendance through an idempotent action and waits for the server result rather than treating a local row update as final.
5. **Climax:** The class list refreshes with explicit text statuses; authorized Parent events are created without exposing An or evidence.
6. Failure: leave/PRESENT conflict or timeout returns server state or Operation reconciliation; An cannot force a fee or edit Parent-facing history.

### Flow 6 - Teacher records handover (An, 16:35)

1. An opens the handover list for today and a selected Class in the visible School context.
2. He selects an authorized Student and enters the picked-up time.
3. The server validates capability and state, then confirms the recorded handover.
4. **Climax:** The child row shows the recorded time as operational history; it does not display or calculate any late-pickup fee.
5. Failure: An lacks handover capability or the record changed. The action is unavailable or refreshes with the server reason; An cannot infer or create a finance charge.

### Flow 7 - Teacher publishes daily journal (An, 16:45)

1. An remains in the assigned class/day on Teacher portal and opens a Student journal editor.
2. He enters the daily note and adds any number of JPEG, PNG or WebP images no larger than 10 MB each.
3. Server validates Class assignment, Student/date context and every upload before confirming the current journal version.
4. **Climax:** The Parent child detail shows only the confirmed current note and protected images for that child/date.
5. Failure: invalid media, revoked assignment, timeout or next-day edit attempt preserves safe input/error context; it does not expose an unconfirmed note or create a duplicate version.

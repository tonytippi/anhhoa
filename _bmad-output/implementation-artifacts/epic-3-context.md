# Epic 3 Context: Lập và xác nhận hóa đơn tháng

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable authenticated Admins to prepare a month's billing without duplicates, review and correct each draft invoice, lock correct transfer instructions and VietQR data before collection, and manually confirm full payment with an immutable audit trail. This preserves accurate financial history even after Students, Classes, templates, or Bank Accounts change.

## Stories

- Story 3.1: Xem danh sách Hóa đơn theo tháng
- Story 3.2: Xem trước và tạo Hóa đơn nháp hàng loạt
- Story 3.3: Rà soát và chỉnh sửa Hóa đơn nháp
- Story 3.4: Chuyển Hóa đơn sang chờ xác nhận và cung cấp QR
- Story 3.5: Xác nhận đã nhận tiền và audit Hóa đơn

## Requirements & Constraints

- Only authenticated Admins may read or mutate invoices. Server-side DTO validation is authoritative; errors use `{ error: { code, message, fieldErrors? } }`.
- Invoice lists support a billing-month picker defaulting to the current month, Student-name search before status/Class filters, URL-reflected filters, pagination, and snapshot Student/Class identity. An empty month retains its picker and has one `Tạo hóa đơn tháng` CTA.
- Batch preflight is the authoritative eligibility check. It accepts a billing month and either all active Classes or selected active Classes, reports eligible Students and categorized skips for inactive Students, missing Classes, archived Classes, and existing invoices, and prevents submission with no eligible Students. A missing template line set must reject preview and creation with `INVOICE_TEMPLATE_EMPTY` rather than create empty invoices.
- Batch creation atomically creates one `DRAFT` per eligible Student for a month. PostgreSQL must enforce uniqueness on `(studentId, billingMonth)` and the result must accurately report created and skipped records, including overlapping concurrent requests.
- Creation snapshots Student and Class identity, ordered template lines, applicable current Class tuition, creator, and creation time. Payment method and Bank Account are not set on initial drafts. Subsequent source changes must not alter invoice snapshots.
- Only `DRAFT` invoices are editable. Draft lines have a description, optional fee group, and whole-VND amount; amounts may be negative or zero but each must stay within -100,000,000 to 100,000,000 VND. The API calculates the invoice total from lines and never accepts a client total.
- A draft may select cash without a Bank Account, or transfer with an active Bank Account only. `DRAFT -> PENDING` requires a total greater than zero and valid payment data; it locks line items, total, payment method, and Bank Account snapshots. `PENDING -> DRAFT` is the only reversal before collection and permits a new valid payment snapshot on a later transition.
- A pending transfer invoice with a snapshotted Bank Account exposes VietQR generated solely from its snapshotted amount, bank, account number, and transfer content. The content identifies the Student, includes the nickname when present, and identifies the Class; it must remain stable when source data changes.
- Completion is manual confirmation only: `PENDING -> COMPLETED` requires a positive total, records the confirming Admin and timestamp exactly once, and makes the invoice permanently read-only. MVP excludes partial/overpayment, installments, refunds, cancellation, reopening, and automated bank reconciliation.
- Batch creation and completion require a client-generated UUID `Idempotency-Key`. The same authenticated Admin, route, key, and request replays the stored result; reusing the key for a different request conflicts. After timeout or disconnection, retain the operation ID and query `GET /operations/:operationId`; offer retry only if the server confirms no change was applied.
- Monetary values are non-fractional VND persisted as PostgreSQL `BIGINT` and returned as safe JSON integers. `billingMonth` is stored as the first day of its month and exposed as `YYYY-MM`; IDs are UUID strings and timestamps are UTC ISO 8601 strings.
- Add API unit coverage for calculation and lifecycle rules, PostgreSQL-backed integration coverage for batch uniqueness, snapshots, transitions, and idempotent completion, and Playwright coverage for primary invoice flows.

## Technical Decisions

- The `invoices` module owns invoice lines, snapshots, payment state, VietQR content, and audit fields. Controllers delegate to their own service; services may use Prisma and narrowly exported domain helpers, never another domain's controller. The API exclusively owns Prisma, migrations, PostgreSQL access, business rules, and persistence; the web uses credentialed REST JSON and treats responses as authoritative.
- Use `/invoices` REST resources and `POST /invoices/batch-preview` for preflight. JSON is camelCase; list responses use `{ data, meta }`, while action endpoints return `{ data }`.
- Run batch creation and completion with their operation/idempotency record in the same database transaction, persisting a request fingerprint and final response atomically. Only invalidate React Query resource keys after a confirmed response or successful operation reconciliation.
- Keep Prisma schema, committed migrations, and seeds in `apps/api/prisma`; production-like and integration environments use migrations rather than `prisma db push`.

## UX & Interaction Patterns

- Use the established desktop-first operations UI: cream surface, white bordered cards, restrained green actions, Inter for tables and money, and Clash Grotesk for page/card headings. Invoice tables have labeled headers, 48px minimum rows, persistent accessible actions, structural skeletons, and status text as well as color.
- The invoice detail is a dedicated page, not a dialog. On desktop, place the draft line-item editor on the left and the snapshot/payment/QR/audit summary on the right; narrow layouts may stack the summary. Line editing uses accessible `Lên`/`Xuống` controls, updates the displayed total immediately, and lightly confirms deletion of a non-zero line.
- Display lifecycle actions by state: draft can move to pending, pending can return to draft or confirm collection, and completed has no editing actions. Pending and completed payment content is read-only; completed retains only the transfer-content copy action where applicable.
- Batch creation uses a modal to select the month and scope, show preflight eligibility and skip reasons, then show created/skipped results with a link to that month's draft-filtered list. Disable the trigger during submission and retain a checking-result state for uncertain outcomes.
- Completion uses one focused modal that repeats Student, billing month, payment method, and total, with Cancel secondary and a fully labeled confirmation action. It traps focus, returns focus to the trigger, does not auto-focus the irreversible action, and cannot be closed or acted on while submitting or reconciling.
- QR cards provide adequate quiet space plus amount, snapshotted receiving account, and labeled copyable transfer content. For accessibility, every route has one `h1`, invoice tables identify their current month/filter, VND is announced as a unit, controls have labels and 40x40px minimum targets, and field errors use `aria-describedby` and a live region.
- At tablet and mobile sizes, invoice tables scroll horizontally with a pinned identity column where needed, confirmation modals become near full-screen below 768px, and desktop two-column details narrow or stack without hiding essential snapshot data.

## Cross-Story Dependencies

- Story 3.1 provides the month-filtered list and navigation context used by batch results and invoice detail routes.
- Story 3.2 depends on Epic 2's active Student/Class data and populated shared template; it creates the draft snapshots that Stories 3.3 through 3.5 operate on.
- Story 3.3 depends on active Bank Accounts from Epic 2 for editable transfer drafts and establishes the valid payment data used by Story 3.4.
- Story 3.4 owns locking payment snapshots and generating QR instructions; Story 3.5 can complete only the resulting valid pending invoice.
- Completion audit and payment snapshots become the immutable source for Epic 4 monthly reporting.

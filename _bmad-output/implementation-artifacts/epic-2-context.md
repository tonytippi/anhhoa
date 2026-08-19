# Epic 2 Context: Chuẩn bị dữ liệu thu phí

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable authenticated Admins to maintain the operational source data that makes monthly billing reliable: Classes and their tuition, Students and their current enrollment, controlled individual and whole-class transfers, the single shared invoice template, and receiving bank accounts. This data must remain suitable for new billing while preserving historical invoice references after source records change or become inactive.

## Stories

- Story 2.1: Quản lý Lớp đang hoạt động và lưu trữ
- Story 2.2: Quản lý Học sinh và Lớp hiện tại
- Story 2.3: Chuyển một Học sinh giữa các Lớp
- Story 2.4: Chuyển toàn bộ Học sinh đang học của một Lớp
- Story 2.5: Quản lý Mẫu hóa đơn chung
- Story 2.6: Quản lý Tài khoản nhận tiền

## Requirements & Constraints

- Only authenticated Admins may read or mutate operational data. Server-side DTO validation is authoritative; errors use `{ error: { code, message, fieldErrors? } }`.
- Retain Classes, Students, and Bank Accounts by status, never hard-delete them. Only active Classes can accept Student assignments or enter new billing; only active Bank Accounts can be chosen for a new or editable draft invoice. Inactive records already snapshotted by pending or completed invoices remain visible.
- A Class has a name and non-negative monthly tuition. Normalize the name by trimming it; it must be non-empty after trimming, at most 100 characters, and need not be unique. Tuition is a non-fractional VND safe JSON integer backed by PostgreSQL `BIGINT`.
- Class lists are deterministically ordered by `createdAt DESC, id DESC`; status filters accept only `ACTIVE` or `ARCHIVED`; an out-of-range page returns an empty `data` array with valid pagination metadata.
- Class resources expose `activeStudentCount`, not an unbounded embedded Student list. Student-by-Class listing belongs to the paginated Student resource.
- Archived Classes are read-only. Archiving is idempotent: re-archiving returns the current archived resource. Do not archive a Class containing active Students; return `CLASS_HAS_ACTIVE_STUDENTS` with `activeStudentCount` in a stable error location so the Admin can transfer or withdraw those Students first.
- Students have a required full name, optional nickname, optional current Class, and active/inactive enrollment status. Inactive Students remain searchable and retain historical references, but are ineligible for new batch billing. Class pickers and transfer targets show only active Classes.
- Changing a Student's current Class, individually or in bulk, never changes existing invoice snapshots of Student identity, Class, tuition, or invoice lines.
- A whole-class transfer changes active Students only, after an explicit confirmation that identifies the destination and affected count. It must be atomic and idempotent using a client UUID `Idempotency-Key`; the same Admin, route, key, and request replays the stored result, while a different request with that key conflicts.
- Maintain exactly one shared invoice template. Template items have a description, optional fee group, persisted order, and either a fixed whole-VND amount or the current Class monthly tuition as their amount source. Reordering uses accessible Up/Down controls, not drag and drop. Template changes affect only invoices created later. Seed one empty shared template so Admins configure its items before billing.
- A Bank Account includes bank/VietQR bank code, account number, account-holder name, and status. Accounts can be added, activated, or deactivated but never hard-deleted. A deactivated account is excluded from draft selectors while remaining visible, with its inactive status, on invoices that already snapshot it.
- Do not automatically replay a mutation after its write request begins. Acquire or refresh CSRF only before the request. On create/update timeout, preserve the form for the Admin to reconcile the list before choosing to resubmit. For uncertain whole-class transfers, retain the operation ID, show a checking-result state, and query `GET /operations/:operationId` before enabling retry.
- Verify the Class migration against a clean PostgreSQL database. Cover successful and blocked archive paths with integration tests; when Student assignment/reactivation is implemented, add PostgreSQL-backed concurrency coverage proving an active Student cannot end up assigned to an archived Class.

## Technical Decisions

- Use the layered modular monolith: `classes`, `students`, `invoice-template`, and `bank-accounts` own their domain services; controllers delegate to services and never become cross-domain orchestration points. The API exclusively owns Prisma, PostgreSQL, status rules, money handling, and persistence; the web consumes credentialed REST JSON through React Query.
- REST resources use `/classes`, `/students`, `/invoice-template`, and `/bank-accounts`; JSON is camelCase, list responses are `{ data, meta }`, and actions return `{ data }`. IDs are UUID strings and timestamps are UTC ISO 8601 strings.
- Serialize archive and every mutation that assigns a Class or activates a Student in a shared transaction/locking scope. Revalidate the destination Class is active inside that scope; reject rather than persist if it became archived concurrently.
- Class transfer is a database transaction. Use the operation/idempotency record scoped to authenticated Admin and route, with a request fingerprint and stored final response; invalidate web query data only after a confirmed response or operation reconciliation.
- Keep Prisma schema, committed migrations, and seeds solely in `apps/api/prisma`; apply migrations in production-like and integration environments rather than using `prisma db push`.
- Use API unit tests for pure validation and transition rules. Use PostgreSQL-backed integration tests for persistence, archive behavior, transfer atomicity, and the archive-versus-assignment/reactivation race.

## UX & Interaction Patterns

- Use the established desktop-first operations UI: cream app surface, white bordered cards, restrained green primary actions, Inter for forms/tables and Clash Grotesk for headings. Data tables have labeled headers, at least 48px rows, persistent accessible actions, pagination, search before filters, structural skeletons, and one appropriate empty-state CTA.
- Classes, Students, and Bank Accounts use short form dialogs. Validate on blur and submit, connect field errors with `aria-describedby` and a live region, and keep the dialog open with entered values after a failed save. Format monthly tuition as whole VND with separators and `đ` on blur; negative tuition is invalid.
- Class archive, Student withdrawal, Bank Account deactivation, and whole-class transfer require a focused confirmation modal that names the affected records, offers Cancel, returns focus to the trigger, and locks closing/actions during submission. Do not auto-focus the destructive confirmation button.
- On save errors, preserve entered data, place the error near the field or action, and show only a short supplementary toast. Status must not rely on color alone. Every route has one `h1`; tables need a caption or `aria-label`; icon controls require labels and at least 40x40px targets.
- Keep list filters reflected in the URL. On narrow screens, administration remains available with horizontally scrollable tables, a pinned identity column where needed, and near-full-screen dialogs below 768px.

## Cross-Story Dependencies

- Story 2.1 establishes Class status, `activeStudentCount`, archive semantics, and the transaction/revalidation convention that Stories 2.2 and 2.3 must use when assigning or reactivating Students.
- Stories 2.2 and 2.3 provide the Student lifecycle and current-Class behavior required by Story 2.4. Story 2.4 relies on active source and destination Classes and feeds the idempotent-operation pattern also used by later invoice workflows.
- Story 2.5 supplies the sole template and ordered template items that Epic 3 snapshots into newly created invoices; its empty seeded state must block batch invoicing until configured.
- Story 2.6 supplies active account choices for editable draft invoices in Epic 3. Deactivation must not remove the account information needed by pending and completed invoice snapshots.

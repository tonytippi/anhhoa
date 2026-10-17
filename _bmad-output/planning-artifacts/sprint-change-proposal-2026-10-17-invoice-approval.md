# Sprint change proposal 2026-10-17: Manager approval of each Invoice before it reaches parents, and a ZIP of a run's Invoice images

Status: requested by the user on 2026-10-17. This changes the Invoice issue flow: Finance no longer issues Invoices. Every School, small or large, goes through approval. Approval works per Invoice, with bulk actions, and not per run. The user chose this on 2026-10-17 so that Invoices that are ready do not wait for the ones that are not.

## Problem

- Today any holder of `FINANCE_MANAGE` issues a DRAFT Invoice directly (`POST .../invoices/:invoiceId/issue`), and the parent sees it at once (the Parent API shows only `ISSUED`/`CLOSED`). No school manager does a final check of the amounts before parents are notified. Kidsonline has a "gửi thông báo" step that works as this check.
- Issuing goes Invoice by Invoice. There is no way to act on many Invoices at once.
- Parents who do not use the app get their Invoice image one at a time (`GET .../invoices/:invoiceId/payment-image`). Finance has to download and rename hundreds of PNGs by hand.

## Change

### 1. Approval per Invoice

- New capability `COLLECTION_RUN_APPROVE` ("Duyệt hóa đơn"), granted per position like `PAYROLL_APPROVE`. `FINANCE_MANAGE` still covers preparing the run and editing DRAFT Invoices, but it no longer issues them.
- **Unit of approval:** one notice, meaning a Student's DRAFT parts in a run (the SCHOOL and PERSONAL parts move together, as issue does today). A SETTLEMENT notice and a revision are units of their own.
- **States:** `InvoiceStatus` gets `PENDING_APPROVAL`. Flow: `DRAFT → PENDING_APPROVAL → ISSUED`. Withdraw and return go back to `DRAFT`. "Cần sửa" is a DRAFT that has an unresolved return note. It is not a separate status.
- **History:** `InvoiceApprovalEvent(schoolId, invoiceId, kind SUBMITTED | WITHDRAWN | RETURNED | APPROVED, membershipId, note?, createdAt)`, append-only. The current return note is the latest `RETURNED` event with no later `SUBMITTED` event. It is shown on the row and on the Invoice page until the Invoice is submitted again.
- **Mutations.** All of them are idempotent with an Operation and audited, and each takes `invoiceIds` (1–500, the primary part of each notice). A bulk call is all-or-nothing, and a refusal lists the Invoices that block it.
  - `POST .../finance/invoices/approval-submissions` ("Gửi duyệt", Finance). Each Invoice must be DRAFT, with an open run and year, issuable (the existing rule), and resolvable to a bank account. Accounts always come from the class (in practice Finance does not pick one per Invoice), so the per-Invoice account select is removed. If a class has no default account, or the Student has no official class, the submit modal asks for a fallback account per channel. The resolved accounts are stored on the pending parts, so approval needs no input. Audit: `INVOICE_APPROVAL_SUBMITTED`.
  - `POST .../finance/invoices/approval-withdrawals` ("Rút lại", Finance) moves PENDING_APPROVAL back to DRAFT. Audit: `INVOICE_APPROVAL_WITHDRAWN`.
  - `POST .../finance/invoices/approvals` ("Duyệt & gửi phụ huynh", `COLLECTION_RUN_APPROVE`) with `items: [{ invoiceId, version }]`. It issues every listed notice in one transaction, using the same rules as `issueInvoice` today: promotion recheck, prepaid check, coverage facts, due date from FinancePolicy, ledger, and the run lock (an earlier MONTHLY run, or an earlier run of the same class, must be closed). If anything fails, nothing is issued. Audit: `INVOICE_APPROVED`, plus `INVOICE_ISSUED` for each Invoice as today.
  - `POST .../finance/invoices/:invoiceId/approval-return` ("Trả lại", `COLLECTION_RUN_APPROVE`) with a required `note` (1–1000 characters). It moves the notice back to DRAFT. Audit: `INVOICE_APPROVAL_RETURNED`.
- **Lock:** a PENDING_APPROVAL Invoice cannot be edited. Its lines, coverage, debt transfer and package are refused with `INVOICE_PENDING_APPROVAL`, enforced in the service and by the DB trigger that already limits edits to DRAFT. Run-level edits (template, extracurricular, adding students) are already limited to earlier run states or to new Invoices, so they do not touch pending ones.
- **Same person (confirmed by the user 2026-10-17):** the approver may be the person who submitted, if they hold both `FINANCE_MANAGE` and `COLLECTION_RUN_APPROVE`. The audit keeps both. The step is mandatory, but separation of duties is not enforced.
- `POST .../invoices/:invoiceId/issue` and `.../issue-revision` are removed from the API. Issuing happens only through approval. Run status (`DRAFT/READY/GENERATED/CLOSED`) does not change. A run cannot close while any Invoice is DRAFT or PENDING_APPROVAL, which matches the current "all issued" rule.
- **Read side:** the run's Invoice list returns `status` (with `PENDING_APPROVAL`), `returnNote` and `submittedAt`, and filters on status (`DRAFT`, `RETURNED`, `PENDING_APPROVAL`, `ISSUED`). `GET .../finance/approvals/summary` returns the count of PENDING_APPROVAL notices in the School, for the navigation badge. It is shown only to holders of `COLLECTION_RUN_APPROVE`. The approve modal's summary (count, totals, totals by class compared with the previous run, and attention items: manual lines, promotions, settlements) comes from `POST .../finance/invoices/approval-preview` with the selected ids. This call is read-only.
- Parent visibility does not change: parents still see only `ISSUED` and `CLOSED` Invoices.

### 2. ZIP of Invoice images for a run

- `POST .../collection-runs/:runId/payment-images/exports` is idempotent with an Operation and follows the `FinanceReportExport` pattern. It builds a ZIP of payment images for every Invoice of the run that can have an image today (`ISSUED` and not yet paid). It renders one PNG per Student with the existing `renderPaymentImage`, so SCHOOL and PERSONAL parts share one image, as on the single download. The ZIP is stored with a 10-minute expiry, and the response returns an `exportId`. `GET .../exports/:exportId` downloads it once, with `Cache-Control: private, no-store`.
- File name inside the ZIP: `<Lớp>_<Tên học sinh>_<Tên đợt thu>.png` (for example `Lá 1_Nguyễn Văn An_Tháng 10-2026.png`), keeping Vietnamese diacritics (UTF-8 names, ZIP flag bit 11). Characters not allowed in file names (`/ \ : * ? " < > |`) become `-`. If two Students share a name in one class, the student code is added: `<Lớp>_<Tên học sinh>_<Tên đợt thu>_<Mã HS>.png`. A Student without an official class uses `Chưa xếp lớp`. The ZIP file is named `<Tên đợt thu>.zip`.
- Optional filter `classId` downloads one class.
- Audit: `COLLECTION_RUN_PAYMENT_IMAGES_EXPORTED` with the run, the count and the total. The per-image audit stays for single downloads.
- Requires `FINANCE_MANAGE`. The export holds parent-facing payment data, so it is never cached and expires quickly.

## UI (Admin portal)

- Run detail, "Hóa đơn trong đợt": a checkbox column, plus filters for status (`Nháp`, `Cần sửa`, `Chờ duyệt`, `Đã phát hành hoặc hoàn tất`, with counts), class, and a student search. A bulk bar shows the selection count and total. For a selection of Nháp/Cần sửa it offers "Gửi duyệt". For a selection of Chờ duyệt it offers "Duyệt & gửi phụ huynh" and "Rút lại". For a mixed selection it explains that the Invoices must share a status. Issued rows cannot be selected. "Cần sửa" rows show the return note under the Student name.
- The "Gửi duyệt" modal lists the selected Invoices and the total. It shows the fallback account select only when needed.
- The "Duyệt & gửi N hóa đơn" modal shows the count, amounts to collect and refund, totals by class compared with the previous month, and a "Cần chú ý" table. Each row of that table has "Xem hóa đơn" and "Trả lại". "Trả lại" opens a modal with a required note and removes that Invoice from the current approval.
- Invoice page: a DRAFT has "Gửi duyệt" (or "Gửi duyệt lại" after a return, with the manager's note shown in the review panel). A PENDING_APPROVAL Invoice is read-only, with "Duyệt & gửi phụ huynh", "Trả lại", "Rút lại" and "Hóa đơn chờ duyệt tiếp theo". The settlement page has the same actions.
- "Tải ảnh hóa đơn (ZIP)" sits next to "Thêm học sinh", with an optional class filter.
- Navigation: "Đợt thu" shows the count of Invoices waiting for approval.
- The approval step is not drawn as a run stage. The run steps stay `Nháp → Sẵn sàng tạo hóa đơn → Đã tạo hóa đơn → Đã đóng`.

## Mockup

Updated on 2026-10-17 and waiting for user review: `mockups/admin/invoice-generation.html` (`#run-generated` with drafts selected, `#run-approve` with pending Invoices selected, and the submit, approve, return and ZIP modals), `invoice-detail-review.html` (`#pending`, `#returned`), `invoice-settlement-review.html`, `center-collection-run-detail.html`, and the navigation count in `admin-shell.js` (`data-runs-pending`). The links are in `review.html` under "Duyệt hóa đơn".

## Impact

- API: new capability, new `InvoiceStatus` value, `InvoiceApprovalEvent`, four mutations, the approval preview and the summary, the ZIP export and its download. `issueInvoice`/`issueRevision` become internal helpers called by approval. The trigger is extended to cover the pending lock.
- Web: run detail table selection and bulk bar, the modals, the Invoice and settlement page actions, the navigation badge, and the per-Invoice account select removed.
- Tests: update the integration tests that issue directly (finance, channels, deductions, class scope) to go through submit and approve. Add tests for the bulk all-or-nothing rule, the pending lock, withdraw, return with a note and resubmit, the run lock at approval, the fallback account at submit, the same person approving, and ZIP names (class first, diacritics, duplicate names, Student without class).
- Guides (Hướng dẫn): add the submit/approve/return steps and the ZIP download for parents who do not use the app.
- No migration concern (no real users yet).

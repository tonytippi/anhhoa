# Sprint change proposal 2026-10-17: Mandatory approval of a collection run before Invoices reach parents, and a ZIP of the run's Invoice images

Status: requested by the user on 2026-10-17. This changes the Invoice issue flow: Finance no longer issues Invoices one by one. Every School, small or large, goes through the approval step.

## Problem

- Today any holder of `FINANCE_MANAGE` issues a DRAFT Invoice directly (`POST .../invoices/:invoiceId/issue`), and the parent sees it at once (the Parent API shows only `ISSUED`/`CLOSED`). No school manager does a final check of the amounts before parents are notified. Kidsonline has a "gửi thông báo" step that works as this check.
- Issuing goes Invoice by Invoice. There is no way to send a whole run.
- Parents who do not use the app get their Invoice image one at a time (`GET .../invoices/:invoiceId/payment-image`). Finance has to download and rename hundreds of PNGs by hand.

## Change

### 1. Approval per collection run

- New capability `COLLECTION_RUN_APPROVE` ("Duyệt đợt thu"), granted per position like `PAYROLL_APPROVE`. `FINANCE_MANAGE` still covers preparing the run and editing DRAFT Invoices, but it no longer issues them.
- Approval covers a **submission**: all DRAFT Invoices of the run that can be issued at that moment, including normal, SETTLEMENT and revision drafts. Empty DRAFT Invoices are left out, using the same rule as today.
- New model `CollectionRunSubmission(schoolId, collectionRunId, sequence, status SUBMITTED | APPROVED | RETURNED, submittedByMembershipId, submittedAt, decidedByMembershipId?, decidedAt?, returnNote?, fingerprint, invoiceCount, totalAmount BIGINT)`. A partial unique index allows at most one `SUBMITTED` row per run. The submission's Invoice set is stored as rows (`CollectionRunSubmissionInvoice(submissionId, invoiceId, totalSnapshot BIGINT)`).
- Mutations (all idempotent with an Operation, `expectedVersion`, and audit):
  - `POST .../collection-runs/:runId/submissions` ("Gửi duyệt", Finance). The run must be GENERATED, its year open, the previous MONTHLY run closed (the existing run lock), and every Invoice in the set must resolve a bank account. Invoices always use the class's account (in practice Finance does not pick one per Invoice), so the per-Invoice account select is removed and the review panel shows the class account read-only. If a class has no default, or the Student has no official class, Finance picks a fallback account per channel in the submit modal (confirmed by the user 2026-10-17). Audit: `COLLECTION_RUN_SUBMITTED`.
  - `POST .../submissions/:submissionId/approve` ("Duyệt & gửi phụ huynh", `COLLECTION_RUN_APPROVE`). This rechecks the fingerprint, then issues every Invoice in the set in one transaction, using the same per-Invoice rules as `issueInvoice` today (promotion recheck, prepaid check, coverage facts, due date from FinancePolicy, ledger). If anything fails, the whole approval is rejected and nothing is issued. Audit: `COLLECTION_RUN_APPROVED`, plus `INVOICE_ISSUED` for each Invoice as today.
  - `PUT .../submissions/:submissionId/invoices/:invoiceId/note` ("Ghi chú cho kế toán", `COLLECTION_RUN_APPROVE`) with `{ note }` (1–1000 characters, or `null` to clear). The manager can call it while the submission is `SUBMITTED`, from the approve modal's "Cần chú ý" table or from the Invoice page. The note is stored on `CollectionRunSubmissionInvoice` (`reviewNote`, `reviewNotedByMembershipId`, `reviewNotedAt`). Audit: `COLLECTION_RUN_INVOICE_NOTED`.
  - `POST .../submissions/:submissionId/return` ("Trả lại", `COLLECTION_RUN_APPROVE`) with an optional general `returnNote` (up to 1000 characters). The general note is required when no Invoice in the submission has a note. The run becomes editable again. Until the next submission, Finance sees the general note on the run, a "Cần sửa" badge with the note on each noted Invoice row, and the note on the Invoice page. Audit: `COLLECTION_RUN_RETURNED`, with the noted Invoice ids.
  - Approving while some Invoices have notes is allowed. The modal warns about it, and the notes stay only in the history.
  - `POST .../submissions/:submissionId/withdraw` ("Rút lại", Finance) cancels a submission that is still pending, so Finance can fix something before the manager acts.
- **Lock while pending:** while a submission is `SUBMITTED`, every mutation that changes a DRAFT Invoice in its set or the run's billing input is refused with `COLLECTION_RUN_PENDING_APPROVAL`. This covers lines, coverage, debt transfer, extracurricular exclusion and quantity, and adding students. The rule is enforced in the service and by a DB trigger on the Invoice/InvoiceLine writes, like the existing DRAFT-only triggers.
- **Fingerprint:** a hash of `(invoiceId, version, total)` over the set. Approval refuses with `COLLECTION_RUN_SUBMISSION_STALE` if anything changed.
- **After approval:** new DRAFT Invoices in the same run (a Student added later, a settlement, a revision) need a new submission. The run screen shows "N hóa đơn chờ gửi duyệt". `POST .../invoices/:invoiceId/issue` and `.../issue-revision` are removed from the Finance API, because issuing happens only through approval.
- **Same person (confirmed by the user 2026-10-17):** the approver may be the person who submitted, if they hold both `FINANCE_MANAGE` and `COLLECTION_RUN_APPROVE`. The audit keeps both the submitter and the approver. The step is mandatory, but separation of duties is not enforced.
- Run status (`DRAFT/READY/GENERATED/CLOSED`) does not change. The approval state is read from the latest submission. A run cannot close while a submission is `SUBMITTED`.

### 2. ZIP of Invoice images for a run

- `POST .../collection-runs/:runId/payment-images/exports` is idempotent with an Operation and follows the `FinanceReportExport` pattern. It builds a ZIP of payment images for every Invoice of the run that can have an image today (`ISSUED` and not yet paid). It renders one PNG per Student with the existing `renderPaymentImage`, so SCHOOL and PERSONAL parts share one image, as on the single download. The ZIP is stored with a 10-minute expiry, and the response returns an `exportId`. `GET .../exports/:exportId` downloads it once, with `Cache-Control: private, no-store`.
- File name inside the ZIP: `<Lớp>_<Tên học sinh>_<Tên đợt thu>.png` (for example `Lá 1_Nguyễn Văn An_Tháng 10-2026.png`), keeping Vietnamese diacritics (UTF-8 names, ZIP flag bit 11). Characters not allowed in file names (`/ \ : * ? " < > |`) become `-`. If two Students share a name in one class, the student code is added: `<Lớp>_<Tên học sinh>_<Tên đợt thu>_<Mã HS>.png`. A Student without an official class uses `Chưa xếp lớp`. The ZIP file is named `<Tên đợt thu>.zip`.
- Optional filter `classId` downloads one class.
- Audit: `COLLECTION_RUN_PAYMENT_IMAGES_EXPORTED` with the run, the count and the total. The per-image audit stays for single downloads.
- Requires `FINANCE_MANAGE`. The export holds parent-facing payment data, so it is never cached and expires quickly.

## UI (Admin portal)

- Run detail, Finance: a primary button "Gửi duyệt (N hóa đơn · tổng X đ)" opens a modal with the summary and the fallback bank choice. While the submission is pending, the run shows a "Chờ duyệt" status bar and the edit actions are disabled. A returned run shows the return note in a quiet note at the bottom of the run, with the time and the person who returned it.
- Run detail, manager: a "Duyệt đợt thu" review modal shows the count, the total, the totals by class, the difference from the previous run, and a "Cần chú ý" table (manual lines, promotions, settlements). That table has a column "Ghi chú cho kế toán" and, on each row, the actions "Xem hóa đơn" and "Ghi chú". The modal's actions are "Duyệt & gửi phụ huynh" and "Trả lại". The return modal lists the Invoice notes and has the general note field.
- Invoice page while pending: read-only, with a "Ghi chú cho kế toán" action for the manager. After a return, the note shows in the review panel.
- Per-Invoice "Phát hành phiếu thu" / "Phát hành phiếu hoàn tiền" buttons are removed. The review panel becomes "Rà soát trước khi gửi duyệt", with "Về đợt thu để gửi duyệt". While a submission is pending, the Invoice shows "Chờ duyệt" and is read-only. Issued Invoices keep the "Đã phát hành" badge.
- "Tải ảnh hóa đơn (ZIP)" goes in the run's actions next to the existing exports, with an optional class filter.
- Navigation: holders of `COLLECTION_RUN_APPROVE` see a count of runs waiting for approval in the finance section.

## Mockup

Updated on 2026-10-17 and waiting for user review: `mockups/admin/invoice-generation.html` (`#run-generated`, `#run-pending`, `#run-returned` and the submit, approve, return and ZIP modals), `invoice-detail-review.html` (`#pending`, `#returned`), `invoice-settlement-review.html` and `center-collection-run-detail.html`. The links are in `review.html` under "Duyệt đợt thu". The navigation count for approvers is not drawn in the mockup.

## Impact

- API: new capability, two models plus trigger, five mutations and one download. `issueInvoice`/`issueRevision` become internal helpers called by approval. Parent visibility does not change: it still means `ISSUED`.
- Tests: update the integration tests that issue directly (finance, channels, deductions, class scope) to go through submit and approve. Add tests for the stale fingerprint, the edit lock while pending, return with a note, a new submission after a late Student, and ZIP names (class first, diacritics, duplicate names, Student without class).
- Guides (Hướng dẫn): add the submit/approve steps and the ZIP download for non-app parents.
- No migration concern (no real users yet).

# Epic 7 Context: Phu huynh nhan huong dan chuyen khoan an toan

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Let an authorized Parent safely obtain transfer instructions for an eligible `PENDING` + `TRANSFER` invoice from its locked payment snapshot: view VietQR, copy each payment field, download the QR PNG, and optionally open a server-supported bank deep link. These are strictly read-only guidance actions. They never confirm payment, mutate an invoice, or imply that the school has confirmed receipt.

## Stories

- Story 7.1: Cung cap payment snapshot va VietQR cho Parent
- Story 7.2: Payment sheet voi VietQR, sao chep va tai QR
- Story 7.3: Mo deep link ngan hang co fallback

## Requirements & Constraints

- Before a `TRANSFER` invoice can move from `DRAFT` to `PENDING`, validate and lock a complete payment snapshot: total VND, bank identifier, account number, account-holder name, transfer content, and student/class display values. Missing or invalid required data rejects the transition; never create a partial snapshot.
- `GET /api/parent/invoices/:invoiceId/payment` is available only to a currently authorized Parent for a `PENDING` + `TRANSFER` invoice with a valid locked payment snapshot. Return only the minimal snapshot-derived payment DTO; do not read mutable Bank Account, Student, or Class source data to construct it, and do not reveal data for unauthorized or ineligible invoices.
- The same authorization and eligibility boundary serves VietQR PNG when the request sends `Accept: image/png`. Generate it in the API from the locked snapshot, return `Cache-Control: no-store`, and use `Content-Disposition` filename `anh-hoa-<invoiceId>.png`. Payment DTO, QR display, PNG download, copy, and bank opening are read-only and cannot transition an invoice to `COMPLETED`.
- Payment guidance must disappear immediately when revalidation finds `COMPLETED`, `DRAFT`, non-`TRANSFER`, invalid snapshot, or lost authorization. Clear the payment payload, close the sheet, and refresh Home/detail. Say `Nha truong da xac nhan Hoa don nay` for `COMPLETED`; otherwise say `Huong dan chuyen tien khong con kha dung`.
- A revoke remains scoped to its student: remove that student's payment/detail data and close its sheet while retaining the Parent session and other active students. On session expiry or `401`, clear all protected state before routing to login. Never cache payment snapshots or Parent REST responses in the service worker.
- Bank deep links are an optional server-configured enhancement. The API creates each URI only from the locked snapshot and a versioned template. Do not hard-code bank lists, URI templates, support logic, or payment payloads in the client. Do not expose a deep-link action unless the bank/device/browser configuration has a tested support matrix, valid schema, version, expiry/revalidation date, and owner/cadence; otherwise retain VietQR, PNG, and copy fields as mandatory fallbacks.
- No Parent payment confirmation, receipt upload, invoice/status edit, payment-success message, chat, PDF, print, push notification, or offline action is in scope. The persistent message is `Dang cho nha truong xac nhan`.
- Verify snapshot retention after mutable Student/Class/Bank Account sources change or become inactive; eligibility and denial for all ineligible states; no payload disclosure after revoke; PNG headers/content; QR/download/deep-link failure fallback; return to PWA; and no invoice mutation after every payment action through API unit/PostgreSQL integration tests and Parent PWA Playwright coverage.

## Technical Decisions

- `apps/api` owns invoice lifecycle validation, payment snapshots, VND totals, VietQR data/PNG generation, bank deep-link configuration, authorization, and Parent payment DTOs. Extend the existing `invoices` `DRAFT -> PENDING` transition rather than duplicating payment rules in `parent-portal` or `apps/parent-web`.
- Keep the Parent REST boundary under `/api/parent`. `parent-portal` owns authorized payment read DTOs and may use Prisma plus narrowly exported `parents`, `students`, and `invoices` query services; it never calls controllers or writes invoice lifecycle data. Controllers delegate to services and no Parent module calls an Admin controller.
- Retain inherited formats and boundaries: UUID invoice identifiers, VND `BIGINT` mapped safely at the REST boundary, camelCase JSON, common error envelope, and Parent query keys beginning with `parent`. Treat `401` and denied eligibility as authorization-state transitions, not retryable query failures.
- Use `vietnam-qr-pay` in the API for VietQR and `qrcode.react` only to display the authorized result in Parent web. The server owns QR content; the client neither recreates it from mutable source data nor treats a locally held payload as current after revalidation.
- Parent payment routes remain protected by the separate Parent cookie/session and current active Parent-student authorization. A known `invoiceId`, cached response, URL, filter, or prior payment sheet is never proof of access.
- Bank deep-link configuration is validated at API bootstrap. Invalid, expired, unowned, untested, or unsupported configuration disables only the deep-link action rather than preventing the Parent PWA from loading or hiding the required QR/copy fallback.

## UX & Interaction Patterns

- Add `Chuyen tien` only for a `PENDING` + `TRANSFER` invoice after the payment API confirms eligibility, on both the pending card and read-only invoice detail. `CASH` shows cash-at-school guidance only; `COMPLETED` has no payment CTA or QR action.
- Open a named, described payment dialog after the eligibility check. On mobile it is a bottom sheet up to 92vh with a subtle backdrop and soft shadow; on tablet/desktop center it at a maximum width of 480px. Keep the existing single-column Parent surface, not a table or sidebar.
- Present student name, billing month, labeled pending status, and total VND near the top, then VietQR with generous whitespace. Provide separate copy controls for amount, bank, account number, account-holder name, and transfer content. QR alt text is `Ma QR chuyen khoan cho [ten Hoc sinh], [so tien] dong`; QR is never the only payment method.
- Offer `Tai ma QR`; show `Mo app ngan hang` only when supplied by the server. Download success may use brief confirmation feedback. QR/download errors remain inline, specific, and retryable while the sheet stays open and all copy fields remain usable. A failed, blocked, unsupported, or returned bank link keeps the sheet open with QR/copy fallback and a clear message such as `Khong the mo app ngan hang. Ban van co the quet ma QR hoac sao chep thong tin.`
- The sheet footer always says `Dang cho nha truong xac nhan`. Do not render `Toi da chuyen tien`, `Da thanh toan thanh cong`, or any completion control. Copy, QR scan/download, deep link, closing the sheet, and `Esc` on desktop must not change the invoice.
- The dialog traps focus and returns focus to its opening CTA. Close, copy, download, and deep-link controls have clear accessible names and 44x44px minimum targets. Preserve focus on the activated control after copy, download, or a return from the banking app when it remains available. Use live regions for inline errors/status changes; do not move focus on a successful background refresh.

## Cross-Story Dependencies

- Admin Epics 1-4 provide the existing invoice lifecycle, Bank Account model, snapshots, and verification baseline. Epic 5 provides retained Parent-student links and current server-side authorization; Stories 5.2 and 5.3 must be complete before Parent payment data can be safely exposed.
- Epic 6 Story 6.1 supplies the isolated Parent PWA and session bootstrap. Story 6.2 supplies the authorized Parent read model and invoice endpoint on which payment authorization builds. Stories 6.3 and 6.4 provide the Home/detail CTA integration surface, but Epic 7's server payment contract starts after Story 6.2.
- Story 7.1 must merge, migrate where needed, and pass PostgreSQL integration tests before Stories 7.2 and 7.3. It extends the `DRAFT -> PENDING` lifecycle transition and establishes the payment DTO/PNG contract.
- Story 7.2 depends on Story 7.1's eligibility, snapshot, VietQR, and PNG contract. It establishes the payment sheet and required QR/copy/download fallback.
- Story 7.3 depends on Story 7.2's payment sheet and a server deep-link configuration that has passed bootstrap validation and has a verified support matrix. Until then, do not enable a bank deep link; VietQR, PNG, and copy fields remain the complete payment-guidance flow.

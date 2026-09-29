---
name: Issued Invoice payment image with VietQR for Finance
status: approved
date: 2026-09-29
trigger: Stakeholder request - Finance must download an issued Invoice as an image containing a VietQR transfer code and send it directly to the Parent, because the first release has no Parent app and charges tuition only.
mode: batch
---

# Sprint Change Proposal - Issued Invoice payment image with VietQR

## 1. Issue summary

The first PassionEdu release is operated without the Parent app. Finance issues tuition Invoices and must hand each family a payment notice it can pay from a banking app. The stakeholder asks for an action on the issued Invoice page that downloads the Invoice as an image with a VietQR code. Finance then sends that image to the Parent through its own channel (Zalo, chat, printed copy). A "send by email" action is noted as a later option and is out of scope here.

The current contract does not allow this:

1. `prd.md` §4.6/§10 Q1/§11, `SPEC.md:88`, `ARCHITECTURE-SPINE.md:291` and FR-17 in `epics-passionedu.md` defer VietQR, copy fields and bank deep links to a Parent enhancement after E7. There is no Admin-side QR anywhere.
2. `prd.md:230`, `addendum.md:38` and `ARCHITECTURE-SPINE.md:186` make CSV the only MVP export and exclude PDF/XLSX. An Invoice image is a new server-generated file.
3. `BankAccount` stores `receivingBank` as free text. A VietQR payload needs the NAPAS bank BIN, so no correct QR can be built from current data.
4. `invoice-detail-review.html` shows only the DRAFT review and a simulated issue; there is no reviewed issued-state layout.

The requirement existed in the historical Ánh Hoa PRDs (`prd-anhhoa-2026-08-18` FR-10 Admin VietQR; `prd-anhhoa-parent-pwa-2026-08-22` Parent `Tải mã QR` PNG). Those are historical only; this proposal is the decision record that brings the Admin part back into PassionEdu.

## 2. Decisions

| # | Decision | Source |
| --- | --- | --- |
| D1 | The QR amount is the amount the Parent must pay: the issued obligation total snapshot (`obligationTotalSnapshot`), which already includes server-applied carries and discounts. Exact settlement means this equals the outstanding amount while the Invoice is unpaid. | Stakeholder, 2026-09-29 |
| D2 | Admin/Finance only in this release. No Parent app, no Parent DTO change; FR-17 stays as written. | Stakeholder |
| D3 | Future Parent app: Parent downloads the QR only (not the Invoice image) or opens a banking app. That remains the deferred Parent enhancement (PRD §10 Q1-Q2); it reuses the BIN snapshot and VietQR payload built here. | Stakeholder |
| D4 | Email delivery to Parent is deferred; no mail infrastructure in this change. | Stakeholder |
| D5 | The API renders the PNG. The browser never composes the QR, amount or bank fields. | Proposed (AGENTS.md: API owns VND and snapshots) |
| D6 | Every receiving BankAccount has a BIN from creation. Finance picks the bank from a select box that maps BIN to bank name; there is no free-text bank and no account without BIN. | Stakeholder, 2026-09-29 |
| D7 | Transfer content is `<Student name> <Class name>`, without diacritics and cut to a fixed maximum length. | Stakeholder, 2026-09-29 |

## 3. Impact analysis

| Area | Impact |
| --- | --- |
| PRD (final) | Not edited. This proposal records the narrow exception: one server-generated PNG payment notice per issued Invoice for Finance, besides CSV reports. PRD §10 Q1 is answered for the Admin side only; Parent QR/deep link stay open. |
| SPEC / Architecture spine | Add the payment-image capability next to the CSV export rule: server-rendered, re-authorized, audited, `no-store`, never a stored public object. Record that VietQR BIN is part of the BankAccount and Invoice issue snapshot. |
| Epic 5 | New Story 5.21. Completed stories unchanged. |
| Data | `BankAccount.bankBin` (6-digit NAPAS BIN, `NOT NULL`); `receivingBank` becomes the display name from the same list. `Invoice.receivingBankBinSnapshot` captured at issue, required for every issued Invoice. There is no operational data yet (clean-break), so the migration does not backfill: local and E2E databases are reset and the seed uses real BINs. |
| API | `GET /schools/:schoolId/invoices/:invoiceId/payment-image` returns `image/png`. `GET` VietQR bank list (BIN, short name, full name) is a server-owned static list; BankAccount create accepts only a BIN from it and derives the bank name. `transferContent()` adds character filtering and truncation. |
| Admin UI | Issued Invoice panel gains `Tải ảnh hóa đơn`; BankAccount form replaces the free-text bank input with a required select box. |
| UX spine / mockups | `EXPERIENCE.md` rows for Invoice `ISSUED` and payment image. `invoice-detail-review.html` gains the issued state; new `invoice-payment-image.html` shows the image layout; `school-settings.html` bank form gets the bank select box. |
| Tests | Unit test for the VietQR payload (EMVCo fields and CRC) against a known reference string; integration tests for authorization, state gating, audit and headers; component + E2E test for the download action. |

### Invariants preserved

1. School authorization is API-owned. The image endpoint re-checks School membership and Finance capability on every request; the Invoice ID in the URL is not proof.
2. Amount, lines, bank and transfer content come only from the immutable issue snapshot. Changing or deactivating the BankAccount later never changes an issued image.
3. The image is a payment instruction, not a payment confirmation. Downloading it does not change Invoice state, and it carries no "I paid" semantics.
4. No partial payment: the QR carries the full obligation total; there is no editable amount.
5. The file is generated per request and not persisted, so there is no long-lived object URL.

## 4. Recommended approach

### 4.1 When the action is available

| Invoice state | `Tải ảnh hóa đơn` |
| --- | --- |
| `DRAFT` | Hidden (nothing issued yet). |
| `ISSUED`, no Receipt or settlement transfer | Shown, primary action of the issued panel. |
| `ISSUED` already settled, `CLOSED`, `CANCELLED` | Hidden; panel shows the settlement result as today. A revised Invoice gets its own image. |

The server enforces the same rule and returns `409` with a Vietnamese message for other states.

### 4.2 Image content (portrait, 1080 px wide, fits a phone chat)

```text
[School name]
THÔNG BÁO HỌC PHÍ THÁNG 10/2026
Học sinh: HS001 - Nguyễn Minh Anh · Lớp Mầm 4A
Mã hóa đơn: <obligationCode> · Hạn thanh toán: 10/10/2026

Khoản thu                                 Số tiền
Học phí tháng 10/2026                  3.500.000
Giảm trừ ... (if any)                   -350.000
Khoản thu thiếu chuyển sang (if any)     120.000
TỔNG CẦN NỘP                        3.270.000 VND

[ VietQR code ]   Ngân hàng: Vietcombank
                  Số tài khoản: 0123456789
                  Chủ tài khoản: TRUONG MN ANH HOA
                  Nội dung: Nguyen Minh Anh Mam 4A

Quét mã bằng ứng dụng ngân hàng. Nhà trường xác nhận sau khi nhận được tiền.
```

- Lines are the server obligation lines snapshot; in the first release they are tuition lines only.
- The file name is `<obligationCode>-<studentCode>.png`; the response has `Cache-Control: no-store`.

### 4.3 VietQR payload

- EMVCo merchant-presented QR per the NAPAS VietQR spec: bank BIN + account number, amount = `obligationTotalSnapshot`, currency 704, country VN, transfer content as additional data, CRC-16/CCITT.
- Transfer content keeps the existing fixed template `{{studentName}} {{className}}` and is built once at issue (`transferContentSnapshot`), so the QR and the text on the image are identical:
  1. Remove diacritics (`đ/Đ` -> `d/D`); this already exists in `transferContent()`.
  2. Keep only `A-Z a-z 0-9` and spaces; other characters become a space, and repeated spaces collapse.
  3. Maximum 50 characters. When too long, shorten the Student name (cut at the last whole word) so the Class name always stays complete; if the Class name alone is longer than 50, cut the whole string at 50.
  - Example: `Nguyễn Thị Minh Anh` + `Mầm 4A` -> `Nguyen Thi Minh Anh Mam 4A`.
  - 50 is the proposed limit because several Vietnamese banks cut interbank transfer content around 50 characters; confirm or change it at approval.
- Rendering uses a server QR library and a server image renderer with an embedded Vietnamese font; the library choice is left to the story.

### 4.4 Issued Invoice page (mockup `invoice-detail-review.html`, issued state)

```text
Right panel "Thanh toán" (replaces "Rà soát trước khi phát hành" after issue):
  Badge Đã phát hành · Hạn 10/10/2026
  Tổng cần nộp 3.270.000 VND
  Ngân hàng / Số tài khoản / Chủ tài khoản / Nội dung chuyển khoản
  Thumbnail preview of the image (from the same endpoint)
  [Tải ảnh hóa đơn]  (primary)
  "Gửi ảnh này cho phụ huynh qua kênh liên lạc của trường."
  Secondary: Chuẩn bị bản điều chỉnh
Left column: immutable obligation lines (read-only), as today.
```

- On failure the panel keeps the text payment details visible and shows an inline retry message; download is a read, so it needs no Idempotency-Key or Operation.
- The run Invoice table does not get bulk download in this change; a later "Tải tất cả ảnh" (ZIP) can reuse the endpoint.

### 4.5 BankAccount form (mockup `school-settings.html`)

- `Ngân hàng nhận` is a required select box built from the server VietQR bank list. Each option shows `Short name - Full name` (for example `Vietcombank - Ngân hàng TMCP Ngoại thương Việt Nam`) and its value is the BIN.
- The server rejects a BIN outside the list, stores the BIN and derives the display name from it; the browser does not send a bank name.
- The account table shows the bank name; the BIN is visible only in the account detail.

## 5. Story

### Story 5.21: Tải ảnh hóa đơn đã phát hành có mã VietQR

As a Finance Manager,
I want to download an issued tuition Invoice as an image with a VietQR code,
So that I can send it to the Parent, who pays the exact amount from a banking app.

**Acceptance criteria**

1. **Given** a BankAccount is created **When** Finance picks a bank from the select box **Then** the server accepts only a BIN from its VietQR list, stores the BIN and derives the bank name; a missing or unknown BIN is refused.
2. **Given** an Invoice is issued **When** the issue snapshot is written **Then** it includes the BIN of the chosen account and transfer content `<Student name> <Class name>` without diacritics, limited to `A-Z a-z 0-9` and spaces, at most 50 characters with the Class name kept whole; neither changes when the BankAccount later changes.
3. **Given** an `ISSUED` unsettled Invoice in the actor's School **When** Finance requests the payment image **Then** the API returns a PNG rendered from the issue snapshot with the content in §4.2 and a VietQR whose amount equals `obligationTotalSnapshot`, with `no-store` and a deterministic file name, and records an audit event.
4. **Given** a `DRAFT`, settled, `CLOSED` or `CANCELLED` Invoice, another School's Invoice or an actor without Finance capability **When** the image is requested **Then** the API refuses without leaking data (`409`/`404`/`403` as existing Finance reads do).
5. **Given** the issued Invoice page **When** the Invoice is `ISSUED` and unsettled **Then** the panel shows payment details, image preview and `Tải ảnh hóa đơn` per the reviewed mockup; other states hide the action.
6. **And** a unit test covers transfer content truncation (long Student name, long Class name, special characters), a unit test decodes the generated VietQR payload and checks BIN, account, amount, content and CRC; E2E downloads the image for an issued Invoice.

## 6. Artifact updates after approval

1. This proposal: `status: approved`.
2. `epics-passionedu.md`: add Story 5.21; add a note to FR-17 that Admin payment image is in scope while Parent QR/deep link stay deferred.
3. `SPEC.md` and `ARCHITECTURE-SPINE.md`: payment-image exception beside the CSV export rule; VietQR BIN in BankAccount and issue snapshot.
4. `EXPERIENCE.md`: Invoice `ISSUED` row and a `Payment image` row.
5. Mockups: `invoice-detail-review.html` issued state, new `invoice-payment-image.html`, `school-settings.html` bank select box; `MOCKUP-COVERAGE.md` and `test:mockups` contracts.
6. `sprint-status.yaml`: `5-21-tai-anh-hoa-don-da-phat-hanh-co-vietqr: backlog`.

## 7. Out of scope

- Parent app QR download and bank deep links (deferred Parent enhancement, reuses this payload).
- Email or Zalo sending from the system.
- Bulk ZIP download per CollectionRun.
- PDF, e-invoice (hóa đơn điện tử) or tax documents.
- Automatic payment matching from bank transactions.

---
name: Taxed receivables, VAT and two payment channels per Invoice
status: approved
date: 2026-09-30
trigger: Stakeholder request - each receivable is either taxed or not (reference Kidsonline "Tạo khoản thu mới"). Taxed receivables add VAT to the Invoice and are paid to the School account; untaxed receivables are paid to a personal account. The payment notice carries two VietQR codes.
mode: batch
---

# Sprint Change Proposal - Taxed receivables and two payment channels

## 1. Issue summary

The School collects money into two kinds of bank accounts:

- **School account** (tài khoản trường): receives taxed receivables. A School usually has exactly one.
- **Personal account** (tài khoản cá nhân): receives receivables that are not declared for tax. These are the accounts managed today in `Cấu hình chung`.

Each receivable is classified like Kidsonline: `Không kê khai nộp thuế`, `Không chịu thuế`, `Thuế suất 0%`, `5%`, `8%`, `10%`. When a receivable has a VAT rate, the Invoice grows by the VAT amount. When an Invoice is issued, taxed lines are paid by a QR to the School account and untaxed lines by a QR to a personal account, so the payment notice shows two QR codes.

The current contract does not allow this:

1. `prd.md:328` and `SPEC.md:75` exclude VAT calculation; tax treatment is only a School-level label (`FinancePolicy.taxTreatment`).
2. `Receivable` has no tax data; `BankAccount` has no kind.
3. `prd.md:192` and `issueInvoice` take exactly one BankAccount per Invoice; the payment image (Story 5.21) renders one QR for the whole obligation.
4. CAP-4 says a Student has at most one Invoice in a CollectionRun.
5. Settlement is per Invoice (one Receipt per Invoice, exact settlement, no `PARTIALLY_PAID`). Two transfers into two accounts arrive and are reconciled separately, so one Invoice with two payment parts would need partial settlement.

## 2. Decisions

| # | Decision | Source |
| --- | --- | --- |
| D1 | `Receivable.taxCategory` is one of `NOT_DECLARED` (Không kê khai nộp thuế), `EXEMPT` (Không chịu thuế), `VAT_0`, `VAT_5`, `VAT_8`, `VAT_10`. The rate comes from the category; there is no separate free VAT % field. | Stakeholder, 2026-09-30 |
| D2 | Payment channel is derived from the category: `NOT_DECLARED` -> `PERSONAL`; every other category (including `EXEMPT` and `VAT_0`) -> `SCHOOL`. | Stakeholder, 2026-09-30 |
| D3 | VAT is calculated by the API. The catalog price is before VAT; the Invoice total includes VAT. | Stakeholder, 2026-09-30 |
| D4 | The settlement unit is one Invoice per channel. A Student has at most one normal Invoice per `(CollectionRun, channel)`; the two Invoices of the same Student and run form one **payment notice** (phiếu thu) for display only. Each Invoice keeps one BankAccount, one Receipt and exact settlement, unchanged. | Stakeholder approved option B, 2026-09-30 |
| D5 | `BankAccount.kind` is `SCHOOL` or `PERSONAL`. At most one `SCHOOL` account is `ACTIVE` per School, and it is applied automatically to the `SCHOOL` channel at issue. | Stakeholder, 2026-09-30 |
| D6 | Each Class may set one default `PERSONAL` account. At issue the `PERSONAL` channel uses the account chosen by Finance, otherwise the Class default; with neither, issue is refused with a message asking to choose one. | Stakeholder, 2026-09-30 |
| D7 | `FinancePolicy.taxTreatment` is removed from the settings form and new policies; its meaning moves to the receivable. Existing snapshots stay readable. | Stakeholder, 2026-09-30 |
| D8 | VAT rounding is per Invoice line, half-up to whole VND: `vat = (net * rate + 50) / 100` in integer arithmetic. | Stakeholder, 2026-09-30 |
| D9 | Discounts apply before VAT: VAT is charged on the line net after promotion discount. | Stakeholder, 2026-09-30 |

## 3. Impact analysis

| Area | Impact |
| --- | --- |
| PRD (final) | Not edited. This proposal records the exception: per-receivable tax category, API-calculated VAT, and two channel Invoices per Student per run. PRD §4.6 "one BankAccount per Invoice" still holds for each channel Invoice. No e-invoice (hóa đơn điện tử) or tax filing. |
| SPEC | CAP-4 success: "at most one Invoice per Student, CollectionRun and payment channel". Non-goals: replace "VAT calculation" by "e-invoice issuance and tax filing". Add VAT rounding rule next to the VND rules. |
| Architecture spine | Channel is part of the Invoice identity and of every settlement guard: carries, prior-debt transfer, SettlementTransfer and coverage refund stay within one channel. BankAccount kind and Class default account are School-scoped and re-checked at issue. |
| Epic 5 | New Stories 5.22-5.25. Completed stories unchanged; Story 5.21 image is extended by 5.25. |
| Data | See §4.6. Existing rows migrate so current behaviour is unchanged. |
| UX spine / mockups | `receivable-configuration.html`, `school-settings.html`, Class settings (roster), `invoice-detail-review.html`, `finance-run-preview.html`, `invoice-payment-image.html`, `receipt-queue.html`. |
| Parent | Parent obligation list shows the two Invoices grouped by payment notice; DTO adds only `channel`. VietQR for Parent stays deferred. |

### Invariants preserved

1. API owns VAT, totals and channel assignment; the browser never sends a VAT amount, rate or channel.
2. Exact settlement per Invoice: no `PARTIALLY_PAID`, no Receipt spanning two Invoices. Paying one channel never changes the other channel's Invoice.
3. Money never crosses channels: a shortfall or overpayment of one channel can only be carried to an Invoice of the same channel.
4. Issued snapshots are immutable: changing a receivable category, VAT rate, BankAccount or Class default after issue changes nothing issued.
5. Everything is School-scoped: BankAccount, Class default account and Receivable must belong to the Invoice School; IDs from the browser are not proof.

## 4. Recommended approach

### 4.1 Receivable form (mockup `receivable-configuration.html`)

```text
Tên khoản thu            Mã
Giá / đơn vị (chưa VAT)  Đơn vị
Mức thuế suất [Không kê khai nộp thuế | Không chịu thuế | Thuế suất 0% | 5% | 8% | 10%]
  Hint under select: "Thu vào tài khoản cá nhân" or "Thu vào tài khoản trường"
```

- Default for a new receivable: `NOT_DECLARED`.
- Changing the category is audited and affects only lines generated or edited afterwards; existing DRAFT lines keep their snapshot until regenerated.
- The catalog table shows a `Thuế` column (e.g. `10%`, `Không chịu thuế`, `Không kê khai`).
- Out of scope from the Kidsonline form: refund price/unit, "Loại khoản thu", "Cho phép xuất hóa đơn điện tử".

### 4.2 VAT on Invoice lines

| Field on `InvoiceLine` | Meaning |
| --- | --- |
| `taxCategorySnapshot` | Category at line creation |
| `vatRateSnapshot` | Integer percent 0/5/8/10, `NULL` for `NOT_DECLARED`/`EXEMPT` |
| `netAmount` | Unchanged: gross - discount, before VAT |
| `vatAmount` | `(netAmount * rate + 50) / 100`, `0` without rate |
| `amount` | `netAmount + vatAmount`; Invoice `total` = sum of `amount` + carries |

- Worked example: Học phí 3.500.000, giảm 350.000, VAT 5% -> net 3.150.000, VAT 157.500, line 3.307.500.
- `PRIOR_DEBT` lines and settlement carries carry no VAT (their source already includes it).
- Promotion coverage facts snapshot the VAT rate; a coverage refund returns the refundable net plus its VAT with the same rounding, capped by the paid source as today.

### 4.3 Generation and DRAFT

- Generation splits a Student's lines by channel and creates up to two DRAFT Invoices: `channel = SCHOOL` and `channel = PERSONAL`. A channel without lines has no Invoice.
- Unique index `Invoice_normal_per_student_run_key` becomes `(schoolId, studentId, collectionRunId, channel)` for normal Invoices; replacement uniqueness stays per source Invoice.
- Manual line add/edit on a DRAFT: the line goes to the Invoice of its receivable's channel; if that Invoice does not exist it is created in the same Operation.
- A pending SHORTFALL/OVERPAYMENT carry applies only to the next Invoice of the same Student and channel; if the next run has no Invoice in that channel the carry stays pending and is shown to Finance.
- Prior-debt transfer is allowed only to an Invoice of the same channel.

### 4.4 Issue

- Issue works on the payment notice: one Operation issues both channel Invoices of the Student in the run, so the notice always has both QR codes. Each Invoice gets its own obligation code, bank snapshot, transfer content and `dueOn` from the same policy.
- `SCHOOL` channel: the single `ACTIVE` `SCHOOL` account. None -> `409 SCHOOL_BANK_ACCOUNT_REQUIRED` "Chưa cấu hình tài khoản trường để thu khoản có thuế."
- `PERSONAL` channel: `personalBankAccountId` from the request if given, else the Class default for the Invoice class snapshot. None -> `409 PERSONAL_BANK_ACCOUNT_REQUIRED`.
- The issue panel pre-selects the Class default and lets Finance change it; the School account is shown read-only.
- Transfer content keeps the D7 template of Story 5.21 for both channels; the accounts differ, so reconciliation stays unambiguous.

### 4.5 Settings (mockups `school-settings.html`, Class settings)

- `Tài khoản nhận tiền` has two sections: `Tài khoản trường (khoản có thuế)` and `Tài khoản cá nhân (khoản không kê khai)`. Activating a second `SCHOOL` account is refused until the current one is deactivated.
- Class settings gain `Tài khoản thu mặc định` (select from `ACTIVE` `PERSONAL` accounts of the School). Classes belong to a SchoolYear and the roster transition does not create or carry over Classes, so each Class of a new SchoolYear sets its own default; without a default, Finance picks a personal account at issue. A deactivated account is ignored at issue and flagged on the Class.

### 4.6 Data migration

- `Receivable.taxCategory` `NOT NULL DEFAULT 'NOT_DECLARED'` -> existing receivables stay untaxed and personal.
- `BankAccount.kind` `NOT NULL DEFAULT 'PERSONAL'` -> existing accounts become personal (stakeholder).
- `Invoice.channel` `NOT NULL DEFAULT 'PERSONAL'` -> existing Invoices keep the account they were issued with.
- `InvoiceLine.vatAmount` default `0`, `taxCategorySnapshot` `NOT_DECLARED` for existing lines; issued snapshot guards are extended to the new columns.
- `Class.defaultBankAccountId` nullable, composite FK `(schoolId, defaultBankAccountId)`.

### 4.7 Payment notice image and screens

```text
[School name]
THÔNG BÁO HỌC PHÍ THÁNG 10/2026
Học sinh: HS001 - Nguyễn Minh Anh · Lớp Mầm 4A · Hạn 10/10/2026

PHẦN 1 - THU VÀO TÀI KHOẢN TRƯỜNG           Mã: OBL-202610-000012
Học phí tháng 10/2026                              3.500.000
Giảm trừ ưu đãi                                     -350.000
Thuế GTGT 5%                                         157.500
Tổng phần 1                                     3.307.500 VND
[ VietQR ]  Vietcombank · 0123456789 · TRUONG MN ANH HOA
            Nội dung: Nguyen Minh Anh Mam 4A

PHẦN 2 - THU VÀO TÀI KHOẢN CÁ NHÂN          Mã: OBL-202610-000013
Tiền ăn · 22 ngày                                  660.000
Đồng phục                                          250.000
Tổng phần 2                                       910.000 VND
[ VietQR ]  Techcombank · 1903... · NGUYEN VAN A
            Nội dung: Nguyen Minh Anh Mam 4A

TỔNG CẦN NỘP (2 lần chuyển khoản)               4.217.500 VND
```

- A part that is settled, transferred or zero is omitted; with one part left the image has one QR, like Story 5.21.
- Invoice detail shows the notice with both parts; each part has its own status badge (`Chưa thu` or the Invoice status). Receipts are posted from the `Thu tiền` queue, not from Invoice detail.
- Run invoice table and receipt queue list one row per channel Invoice with a `Tài khoản nhận` column (`Tài khoản trường`/`Tài khoản cá nhân`); a Student with two parts appears on two rows. The receipt dialog is titled `Ghi thực nhận cho <tên> · Tài khoản trường|cá nhân`; receipts are posted per channel Invoice.

## 5. Stories

### Story 5.22: Phân loại thuế cho khoản thu và tính VAT

As a Finance Manager, I want to set the tax category of each receivable, so that the Invoice adds VAT and each line is routed to the right account.

1. **Given** a receivable is created or edited **When** Finance picks a category **Then** the API stores one of the six categories, audits the change and derives the channel; the browser cannot send a rate or channel.
2. **Given** a line is generated or edited **Then** the API snapshots category and rate and computes `vatAmount` per §4.2 with half-up rounding after discount; prior-debt lines and carries have no VAT.
3. **And** unit tests cover rounding at .5, discount before VAT, max safe VND and each category.

### Story 5.23: Tài khoản trường và tài khoản thu mặc định theo lớp

1. **Given** a BankAccount is created **Then** it has kind `SCHOOL` or `PERSONAL`; a second `ACTIVE` `SCHOOL` account is refused.
2. **Given** a Class **When** Finance sets a default account **Then** only an `ACTIVE` `PERSONAL` account of the same School is accepted; cross-School IDs are refused.
3. **And** each Class of a new SchoolYear sets its own default (the roster transition does not create or carry over Classes); without a default, Finance picks a personal account at issue.

### Story 5.24: Tách hóa đơn theo kênh thanh toán và phát hành phiếu thu

1. **Given** generation **Then** a Student gets at most one normal Invoice per channel in a run; retry or timeout never duplicates one.
2. **Given** issue of a notice **Then** both channel Invoices are issued in one Operation with the School account and the chosen or Class-default personal account; missing accounts return the `409` codes of §4.4 and nothing is issued.
3. **Given** a non-exact receipt on one channel **Then** its carry applies only to a later Invoice of the same channel; prior-debt transfer across channels is refused.
4. **And** integration tests cover tenant isolation, idempotent retry, cross-channel carry refusal and snapshot immutability.

### Story 5.25: Ảnh phiếu thu hai mã VietQR

1. **Given** a notice with unsettled Invoices in both channels **When** Finance downloads the image **Then** the PNG has one section per unsettled channel with its lines, VAT, total, bank and a VietQR whose amount equals that Invoice obligation total.
2. **Given** one channel is settled **Then** only the other section is rendered.
3. **And** a unit test decodes both QR payloads; E2E downloads a two-QR image.

## 6. Artifact updates after approval

1. This proposal: `status: approved`.
2. `SPEC.md`: CAP-4 success, non-goals, VAT rounding rule; `sources:` adds this proposal.
3. `ARCHITECTURE-SPINE.md`: channel in Invoice identity and settlement guards.
4. `epics-passionedu.md`: Stories 5.22-5.25; FR-17 note on two-part notice.
5. `EXPERIENCE.md` and mockups listed in §3; `MOCKUP-COVERAGE.md` and `test:mockups` contracts.
6. `sprint-status.yaml`: Stories 5.22-5.25 as `backlog`.

## 7. Out of scope

- Electronic invoices (hóa đơn điện tử), VAT declaration or any tax filing integration.
- Refund price/unit and "Loại khoản thu" from the Kidsonline form.
- Parent VietQR / deep link (still deferred).
- Automatic matching of bank transactions to channel Invoices.

## 8. Resolved at approval (2026-09-30)

1. D8 rounding per line, half-up to whole VND: approved.
2. D9 VAT after discount: approved.
3. A School without an `ACTIVE` `SCHOOL` account may issue notices that have only a `PERSONAL` part; the School account is required only when a notice has a `SCHOOL` part: approved.
4. Seed data covers both channels (taxed and untaxed receivables, one School account, personal accounts with Class defaults) so local and E2E testing can exercise two-QR notices.

---
name: Refund price, leave-day deduction, negative settlement Invoice and prepaid package refund
status: approved
approved: 2026-10-01
date: 2026-10-01
trigger: Stakeholder request - add a refund price ("khoản giảm trừ") to each receivable (reference Kidsonline "Tạo khoản thu mới" with "Giá hoàn trả / đơn vị hoàn trả" and the Kidsonline invoice row "Thu 21 ngày x 50.000 / Bớt 3 ngày x 40.000"). Meal fee is prepaid per month; the next month deducts the excused absence days of the previous month at the refund price. A Student who leaves gets a final settlement Invoice the next month, which may be negative. A multi-month prepaid tuition package is refunded as "paid - list price x months used", not pro rata.
mode: batch
---

# Sprint Change Proposal - Refund price, leave deduction and settlement Invoice

## 1. Issue summary

1. **Meal deduction.** Meal fee (tiền ăn) is charged in advance for the billing month. Excused leave days (nghỉ có phép) of a month are given back on the **next** month's Invoice at a refund price per day that can differ from the charged price (charged 50.000 đ/ngày, refunded 40.000 đ/ngày). Kidsonline shows this as `Thu` and `Bớt` on the same line:

   ```text
   Tiền ăn   Thu 21 ngày x 50.000   = 1.050.000
             Bớt  3 ngày x 40.000   =  -120.000
             Thành tiền                  930.000
   ```

2. **Final settlement.** When a Student leaves, the School makes a last Invoice the following month (hóa đơn quyết toán): no new charges, only the deductions and refunds owed. Its total is usually negative: the School pays the parent back.

3. **Prepaid package refund.** A prepaid tuition package (e.g. 12 months) can extend into the next SchoolYear. On withdrawal the refund ignores the package discount for months already used:

   ```text
   Học phí 6.900.000/tháng, nộp 12 tháng giảm 30.000.000 -> đã nộp 52.800.000
   Học 6 tháng rồi nghỉ: hoàn = 52.800.000 - 6.900.000 x 6 = 11.400.000
   ```

### Current state

- `Receivable` has `defaultUnitPrice` only; no refund price.
- Excused leave is stored per Student and day (`LeaveDaySource`, minus `LeaveDaySourceExclusion` on a confirmed `PRESENT`; Story 4.5). Finance never reads it. PRD/Story 4.5 planned a "source-linked negative meal line on the next DRAFT"; it was never built.
- DB CHECKs forbid zero/negative quantity, price and line amounts; triggers refuse a negative Invoice total. Settlement is a Receipt only.
- A Student is invoiced only while on the run roster; there is no Invoice after withdrawal.
- Coverage refund is a separate flow (`Hoàn ưu đãi nộp trước`) computed per coverage month as `paidNet x remainingDays / operatingDays` (decision 2026-09-30 D11). Coverage periods must lie inside the source SchoolYear (`COVERAGE_PERIOD_OUT_OF_BOUNDS`).
- The label `Giảm trừ` is already used for promotion discounts.

## 2. Decisions

| # | Decision | Source |
| --- | --- | --- |
| D1 | `Receivable.refundUnitPrice`: VND `BIGINT`, `>= 0`, default `0`, before VAT. **It may exceed `defaultUnitPrice`.** The refund unit is the receivable `unitLabel`; no separate refund unit. | Stakeholder, 2026-10-01 |
| D2 | Every NORMAL line has a `Thu` part and a `Bớt` part on the same line (Kidsonline layout); `Bớt` is not a separate line. | Stakeholder, 2026-10-01 |
| D3 | Naming: form field `Giá hoàn trả / đơn vị (chưa VAT)`; Invoice part `Bớt`; the promotion discount is renamed from `Giảm trừ` to `Ưu đãi` in every screen, image and report. | Stakeholder, 2026-10-01 |
| D4 | The API pre-fills `Bớt` when a DRAFT is generated or refreshed: the Student's eligible leave days in the calendar month before the run `billingMonth`. Eligible = `LeaveDaySource` `AUTO_APPROVED`/`APPROVED`, no exclusion, operating day of the School calendar (not Sunday, not a holiday). It applies to every receivable with `refundUnitPrice > 0` that is on the month N DRAFT **or** on the Student's issued month N-1 Invoice; a receivable present only on N-1 gets a line with `Thu 0` on the month N DRAFT. Counted days are snapshotted. | Stakeholder, 2026-10-01 |
| D5 | `Bớt` is always shown and editable on DRAFT lines: Finance may overwrite the quantity (integer `>= 0`) and refund unit price with a mandatory reason; audited; the proposed value is kept beside the entered one; a manual value survives refresh; `Dùng lại số đề xuất` resets it. No precondition on the previous month being invoiced or paid. | Stakeholder, 2026-10-01 |
| D6 | Line math (API only): `gross = unitPrice x quantity` (quantity may be `0`); `discount` = promotion on `gross` (unchanged); `deduction = refundUnitPrice x deductionQuantity`; `net = gross - discount - deduction` **may be negative**; `vat = sign(net) x VAT(abs(net))` with the D8 half-up rounding of 2026-09-30; `amount = net + vat`. A line with `quantity = 0` and `deductionQuantity = 0` is not allowed. | Stakeholder, 2026-10-01 |
| D7 | An Invoice total may be negative (School owes the parent) or zero. Promotion still only reduces `gross`, so no promotion makes a line negative by itself. | Stakeholder, 2026-10-01 |
| D8 | A negative issued Invoice is a refund notice (`Phiếu hoàn tiền`): no VietQR; the image says `Trường hoàn lại cho phụ huynh X đ`. Finance closes it by recording a **payout** (`Ghi nhận đã chi`): exact amount `abs(total)`, date, method (`Chuyển khoản`/`Tiền mặt`), bank reference or note. Exact only: no partial payout, no carry from a payout. A zero-total Invoice closes at issue. | Stakeholder, 2026-10-01 |
| D9 | **Settlement Invoice (hóa đơn quyết toán).** For a Student whose `StudentEnrollment` ended in month N-1 (withdrawal/transfer out), the month N run lists them under `Cần quyết toán`; Finance creates one settlement DRAFT per channel needed. It contains no regular charges, only: `Bớt` lines (`Thu 0`) for the D4 leave days **plus the operating days after the enrollment end date in month N-1** (meals not eaten; snapshotted like D4), the D10 prepaid refund line, and pending carries of the same channel. Tuition of the withdrawal month is not refunded (the month counts as used). Finance may add catalog lines as on any DRAFT. Issue, image, Receipt (positive) or payout (negative) follow the normal rules. | Stakeholder, 2026-10-01 |
| D10 | **Prepaid package refund.** A package = the coverage months issued from one source Invoice line (same source Invoice, policy version, receivable). `used` = months whose `serviceStart <= effectiveOn` of the withdrawal (a started month counts whole). `refundNet = max(0, sum(originalPrice - reduction) over all months - sum(originalPrice) over used months - prior refunds net)`; `refundVat = VAT(refundNet)`. It is a negative line `Hoàn học phí nộp trước` (`kind = COVERAGE_REFUND`) on the settlement Invoice of the receivable's channel; Finance may override the amount with a reason, capped by the unrefunded paid amount. Issuing the settlement Invoice posts the `CoverageReversal` records (allocated to unused months, latest first) so ledger and reports stay as today. The standalone `Hoàn ưu đãi nộp trước` flow is removed from the UI; its pro-rata formula (D11 of 2026-09-30) is replaced. | Stakeholder, 2026-10-01 |
| D11 | **Prepaid package across SchoolYears.** Coverage months are consecutive calendar months, including summer (preschools do not close for summer), and may extend past the source SchoolYear end. Run generation of a later SchoolYear honours coverage by Student, receivable and `billingMonth`, whatever the coverage `schoolYearId`. The start month must still be inside the source SchoolYear. | Stakeholder, 2026-10-01 |

### Example (D9, D10)

Minh Anh withdraws on 10/03/2027 (last day 10/03); package Sep 2026 - Aug 2027 as above; 2 excused meal days in March before 10/03; 18 operating days 11/03-31/03 (no holiday); meal refund 40.000/ngày.

```text
HÓA ĐƠN QUYẾT TOÁN THÁNG 04/2027 · Phần 2 · Tài khoản cá nhân
Tiền ăn       Thu 0 ngày    Bớt 20 ngày x 40.000           -800.000
              (2 ngày nghỉ có phép + 18 ngày sau khi nghỉ học)
Hoàn học phí nộp trước · đã học 7/12 tháng
  52.800.000 - 6.900.000 x 7                            -4.500.000
Tổng: Trường hoàn lại cho phụ huynh                      5.300.000 đ
```

(Sep-Mar = 7 started months. In a real case tuition and meals may be in different channels; each channel has its own settlement Invoice.)

## 3. Impact analysis

| Area | Impact |
| --- | --- |
| PRD (final) | Not edited. This proposal records the exceptions: line deduction instead of a separate negative meal line; negative Invoice and payout; settlement Invoice after withdrawal; package refund formula; coverage across SchoolYears. Exact settlement still holds (Receipt or payout equals the total). |
| SPEC | CAP-4/5: line math D6, negative total and payout D7-D8, settlement Invoice D9; replace the coverage refund formula (SPEC line on `floor(paidNet * remainingDays / denominator)`) by D10; coverage bounds D11. Still no generic credit or independent prepayment. |
| Architecture spine | Finance reads `LeaveDaySource` and `StudentEnrollment` end within School/Student scope. Payout is a high-impact mutation (Idempotency-Key, Operation, audit). Browser never sends dates, deduction or refund amounts except an override with reason. |
| Data | `Receivable.refundUnitPrice`. `InvoiceLine`: `refundUnitPriceSnapshot`, `deductionQuantity`, `proposedDeductionQuantity`, `deductionAmount`, `deductionReason`, `deductionSource JSONB`; `kind` adds `COVERAGE_REFUND`; CHECKs relaxed to `quantity >= 0`, `unitPrice >= 0`, signed `netAmount`/`vatAmount`/`amount` with the D6 equations. `Invoice.kind` adds `SETTLEMENT` (one per Student/run/channel); total trigger allows `<= 0`. New `InvoicePayout` (exact, one per Invoice). Coverage period bound relaxed. Existing rows unchanged (`0` deductions). |
| Reports / ledger | Ledger lines carry `deductionAmount`; new event `PAYOUT_POSTED`; report measures `Bớt (hoàn trả nghỉ)` and `Đã chi hoàn`; `FINANCE_LEDGER_V5`; `gross - ưu đãi - bớt + VAT (+ nợ kỳ trước) = netBilled`. |
| Parent | Obligation line adds `deductionQuantity`, `deductionAmount`; a negative Invoice shows `Trường hoàn lại X đ` and no payment instruction. |
| UX / mockups | `receivable-configuration`, `invoice-detail-review`, `invoice-payment-image`, `invoice-generation`, `finance-run-preview`, `receipt-queue` (payout), `finance-report`, `promotion-configuration` (copy, remove standalone refund), `EXPERIENCE.md`, `MOCKUP-COVERAGE.md`. |

### Invariants preserved

1. API owns refund price, proposals, deduction, VAT, package refund and totals.
2. Exact settlement per Invoice: positive -> one exact Receipt; negative -> one exact payout; no partial state.
3. Money never crosses channels: deductions live on their line; package refund goes to the receivable's channel.
4. Issued snapshots are immutable: a leave approved/excluded after issue, or a price change, changes nothing issued. Late leave is entered manually on a later DRAFT.
5. School-scoped everything; leave, enrollment, coverage, Invoice share School and Student.

## 4. Screens

### 4.1 Receivable form

```text
Tên khoản thu                         Mã
Giá / đơn vị (chưa VAT)               Đơn vị
Giá hoàn trả / đơn vị (chưa VAT)      Mức thuế suất
  hint: "Số tiền trả lại cho mỗi ngày nghỉ có phép của tháng trước. Để 0 nếu không hoàn trả."
```

Catalog table adds `Giá hoàn trả` (`40.000 đ/ngày` or `—`).

### 4.2 Invoice review line

```text
Tiền ăn tháng 10/2026                                     686.000 đ
  Thu  22 ngày x 35.000 đ                                  770.000 đ
  Bớt   3 ngày x 28.000 đ · nghỉ có phép 09/2026           -84.000 đ   [Sửa]
        04/09, 15/09, 16/09
```

`Sửa` dialog: `Số ngày bớt`, `Giá hoàn trả / đơn vị`, `Lý do điều chỉnh` (required when different from the proposal), `Dùng lại số đề xuất`. Promotion row reads `Ưu đãi · <policy>`.

### 4.3 Run detail

- Invoice table: columns `Ưu đãi` (was `Giảm trừ`) and `Bớt`; negative totals shown as `Hoàn X đ`.
- Section `Cần quyết toán`: Students whose enrollment ended last month, with `Tạo hóa đơn quyết toán`.

### 4.4 Settlement Invoice and payout

- Review shows badge `Quyết toán` and the D10 line with the breakdown (`đã nộp`, `giá gốc x tháng đã học`, `đã hoàn trước đó`).
- Issued negative Invoice: right panel `Hoàn tiền cho phụ huynh` with `Ghi nhận đã chi` (amount read-only, date, method, reference). The receipt queue gets a filter `Cần chi hoàn`.
- Image: no VietQR; footer `Trường hoàn lại cho phụ huynh X đ`.

## 5. Stories

### Story 5.26: Giá hoàn trả cho khoản thu
1. **Given** create/edit **Then** the API stores integer `refundUnitPrice >= 0` (no upper cap), audited; catalog shows it; existing rows `0`.

### Story 5.27: Bớt theo ngày nghỉ có phép
1. **Given** generation/refresh of month N **Then** D4 pre-fills `Bớt` with snapshotted days, adding `Thu 0` lines for receivables only on N-1.
2. **Given** an excluded, non-operating or other-Student/School leave day **Then** it is not counted.
3. **Given** a Finance override with reason **Then** D6 recalculation, audit, kept on refresh; negative line allowed.
4. **And** tests: tenant isolation, idempotent retry, negative VAT rounding, snapshot immutability.

### Story 5.28: Hóa đơn âm và ghi nhận đã chi
1. **Given** a DRAFT with total `< 0` **Then** issue succeeds without VietQR; `= 0` closes at issue.
2. **Given** an issued negative Invoice **When** Finance records a payout **Then** amount must equal `abs(total)`, Invoice closes, ledger `PAYOUT_POSTED`; retry replays the Operation.

### Story 5.29: Hóa đơn quyết toán và hoàn gói nộp trước
1. **Given** enrollment ended in N-1 **Then** the month N run lists the Student under `Cần quyết toán`; creation builds per-channel settlement DRAFTs per D9.
2. **Given** an issued prepaid package **Then** the settlement DRAFT has the D10 line; example of §1 gives `11.400.000` for 6 used months.
3. **Given** settlement issue **Then** `CoverageReversal` records are posted within the unrefunded limit; standalone refund UI removed.

### Story 5.30: Gói nộp trước sang năm học sau
1. **Given** a package starting in the SchoolYear and ending after it **Then** coverage is issued for all months and later-year runs skip the covered receivable months.

### Story 5.31: Hiển thị Bớt, hoàn tiền và đổi tên Ưu đãi
1. Invoice review, run tables, payment image, Parent, receipt queue and report follow D3/§4; report `FINANCE_LEDGER_V5`.

## 6. Artifact updates after approval

1. This proposal `status: approved`.
2. `SPEC.md`, `ARCHITECTURE-SPINE.md`, `epics-passionedu.md` (Stories 5.26-5.31; Story 4.5 note), `EXPERIENCE.md`, mockups of §3, `MOCKUP-COVERAGE.md`, `test:mockups` contracts.
3. `sprint-status.yaml`: Stories 5.26-5.31 `backlog`.

## 7. Out of scope

- Separate refund unit, "Loại khoản thu", e-invoice from the Kidsonline form.
- Automatic re-application of leave approved/excluded after the month N Invoice is issued (manual on a later DRAFT).
- Partial payout, payout across channels, generic Student credit.
- Refund of a prepaid package for reasons other than enrollment end (e.g. service cancellation) — keeps `CoverageRefundEligibility` reasons; handled on the next DRAFT/settlement Invoice the same way.

## 8. Resolved (2026-10-01)

1. `refundUnitPrice` has no upper cap; lines and Invoices may be negative (final settlement after withdrawal).
2. Promotion discount is evaluated on `gross` (`Thu`), before `Bớt`.
3. Sundays and School calendar holidays are not counted as leave days.
4. Withdrawal: the settlement Invoice is created in the next month's run; a negative total is issued and closed by a recorded payout.
5. Package refund counts a started month as fully used and lives on the settlement Invoice (replacing the standalone refund flow).
6. D11: a package covers consecutive calendar months including summer.
7. D9: withdrawal mid-month refunds no tuition, only meals not eaten (leave days and operating days after the end date). School-specific tuition reductions (e.g. two consecutive weeks of absence in a month) are entered manually by Finance as `Bớt` on the tuition line with a reason (D5); no automatic rule.

---
name: CollectionRun detail phase 2 - Invoice review destination, run overview and lifecycle progress
status: approved
date: 2026-09-29
trigger: After Story 5.18 and the layout remediation in commit `1bd166a`, stakeholder review still finds the CollectionRun detail hard to work in. Invoice review renders at the bottom of a long run page instead of as the per-Student destination the UX spine requires, the run has no at-a-glance overview, and lifecycle progress is only visible in the heading text.
mode: batch
---

# Sprint Change Proposal - CollectionRun detail phase 2

## 1. Issue summary

Phase 1 (commit `1bd166a fix(finance): tidy collection run detail layout`) fixed the visual defects: the run detail now has a contextual header, one card per concern, content-width actions, structured tables and real modal confirmations. The remaining problems are structural, not stylistic:

1. **Invoice review is inline, not a destination.** `EXPERIENCE.md` says "Review/issue Invoice là deep destination theo Student", and the approved mockup `mockups/admin/invoice-detail-review.html` shows a dedicated screen with a two-column layout and a separate issue panel. Today, `Rà soát hóa đơn` appends the review card below the generation result, Invoice table and Student addition cards. Finance has to scroll about 1,000px to reach it, cannot bookmark or reload an Invoice, and the Back action returns to the run list rather than to the run.
2. **No run overview.** Finance cannot see at a glance how many Students are eligible or skipped, how many Invoices are issued, or the expected total. The approved mockup `mockups/admin/finance-run-preview.html` already defines a tinted summary row (`Hóa đơn dự kiến`, `Có chênh lệch tháng trước`, `Cần thu dự kiến`), but the implementation has none. `READY` runs show only one card with one button.
3. **Lifecycle progress is implicit.** The server lifecycle `DRAFT -> READY -> GENERATED -> CLOSED` is only visible as the heading suffix (`· Nháp`). Finance cannot tell which step comes next or what the run has already passed.
4. **Duplicated and permanently expanded GENERATED content.** `Kết quả tạo hóa đơn từ máy chủ` repeats the Students already listed in `Hóa đơn trong đợt`, and `Thêm học sinh vào đợt đã tạo` always takes a full card even though the action is rare.

This is a daily-work UX issue. It does not change CollectionRun lifecycle, eligibility, Finance authority, VND calculation, preview fingerprint, idempotency, Operation reconciliation or snapshot contracts.

## 2. Impact analysis

| Area | Impact |
| --- | --- |
| Epic 5 | Add two UX follow-up stories after Story 5.18; completed history remains unchanged. |
| UX spine | `EXPERIENCE.md` already requires the per-Student Invoice destination and adjacent `Học sinh trước`/`Học sinh tiếp theo`. Add: the Invoice destination route and its Back target, the run overview metrics, and a lifecycle step indicator for CollectionRun detail. |
| Mockups | Reuse `invoice-detail-review.html` for the Invoice route (add `Quay lại đợt thu` and secondary cards for payment instruction, debt transfer and prepaid coverage). Update `invoice-generation.html` detail state with the step indicator, metrics row, GENERATED result notice and `Thêm học sinh` dialog. |
| API | Additive read-only DTO fields: server-computed run/preview summary (counts and BIGINT totals) so the browser never sums money. No new mutation, schema change for business data, authorization or lifecycle change. |
| Admin UI | New route `/schools/:schoolSlug/collection-runs/:runId/invoices/:invoiceId`; `FinanceWorkspace` run detail gains overview/stepper components. Invoice review JSX moves out of the run page into its own view with the existing review, issue, revision, coverage and reversal logic. |
| Tests | Component and E2E proof for the Invoice route (open, reload, adjacent navigation, Back to run), the summary values coming from the server DTO, and the step indicator for every lifecycle state. |

### Invariants preserved

1. `School` authorization is API-owned; the Invoice route re-fetches the Invoice under the School and run, and a denied or foreign ID returns to the run with a server message. URL IDs are never authorization proof.
2. Lifecycle remains `DRAFT -> READY -> GENERATED -> CLOSED`; the step indicator only renders the server status and offers no navigation or transition.
3. Money shown in the overview comes from server BIGINT sums serialized as JSON-safe integer strings; the browser does not add line or Invoice amounts.
4. Preview fingerprint, template snapshot, generation idempotency, Operation reconciliation and issue confirmation (named Student, active BankAccount) are unchanged.
5. Adjacent navigation keeps the server-authorized run order; after save or issue the UI shows the result and the user explicitly picks the next Student (no auto-advance), as `EXPERIENCE.md` already requires.

## 3. Recommended approach

**Selected approach: direct UX/backlog adjustment in two stories.** Follow the approved mockups; ask for approval only where this proposal extends them (route, metrics for all states, step indicator, GENERATED notice and dialog).

### 3.1 Invoice review destination (Story 5.19)

```text
Route `/schools/:schoolSlug/collection-runs/:runId/invoices/:invoiceId`:
  Eyebrow: "ĐỢT THU THÁNG 10/2026 · BÉ MINH ANH · MẦM 4A"
  H1 "Rà soát hóa đơn" + status badge; actions: Quay lại đợt thu · Học sinh trước · Học sinh tiếp theo
  Two columns (desktop), stacked (mobile):
    Left  - "Chi tiết hóa đơn": server lines (gross, policy/version, discount, net), total, add/edit line form for DRAFT
    Right - "Rà soát trước khi phát hành": BankAccount, Phát hành / Chuẩn bị bản điều chỉnh, operation feedback
  Below - secondary cards only when present: payment instruction snapshot, debt transfers, prepaid coverage, coverage reversal
```

- The run Invoice table and generation notice link to this route; `Quay lại đợt thu` returns to `/collection-runs/:runId` with list search preserved.
- Adjacent order comes from the run detail the server returned; if the route is opened directly, the order is loaded from the server run before previous/next buttons appear.
- A dirty line form or pending Operation keeps the existing leave guard.

### 3.2 Run overview and lifecycle progress (Story 5.20)

```text
CollectionRun detail header
  Step indicator: Nháp → Sẵn sàng tạo hóa đơn → Đã tạo hóa đơn → Đã đóng (aria-current="step" on server status)
  Metrics row (server DTO):
    DRAFT with preview / READY: Học sinh đủ điều kiện · Học sinh bị bỏ qua · Cần thu dự kiến
    GENERATED / CLOSED:        Hóa đơn · Đã phát hành · Tổng phải thu
READY: read-only locked template table + metrics + primary "Tạo hóa đơn nháp"
GENERATED: result notice ("Đã tạo N hóa đơn nháp; bỏ qua M học sinh" + expandable skip reasons) above
           "Hóa đơn trong đợt"; toolbar button "Thêm học sinh" opens a dialog with eligible candidates
```

- API adds `summary` to `GET /finance/collection-runs/:runId` and to preview: `{ eligibleCount, skippedCount, expectedTotal }` for DRAFT/READY and `{ invoiceCount, issuedCount, invoiceTotal }` for GENERATED/CLOSED. Totals are PostgreSQL `BIGINT` sums scoped by School and run.
- Before any preview exists, DRAFT metrics show `Chưa xem trước` instead of numbers.

**Effort:** Medium (5.19 mostly moves existing logic to a route; 5.20 adds a small read-only API field and presentational components). **Risk:** Low-medium. The main risks are losing adjacent-order or leave-guard behavior when moving the review to a route, and computing totals in the browser. Mitigations are reusing the current review state and handlers, a server summary DTO with contract tests, and E2E coverage for reload and Back.

## 4. Detailed change proposals

### 4.1 UX spine (`EXPERIENCE.md`)

- CollectionRun list and detail row: add the step indicator and the server summary metrics per state; GENERATED shows a result notice instead of a second Student table, and Student addition is a dialog.
- Invoice review and issue row: add the route `/collection-runs/:runId/invoices/:invoiceId`, reload/bookmark behavior with server re-authorization, and `Quay lại đợt thu` as the Back target.

### 4.2 Mockups

- `mockups/admin/invoice-generation.html`: detail state with step indicator, metrics row, READY locked template, GENERATED notice, `Thêm học sinh` dialog.
- `mockups/admin/invoice-detail-review.html`: add `Quay lại đợt thu`, secondary cards (payment instruction snapshot, debt transfer, prepaid coverage) and the ISSUED read-only state.

### 4.3 Backlog stories

Story `5-19-route-ra-soat-hoa-don-theo-hoc-sinh`:

1. Given Finance chooses `Rà soát hóa đơn` from a run, when the route loads, then only the Invoice destination renders (no run tables) with the mockup two-column layout and `Quay lại đợt thu`.
2. Given the Invoice URL is reloaded or opened directly, when the server authorizes the School, run and Invoice, then the same Invoice and its server-ordered adjacent actions render; otherwise the UI returns to the run with the server message.
3. Given Finance issues, prepares a revision, edits a line or applies coverage, when the server responds or an Operation is uncertain, then existing lifecycle, confirmation, idempotency and reconciliation behavior is unchanged and the UI does not auto-advance.

Story `5-20-tong-quan-va-tien-trinh-dot-thu`:

1. Given a run in any lifecycle state, when detail loads, then a step indicator marks the server status with `aria-current="step"` and offers no transitions.
2. Given a preview or generated run, when detail loads, then summary counts and VND totals come only from the server `summary` DTO; the browser does not sum line or Invoice amounts.
3. Given a READY run, when detail loads, then the locked template and summary are visible with `Tạo hóa đơn nháp` as the single primary action.
4. Given a GENERATED run, when generation completes, then a result notice replaces the duplicate Student table and `Thêm học sinh` opens a dialog listing server-eligible candidates.

Update `sprint-status.yaml` after approval: add both story keys as `ready-for-dev`, and move `5-18-detail-dot-thu-va-viet-hoa-copy-finance` to `done` (implemented in commits `30260a0` and `1bd166a`).

## 5. Implementation handoff

**Scope classification:** Moderate.

| Recipient | Responsibility |
| --- | --- |
| Product/UX | Approve this proposal; update `EXPERIENCE.md` and the two mockups before implementation. |
| Product/Developer | Add Stories 5.19 and 5.20 and tracker entries; close Story 5.18. |
| Developer (API) | Add the read-only `summary` DTO with School/run-scoped BIGINT sums and contract tests. |
| Developer (Admin) | Implement the Invoice route and run overview per mockups, reusing existing review/issue handlers. |
| QA/Developer | Component and E2E proof for route reload/Back/adjacent order, server-only totals and the step indicator. |

### Success criteria

1. Finance reviews and issues Invoices on a dedicated per-Student screen that survives reload and returns to the originating run.
2. Every run state shows lifecycle progress and a server-computed overview; READY is never an empty page.
3. GENERATED runs show each Student once; the rare Student addition does not take permanent space.
4. Finance authority, lifecycle, VND, preview/generation, snapshots and Operation safeguards remain unchanged.

## 6. Checklist status

| Checklist item | Status | Evidence |
| --- | --- | --- |
| 1.1-1.3 Trigger/context/evidence | [x] Done | Stakeholder review after phase 1; screenshots of the run detail at DRAFT, READY, GENERATED and inline Invoice review (2026-09-29). |
| 2.1-2.5 Epic impact | [x] Done | Epic 5 UX follow-up stories only; no other epic invalidated. |
| 3.1 PRD | [x] Done | No domain requirement change. |
| 3.2 Architecture | [x] Done | Additive read-only API DTO; no authority, schema or lifecycle change. |
| 3.3 UX/mockups | [x] Done | `EXPERIENCE.md`, `invoice-generation.html` and `invoice-detail-review.html` require updates listed in section 4. |
| 3.4 Secondary artifacts | [x] Done | API contract tests, Admin component tests, E2E and tracker require updates. |
| 4.1 Direct adjustment | [x] Viable | Medium effort, low-medium risk. |
| 4.2 Rollback | [x] Not viable | Phase 1 and Story 5.18 remain valid foundations. |
| 4.3 MVP review | [N/A] | No scope reduction. |
| 4.4 Selected path | [x] Done | Direct UX/backlog adjustment in two stories. |
| 5.1-5.5 Proposal/handoff | [x] Done | Sections 1-5. |
| 6.1-6.2 Review | [x] Done | Finance invariants preserved. |
| 6.3 Approval | [x] Done | Approved 2026-09-29. |
| 6.4 Tracker | [x] Done | Stories 5.19/5.20 added as `ready-for-dev`; Story 5.18 moved to `done`. |

## 7. Approval

Approved by the product owner on 2026-09-29. Approval covers the Invoice review route, run overview metrics with the additive read-only `summary` DTO, the lifecycle step indicator, the GENERATED result notice and Student addition dialog, and the related UX spine, mockup, backlog and tracker updates. Finance authority, lifecycle, VND, preview/generation, snapshots and Operations remain unchanged.

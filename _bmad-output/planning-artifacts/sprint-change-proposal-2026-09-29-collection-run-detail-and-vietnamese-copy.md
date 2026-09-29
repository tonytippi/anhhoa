---
name: CollectionRun detail mode and Vietnamese Finance copy
status: approved
date: 2026-09-29
trigger: Stakeholder review found that opened CollectionRun detail renders below the long run list, making the workspace feel like two stacked screens. The same view exposes raw lifecycle, eligibility and accounting implementation terms in English alongside Vietnamese operating copy.
mode: batch
---

# Sprint Change Proposal - CollectionRun detail mode and Vietnamese Finance copy

## 1. Issue summary

`Đợt thu` is table-first on landing, but after Finance opens a run, the list remains above a long detail composed of template, preview, generation, Invoice and result sections. This forces repeated scrolling past an inactive list and obscures the active task. Copy on the same surface mixes product Vietnamese with raw terms such as `DRAFT`, `READY`, `GENERATED`, `CLOSED`, `ENROLLED`, `ACTIVE`, `Preview`, `Gross`, `Net`, `Invoice`, `Lineage` and `coverage`.

This is a daily-work UX issue. It does not change CollectionRun lifecycle, eligibility, authorization, Finance money, server preview/fingerprint, idempotency, Operation reconciliation or snapshot contracts.

## 2. Impact analysis

| Area | Impact |
| --- | --- |
| Epic 5 | Add a UX remediation follow-up after Story 5.17. Completed history remains unchanged. |
| UX spine | CollectionRun detail needs a selected-record mode: list landing is replaced by contextual detail, with explicit return to the preserved list. Voice/tone already forbids implementation detail by default and needs concrete Finance translations. |
| Mockup | `mockups/admin/invoice-generation.html` currently renders list and detail together and includes English lifecycle/eligibility/currency labels. It must show mutually exclusive list/detail states. |
| Admin UI | `FinanceWorkspace` needs a detail-mode boundary around list toolbar/table/pagination and a `Quay lại danh sách đợt thu` action that clears selected run/detail-only state without dropping list filter/cursor data. |
| Browser/API | No new endpoint, DTO, schema, authorization or mutation behavior. Existing `openRun`, `chooseRun`, preview, READY, generation and reconciliation logic remain authoritative. |
| Tests | Component and E2E need proof that list is absent in detail mode, return restores the run list/filter context, and user-visible text is Vietnamese. |

### Invariants preserved

1. `School` authorization is API-owned; selected run/list state is never authorization proof.
2. Lifecycle remains `DRAFT -> READY -> GENERATED -> CLOSED`; only visible labels change.
3. Roster eligibility remains server-derived at the billing-month boundary; UI does not translate this into browser logic.
4. VND values, preview fingerprints, template snapshots, idempotency and Operation reconciliation remain unchanged.
5. Invoice review deep mode and parent/receipt/payroll surfaces are out of scope.

## 3. Recommended approach

**Selected approach: Direct UX/backlog adjustment with dedicated detail route.** Keep `Đợt thu` list table-first at `/schools/:schoolSlug/collection-runs`. Opening a row routes to `/schools/:schoolSlug/collection-runs/:runId`; detail owns the full CollectionRun workspace and its growing data. Back returns to the URL-backed list context. Translate user-facing Finance labels through a small local display map or direct Vietnamese labels; retain technical state codes only in protected audit/detail diagnostics when necessary.

**Effort:** Medium. **Risk:** Low-medium. Main risks are clearing list context on Back and accidentally changing lifecycle behavior while renaming labels. Mitigations are no API changes, explicit state-display mapping and focused list/detail tests.

## 4. Detailed change proposals

### 4.1 UX and mockup

**Old:** List table remains visible above a selected run detail; raw English appears in headings, table columns and explanatory copy.

**New:**

```text
List route `/schools/:schoolSlug/collection-runs`:
  Đợt thu heading + filter/table/create action.

Detail route `/schools/:schoolSlug/collection-runs/:runId`:
  Quay lại danh sách đợt thu + "Đợt thu tháng 09/2026 · Nháp"
  + contextual template/preview/generation/Invoice tables.
```

Use visible labels: `Nháp`, `Sẵn sàng tạo hóa đơn`, `Đã tạo hóa đơn`, `Đã đóng`; `Xem trước`, `Tổng trước giảm`, `Giảm trừ`, `Tổng phải thu`; `Đang theo học`, `Lớp đang hoạt động`; `Hóa đơn`, `Dòng hóa đơn`, `Liên kết điều chỉnh`, `Bảo lưu ưu đãi trả trước` where applicable. Existing server codes stay internal.

### 4.2 Backlog story

Add Story `5-18-detail-dot-thu-va-viet-hoa-copy-finance` under Epic 5:

1. Given Finance opens `Đợt thu` with no selected run, when the route loads, then only the table-first list, its filter and create dialog are visible.
2. Given Finance opens a run, when its route detail loads, then the list/table/filter are absent and a contextual header has a Back action that restores the URL-backed list context.
3. Given CollectionRun/Invoice/preview/generation states render, when displayed to Finance, then user-facing labels are Vietnamese and do not expose raw lifecycle, eligibility or accounting implementation names by default.
4. Given Finance takes a preview/generate/issue action, when state changes or an Operation is uncertain, then existing API-authoritative lifecycle, errors and reconciliation behavior remain unchanged.

Update `sprint-status.yaml`: set `epic-5: in-progress` and add the Story 5.18 key as `ready-for-dev` after approval.

## 5. Implementation handoff

**Scope classification:** Moderate.

| Recipient | Responsibility |
| --- | --- |
| Product/UX | Approve and update UX spine/mockup to final list/detail interaction and vocabulary. |
| Product/Developer | Add Story 5.18 and tracker entry; do not edit historical completed Story 5.17. |
| Developer | Implement Admin detail mode/copy mapping; preserve API contracts and list context. |
| QA/Developer | Add component/E2E proof for list/detail transition, Back restoration and Vietnamese copy. |

### Success criteria

1. Finance never sees an inactive run list stacked above a long selected-run workspace.
2. Opening, reloading, bookmarking and returning from a run use explicit, authorized routes and retain list context.
3. Default Finance operating copy is Vietnamese-first without raw implementation labels.
4. Finance authority and all lifecycle/money/Operation safeguards remain unchanged.

## 6. Checklist status

| Checklist item | Status | Evidence |
| --- | --- | --- |
| 1.1-1.3 Trigger/context/evidence | [x] Done | Stakeholder screenshot and review of stacked list/detail plus mixed English copy. |
| 2.1-2.5 Epic impact | [x] Done | Epic 5 UX remediation story only; no other epic invalidated. |
| 3.1 PRD | [x] Done | No domain requirement change; UX delivery clarification only. |
| 3.2 Architecture | [x] Done | No API/schema/authority contract change. |
| 3.3 UX/mockups | [x] Done | Experience spine and CollectionRun mockup require update. |
| 3.4 Secondary artifacts | [x] Done | Admin tests, E2E and tracker require update. |
| 4.1 Direct adjustment | [x] Viable | Medium effort, low-medium risk. |
| 4.2 Rollback | [x] Not viable | Finance implementation and server workflow remain valid. |
| 4.3 MVP review | [N/A] | No scope reduction. |
| 4.4 Selected path | [x] Done | Direct UX/backlog adjustment. |
| 5.1-5.5 Proposal/handoff | [x] Done | Sections 1-5 define implementation path. |
| 6.1-6.2 Review | [x] Done | Finance invariants preserved. |
| 6.3 Approval | [!] Action-needed | Approval required before canonical UX/mockup/backlog or code changes. |
| 6.4 Tracker | [!] Action-needed | Apply after approval. |

## 7. Approval

Approved by Tony on 2026-09-29. The selected run is a dedicated, authorized detail route rather than an inline mode. This approval is limited to Admin Finance routing, UX/mockups, Vietnamese default copy, backlog and verification; API authority, lifecycle, VND, preview/generation, snapshots and Operations remain unchanged.

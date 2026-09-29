---
title: 'Detail Đợt thu và Việt hóa copy Finance'
type: 'feature'
created: '2026-09-29'
status: 'done'
baseline_commit: '1f9a93ac08e9dbc01efc5dc876bdbc2df2f4b7e6'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-29-collection-run-detail-and-vietnamese-copy.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Mở một Đợt thu hiện render detail dài bên dưới list, khiến Kế toán phải cuộn qua list không còn tác dụng. Cùng surface hiển thị lẫn thuật ngữ tiếng Anh/raw server code với tiếng Việt.

**Approach:** Đưa CollectionRun vào route detail riêng `/schools/:schoolSlug/collection-runs/:runId`; list table-first tồn tại ở `/schools/:schoolSlug/collection-runs`. Detail chỉ render workspace của run và Back về list URL-backed. Đổi toàn bộ copy Finance nhìn thấy mặc định trong flow này sang tiếng Việt nghiệp vụ.

## Boundaries & Constraints

**Always:** API reauthorizes `FINANCE_MANAGE` và School cho list/detail/mutation; slug/run ID/URL chỉ là selector. Giữ lifecycle, VND `BIGINT`, server preview/fingerprint, template snapshot, idempotency, audit, Operation reconciliation, Invoice queue safety và existing close/generation behavior. Back giữ list filter/cursor context qua URL/navigation state; reload/bookmark detail phải fetch authorized run mới.

**Ask First:** Thay đổi API DTO/endpoint, CollectionRun lifecycle, query pagination contract, Invoice route semantics hoặc bảo tồn filter bằng browser storage ngoài URL/state navigation.

**Never:** Không render list/filter phía trên detail; không browser-suy diễn eligibility/lifecycle; không hiển thị mặc định raw `DRAFT`, `READY`, `GENERATED`, `CLOSED`, `ENROLLED`, `ACTIVE`, `Preview`, `Gross`, `Net`, `Invoice`, `Lineage`, `coverage` hoặc internal IDs. Không đổi Parent, Receipt, Payroll hoặc Finance server authority.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| List landing | `/collection-runs` authorized | Table/filter/create dialog only; row action opens detail route | Loading/error retain list context |
| Detail direct/reload | Authorized `:runId` route | Server-authorized run detail only; no list DOM; Back returns list | Denied/not found clears detail and returns safe list error |
| Detail mutation | Template/preview/ready/generate/close | Current run refreshes from API; current route remains | Timeout keeps/reconciles Operation, no guessed state |
| Display copy | Lifecycle/preview/Invoice facts render | Vietnamese business labels and status text | Server codes remain internal only |

</frozen-after-approval>

## Code Map

- `apps/web/src/school-context.tsx` -- Extend Finance page route parser/model to distinguish `/collection-runs` from `:runId`; authorize School before mounting Finance detail; keep Home/leave guard.
- `apps/web/src/finance/finance-workspace.tsx` -- Split list and run-detail rendering, accept route-selected run ID/callbacks, load authorized detail by ID, route Back to list and replace display strings through a narrow Vietnamese map.
- `apps/web/src/finance/finance-workspace.test.tsx` -- Preserve Finance command regressions while proving no list in detail, Back/list context and no raw user-visible terms.
- `apps/web/e2e/finance-release-gate.spec.ts` -- Prove row navigation/detail reload or Back behaviour and Vietnamese list/detail labels once Finance E2E adapter blocker is resolved.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html` -- Canonical list/detail states are mutually exclusive and Vietnamese-first.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/src/school-context.tsx`, `apps/web/src/finance/finance-workspace.tsx` -- add authorized CollectionRun detail route, list Back route/context, and mutually exclusive list/detail render modes.
- [ ] `apps/web/src/finance/finance-workspace.tsx` -- replace default visible Finance lifecycle/eligibility/accounting English copy in CollectionRun detail with Vietnamese business labels without changing server values.
- [ ] `apps/web/src/school-context.test.tsx`, `apps/web/src/finance/finance-workspace.test.tsx` -- test route direct/reload/denial, list absence/detail Back and Vietnamese display mapping.
- [ ] `apps/web/e2e/finance-release-gate.spec.ts` -- update browser proof to detail route/list return and Vietnamese copy; run when Prisma E2E Invoice Issue blocker is resolved.

**Acceptance Criteria:**
- Given Finance opens `Đợt thu` at list route, when no run ID is selected, then only the table-first list, list filter and create dialog are visible.
- Given Finance selects `Mở chi tiết`, when authorized detail route loads, then run detail has no list/filter above it and Back returns the list context.
- Given an authorized CollectionRun detail URL reloads or is bookmarked, when API permits the run, then its current server detail loads; denied/not-found data is never retained.
- Given CollectionRun and Invoice information renders, when Finance views normal operating copy, then statuses, eligibility, preview, totals and adjustment context use Vietnamese labels without raw implementation terms.
- Given existing CollectionRun actions run, when mutation/lifecycle/timeout occurs, then API-authoritative result, reconciliation and safety behavior are unchanged.

## Verification

**Commands:**
- `pnpm --filter @passionedu/admin-web test -- src/school-context.test.tsx src/finance/finance-workspace.test.tsx` -- expected: route/detail/copy component coverage passes.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: Admin TypeScript passes.
- `pnpm test:e2e -- finance-release-gate.spec.ts` -- expected: list/detail route and Vietnamese copy browser proof passes after Prisma adapter blocker is resolved.
- `git diff --check` -- expected: no whitespace errors.

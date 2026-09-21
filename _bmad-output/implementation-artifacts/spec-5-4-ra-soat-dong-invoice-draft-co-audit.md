---
title: 'Story 5.4: Rà soát dòng Invoice DRAFT có audit'
type: 'feature'
created: '2026-09-21'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: '0828a9d9b34abf4077ebe76f4acfcacaeb4767ee'
baseline_commit: '0828a9d9b34abf4077ebe76f4acfcacaeb4767ee'
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-21-manual-invoice-mvp.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-detail-review.html'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Invoice được tạo ở Story 5.3 là DRAFT rỗng; Finance chưa thể rà soát các khoản thu, giữ rationale hoặc đối soát số tiền server tính trước khi phát hành.

**Approach:** Bổ sung InvoiceLine School-scoped, Invoice detail và mutation add/edit/remove idempotent có audit. Admin mở Invoice như một deep destination từ CollectionRun, chỉ render composition và total do server trả.

## Boundaries & Constraints

**Always:** `FINANCE_MANAGE`, School scope, origin + double-submit CSRF, UUID `Idempotency-Key`/`X-Operation-Id`, Operation reconciliation và reauthorization trong transaction bắt buộc. Chỉ Invoice `DRAFT` được đổi line. Receivable phải active cùng School; quantity và unit price là integer VND dương JSON-safe; server tính amount/total. Override giá và bất kỳ explanatory source nào đều cần reason/audit; source snapshot phải validate StudentEnrollment và business date, giữ actor/time/provenance, và không tác động tính tiền.

**Block If:** Canonical Finance MVP thay đổi manual positive line, source explanatory-only hoặc DRAFT mutation boundary trong lúc thực hiện.

**Never:** Không thêm ChargeRule, automatic pricing/selection, quantity 0, attendance/service dependency, settlement/receipt/promotion, Issue/BankAccount snapshot, Parent/Teacher route hay client-set amount/total/status/outstanding.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Thêm line mặc định | Invoice DRAFT, Receivable active same-School, quantity dương | Snapshot catalog, server tính amount/total, audit và Operation outcome | Không lỗi |
| Override/source thủ công | Giá override và/hoặc source hợp lệ có reason | Persist snapshot reason/actor/time/provenance; source không đổi math | Reject source graph/date, giá/quantity hoặc reason không hợp lệ |
| Sửa/xóa line | Line cùng Invoice DRAFT | Recalculate total authoritative; audit old/new; xóa nghĩa là không áp dụng khoản | Không có quantity 0 |
| Retry/cạnh tranh | Cùng mutation replay hoặc command đồng thời | Same key replay outcome, changed fingerprint conflict, tổng/line nhất quán | Không duplicate write/audit/outcome |
| Tenant/lifecycle sai | Foreign/inactive Receivable, foreign Invoice/line, revoked actor hoặc non-DRAFT | Không lộ dữ liệu/không ghi; UI reload server state | State/capability/not-found phù hợp |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` và migration Finance mới -- Invoice chưa có line/total/source relation; thêm composite tenant graph, BIGINT snapshots và Prisma models.
- `apps/api/src/modules/finance/finance.service.ts` -- tái dùng `actor`, `mutate`, `audit`, scoped validation và Operation replay; thêm Invoice detail, line DTO/calculation và DRAFT commands.
- `apps/api/src/modules/finance/finance.controller.ts` -- tái dùng `mutation` cookie guard để expose Invoice detail và line commands.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, `src/integration/finance.integration.test.ts` -- mở rộng validation, HTTP guard, PostgreSQL tenant/math/audit/idempotency/concurrency proof từ fixture Story 5.3.
- `apps/web/src/finance/finance-workspace.tsx` -- tái dùng `get`, `command`, pending Operation reconciliation, active-School request token và error summary; thêm Invoice deep review/editor.
- `apps/web/src/finance/finance-workspace.test.tsx` -- chứng minh server-only values, form/accessibility, uncertain mutation và stale-school guards.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma`, migration Finance mới -- persist `InvoiceLine`, immutable receivable/source snapshots, positive DB guards và School composite relations -- DB chặn tenant/math corruption.
- `apps/api/src/modules/finance/finance.service.ts`, `finance.controller.ts` -- add scoped detail and add/edit/remove DRAFT line commands using shared mutation/audit/Operation patterns -- API remains authoritative.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, `apps/api/src/integration/finance.integration.test.ts` -- cover matrix, DB guards, audit, retry/race and no client money/status injection -- verify real PostgreSQL behavior.
- `apps/web/src/finance/finance-workspace.tsx`, `finance-workspace.test.tsx` -- navigate from server Invoice ID and build accessible DRAFT line editor/reconciliation -- browser never calculates or retains stale Finance data.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- mark 5.4 done only after implementation, review and all verification pass.

**Acceptance Criteria:**
- Given a DRAFT Invoice in the selected School, when Finance adds, edits or removes a line, then only active same-School Receivables with positive whole quantity/price are accepted and the returned amount/total is server-authoritative.
- Given a price override or explanatory manual source, when saved with required reason, then its snapshot/audit/provenance is retained without deriving a fee, discount, quantity or total from operational input.
- Given a non-DRAFT Invoice, context mismatch, revoke, retry or concurrent command, when a line mutation is attempted, then it cannot write/leak data and reconciles one durable Operation outcome.
- Given an Admin reviews an Invoice, when server data loads, then the contextual detail renders VND/right-aligned totals, textual state and source/audit facts with accessible errors and no stale School response.

## Design Notes

InvoiceLine snapshots the selected Receivable fields and effective unit price so later catalog lifecycle/configuration changes cannot rewrite financial history. Invoice total is derived from persisted lines in the command transaction and returned as a JSON-safe VND string; it is not a mutable client field. The UI uses the current one-workspace state instead of introducing a sidebar destination, but treats Invoice review as a contextual deep view entered through a server-returned Invoice ID.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test` -- expected: API Finance unit/controller tests pass.
- `set -a && source .env && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm test:integration` -- expected: run from `apps/api`; deployed migrations and PostgreSQL Finance tests pass.
- `pnpm --filter @passionedu/admin-web test` -- expected: Finance workspace tests pass.
- `pnpm typecheck && pnpm test` -- expected: workspace checks pass.
- `git diff --check` -- expected: no whitespace errors.

## Review Triage Log

### 2026-09-21 - Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 16 (high 4, medium 10, low 2)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high] [patch]` Database now protects Invoice total authority, line aggregate identity and bidirectional source-audit facts.
  - `[high] [patch]` DRAFT line edits preserve explicit price overrides, reject VND overflow and validate calendar/date/time/source-fact consistency.
  - `[high] [patch]` Operation reconciliation now applies authoritative Invoice outcomes without leaving detail or CollectionRun summaries stale.
  - `[medium] [patch]` Invoice review is read-only outside DRAFT, renders Finance source audit/provenance, formats right-aligned VND and confirms deletion with focus management.
  - `[medium] [patch]` Added controller, Admin UI and PostgreSQL proof for field errors, stale responses, reconciliation, lifecycle/inactive catalog, revoke, idempotency, audit and database guards.

## Auto Run Result

Status: done

Summary: Story 5.4 delivers School-scoped Invoice DRAFT line review. Finance can open an Invoice from a CollectionRun, add/edit/remove manual positive receivable lines and explanatory snapshots, then reconcile a durable server-authoritative result. The API owns authorization, VND calculation, lifecycle, source validation, audit and Operations; the Admin portal only renders server-returned state.

Files changed:
- `apps/api/prisma/schema.prisma` and migrations `20260921000009` through `20260921000011` -- InvoiceLine graph, totals, source snapshots and corrective database authority/immutability guards.
- `apps/api/src/modules/finance/finance.service.ts`, `finance.controller.ts` -- Invoice detail and idempotent DRAFT-line commands with scoped authorization, validation, audit and reconciliation outcomes.
- `apps/api/src/modules/finance/finance.controller.test.ts`, `apps/api/src/integration/finance.integration.test.ts` -- HTTP guard and PostgreSQL proof for math, audit, retry, concurrency, source, revoke, catalog lifecycle and tenant boundaries.
- `apps/web/src/finance/finance-workspace.tsx`, `finance-workspace.test.tsx` -- contextual Invoice review/editor, source display, read-only lifecycle, accessible removal confirmation, stale-response protection and Operation reconciliation.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- marks Story 5.4 done.

Review findings: 16 patches applied (high 4, medium 10, low 2); 0 deferred; 0 rejected. Follow-up review recommendation: true; patched score is 32 (`3 * 10 + 2`).

Verification performed:
- `pnpm typecheck && pnpm test` -- pass; API 82 tests and Admin web 69 tests.
- `set -a && source .env && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm test:integration` from `apps/api` -- pass; 8 PostgreSQL integration files / 80 tests, 38 migrations deployed.
- `git diff --check` -- pass.

Residual risks: `InvoiceStatus` currently contains only `DRAFT`, so a runtime non-DRAFT mutation fixture cannot exist until Story 5.5 introduces `ISSUED`; deployed trigger logic is explicitly `IS DISTINCT FROM 'DRAFT'` and is verified in PostgreSQL. The integration runner retains its existing `pg` concurrent-query deprecation warning; assertions pass. Changes remain uncommitted because no commit was requested.

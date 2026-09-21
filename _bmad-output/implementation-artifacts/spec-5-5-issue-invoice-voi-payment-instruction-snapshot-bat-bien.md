---
title: 'Story 5.5: Issue Invoice với Payment instruction snapshot bất biến'
type: 'feature'
created: '2026-09-21'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: '84c405950fe6eb5cce77ca3a232c37f8bcfab5f5'
baseline_commit: '84c405950fe6eb5cce77ca3a232c37f8bcfab5f5'
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/implementation-artifacts/decision-story-3-2-finance-policy-bank-account-2026-09-18.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-21-finance-admin-mvp.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Finance có thể hoàn tất rà soát Invoice DRAFT nhưng chưa thể phát hành nghĩa vụ cùng hướng dẫn chuyển khoản ổn định; thay đổi BankAccount, policy, roster hoặc catalog sau đó có thể làm lịch sử bị diễn giải lại.

**Approach:** Finance phát hành nguyên tử một DRAFT có line/tổng VND dương bằng một BankAccount active cùng School, render template cố định từ roster snapshot, rồi lưu và chỉ trả obligation/payment/policy snapshot bất biến.

## Boundaries & Constraints

**Always:** `FINANCE_MANAGE`, School scope, origin + double-submit CSRF, UUID `Idempotency-Key`/`X-Operation-Id`, Operation reconciliation, transaction reauthorization, audit và request fingerprint bắt buộc. Issue chỉ nhận `bankAccountId`; server khóa Invoice/BankAccount lifecycle, xác nhận DRAFT có ít nhất một line và total dương, snapshot toàn bộ line/roster hiện có, account identity, rendered transfer content không dấu từ `{{studentName}} {{className}}`, FinancePolicy effective ở ngày issue và due date `Asia/Ho_Chi_Minh`. VND `BIGINT` chỉ qua REST dạng JSON-safe string. DB phải chặn thay đổi status/snapshot/line sau issue.

**Block If:** Canonical contract đổi transfer template cố định, FinancePolicy/due-date snapshot, hoặc ranh giới Issue không có settlement trước khi hoàn tất.

**Never:** Không thêm receipt, ledger/outstanding giả, `CLOSED`/`CANCELLED`, revision, promotion/coverage, ChargeRule/service/attendance dependency, Parent/Teacher route/bundle hoặc client-supplied total/status/payment/outstanding. Không render issued instruction từ BankAccount live.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Phát hành hợp lệ | DRAFT cùng School có line/tổng dương, BankAccount active | Chuyển `ISSUED`, lưu account/policy/due-date/obligation/payment snapshots, audit và Operation outcome | Không lỗi |
| Account/lifecycle sai | Account foreign, inactive hoặc Invoice không DRAFT/rỗng | Không ghi hay lộ data; UI tải lại state server | Not-found/validation/lifecycle conflict |
| Retry/cạnh tranh | Cùng request retry hoặc hai issue đồng thời | Replay cùng key trả outcome bền; chỉ một issue/audit; key khác thấy lifecycle conflict | Idempotency conflict hoặc state conflict |
| History bất biến | BankAccount, policy, roster/catalog đổi hoặc client gửi total/status | Issued detail luôn trả snapshot đã lưu; editor không xuất hiện | DB/API từ chối mutation và input không được dùng |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `InvoiceStatus` hiện chỉ có `DRAFT`; `Invoice` đã có roster/line/total snapshot nhưng thiếu issue, account và policy facts; `BankAccount` lifecycle là nguồn trạng thái active.
- `apps/api/prisma/migrations/20260921000007_invoice_snapshot_guards/migration.sql` và `20260921000011_correct_invoice_line_authority_guard/migration.sql` -- guards hiện có cần được mở rộng, không làm yếu authority total/line DRAFT-only.
- `apps/api/src/modules/finance/finance.service.ts` -- tái dùng `actor`, `mutate`, `draftInvoice`, `refreshInvoice`, `invoiceDto`, `audit` và reauthorization transaction; thêm query active accounts, issue command, rendered normalized content và issued DTO.
- `apps/api/src/modules/finance/finance.controller.ts` -- tái dùng `mutation` cookie guard; thêm Finance-owned active-bank projection và Issue endpoint.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, `src/integration/finance.integration.test.ts` -- theo fixture Finance/real PostgreSQL của Story 5.4; cập nhật enum assertion và thêm lifecycle, guard, snapshot, audit, retry/race proof.
- `apps/web/src/finance/finance-workspace.tsx` -- tái dùng `get`, `command`, `reconcile`, `applyInvoice` và stale-School reset; thêm selector account active, named issue confirmation có focus trap/restoration, và issued snapshot read-only.
- `apps/web/src/finance/finance-workspace.test.tsx` -- mở rộng fixtures/fetch proof cho issue, reconciliation, focus, errors, immutable display và stale/revoked context.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma`, migration Finance mới -- thêm `ISSUED` cùng các Invoice issue/payment/policy snapshot nullable-while-DRAFT, indexes/relations cần thiết và DB constraints/triggers cho transition DRAFT-to-ISSUED, snapshot bất biến và line immutability -- database bảo vệ lịch sử ngoài service.
- `apps/api/src/modules/finance/finance.service.ts`, `finance.controller.ts` -- thêm scoped active-account projection và `POST invoices/:invoiceId/issue` nhận duy nhất `bankAccountId`, khóa/check graph+lifecycle+policy, render/snapshot instruction, audit/Operation/replay và issued detail -- API duy nhất sở hữu authorization/lifecycle/snapshot.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, `apps/api/src/integration/finance.integration.test.ts` -- cover matrix, FinancePolicy due date/timezone, tenant/revoke, injection, immutable trigger, idempotency/concurrency/audit và JSON-safe DTO trên PostgreSQL -- chứng minh behavior tại outer API/database surface.
- `apps/web/src/finance/finance-workspace.tsx`, `finance-workspace.test.tsx` -- chỉ cho DRAFT chọn account active và named confirmation focus-managed; reconcile Operation và hiển thị issued obligation/payment/policy snapshot read-only -- browser không tính tiền hay giữ live account làm history.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chỉ mark 5.5 `done` sau review và toàn bộ verification pass.

**Acceptance Criteria:**
- Given Finance phát hành Invoice DRAFT reviewed có total dương với BankAccount active cùng School, when xác nhận bằng idempotent command, then response và lần đọc sau trả `ISSUED` với obligation, account, transfer content, roster, policy/due-date và total snapshot server-authoritative.
- Given account foreign/inactive, Invoice rỗng/non-DRAFT, capability bị revoke, retry changed-key hoặc concurrent issue, when command chạy, then không có write/leak/duplicate audit và chỉ Operation outcome phù hợp được reconcile.
- Given Invoice đã `ISSUED`, when bất kỳ API/DB/client cố đổi line, price, total, account, payment instruction, policy snapshot hay status, then bị từ chối; thay đổi live BankAccount/policy/roster không đổi detail đã issue.
- Given Admin mở DRAFT hoặc ISSUED Invoice, when UI render/issue timeout/context change, then selector chỉ hiện account active server-returned, confirmation yêu cầu đúng tên học sinh và quản lý focus, outcome refresh server state, và issued view không hiển thị editor hay outstanding giả.

## Design Notes

Issue không tạo ledger nên không thêm trường `outstanding`: UI chỉ nói settlement chưa được ghi nếu cần lifecycle explanation. Due date được server tính một lần từ FinancePolicy effective ở ngày issue theo `Asia/Ho_Chi_Minh`, snapshot policy fields phục vụ Epic 6 mà không đọc policy live. `studentNameSnapshot` và `classNameSnapshot` là input duy nhất để render template fixed; kết quả normalized được persist, không dùng `studentCode` làm transfer content.

## Review Triage Log

### 2026-09-21 - Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 14 (high 5, medium 8, low 1)
- defer: 0
- reject: 3
- addressed_findings:
  - `[high] [patch]` Database now rejects pre-populated DRAFT issue facts, incoherent issue totals/due dates, incomplete issued snapshots and every attempted mutation of issued account, obligation or policy facts.
  - `[high] [patch]` Captured one issue timestamp and added an `Asia/Ho_Chi_Minh` effective-policy/due-date boundary proof.
  - `[medium] [patch]` Active bank accounts now load independently, refresh before named confirmation and explain the no-active-account state without opening an unusable dialog.
  - `[medium] [patch]` Issued UI renders all persisted FinancePolicy facts and retains the authoritative issued outcome when a subsequent workspace reload fails.
  - `[medium] [patch]` Added PostgreSQL proof for missing effective policy, direct snapshot injection, immutable account/obligation/policy fields, retry/concurrency and issued line guards.

## Auto Run Result

Status: done

Summary: Story 5.5 delivers idempotent, School-scoped Invoice issuance. Finance selects a server-projected active BankAccount and confirms issuance; one transaction snapshots reviewed obligation lines/total, roster facts, immutable payment instruction, effective FinancePolicy and due date, then returns a durable Operation outcome. Issued Invoices are read-only and never use live account, policy or roster data.

Files changed:
- `apps/api/prisma/schema.prisma` and migrations `20260921000012` through `20260921000014` -- `ISSUED` state, issue snapshots and PostgreSQL lifecycle/coherence/immutability guards.
- `apps/api/src/modules/finance/finance.service.ts`, `finance.controller.ts` -- active-account projection and protected idempotent Issue command with audit, snapshots and reconciliation.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, `apps/api/src/integration/finance.integration.test.ts` -- controller/service and real PostgreSQL proof for scope, snapshots, timezone, lifecycle, immutability, retry and concurrency.
- `apps/web/src/finance/finance-workspace.tsx`, `finance-workspace.test.tsx` -- account refresh, named focus-managed confirmation, Operation reconciliation and immutable issued display.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- marks Story 5.5 done.

Review findings: 14 patches applied (high 5, medium 8, low 1); 0 deferred; 3 rejected. Follow-up review recommendation: true; patched score is 75 (`5 * 10 + 8 * 3 + 1`).

Verification performed:
- `pnpm --filter @passionedu/api test` -- pass; 15 files / 86 tests.
- `pnpm --filter @passionedu/admin-web test` -- pass; 7 files / 73 tests.
- `pnpm typecheck && pnpm test` -- pass; 7 workspace packages.
- `set -a && source .env && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm test:integration` from `apps/api` -- pass; PostgreSQL 8 files / 86 tests, with no pending migrations.
- `git diff --check` -- pass.

Residual risks: The integration runner emits its existing `pg` deprecation warning for concurrent `client.query()` calls; assertions pass, but the database-client execution pattern should be fixed before upgrading to pg v9. Changes remain uncommitted because no commit was requested.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test` -- expected: API Finance service/controller tests pass.
- `set -a && source .env && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm test:integration` -- expected: run from `apps/api`; deployed migrations and PostgreSQL Finance issue tests pass.
- `pnpm --filter @passionedu/admin-web test` -- expected: Finance workspace tests pass.
- `pnpm typecheck && pnpm test` -- expected: workspace checks pass.
- `git diff --check` -- expected: no whitespace errors.

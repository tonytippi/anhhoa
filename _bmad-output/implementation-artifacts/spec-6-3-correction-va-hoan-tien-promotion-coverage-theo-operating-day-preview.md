---
title: 'Correction và hoàn tiền promotion coverage theo operating-day preview'
type: 'feature'
created: '2026-09-25'
status: 'done'
baseline_commit: 'fa09c67bb362d2ddb102c597f39323c6df529264'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Finance chưa thể sửa Invoice đã có confirmed Receipt/coverage hoặc hoàn/reverse phần coverage chưa dùng. Sửa trực tiếp sẽ làm mất provenance, còn client không được tự tính số ngày hoạt động hay số tiền VND.

**Approach:** Thêm settlement-transfer append-only cho correction receipt-backed và workflow refund/reversal Finance-only. Server preview và post từ snapshot coverage/calendar, enforce giới hạn nguồn, policy reversal snapshot, approval tách identity, Operation/audit/idempotency.

## Boundaries & Constraints

**Always:** Mọi lookup, relation, lock, audit và Operation scope School; re-authorize membership/capability trong transaction. VND `BIGINT` trả JSON-safe; snapshot `Asia/Ho_Chi_Minh` là nguồn duy nhất của operating days, loại ngày effective và dùng floor. Refund/reversal/correction, transfer và approval append-only, không sửa Invoice/Receipt/Allocation/Coverage/audit nguồn. Override không âm, không vượt cap per-fact/source và khác calculated phải có reason. Mutations high-impact có origin, CSRF, UUID idempotency và reconcile Operation. Direct cần named confirmation; `SCHOOL_ADMIN_APPROVAL` cần Finance Manager request và School Admin identity khác approve/refuse.

**Block If:** Graph Invoice/Receipt hiện hữu không thể thêm correction settlement-transfer và immutable refund provenance bằng migration forward-only, composite School constraints và transaction lock mà không làm yếu settlement/coverage guards Story 6.1-6.2.

**Never:** Không dùng policy/calendar/catalog live hay browser để tính/refund; không generic credit, prepayment, partial/mixed receipt, direct coverage edit, self-approval, cross Student/School/SchoolYear source, Parent action/DTO, debt transfer, reporting/export hay third reversal mode.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Preview coverage refund | Issued coverage, eligible source và effective date | Server trả từng fact: denominator, remaining days, floor VND, immutable source và available cap từ snapshot | Reject source invalid, denominator không dương hoặc cross-scope; không post ledger |
| Direct refund | Finance actor, `DIRECT` snapshot, named confirm, amount hợp lệ | Một posted append-only refund/reversal, audit và replayable Operation | Reject thiếu confirm/reason, amount âm/excess; concurrent post không over-refund |
| Approval refund | Finance Manager request với `SCHOOL_ADMIN_APPROVAL` | Request pending; School Admin khác actor approve/refuse, chỉ approved mới post | Reject self-approval, revoked/inactive membership và post trước approval |
| Receipt-backed correction | Closed source Invoice có confirmed Receipt/coverage | Replacement lineage và immutable settlement-transfer provenance, source facts không đổi | Reject duplicate/cross-scope/stale correction; transaction rollback nguyên vẹn |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- graph Invoice/Receipt/Coverage/Operation; thêm refund/reversal workflow và receipt-backed correction transfer có composite School relation.
- `apps/api/prisma/migrations/20260925000010_promotion_coverage/migration.sql` đến `20260925000012_promotion_coverage_fact_period_guard/migration.sql` -- pattern immutable coverage/provenance; tạo migration mới, không sửa migration lịch sử.
- `apps/api/src/modules/finance/finance.service.ts` -- tái dùng `transactionActor`, `mutate`, `operation`, `audit`, `closeInvoice`, `prepareRevision`, `issueRevision`, invoice locks và `invoiceDto` cho preview/post/approval/transfer.
- `apps/api/src/modules/finance/finance.controller.ts` -- tái dùng `mutation` origin/CSRF/idempotency boundary và operation reconciliation; thêm routes Finance-only.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts` -- unit/controller contract, header forwarding, time/date/VND validation.
- `apps/api/src/integration/finance.integration.test.ts` -- PostgreSQL proof cho snapshot, tenant graph, immutable records, retry và concurrency.
- `apps/api/src/integration/finance-release-scope.integration.test.ts` -- thay cấm tuyệt đối refund/reversal bằng scope gate Story 6.3.
- `apps/web/src/finance/finance-workspace.tsx` -- tái dùng `command`, `reconcile`, pending operation và dialog confirmation cho source facts, preview và workflow state.
- `apps/web/src/finance/finance-workspace.test.tsx` -- accessibility, no optimistic result, named confirmation và timeout/school-switch regression.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma` và migration Finance mới -- persist immutable refund/reversal request/posting/approval và correction settlement-transfer với same-School source constraints, append-only/limit/lifecycle guards -- bảo toàn ledger provenance.
- `apps/api/src/modules/finance/finance.service.ts` và `finance.controller.ts` -- derive snapshot operating-day preview, bounded post/approval/refusal và receipt-backed correction trong common posting transaction -- giữ server authority, idempotency và isolation.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, `apps/api/src/integration/finance.integration.test.ts`, `finance-release-scope.integration.test.ts` -- prove matrix, cap, floor, policy modes, DB immutability, tenant/year isolation, replay và concurrency trên `.env.test` PostgreSQL.
- `apps/web/src/finance/finance-workspace.tsx` và `finance-workspace.test.tsx` -- show immutable server source/preview/limit and direct/two-step state in existing Finance dialogs -- không tạo client calculation hay optimistic post.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- mark Story 6.3 done only after review and verification pass.

**Acceptance Criteria:**
- Given an exact-issued coverage, when Finance previews refund using an eligible effective date, then API returns server-calculated snapshot operating days, floor VND, immutable provenance and remaining cap without ledger mutation.
- Given a valid direct refund or approved two-step request, when posting commits, then only append-only facts are added and total/per-fact refunds never exceed remaining paid source under retries or concurrency.
- Given two-step reversal policy, when requester attempts approval or posting before a distinct School Admin approves, then server rejects it and records no refund ledger event.
- Given a receipt-backed Invoice correction, when Finance completes the correction, then source Receipt/Coverage remain unchanged, source Invoice transitions append-only to `CANCELLED`, and replacement lineage plus settlement-transfer yield a non-collectible settled replacement that is auditable and School-scoped.
- Given Finance uses refund/correction dialogs, when source, timeout, error or workflow state renders, then UI displays server facts only, requires named confirmation where needed, reconciles uncertain operations and offers no Parent or self-approval action.

## Design Notes

The coverage snapshot is the refund calculation boundary. A correction cannot repurpose the historical Receipt: its value is represented by a new transfer projection, while all later refund caps continue to derive from immutable posted source facts.

## Review Triage Log

### 2026-09-25 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 16 (high 10, medium 5, low 1)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high]` `[patch]` Hardened reversal/refund provenance, policy-mode and immutable source DB guards; added request deletion, cap, exact-source and transfer-lineage proof.
  - `[high]` `[patch]` Made receipt-backed correction exact-only and status-only for historical source cancellation; replacement closes only with immutable settlement transfer and now returns its provenance.
  - `[medium]` `[patch]` Completed direct versus two-step UI contract, requester decision visibility, stale preview/focus handling, and API/UI regression coverage.

## Auto Run Result

**Status:** done

**Verification completed:** Reset/replay isolated `.env.test` PostgreSQL bằng `env -i` tối thiểu, sau đó chạy full integration 149/149. Finance matrix chứng minh snapshot operating-day/floor, direct cap/replay/concurrency, two-identity approval/refusal, tenant graph, append-only provenance, closed receipt-backed correction settlement-transfer và replacement không collectible. API/web typecheck cùng Finance unit/controller và UI workflow tests đều pass.

**Summary:** Hoàn tất Story 6.3: Finance preview/refund/reversal coverage theo calendar snapshot, direct hoặc School Admin approval, và correction Invoice closed có Receipt bằng settlement transfer append-only exact-only.

**Files changed:** Prisma Finance graph và migrations `20260925000013` đến `20260925000020`; Finance service/controller và tests; PostgreSQL integration/release-scope tests; Admin Finance workspace/tests; Epic 6 context, Story spec và sprint tracker.

**Review findings:** 16 patches applied (high 10, medium 5, low 1), 0 deferred, 0 rejected. Follow-up review recommendation: `true`; patch score is `35`.

**Residual risks:** Integration emits an existing `pg` deprecation warning for overlapping `client.query()` execution. Receipt-backed corrections intentionally reject a replacement amount that differs from the immutable exact source Receipt; non-exact correction settlement remains outside Story 6.3.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: Prisma client generates from new Finance graph.
- `pnpm --filter @passionedu/api test -- src/modules/finance/finance.service.test.ts src/modules/finance/finance.controller.test.ts` -- expected: Finance unit/controller contract passes.
- `pnpm --filter @passionedu/api test:integration` -- expected: `.env.test` PostgreSQL integration including refund/correction guards passes.
- `pnpm --filter @passionedu/api typecheck` -- expected: API typecheck passes.
- `pnpm --filter @passionedu/admin-web test -- src/finance/finance-workspace.test.tsx` -- expected: Finance UI workflow tests pass.
- `git diff --check` -- expected: no whitespace errors.

---
title: 'Finance: release capacity proof generate 200 hóa đơn'
type: 'bugfix'
created: '2026-09-26'
status: 'done'
review_loop_iteration: 1
baseline_commit: '01f88a8c02196115aa91bca5bdfebd2a27559d7b'
context:
  - 'AGENTS.md'
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/implementation-artifacts/decision-story-5-6-resumable-collection-run-generation-2026-09-21.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Sau khi merge Epic 6, release integration proof cũ cho 1.000 Student fail vì final publish của CollectionRun vượt Prisma interactive transaction default 5 giây. Capacity trường mầm non mục tiêu đã được chốt là tối đa 200 Student; release proof phải đo đúng quy mô này mà không nới timeout/lease và không làm yếu atomic publish.

**Approach:** Đồng bộ canonical capacity acceptance sang 200 Student trong 30 giây, giữ Prisma default transaction timeout, batch staging, lock, idempotency, snapshot/carry/coverage materialization và terminal Operation semantics hiện hữu; dùng performance integration proof để xác nhận workflow hoàn tất dưới 30 giây.

## Boundaries & Constraints

**Always:** `publishGeneration()` vẫn là một transaction atomic duy nhất: Invoice/carry/coverage materialization, `CollectionRun READY -> GENERATED`, lifecycle transition, generation terminal status, Operation outcome và audit cùng commit hoặc cùng rollback. School-scoped authorization/relations, durable 50-item staging progress, advisory/row locks, VND BIGINT, retry/idempotency và pause/resume giữ nguyên. Prisma interactive transaction giữ default timeout; không thay đổi global hay final-publish transaction budget.

**Ask First:** Hỏi trước khi đổi batch size, tách final publish thành nhiều transaction, thay đổi 200-Student/30-giây SLO, hoặc tối ưu set-based carry/coverage materialization vượt phạm vi capacity remediation.

**Never:** Không tăng timeout global hoặc final publish của `PrismaService`; không đưa Invoice visibility ra trước final publish; không weaken `READY -> GENERATED` guards, Operation/audit atomicity hoặc retry-safe failure; không sửa schema/migration, UX hay Finance settlement behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Target-school run | 200 eligible Students, queued generation | Batch progress durable; final publish completes exactly 200 unique DRAFT Invoice and Operation `COMPLETED` in <= 30 seconds | Default 5-second Prisma transaction timeout remains in force |
| Publish failure | Failure during final atomic publish | No partial Invoice/carry/coverage/lifecycle/audit generated outcome commits; run remains retry-safe | Generation and Operation record durable `FAILED` outcome |
| Other mutations | Receipt, issue, preview, catalog and non-publish operations | Existing short default transaction protection remains in force | No broadened global lock/connection budget |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/finance/finance.service.ts` -- `processNextGeneration()` stages 50 durable items at lines 1963-1994; `publishGeneration()` at lines 1996-2020 performs all Invoice/carry/coverage finalization in one default-timeout interactive transaction and remains unchanged.
- `apps/api/src/modules/identity/prisma.service.ts` -- no global interactive transaction timeout override; leave unchanged.
- `apps/api/src/integration/finance.integration.test.ts` -- performance proof at lines 1951-2029 asserts intermediate Operation progress, terminal completion, capacity budget and invoice count; adjust it to 200 Student/30 seconds.
- `_bmad-output/implementation-artifacts/decision-story-5-6-resumable-collection-run-generation-2026-09-21.md` -- final publish must remain atomic after durable staged progress; read-only decision evidence.
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-26-finance-generation-capacity.md` -- approved capacity decision for 200 Student <= 30 seconds; supersedes the historical Story 5.6 scale evidence.

## Tasks & Acceptance

**Execution:**
- [x] `_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md`, `_bmad-output/planning-artifacts/epics-passionedu.md`, and `epic-5-context.md` -- align the approved target-school capacity contract to 200 Student <= 30 seconds without changing Finance correctness/retry requirements.
- [x] `apps/api/src/integration/finance.integration.test.ts` -- adjust the performance regression proof to 200 Student/30 seconds; preserve the 50-item progress observation, default Prisma timeout and exact-one Invoice assertions.

**Acceptance Criteria:**
- Given an eligible 200-Student target-school CollectionRun is generated, when the worker reaches final publish, then the completed workflow remains <= 30 seconds with durable authoritative progress under Prisma's default transaction timeout.
- Given final publish cannot commit, when its default transaction errors or expires, then no partial financial/lifecycle terminal state is visible and the persisted generation/Operation failure remains reconcilable.
- Given any Finance mutation, when it uses an interactive transaction, then it retains the default timeout and lease semantics.

## Design Notes

The 30-second requirement is an end-to-end target-school generation SLO, not a transaction timeout. The final publish processes all staged snapshots and invokes per-Invoice carry/coverage logic under Prisma's default protection. Keeping it one transaction prevents a visible Invoice set without its CollectionRun lifecycle, terminal Operation and audit provenance.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: Prisma client matches the merged Epic 6 schema before compilation or integration execution.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration` -- expected: real PostgreSQL Finance integration suite, including 200 Student generation with default Prisma timeout, passes using only `anhhoa_test`.
- `pnpm --filter @passionedu/api typecheck` -- expected: API compiles without broad Prisma configuration changes.
- `git diff --check` -- expected: no whitespace errors.

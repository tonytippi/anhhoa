---
title: 'Story 5.12: Cấu hình ưu đãi theo khoản thu và gán học sinh'
type: 'feature'
created: '2026-09-25'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: 'fead96f8fc6546a48d399a44c100da6ef13b259d'
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/implementation-artifacts/decision-story-5-12-promotion-policy-contract-2026-09-25.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-25-promotion-policy-phase-1b.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Finance chưa có chính sách ưu đãi versioned, multi-Receivable và Student assignment có lịch sử, nên giảm trừ chỉ có thể trở thành điều chỉnh thủ công, không thể thêm con của nhân viên mới vào một policy đang hiệu lực một cách audited.

**Approach:** Tạo graph School-scoped cho policy/version/target/assignment, command REST idempotent và surface `Ưu đãi` table-first. Version active khóa cấu hình nhưng cho phép gán batch/kết thúc assignment; evaluator và Invoice snapshot thuộc stories kế tiếp.

## Boundaries & Constraints

**Always:** Finance command resolve `FINANCE_MANAGE`, re-authorize trong transaction, validate toàn bộ graph cùng School, origin/CSRF, UUID idempotency, Operation và audit. Version lifecycle `DRAFT -> ACTIVE -> RETIRED`; active/retired config bất biến. Target unique theo version/Receivable. UI end date inclusive được API chuẩn hóa `[from, to)`; assignment nằm trong interval version, reason bắt buộc, không hard-delete và overlap cùng Student/policy bị từ chối. Batch assignment all-or-nothing, một Operation/reason/interval chung.

**Block If:** Contract mới yêu cầu cadence khoản thu, target quantity/unit, fulfillment mode, auto eligibility hoặc thay đổi semantics stacking/exclusivity đã duyệt.

**Never:** Không implement evaluator preview/generate, discount/gross/net DTO, Invoice application/Issue snapshot, `PREPAID_COVERAGE`, Receipt, settlement/carry/refund, Class/service/attendance dependency hay client-derived money.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Tạo và activate version | Policy DRAFT, nhiều Receivable ACTIVE cùng School, discount rule/interval hợp lệ | Persist target unique, audit/Operation; activate khóa config | Cross-School, duplicate target, invalid interval/value bị từ chối trước partial write |
| Gán batch Student | Version ACTIVE; nhiều Student cùng School, common interval/reason | Mỗi Student có assignment riêng, transaction trả list server-confirmed | Một Student invalid/outside version/overlap làm rollback toàn batch và trả field/row error |
| Kết thúc assignment | Assignment active, end date/reason hợp lệ | Persist exclusive end và audit, lịch sử giữ nguyên | Cross-School, end trước start hoặc sau version bị từ chối |
| Retry/switch context | Idempotency retry, timeout hoặc đổi School | Replay Operation cùng outcome; UI reconcile và xóa/stale-guard policy state | Changed key fingerprint conflict; không retry mù hoặc lộ School cũ |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- thêm enums/models/relation composite cho promotion graph; `Student`, `School`, `Receivable` là relation anchors.
- `apps/api/prisma/migrations/` -- migration mới, DB unique/check/overlap guard; không sửa migration lịch sử.
- `apps/api/src/modules/finance/finance.service.ts` -- tái dùng `actor()`, `transactionActor()`, `mutate()` và `audit()`; thêm DTO/read/commands policy/version/target/assignment.
- `apps/api/src/modules/finance/finance.controller.ts` -- read/mutation routes; mọi write đi qua `mutation()`.
- `apps/api/src/modules/finance/finance.service.test.ts` và `finance.controller.test.ts` -- validation, header/CSRF forwarding, no-write invalid input.
- `apps/api/src/integration/finance.integration.test.ts` -- PostgreSQL graph isolation, atomic batch, interval, audit/Operation/idempotency proof.
- `apps/web/src/finance/finance-workspace.tsx` -- thêm server DTO/state/load/reset/surface `Ưu đãi`, tái dùng `command()` và reconciliation.
- `apps/web/src/finance/finance-workspace.test.tsx` -- UI submit only config facts, batch error/reconcile/Switch safety.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma` và migration mới -- persist School-scoped policy/version/target/assignment graph với lifecycle, target uniqueness và interval integrity.
- `apps/api/src/modules/finance/finance.service.ts` và `finance.controller.ts` -- expose authorized read/create/activate/retire/batch-assign/end commands via existing Operation/audit boundary.
- `apps/web/src/finance/finance-workspace.tsx` -- render reviewed multi-target and batch assignment workflow using only API-returned values.
- `apps/api/src/modules/finance/*.test.ts`, `apps/api/src/integration/finance.integration.test.ts`, `apps/web/src/finance/finance-workspace.test.tsx` -- prove matrix and tenant/retry/browser boundaries.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- mark Story 5.12 done only after verification/review.

**Acceptance Criteria:**
- Given Finance Manager ở School hợp lệ, when tạo/activate version với nhiều targets, then same-School graph, lifecycle, immutable config, audit và Operation đều server-enforced.
- Given version active và batch Student hợp lệ, when submit common interval/reason, then every assignment is created atomically and can be ended without deleting history.
- Given cross-School UUID, overlap, invalid interval, duplicate target hoặc changed idempotency request, when command chạy, then no partial row persists and an authorization-safe error returns.
- Given Finance dùng `Ưu đãi`, when tạo policy/gán batch/kết thúc hoặc timeout/switch School, then browser gửi configuration only, reconciles server outcome và không render data School cũ.

## Design Notes

Ngày kết thúc UI được chuyển sang exclusive end tại API để phù hợp convention interval hiện hữu. `stackingMode` và priority là configuration persisted cho Story 5.13; Story này không chạy calculation hay phát hành application.

## Review Triage Log

### 2026-09-25 - Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 4 (high 1, medium 3)
- defer: 0
- reject: 0
- addressed_findings:
  - Chỉ cho target Receivable và group đang ACTIVE; reject interval rỗng ở API thay vì để DB constraint lộ ra.
  - Sửa projection assignment theo ngày hiện tại và render-time School guard, không lộ policy/Student tenant cũ khi switch.
  - Bổ sung PostgreSQL proof cho tenant graph, atomic batch, overlap/adjacent interval, Operation/audit/idempotency; bổ sung controller origin/CSRF boundary.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test` -- Finance unit/controller pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration` từ `apps/api` -- PostgreSQL policy graph pass trên test DB.
- `pnpm --filter @passionedu/admin-web test` -- Finance workspace pass.
- `pnpm typecheck && pnpm test && git diff --check` -- workspace type/test/whitespace pass.

## Auto Run Result

Status: done

Summary: Story 5.12 tạo PromotionPolicy School-scoped, version `DRAFT -> ACTIVE -> RETIRED`, multi-Receivable target và batch Student assignment có interval/reason/audit. Finance có thể thêm Student mới cho policy active hoặc kết thúc áp dụng mà không xóa lịch sử. API và DB enforce tenant graph, lifecycle, interval, idempotency/Operation/audit; Admin render surface `Ưu đãi` dùng server values và School-switch-safe state.

Files changed:
- `apps/api/prisma/schema.prisma` và `apps/api/prisma/migrations/20260925000000_promotion_policy_phase_1b/migration.sql` -- promotion graph, scoped relations, constraints/exclusion/immutability triggers.
- `apps/api/src/modules/finance/finance.service.ts` và `finance.controller.ts` -- policy/version/assignment REST commands và authorization boundary.
- `apps/web/src/finance/finance-workspace.tsx` -- multi-target policy, activation/retirement, batch assignment/end assignment, reconciliation và stale-School guard.
- `apps/api/src/integration/finance.integration.test.ts`, `apps/api/src/modules/finance/*.test.ts`, `apps/web/src/finance/finance-workspace.test.tsx` -- DB, controller, validation và UI regression proof.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Story 5.12 done.

Verification performed:
- `pnpm typecheck && pnpm test && git diff --check` -- pass; API 17 files / 127 tests, Admin 9 files / 102 tests.
- `set -a && source .env.test && set +a && pnpm test:integration` từ `apps/api` -- pass, 8 files / 122 tests trên `anhhoa_test`.

Residual risks: Runtime warning từ `pg` về concurrent `client.query()` và React test warning `act(...)` vẫn xuất hiện nhưng không fail. Story 5.13 còn phải implement evaluator/fingerprint stale; Story 5.14 còn phải recheck Issue và immutable application snapshot.

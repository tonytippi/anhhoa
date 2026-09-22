---
title: 'Story 5.7: Đóng CollectionRun đã generate'
type: 'feature'
created: '2026-09-22'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: '5383ae7c3849393f3670545d31e3b12db186007b'
baseline_commit: '5383ae7c3849393f3670545d31e3b12db186007b'
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Một CollectionRun đã generate chưa có điểm khóa nghiệp vụ rõ ràng sau khi Finance rà soát, nên vẫn có thể được bổ sung Student/Invoice DRAFT trước các luồng settlement và revision ở Epic 6.

**Approach:** Thêm lệnh đóng idempotent, School-scoped cho CollectionRun `GENERATED`; server chỉ đóng khi toàn bộ Invoice hiện hữu không còn `DRAFT`, lưu reason/actor/audit/Operation và Admin portal chỉ cho xác nhận đóng rồi hiển thị trạng thái chỉ đọc do server trả về.

## Boundaries & Constraints

**Always:** Bảo toàn `FINANCE_MANAGE`, School scope, origin validation và double-submit CSRF, UUID `Idempotency-Key`/`X-Operation-Id`, fingerprint/replay/Operation reconciliation, transaction reauthorization, audit và khóa transaction. Close chỉ nhận reason bắt buộc, chỉ chuyển `GENERATED -> CLOSED`, tạo lifecycle transition tuần tự và phải serialize với generate/thêm Student để không xuất hiện Invoice `DRAFT` sau close. Sử dụng enum hiện hữu: `ISSUED` là Invoice hợp lệ duy nhất hiện có; các trạng thái `CLOSED`/`CANCELLED` sẽ tự được chấp nhận khi các Story 5.8/6.1 bổ sung chúng.

**Block If:** Contract chính tắc thay đổi ý nghĩa hoặc điều kiện của `CLOSED`, hoặc cần đưa Receipt, settlement hay revision vào lệnh close.

**Never:** Không thêm Invoice settlement/revision/cancellation state hoặc route, ledger/Receipt, promotion, Parent/Teacher dependency, client-supplied status/tổng tiền, hoặc bypass DB/API authorization.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Đóng hợp lệ | Run cùng School là `GENERATED`, toàn bộ Invoice `ISSUED`, reason hợp lệ | Run thành `CLOSED`, transition thứ 4, AuditRecord reason và Operation outcome được persist nguyên tử | Không lỗi; retry cùng request replay Operation |
| Invoice/running lifecycle chưa hợp lệ | Run `DRAFT`/`READY`/`CLOSED` hoặc còn Invoice `DRAFT` | Không đổi run, không thêm transition/audit close | Trả lifecycle conflict/validation server-authoritative |
| Biên authorization và retry | School/capability sai, reason thiếu, changed fingerprint, close song song hoặc timeout | Không lộ/ghi chéo tenant; một close duy nhất hoặc Operation đã có được trả qua reconcile | Từ chối phù hợp, UI giữ Operation và chỉ retry sau reconcile |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `CollectionRunStatus` và `CollectionRunLifecycleTransition` đã có `CLOSED`/actor/membership/Operation; `InvoiceStatus` hiện chỉ có `DRAFT`, `ISSUED`, nên không mở rộng settlement state trong Story này.
- `apps/api/src/modules/finance/finance.service.ts` -- `routes`, `actor()`, `transactionActor()`, `mutate()`, `lockRun()`, `audit()`, `runDto()`, `addGeneratedStudent()` và `publishGeneration()` là các điểm tái dùng cho scoped idempotent command, serial lock và response.
- `apps/api/src/modules/finance/finance.controller.ts` -- `mutation()` áp origin/CSRF, các POST Finance forward `Idempotency-Key`/`X-Operation-Id` theo cùng convention.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts` -- test đơn vị controller/service hiện hữu cho forwarding, validation và guard mutation; mở rộng close contract.
- `apps/api/src/integration/finance.integration.test.ts` -- fixture PostgreSQL Finance có generate/issue, retry/race, tenant và lifecycle; bổ sung proof command close/locks/audit trên database thật.
- `apps/web/src/finance/finance-workspace.tsx` -- `command()`, `reconcile()`, named dialog/focus trap và `GENERATED` detail là điểm đặt close confirmation; `Run.status` đã gồm `CLOSED`.
- `apps/web/src/finance/finance-workspace.test.tsx` và `apps/web/e2e/finance-release-gate.spec.ts` -- mở rộng UI và browser proof cho confirmation, close result, readonly state và reconciliation.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chỉ chuyển Story 5.7 sang `done` sau khi implementation, review và verification hoàn tất.

## Tasks & Acceptance

**Execution:**
- `apps/api/src/modules/finance/finance.service.ts` và `finance.controller.ts` -- thêm close endpoint/command nhận reason, tái dùng mutation/Operation/audit/lock conventions, kiểm tra toàn bộ Invoice trước transition và trả DTO/outcome server-authoritative -- khóa lifecycle an toàn.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, `apps/api/src/integration/finance.integration.test.ts` -- kiểm tra matrix, actor/reason/audit/transition, tenant/capability, replay/fingerprint, race với add Student và database lifecycle guard -- chứng minh boundary API/PostgreSQL.
- `apps/web/src/finance/finance-workspace.tsx`, `finance-workspace.test.tsx`, `apps/web/e2e/finance-release-gate.spec.ts` -- thêm confirmation focus-managed có reason và named close, pending/reconcile/error states, cùng readonly `CLOSED` explanation -- browser không tự quyết lifecycle.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chuyển 5.7 sang `done` sau toàn bộ review/verification -- tracker trung thực.

**Acceptance Criteria:**
- Given một Finance Manager có `FINANCE_MANAGE` trong School và một run `GENERATED` mà mọi Invoice đã phát hành, when họ submit close với reason và UUID idempotency headers, then API nguyên tử trả run `CLOSED`, persist actor/reason/audit, Operation và transition `GENERATED -> CLOSED`; identical retry trả đúng outcome để reconcile sau timeout.
- Given run không phải `GENERATED`, còn Invoice `DRAFT`, School/capability sai, reason thiếu hay fingerprint thay đổi, when close chạy, then server từ chối mà không tạo close transition/audit hay rò dữ liệu tenant.
- Given close cạnh tranh với add Student/generate hoặc run đã `CLOSED`, when mutation API thực hiện, then run không thể kết thúc `CLOSED` với Invoice `DRAFT`, và mọi create/edit/add Student sau close bị từ chối tại server/database surface.
- Given Admin mở run `GENERATED` hoặc `CLOSED`, when xác nhận close, timeout hoặc request lỗi, then UI yêu cầu named confirmation và reason có quản lý focus, chỉ reconcile Operation trước retry, và sau success chỉ hiển thị trạng thái/read-filter/report server-returned mà không có thao tác sửa/thêm Student.

## Design Notes

`InvoiceStatus.CLOSED` và `CANCELLED` thuộc Story 6.1/5.8. Close query phải được diễn đạt như "không có Invoice không-terminal" thay vì hard-code chỉ `ISSUED` ở contract dữ liệu dài hạn; với enum hiện hữu, tập terminal hiện tại chỉ là `ISSUED`. Close và `addGeneratedStudent()` cùng gọi `lockRun()` trong transaction, nên một trong hai hoàn tất trước và lệnh còn lại thấy lifecycle mới.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test` -- expected: Finance service/controller close tests pass.
- `set -a && source .env && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm --filter @passionedu/api test:integration` -- expected: run from `apps/api`; PostgreSQL migration/integration proofs pass.
- `pnpm --filter @passionedu/admin-web test` -- expected: Finance workspace close UI tests pass.
- `set -a && source apps/api/.env && set +a && pnpm test:e2e` -- expected: Finance browser close flow passes.
- `pnpm typecheck && pnpm test && git diff --check` -- expected: workspace type/tests and whitespace checks pass.

## Review Triage Log

### 2026-09-22 - Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 14 (high 5, medium 7, low 2)
- defer: 0
- reject: 1
- addressed_findings:
  - `[high] [patch]` PostgreSQL now permits close only from `GENERATED`, locks the parent run before Invoice writes, and rejects direct non-issued close, reopen, post-close Invoice mutation and contradictory lifecycle history.
  - `[high] [patch]` Close Operation outcome now retains server run selections and invoices; reconciliation applies its `CLOSED` outcome even when a refresh fails.
  - `[medium] [patch]` Close dialog requires the named billing month and reason, disables with an explanatory DRAFT condition, correctly describes validation errors, and moves success focus to the stable closed heading.
  - `[medium] [patch]` Added controller CSRF/origin proof plus PostgreSQL authorization, lifecycle-finality, idempotency and concurrent close/add-Student coverage.

## Auto Run Result

Status: done

Summary: Finance Manager can idempotently close a generated CollectionRun only after every current Invoice is issued. The API records the actor, reason, lifecycle transition, audit and scoped Operation atomically; PostgreSQL enforces finality against direct writes and concurrent Invoice mutation. Admin requires a named, accessible confirmation and reconciles timeout results before retry.

Files changed:
- `apps/api/prisma/migrations/20260922000000_collection_run_close_guards/migration.sql` and `20260922000001_correct_collection_run_close_guards/migration.sql` -- CollectionRun close, Invoice mutation and lifecycle-history database guards.
- `apps/api/src/modules/finance/finance.service.ts` and `finance.controller.ts` -- protected idempotent close command and REST endpoint.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, and `src/integration/finance.integration.test.ts` -- unit and real PostgreSQL lifecycle, authorization, replay and concurrency proof.
- `apps/web/src/finance/finance-workspace.tsx`, `finance-workspace.test.tsx`, and `e2e/finance-release-gate.spec.ts` -- named close confirmation, accessible readonly view and browser reconciliation proof.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Story 5.7 marked `done`.

Review findings: 14 patches applied (high 5, medium 7, low 2); 0 deferred; 1 rejected. Follow-up review recommendation: true; patched score is 73 (`5 * 10 + 7 * 3 + 2`).

Verification performed:
- `pnpm --filter @passionedu/api test` -- pass, 15 files / 90 tests.
- `pnpm --filter @passionedu/admin-web test` -- pass, 7 files / 77 tests.
- `pnpm typecheck && pnpm test && git diff --check` -- pass.
- `set -a && source .env && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm --filter @passionedu/api test:integration` from `apps/api` -- pass, 8 files / 89 tests; 44 migrations applied/validated.
- `set -a && source apps/api/.env && set +a && pnpm test:e2e` -- pass, 6 Playwright tests.

Residual risks: The existing PostgreSQL client warning about concurrent `client.query()` calls remains and should be addressed before upgrading to `pg` v9. Admin build still warns that one bundle exceeds the configured chunk-size recommendation. Neither warning fails the Story 5.7 checks.

## Suggested Review Order

**Command Boundary**

- Close reuses Finance authorization, idempotency, transaction, audit and lifecycle conventions.
  [`finance.service.ts:1206`](../../apps/api/src/modules/finance/finance.service.ts#L1206)

- Controller applies cookie origin and CSRF protection before forwarding the close command.
  [`finance.controller.ts:30`](../../apps/api/src/modules/finance/finance.controller.ts#L30)

**Database Finality**

- Database triggers reject closing with drafts, invoices after close, and reopening a closed run.
  [`migration.sql:1`](../../apps/api/prisma/migrations/20260922000000_collection_run_close_guards/migration.sql#L1)

**Admin Workflow**

- Named close confirmation requires a reason, traps focus, reconciles operations, and renders server state.
  [`finance-workspace.tsx:563`](../../apps/web/src/finance/finance-workspace.tsx#L563)

- Refreshing a non-draft run synchronizes server selection state to avoid a false switch guard.
  [`finance-workspace.tsx:206`](../../apps/web/src/finance/finance-workspace.tsx#L206)

**Verification**

- PostgreSQL proof covers terminal-invoice enforcement, replay, audit, transition, and close finality.
  [`finance.integration.test.ts:1431`](../../apps/api/src/integration/finance.integration.test.ts#L1431)

- Browser release gate proves the named close flow and read-only CLOSED view.
  [`finance-release-gate.spec.ts:68`](../../apps/web/e2e/finance-release-gate.spec.ts#L68)

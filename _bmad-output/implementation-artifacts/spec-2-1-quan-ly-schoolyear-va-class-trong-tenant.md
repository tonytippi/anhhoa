---
title: 'Story 2.1: Quản lý SchoolYear và Class trong tenant'
type: 'feature'
created: '2026-09-17'
status: 'done'
baseline_revision: '508093f98934f26e2a3bb449acde1e6e8b0461a2'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-story-2-1-minimal-roster-2026-09-17.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** School Admin chưa có boundary danh bộ tenant-scoped để tạo năm học và lớp trước khi quản lý học sinh. Không được đưa Student lifecycle, archive Class hoặc giá tiền vào bước nền tảng này.

**Approach:** Thêm Roster API và Admin workspace tối giản cho SchoolYear và Class. API là nguồn chân lý cho authorization, ngày active, validation, audit và Operation; portal chỉ hiển thị dữ liệu server xác nhận.

## Boundaries & Constraints

**Always:** Resolve `schoolId` bằng active membership và `ROSTER_MANAGE` trong audience `app` trước mọi aggregate lookup. Mỗi read/write, uniqueness, audit và Operation phải School-scoped; cookie mutation cần exact Origin, double-submit CSRF, UUID `Idempotency-Key` và `X-Operation-Id`. `SchoolYear` có `name`, `startsOn`, `endsOn`; active được derive server-side theo `Asia/Ho_Chi_Minh` và `[startsOn, endsOn)`, không persist/mutate status. SchoolYear intervals trong cùng School không overlap. `Class` chỉ có name, schoolYearId, ACTIVE và timestamps; composite tenant graph phải ngăn Class tham chiếu SchoolYear School khác. Cả hai name trim, non-empty, tối đa 100 ký tự, trùng được phép. Validation trả `{ error: { code, message, fieldErrors } }`.

**Block If:** Phát hiện contract đã duyệt mâu thuẫn với migration PostgreSQL hoặc API/portal patterns hiện hữu mà không thể đáp ứng bằng thay đổi additive.

**Never:** Không thêm `monthlyFee`, Student, enrollment, activeStudentCount, archive Class, date/status update SchoolYear, Class effective interval hoặc surface tại Ops/Teacher/Parent. Không tin path/header/browser state để authorize, không trả raw database errors, không auto-replay write sau timeout.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create SchoolYear | Authorized active School Admin; valid name and non-overlapping dates | Persist SchoolYear, audit and completed Operation; list DTO has server-derived `isActive` | No error expected |
| Invalid SchoolYear | Blank/overlong name, malformed dates, or startsOn >= endsOn | No write, audit, or Operation | `VALIDATION_ERROR` with field-keyed errors |
| Overlapping SchoolYear | Valid interval overlaps an existing SchoolYear in same School | No write; different Schools may overlap | Stable conflict/validation error without raw DB detail |
| Create/rename Class | Authorized Admin; selected SchoolYear belongs to School; valid name | Persist ACTIVE Class or updated name with audit and completed Operation | No error expected |
| Cross-tenant selector | Foreign SchoolYear/Class UUID or revoked/suspended context | No resource disclosure or write | Authorization/not-found standard error; clear stale portal state |
| Timeout/retry | Mutation request result uncertain | Preserve form and reconcile saved Operation before any user retry | No automatic replay |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- tenant graph models; add `SchoolYear`, `Class`, `ClassStatus` and School relations.
- `apps/api/prisma/migrations/` -- add PostgreSQL migration for date check, exclusion constraint and composite SchoolYear/Class foreign key.
- `apps/api/src/modules/authorization/authorization.service.ts` -- `Capability`, `capabilities()` and navigation projection; grant `ROSTER_MANAGE` only to app School Admin.
- `apps/api/src/modules/memberships/memberships.controller.ts` -- established app session, cookie-mutation and Operation reconciliation route patterns.
- `apps/api/src/modules/memberships/memberships.service.ts` -- `mutate()` transaction: Operation replay/fingerprint, School lock, actor reauthorization, audit and collision handling.
- `apps/api/src/modules/common/mutation-protection.ts` -- use `assertCookieMutation()` and `requestFingerprint()`; do not reimplement security checks.
- `apps/api/src/modules/common/audit.ts` -- use `auditData()` for transaction-local provenance.
- `apps/api/src/common/api-error.filter.ts` -- extend error envelope only to retain explicit field errors from validated domain errors.
- `apps/api/src/app.module.ts` -- register the new `RosterModule`.
- `apps/web/src/school-context.tsx` -- current selected-School guards, CSRF, dirty switch dialog, operation reconciliation and denial clearing to reuse.
- `apps/web/src/roster/roster-workspace.tsx` -- new capability-gated roster UI; keep separate from access-management shell.
- `apps/web/src/index.css` -- reuse table/field-error/dialog responsive primitives; add only local roster styling if necessary.
- `apps/api/src/integration/membership.integration.test.ts` -- PostgreSQL-backed integration style and test lifecycle.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma` and a new `apps/api/prisma/migrations/*_minimal_roster_school_year_class/migration.sql` -- add only SchoolYear/Class tenant graph, date check and same-School no-overlap constraint -- persist business boundary at the database.
- `apps/api/src/modules/authorization/authorization.service.ts`, `apps/api/src/modules/roster/*`, `apps/api/src/app.module.ts`, and API tests -- add capability-gated SchoolYear/Class reads and idempotent writes using the existing authorization, audit and Operation conventions -- keep all commands server-authoritative.
- `apps/api/src/common/api-error.filter.ts` and focused tests -- preserve intentional `fieldErrors` in the standard error envelope -- let UI attach server validation to the correct field.
- `apps/api/src/integration/roster.integration.test.ts` -- prove migration constraints, half-open boundaries, cross-School graph rejection and command security/idempotency on PostgreSQL -- verify invariants beyond mocks.
- `apps/web/src/roster/roster-workspace.tsx`, its tests, `apps/web/src/school-context.tsx`, and only needed CSS -- add an accessible, responsive Admin roster workspace with server context, forms, tables and Operation reconciliation -- prevent stale cross-School display and local placeholder state.

**Acceptance Criteria:**
- Given a School Admin with `ROSTER_MANAGE` in an active School, when creating valid SchoolYear/Class data, then records, audit and Operations are scoped to that resolved School and the portal shows server-confirmed data only.
- Given SchoolYear intervals in one School, when intervals overlap, then PostgreSQL rejects the write; adjacent half-open intervals and matching intervals in another School remain valid.
- Given a request with invalid names or dates, when the API rejects it, then the portal preserves form values, focuses an error summary and renders each `fieldErrors` entry beside its field.
- Given any foreign, revoked or suspended School context, when reads or writes run, then the server denies before data disclosure or mutation and the portal clears stale protected data.
- Given a delayed or timed-out write, when the user returns to the workspace, then the saved Operation is reconciled before another submit and no mutation is replayed automatically.
- Given the Story 2.1 workspace, when rendered on desktop or small screens, then School and selected SchoolYear context are visible and tables have captions, keyboard actions and responsive treatment.

## Design Notes

Use an exclusion constraint for `(schoolId, daterange(startsOn, endsOn, '[)'))`: a partial "active" unique index cannot represent calendar intervals and would not prevent future/past overlap. Keep `isActive` a response projection so time passing never requires a background status mutation.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: generated Prisma client succeeds.
- `pnpm --filter @passionedu/api test` -- expected: API unit/controller tests pass.
- `pnpm --filter @passionedu/admin-web test` -- expected: Admin workspace tests pass.
- `pnpm --filter @passionedu/api test:integration` -- expected: clean PostgreSQL migration and roster integration tests pass when configured.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- expected: workspace quality gates pass.

## Auto Run Result

Status: done

Đã triển khai roster tenant-scoped tối giản cho SchoolYear và Class: migration PostgreSQL với date check, half-open exclusion constraint và composite tenant FK; capability `ROSTER_MANAGE`; Roster REST API có authorization, CSRF, idempotency Operation, audit, DTO JSON-safe và field errors; Admin workspace có context server, validation accessible, switch guard và Operation reconciliation không auto-replay.

Files changed:

- `apps/api/prisma/schema.prisma` và `apps/api/prisma/migrations/20260917000000_minimal_roster_school_year_class/migration.sql` -- tenant graph và database constraints.
- `apps/api/src/modules/roster/*`, `apps/api/src/app.module.ts`, authorization và error filter -- roster API/server authorization.
- `apps/api/src/integration/roster.integration.test.ts` -- PostgreSQL integration coverage.
- `apps/web/src/school-context.tsx`, `apps/web/src/roster/*` và tests -- Admin roster workspace, accessibility và switch/reconciliation safety.

Review findings: 1 high patch đã được sửa (Class Date objects trong `Operation.outcome` được chuyển sang DTO JSON-safe); 0 items deferred; các finding low/noise còn lại không có hành động cần thiết. Follow-up review recommendation: false (high patched: 1, medium patched: 0, low patched: 0; score 0).

Verification passed on Node `v24.21.0`:

- `pnpm --filter @passionedu/api prisma:generate`
- `pnpm --filter @passionedu/api test`
- `pnpm --filter @passionedu/admin-web test`
- `set -a && . apps/api/.env && set +a && pnpm --filter @passionedu/api test:integration` -- 6 files, 35 tests.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- `git diff --check`

Residual risks: không có finding high/medium từ final review.

## Review Triage Log

### 2026-09-17 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 1, medium 0, low 0)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high] [patch]` Chuyển Class DTO cho create/rename/list sang JSON-safe timestamps để Operation outcome không ghi Prisma `Date` vào cột JSON.

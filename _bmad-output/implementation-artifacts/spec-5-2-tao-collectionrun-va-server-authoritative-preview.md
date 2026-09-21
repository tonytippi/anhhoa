---
title: 'Story 5.2: Tạo CollectionRun và server-authoritative preview'
type: 'feature'
created: '2026-09-21'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: '0516c039bbb87952f1b3b6b28b5961c4987209d6'
baseline_commit: '0516c039bbb87952f1b3b6b28b5961c4987209d6'
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-21-manual-invoice-mvp.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Finance chưa có CollectionRun School-scoped để chọn Student, kiểm tra eligibility trước khi tạo Invoice DRAFT, hoặc bảo toàn một preview do server làm nguồn chân lý.

**Approach:** Xây dựng CollectionRun `MONTHLY` theo SchoolYear với selection chỉ sửa ở DRAFT, preview dùng policy roster dùng chung với generate sau này, lifecycle có kiểm soát, Operation/audit cho thay đổi durable, và workspace Admin hiển thị đúng dữ liệu server trả.

## Boundaries & Constraints

**Always:** API tái xác thực `FINANCE_MANAGE` cùng School trong transaction; `billingMonth` là `YYYY-MM`, thuộc SchoolYear và unique theo `(schoolId, schoolYearId, billingMonth)`; selection eligibility chỉ là enrollment `ENROLLED` có Class `ACTIVE` tại ngày đầu `billingMonth` trong khoảng SchoolYear, dùng assignment effective-dated `[effectiveFrom, effectiveTo)`; preview và generate phải gọi cùng một policy; UI không tự suy luận eligibility/skips/fee/total. Mutation durable cần origin/CSRF, UUID idempotency, School-scoped Operation và audit; preview chỉ cần origin/CSRF vì không ghi durable state.

**Block If:** Canonical contract thay đổi lifecycle CollectionRun, capability `FINANCE_MANAGE`, hoặc Finance Admin MVP trước implementation.

**Never:** Không tạo Invoice, Invoice line, ChargeRule, selection fee/total, service enrollment, promotion, leave adjustment, settlement, Parent/Teacher API; không cập nhật selection ngoài DRAFT hoặc tin School/Student/preview fingerprint từ client làm authorization evidence.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mở run tháng hợp lệ | Finance actor, SchoolYear cùng School, `2026-09` | Tạo hoặc trả lại DRAFT run duy nhất, audit/Operation và DTO School/period | Không lỗi |
| Lưu selection DRAFT | UUID Student cùng SchoolYear, set không rỗng | Canonicalize/dedupe IDs, persist selection và trả version mới | Student foreign/không hợp lệ bị từ chối trước write |
| Preview authoritative | DRAFT selection có enrollment ENROLLED + Class ACTIVE và các record không đủ điều kiện | Trả eligible rows và categorized skips từ policy server, fingerprint bao gồm server facts | Không có fee, total hoặc client classification |
| Preview stale/state đổi | Roster, selection, SchoolYear hoặc run đổi sau preview | READY/accept-preview từ chối fingerprint cũ; UI giữ lỗi và quay về edit/refresh | `PREVIEW_STALE`/state conflict, không partial write |
| Retry hoặc concurrent open | Cùng idempotency key/fingerprint hoặc hai lệnh mở cùng tháng | Replay cùng outcome; DB chỉ có một run tháng | Key/fingerprint khác conflict, unique race đọc lại cùng School |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- thêm CollectionRun, lifecycle/selection rows, quan hệ composite School/SchoolYear/Student và reverse relations; chưa có aggregate Finance này.
- `apps/api/prisma/migrations/20260921000002_finance_receivable_catalog/migration.sql` -- mẫu migration Finance cho `BIGINT`, enum, audit relation và tenant composite graph; migration mới cần unique tháng và FK/check constraint.
- `apps/api/src/modules/finance/finance.service.ts` -- tái dùng `actor`, `mutate`, `operation`, `audit`, `requestFingerprint` và reauthorization; đặt shared selection policy, month parsing, lifecycle và read DTO tại đây.
- `apps/api/src/modules/finance/finance.controller.ts` -- thêm read/open/edit/preview/ready routes dưới prefix Finance; dùng guard origin + double-submit CSRF hiện có, idempotency headers cho command durable.
- `apps/api/src/modules/roster/roster.service.ts` -- nguồn semantics enrollment/Class effective-dated; theo lock order SchoolYear của `lockYear` và mẫu server preview `transitionPreview`, không export client-side policy.
- `apps/api/src/modules/authorization/authorization.service.ts` -- `resolve(..., 'FINANCE_MANAGE')` là authority phải dùng lại, không suy quyền từ role name.
- `apps/api/src/integration/finance.integration.test.ts` -- mở rộng fixture Finance bằng SchoolYear/Class/Student/Enrollment và dọn CollectionRun trước roster graph.
- `apps/web/src/finance/finance-workspace.tsx` -- mở rộng catalog workspace thành run list/detail, DRAFT selection, preview server và accessible lifecycle flow; tái dùng fetch CSRF, error summary và Operation reconciliation.
- `apps/web/src/finance/finance-workspace.test.tsx` -- bổ sung test render preview/skips, stale error, dirty selection và reconcile behavior.
- `apps/web/src/school-context.tsx` -- Finance switch guard hiện chỉ chặn `pending`; chặn thêm selection `dirty` để không lộ/mất state School cũ.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma`, migration Finance mới -- thêm CollectionRun `MONTHLY`, selection rows, enum lifecycle và DB tenant/unique/month constraints -- bảo toàn SchoolYear boundary và chống duplicate.
- `apps/api/src/modules/finance/finance.service.ts`, `finance.controller.ts` -- triển khai list/detail, open-or-return DRAFT, thay selection, server preview và DRAFT-to-READY acceptance bằng shared selection policy, transaction/lock, audit, Operation/idempotency -- API sở hữu toàn bộ state và stale validation.
- `apps/api/src/integration/finance.integration.test.ts`, Finance unit/controller tests -- chứng minh composite tenant graph, month validation/unique/concurrency, lifecycle, shared eligibility/skips, stale fingerprint, revoke, CSRF/idempotency/Operation và 1.000-row preview trong 3 giây -- release proof PostgreSQL.
- `apps/web/src/finance/finance-workspace.tsx`, `finance-workspace.test.tsx`, `apps/web/src/school-context.tsx` -- thêm run list/detail + keyboard-accessible stepper, visible School/period, server preview/error/reconciliation, dirty switch guard và stale-response clear -- không tính local eligibility.

**Acceptance Criteria:**
- Given Finance-authorized actor mở `MONTHLY` run trong selected SchoolYear, when lưu DRAFT hoặc yêu cầu existing billing month, then API chỉ tạo/trả một run `YYYY-MM` cùng SchoolYear và UI đi vào run hiện có.
- Given DRAFT run có Student selection, when server preview hoặc chuyển READY, then chỉ Student `ENROLLED` với Class `ACTIVE` tại first-of-month được eligible; response nêu categorized skip và không nhận client eligibility, charge hoặc total.
- Given roster/class/enrollment, selection, SchoolYear hoặc run state đổi sau preview, when client dùng fingerprint cũ để ready/generate handoff, then server từ chối stale/state conflict không ghi partial state và UI giữ ngữ cảnh để preview lại.
- Given run không còn DRAFT, actor khác School hoặc capability bị revoke, when đọc/sửa/preview/reconcile, then server không lộ graph ngoài School, từ chối selection mutation và Operation chỉ đọc được trong actor context đã tạo.
- Given retry/concurrent open hoặc selection command, when key/fingerprint hợp lệ lặp lại, then outcome/Operation được replay không duplicate run, selection transition hay audit; changed reuse bị conflict.
- Given Finance chỉnh selection rồi đổi School, when form dirty hoặc mutation chưa chắc chắn, then switch guard giữ form hoặc yêu cầu reconciliation; state/response School cũ không render trong context mới.

## Design Notes

`asOfDate` của run là ngày đầu `billingMonth` theo `Asia/Ho_Chi_Minh`, và phải thuộc `[SchoolYear.startsOn, SchoolYear.endsOn)`. Policy đọc lifecycle enrollment và class assignment effective-dated tại thời điểm đó. Đây là version server-derived của preview; Story 5.3 gọi chính hàm đó lại trong transaction khi generate rồi snapshot kết quả, không tin dữ liệu preview trình duyệt giữ.

Chuyển `DRAFT -> READY` nhận `previewFingerprint` server trả. Fingerprint canonicalize selection (sort/dedupe UUID) và bao gồm run version, as-of roster/class facts cùng state SchoolYear, vì vậy thay đổi server sau preview luôn buộc refresh thay vì phát hành từ preview cũ.

## Review Triage Log

### 2026-09-21 - Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 12 (high 5, medium 6, low 1)
- defer: 0
- reject: 4
- addressed_findings:
  - `[high] [patch]` Eligibility dùng interval enrollment effective-dated, class assignment deterministic và fingerprint chứa source/interval để preview cũ không thể chuyển READY sau thay đổi roster.
  - `[high] [patch]` Bổ sung append-only `CollectionRunLifecycleTransition` cho DRAFT/READY với actor, membership, Operation, previous status và sequence.
  - `[high] [patch]` Sửa reconciliation UI: bounded polling, cleanup khi unmount/đổi School, network failure được reconcile, và mọi async result có guard School/request hiện hành.
  - `[medium] [patch]` Khôi phục toàn bộ catalog Story 5.1 trong workspace, thay UUID textarea bằng candidate table server-authorized, và render skip với định danh tối thiểu/lý do thân thiện.
  - `[medium] [patch]` Khóa SchoolYear/run theo transaction, từ chối năm đã đóng và xử lý unique race mở run bằng cách đọc lại run cùng School.
  - `[medium] [patch]` Bổ sung regression tests temporal/stale/lifecycle/UI và PostgreSQL matrix test cho open, selection, preview, tenant isolation, idempotency và fixture 1.000 Student.

## Auto Run Result

Status: done

Baseline revision: `0516c039bbb87952f1b3b6b28b5961c4987209d6`.

Summary: Đã triển khai CollectionRun `MONTHLY` School-scoped, selection DRAFT, preview server-authoritative dùng roster effective-dated, preview fingerprint/stale protection, lifecycle history DRAFT/READY, API mutation protections, Finance Admin workspace, dirty School switch guard và test coverage.

Files changed:
- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260921000003_collection_run_preview/migration.sql`, `apps/api/prisma/migrations/20260921000004_collection_run_lifecycle_history/migration.sql` - CollectionRun tenant graph, lifecycle và database constraints.
- `apps/api/src/modules/finance/finance.service.ts`, `apps/api/src/modules/finance/finance.controller.ts` - CollectionRun API, authorization, selection/preview/READY, idempotency, audit và Operations.
- `apps/api/src/integration/finance.integration.test.ts` - PostgreSQL acceptance coverage, đang chờ database migration history tương thích.
- `apps/web/src/finance/finance-workspace.tsx`, `apps/web/src/finance/finance-workspace.test.tsx`, `apps/web/src/school-context.tsx` - workspace Admin, preview/reconciliation guards và dirty switch protection.

Review findings: 12 patches applied (high 5, medium 6, low 1); 0 deferred; 4 rejected. Follow-up review recommendation: true (score 19).

Verification performed:
- `pnpm --filter @passionedu/api test` - pass, 15 files / 75 tests.
- `pnpm --filter @passionedu/admin-web test` - pass, 7 files / 61 tests.
- `pnpm typecheck && pnpm test` - pass, 7 Turbo tasks.
- `git diff --check` - pass.
- Reset schema `public` của database integration từ `apps/api/.env`, deploy 31 migrations hiện hành và chạy seed - pass.
- `set -a && source .env && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm test:integration` from `apps/api` - pass, 8 files / 69 PostgreSQL integration tests.

Residual risks: Controller origin/CSRF remains protected by shared controller guard conventions; direct Finance database suite does not independently exercise the HTTP guard.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test` -- expected: Finance unit/controller và regression API pass.
- `set -a && source .env && set +a && TARGET_INTEGRATION_DATABASE_URL="${TARGET_INTEGRATION_DATABASE_URL:-$DATABASE_URL}" pnpm test:integration` -- expected: chạy từ `apps/api`; migration mới deploy và Finance PostgreSQL integration pass dùng `.env` cục bộ.
- `pnpm --filter @passionedu/admin-web test` -- expected: Finance workspace và School switch tests pass.
- `pnpm typecheck && pnpm test` -- expected: workspace typecheck/test pass.
- `git diff --check` -- expected: không có whitespace error.

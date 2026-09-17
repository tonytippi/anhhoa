---
title: 'Story 2.2: Tạo học sinh và enrollment có vòng đời bảo toàn lịch sử'
type: 'feature'
created: '2026-09-17'
status: 'done'
baseline_revision: '6ff2982204f3e08f7ac09a79b16a9979e43164f9'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-story-2-1-minimal-roster-2026-09-17.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-story-2-1-review-2026-08-19.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** School Admin đã có SchoolYear và Class nhưng chưa thể tạo hồ sơ Student cùng enrollment có lịch sử để các domain sau chỉ dùng trẻ đủ điều kiện do server xác định.

**Approach:** Mở rộng roster-owned graph, REST API và Admin Danh bộ để tạo/xem Student, enrollment/history/lifecycle, đồng thời hoàn tất Class archive và `activeStudentCount` với transaction-safe invariant.

## Boundaries & Constraints

**Always:** Resolve active School Admin `ROSTER_MANAGE` trước aggregate lookup; School là tenant root cho query, unique, audit và Operation. Ops provisioning bắt buộc nhận `studentCodePrefix` hợp lệ và School không có default prefix. Cookie mutation dùng exact Origin, double-submit CSRF, UUID `Idempotency-Key`/`X-Operation-Id`, replay identical command và reconcile sau timeout. Server sinh immutable, never-reused `studentCode` từ prefix đã persist và sequence School-scoped, unique case-insensitively; client không gửi code. Student có `fullName` và `dateOfBirth`; enrollment gắn Student, SchoolYear, Class cùng School, lưu `effectiveFrom`, optional `endedOn`, lifecycle và snapshot class/SchoolYear as-of. Chỉ nhận `TRIAL`, `WAITING_FOR_CLASS`, `SCHEDULED_TO_START`, `ENROLLED`, `ON_LEAVE`, `WITHDRAWN`, `GRADUATED`; interval là `[effectiveFrom, endedOn)` theo `Asia/Ho_Chi_Minh`, một Student tối đa một enrollment mỗi SchoolYear, không hard-delete. Class DTO trả `activeStudentCount`; archive idempotent, archived Class read-only, và archive/gán hoặc kích hoạt `ENROLLED` phải lock/revalidate cùng Class để không có Student `ENROLLED` trong Class archived.

**Block If:** PostgreSQL migration hoặc patterns đang có không thể express additive tenant graph, immutable code, lifecycle retention, hoặc archive/assignment serialization mà không phá approved contract.

**Never:** Không thêm Parent link/binding, class/year transfer wizard, Finance/attendance eligibility endpoint, manual/import/edit studentCode, client-calculated eligibility, raw DB errors, optimistic records/lifecycle, hoặc auto-replay mutation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tạo Student enrollment | Admin, SchoolYear/Class active cùng School, profile và interval hợp lệ | Server tạo Student, code `S<sequence>`, enrollment/history, audit và completed Operation | Không lỗi; DTO JSON-safe do server xác nhận |
| Lifecycle/interval không hợp lệ | Code client gửi, lifecycle lạ, `endedOn <= effectiveFrom`, Class/Year foreign hoặc archived Class khi `ENROLLED` | Không có Student/enrollment/Operation hợp lệ bị ghi | Validation hoặc not-found/denied chuẩn, `fieldErrors` đúng input |
| Lịch sử và unique | Student đã có enrollment cùng SchoolYear hoặc enrollment đã kết thúc | Từ chối enrollment trùng; record cũ và audit vẫn đọc được, không hard-delete | Conflict ổn định, không lộ tenant khác |
| Archive Class | Class active có enrollment `ENROLLED`; hoặc Class đã archived | Cùng transaction đếm active, chặn với `CLASS_HAS_ACTIVE_STUDENTS`; archive lặp trả resource hiện tại | Payload chứa `activeStudentCount`; archived Class từ chối rename/gán/kích hoạt |
| Timeout/retry | Kết quả mutation không chắc chắn | Portal giữ input, lưu Operation và chỉ reconcile trước submit khác | Không POST lại tự động |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- thêm `School.studentCodePrefix`, Student, StudentEnrollment, lifecycle/Class archived enum và composite tenant relations từ `School`/`SchoolYear`/`Class`.
- `apps/api/prisma/migrations/` -- migration PostgreSQL additive cho case-insensitive School code, unique enrollment SchoolYear, interval check, history snapshot và graph constraints.
- `apps/api/src/modules/roster/roster.service.ts` -- owner hiện hữu: tái dùng `actor()`, `mutate()`, `auditData()` và thêm DTO/query/command/lifecycle/archive cùng lock-revalidation.
- `apps/api/src/modules/roster/roster.controller.ts` -- giữ base REST route, `assertCookieMutation()` và header contract cho Student/enrollment/archive surface.
- `apps/api/src/modules/schools/*` -- bổ sung `studentCodePrefix` bắt buộc vào Ops provisioning DTO, validation, Operation outcome và School response phù hợp.
- `apps/api/src/modules/common/mutation-protection.ts` -- reuse fingerprint, Origin và CSRF protection; không tự cài lại.
- `apps/api/src/modules/memberships/memberships.service.ts` -- operation reconciliation actor-context-only đang được Admin roster UI dùng; giữ route/semantics này.
- `apps/api/src/integration/roster.integration.test.ts` -- PostgreSQL proof, đồng thời mở rộng cleanup thứ tự dependent graph.
- `apps/web/src/roster/roster-workspace.tsx` -- mở rộng state-safe workspace: Student form/list/history/lifecycle/archive, field errors, server-only outcome và existing pending reconciliation.
- `apps/web/src/roster/roster-workspace.test.tsx` -- baseline UI test cho input retention, focus, no optimistic/replay và stale School response.
- `apps/web/src/school-context.tsx` -- chỉ reuse existing dirty/pending School-switch guard.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma`, migration mới, và `apps/api/src/modules/schools/*` -- persist and require `studentCodePrefix` at School provisioning, then persist Student/enrollment tenant graph, lifecycle, immutable generated code, historical snapshot và Class archived invariant -- database phải là source enforcement.
- `apps/api/src/modules/roster/roster.service.ts` và `roster.controller.ts` -- thêm server-authoritative Student/enrollment read/create/lifecycle/history, paginated class Student query và Class archive -- share authorization, idempotency, audit and operation patterns.
- `apps/api/src/integration/roster.integration.test.ts` -- prove School-scoped code/enrollment uniqueness, foreign graph denial, lifecycle/interval validation and retention, archive idempotency/block and archive-versus-enrolled concurrency -- cover database behavior beyond mocks.
- `apps/web/src/roster/roster-workspace.tsx`, `roster-workspace.test.tsx`, và CSS tối thiểu nếu cần -- render profile tách enrollment/history, lifecycle Vietnamese, accessible validation and server-confirmed archive/reconcile behavior -- avoid stale/optimistic client state.

**Acceptance Criteria:**
- Given valid active SchoolYear and Class in selected School, when School Admin creates Student enrollment, then server creates immutable School-unique case-insensitive generated code, temporal snapshot/history, audit and Operation scoped to resolved School.
- Given a duplicate SchoolYear enrollment, foreign/archived Class, invalid interval or unsupported lifecycle, when a command runs, then server rejects before durable write and UI preserves input with accessible field errors where applicable.
- Given a Student enrollment has been stopped or lifecycle changed, when roster is read later, then server exposes retained history/status only and browser does not infer attendance/CollectionRun eligibility.
- Given archive competes with an enrollment becoming `ENROLLED` or assignment to a Class, when transactions finish, then no `ENROLLED` enrollment points to an archived Class; a blocked archive returns stable `activeStudentCount` and an archived Class is read-only.
- Given a portal timeout or School switch, when response/reconciliation arrives, then it never creates a second mutation or displays data from a previous School.

## Design Notes

Use a School-local sequence protected by the existing School transaction lock so codes remain monotonic and never reused without introducing a client-controlled identifier. Keep `ENROLLED` as lifecycle data only; later attendance/finance services own their as-of eligibility projection. Snapshot SchoolYear/Class display facts at enrollment creation so later rename/archive cannot rewrite historical context.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: Prisma client generates from the additive roster schema.
- `pnpm --filter @passionedu/api test` -- expected: API tests pass.
- `pnpm --filter @passionedu/admin-web test` -- expected: roster workspace tests pass.
- `set -a && . apps/api/.env && set +a && pnpm --filter @passionedu/api test:integration` -- expected: clean PostgreSQL migration and roster invariant suite pass.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- expected: all workspace quality gates pass.
- `git diff --check` -- expected: no whitespace errors.

## Review Triage Log

### 2026-09-17 — Review pass
- intent_gap: 1: (high 1, medium 0, low 0)
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 15
- addressed_findings:
  - none

### 2026-09-17 — Final acceptance review
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 2, medium 1, low 0)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high] [patch]` Require a server-active SchoolYear and keep enrollment dates inside its half-open interval; persist an append-only lifecycle-transition history instead of overwriting history.
  - `[medium] [patch]` Reload selected-year classes and Students with a selection guard so stale prior-year rows cannot render under a new SchoolYear.
  - `[high] [patch]` Add tenant, mutation-protection, archive/create concurrency, direct database constraint, and lifecycle/archive UI verification for the new roster surface.

## Auto Run Result

Status: done

The clean-break target was confirmed. There are no pre-existing School rows to migrate, so `studentCodePrefix` remains required with no default and the blocked migration concern does not apply.

Implemented work retained in the worktree: School-scoped Student and StudentEnrollment graph, immutable generated student codes, lifecycle/history API, Class archive guard, required Ops provisioning prefix, Admin roster surfaces, and PostgreSQL-backed tests. The reviewed diff has not been reverted because it is useful pending the migration decision.

Implemented: required Ops provisioning `studentCodePrefix`; School-scoped generated Student codes; StudentEnrollment lifecycle and append-only transition history; server-active SchoolYear/date enforcement; tenant graph constraints; archive guard/concurrency protection; Admin roster create/history/lifecycle/archive UI; and selection-safe SchoolYear loading.

Files changed:

- `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/20260917000001_student_enrollment_history/migration.sql` -- roster graph, database constraints, generated-code configuration and lifecycle-transition history.
- `apps/api/src/modules/ops/*`, `apps/ops-web/src/ops-schools.*`, and seed/fixture files -- require, normalize and display the School prefix.
- `apps/api/src/modules/roster/*` and roster integration/controller tests -- server-authoritative roster API, authorization, audit, Operation, concurrency and mutation-protection proof.
- `apps/web/src/roster/*` -- accessible Admin lifecycle/archive UI, reconciliation and stale School/SchoolYear guards.

Review findings: final acceptance found no blocking issues after patches. Follow-up review recommendation: false (high patched: 2, medium patched: 1, low patched: 0; score 3).

Verification passed:

- `pnpm --filter @passionedu/api prisma:generate`
- `pnpm --filter @passionedu/api test`
- `pnpm --filter @passionedu/api typecheck`
- `pnpm --filter @passionedu/api build`
- `pnpm --filter @passionedu/admin-web test` -- 4 files, 26 tests.
- `pnpm --filter @passionedu/admin-web typecheck`
- `pnpm typecheck && pnpm build`
- clean PostgreSQL migration deploy, seed and `pnpm --filter @passionedu/api test:integration` -- 6 files, 42 tests.
- `git diff --check`

Residual risks: no high or medium findings remain. The temporary PostgreSQL target was rebuilt from zero before final integration verification to ensure the final migration, including lifecycle-transition tables and constraints, was actually applied.

---
title: 'Story 2.4: Quản lý Staff profile và phân công theo effective date'
type: 'feature'
created: '2026-09-18'
status: 'done'
baseline_revision: '0e6e733da259e4cf124f29983a9662d3d9ab2f9e'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/staff-assignments.html'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Danh bộ chưa có hồ sơ Staff hoặc lịch sử phân công lớp, nên School Admin không thể ghi nhận nhân sự mà vẫn giữ ranh giới rõ ràng giữa dữ liệu roster và quyền đăng nhập.

**Approach:** Bổ sung aggregate StaffProfile School-scoped và StaffClassAssignment temporal, rồi expose chúng qua roster API và Admin workspace với kết quả do server xác nhận, audit và Operation idempotent.

## Boundaries & Constraints

**Always:** Resolve `ROSTER_MANAGE` của School Admin trước mọi lookup; School là tenant root cho query, write, FK, audit và Operation. StaffProfile chỉ lưu `fullName`, `email`, `phone`, `dateOfBirth`, `gender`, `address`; không có password, identity, membership, role, HR/payroll hoặc phân loại giáo viên. Assignment thuộc Staff, SchoolYear và Class cùng School, dùng ngày business `Asia/Ho_Chi_Minh` với interval `[effectiveFrom, effectiveTo)`, reason bắt buộc, audit actor/reason/provenance, không overlap cùng Staff/Class và không hard-delete. Cookie mutation phải exact Origin, double-submit CSRF, UUID `Idempotency-Key`/`X-Operation-Id`, replay cùng fingerprint và reconcile sau timeout.

**Block If:** Migration PostgreSQL không thể bảo đảm composite tenant graph và temporal overlap invariant mà không làm yếu các contract roster đã duyệt.

**Never:** Không tạo Staff login/binding/capability/Teacher audience, không suy diễn quyền từ Staff profile hoặc assignment, không tạo current-assignment mutable field, không auto-replay mutation, không đưa dữ liệu HR/payroll hay operational Teacher authorization vào story.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Lưu Staff profile | School Admin và sáu trường profile hợp lệ | Profile School-scoped, audit và completed Operation do server trả về | Không tạo identity, membership, role hay record ngoài profile |
| Tạo/thay đổi/kết thúc assignment | Staff, active Class và SchoolYear cùng School; dates/reason hợp lệ | Lưu hoặc cập nhật interval lịch sử `[from,to)`, audit reason và trả DTO server-confirmed | Invalid date/reason, Class archived, graph foreign hoặc overlap trả validation/conflict ổn định, không có write thành công |
| Xem lịch sử | Assignment đã kết thúc hoặc SchoolYear không active | Danh bộ trả toàn bộ lịch sử theo School/SchoolYear, tách profile, assignment và access state | Không lộ record School khác hoặc suy ra access từ assignment |
| Timeout/switch context | Kết quả POST chưa rõ hoặc School/SchoolYear đổi khi request còn chờ | Browser chỉ reconcile Operation và bỏ response stale | Không POST lại, không render row của School/SchoolYear cũ |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `School`, `SchoolYear`, `Class` và StudentEnrollment đã có composite tenant graph; thêm StaffProfile/StaffClassAssignment relations và only-approved profile fields.
- `apps/api/prisma/migrations/20260917000001_student_enrollment_history/migration.sql` -- mẫu DATE snapshot/check, composite FK và historical indexes; migration mới tái dùng exclusion `daterange(..., '[)')` từ migration SchoolYear cho assignment overlap.
- `apps/api/src/modules/roster/roster.service.ts` -- owner roster: tái dùng `actor()`, `date()`, `year()`, `lockClass()`, `audit()` và `mutate()`; thêm DTO/read/command Staff, validation và stable overlap conflict.
- `apps/api/src/modules/roster/roster.controller.ts` -- giữ boundary roster app cùng `mutation()` cho Staff reads/writes; không tạo authorization surface mới.
- `apps/api/src/modules/roster/roster.controller.test.ts` -- bổ sung Staff POST vào proof Origin/CSRF/idempotency bị chặn trước service.
- `apps/api/src/integration/roster.integration.test.ts` -- fixture PostgreSQL và cleanup roster; mở rộng proof tenant graph, interval, history, audit và idempotency/concurrency.
- `apps/web/src/roster/roster-workspace.tsx` -- workspace đang có generation guard, field-error/focus, pending Operation reconciliation và School switch guard; thêm separate Staff profile/assignment state, forms and tables without optimistic state.
- `apps/web/src/roster/roster-workspace.test.tsx` -- test contract accessible roster UI, stale response và no-replay; mở rộng Staff profile/assignment coverage.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/staff-assignments.html` -- read-only UX evidence: profile, assignment history and access information must be distinct.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma` và migration PostgreSQL mới -- thêm StaffProfile/StaffClassAssignment với composite School graph, immutable SchoolYear display/date snapshot, interval check/exclusion and history indexes -- database chặn graph sai/overlap và present state không ghi đè history.
- `apps/api/src/modules/roster/roster.service.ts` và `roster.controller.ts` -- thêm School-scoped list/create/update profile plus list/create/change/end assignment -- tái dùng authorization, mutation protection, transaction, audit/Operation; validate six profile fields, active Class, SchoolYear interval/reason và map raw exclusion collision thành lỗi ổn định.
- `apps/api/src/modules/roster/roster.controller.test.ts` và `apps/api/src/integration/roster.integration.test.ts` -- test Cookie mutation boundary và PostgreSQL tenant/time history matrix -- chứng minh profile không tạo access artifacts, foreign graph/archived Class/invalid interval/reason/overlap fail, adjacent/different-Class intervals pass, closed-year history/audit/idempotency remain correct.
- `apps/web/src/roster/roster-workspace.tsx` và `roster-workspace.test.tsx` -- thêm accessible Staff profile and assignment surfaces với labels/caption/status tiếng Việt, field errors/input retention, active-Class select và reconciliation/stale guards -- UI tách Staff record, assignment history, login/role state và chỉ cập nhật sau server confirmation.

**Acceptance Criteria:**
- Given an authorized School Admin in a selected School, when a valid Staff profile is created or updated, then only the approved six roster fields persist in that School with audit/Operation and no login, password, membership, role, HR/payroll or teacher-type artifact exists.
- Given Staff, SchoolYear and active Class belong to the resolved School, when the Admin creates, changes or ends an assignment with a reason, then the server persists/revises `[effectiveFrom,effectiveTo)` under `Asia/Ho_Chi_Minh`, audits actor/reason and rejects foreign graph, archived Class, invalid SchoolYear date, invalid reason or same Staff/Class overlap before durable success.
- Given adjacent intervals or concurrent assignments for one Staff to distinct Classes, when they are persisted, then adjacent intervals and distinct-Class assignments remain valid while only overlapping same-Class rows are rejected.
- Given an assignment is ended or its SchoolYear is no longer active, when Admin reads the roster later, then original assignment history remains readable and no current-state field replaces it.
- Given a Staff form has server validation errors, a mutation times out, or School/SchoolYear changes during a request, when the UI responds, then it retains input and focuses accessible errors, reconciles the saved Operation without replay, and never renders stale prior-context Staff data.

## Spec Change Log

## Review Triage Log

### 2026-09-18 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 8: (high 2, medium 5, low 1)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high] [patch]` Bảo vệ lịch sử assignment đã kết thúc, tách `endReason`, chặn archive Class còn phân công mở và bổ sung tenant/temporal proof PostgreSQL.
  - `[medium] [patch]` Thay prompt kết thúc bằng dialog accessible có focus trap/restore, error retention và labels/action IDs riêng.
  - `[medium] [patch]` Bổ sung proof update/change/end, race overlap, direct composite-FK graph, closed-year history, Staff/assignment timeout no-replay và stale School/SchoolYear response.

## Design Notes

Persist SchoolYear name and date bounds on each assignment, matching enrollment's historical snapshot strategy. Staff name is projected from the current StaffProfile rather than snapshot. Assignment change updates only an open historical row after revalidating the full temporal graph; `effectiveTo` is read-only outside the end command. Ending sets its exclusive `effectiveTo` and separate `endReason` while retaining the original `reason`, so a later assignment can begin on that same date without overlap. An archived Class cannot retain an open-ended StaffClassAssignment; correcting a completed end is a future workflow outside this story.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: Prisma client generates from Staff roster schema.
- `pnpm --filter @passionedu/api test` -- expected: roster controller/unit suites pass.
- `pnpm --filter @passionedu/admin-web test` -- expected: accessible Staff roster UI tests pass.
- `set -a && . apps/api/.env && set +a && pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL Staff tenant/temporal invariant suite passes when target database is configured.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- expected: workspace quality gates pass.
- `git diff --check` -- expected: no whitespace errors.

## Auto Run Result

Status: done

Đã triển khai StaffProfile School-scoped và StaffClassAssignment effective-dated, bao gồm composite tenant graph, PostgreSQL exclusion constraint, API roster có authorization/audit/Operation idempotent và Admin workspace tách profile, assignment, access state. Assignment đã kết thúc chỉ đọc; `endReason` riêng giữ nguyên lý do phân công gốc; archive Class bị chặn khi còn phân công mở.

Files changed:

- `apps/api/prisma/schema.prisma` và hai migration Staff -- aggregate, tenant FK, interval/exclusion invariant và `endReason`.
- `apps/api/src/modules/roster/*` -- REST commands/reads, validation, audit, Operation và archive guard.
- `apps/api/src/integration/roster.integration.test.ts` -- PostgreSQL tenant, graph, history, conflict, concurrency và replay proofs.
- `apps/web/src/roster/*` -- accessible Staff and assignment management, dialog end assignment, reconciliation and stale guards.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- tracker Story 2.4.

Review findings: 8 patches applied (high 2, medium 5, low 1); deferred 0; rejected 0. Follow-up review recommendation: true (2 high patches).

Verification passed:

- `pnpm --filter @passionedu/api prisma:generate`
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- `set -a && . apps/api/.env && set +a && pnpm --filter @passionedu/api test:integration` -- 6 files, 50 tests.
- `pnpm --filter @passionedu/admin-web test` -- 4 files, 36 tests.
- `git diff --check`

Finalization completed after the unrelated `compose.yaml` was removed from the worktree.

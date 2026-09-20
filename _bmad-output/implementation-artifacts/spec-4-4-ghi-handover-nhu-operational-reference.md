---
title: 'Ghi handover như operational reference'
type: 'feature'
created: '2026-09-20'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'bd73edec48a8e862f5bd4c0c59b41e1d50024343'
followup_review_recommended: true
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
  - '_bmad-output/implementation-artifacts/decision-handover-photo-evidence-2026-09-14.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Teacher chưa có surface server-authoritative để ghi giờ trả trẻ và evidence theo `HandoverPolicy`. Vì vậy School không có operational reference an toàn, auditable và tenant-isolated cho handover.

**Approach:** Mở rộng attendance domain với `HandoverRecord` School-scoped, protected handover evidence và notification source idempotent; thêm Teacher workspace chỉ cho Staff có `HANDOVER_WRITE` ghi nhận Students đủ enrollment trong School.

## Boundaries & Constraints

**Always:** Mỗi request re-authorize active School, membership, StaffProfile, audited binding, primary Position ACTIVE và `HANDOVER_WRITE`; handover không yêu cầu `StaffClassAssignment`. Validate Student `ENROLLED`, requested date, effective `HandoverPolicy`, evidence ownership/claim và duplicate trước durable write. Mutations dùng origin/CSRF, UUID idempotency/Operation, audit và reconcile actor-scoped. Evidence là opaque, không public URL; Teacher có `HANDOVER_WRITE` hoặc same-School School Admin có `SETTINGS_MANAGE` mới đọc được. Sau đúng hai tháng lịch `Asia/Ho_Chi_Minh`, xóa blob/preview nhưng giữ handle, handover, deletion audit và source event. Handover event chỉ chứa School, Student, date và confirmed `pickedUpAt`.

**Block If:** PostgreSQL không thể enforce School-scoped relationship/unique record hoặc existing protected-media boundary không thể mở rộng mà không lộ media locator.

**Never:** Không yêu cầu/suy diễn Class assignment, không tạo pickup authorization, late-pickup fee hay Admin mutation surface; không Parent route/projection/delivery/cache; không hard-delete operational/audit evidence facts; không đổi attendance authorization hoặc sử dụng browser-selected School/role name làm authorization.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Confirm handover | Active same-School bound Staff has `HANDOVER_WRITE`; enrolled Student, valid day/policy | Persist one handover reference, audit and one notification source; Class assignment is not read | No error expected |
| Required evidence | Effective HandoverPolicy is `REQUIRED` without a valid uploaded evidence handle | Do not confirm `pickedUpAt` or create an event | Field validation for `evidenceId` |
| Duplicate/replay | Same logical Student/date is submitted twice, or same idempotency key is replayed | A different handover is rejected; identical operation replay returns original outcome without duplicate audit/event | Conflict for existing record or changed fingerprint |
| Tenant/revocation/evidence read | Foreign Student/evidence or inactive/revoked Staff/Position/binding; Parent reads media | Deny before record/media access; authorized same-School handover Staff/Admin may stream available bytes | Capability/not-found boundary; expired evidence returns `Tệp bằng chứng đã hết hạn` |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- current School-scoped `EvidenceReference`, attendance-only source event and versioned `HandoverPolicy`; add handover fact/relations and typed source fields without weakening existing attendance integrity.
- `apps/api/prisma/migrations/20260920000001_evidence_lifecycle_notification_source/migration.sql` -- source pattern for the forward-only PostgreSQL migration, composite FKs and enrollment trigger style.
- `apps/api/src/modules/attendance/attendance.service.ts` -- reuse `mutate`, retention cleanup, audit and protected media; add School-wide handover actor/facts/mutation/upload/read and source write.
- `apps/api/src/modules/attendance/attendance.controller.ts` and `apps/api/src/main.ts` -- retain audience, origin/CSRF and bounded raw upload adapters; expose Teacher-only handover endpoints and app read only.
- `apps/api/src/modules/authorization/authorization.service.ts` -- `HANDOVER_WRITE` catalog/audience navigation contract.
- `apps/teacher-web/src/school-context.tsx` and `apps/teacher-web/src/attendance/attendance-workspace.tsx` -- existing conditional server navigation, dirty guard, validation and timeout reconciliation patterns to reuse for a standalone handover workspace.
- `apps/api/src/modules/attendance/attendance.service.test.ts`, `apps/api/src/integration/attendance.integration.test.ts`, `apps/teacher-web/src/school-context.test.tsx` -- extend unit, PostgreSQL and portal contract proof.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` and a new forward-only Prisma migration -- add School-scoped `HandoverRecord`, evidence relation/claim fields, typed handover notification source and DB enrollment/unique constraints.
- [x] `apps/api/src/modules/attendance/attendance.service.ts` -- implement reauthorized School-wide handover roster, evidence upload/read, record/reconciliation and retention-compatible source/audit transaction.
- [x] `apps/api/src/modules/attendance/attendance.controller.ts` and `apps/api/src/main.ts` -- add protected Teacher handover adapters and bounded raw upload path; retain no-store/nosniff media responses.
- [x] `apps/api/src/modules/authorization/authorization.service.ts` -- expose handover navigation only from server-resolved `HANDOVER_WRITE` capability.
- [x] `apps/teacher-web/src/handover/handover-workspace.tsx` and `apps/teacher-web/src/school-context.tsx` -- provide mobile-first School-visible handover operational-reference workspace with protected upload, errors, dirty guard and Operation reconciliation.
- [x] `apps/api/src/modules/attendance/attendance.service.test.ts`, `apps/api/src/integration/attendance.integration.test.ts`, `apps/teacher-web/src/*.test.tsx` -- cover matrix behavior, no-class exception, cross-School/revoke denial, event payload, expiry and UI route contract.

**Acceptance Criteria:**
- Given an active bound StaffProfile with active Position `HANDOVER_WRITE` in the selected School, when it confirms picked-up time for an enrolled Student/date, then the API requires no Class assignment and records an auditable School-scoped operational reference.
- Given a confirmed handover, when it succeeds or is identically replayed, then exactly one logical notification source exists with the confirmed picked-up time and no evidence, class, Staff or internal fields.
- Given a policy requires evidence, when valid evidence is absent, then the server makes no handover write; given successful confirmation plus two HCM calendar months, it removes bytes once while retaining all durable facts.
- Given a foreign School ID, foreign Student/evidence or inactive/revoked membership/binding/Position, when a handover action or protected read occurs, then the server denies before record/media access and no Parent endpoint exists.
- Given a Teacher can use handover, when opening the Teacher portal, then server navigation exposes a School-wide operational-reference workspace without Class selection or fee affordances and reconciles uncertain writes by Operation.

## Design Notes

`HandoverRecord` is immutable for the Student/date after confirmation: a second independent mutation is an already-recorded conflict, while same-key idempotent replay returns the durable outcome. This prevents accidental alteration of a confirmed operational reference while retaining explicit correction as a future scoped decision.

## Review Triage Log

### 2026-09-20 -- Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 12 (high 3, medium 7, low 2)
- defer: 0
- reject: 9
- addressed_findings:
  - `[high]` `[patch]` Teacher workspace now uploads protected JPEG/PNG/WebP evidence and submits only the opaque server-returned ID, making `REQUIRED` policy usable.
  - `[high]` `[patch]` PostgreSQL integration now proves School-wide no-Class authorization, replay/duplicate behavior, minimal source payload, foreign Student denial, required evidence and restrictive FK cleanup.
  - `[high]` `[patch]` Handover evidence is readable through a distinct same-School app-admin route without broadening attendance-evidence access.
  - `[medium]` `[patch]` API validates HCM business date, future timestamp and operating day; roster ordering is deterministic.
  - `[medium]` `[patch]` Notification source CHECK constraint and handover-evidence index preserve durable source shape and lookup performance.
  - `[medium]` `[patch]` Date changes clear stale portal state; the editable picked-up time uses School timezone rendering, error focus and upload/reconciliation tests.

## Auto Run Result

Status: done

Summary: Đã thêm handover School-wide như operational reference cho Teacher có `HANDOVER_WRITE`, không cần Class assignment. API giữ authorization server-side, enrollment/policy/evidence validation, idempotency Operation, audit, evidence retention hai tháng lịch HCM và notification source tối thiểu. Teacher portal có upload evidence protected, giờ trả trẻ chỉnh sửa được, error/reconciliation/dirty-state handling và không có pickup authorization hoặc fee UI.

Files changed:
- `apps/api/prisma/schema.prisma` -- thêm HandoverRecord, evidence/source relations và tenant integrity.
- `apps/api/prisma/migrations/20260920000002_handover_operational_reference/migration.sql` -- migration forward-only cho handover, trigger, indexes và source event CHECK constraint.
- `apps/api/src/modules/attendance/attendance.service.ts` -- handover roster/write/evidence/read/operation boundary, policy-calendar-time validation và audit/source writes.
- `apps/api/src/modules/attendance/attendance.controller.ts` và `apps/api/src/main.ts` -- Teacher/Admin protected adapters và bounded raw upload route.
- `apps/api/src/modules/authorization/authorization.service.ts` -- server navigation cho `HANDOVER_WRITE`.
- `apps/teacher-web/src/handover/handover-workspace.tsx` và `apps/teacher-web/src/school-context.tsx` -- Teacher handover operational-reference workspace.
- `apps/api/src/modules/attendance/attendance.service.test.ts`, `apps/api/src/integration/attendance.integration.test.ts`, `apps/teacher-web/src/handover/handover-workspace.test.tsx`, `apps/teacher-web/src/school-context.test.tsx` -- service, PostgreSQL and portal contract coverage.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Story 4.4 marked done.

Review: 12 patches applied (3 high, 7 medium, 2 low); 0 deferred; 9 rejected. Follow-up review recommendation: true (score 23).

Verification:
- `pnpm --filter @passionedu/api prisma:generate` -- pass.
- `pnpm --filter @passionedu/api typecheck` -- pass.
- `pnpm --filter @passionedu/api test` -- pass, 13 files and 66 tests.
- `pnpm --filter @passionedu/teacher-web typecheck` -- pass.
- `pnpm --filter @passionedu/teacher-web test` -- pass, 4 files and 7 tests.
- `set -a; source apps/api/.env; set +a; pnpm --filter @passionedu/api test:integration` -- pass, PostgreSQL `anhhoa_test`, 7 files and 56 tests. Migration was already applied cleanly; reset was not necessary.
- `git diff --check` -- pass.

Residual risks: Parent notification projection/delivery and Finance use of the handover reference are intentionally owned by later stories. A separate follow-up review is recommended because the first review surfaced multiple high-impact gaps that were corrected in this run.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- Prisma client succeeds.
- `pnpm --filter @passionedu/api typecheck` and `pnpm --filter @passionedu/api test` -- API compiles and unit coverage passes.
- `pnpm --filter @passionedu/teacher-web typecheck` and `pnpm --filter @passionedu/teacher-web test` -- portal compiles and UI contracts pass.
- `set -a; source apps/api/.env; set +a; pnpm --filter @passionedu/api test:integration` -- approved PostgreSQL test database migrates and handover tenant/evidence/idempotency proofs pass.
- `git diff --check` -- no whitespace errors.

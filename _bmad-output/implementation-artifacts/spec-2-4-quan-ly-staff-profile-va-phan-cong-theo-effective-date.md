---
title: 'Story 2.4: Quản lý Staff, Chức danh và phân công theo capability/effective-date'
type: 'feature'
created: '2026-09-20'
status: 'done'
baseline_revision: 'a5cefc3bf011ee219354792ea1d2407382bbc429'
review_loop_iteration: 1
followup_review_recommended: true
context:
  - '../epic-2-context.md'
  - '../../planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '../../planning-artifacts/epics-passionedu.md'
  - '../../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/staff-assignments.html'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Staff authorization vẫn dựa vào `staffType` và preset `SchoolRoleGrant`, không thể biểu diễn chức danh School-configurable và trái clean-break contract AD-20. Điều này chặn các write attendance, daily journal, leave và handover được cấp quyền đúng tenant.

**Approach:** Thay một chiều các nguồn quyền cũ bằng `SchoolPosition` School-scoped, capability catalog giới hạn, primary Position và login binding audited trên StaffProfile. API resolve capability từ Staff ACTIVE, Position ACTIVE, binding ACTIVE và grant Position trên mỗi request; Admin quản lý Chức danh, Staff và phân công được server xác nhận.

## Boundaries & Constraints

**Always:** School scope toàn bộ Position, grant, Staff, binding, query, audit và Operation; capability catalog là code-owned, không nhận capability/name từ client; seed Hiệu trưởng, Quản lý trường, Kế toán, Giáo viên, Nhân viên tuyển sinh, Bếp, Y tế khi provision. Mỗi Staff ACTIVE có đúng một Position primary ACTIVE; binding same-School optional, tối đa một và active/audited. Position/capability/binding mutation dùng origin, CSRF, UUID idempotency, Operation reconciliation, transaction và reason. `CLASS_LEAVE_READ` chỉ có khi Position grant + assignment hiệu lực; `HANDOVER_WRITE` không cần assignment. Inactive/revoke Staff/Position/binding/grant từ chối request kế tiếp.

**Block If:** Migration không thể chuyển tất cả grant preset hiện hữu sang Position capability grants trong transaction mà vẫn loại bỏ `SchoolRoleGrant` và `staffType` làm authorization source.

**Never:** Không giữ dual authorization source, preset-role UI/API, StaffType/staffType, free-form capability/script, Position hard-delete, tự tạo membership/password/HR/payroll, hoặc dùng Position name/browser state làm bằng chứng quyền. Không thay đổi semantics nghiệp vụ leave ngoài thay authorization resolver.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Provision School | School mới với owner pending | Có bảy Position seed, owner Staff active, Position primary, binding audited và capability quản trị | Transaction rollback toàn bộ nếu seed/binding lỗi |
| Position mutation | Admin, catalog capability hợp lệ, reason và UUID | Create/rename/inactivate/grant tạo audit và completed Operation, replay cùng fingerprint | Capability ngoài catalog, foreign Position hoặc reused key khác fingerprint bị từ chối trước success |
| Staff mutation | Profile hợp lệ, Position active cùng School, binding membership active cùng School | Persist sáu field, status, Position primary và binding; không tạo identity/membership | Position/binding foreign hoặc inactive trả validation/conflict, không durable write |
| Operational resolver | Staff/Position/binding/grant active | Resolve capability theo Position, class capability còn yêu cầu assignment as-of | Staff/Position/binding inactive hoặc grant revoked bị từ chối request kế tiếp |
| Assignment | Staff active có Position class capability, Class/Year same School | Persist interval history và audit reason | Không có capability class, interval invalid, class foreign/archived/overlap bị từ chối |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- bỏ `StaffType`/`SchoolRoleGrant`, thêm SchoolPosition, PositionCapabilityGrant, primary Position và binding lifecycle composite tenant graph.
- `apps/api/prisma/migrations/` -- migration lịch sử hiện chứa StaffType và role grants; thêm migration one-way, tạo Position seeds/grants từ dữ liệu cũ, rồi drop source cũ.
- `apps/api/src/modules/authorization/authorization.service.ts` -- resolver hiện derive capability từ preset roles; thay bằng active Staff/Position/binding/grants, chooser/navigation capability-based.
- `apps/api/src/modules/ops/ops.service.ts` -- provision hiện tạo `SCHOOL_ADMIN` preset grant; seed Position, Staff và binding thay thế.
- `apps/api/src/modules/roster/roster.service.ts` -- owner Staff/assignment command; thay DTO/input/binding/assignment eligibility, thêm Position CRUD và audited mutations.
- `apps/api/src/modules/roster/roster.controller.ts` -- thêm REST Position endpoints, giữ cookie-mutation boundary.
- `apps/api/src/modules/attendance/attendance.service.ts` -- đổi teacher list và approver authorization sang Position capability resolver, giữ leave lifecycle.
- `apps/web/src/roster/roster-workspace.tsx` -- bề mặt roster hiện chỉ quản lý profile/assignment; thêm Position table/form capability catalog và Staff Position/binding state.
- `apps/api/src/integration/*.integration.test.ts`, `apps/api/src/modules/*/*.test.ts`, `apps/web/src/roster/roster-workspace.test.tsx` -- proof migration, tenant graph, revoke, idempotency, class-vs-school capability và accessible Admin workflow.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma` và migration mới -- model Position/grant/binding và migration one-way từ preset/staffType; composite graph, unique/lifecycle và no-dual-source enforcement.
- `apps/api/src/modules/authorization/authorization.service.ts`, `ops/ops.service.ts`, `roster/roster.service.ts`, `roster/roster.controller.ts` -- capability catalog, provisioning seed, Position/Staff/binding commands và server resolver.
- `apps/api/src/modules/attendance/attendance.service.ts` -- thay legacy teacher/approver checks bằng capability resolver với assignment only cho `CLASS_LEAVE_READ`.
- `apps/web/src/roster/roster-workspace.tsx` và test -- quản lý Chức danh Vietnamese, catalog grouped/labeled, Staff primary Position/binding, server confirmation, errors, switch/reconcile guards.
- `apps/api/src/**/*.test.ts` và `apps/api/src/integration/*.test.ts` -- cover mọi hàng Matrix, migration/revoke/cross-tenant/legacy-removal proof và authorization paths.

**Acceptance Criteria:**
- Given a newly provisioned School, when its first Admin accesses the app, then seven seeded SchoolPositions and a primary active Staff/binding exist and all access is derived from Position capabilities rather than role presets.
- Given a School Admin manages Positions and Staff, when mutations use permitted catalog capabilities, same-School active Position/binding and reason, then the API creates audited idempotent Operations and the Admin UI reflects only server-confirmed state.
- Given legacy role grants and staffType exist before migration, when migration completes, then effective capabilities are represented by Position grants, historical audit/Operation rows remain readable, and no schema/query/resolver accepts the legacy authorization source.
- Given a Staff or Position capability/binding is deactivated or revoked, when a protected route is requested next, then it is denied before domain lookup; class leave additionally requires an effective assignment, while handover authorization does not.
- Given an invalid Position, capability, binding, Class graph or assignment interval, when an Admin submits it, then no successful Operation or partial write is created and accessible field errors preserve entered input.

## Spec Change Log

### 2026-09-20 -- Rebased after review
- Trigger: prior spec implemented the obsolete roster-only contract and explicitly excluded authorization migration.
- Amendment: replaced it with canonical AD-20 one-way SchoolPosition capability contract.
- Avoids: retaining `staffType` and preset-role authorization after a claimed clean-break completion.
- KEEP: preserve existing Staff temporal history, composite tenant graph, cookie mutation protection, audited Operations, and no optimistic roster state.

## Review Triage Log

### 2026-09-20 -- Review pass
- intent_gap: 0
- bad_spec: 1: (high 1)
- patch: 0
- defer: 0
- reject: 0
- addressed_findings:
  - `[high] [bad_spec]` Rebased Story 2.4 from obsolete roster-only scope to canonical SchoolPosition clean-break contract.

### 2026-09-20 -- Implementation review
- intent_gap: 0
- bad_spec: 0
- patch: 7: (high 7)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high] [patch]` Re-authorized idempotency replay and restored actor-scoped Operation reconciliation after Position/binding/grant revoke.
  - `[high] [patch]` Made legacy migration deterministic, prevented capability escalation for ungranted Staff, and preserved the legacy School Admin precedence.
  - `[high] [patch]` Prevented removal of the final active bound `ROSTER_MANAGE` administrator and cleared stale Position state on School switch.

## Design Notes

`SchoolPosition` is configuration, not a role label. The one authorization resolver joins membership identity to its active bound StaffProfile, active primary Position and Position grants. Existing generic Operations/Audit preserve their historical snapshots; migration removes live legacy authorization inputs instead of translating them at read time.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: target schema generates.
- `pnpm --filter @passionedu/api test` -- expected: authorization, roster, Ops and attendance unit/controller suites pass.
- `pnpm --filter @passionedu/admin-web test` -- expected: accessible Position/Staff roster UI tests pass.
- `set -a && . apps/api/.env && set +a && pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL migration, tenant, revoke, class and idempotency proofs pass.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- expected: workspace gates pass.
- `git diff --check` -- expected: no whitespace errors.

## Auto Run Result

Status: done

Đã thay thế clean-break `StaffType`/preset `SchoolRoleGrant` bằng School-scoped `SchoolPosition` và capability catalog server-owned. Migration tạo bảy Position seed, chuyển grant legacy một chiều với mapping deterministic và không nâng quyền Staff không có grant. Runtime chỉ resolve capability từ active Staff, primary Position, active binding và Position grant.

Files changed:

- `apps/api/prisma/schema.prisma` và `apps/api/prisma/migrations/20260920000000_school_positions_capabilities/migration.sql` -- Position/grant graph, one-way migration và legacy-source removal.
- `apps/api/src/modules/authorization/*`, `ops/*`, `roster/*`, `settings/*`, `parents/*`, `attendance/*` -- active Position authorization, Operations reconciliation, Position lifecycle và class-capability checks.
- `apps/web/src/roster/*` -- accessible Position catalog, create/rename/grant/revoke/inactivate flows, Staff primary Position, stale-context and reconciliation guards.
- `apps/api/src/integration/*`, module tests và `apps/web/src/roster/roster-workspace.test.tsx` -- tenant/revoke/lockout/migration/UI proof.

Review findings: 7 high-severity patches applied; deferred 0; rejected 0. Follow-up review recommendation: true (7 high patches, score 7).

Verification passed:

- `pnpm --filter @passionedu/api prisma:generate`
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- `set -a && . apps/api/.env && set +a && pnpm --filter @passionedu/api test:integration` -- 7 files, 51 tests.
- `pnpm --filter @passionedu/admin-web test` -- 5 files, 52 tests.
- `git diff --check`

Residual risk: Staff login-binding selection intentionally remains server-validated input without a new membership-discovery endpoint; this avoids recreating a role-management surface. Existing binding changes remain audit/Operation-protected.

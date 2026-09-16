---
title: 'Story 1.3: Provision và lifecycle School qua Ops'
type: 'feature'
created: '2026-09-16'
status: 'done'
review_loop_iteration: 0
baseline_commit: '1510ed862bb9fe1ad98cbb26b2284afeaf55f73a'
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/ops/ops.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nền tảng đã có Google identity và Ops audience session, nhưng chưa xác thực Platform Operator, chưa có School lifecycle hay bề mặt Ops. Việc provision School và owner bootstrap cần toàn vẹn transaction, idempotency và provenance trước khi School domain được phát hành.

**Approach:** Phát hành PlatformOperatorGrant bootstrap từ `SUPERADMIN_EMAIL`, API Ops cho School list/provision/suspend/reactivate và Operation reconciliation, cùng một UI Ops accessible chỉ hiển thị control-plane state server-confirmed. Provision tạo hoặc dùng lại pending owner identity, membership và `SCHOOL_ADMIN` grant trong cùng transaction mà không trao quyền School cho operator.

## Boundaries & Constraints

**Always:** API tự resolve Ops session và PlatformOperatorGrant, validate exact Ops origin + double-submit CSRF cho mọi mutation, và yêu cầu UUID `Idempotency-Key`. Provision Operation phải PlatformOperatorGrant-scoped trước khi School tồn tại; retry cùng actor/route/key/fingerprint replay nguyên outcome, fingerprint khác trả conflict. School chỉ chuyển `ACTIVE <-> SUSPENDED`, không hard-delete; suspended chỉ chặn request School business tiếp theo, không xóa global session hay quyền School khác. Owner email normalized server-side; Google binding dùng canonical identity hiện có, từ chối subject mismatch/email reassigned. Ops không truy cập School business data hay nhận membership/role từ platform grant.

**Ask First:** Dừng nếu cần thêm Platform Operator ngoài `SUPERADMIN_EMAIL`, thay đổi Google/Ops host-origin scheme, thêm luồng Admin revoke/gán lại owner, hoặc triển khai School membership/capability chooser ngoài bootstrap owner tối thiểu.

**Never:** Không tin `schoolId`, Operation ID, actor reference hay browser state làm bằng chứng quyền; không dùng `NULL` unique Prisma để bảo vệ provision idempotency; không optimistic update lifecycle, không retry timeout trước reconciliation, không tạo parent/student/staff domain hay School business destination trong Ops.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Ops bootstrap | Verified Ops Google callback | Chỉ normalized `SUPERADMIN_EMAIL` có PlatformOperatorGrant mới nhận Ops session | Identity khác redirect safe denied, không issue cookie |
| Provision | Grant hợp lệ, School input và owner email hợp lệ | Một transaction tạo School, pending identity, active membership, `SCHOOL_ADMIN`, audit và completed Operation | Bất kỳ lỗi nào rollback, UI giữ form và không tuyên bố partial success |
| Idempotent mutation | Cùng grant/route/key/fingerprint | Replay cùng Operation/outcome; client đối soát qua GET Operation | Cùng key nhưng fingerprint khác là 409, không thêm School/grant |
| Lifecycle | Suspend/reactivate có confirmation | Chỉ state server xác nhận được hiển thị; same-state là completed no-op | Timeout giữ Operation ID, khóa action và reconcile trước khi retry |
| Pending owner login | Verified Google email khớp pending identity | Bind subject canonical và session App hiện có tiếp tục là nền cho Story 1.4 | Subject/email mismatch bị từ chối, không gán lại owner |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma:9-25,51-61,77-107,125-144` -- nền School, identity pending, membership/grant và Operation; thêm PlatformOperatorGrant, idempotency/provenance quan hệ cần thiết.
- `apps/api/prisma/migrations/20260916000000_target_multi_school_baseline/migration.sql` -- baseline; thêm một migration additive với index/constraint platform-scoped không phụ thuộc NULL unique.
- `apps/api/src/modules/auth/auth.service.ts:22-67,88-100` -- tái dùng binding Google identity atomic và session audience; Ops callback phải gate PlatformOperatorGrant trước cookie.
- `apps/api/src/modules/auth/auth.controller.ts:12-41`, `auth.config.ts:1-31`, `main.ts:18-35` -- Ops routes/cookie/origin hiện có; bổ sung config bootstrap, CORS `Idempotency-Key` và mutation validation dùng chung.
- `apps/api/src/modules/identity/prisma.service.ts`, `apps/api/src/app.module.ts` -- Prisma owner và nơi đăng ký module Ops mới.
- `apps/api/src/modules/ops/` -- controller/service/guard mới: list DTO control-plane, provision/lifecycle transaction, Operation reconciliation và authorization theo grant server-resolved.
- `packages/contracts/src/index.ts:1-10` -- chỉ thêm REST DTO/validator thuần cho Ops School, validation error và Operation; không chứa policy.
- `apps/api/src/modules/auth/**/*.test.ts`, `apps/api/src/modules/ops/**/*.test.ts`, `apps/api/src/integration/*.test.ts` -- mở rộng HTTP/unit và PostgreSQL proof cho callback gate, atomicity, idempotency, ownership và lifecycle.
- `apps/ops-web/src/auth-session.ts:1-7`, `main.tsx:4`, `shell.test.tsx:8-26` -- tái dùng bootstrap/clear-state/CSRF, thay placeholder bằng Ops control-plane và regression tests.
- `apps/ops-web/src/ops-schools.tsx` và stylesheet/test tương ứng -- feature client REST, form validation, confirmation dialog focus, reconciliation và responsive list; không cache API.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma`, migration additive -- thêm `PlatformOperatorGrant`, Operation idempotency/provenance và DB constraint/index scope đúng; giữ School lifecycle non-destructive.
- [x] `apps/api/src/modules/auth/`, `main.ts`, `.env.example` -- bootstrap grant duy nhất từ normalized `SUPERADMIN_EMAIL`, chỉ cấp Ops session sau grant check; validate config và permit CORS header idempotency.
- [x] `apps/api/src/modules/ops/`, `app.module.ts`, `packages/contracts/src/index.ts` -- triển khai API Ops server-authoritative cho list, provision, suspend/reactivate và GET Operation; transaction, audit, origin/CSRF, UUID key, replay/conflict và grant ownership đều server-side.
- [x] `apps/api/src/modules/{auth,ops}/**/*.test.ts`, `apps/api/src/integration/ops*.test.ts` -- prove callback gate, rollback/no orphan, concurrent retry, NULL-scope regression, subject binding, cross-grant denial và suspended business-access contract.
- [x] `apps/ops-web/src/{main.tsx,auth-session.ts,ops-schools.tsx,ops-schools.css}` cùng tests -- render list/form/filter responsive; giữ input và focus error summary; named confirm dialog trap/return focus; chỉ update sau server outcome; timeout lưu Operation ID, disable duplicate và reconcile trước retry; 401/logout clear UI/dialog.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chuyển Story 1.3 sang trạng thái workflow phù hợp sau khi implementation/review hoàn tất.

**Acceptance Criteria:**
- Given user có Ops session nhưng không có PlatformOperatorGrant, when gọi hoặc khởi tạo Ops control-plane, then API từ chối trước bất kỳ School data nào và không issue Ops session ở callback.
- Given Platform Operator provision School với owner email chuẩn hóa, when transaction hoàn tất, then đúng một School và bootstrap owner graph tồn tại, actor không có School membership, và lỗi bất kỳ bước nào không để partial state.
- Given mutation timeout hay resend, when client dùng same idempotency identity, then GET Operation trả outcome đã lưu trước khi UI cho phép retry và state hiển thị chỉ là server-confirmed.
- Given pending owner đăng nhập Google bằng verified matching email, when canonical identity chưa bind hoặc binding hợp lệ, then subject bind identity pending mà không có client School authorization; mismatch bị deny.
- Given School bị suspend, when School business resolver xử lý request kế tiếp của tenant đó, then request bị deny trong khi identity session và access School khác không bị thu hồi.
- Given Ops viewport desktop và hẹp, when list/form/dialog hiển thị, then có heading, caption/table hoặc scroll/card responsive, text status, keyboard/focus semantics và không có tenant business destination.

## Design Notes

Provision dùng PlatformOperatorGrant-scoped Operation vì School chưa tồn tại. Mỗi lifecycle action cũng giữ grant actor provenance, còn `schoolId` chỉ là target đã được API lookup, không phải credential. Same-state lifecycle hoàn thành no-op để retry/reconcile luôn hội tụ vào server state mà không sinh audit transition giả.

Owner pending chỉ là `UserIdentity` không `googleSubject`; cơ chế OAuth canonical đã có sẽ bind subject khi verified email khớp. Story này chỉ tạo bootstrap access graph, còn resolver membership/capability đầy đủ và School shell thuộc Story 1.4.

## Verification

### Review Findings

- [x] [Review][Patch] Platform Operator có thể tự nhận School membership qua owner bootstrap [apps/api/src/modules/ops/ops.service.ts:32]
- [x] [Review][Patch] PlatformOperatorGrant không thể revoke khi còn Operation lịch sử [apps/api/prisma/migrations/20260916000003_ops_school_lifecycle/migration.sql:23]
- [x] [Review][Patch] Provision body `null` và lifecycle `schoolId` không phải UUID trả lỗi 500 thay vì validation error [apps/api/src/modules/ops/ops.service.ts:28]
- [x] [Review][Patch] Lifecycle concurrent với idempotency key khác không serializable [apps/api/src/modules/ops/ops.service.ts:43]
- [x] [Review][Patch] GET Ops schools không tuân `{ data, meta }` và thiếu behavioral coverage cho list [apps/api/src/modules/ops/ops.service.ts:19]
- [x] [Review][Patch] Thiếu proof integration cho superadmin grant bootstrap và revocation tồn tại sau Operation [apps/api/src/modules/auth/auth.service.ts:66]

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate && pnpm --filter @passionedu/api prisma:migrate:deploy` -- expected: migration lifecycle/grant/Operation áp dụng và Prisma client hợp lệ.
- `pnpm --filter @passionedu/api test && pnpm --filter @passionedu/api test:integration` -- expected: Ops authorization, atomicity, idempotency, lifecycle và Google pending-owner proof pass trên PostgreSQL.
- `pnpm --filter @passionedu/ops-web test` -- expected: list/provision/dialog/reconciliation/clear-state accessible tests pass.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- expected: workspace checks pass, không có cross-app/API-internal import.

## Suggested Review Order

**Ops Control Plane**

- API resolves grant context, transactional lifecycle and scoped reconciliation server-side.
  [`ops.service.ts:19`](../../apps/api/src/modules/ops/ops.service.ts#L19)

- HTTP routes enforce session, origin, CSRF and idempotency before mutations.
  [`ops.controller.ts:9`](../../apps/api/src/modules/ops/ops.controller.ts#L9)

**Persistence And Identity**

- Tenant root retains immutable initial owner while lifecycle Operations retain School provenance.
  [`schema.prisma:9`](../../apps/api/prisma/schema.prisma#L9)

- Migration backfills legacy idempotency safely before adding its unique index.
  [`migration.sql:1`](../../apps/api/prisma/migrations/20260916000003_ops_school_lifecycle/migration.sql#L1)

- Ops OAuth issues a session only after platform grant bootstrap authorization.
  [`auth.service.ts:34`](../../apps/api/src/modules/auth/auth.service.ts#L34)

**Ops Experience**

- UI displays only server state and persists timeout reconciliation within the same grant context.
  [`ops-schools.tsx:12`](../../apps/ops-web/src/ops-schools.tsx#L12)

- Dialog focus/escape handling and lifecycle surface remain keyboard accessible.
  [`ops-schools.tsx:19`](../../apps/ops-web/src/ops-schools.tsx#L19)

**Regression Proof**

- PostgreSQL tests prove atomic graph, idempotency, pending binding, lifecycle scope and revoked-grant denial.
  [`ops.provision.integration.test.ts:12`](../../apps/api/src/integration/ops.provision.integration.test.ts#L12)

- Browser tests cover timeout reconciliation and accessible confirmation dialogs.
  [`shell.test.tsx:27`](../../apps/ops-web/src/shell.test.tsx#L27)

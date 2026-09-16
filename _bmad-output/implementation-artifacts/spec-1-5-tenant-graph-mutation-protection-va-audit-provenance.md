---
title: 'Story 1.5: Tenant graph, mutation protection và audit provenance'
type: 'feature'
created: '2026-09-16'
status: 'done'
baseline_commit: '865c9d182ba32514df3713d18971375b86eabd63'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Control plane đã có membership authorization và các mutation riêng lẻ, nhưng audit chưa biểu diễn actor reference một cách có cấu trúc, idempotency chưa được ràng buộc trực tiếp theo School, và các bảo vệ mutation còn lặp lại theo controller. Điều này chưa tạo được foundation có thể kiểm chứng cho các aggregate School-scoped ở các Epic sau.

**Approach:** Chuẩn hóa tenant-scoped command foundation dùng chung, mở rộng tenant graph/audit provenance và Operation scope bằng migration additive, rồi chuyển các membership và Ops mutation hiện có sang foundation đó với PostgreSQL và HTTP proof.

## Boundaries & Constraints

**Always:** School là tenant root; authorize actor context trước aggregate lookup và recheck School/actor/full graph trong transaction. Tenant relation dùng composite `(schoolId, id)` khi PostgreSQL biểu diễn được. Cookie mutation luôn kiểm exact audience origin và double-submit CSRF trước service transition. Audit lưu School, actor identity, actor type/reference, membership khi có, timestamp, provenance và reason khi command yêu cầu. High-impact Operation replay chỉ cho cùng actor context/School/route/key/fingerprint; read Operation chỉ trả đúng actor context.

**Block If:** Cần định nghĩa aggregate nghiệp vụ School mới, thay đổi semantics reconciliation của actor đã revoke/school suspended, hoặc chuyển PlatformOperatorGrant provisioning thành School-scoped Operation.

**Never:** Không tin `schoolId`, UUID, header, filter hay browser state là bằng chứng quyền; không tạo schema Epic 2; không ghi audit/Operation khi origin, CSRF hoặc capability bị từ chối; không dùng float/client authority; không làm PlatformOperatorGrant thành membership.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| School command retry | Cùng membership, School, route, UUID key và fingerprint | Trả Operation/outcome đã ghi, không lặp transition hay audit | Fingerprint khác trả idempotency conflict |
| Same key khác School | Cùng identity active tại A/B, cùng route/key/body | Mỗi School tạo Operation độc lập | Không leak/read Operation của context còn lại |
| Rejected cookie mutation | Origin, CSRF hoặc capability không hợp lệ | Controller từ chối trước command transaction | Không có state, AuditRecord hay Operation mới |
| Audit provenance | Membership command và Ops lifecycle/provision | Audit có actor identity/type/reference, membership khi có, School/timestamp/provenance/reason tương ứng | Composite tenant relation chặn membership cross-School |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma:40-50,119-158` -- Operation đã có actor type/reference nhưng AuditRecord thiếu hai field; unique Operation hiện không mang School scope.
- `apps/api/prisma/migrations/20260916000004_membership_capability_context/migration.sql` và `20260916000005_audit_operation_membership_tenant_graph/migration.sql` -- migration additive/composite FK pattern; không sửa baseline migration.
- `apps/api/src/modules/memberships/memberships.service.ts:24-80` -- School command, locked transaction, audit và retry logic cần chuyển sang foundation; CRUD target hiện đã match `id` + `schoolId`.
- `apps/api/src/modules/ops/ops.service.ts:29-83` -- Platform grant exception cho provision và lifecycle Operations; giữ explicit platform actor, dùng audit helper/provenance chung.
- `apps/api/src/modules/{memberships,ops,auth}/*.controller.ts` -- các điểm lặp exact-origin/double-submit CSRF cần dùng guard/helper chung trước service invocation.
- `apps/api/src/modules/authorization/authorization.service.ts:19-41` -- authoritative School membership/capability resolver; dùng lại, không chuyển policy ra browser.
- `apps/api/src/integration/membership.integration.test.ts` và `ops.provision.integration.test.ts` -- PostgreSQL fixture/pattern cho composite FK, concurrency, replay và Operation actor scope; mở rộng proof provenance/same-key cross-School.
- `apps/api/src/modules/{memberships,ops}/*.controller.test.ts` -- unit proof controller guard từ chối trước service; mở rộng theo foundation được trích xuất.
- `apps/api/src/app.module.ts` -- đăng ký common mutation/audit module nếu cần để tránh import API internals xuyên app.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma`, migration additive dưới `apps/api/prisma/migrations/` -- thêm actor type/reference có relation-safe cho `AuditRecord`; thay Operation idempotency unique bằng scope biểu đạt School đối với School Operations nhưng vẫn cho phép provisioning platform-scoped; giữ composite membership FKs.
- `apps/api/src/modules/common/` (hoặc common module hiện hữu), `apps/api/src/app.module.ts` -- trích xuất guard/helper cho exact-origin + double-submit CSRF và tenant command/audit write contract để mọi mutation hiện có tái sử dụng, không thay đổi REST public contract không cần thiết.
- `apps/api/src/modules/memberships/{memberships.service.ts,memberships.controller.ts}` -- dùng foundation, scope existing/replay lookup theo School actor context, audit actor provenance có cấu trúc, và giữ lookup/update/delete target cùng `id` + `schoolId` trong transaction.
- `apps/api/src/modules/ops/{ops.service.ts,ops.controller.ts}` -- dùng foundation cho CSRF/audit/Operation; giữ provisioning Operation platform-scoped trước khi School tồn tại và lifecycle Operation School-scoped.
- `apps/api/src/modules/**/*test.ts`, `apps/api/src/integration/{membership,ops.provision}.integration.test.ts` -- chứng minh guard từ chối trước service, audit field/provenance/reason, composite FK negative cases, same key A/B không conflict, changed fingerprint conflict, replay và actor-context-only Operation read.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chuyển Story 1.5 sang `done` chỉ sau implementation, review và toàn bộ verification pass.

**Acceptance Criteria:**
- Given một command School-scoped truy vấn/ghi target ID, when command chạy, then mọi target lookup/update/delete match cả `id` và `schoolId` trong transaction và cross-School graph relation bị composite FK hoặc transaction proof chặn.
- Given cookie-auth mutation với origin, CSRF hoặc capability không hợp lệ, when endpoint nhận request, then nó bị từ chối trước service transition và không persist AuditRecord, Operation hoặc business state.
- Given School membership hoặc PlatformOperatorGrant thực hiện mutation, when transition thành công, then audit persist School, actor identity, typed actor reference, actor membership khi áp dụng, server timestamp, Operation provenance và required reason.
- Given cùng actor School context retry command cùng route/key/fingerprint, when timeout/retry, then API replay saved outcome; fingerprint đổi bị conflict; cùng key tại School khác không conflict; GET Operation không tiết lộ cho actor context khác.

## Design Notes

`OperationActorType` là vocabulary chung cho actor provenance. Audit dùng cùng type/reference để lifecycle/provision không phải nhét actor reference duy nhất trong JSON, còn `provenance` giữ metadata action như `operationId` và target. Unique idempotency cần phân biệt platform-scoped provisioning với School-scoped commands mà không coi nullable `schoolId` là một unique scope đáng tin cậy trong PostgreSQL.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate && pnpm --filter @passionedu/api prisma:migrate:deploy` -- expected: Prisma client và migration additive deploy thành công.
- `TARGET_INTEGRATION_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/anhhoa_test" pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL tenant graph, audit provenance, idempotency scope/replay và Operation authorization pass.
- `pnpm --filter @passionedu/api test` -- expected: controller mutation protection và service regressions pass.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && git diff --check` -- expected: workspace quality/build pass và không whitespace error.

## Suggested Review Order

**Idempotency Scope**

- Migration removes stale global constraints before creating nullable-safe partial scopes.
  [`migration.sql:5`](../../apps/api/prisma/migrations/20260916000006_tenant_command_audit_provenance/migration.sql#L5)

- Business duplicate errors are rethrown unless the scoped Operation proves a matching replay.
  [`memberships.service.ts:75`](../../apps/api/src/modules/memberships/memberships.service.ts#L75)

- Platform provisioning and lifecycle use their distinct platform and School Operation scopes.
  [`ops.service.ts:65`](../../apps/api/src/modules/ops/ops.service.ts#L65)

**Mutation Boundary**

- Cookie mutation validation runs before any session resolution on protected controller paths.
  [`memberships.controller.ts:14`](../../apps/api/src/modules/memberships/memberships.controller.ts#L14)

- Logout shares the exact-origin and double-submit CSRF protection.
  [`auth.controller.ts:38`](../../apps/api/src/modules/auth/auth.controller.ts#L38)

- Recursive canonicalization makes object key order irrelevant to request fingerprints.
  [`mutation-protection.ts:15`](../../apps/api/src/modules/common/mutation-protection.ts#L15)

**Database Proofs**

- PostgreSQL proofs cover concurrency, scoped keys, provenance, and migrated partial indexes.
  [`membership.integration.test.ts:56`](../../apps/api/src/integration/membership.integration.test.ts#L56)

- Ops proofs cover typed audit records for provision, suspend, reactivate, and scope isolation.
  [`ops.provision.integration.test.ts:24`](../../apps/api/src/integration/ops.provision.integration.test.ts#L24)

- Helper unit cases cover valid and invalid mutation proofs plus canonical fingerprints.
   [`mutation-protection.test.ts:4`](../../apps/api/src/modules/common/mutation-protection.test.ts#L4)

## Review Result

- Auto-review findings đã được xử lý và proof lại sau thay đổi: `2026-09-16`.
- PostgreSQL migration/backfill giữ audit legacy không có `membershipId` hay `provenance.platformOperatorGrantId` ở trạng thái untyped, vì không có nguồn actor có thể khôi phục quyết định được.
- Đã pass `prisma:generate`, `prisma:migrate:deploy`, PostgreSQL integration `27/27`, API test `41/41` (27 integration skip khi không có target), và `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `git diff --check`.

## Review Triage Log

### 2026-09-16 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 8: (high 3, medium 5, low 0)
- defer: 0
- reject: 0
- addressed_findings:
  - [high] [patch] Thay ràng buộc idempotency partial index cũ, thêm actor type scope và PostgreSQL proof concurrency/index để command khác key không bị fingerprint cũ chặn.
  - [high] [patch] Thêm backfill và trigger PostgreSQL kiểm actor provenance theo identity/reference/membership/School, bao gồm negative proof cross-School và actor không tồn tại.
  - [high] [patch] Khóa và recheck PlatformOperatorGrant active trong transaction trước Operation/workflow Ops.
  - [medium] [patch] Chuẩn hóa JSON fingerprint, đưa origin/CSRF guard vào trước session resolution và tái dùng guard cho logout.
  - [medium] [patch] Audit typed provenance cho create/revoke/replace-role/provision/suspend/reactivate và chứng minh reason/operationId/timestamp.
  - [medium] [patch] P2002 chỉ replay khi constraint partial Operation scope xác định; lỗi unique nghiệp vụ hoặc Operation ID được rethrow nguyên bản.

## Auto Run Result

Status: done

Đã chuẩn hóa tenant mutation foundation cho Membership và Ops: exact-origin/double-submit CSRF trước session/service transition, canonical request fingerprint, Operation idempotency scope theo School/platform và actor type, transaction recheck actor grant, cùng audit provenance typed.

Migration `20260916000006_tenant_command_audit_provenance` thay unique key cũ bằng partial Operation indexes; migration `20260916000007_audit_actor_provenance_and_operation_actor_scope` backfill provenance có thể xác minh, tạo trigger chặn actor reference/membership cross-School hoặc không hợp lệ, và bổ sung actor type vào scope. Audit legacy không có nguồn actor khôi phục được giữ untyped.

Review findings: 8 patch (3 high, 5 medium), không defer hay reject. Follow-up review recommendation: true (high patch present; score 15).

Verification pass: Prisma generate/migrate deploy; PostgreSQL integration `29/29`; API unit `43/43`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm build`; `git diff --check`.

Residual risk: migration proof chạy trên PostgreSQL integration cục bộ; deploy production vẫn phải chạy migrations theo quy trình release trước API version phụ thuộc.

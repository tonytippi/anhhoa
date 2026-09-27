---
title: 'Khởi tạo nhóm khoản thu mặc định theo Trường'
type: 'feature'
created: '2026-09-27'
status: 'done'
baseline_commit: '6287630ee2f78ca857ec1f2f17f932afb0e26c2e'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sau khi reset database development hoặc khởi tạo một School mới qua Ops, không có sẵn nhóm khoản thu để cấu hình catalog, buộc người dùng phải nhập lại những nhóm cơ bản.

**Approach:** Khởi tạo đúng ba nhóm active `Khoản thu chung`, `Khoản thu đột xuất`, `Ngoại khóa` trong cùng transaction provisioning của từng School mới. Seed development PeakLand cũng tạo ba nhóm này, để database reset có dữ liệu ngay. Không backfill hoặc sửa các School đã tồn tại.

## Boundaries & Constraints

**Always:** Mỗi nhóm và lifecycle transition scope theo School; dùng transition sequence `1`, `previousStatus: null`, `status: ACTIVE`, không tự thay đổi nhóm trùng tên hay trạng thái hiện có. Provisioning phải giữ atomic và idempotent: replay Operation không sinh nhóm/transition mới. Transition do Platform Operator tạo khi provision phải lưu actor platform đúng sự thật và `membershipId: null`; seed development dùng owner membership và School-scoped Operation riêng. Migration phải giữ relation Operation theo cùng School.

**Ask First:** Backfill School cũ, thay đổi tên/danh sách ba nhóm, cho phép xóa hoặc ngừng nhóm mặc định, hay biến các nhóm thành dữ liệu platform-global.

**Never:** Không dùng platform-scoped provisioning Operation làm `operationId` của transition School-scoped; không gán sai owner làm actor cho thao tác do Platform Operator thực hiện; không tạo nhóm qua frontend/API Finance hay bypass lifecycle audit.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Provision School mới | Ops tạo School hợp lệ | Transaction tạo đúng ba nhóm, mỗi nhóm có một transition ACTIVE ban đầu với provenance Platform Operator. | Lỗi bất kỳ làm rollback School graph và nhóm. |
| Replay provisioning | Cùng idempotency key và fingerprint | Trả Operation cũ, không tạo group hoặc transition trùng. | Key dùng với payload khác vẫn conflict. |
| Reset rồi seed development | Chạy seed PeakLand từ DB sạch | PeakLand có đúng ba nhóm active; mỗi nhóm có transition audit hợp lệ. | Seed lặp lại không tạo trùng bởi unique `(schoolId, name)`. |
| School cũ | Đã tồn tại trước thay đổi | Không được backfill, đổi tên hay thay trạng thái nhóm hiện có. | Không có data migration. |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/ops/ops.service.ts:30-49` -- provisioning tạo School/owner graph trong platform-scoped Operation transaction; thêm School-scoped Operation nội bộ và nhóm/transition sau khi School tồn tại.
- `apps/api/prisma/schema.prisma:699-734` -- `Operation` hỗ trợ scoped platform actor; `ReceivableGroupLifecycleTransition` tại `1425-1443` hiện bắt buộc membership và cần nullable membership cho provisioning provenance thật.
- `apps/api/prisma/migrations/20260921000002_finance_receivable_catalog/migration.sql:1-55` -- migration catalog/reference integrity hiện hành; migration mới thay nullable membership relation mà không thay School/Operation composite FK.
- `apps/api/prisma/seed.ts:252-421` -- seed PeakLand tạo owner/membership trong một transaction; thêm default group idempotent và một School-scoped seed Operation sau membership.
- `apps/api/src/modules/ops/ops.service.test.ts:7-20` -- mock transaction và assertion provisioning; kiểm tra ba group/transition và School-scoped Operation nội bộ.
- `apps/api/src/integration/ops.provision.integration.test.ts:6-16` -- PostgreSQL proof/cleanup provisioning; bổ sung cleanup transition/group và assertion group lifecycle, Operation scope/provenance.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<timestamp>_provision_default_receivable_groups/migration.sql` -- cho phép lifecycle group provisioning có `membershipId` null, giữ composite School relation/constraint -- biểu diễn provenance Platform Operator trung thực.
- [x] `apps/api/src/modules/ops/ops.service.ts` -- trong transaction provisioning tạo School-scoped completed Operation nội bộ và đúng ba group + transition ACTIVE -- School mới luôn sẵn catalog foundation, rollback và replay an toàn.
- [x] `apps/api/prisma/seed.ts` -- idempotently tạo ba nhóm active cho PeakLand bằng owner membership và seed Operation School-scoped -- `reset` rồi seed có dữ liệu mặc định.
- [x] `apps/api/src/modules/ops/ops.service.test.ts`, `apps/api/src/integration/ops.provision.integration.test.ts` -- kiểm tra số lượng/tên/status/provenance, replay và cleanup -- chứng minh invariant tenant/audit.

**Acceptance Criteria:**
- Given Platform Operator provision một School mới, when Operation hoàn tất, then School có đúng ba nhóm `Khoản thu chung`, `Khoản thu đột xuất`, `Ngoại khóa`, mỗi nhóm active qua một transition ban đầu.
- Given provision được retry với cùng key và payload, when API replay Operation, then không có group/transition/Operation default bổ sung.
- Given transition mặc định tạo bởi provisioning, when audit dữ liệu, then `actorIdentityId` là Platform Operator, `membershipId` null và `operationId` tham chiếu Operation cùng School.
- Given development database vừa reset và chạy seed, when mở catalog PeakLand, then đúng ba nhóm mặc định active đã tồn tại; chạy seed lặp lại không tạo trùng.
- Given School tồn tại trước migration, when deploy thay đổi, then không có bản ghi group/transition mới được tạo cho School đó.

## Design Notes

Default groups là tenant-local data, không phải template platform toàn cục, nên tạo trong transaction School. `Operation` provisioning gốc bắt buộc platform-scoped vì School chưa tồn tại; một Operation nội bộ thứ hai có `schoolId` mới tạo thỏa composite FK transition. Nullable membership chỉ áp dụng provenance Platform Operator khởi tạo; API Finance từ membership vẫn giữ hợp đồng hiện có.

## Verification

**Commands:**
- `set -a && . ./.env.test && set +a && pnpm --filter @passionedu/api test` -- expected: unit Ops và seed-related tests pass.
- `set -a && . ./.env.test && set +a && pnpm --filter @passionedu/api test:integration` -- expected: migration deploy và PostgreSQL provisioning proof pass.
- `pnpm --filter @passionedu/api typecheck` -- expected: không có TypeScript error.
- `git diff --check` -- expected: không có lỗi whitespace.

## Suggested Review Order

**Provisioning atomicity**

- Tạo inner School-scoped Operation để transition giữ composite tenant integrity.
  [`ops.service.ts:48`](../../apps/api/src/modules/ops/ops.service.ts#L48)

- Khởi tạo đúng ba nhóm và lifecycle ACTIVE với provenance Platform Operator.
  [`ops.service.ts:49`](../../apps/api/src/modules/ops/ops.service.ts#L49)

**Schema and development seed**

- Nullable membership chỉ cho lifecycle group do Platform Operator provision.
  [`schema.prisma:1425`](../../apps/api/prisma/schema.prisma#L1425)

- Migration giữ nguyên composite School foreign key khi nullable membership.
  [`migration.sql:1`](../../apps/api/prisma/migrations/20260927000000_provision_default_receivable_groups/migration.sql#L1)

- Seed PeakLand dùng owner membership và Operation scoped theo School, idempotent theo tên.
  [`seed.ts:334`](../../apps/api/prisma/seed.ts#L334)

**Proofs**

- Unit test chứng minh graph provision tạo một Operation nội bộ và ba transitions.
  [`ops.service.test.ts:13`](../../apps/api/src/modules/ops/ops.service.test.ts#L13)

- PostgreSQL proof kiểm tra nhóm, provenance null membership và replay không nhân bản.
  [`ops.provision.integration.test.ts:13`](../../apps/api/src/integration/ops.provision.integration.test.ts#L13)

- Bootstrap proof kiểm tra PeakLand và seed lặp lại không sinh nhóm/transition trùng.
  [`bootstrap.integration.test.ts:15`](../../apps/api/src/integration/bootstrap.integration.test.ts#L15)

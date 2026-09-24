---
title: 'Seed danh sách nhân viên PeakLand'
type: 'feature'
created: '2026-09-24'
status: 'done'
review_loop_iteration: 0
baseline_commit: '7d17c303a52bedb2a0f2e5cdd38351b2436696f1'
context:
  - '_bmad-output/implementation-artifacts/spec-seed-danh-sach-hoc-sinh-peakland.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Development fixture PeakLand hiện có roster học sinh/phụ huynh nhưng chưa phản ánh danh sách nhân viên thật trong `docs/peakland/nhanvien-peakland.csv`, khiến danh bạ nhân viên và các lớp được giáo viên phụ trách thiếu dữ liệu quản lý.

**Approach:** Đọc và validate CSV nhân viên khi chạy development seed, tạo/reconcile hồ sơ nhân viên và mã legacy theo School `pl`. Dữ liệu CSV là hồ sơ quản lý, không phải bằng chứng đăng nhập hay quyền: email/điện thoại/giới tính/địa chỉ có thể vắng; chỉ những dòng có chức vụ chứa `Giáo viên` nhận assignment đến mọi lớp được liệt kê trong ô `Lớp` nhiều dòng.

## Boundaries & Constraints

**Always:** Seed chỉ chạy với `NODE_ENV=development`, parse toàn bộ CSV trước transaction, dùng advisory lock/transaction hiện hữu và scope mọi query/write theo School `pl`. `StaffProfile.email`, `phone`, `gender`, `address` phải trở thành nullable để giữ nguyên trạng thái vắng dữ liệu của CSV; email được chuẩn hóa lowercase khi có nhưng không tạo `UserIdentity`, `SchoolMembership`, login binding, capability grant, Operation hoặc audit giả. `staffCode` là mã CSV legacy và `StaffCodeRegistry` phải được tạo/reconcile theo cùng School, không cho mã đã thuộc profile khác. Dùng SchoolYear `2026-2027` và effective date fixture `2026-08-01`; assignment giữ snapshot SchoolYear/Class, interval mở và reason provenance seed. Chức danh chính dùng bảng ưu tiên cố định: chuỗi chức vụ chứa `Giáo viên` -> `GIAO_VIEN`; nếu không, chứa `Hiệu trưởng` -> `HIEU_TRUONG`; nếu không, chứa `Kế toán` -> `KE_TOAN`; các giá trị còn lại -> `QUAN_LY_TRUONG`. Chỉ profile có primary position `GIAO_VIEN` mới tạo một assignment cho mỗi tên lớp hợp lệ trong ô nhiều dòng; không thay capability hiện có. Tái chạy phải hội tụ fixture, không nhân bản profile/registry/assignment và không rewrite lịch sử mâu thuẫn.

**Ask First:** Dừng nếu CSV không còn đúng 31 dòng STT tuần tự, mã nhân viên không unique, tên lớp ngoài bảy lớp PeakLand, chức vụ không thể áp dụng bảng ưu tiên, cần gán login/binding/quyền từ CSV, hoặc snapshot Staff/registry/assignment đã tồn tại nhưng khác fixture. Dừng nếu cần import cột Học vấn, Thành tích, Kinh nghiệm hoặc Ghi chú, vì target schema không có contract cho chúng.

**Never:** Không dùng email CSV để cấp quyền hay tạo tài khoản; không thêm/suy diễn gender, address, phone hoặc email placeholder; không sửa capability matrix; không tạo assignment cho nhân viên không được map primary `GIAO_VIEN`; không xóa/chỉnh lịch sử assignment không thuộc fixture; không dùng RosterService hay mô phỏng idempotency Operation/audit cho development seed.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Seed lần đầu | CSV 31 nhân viên hợp lệ, PeakLand chưa có fixture staff | Tạo 31 profile active, 31 registry entry; nullable contact fields giữ `null`; giáo viên có assignment cho mọi lớp ghi trong ô | Một lỗi parse/persist rollback toàn transaction |
| Seed chạy lại | Fixture cùng snapshot đã tồn tại | Reconcile profile/registry; không tăng số profile hoặc assignment | Phát hiện mã/lịch sử khác fixture thì fail, không overwrite history |
| Hồ sơ thiếu contact | Email, phone, gender hoặc address trống | Persist `null`, không tạo identity/membership/binding | Không sinh placeholder hay quyền ngầm |
| Ô chức vụ/lớp nhiều dòng | Chức vụ composite và danh sách một/nhiều lớp | Chọn primary position theo priority; chỉ `GIAO_VIEN` được tạo một assignment mỗi lớp | Reject tên không hỗ trợ hoặc duplicate lớp trong cùng dòng |
| CSV không hợp lệ | Header/STT/mã/ngày sinh/lớp sai hoặc duplicate | Không ghi dữ liệu nhân viên một phần | Ném lỗi có dòng/trường trước transaction |

</frozen-after-approval>

## Code Map

- `docs/peakland/nhanvien-peakland.csv` -- nguồn 31 nhân viên; parser phải xử lý ô quoted nhiều dòng của `Lớp`.
- `apps/api/prisma/seed.ts:28-192,199-339` -- parser CSV, environment guard, transaction/advisory lock và fixture SchoolYear/Class hiện hữu; mở rộng để parse/reconcile Staff graph sau khi lớp đã tồn tại.
- `apps/api/prisma/schema.prisma:120-182,224-249` -- StaffProfile, mã registry và assignment; contact fields hiện non-null nên cần cập nhật nullable contract.
- `apps/api/prisma/migrations/` -- thêm migration không destructive để nullable bốn field hồ sơ Staff.
- `apps/api/prisma/seed.test.ts:1-48` -- regression parser/guard độc lập database; thêm CSV nhân viên, multiline, position priority và lỗi fixture.
- `apps/api/src/integration/bootstrap.integration.test.ts` -- chứng minh bootstrap tạo graph School-scoped/idempotent, registry, nullable contacts, không login binding và assignments của giáo viên.
- `apps/api/src/modules/roster/roster.service.ts:2109-2162` -- API mutation hiện bắt buộc contact fields; giữ nguyên contract nhập tay, seed ghi fixture trực tiếp có chủ đích.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` và migration mới -- cho phép `email`, `phone`, `gender`, `address` của StaffProfile là nullable, không thay đổi identity/binding contract.
- [x] `apps/api/prisma/seed.ts` -- thêm parser/mapping CSV nhân viên, reconcile StaffProfile/StaffCodeRegistry và assignment đa lớp cho giáo viên theo snapshot an toàn.
- [x] `apps/api/prisma/seed.test.ts` -- test file thật, nullable contact, multiline cell, priority chức danh, uniqueness và malformed input trước DB.
- [x] `apps/api/src/integration/bootstrap.integration.test.ts` -- kiểm tra graph bootstrap, idempotency, tenant scope và absence của login binding ngầm.
- [x] `packages/contracts/src/structure.test.ts` -- khóa structural contract seed staff/reference CSV nếu đây là vị trí test fixture contract hiện hành.

**Acceptance Criteria:**
- Given development seed đọc CSV không đổi, when chạy trên PeakLand trống, then tạo đúng 31 StaffProfile active và 31 StaffCodeRegistry entry scoped `pl`, mỗi mã legacy trỏ đúng một profile.
- Given cột contact trống, when seed hoàn tất, then các field tương ứng là `null` và profile không có `schoolMembershipId`, `boundAt` hay `boundByMembershipId`.
- Given chức vụ/lớp composite, when profile có `Giáo viên`, then primary position là `GIAO_VIEN` và mỗi lớp unique hợp lệ có đúng một assignment `2026-08-01`; when không phải giáo viên, then không có assignment được suy ra từ cột Lớp.
- Given seed chạy lại cùng fixture, when hoàn tất, then không tăng số staff, registry hay assignment; Given registry/profile/assignment khác snapshot, when seed chạy, then transaction fail thay vì rewrite history.
- Given parser gặp CSV lỗi, when seed được gọi, then báo lỗi dòng/trường trước transaction và không có persistence một phần.

## Design Notes

Nullable contact fields tách hồ sơ quản lý khỏi danh tính đăng nhập, tương tự ParentProfile: contact data không đủ để chứng minh quyền. Position name và CSV role cũng không cấp capability; mapping chỉ phục vụ hiển thị/profile. Assignment fixture giữ quan hệ vận hành nhiều lớp được export, còn authorization runtime vẫn yêu cầu capability/binding/audience riêng theo Architecture Spine.

## Spec Change Log

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- expected: nullable StaffProfile schema generates cleanly.
- `pnpm --filter @passionedu/api test -- prisma/seed.test.ts` -- expected: guard và staff CSV parser/mapping regressions pass without database.
- `pnpm --filter @passionedu/api test:integration -- bootstrap.integration.test.ts` with `.env.test` -- expected: seed bootstrap graph/idempotency assertions pass on test database.
- `pnpm --filter @passionedu/api typecheck` -- expected: API compiles with nullable Staff contact fields.

## Suggested Review Order

**Fixture Reconciliation**

- Parse legacy staff data before the transaction and reconcile only the approved PeakLand snapshot.
  [`seed.ts:216`](../../apps/api/prisma/seed.ts#L216)

- Use the historical code registry as source identity and reject divergent profiles or assignments.
  [`seed.ts:343`](../../apps/api/prisma/seed.ts#L343)

**Nullable Contact Boundary**

- Preserve missing contact data without converting it into an identity or login binding.
  [`schema.prisma:120`](../../apps/api/prisma/schema.prisma#L120)

- Expose nullable staff contacts consistently to directory consumers and edit forms.
  [`roster.service.ts:191`](../../apps/api/src/modules/roster/roster.service.ts#L191)

- Normalize absent details for controlled form inputs and render explicit table fallbacks.
  [`roster-workspace.tsx:1404`](../../apps/web/src/roster/roster-workspace.tsx#L1404)

**Verification**

- Prove parser validation, role priority, multiline classes and missing contacts without a database.
  [`seed.test.ts:49`](../../apps/api/prisma/seed.test.ts#L49)

- Re-run the actual seed process and assert the resulting staff graph remains idempotent.
  [`bootstrap.integration.test.ts:87`](../../apps/api/src/integration/bootstrap.integration.test.ts#L87)

- Typecheck fixture code independently from the API runtime compilation boundary.
  [`tsconfig.seed.json:1`](../../apps/api/tsconfig.seed.json#L1)

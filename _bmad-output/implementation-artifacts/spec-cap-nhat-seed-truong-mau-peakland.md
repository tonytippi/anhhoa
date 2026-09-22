---
title: 'Cập nhật seed trường mẫu PeakLand Preschool'
type: 'chore'
created: '2026-09-22'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: 'bbf01b28727e23f39fc46211de9e3e7de31f8f88'
context:
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Development seed vẫn tạo tenant ví dụ `Trường mẫu PassionEdu`, tiền tố `PE` và không có owner access graph; vì vậy `sonnh273@gmail.com` không thể đăng nhập để test tenant đầu tiên. Khi dữ liệu và logic tăng lên, developer cũng cần một lệnh reset database phát triển để luôn dựng lại trạng thái khởi đầu xác định.

**Approach:** Đổi fixture development duy nhất thành PeakLand Preschool, dùng `pl` làm slug/mã kỹ thuật School và `PL` làm tiền tố sinh mã học sinh. Seed dựng idempotent full owner access graph cho `sonnh273@gmail.com` theo cùng cấu trúc provision hiện hành, đồng thời có lệnh reset chỉ chạy khi `NODE_ENV=development`, migrate database từ đầu và chạy seed. Các domain fixture lớn sẽ được bổ sung dần trong seed theo yêu cầu sau này.

## Boundaries & Constraints

**Always:** Seed và reset chỉ thực thi khi `NODE_ENV=development`; không cần một biến xác nhận thứ hai. Seed giữ transaction và advisory lock hiện hữu, idempotent khi chạy lại, và email owner luôn normalized; không được gán hoặc ghi đè Google subject. School owner có một active membership, active StaffProfile gắn vào một primary Position `HIEU_TRUONG`, cùng các capability admin hiện hành để App authorization resolver cấp School context. `School` vẫn là tenant root; mã School trong yêu cầu được hiện thực bằng trường kỹ thuật unique hiện có `slug`, không bổ sung cột/code model mới.

**Ask First:** Dừng nếu cần thay đổi schema/API để tạo một mã School tách biệt với `slug`, seed Google subject thực, hoặc đưa dữ liệu demo domain mới có business rule chưa được người dùng nêu (ví dụ cách tính khoản thu, lịch sử thanh toán hoặc attendance). Các nhóm seed lớn bổ sung dần theo intent riêng.

**Never:** Không sửa migration đã deploy, không đọc/ghi secret, không đặt `googleSubject`, không có reset ngoài development, và không tự chạy reset database trong quá trình implementation. Seed tạo graph development tương đương bootstrap owner nhưng không tạo PlatformOperatorGrant, Operation/audit giả, session OAuth hay bypass authorization server-side.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Seed lần đầu | Database mục tiêu trống, `NODE_ENV=development` và `DATABASE_URL` hợp lệ | Tạo một School tên `Mầm Non Giáo dục Đỉnh Cao - PeakLand Preschool`, slug `pl`, prefix `PL`; owner `sonnh273@gmail.com` có identity, membership, Hiệu trưởng, capability và StaffProfile/binding active | Bất kỳ lỗi nào rollback toàn transaction |
| Seed chạy lại | School `pl` và/hoặc identity owner đã tồn tại | Hội tụ vào cùng School/owner graph, không tạo bản ghi trùng hay thay Google binding | Upsert, unique constraints và lock tuần tự hóa kết quả |
| Reset development | Gọi lệnh reset với `NODE_ENV=development` | Xóa schema/data của database tại `DATABASE_URL`, áp dụng migrations từ đầu rồi dựng lại seed PeakLand | Prisma dừng và trả lỗi nếu migrate/seed lỗi |
| Gọi sai môi trường | Seed hoặc reset với `NODE_ENV` khác `development` | Không có database write/reset qua lệnh development | Báo lỗi environment guard rõ ràng |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/seed.ts:4-28` -- điểm vào fixture, hiện advisory-lock và upsert School `truong-mau-passionedu`; thay bằng PeakLand và dựng/reconcile owner access graph trong một transaction.
- `apps/api/prisma/schema.prisma:9-55,117-186,457-469,532-563` -- mô hình School, UserIdentity, SchoolMembership, StaffProfile, SchoolPosition và grants mà seed phải giữ nhất quán; không cần migration.
- `apps/api/src/modules/ops/ops.service.ts:30-49` -- canonical blueprint cho owner bootstrap: normalize identity, School, membership, bảy position chuẩn, `HIEU_TRUONG` grants và StaffProfile binding; seed phải đồng bộ các hằng giá trị để development graph được resolver chấp nhận, nhưng không gọi service Ops hay tạo Operation/audit.
- `apps/api/src/modules/authorization/authorization.service.ts:4-57` -- capability catalog và điều kiện chooser/resolve, chứng minh seed owner cần `SCHOOL_CONTEXT_READ`, membership, StaffProfile, Position active và binding.
- `apps/api/package.json:6-19`, `apps/api/prisma.config.ts:1-10` -- nơi khai báo Prisma seed và scripts; thêm script reset development dựa trên `prisma migrate reset --force`, rồi đưa guard `NODE_ENV=development` vào seed/script.
- `apps/api/scripts/test-integration.ts:3-10` -- hiện gọi fixture khi `NODE_ENV=test`; chỉnh môi trường riêng cho bước Prisma seed để giữ test integration chạy mà production/other runtime không thể gọi development command.
- `apps/api/prisma/seed.test.ts:1-11` -- mở rộng proof guard environment và các invariant graph thông qua mock/isolated database strategy phù hợp style hiện có.
- `README.md:50-65` -- cập nhật lệnh và semantics: development seed tạo PeakLand owner đăng nhập được; reset hủy toàn bộ development database rồi migrate/seed lại.
- `packages/contracts/src/structure.test.ts:20-27` -- structural regression hiện khóa slug fixture cũ; cập nhật assertion sang PeakLand, `pl`, `PL`, email owner và lệnh dev guard.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/seed.ts` -- đổi guard sang `NODE_ENV=development`, thay fixture School bằng PeakLand, tạo/reuse identity owner normalized và graph membership/Hiệu trưởng/grant/StaffProfile active trong advisory-lock transaction; reconciles link theo idempotent mà không chạm Google subject.
- [x] `apps/api/package.json`, `apps/api/scripts/reset-development-database.ts` (mới) -- thêm lệnh reset development và wrapper kiểm tra exact `NODE_ENV=development` trước khi gọi Prisma migrate reset/seed; lệnh phải không có đường chạy destructive khi runtime khác development.
- [x] `apps/api/scripts/test-integration.ts` -- tách environment của migration/seed bước integration khỏi Vitest runtime để test suite tiếp tục seed fixture một cách có chủ ý.
- [x] `apps/api/prisma/seed.test.ts`, `apps/api/src/integration/bootstrap.integration.test.ts`, `packages/contracts/src/structure.test.ts` -- thêm regression proof cho dev-only guard, PeakLand owner access graph và lệnh reset cấu hình đúng; không reset database thật trong unit test.
- [x] `README.md` -- cập nhật lệnh và mô tả development seed/reset: PeakLand owner đăng nhập được, reset hủy mọi dữ liệu database tại `DATABASE_URL` rồi migrate/seed lại, chỉ hợp lệ với `NODE_ENV=development`.

**Acceptance Criteria:**
- Given seed được gọi với `NODE_ENV=development` trên database rỗng, when hoàn thành, then PeakLand có đúng thông tin name/slug/prefix yêu cầu và `sonnh273@gmail.com` có owner graph active đủ để authorization chooser/resolve trả School context App.
- Given seed chạy lặp lại hoặc identity `sonnh273@gmail.com` đã tồn tại, when seed hoàn thành, then không có School/identity/membership/StaffProfile/grant trùng, initial-owner link và active binding hội tụ, và `googleSubject` không đổi.
- Given seed hoặc reset development được gọi khi `NODE_ENV` khác `development`, when command bắt đầu, then command thất bại trước database write/reset.
- Given developer gọi lệnh reset với `NODE_ENV=development` và một `DATABASE_URL` development, when Prisma hoàn thành, then migrations được áp dụng lại từ đầu và dataset PeakLand owner được seed lại.
- Given tài liệu seed/reset được đọc, when developer setup lại local environment, then tài liệu nêu rõ reset là destructive với toàn bộ database tại `DATABASE_URL` nhưng chỉ được lệnh cho phép trong development.

## Design Notes

`slug` là định danh School unique duy nhất trong schema và Ops cũng normalizes mã kỹ thuật này ở lowercase; vì vậy `pl` là biểu diễn persistence của “mã trường: PL”, trong khi `PL` được giữ nguyên tại `studentCodePrefix`. Development seed tạo cùng graph tối thiểu mà Ops provisioning hiện tạo để trải nghiệm test không có authorization path song song. Khác biệt có chủ ý là seed không tạo Platform Operator Operation/audit, vì đây không phải request control-plane thật.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test` -- expected: seed guard/graph unit regressions pass, không cần database thực.
- `pnpm --filter @passionedu/contracts test` -- expected: structural regression kiểm tra fixture PeakLand và reset development pass.
- `pnpm --filter @passionedu/api prisma:generate && pnpm --filter @passionedu/api typecheck` -- expected: Prisma client/schema và scripts TypeScript hợp lệ.

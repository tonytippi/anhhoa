---
title: 'Thêm hồ sơ học sinh và enrollment chờ xếp lớp'
type: 'feature'
created: '2026-09-23'
status: 'in-review'
baseline_commit: '640bc5b3d3f24e37c01b3b9defac333486febcac'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Danh bộ hiện chỉ nhận họ tên và ngày sinh, bắt buộc chọn lớp ngay khi tạo, rồi buộc nhân viên nhập lại phụ huynh trên một hàng khác. Trường cần một intake đủ hồ sơ, tiếp nhận trẻ chờ xếp lớp và giảm thao tác lặp.

**Approach:** Bổ sung tên thường gọi, giới tính, địa chỉ, mã định danh cá nhân và ảnh hồ sơ tùy chọn vào Student; làm lại form intake theo nhóm thông tin với đúng hai lựa chọn nhập học: `Xếp lớp` hoặc `Chờ xếp lớp`; tạo một liên kết phụ huynh pending từ chính form sau khi Student được xác nhận. Với hồ sơ chờ xếp lớp, Admin có thao tác `Xếp lớp` riêng để chọn lớp và ngày hiệu lực, tạo lịch sử phân lớp rồi chuyển enrollment thành `ENROLLED`.

## Boundaries & Constraints

**Always:** School là tenant root; API xác thực `ROSTER_MANAGE`, Origin/CSRF, idempotency, Operation, audit và transaction vẫn là nguồn duy nhất cho mọi mutation. `studentCode` do server sinh, bất biến và không thay bằng mã định danh cá nhân. `personalIdentifier` là dữ liệu hồ sơ tùy chọn, được trim, không trả sang Parent portal, và khi có giá trị phải unique case-insensitively trên toàn hệ thống để một người không thể có hai hồ sơ định danh. `preferredName` và `address` optional, tối đa 100 và 500 ký tự; gender chỉ nhận `NAM`, `NU`, `KHAC`. Form intake chỉ gửi hai lựa chọn: `Xếp lớp` map server-authoritative thành `ENROLLED` và bắt buộc một lớp active đúng SchoolYear/School; `Chờ xếp lớp` map thành `WAITING_FOR_CLASS` và không gửi/không gán lớp. Admin xếp lớp sau đó bằng mutation riêng, idempotent: enrollment phải đang `WAITING_FOR_CLASS`, lớp active thuộc cùng School/SchoolYear, effective date hợp lệ; server tạo snapshot/assignment lịch sử và chuyển lifecycle thành `ENROLLED` trong cùng transaction. Các lifecycle còn lại chỉ đổi qua thao tác quản lý enrollment hiện hữu, không xuất hiện trong form tạo. Ảnh hồ sơ là media Student riêng, tối đa một ảnh, chỉ JPEG/PNG/WebP có signature hợp lệ không rỗng tối đa 5 MiB, School-scoped, không có URL công khai, đọc qua endpoint API `private, no-store`/`nosniff`, không đi vào Parent DTO hoặc tái dùng `EvidenceReference`. Liên kết phụ huynh optional gồm tên, email, điện thoại; chỉ POST sau khi Operation tạo Student hoàn tất/reconcile được, mỗi mutation có Idempotency-Key/Operation riêng và hiển thị kết quả server-confirmed.

**Ask First:** Nếu migration hiện có dữ liệu Student mà không thể thêm các cột nullable và thay đổi class enrollment theo cách additive, dừng để xác nhận phương án migration/backfill.

**Never:** Không thêm đúng/trái tuyến, quốc tịch, dân tộc, ảnh/metadata công khai, media vào Parent portal, hay chỉnh sửa Student profile sau khi tạo. Không dùng `EvidenceReference` hoặc endpoint Teacher cho ảnh hồ sơ; không có orphan upload trước Student confirmation. Không cho browser tự sinh mã học sinh, tự suy diễn lớp/trạng thái, optimistic record hoặc tự POST lại sau timeout. Không hiển thị toàn bộ mã định danh trong danh sách Danh bộ mặc định. Không coi tạo Student, ảnh và Parent link là một transaction hay tự rollback Student khi một bước tiếp theo thất bại.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tạo hồ sơ đã xếp lớp | Admin chọn `Xếp lớp`, chọn lớp active | API map thành `ENROLLED`; Student và enrollment/class snapshot được tạo atomically; Operation trả DTO mới | UI chỉ refresh sau server confirmation |
| Chờ xếp lớp | Admin chọn `Chờ xếp lớp`, không có lớp | API map thành `WAITING_FOR_CLASS`; Student và enrollment không có class assignment được tạo, giữ được trong danh sách/lịch sử | UI ẩn/vô hiệu hóa lớp, không báo lỗi `classId` |
| Xếp lớp sau intake | Admin chọn lớp active và ngày hiệu lực cho enrollment đang chờ | API atomically tạo assignment/snapshot và chuyển thành `ENROLLED` | Không cho xếp lớp foreign/archived, enrollment đã có lớp, hoặc date sai |
| Mã định danh trùng | Giá trị khác chữ hoa/thường đã có ở School khác | Không ghi Student/enrollment/Operation hoàn tất | API trả conflict ổn định, UI giữ input và hiện lỗi cạnh trường |
| Intake có ảnh/phụ huynh | Student Operation đã hoàn tất; Admin chọn ảnh hợp lệ và nhập đủ contact phụ huynh | API lưu ảnh hồ sơ private và tạo Parent link pending bằng Operation riêng; UI chỉ hiện các kết quả server-confirmed | Lỗi/timed-out bước sau không xóa Student, giữ đúng staged input/Operation để reconcile |
| Media không hợp lệ | Không phải JPEG/PNG/WebP, trống hoặc quá 5 MiB; Student foreign | Không có blob/photo record được ghi hay đọc chéo tenant | Validation/not-found chuẩn, response image luôn `private, no-store`/`nosniff` |
| Tổ hợp xếp lớp sai | `Xếp lớp` không có lớp; `Chờ xếp lớp` có classId; lớp foreign/archived; gender lạ | Không có durable write | Validation/not-found chuẩn, không lộ tenant khác |
| Timeout/switch School | Kết quả POST không chắc chắn hoặc đổi School | Giữ form/Operation, reconcile trước retry, không hiển thị dữ liệu School cũ | Tái dùng pending-operation guard hiện hữu |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `Student` (312-334) hiện chỉ có name/birthdate; `StudentEnrollment` (336+) bắt buộc `classId`/`className`, cần phản chiếu profile mới và enrollment không lớp; `EvidenceReference` (1004+) là attendance/handover-only, không tái dùng cho Student photo.
- `apps/api/prisma/migrations/20260917000001_student_enrollment_history/migration.sql` -- mẫu tenant graph và Student index; migration mới phải additive, giữ FK/check constraint lịch sử tương thích với enrollment chưa phân lớp.
- `apps/api/src/modules/roster/roster.service.ts` -- `studentDto()` (167-176), truy vấn `students()`/`student()` (255-324), `createStudent()` (1124-1240) và `mutate()` (2386+) là owner cho DTO, validation, lock, audit, idempotency và Operation.
- `apps/api/src/modules/roster/roster.controller.ts` -- route POST Student đã gọi mutation guard; giữ route/header contract.
- `apps/api/src/modules/parents/parents.service.ts` -- `create()` (68-169) đã ownership cho normalize/upsert ParentProfile, pending/reactivate StudentParent, audit và mutation guard; tái dùng endpoint riêng sau Student confirmation, không copy logic vào roster.
- `apps/api/src/modules/attendance/attendance.service.ts` và `attendance.controller.ts` -- upload evidence (574-633) cung cấp giới hạn MIME/size, header read và Operation pattern để tham chiếu; Evidence domain/route là read-only evidence, không sửa hoặc tái dùng.
- `apps/api/src/integration/roster.integration.test.ts` -- helper `createStudent()` (39-44) và invariant Student/enrollment (100-196) là proof PostgreSQL cho unique, tenant graph, replay và lifecycle.
- `apps/web/src/roster/roster-workspace.tsx` -- Student type (49-55), state/submit (khoảng 276, 741-758), `post()` reconciliation (646-703), form/list (2001-2145), Parent link submit (777-799) là surface cần thành staged intake; không auto-replay mutation.
- `apps/web/src/roster/roster-workspace.test.tsx` -- test server-confirmed creation và field error (107-134); thêm form profile, class optional và conflict preservation.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/api/prisma/schema.prisma` và migration PostgreSQL mới -- thêm profile nullable, enum gender, global case-insensitive unique partial index cho mã định danh có giá trị, StudentPhoto riêng tối đa một ảnh và enrollment chưa gán lớp -- database bảo vệ uniqueness, media ownership và tenant graph thay vì UI.
- [ ] `apps/api/src/modules/roster/roster.service.ts`, `roster.controller.ts` và module wiring -- parse/validate/normalize profile, intake status và DTO/read; server map `PLACED` thành `ENROLLED` với Class bắt buộc, `WAITING_FOR_CLASS` thành enrollment không lớp, thêm mutation xếp lớp atomically cho enrollment đang chờ, và upload/read ảnh Student scoped; chỉ lock/validate Class, snapshot và tạo assignment khi `PLACED` hoặc xếp lớp sau.
- [ ] `apps/api/src/integration/roster.integration.test.ts` và controller tests liên quan -- chứng minh profile/DTO, uniqueness global không phân biệt hoa thường, nullable identifier, chờ xếp lớp, photo validation/read isolation/cache headers, rejection lifecycle/class, replay và isolation.
- [ ] `apps/web/src/roster/roster-workspace.tsx` -- thay form tạo bằng nhóm Thông tin học sinh/Nhập học/Phụ huynh, dùng input có label cho profile, địa chỉ, gender, identifier, ảnh và đúng hai radio/select status `Xếp lớp`/`Chờ xếp lớp`; chỉ hiện/bắt buộc chọn lớp khi `Xếp lớp`; sau confirmed Student, upload ảnh rồi create Parent link tuần tự, giữ staged errors/focus/Operation reconciliation và hiển thị status/lịch sử không lớp bằng copy tiếng Việt.
- [ ] `apps/web/src/roster/roster-workspace.test.tsx` -- kiểm tra staged payload/refresh server-confirmed cho profile, ảnh, Parent link và `WAITING_FOR_CLASS`; retention khi identifier/media/contact lỗi và không render lớp giả cho enrollment chưa xếp lớp.

**Acceptance Criteria:**
- Given School Admin có `ROSTER_MANAGE`, when tạo học sinh với profile/địa chỉ hợp lệ và lớp active, then API persist profile, generated code, enrollment/class history, audit và School-scoped Operation trong một transaction.
- Given Admin chọn `Chờ xếp lớp` và không có `classId`, when gửi intake hợp lệ trong SchoolYear active, then API map thành `WAITING_FOR_CLASS`, tạo enrollment không gán lớp và UI biểu thị “Chờ xếp lớp”, không tự chọn lớp bất kỳ.
- Given enrollment đang `WAITING_FOR_CLASS`, when Admin xếp một lớp active cùng SchoolYear với effective date hợp lệ, then API atomically gán lớp/snapshot, ghi audit/Operation và chuyển enrollment thành `ENROLLED`.
- Given mã định danh đã được dùng ở bất kỳ School nào, when một lệnh create dùng cùng giá trị khác casing, then database/API từ chối trước khi tạo record và UI giữ nguyên tất cả input với lỗi accessible tại mã định danh.
- Given Admin chọn `Xếp lớp`, when classId trống hoặc không phải lớp active đúng tenant/year, then API từ chối không ghi dữ liệu và không lộ lớp tenant khác; given Admin chọn `Chờ xếp lớp`, then API từ chối bất kỳ classId nào được gửi.
- Given Student đã server-confirmed, when Admin chọn ảnh hợp lệ và nhập contact phụ huynh hợp lệ, then portal thực hiện từng Operation kế tiếp và chỉ hiển thị ảnh/private profile cùng Parent link pending sau response/reconciliation thành công.
- Given upload ảnh hoặc tạo Parent link lỗi hay timeout, when Student đã được tạo, then Student vẫn tồn tại, portal giữ dữ liệu của bước lỗi và chỉ reconcile Operation đó mà không POST lại Student.
- Given response timeout hoặc School switch trong lúc tạo, when kết quả tới hoặc user tiếp tục thao tác, then portal chỉ reconcile Operation đã lưu, không replay POST hoặc render dữ liệu sai School.

## Design Notes

`personalIdentifier` được unique trên toàn hệ thống vì đó là định danh của một con người, không phải mã quản lý theo trường. Unique partial index cho phép nhiều Student chưa có mã; error database phải được map thành lỗi domain `personalIdentifier`, không rò lỗi Prisma. Intake status tách khỏi lifecycle để người nhập chỉ có hai quyết định vận hành: `PLACED`/Xếp lớp hoặc `WAITING_FOR_CLASS`/Chờ xếp lớp; service map và enforce lifecycle/class thay vì tin raw lifecycle từ browser. Những lifecycle và luồng chuyển lớp hiện có tiếp tục dựa trên assignment/snapshot hiện hữu. StudentPhoto phải là record/blob riêng với endpoint authenticated, không cache và không public URL; upload chỉ bắt đầu sau Student Operation đã confirmed, nên không tồn tại media không chủ. Parent contact là bước tiếp theo độc lập để tái dùng chính xác semantics pending/binding/revoke hiện có.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate && pnpm --filter @passionedu/api test` -- expected: schema và API/unit tests pass.
- `TARGET_INTEGRATION_DATABASE_URL=... pnpm --filter @passionedu/api test:integration` -- expected: roster PostgreSQL invariants, gồm unique identifier, enrollment chưa xếp lớp và private Student photo, pass.
- `pnpm --filter @passionedu/admin-web test` -- expected: form, validation và reconciliation tests pass.
- `pnpm lint && pnpm typecheck` -- expected: workspace lint/type checks pass.

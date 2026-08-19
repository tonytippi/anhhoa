---
title: 'Story 2.1: Quản lý Lớp đang hoạt động và lưu trữ'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_commit: 'c0eb8b5c4912527bd4dd2de5698aab817c40060c'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Hệ thống chưa có dữ liệu Lớp để Admin duy trì học phí hiện hành, tìm lại Lớp đã lưu trữ, hoặc bảo vệ dữ liệu đang được Học sinh đang học sử dụng. Điều này chặn các luồng quản lý Học sinh và lập hóa đơn tiếp theo.

**Approach:** Bổ sung resource `/classes` do API sở hữu, với lưu trữ mềm, học phí VND nguyên và kiểm tra quan hệ Học sinh trong transaction. Thay placeholder `/lop` bằng trang quản trị Lớp có danh sách, tìm/lọc/phân trang, form dialog và confirmation archive đáp ứng accessibility.

## Boundaries & Constraints

**Always:** Dùng UUID, REST JSON camelCase, list `{ data, meta }` và action `{ data }`; API validate mọi mutation, giữ cookie auth/CSRF hiện hữu, và map `BIGINT` sang JSON safe integer. Lớp có `ACTIVE`/`ARCHIVED`, không hard-delete; archive phải atomically chặn Lớp có Student `ACTIVE` đang gán, trả `CLASS_HAS_ACTIVE_STUDENTS` cùng số lượng; Lớp archived vẫn xem/tìm được nhưng không được dùng cho gán/tạo hóa đơn mới. UI dùng React Query, chỉ invalidate sau thành công, một `h1`, table có nhãn, status có chữ, lỗi field qua `aria-describedby`/live region, giữ form khi lỗi, modal archive trap/return focus và khóa close/action lúc gửi.

**Ask First:** Dừng hỏi người dùng nếu cần vượt giới hạn Story này để xây UI/quy tắc quản trị Học sinh đầy đủ, thay đổi artifact planning đã final, hoặc áp thêm trần học phí ngoài integer không âm và JSON safe integer.

**Never:** Không đưa database/Prisma vào web, không tin tổng/tiền từ client ngoài validation API, không xóa Lớp, không tự archive khi còn Học sinh active, không sửa snapshot Hóa đơn, không triển khai chuyển Lớp/batch invoice, và không thêm retry/offline queue cho mutation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tạo/cập nhật Lớp | Tên hợp lệ, học phí nguyên VND không âm trong JSON safe range | Persist `BIGINT`; action trả Class với tiền number; UI định dạng `đ` khi blur | Lỗi DTO/API hiện cạnh field, dialog giữ nguyên dữ liệu |
| Xem danh sách | Search, filter trạng thái và page hợp lệ | API trả `{ data, meta }`; URL và table phản ánh query; archive vẫn có thể xem | Loading skeleton; empty/error chỉ một CTA phù hợp |
| Archive thành công | Lớp `ACTIVE` không có Student `ACTIVE` gán hiện tại | Transaction đổi sang `ARCHIVED`, không xóa record | Modal khóa khi gửi, trả focus trigger khi đóng |
| Archive bị chặn | Lớp `ACTIVE` có một hay nhiều Student `ACTIVE` gán hiện tại | Không đổi trạng thái; lỗi code `CLASS_HAS_ACTIVE_STUDENTS` chứa `activeStudentCount` | UI nêu số bị ảnh hưởng và hướng dẫn chuyển/cho nghỉ học trước |
| Request không hợp lệ | Học phí âm, không nguyên/không safe, ID không tồn tại hoặc CSRF/origin sai | API không persist và trả error shape chuẩn | Client giữ input, hiển thị lỗi gần action, không invalidate cache |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- hiện chỉ có `Admin`; thêm enum/model `Class` và model/relation `Student` tối thiểu để enforce archive invariant.
- `apps/api/prisma/migrations/20260819000000_add_admin/migration.sql` -- migration duy nhất; thêm migration mới đã commit cho Class/Student/status/index, không dùng `db push`.
- `apps/api/src/app.module.ts:9-11` -- đăng ký `ClassesModule`; auth guard và CSRF middleware đã global.
- `apps/api/src/main.ts:18-22` -- giữ ValidationPipe, CORS và ApiExceptionFilter hiện hữu cho DTO/resource mới.
- `apps/api/src/common/filters/api-exception.filter.ts:5-13` -- mở rộng an toàn để domain exception có code `CLASS_HAS_ACTIVE_STUDENTS` và metadata count nhưng vẫn giữ error shape.
- `apps/api/src/common/prisma/prisma.service.ts:5-7` -- Prisma access cần dùng bởi `ClassesService`.
- `apps/api/src/modules/auth/auth.controller.ts:14-54` và `modules/admins/admins.service.ts:14-35` -- mẫu controller mỏng, service Prisma và `{ data }` response.
- `apps/api/src/modules/admins/admins.service.test.ts:5-28` -- mẫu Vitest service unit test với Prisma mock; thêm tests cho rules Class.
- `apps/web/src/app/app.tsx:13-45` và `src/features/overview/page.tsx:4-9` -- hiện luôn render placeholder; route `/lop` phải render feature Class trong AuthBoundary/shell hiện có.
- `apps/web/src/app/routes.ts:1-9` và `src/components/sidebar.tsx:11-14` -- `/lop` và điều hướng đã tồn tại, giữ nhãn/khả năng truy cập.
- `apps/web/src/app/api/client.ts:5-27` -- chỉ có `getJson`; bổ sung REST write helper credentialed/CSRF và parse error tái sử dụng.
- `apps/web/src/app/api/auth.ts:14-46` -- mẫu React Query key bắt đầu bằng resource và parser response; áp dụng `['classes', ...]`.
- `apps/web/src/components/navigation-sheet.tsx:5-14`, `components/menu-button.tsx:2`, `src/index.css:11-41` -- mẫu Base UI Dialog/focus và design tokens để xây form/confirmation/table responsive.
- `apps/web/e2e/application-shell.spec.ts:9-170` -- mẫu Playwright authenticated shell/a11y/breakpoint; bổ sung luồng Lớp khi fixture/API mock phù hợp.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<timestamp>_add_classes_and_students/migration.sql` -- thêm Class/Student và enum trạng thái với `monthlyTuition BIGINT`, timestamps, UUID, relation/index cần cho đếm Student active; tạo migration commit được.
- [x] `apps/api/src/common/filters/api-exception.filter.ts`, `apps/api/src/common/errors/*` -- hỗ trợ domain error code và safe metadata để archive báo `CLASS_HAS_ACTIVE_STUDENTS` cùng count, vẫn giữ shape chuẩn.
- [x] `apps/api/src/modules/classes/*`, `apps/api/src/app.module.ts` -- xây DTO query/body, mapper serialization safe number, controller `/classes`, service list/detail/create/update/archive transactional; chỉ dùng Class active cho future assignment contract và không hard-delete.
- [x] `apps/api/src/modules/classes/*.test.ts`, `apps/api/src/common/filters/*.test.ts` -- unit test query/CRUD, tiền, soft archive, active-student block/count và serialization/error contract.
- [x] `apps/web/src/app/api/client.ts`, `apps/web/src/features/classes/api.ts` -- bổ sung typed Class/list/meta/error types, CSRF-aware mutation request và React Query queries/mutations; chỉ invalidate `classes` thành công.
- [x] `apps/web/src/features/classes/*`, `apps/web/src/features/overview/page.tsx` hoặc route composition tương ứng, `apps/web/src/index.css` -- thay `/lop` placeholder bằng page danh sách/detail theo scope với search trước filter và URL, pagination, skeleton/empty/error, form create/edit VND, archive confirmation và responsive/a11y states.
- [x] `apps/web/src/features/classes/*.test.tsx`, `apps/web/e2e/classes.spec.ts` -- kiểm tra list/form/archive error, accessibility/focus behavior và luồng UI chủ đạo với API fixture/mock phù hợp dự án.

**Acceptance Criteria:**
- Given Admin đã xác thực mở `/lop`, when list hoặc detail tải, then API list trả `{ data, meta }` và UI hiển thị table có nhãn, search/filter/pagination, trạng thái active/archive và danh sách Học sinh active hiện thuộc Lớp, cùng loading/empty/error state đúng.
- Given Admin lưu form Lớp với tên và học phí VND không âm, when API xác nhận, then `monthlyTuition` lưu `BIGINT`, response là safe integer và UI hiển thị phân tách hàng nghìn cùng `đ`; when validation hoặc API lỗi, then lỗi được liên kết field và dialog không đóng/mất input.
- Given Admin archive Lớp active không có Học sinh active, when xác nhận modal, then record thành archived thay vì bị xóa và vẫn xem được nhưng không đủ điều kiện cho luồng mới.
- Given Lớp active có Học sinh active gán vào, when Admin thử archive, then API trả `CLASS_HAS_ACTIVE_STUDENTS` cùng số lượng và UI hướng dẫn chuyển hoặc cho nghỉ học các em trước, không thay đổi Lớp.

## Design Notes

`Student` xuất hiện ở migration này chỉ để biểu diễn quan hệ/trạng thái tối thiểu bắt buộc cho invariant archive và detail Class. Story 2.2 là chủ sở hữu của CRUD/UX quản trị Student; tránh seed, endpoint hoặc surface Student vượt phạm vi hiện tại.

## Verification

**Commands:**
- `pnpm --filter api prisma:generate` -- expected: Prisma client sinh thành công từ schema/migration mới.
- `pnpm --filter api test` -- expected: test Class/error hiện hữu và mới đều pass.
- `pnpm --filter web test` -- expected: test feature Class pass.
- `pnpm typecheck` -- expected: toàn bộ workspace TypeScript strict pass.
- `pnpm lint` -- expected: lint workspace pass.
- `pnpm build` -- expected: Turbo build API và web pass.

## Suggested Review Order

**Lớp dữ liệu và bất biến**

- Mô hình dữ liệu giữ Lớp/Học sinh bằng trạng thái và tiền JSON-safe.
  [`schema.prisma:19`](../../apps/api/prisma/schema.prisma#L19)

- Migration áp điều kiện tiền không âm, JSON-safe ngay tại PostgreSQL.
  [`migration.sql:4`](../../apps/api/prisma/migrations/20260819010000_add_classes_and_students/migration.sql#L4)

- Service chuẩn hóa dữ liệu, phân trang nhất quán và archive serializable.
  [`classes.service.ts:11`](../../apps/api/src/modules/classes/classes.service.ts#L11)

**REST và lỗi nghiệp vụ**

- Controller giữ boundary `/classes` mỏng, DTO/service sở hữu quy tắc.
  [`classes.controller.ts:5`](../../apps/api/src/modules/classes/classes.controller.ts#L5)

- Domain exception giới hạn public code và metadata được phép.
  [`domain.exception.ts:3`](../../apps/api/src/common/errors/domain.exception.ts#L3)

- Filter duy trì JSON error contract cho Nest và lỗi domain.
  [`api-exception.filter.ts:5`](../../apps/api/src/common/filters/api-exception.filter.ts#L5)

**Trải nghiệm quản trị Lớp**

- Trang `/lop` nối URL filters, danh sách, pagination và mutation states.
  [`page.tsx:10`](../../apps/web/src/features/classes/page.tsx#L10)

- Form dialog xác thực từng field, định dạng VND và trả focus trigger.
  [`page.tsx:35`](../../apps/web/src/features/classes/page.tsx#L35)

- Archive dialog nêu tác động, khóa lúc gửi và hướng dẫn lỗi nghiệp vụ.
  [`page.tsx:52`](../../apps/web/src/features/classes/page.tsx#L52)

- REST client lấy CSRF single-flight nhưng không replay mutation.
  [`client.ts:21`](../../apps/web/src/app/api/client.ts#L21)

**Kiểm thử**

- Service tests bao phủ tiền, query, archive và trạng thái không phá hủy.
  [`classes.service.test.ts:1`](../../apps/api/src/modules/classes/classes.service.test.ts#L1)

- UI tests kiểm tra validation field, trạng thái lỗi và focus restoration.
  [`page.test.tsx:1`](../../apps/web/src/features/classes/page.test.tsx#L1)

- Playwright xác minh list, archive thành công và archive bị chặn.
  [`classes.spec.ts:6`](../../apps/web/e2e/classes.spec.ts#L6)

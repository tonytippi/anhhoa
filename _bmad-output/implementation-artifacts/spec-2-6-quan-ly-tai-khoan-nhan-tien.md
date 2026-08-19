---
title: 'Story 2.6: Quản lý Tài khoản nhận tiền'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_commit: 'b0ced1a31b0a2498a99b09a93a02d209e174330b'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Admin chưa có dữ liệu Tài khoản nhận tiền để chọn hợp lệ cho các Hóa đơn chuyển khoản trong Epic 3, đồng thời cần ngừng dùng tài khoản mà không mất dấu vết lịch sử.

**Approach:** Bổ sung resource `bank-accounts` có trạng thái tại PostgreSQL, REST API quản trị và trang `/tai-khoan-nhan-tien` để thêm, xem, kích hoạt hoặc ngừng dùng tài khoản qua các dialog trợ năng.

## Boundaries & Constraints

**Always:** Chỉ Admin đã xác thực được đọc/ghi `/bank-accounts`; mỗi tài khoản gồm mã ngân hàng VietQR, số tài khoản, tên chủ tài khoản và `ACTIVE`/`INACTIVE`. Chuẩn hóa chuỗi bằng trim, server DTO validation là nguồn chân lý, REST camelCase trả list `{ data, meta }` và resource/action `{ data }`, UUID/timestamp theo convention hiện hữu. Lưu giữ bằng trạng thái, tuyệt đối không hard-delete. Danh sách sắp xếp `createdAt DESC, id DESC`, hỗ trợ search, filter trạng thái và pagination. Tài khoản inactive không đủ điều kiện cho picker Hóa đơn `DRAFT` ở Epic 3 nhưng dữ liệu phải còn để invoice snapshot `PENDING`/`COMPLETED` hiển thị sau này. Web chỉ gọi credentialed REST, lấy CSRF trước write, không tự retry mutation đã bắt đầu, chỉ invalidate query sau response thành công.

**Block If:** Dừng nếu triển khai buộc phải sửa lifecycle, snapshot, QR hoặc báo cáo Hóa đơn hiện hữu, hoặc migration không thể thêm trạng thái Tài khoản nhận tiền mà bảo toàn dữ liệu hiện có.

**Never:** Không tạo `DELETE` endpoint/action, không sửa planning artifacts final hoặc migration lịch sử, không thêm luồng chọn/snapshot Hóa đơn của Epic 3, không tin validation phía web thay server, và không dùng floating point.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Xem và thêm | Admin mở route, hoặc gửi mã ngân hàng, số tài khoản, tên chủ tài khoản hợp lệ | List có table/status/pagination; create trả account `ACTIVE` và account xuất hiện trong list | Loading, empty, error có bề mặt rõ ràng; validation trả field errors, form giữ input và mở |
| Lọc danh sách | Search, `ACTIVE`/`INACTIVE`, hoặc page ngoài phạm vi | API trả đúng resource phù hợp theo thứ tự ổn định; URL phản ánh filter; page ngoài phạm vi trả `data` rỗng cùng meta hợp lệ | Status/filter không hợp lệ bị DTO từ chối theo error shape chuẩn |
| Ngừng dùng | Account `ACTIVE`, Admin xác nhận dialog | Status thành `INACTIVE`, không có hard-delete; gọi lại trả resource inactive hiện hữu | Dialog khóa đóng/action khi gửi, lỗi giữ dialog và nêu gần action, focus trở về trigger khi đóng |
| Kích hoạt | Account `INACTIVE`, Admin chọn kích hoạt | Status thành `ACTIVE` để Epic 3 có thể chọn trong draft picker | Không tìm thấy trả 404; lỗi giữ trạng thái UI nhất quán |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma:39-101` -- thêm `BankAccountStatus` và `BankAccount` UUID/status/timestamps/index; tiền và các relation invoice chưa thuộc phạm vi story.
- `apps/api/prisma/migrations/20260819050000_add_invoice_template/migration.sql` -- migration mới phải đặt ở thư mục migration mới, không sửa migration này hoặc migration cũ.
- `apps/api/src/modules/classes/classes.dto.ts:5-19`, `classes.controller.ts:7-18`, `classes.service.ts:25-68` -- mẫu DTO trim/pagination, thin controller, `{ data, meta }`, serialization timestamp và transition idempotent theo status để áp dụng có chọn lọc.
- `apps/api/src/modules/invoice-template/` -- chỉ tham khảo validation/service/test convention; không tái dùng singleton, item order, delete hay transaction retry của template.
- `apps/api/src/app.module.ts` -- đăng ký module mới; auth guard và CSRF/origin validation global tiếp tục bao phủ mutation.
- `apps/api/src/common/filters/api-exception.filter.ts` và `apps/api/src/common/errors/domain.exception.ts` -- giữ error envelope hiện hữu; chỉ thêm error code ổn định nếu service thực sự cần.
- `apps/api/src/modules/classes/classes.integration.test.ts` -- mẫu integration PostgreSQL/migration fail-closed để kiểm chứng persistence, index và transition.
- `apps/web/src/features/classes/api.ts` -- tái dùng REST client, runtime parser, React Query key/mutation và invalidation sau confirmed success.
- `apps/web/src/features/classes/page.tsx:10-51` -- mẫu list URL filter, table accessible, dialog validate blur/submit, preserve form errors và confirmation/focus return.
- `apps/web/src/app/app.tsx:4-51` -- import và route `/tai-khoan-nhan-tien` hiện đang rơi vào `PlaceholderPage`; đăng ký page mới.
- `apps/web/src/app/routes.ts` -- navigation đã chứa route tài khoản nhận tiền; không thay đổi sidebar nếu route/page được đăng ký đúng.
- `apps/web/src/features/classes/page.test.tsx`, `apps/web/e2e/classes.spec.ts` -- convention Vitest/Testing Library và Playwright mock REST, dialog/focus/accessibility.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma`, migration mới trong `apps/api/prisma/migrations/` -- thêm enum/model/index trạng thái, ràng buộc chuỗi cần thiết và migration forward-only -- tạo nguồn dữ liệu bền vững không xóa cứng.
- [x] `apps/api/src/modules/bank-accounts/` và `apps/api/src/app.module.ts` -- triển khai DTO, controller, service list/get/create/activate/deactivate với serialization và error contracts -- API sở hữu toàn bộ validation/persistence/transition.
- [x] `apps/api/src/modules/bank-accounts/*.test.ts` -- unit và PostgreSQL integration cho trim/validation, ordering/pagination, create, activate/deactivate idempotent, 404 và không có delete path -- phủ matrix persistence/edge cases.
- [x] `apps/web/src/features/bank-accounts/api.ts`, `page.tsx`, và `apps/web/src/app/app.tsx` -- thêm typed REST query/mutations, route và quản trị table/dialog -- cung cấp bề mặt Admin bên ngoài với URL filter, feedback và accessibility.
- [x] `apps/web/src/features/bank-accounts/*.test.tsx` và `apps/web/e2e/bank-accounts.spec.ts` -- cover states, validation/form preservation, transition confirmation/activation, status text và focus return -- tránh regression giao diện/REST.

**Acceptance Criteria:**
- Given Admin truy cập `/tai-khoan-nhan-tien`, when list tải thành công hoặc không có dữ liệu, then table có caption/aria-label, trạng thái có nhãn chữ, action luôn truy cập được và empty/loading/error state có hành động phù hợp.
- Given Admin thêm Tài khoản nhận tiền hợp lệ, when API xác nhận lưu, then response và table thể hiện mã ngân hàng VietQR, số tài khoản, tên chủ tài khoản và trạng thái `ACTIVE`; không có endpoint hoặc UI action xóa cứng.
- Given Admin nhập sai dữ liệu hoặc write không thành công/timeout, when form submit, then dialog vẫn mở, giữ dữ liệu, lỗi ở field/action qua live/accessible error và web không tự gửi lại request.
- Given Tài khoản active cần ngừng dùng, when Admin xác nhận dialog nêu tài khoản bị ảnh hưởng, then API chuyển sang `INACTIVE` idempotently và UI phản ánh badge `Ngừng dùng`, khóa thao tác trong lúc gửi và trả focus về trigger khi đóng.
- Given Tài khoản inactive, when Admin kích hoạt, then API trả account `ACTIVE` và UI refresh sau response thành công để nó sẵn sàng làm lựa chọn draft ở Epic 3.

## Spec Change Log

## Review Triage Log

### 2026-08-19 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 0, medium 6, low 0)
- defer: 0
- reject: 9: (high 0, medium 5, low 4)
- addressed_findings:
  - `[medium] [patch]` Đổi trạng thái dùng transaction và `update` trả đúng record vừa ghi, tránh response sai khi activate/deactivate đồng thời.
  - `[medium] [patch]` Validate đủ ba trường khi submit và map `fieldErrors` của API vào input có `aria-describedby`.
  - `[medium] [patch]` Đồng bộ filters khi browser Back/Forward, về page 1 sau create và giữ điều hướng Trước cho trang rỗng ngoài phạm vi.
  - `[medium] [patch]` Sửa unit transition mock để assert trạng thái `INACTIVE` rồi `ACTIVE` thực tế.
  - `[medium] [patch]` Thêm controller contract test cho delegation và DTO rejection ở query/path/body.
  - `[medium] [patch]` Mở rộng integration/UI coverage cho pagination ngoài phạm vi, create thành công, errors theo field và URL filters.

## Auto Run Result

- Summary: Hoàn tất quản lý Tài khoản nhận tiền với dữ liệu PostgreSQL theo trạng thái, REST API không xóa cứng và trang quản trị `/tai-khoan-nhan-tien` có tìm kiếm, lọc, phân trang, thêm, kích hoạt/ngừng dùng.
- Files changed: Prisma schema/migration thêm `BankAccount`; API module sở hữu DTO, controller, persistence và transition; web feature thêm REST adapter, table/dialog và route; API/web/E2E tests xác minh contract và luồng Admin; sprint status ghi nhận story hoàn tất.
- Review findings: 6 patches applied (medium 6); 0 deferred; 9 rejected. Các đề xuất VietQR catalogue, format số tài khoản, unique account và invoice picker/snapshot bị loại vì không có canonical contract hoặc ngoài Story 2.6.
- Follow-up review recommendation: true. Patch score là `3 * 6 = 18`.
- Verification: `pnpm --filter api prisma:generate`; PostgreSQL integration; API unit 76 tests; web unit 60 tests; Playwright `e2e/bank-accounts.spec.ts`; workspace `typecheck`, `lint`, `test`, `build`; và `git diff --check` đều pass.
- Residual risks: Không có catalogue VietQR hay format số tài khoản được PRD định nghĩa để validate chặt hơn. Epic 3 vẫn cần áp dụng lọc active và snapshot khi aggregate Invoice được triển khai.

## Design Notes

Thông tin tài khoản không có API update trong story vì acceptance chỉ yêu cầu thêm, kích hoạt và ngừng dùng; không suy diễn quyền chỉnh sửa thông tin ngân hàng. Invoice chưa tồn tại trong schema, nên story chỉ bảo đảm source account có trạng thái; điều kiện loại inactive khỏi draft picker và khả năng hiển thị snapshot sẽ được thực thi cùng aggregate Invoice ở Epic 3.

## Verification

**Commands:**
- `pnpm --filter api prisma:generate` -- expected: Prisma client khớp schema account mới.
- `docker compose -f docker-compose.test.yml up -d --wait` -- expected: PostgreSQL integration database healthy.
- `pnpm --filter api test` -- expected: unit test DTO/service/controller bank accounts pass.
- `pnpm --filter api test:integration` -- expected: migration và persistence/transition PostgreSQL pass.
- `pnpm --filter web test -- src/features/bank-accounts` -- expected: unit test trang/account API pass.
- `pnpm --filter web exec playwright test e2e/bank-accounts.spec.ts` -- expected: browser flow, dialog và accessibility pass.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: workspace checks pass.
- `docker compose -f docker-compose.test.yml down -v` -- expected: integration service/data được dọn sau xác minh.

## Suggested Review Order

**API And Persistence**

- Module service owns list contracts, normalization, serialization, and idempotent status transitions.
  [`bank-accounts.service.ts:14`](../../apps/api/src/modules/bank-accounts/bank-accounts.service.ts#L14)

- Schema and forward-only migration retain accounts through status rather than deletion.
  [`schema.prisma:108`](../../apps/api/prisma/schema.prisma#L108)

- Controller exposes only read, create, activate, and deactivate REST operations.
  [`bank-accounts.controller.ts:7`](../../apps/api/src/modules/bank-accounts/bank-accounts.controller.ts#L7)

**Admin Interface**

- Route page mirrors list filters in the URL and keeps status actions accessible.
  [`page.tsx:8`](../../apps/web/src/features/bank-accounts/page.tsx#L8)

- Typed REST adapter validates response shape and invalidates only after successful writes.
  [`api.ts:11`](../../apps/web/src/features/bank-accounts/api.ts#L11)

- Application route makes the receiving-account screen reachable from its existing navigation entry.
  [`app.tsx:52`](../../apps/web/src/app/app.tsx#L52)

**Verification**

- Unit and PostgreSQL integration coverage exercise persistence, ordering, and transitions.
  [`bank-accounts.integration.test.ts:14`](../../apps/api/src/modules/bank-accounts/bank-accounts.integration.test.ts#L14)

- UI tests cover text statuses, retained form errors, confirmation, and focus return.
  [`page.test.tsx:13`](../../apps/web/src/features/bank-accounts/page.test.tsx#L13)

- Browser flow validates protected-route rendering and confirmation-dialog focus behavior.
  [`bank-accounts.spec.ts:6`](../../apps/web/e2e/bank-accounts.spec.ts#L6)

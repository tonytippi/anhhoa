---
title: 'Story 2.5: Quản lý Mẫu hóa đơn chung'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_commit: '5a065e2b80aff39583a5d902ab709857a6feaec3'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Admin chưa có nơi duy trì cấu trúc thu phí chung, nên các Hóa đơn mới không có nguồn dữ liệu thống nhất để sao chép. Mẫu phải rỗng sau khởi tạo để Admin chủ động cấu hình trước khi Epic 3 lập Hóa đơn.

**Approach:** Tạo một template singleton được seed idempotent cùng các Dòng mẫu có nguồn tiền cố định hoặc học phí Lớp. Cung cấp REST và màn hình quản trị để thêm, sửa, bỏ, xem và đổi vị trí bằng các điều khiển bàn phím/trợ năng rõ ràng.

## Boundaries & Constraints

**Always:** Chỉ Admin đã xác thực được đọc/ghi `/invoice-template`; API sở hữu Prisma, validation và tiền VND `BIGINT` được serialize thành JSON safe integer. Template luôn đúng một bản ghi; mỗi Dòng mẫu có mô tả đã trim, nhóm thu tùy chọn, thứ tự ổn định và một nguồn tiền duy nhất: `FIXED` với số nguyên VND hoặc `CLASS_TUITION` không có fixed amount. Trả JSON camelCase, đọc/mutation theo envelope `{ data }`, lỗi theo envelope chuẩn. Reorder bằng `Lên`/`Xuống` được persist, không drag-and-drop; thay đổi template không tạo hoặc sửa Invoice/snapshot hiện có. Write phía web không tự retry; lỗi/timeout giữ form để Admin quyết định gửi lại.

**Block If:** Dừng nếu việc triển khai buộc phải sửa schema/snapshot/lifecycle Hóa đơn, thay đổi contract idempotency của operation chung, hoặc không thể tạo migration bảo toàn dữ liệu hiện hữu.

**Never:** Không hard-delete template singleton; không seed các dòng mặc định; không dùng `prisma db push`, số thực, tổng tiền do client tính, hoặc endpoint nhận template ID do client chọn. Không thay đổi migration lịch sử hay artifact planning đã final.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Khởi tạo và xem | Database mới hoặc template đã seed | Seed tạo đúng một template rỗng; `GET /invoice-template` trả các dòng theo thứ tự tăng dần | Seed chạy lại vẫn chỉ có singleton |
| Thêm/sửa dòng cố định | Mô tả hợp lệ, `amountSource=FIXED`, amount là safe integer VND | Dòng được persist với amount, xuất hiện đúng thứ tự; sửa giữ thứ tự hiện có | Sai mô tả/amount trả field errors, UI giữ dữ liệu |
| Thêm/sửa dòng học phí | Mô tả hợp lệ, `amountSource=CLASS_TUITION` | Dòng không lưu/trả fixed amount và Epic 3 có thể thay bằng học phí Lớp lúc snapshot | Cố gửi amount không hợp lệ với nguồn này bị từ chối validation |
| Đổi vị trí hoặc bỏ | Dòng đầu/cuối hoặc ID tồn tại/không tồn tại | `Lên`/`Xuống` chỉ đổi với hàng xóm hợp lệ; bỏ dòng làm danh sách còn lại có thứ tự liên tục | Không tìm thấy dòng trả 404; biên không làm thứ tự sai hoặc có mutation mơ hồ |
| Write thất bại | API lỗi hoặc timeout sau gửi | Dialog mở, dữ liệu và lỗi gần bề mặt được giữ, không có retry tự động | Hiển thị thông báo ngắn bổ sung, Admin tự đối soát danh sách trước khi gửi lại |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- thêm singleton `InvoiceTemplate`, `InvoiceTemplateItem`, enum nguồn tiền và relation/index thứ tự; giữ dữ liệu tiền là `BigInt`.
- `apps/api/prisma/migrations/` và `apps/api/prisma/seed.ts` -- migration mới, seed idempotent tạo một template rỗng duy nhất; không sửa migration cũ.
- `apps/api/src/app.module.ts` -- đăng ký `InvoiceTemplateModule`; guard/CSRF global hiện tại tự bảo vệ REST mutation.
- `apps/api/src/modules/classes/classes.dto.ts` và `classes.service.ts:11-55` -- pattern DTO trim/`class-validator`, `safeMoney` serialize `BigInt`, response `{ data }` để tái dùng cho module mới.
- `apps/api/src/common/filters/api-exception.filter.ts` và `common/errors/domain.exception.ts` -- mở rộng mã lỗi domain chỉ nếu service cần mã template ổn định; giữ `{ error: { code, message, fieldErrors? } }`.
- `apps/api/src/modules/invoice-template/` -- module mới: DTO, controller mỏng, service singleton CRUD/reorder và tests unit/integration.
- `apps/api/src/modules/classes/classes.integration.test.ts` và `apps/api/scripts/test-integration.ts` -- mẫu integration PostgreSQL/migration fail-closed để kiểm chứng seed, order và persistence.
- `apps/web/src/app/api/client.ts` -- REST client credentialed, CSRF trước write và không tự replay timeout; không tạo client riêng.
- `apps/web/src/features/classes/api.ts` và `page.tsx:27-44` -- mẫu parser React Query, invalidate sau confirmed success, dialog/form, field errors và giữ input khi lỗi.
- `apps/web/src/features/invoice-template/` -- typed API, trang `/mau-hoa-don`, loading/error/empty states, form thêm/sửa và actions `Lên`/`Xuống`/bỏ có nhãn trợ năng.
- `apps/web/src/app/app.tsx:50` và `app/routes.ts` -- gắn route hiện có trong sidebar vào trang mới thay vì `PlaceholderPage`.
- `apps/web/src/features/invoice-template/*.test.tsx` và `apps/web/e2e/` -- cover form, source amount, mutation/error preservation, thứ tự và accessible controls.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma`, migration mới và `apps/api/prisma/seed.ts` -- thêm model/enum/index và seed singleton rỗng idempotent -- tạo dữ liệu nguồn bền vững cho Epic 3.
- [x] `apps/api/src/modules/invoice-template/`, `apps/api/src/app.module.ts`, và error mapping liên quan -- implement GET singleton, create/update/delete/reorder item với DTO validation, serialize money và thứ tự nhất quán -- cung cấp REST server-authoritative đúng contract.
- [x] `apps/api/src/modules/invoice-template/*.test.ts` và integration test phù hợp -- test validation, fixed/class-tuition exclusivity, seed singleton, CRUD, reorder biên và persistence PostgreSQL -- phủ edge-case matrix.
- [x] `apps/web/src/features/invoice-template/` và `apps/web/src/app/app.tsx` -- implement typed query/mutations và màn hình quản trị có dialog/form, empty/loading/error state, `Lên`/`Xuống` có accessible name, delete confirmation và preservation sau lỗi -- hoàn thiện luồng Admin ngoài cùng.
- [x] `apps/web/src/features/invoice-template/*.test.tsx` và `apps/web/e2e/invoice-template.spec.ts` -- test REST interaction, controls thứ tự/trợ năng, source amount và failed-save form state -- tránh regression UI.

**Acceptance Criteria:**
- Given database được seed, when Admin lần đầu mở `/mau-hoa-don`, then hệ thống trả đúng một Mẫu hóa đơn chung rỗng và UI hướng dẫn thêm Dòng mẫu.
- Given Admin thêm hoặc sửa Dòng mẫu, when chọn số cố định VND hoặc học phí Lớp với dữ liệu hợp lệ, then API persist đúng nguồn tiền và UI hiển thị mô tả, nhóm thu tùy chọn cùng giá trị/nhãn nguồn tương ứng.
- Given Admin dùng các nút `Lên` và `Xuống`, when dòng có hàng xóm theo hướng đã chọn, then server persist thứ tự mới và danh sách phản ánh lại sau mutation; các nút có nhãn truy cập được và không dùng drag-and-drop.
- Given Admin bỏ hoặc thay đổi Dòng mẫu, when save thành công, then chỉ template nguồn thay đổi và không có Hóa đơn/snapshot nào bị tạo hay sửa.
- Given dữ liệu không hợp lệ hoặc write timeout, when mutation không cho kết quả thành công, then form vẫn mở với input/error thích hợp và web không tự gửi lại request.

## Spec Change Log

## Review Triage Log

### 2026-08-19 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 18: (high 8, medium 9, low 1)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high] [patch]` Serialize item mutations by locking the template in retried serializable transactions; recover singleton create races and preserve continuous persisted positions.
  - `[high] [patch]` Add PostgreSQL constraints for non-negative, JSON-safe fixed VND amounts and non-negative positions; defer the position uniqueness constraint to make swaps atomic.
  - `[medium] [patch]` Touch aggregate timestamps for every item change and map serialization failures to HTTP 409 `CONFLICT`.
  - `[medium] [patch]` Strictly validate DELETE and item-position API responses; surface move failures, preserve field errors, and restore delete-trigger focus.
  - `[medium] [patch]` Expand integration and UI coverage for executable seed flow, constraints, concurrent first writes, timeout/form preservation, and reorder failures.

## Auto Run Result

- Summary: Implemented the shared invoice-template singleton, seeded empty template, item CRUD and accessible persisted ordering across Prisma, NestJS REST, and the `/mau-hoa-don` admin screen.
- Files changed: Prisma schema/migration/seed create and constrain template source data; `invoice-template` API module owns validation, serialization and transactions; web feature provides query/mutations, dialogs and `Lên`/`Xuống` controls; tests cover API, PostgreSQL persistence, UI and browser behavior.
- Review findings: 18 patches applied (high 8, medium 9, low 1); 0 deferred; 0 rejected.
- Follow-up review recommendation: true. Patch score is `3 * 9 + 1 * 1 = 28`; high-severity patches were also applied.
- Verification: `git diff --check`; API integration (23 tests); focused web unit tests (52 tests); Playwright E2E; workspace `typecheck`, `lint`, `test`, and `build` all passed.
- Residual risks: Concurrent create/delete/reorder combinations are protected by a shared template row lock and serializable retry, but only concurrent first-write/create is directly stress tested.

## Design Notes

Template không cần public ID vì hệ thống chỉ có một bản ghi. Item order được coi là thuộc tính của template và service phải trả nó theo thứ tự đã persist; update item không được vô tình di chuyển item. Invoice/snapshot chưa có trong schema hiện tại nên Story này chỉ chuẩn bị source data, còn việc copy/resolve `CLASS_TUITION` thuộc Epic 3.

## Verification

**Commands:**
- `pnpm --filter api prisma:generate` -- expected: Prisma client khớp schema template mới.
- `docker compose -f docker-compose.test.yml up -d --wait` -- expected: PostgreSQL integration database healthy.
- `pnpm --filter api test` -- expected: validation/service/controller template pass.
- `pnpm --filter api test:integration` -- expected: migration, seed singleton và persistence/order PostgreSQL pass.
- `pnpm --filter web test -- src/features/invoice-template` -- expected: unit tests trang template pass.
- `pnpm --filter web exec playwright test e2e/invoice-template.spec.ts` -- expected: browser flow và accessibility controls pass.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: workspace checks pass.
- `docker compose -f docker-compose.test.yml down -v` -- expected: integration service/data được dọn sau xác minh.

## Suggested Review Order

**Nguồn dữ liệu và invariant**

- Singleton và nguồn tiền được ràng buộc ngay tại PostgreSQL.
  [`migration.sql:1`](../../apps/api/prisma/migrations/20260819050000_add_invoice_template/migration.sql#L1)

- Service giữ thứ tự liên tục, API JSON-safe và không nhận template ID.
  [`invoice-template.service.ts:24`](../../apps/api/src/modules/invoice-template/invoice-template.service.ts#L24)

**Trải nghiệm quản trị**

- Trang hiển thị trạng thái, form nguồn tiền, reorder và xác nhận bỏ.
  [`page.tsx:7`](../../apps/web/src/features/invoice-template/page.tsx#L7)

- React Query chỉ refresh sau write thành công và kiểm tra response chặt chẽ.
  [`api.ts:9`](../../apps/web/src/features/invoice-template/api.ts#L9)

**Kiểm chứng**

- Integration test xác nhận seed, persistence, source và thứ tự PostgreSQL.
  [`invoice-template.integration.test.ts:13`](../../apps/api/src/modules/invoice-template/invoice-template.integration.test.ts#L13)

- E2E xác nhận route, điều khiển truy cập được và focus khi đóng dialog.
  [`invoice-template.spec.ts:6`](../../apps/web/e2e/invoice-template.spec.ts#L6)

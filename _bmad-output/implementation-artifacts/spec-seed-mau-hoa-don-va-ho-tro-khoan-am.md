---
title: 'Seed Mẫu hóa đơn và hỗ trợ khoản âm'
type: 'feature'
created: '2026-08-20'
status: 'done'
baseline_commit: '8f032c4e343ed9d65148320d9967b111ad7d255b'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Seed hiện tạo Mẫu hóa đơn rỗng, buộc Admin phải nhập lại cấu trúc các khoản thu từ biểu mẫu học phí. Mẫu và giao diện cũng không chấp nhận khoản cố định âm, trong khi vận hành cần giảm trừ hoặc hoàn tiền thừa trên hóa đơn.

**Approach:** Seed idempotent một danh sách khoản thu chính từ biểu mẫu, để `Học phí` lấy theo học phí Lớp và mọi khoản còn lại mặc định `0đ`. Mở rộng toàn bộ contract Mẫu hóa đơn để khoản cố định là số nguyên VND JSON-safe có thể âm; khi tạo hóa đơn hàng loạt, giá trị âm được snapshot như một dòng hóa đơn bình thường và tổng tiếp tục do API tính.

## Boundaries & Constraints

**Always:** Dữ liệu tiền lưu PostgreSQL `BIGINT`; API chỉ serialize số nguyên trong miền JSON-safe gồm cả cận âm và dương. `CLASS_TUITION` vẫn không có `fixedAmount`; `FIXED` bắt buộc có `fixedAmount` trong miền cho phép. Seed chỉ chèn danh sách mặc định khi template singleton vừa được tạo hoặc còn không có dòng nào do seed cũ để lại; không ghi đè, nhân bản, hay sắp xếp lại dữ liệu template mà Admin đã cấu hình. Các hóa đơn và snapshot đã tồn tại không bị thay đổi. Admin có thể nhập dấu âm trong form Mẫu hóa đơn, còn tổng hóa đơn và lifecycle tiếp tục do server quyết định, với quy tắc `PENDING`/`COMPLETED` hiện hữu yêu cầu tổng dương giữ nguyên.

**Ask First:** Dừng nếu cần thay đổi lifecycle hóa đơn, cơ chế idempotency, schema Invoice/InvoiceItem, hoặc cần suy diễn khoản tiền khác ngoài danh sách đã chốt.

**Never:** Không sửa migration lịch sử, không dùng `prisma db push`, không seed giá trị minh họa theo ảnh ngoài `0đ`, không tạo dòng kỹ thuật/không rõ ý nghĩa như `TT`, `Block`, `Buổi`, không tạo subtotal, dòng tiêu đề hoặc quy tắc theo ngày/số buổi mà schema chưa hỗ trợ.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Seed database mới | Template singleton chưa có | Seed tạo singleton cùng 10 dòng theo thứ tự: `Học phí`, `Xe`, `Khác`, `Tạm thu tiền ăn`, `Phụ phí`, `Phụ ăn`, `Ngoài giờ`, `Ăn tối`, `Đổi trừ Phép T7`, `Khác`; `Học phí` là `CLASS_TUITION`, chín dòng còn lại `FIXED 0đ` | Transaction thất bại thì không để lại template/dòng dở dang |
| Nâng cấp seed rỗng | Singleton đã có nhưng không có dòng | Seed bổ sung đúng danh sách mặc định một lần | Chạy lại không tạo dòng trùng |
| Seed sau Admin cấu hình | Singleton có ít nhất một dòng bất kỳ | Seed không thay đổi nội dung, thứ tự hoặc số lượng dòng hiện hữu | Không ghi đè cấu hình vận hành |
| Lưu giảm trừ | Admin tạo/sửa dòng `FIXED` với `-135000` | DTO, API và PostgreSQL persist, trả về và UI hiển thị `-135.000đ` | Giá trị ngoài miền JSON-safe bị từ chối |
| Tạo batch từ template | Template có dòng cố định âm và học phí Lớp | Hóa đơn mới copy nguyên dòng âm, resolve học phí theo Lớp, và lưu tổng bằng tổng có dấu của mọi dòng | Quy tắc chuyển `PENDING` vẫn chặn tổng không dương |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/seed.ts:4-28` -- hiện upsert singleton rỗng và seed fixture; thêm danh sách dòng hóa đơn mặc định trong cùng transaction, chỉ backfill template không có item để giữ cấu hình Admin.
- `apps/api/prisma/migrations/20260819050000_add_invoice_template/migration.sql:31-34` -- migration lịch sử có constraint `fixedAmount >= 0`; không được sửa. Thêm migration mới để thay constraint này bằng miền `BIGINT` JSON-safe đối xứng, vẫn giữ exclusivity `FIXED`/`CLASS_TUITION` và position không âm.
- `apps/api/prisma/schema.prisma:146-168` -- schema Prisma chỉ mô tả nullable `BigInt`; giữ cấu trúc model và để migration mới sở hữu constraint cơ sở dữ liệu.
- `apps/api/src/modules/invoice-template/invoice-template.dto.ts:5-21` -- validator hiện ép `FIXED` không âm; đổi thành số nguyên JSON-safe có dấu, và điều chỉnh thông báo field error tương ứng.
- `apps/api/src/modules/invoice-template/invoice-template.service.ts:10-70` -- `safeMoney` đã kiểm tra `Number.isSafeInteger`; create/update chuyển giá trị sang `BigInt`, nên tái sử dụng để persist số âm sau DTO validation.
- `apps/web/src/features/invoice-template/page.tsx:19-22` -- form hiện xóa mọi ký tự không phải chữ số; giữ một dấu `-` đứng đầu, validate số nguyên có dấu và gửi đúng `fixedAmount` âm. Trình bày cố định đã dùng `formatVnd`, cần xác nhận hiển thị dấu âm đúng.
- `apps/api/src/modules/invoice-template/invoice-template.dto.test.ts:6-12` -- mở rộng unit validation cho `FIXED` âm hợp lệ và giá trị vượt miền JSON-safe bị từ chối.
- `apps/api/src/modules/invoice-template/invoice-template.integration.test.ts:15-55` -- thay assertion cũ cấm âm bằng kiểm tra PostgreSQL nhận số âm, vẫn chặn vượt cận âm/dương, và kiểm chứng seed default idempotent/preserve cấu hình.
- `apps/api/src/modules/invoices/invoices.integration.test.ts:29-53` -- thêm dòng template âm vào batch snapshot để kiểm chứng item và tổng hóa đơn đã tạo.
- `apps/web/src/features/invoice-template/page.test.tsx` -- thêm regression form nhập/gửi số âm để bảo đảm UI không âm thầm đổi giảm trừ thành số dương.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/migrations/20260820010000_allow_negative_invoice_template_amounts/migration.sql` -- thay constraint amount không âm bằng cận JSON-safe âm/dương -- cho phép giảm trừ được bảo vệ ở PostgreSQL.
- [x] `apps/api/prisma/seed.ts` -- tạo/bổ sung có điều kiện 10 dòng template đã chốt với chín khoản `FIXED 0đ` và một `CLASS_TUITION` -- cung cấp điểm bắt đầu vận hành mà không ghi đè Admin.
- [x] `apps/api/src/modules/invoice-template/invoice-template.dto.ts` -- chấp nhận `FIXED` là safe integer có dấu và giữ exclusivity nguồn tiền -- thống nhất HTTP validation với database.
- [x] `apps/web/src/features/invoice-template/page.tsx` -- hỗ trợ nhập/giữ dấu âm trong số tiền cố định, bao gồm client validation -- cho phép Admin cấu hình giảm trừ qua UI.
- [x] `apps/api/src/modules/invoice-template/invoice-template.dto.test.ts`, `apps/api/src/modules/invoice-template/invoice-template.integration.test.ts`, `apps/api/src/modules/invoices/invoices.integration.test.ts`, và `apps/web/src/features/invoice-template/page.test.tsx` -- cover các kịch bản matrix -- ngăn regression seed, validation, snapshot và UI.

**Acceptance Criteria:**
- Given database mới hoặc template singleton rỗng do seed trước đó, when chạy Prisma seed, then template có đúng 10 dòng mặc định theo thứ tự đã chốt, trong đó chỉ `Học phí` dùng nguồn học phí Lớp và mọi khoản cố định bằng `0đ`.
- Given template đã được Admin cấu hình có ít nhất một dòng, when chạy Prisma seed, then không có dòng hiện hữu nào bị sửa, xóa, đổi thứ tự hay nhân bản.
- Given Admin nhập khoản cố định âm hợp lệ, when lưu Mẫu hóa đơn, then API và database lưu đúng giá trị âm, API trả số JSON-safe có dấu, và khi tạo batch hóa đơn dòng cùng dấu được snapshot trong tổng server-calculated.
- Given Admin nhập số tiền không phải safe integer hoặc vượt cận JSON-safe, when submit form/API, then request bị validation từ chối và cấu hình hiện hữu không thay đổi.

## Spec Change Log

## Design Notes

`feeGroup` chỉ là nhãn nhóm, không có hành vi subtotal. Vì vậy các mục trong mẫu được lưu thành dòng độc lập: `Khác` xuất hiện hai lần tại các vị trí khác nhau để phản ánh biểu mẫu, còn `Phụ ăn` gom khu vực `K ăn sáng` và `K uống sữa`; không seed `TT`, `Block` hay `Buổi` vì đó là trường phụ/nhãn không phải khoản thu độc lập theo schema hiện tại.

## Verification

**Commands:**
- `pnpm --filter api prisma:generate` -- expected: Prisma client khớp schema và migration mới.
- `pnpm --filter api test` -- expected: DTO/service test, gồm contract số tiền template có dấu, pass.
- `pnpm --filter web test -- src/features/invoice-template` -- expected: form template giữ và gửi đúng số âm.
- `pnpm --filter api test:integration` -- expected: PostgreSQL migrate, seed default idempotent, constraint signed amount và batch snapshot pass.
- `pnpm typecheck && pnpm lint && pnpm test` -- expected: workspace checks không có regression.

## Suggested Review Order

**Seed và đồng thời**

- Tạo 10 dòng mặc định một lần, không ghi đè template Admin, và khóa các seed chạy song song.
  [`seed.ts:9`](../../apps/api/prisma/seed.ts#L9)

**Ràng buộc tiền có dấu**

- Migration thay cận không âm bằng miền JSON-safe đối xứng ở PostgreSQL.
  [`migration.sql:1`](../../apps/api/prisma/migrations/20260820010000_allow_negative_invoice_template_amounts/migration.sql#L1)

- DTO giữ exclusivity nguồn tiền và chấp nhận fixed amount có dấu.
  [`invoice-template.dto.ts:5`](../../apps/api/src/modules/invoice-template/invoice-template.dto.ts#L5)

**Nhập liệu Admin**

- Form giữ một dấu âm đầu chuỗi và chỉ gửi số nguyên VND an toàn.
  [`page.tsx:21`](../../apps/web/src/features/invoice-template/page.tsx#L21)

- Parser REST chấp nhận phản hồi `fixedAmount` âm JSON-safe.
  [`api.ts:9`](../../apps/web/src/features/invoice-template/api.ts#L9)

**Kiểm chứng**

- Integration cover seed idempotent, bảo toàn cấu hình và constraint signed amount.
  [`invoice-template.integration.test.ts:18`](../../apps/api/src/modules/invoice-template/invoice-template.integration.test.ts#L18)

- Batch snapshot xác nhận dòng giảm trừ đi vào tổng server-calculated.
  [`invoices.integration.test.ts:29`](../../apps/api/src/modules/invoices/invoices.integration.test.ts#L29)

- UI test xác nhận phản hồi API âm hoàn tất mutation và đóng form.
  [`page.test.tsx:34`](../../apps/web/src/features/invoice-template/page.test.tsx#L34)

---
title: 'Story 3.1: Xem danh sách Hóa đơn theo tháng'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: '8b1ca619bc8fb4db7badcddd9baad6f241ef7c6c'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Ứng dụng chưa có dữ liệu, REST API hay bề mặt để Admin tra cứu Hóa đơn của một tháng. Vì vậy Admin không thể xác định Hóa đơn nào cần tạo, rà soát hoặc xác nhận.

**Approach:** Bổ sung nền tảng persistence Hóa đơn dùng snapshot, `GET /invoices` có phân trang/lọc và trang `/hoa-don` lấy URL làm nguồn filter. Hàng dẫn đến route chi tiết chỉ-đọc tối thiểu để liên kết hoạt động, còn editor, payment và lifecycle để lại cho các story sau.

## Boundaries & Constraints

**Always:** API là chủ sở hữu duy nhất của Prisma/PostgreSQL; Hóa đơn hiển thị và lọc bằng snapshot Học sinh/Lớp bất biến, không dùng quan hệ nguồn có thể thay đổi. Lưu tiền bằng `BIGINT`, chỉ trả số nguyên JSON an toàn; `billingMonth` lưu ngày đầu tháng UTC và trao đổi `YYYY-MM`. API list cần auth toàn cục, camelCase và `{ data, meta }`; URL phải phản ánh tháng, search, status, class và page. Month picker mặc định tháng hiện tại, hiện `MM/YYYY`; search đứng trước status/lớp; status luôn có nhãn chữ. Mọi route có đúng một `h1`; table có ngữ cảnh truy cập, skeleton, lỗi gần bề mặt và mobile scroll ngang với cột định danh ghim.

**Ask First:** Hỏi trước khi thay đổi contract REST đã tồn tại, sửa migration đã commit, hoặc mở rộng trang chi tiết tối thiểu sang editor, payment, QR hay lifecycle.

**Never:** Không tạo batch invoices, line-item editor, payment snapshot, transition, QR hoặc xác nhận thanh toán. Không sửa artifact planning final, không đọc tổng tiền từ client, không dùng số thực, không khiến archived/current Student hoặc Class làm sai snapshot lịch sử.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tải mặc định | `/hoa-don` không có query | URL/API dùng tháng hiện tại; table phân trang Hóa đơn snapshot của tháng | Skeleton khi chờ |
| Lọc | `month`, search tên snapshot, status/class snapshot, page | API chỉ trả record đúng tháng/filter với thứ tự ổn định và `{ data, meta }` | Query không hợp lệ trả error shape chuẩn |
| Tháng trống | Tháng hợp lệ không có Hóa đơn | Giữ picker, giải thích trạng thái, đúng một CTA `Tạo hóa đơn tháng` | Không ẩn filter/month |
| Lịch sử nguồn đổi | Student đổi tên/lớp hoặc Class archived sau khi có invoice | List/detail vẫn nêu snapshot ban đầu | Không join để hiển thị từ dữ liệu nguồn |
| Tổng không an toàn | `BIGINT` vượt JavaScript safe integer | API từ chối thay vì phát JSON sai | Lỗi server chuẩn; web hiển thị lỗi/retry |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- hiện chưa có Invoice; thêm enum trạng thái, model snapshot, quan hệ creator/source, unique `(studentId, billingMonth)` và index list.
- `apps/api/prisma/migrations/` -- chỉ thêm migration forward-only; migrations cũ là read-only.
- `apps/api/src/app.module.ts` -- đăng ký `InvoicesModule`; global `SessionAuthGuard` đã bảo vệ GET.
- `apps/api/src/modules/classes/classes.dto.ts` và `classes.service.ts` -- mẫu DTO pagination, transaction count/findMany và serialize `BIGINT` an toàn.
- `apps/web/src/features/classes/api.ts` -- mẫu parse response phòng thủ, query key REST và `getJson` credentialed.
- `apps/web/src/features/classes/page.tsx` -- mẫu URL-driven table, pagination, loading/error/empty state và định dạng VND.
- `apps/web/src/app/app.tsx` -- thêm route `/hoa-don` và `/hoa-don/:id`; sidebar đã có `/hoa-don` trong `app/routes.ts`.
- `apps/web/src/index.css` -- tái dùng table scroll/row baseline, thêm status invoice và sticky identity column.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*_add_invoices/migration.sql` -- tạo persistence Invoice snapshot chỉ đủ đọc list/detail, enum `DRAFT|PENDING|COMPLETED`, unique/index và money/date constraints -- bảo toàn dữ liệu lịch sử và contract cho các story sau.
- [x] `apps/api/src/modules/invoices/{invoices.module.ts,invoices.controller.ts,invoices.dto.ts,invoices.service.ts}` và `apps/api/src/app.module.ts` -- triển khai `GET /invoices` và `GET /invoices/:id`, validate query `billingMonth`, `search`, `status`, `classId`, pagination; serialize snapshot/money/time an toàn -- cung cấp REST read model được auth bảo vệ.
- [x] `apps/api/src/modules/invoices/*.{test,integration.test}.ts` -- test DTO, query month/search/status/class snapshot, pagination, ordering, safe money và snapshot không đổi khi source đổi -- khóa invariant API.
- [x] `apps/web/src/features/invoices/{api.ts,page.tsx,detail-page.tsx,api.test.ts,page.test.tsx}` -- parse contract, render filter URL-driven, picker, table/status/VND, empty/error/skeleton, CTA và route chi tiết read-only tối thiểu -- hoàn thành bề mặt tra cứu không lấn scope.
- [x] `apps/web/src/app/app.tsx`, `apps/web/src/index.css`, `apps/web/e2e/invoices.spec.ts` -- nối route, style responsive/sticky/accessibility và test hành vi browser -- đảm bảo link hàng và mobile usable.

**Acceptance Criteria:**
- Given Admin mở `/hoa-don`, when không có month URL, then URL và request dùng tháng hiện tại, picker hiện `MM/YYYY`, và đổi tháng tải list tương ứng.
- Given dữ liệu nhiều trạng thái, when Admin search/lọc/phân trang, then URL phản ánh điều kiện, table hiển thị Student/Class snapshot, tổng VND căn phải, badge `Nháp`/`Chờ xác nhận`/`Đã hoàn tất`, và mỗi hàng mở được detail read-only.
- Given tháng không có Hóa đơn, when request thành công, then picker còn nguyên, chỉ có một CTA `Tạo hóa đơn tháng`, không có CTA cạnh tranh.
- Given viewport mobile, when xem table, then table scroll ngang và cột Học sinh ghim; ngữ cảnh tháng/filter được expose qua caption hoặc `aria-label`.

## Design Notes

`classId` là ID snapshot và list API bắt buộc nhận `billingMonth`; web chịu trách nhiệm đặt default vào URL. Điều này loại bỏ timezone mơ hồ và không làm archived Class biến mất khỏi dữ liệu lịch sử. Route `/hoa-don/:id` chỉ hiển thị dữ liệu snapshot, tổng và trạng thái; Story 3.3 thay thế/nâng cấp nội dung đó bằng detail editor.

## Verification

**Commands:**
- `pnpm --filter api test` -- expected: invoice unit/API tests pass.
- `pnpm --filter api test:integration` -- expected: PostgreSQL invoice integration tests pass.
- `pnpm --filter web test` -- expected: invoice client/page tests pass.
- `pnpm --filter web test:e2e` -- expected: invoice browser flow passes.
- `pnpm lint && pnpm typecheck && pnpm build` -- expected: workspace has no lint, TypeScript, or build failure.

## Suggested Review Order

**Invoice Read Model**

- Snapshot persistence keeps historical names and classes independent from source records.
  [`schema.prisma:92`](../../apps/api/prisma/schema.prisma#L92)

- List reads use a stable snapshot and return only safe JSON money values.
  [`invoices.service.ts:21`](../../apps/api/src/modules/invoices/invoices.service.ts#L21)

- Query validation establishes the external month, filter, and pagination contract.
  [`invoices.dto.ts:5`](../../apps/api/src/modules/invoices/invoices.dto.ts#L5)

**Invoice Workspace**

- URL-backed filters normalize the current month before the first list request.
  [`page.tsx:14`](../../apps/web/src/features/invoices/page.tsx#L14)

- The read-only detail route provides a valid destination without future editor behavior.
  [`detail-page.tsx:8`](../../apps/web/src/features/invoices/detail-page.tsx#L8)

- Shared routes activate both the list and invoice-specific detail view.
  [`app.tsx:52`](../../apps/web/src/app/app.tsx#L52)

**Verification**

- PostgreSQL tests verify filtering, snapshots, and the generated migration.
  [`invoices.integration.test.ts:1`](../../apps/api/src/modules/invoices/invoices.integration.test.ts#L1)

- Browser tests cover default filters, empty states, and responsive table behavior.
  [`invoices.spec.ts:1`](../../apps/web/e2e/invoices.spec.ts#L1)

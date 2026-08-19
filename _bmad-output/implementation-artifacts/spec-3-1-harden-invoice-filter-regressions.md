---
title: 'Story 3.1: Khóa hồi quy filter hóa đơn'
type: 'bugfix'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: '56229dd96c764d747516ff07c6333b72ea55f31a'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Các hành vi quan trọng của trang danh sách hóa đơn đã có trong code nhưng chưa được test hồi quy đầy đủ: URL tháng sai và việc reset trang khi đổi filter.

**Approach:** Bổ sung test giao diện hẹp cho hai hành vi này. Giữ CTA tháng trống vô hiệu hóa kèm giải thích vì Story 3.2 chưa cung cấp luồng tạo hóa đơn, do đó không tạo route hoặc hành vi giả.

## Boundaries & Constraints

**Always:** Giữ URL là nguồn filter; filter tháng, tìm kiếm, trạng thái hoặc lớp phải đưa `page` về 1. URL `month` không đúng `YYYY-MM` hợp lệ được chuẩn hóa về tháng hiện tại trước request hóa đơn. CTA `Tạo hóa đơn tháng` tiếp tục disabled và giải thích tính năng chưa có.

**Ask First:** Hỏi trước khi thay đổi route, thêm API tạo hóa đơn hoặc thay đổi hành vi CTA sang điều hướng.

**Never:** Không sửa API, schema, migration, contract REST, hoặc triển khai bất kỳ phần nào của Story 3.2.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Đổi filter ở trang sau | URL có `page=3`, Admin đổi tháng/search/status/lớp | URL/request mới không giữ trang cũ, bắt đầu ở trang 1 | Không hiện tháng trống giả do trang vượt phạm vi |
| Tháng URL sai | `month=2026-13` hoặc thiếu month | URL thay bằng tháng hiện tại và chỉ request invoices sau chuẩn hóa | Không gửi query month không hợp lệ |

</frozen-after-approval>

## Code Map

- `apps/web/src/features/invoices/page.tsx` -- `updateFilters` đã reset trang khi đổi filter; `useEffect` đã chuẩn hóa month sai trước query, là hành vi chỉ cần bảo vệ bằng test.
- `apps/web/src/features/invoices/page.test.tsx` -- dùng `MemoryRouter`, fetch mock và `waitFor`; thêm coverage cho URL month sai và page reset.
- `apps/web/e2e/invoices.spec.ts` -- CTA empty-state đã được xác nhận disabled; không chạm vì không có luồng tạo hợp lệ.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/features/invoices/page.test.tsx` -- thêm test URL month không hợp lệ chỉ gửi request sau khi chuẩn hóa, và test mỗi loại filter reset page về 1 -- bảo vệ hai luồng URL dễ hồi quy.

**Acceptance Criteria:**
- Given Admin đang ở `page=3`, when đổi month, search, status hoặc lớp snapshot, then request danh sách tương ứng không còn `page=3` và bắt đầu ở trang 1.
- Given Admin mở URL thiếu hoặc có `month` sai, when trang tải, then URL/request dùng month hiện tại và không gửi request invoice với month sai.
- Given tháng không có hóa đơn, when hiển thị empty state, then CTA tạo hóa đơn vẫn disabled và nêu rõ chức năng sẽ có ở bước tiếp theo.

## Verification

**Commands:**
- `pnpm --filter web test` -- expected: tất cả test Vitest web, gồm invoice page regression tests, pass.

## Suggested Review Order

- Xác nhận URL chuẩn hóa dùng đúng tháng hiện tại trước khi gọi API.
  [`page.test.tsx:31`](../../apps/web/src/features/invoices/page.test.tsx#L31)

- Xác nhận mọi thao tác filter đều bỏ trang cũ và bắt đầu lại từ trang 1.
  [`page.test.tsx:40`](../../apps/web/src/features/invoices/page.test.tsx#L40)

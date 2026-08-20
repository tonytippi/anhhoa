---
title: 'Khắc phục recovery idempotent và regression hóa đơn'
type: 'bugfix'
created: '2026-08-20'
status: 'done'
review_loop_iteration: 0
baseline_commit: '1d0f72e3a29ce6d92929d8964a173696e88ee32a'
context:
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
  - '_bmad-output/implementation-artifacts/epic-3-retro-2026-08-20.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Batch creation và completion hóa đơn có thể coi `GET /operations/:operationId` trả `404` ngay sau timeout là bằng chứng mutation chưa chạy, rồi tạo UUID mới trong khi transaction đầu vẫn có thể commit. Coverage chưa chứng minh draft update được persist/read-back hoặc UI reconciliation đi qua trạng thái chưa xác định.

**Approach:** Giữ immutable request và idempotency key gốc qua mọi timeout/lookup chưa xác định, chỉ gửi lại cùng key theo thao tác Admin hoặc áp dụng kết quả terminal đã xác nhận. Bổ sung coverage PostgreSQL/UI cho các đường này và siết parser invoice detail để từ chối response không đúng contract.

## Boundaries & Constraints

**Always:** `PENDING`, network error và `404` từ operation lookup sau khi write bắt đầu là outcome chưa xác định; không được tạo UUID mới hoặc invalidate cache trước terminal response. Retry có chủ đích gửi nguyên request/key gốc. Batch giữ input month/scope/class IDs; completion giữ invoice ID/key. Chỉ xóa recovery state sau terminal result hoặc lỗi client xác định trước ambiguous-write phase. API tiếp tục là owner transaction/idempotency/money; không nhận total client. Parser phải chỉ nhận `YYYY-MM` có năm khác `0000`, và mọi detail phải có `completedBy`/`completedAt` explicit: `null` ngoài COMPLETED, giá trị hợp lệ khi COMPLETED.

**Ask First:** Dừng hỏi nếu cần endpoint operation mới, lease/expiry/background recovery, đổi public API contract, migration/schema, hoặc thay semantics idempotency phía server.

**Never:** Không tự động replay write; không coi `404` là mutation chưa áp dụng; không tạo UUID mới trong operation recovery; không sửa migration đã commit; không thay đổi lifecycle/snapshot/payment/QR ngoài phạm vi recovery và parser.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Batch/completion timeout | POST timeout; lookup lần đầu `404`, sau đó `PENDING` hoặc terminal result | UI giữ key/request gốc, trạng thái outcome unknown và chỉ áp dụng terminal result | Không mở retry key mới; user chỉ kiểm tra/gửi lại cùng key |
| Reload đang recovery | Session có batch input/key hoặc invoice ID/key | UI khôi phục operation và tiếp tục đối soát cùng key | Không xóa state bởi `404`/network error |
| Draft update | DRAFT có line/payment mới hợp lệ | API thay line ordered, tự tính total và persist payment; get/read-back khớp | Server từ chối state/payment không hợp lệ như hiện tại |
| Detail response sai | Month `0000-01`, audit key bị thiếu, hoặc audit sai trạng thái | Client từ chối response | Bề mặt lỗi API hiện có xử lý invalid response |

</frozen-after-approval>

## Code Map

- `apps/web/src/features/invoices/page.tsx:29-35` -- `BatchDialog` đang xóa key khi lookup `404`; giữ immutable batch tuple/recovery UI, tái sử dụng pattern safe retry của class transfer.
- `apps/web/src/features/invoices/detail-page.tsx:27-77` -- completion modal đang về idle và xóa key ở `404`; giữ operation qua reconcile/retry, preserve focus/lock behavior hiện có.
- `apps/web/src/features/classes/detail-page.tsx:9-99` -- precedent cho session-persisted tuple, lookup/retry cùng key và only-confirmed cache refresh; tái dùng semantics, không sao chép domain logic.
- `apps/web/src/features/invoices/api.ts:17-57` -- parser invoice/detail và operation clients; centralize month validation, require explicit nullable audit fields, giữ response parsers theo action.
- `apps/api/src/modules/invoices/invoices.service.ts:90-113` -- `update` transaction tự tính total và thay lines; không đổi business logic, bổ sung evidence persistence ở integration test.
- `apps/api/src/modules/invoices/invoices.integration.test.ts:17-124` -- suite PostgreSQL invoice; thêm test update/read-back cho ordered lines, total và transfer account active.
- `apps/web/src/features/invoices/{api.test.ts,page.test.tsx,detail-page.test.tsx}` -- bổ sung parser và fake-timer timeout reconciliation assertions, kể cả no second POST/same-key retry.
- `apps/api/src/modules/operations/operations.service.ts:13-35` -- API transaction/replay đã đủ atomic; read-only trừ khi investigation chứng minh protocol không thể thực hiện ở web.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/features/invoices/page.tsx`, `apps/web/src/features/invoices/detail-page.tsx` -- persist immutable recovery tuples, treat ambiguous lookup outcomes safely, expose user-directed same-key check/retry and clear only confirmed terminal recovery -- ngăn mutation thứ hai ngoài ý muốn.
- [x] `apps/web/src/features/invoices/api.ts`, `apps/web/src/features/invoices/page.tsx` -- dùng validation month thống nhất và yêu cầu audit keys explicit theo status -- chặn response contract drift.
- [x] `apps/api/src/modules/invoices/invoices.integration.test.ts` -- thêm PostgreSQL read-back cho draft update line ordering, BigInt total và payment selection -- khóa persistence invariant.
- [x] `apps/web/src/features/invoices/{api.test.ts,page.test.tsx,detail-page.test.tsx}` -- cover malformed parser payload, timeout `404 -> PENDING -> terminal`, recovery reload/cùng-key replay và no automatic second POST -- khóa UI protocol.

**Acceptance Criteria:**
- Given batch hoặc completion POST timeout rồi lookup trả `404` trước commit, when Admin đối soát hoặc gửi lại, then UI giữ request/key gốc và mọi POST cùng operation dùng một `Idempotency-Key`.
- Given terminal operation result xuất hiện sau `404`/`PENDING`, when UI nhận result, then chỉ một cache refresh xảy ra, recovery state bị xóa và completed/batch result hiển thị đúng.
- Given DRAFT được update với lines reordered và transfer account active, when API trả về rồi read lại record, then items ordered, total server-calculated và payment persisted khớp request hợp lệ.
- Given invoice response thiếu explicit audit nullable fields hoặc có billing month `0000`, when web parse response, then response bị từ chối.

## Design Notes

`GET /operations/:operationId` chỉ cho terminal result hoặc `PENDING`; `404` không thể phân biệt write chưa đến server với transaction chưa commit. Vì vậy retry an toàn chỉ có thể lặp lại original request với cùng key, không sinh key mới. Session recovery giúp Admin reload mà không mất tuple đã bắt đầu.

## Verification

**Commands:**
- `pnpm --filter api test:integration` -- expected: clean PostgreSQL migrations và invoice update/read-back coverage pass.
- `pnpm --filter web test -- src/features/invoices/api.test.ts src/features/invoices/page.test.tsx src/features/invoices/detail-page.test.tsx` -- expected: parser và timeout recovery tests pass.
- `pnpm --filter api test && pnpm --filter web test && pnpm --filter web test:e2e` -- expected: all affected suites pass.
- `pnpm lint && pnpm typecheck && pnpm build && git diff --check` -- expected: workspace checks pass without new whitespace errors.

## Suggested Review Order

**Recovery Protocol**

- Persist and replay only validated immutable batch tuples after uncertain writes.
  [`page.tsx:20`](../../apps/web/src/features/invoices/page.tsx#L20)

- Keep completion recovery key stable and refresh only invoice list queries.
  [`detail-page.tsx:14`](../../apps/web/src/features/invoices/detail-page.tsx#L14)

**Contract Hardening**

- Reject malformed or mismatched operation responses before clearing recovery state.
  [`api.ts:52`](../../apps/web/src/features/invoices/api.ts#L52)

- Reject non-string billing months and missing nullable completion audit fields.
  [`api.ts:18`](../../apps/web/src/features/invoices/api.ts#L18)

**Regression Evidence**

- Verify draft updates persist ordered lines, server total, and payment selection.
  [`invoices.integration.test.ts:69`](../../apps/api/src/modules/invoices/invoices.integration.test.ts#L69)

- Verify saved batch recovery reaches terminal outcome without a second POST.
  [`page.test.tsx:90`](../../apps/web/src/features/invoices/page.test.tsx#L90)

- Verify saved completion recovery reaches terminal audit outcome without a second POST.
  [`detail-page.test.tsx:47`](../../apps/web/src/features/invoices/detail-page.test.tsx#L47)

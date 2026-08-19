---
title: 'Khắc phục retry idempotent và recovery chuyển cả lớp'
type: 'bugfix'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'd8d33509babe300a2557030d7fd9ec7fbef51c2f'
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
  - '_bmad-output/implementation-artifacts/epic-2-retro-2026-08-19.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Whole-class transfer có thể chạy hai lần khi write đầu timeout, operation lookup tạm thời trả `404`, rồi UI tạo idempotency key mới. Ngoài ra, record `PENDING` được commit trước transaction domain có thể tồn tại vĩnh viễn sau sự cố, khiến Admin không thể đối soát hoặc retry an toàn.

**Approach:** Đặt việc acquire/replay operation, chuyển Student và lưu kết quả cuối cùng vào cùng serializable transaction. UI phải giữ cặp destination/key đã persist qua timeout, reload và lookup chưa xác định, chỉ retry bằng key ban đầu và chỉ xóa trạng thái sau kết quả hoàn tất đã xác nhận.

## Boundaries & Constraints

**Always:** Giữ `Idempotency-Key` UUID scoped theo Admin, route và request fingerprint. Cùng key/cùng request phải replay đúng response hoàn tất; khác owner, route hoặc fingerprint trả `IDEMPOTENCY_CONFLICT`. Acquire/recovery, Class locks, active-Student update và `COMPLETED` response nằm trong cùng transaction `SERIALIZABLE`; retry serialization phải retry toàn bộ unit. `PENDING`, timeout, network error và `GET /operations/:id` trả `404` sau một write đã bắt đầu đều là outcome chưa xác định ở web, không phải bằng chứng write chưa áp dụng. Persist source, destination và key đến khi nhận `TransferResult` xác nhận; destination không được đổi trong khi operation còn tồn tại. Chỉ invalidates Classes/Students và xóa session state sau completed response. Legacy `PENDING` hợp lệ cùng owner/route/fingerprint phải có thể được transaction cùng key recover an toàn; mọi lock Class và invariant archive-versus-assignment hiện có vẫn giữ nguyên.

**Ask First:** Dừng hỏi nếu cần thêm lease/expiry scheduler, background job, endpoint quản trị operation, thay đổi Operation public contract ngoài transfer hiện hữu, hoặc thay đổi idempotency semantics cho batch invoice/completion chưa triển khai.

**Never:** Không tạo UUID mới khi retry operation đã persist; không coi `404` lookup là "chưa áp dụng"; không xóa pending state sau timeout/lookup error; không invalidate cache khi API chỉ trả `PENDING`; không sửa migration lịch sử hay thêm migration khi schema hiện có đủ; không làm client tự retry write tự động không có thao tác Admin.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Transfer mới | Key mới, hai Class active, operation chưa có | Một transaction tạo operation, chuyển đúng active Students và lưu `COMPLETED` response | Rollback không để PENDING mới bền vững |
| Retry sau timeout/404 | Session có source, destination, key; lookup 404 hoặc request đầu bị trễ | UI giữ modal/state; retry gửi đúng key và destination cũ; server chỉ có một completed transfer | Không tạo key mới, không invalidate trước outcome |
| Replay/recovery | Cùng owner/route/fingerprint với operation completed hoặc PENDING legacy | Completed replay response; pending được xử lý trong transaction và thành completed đúng một lần | Khác owner/route/fingerprint trả conflict |
| Pending quan sát | GET trả PENDING hoặc lỗi network | Giữ session state, khóa destination, cho kiểm tra lại hoặc retry có chủ đích cùng key | Không đóng modal hoặc xóa operation |
| Reload | Session có pending tuple | Modal nạp tuple và đối soát; completed mới refresh/xóa state | 404/PENDING tiếp tục là uncertain state |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/classes/classes.service.ts:71-100` - transfer hiện acquire operation ngoài transaction và xóa PENDING khi lỗi; chuyển toàn bộ protocol vào callback serializable/retry.
- `apps/api/src/modules/operations/operations.service.ts:13-39` - giữ owner-only lookup; thêm acquire/replay dùng `Prisma.TransactionClient` và recovery PENDING có khóa transaction.
- `apps/api/src/modules/classes/classes.integration.test.ts` - PostgreSQL coverage cho transfer, same-key concurrency và archive race; bổ sung rollback/recovery assertions.
- `apps/api/src/modules/operations/operations.integration.test.ts:14-39` - contract owner/replay/PENDING; bổ sung legacy pending recovery hoặc điều chỉnh expectation phù hợp transaction protocol.
- `apps/web/src/features/classes/api.ts:60-64` - mutation hiện parse completed response và invalidates ngay; phải chấp nhận `PendingOperation` và chỉ UI quyết định confirmed refresh.
- `apps/web/src/features/classes/detail-page.tsx:28-78` - session tuple, reconciliation và retry; hiện xóa state ở lookup 404 và tạo UUID ở mọi submit.
- `apps/web/src/features/classes/detail-page.test.tsx:34-76` - test timeout 404 hiện mong unlock theo key mới; thay bằng proof same-key retry, delayed write và reload/PENDING behavior.
- `apps/api/prisma/schema.prisma:20-37` - schema Operation hiện có đủ `PENDING`, `COMPLETED`, fingerprint, response và global operation id; read-only, không migration.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/modules/operations/operations.service.ts`, `apps/api/src/modules/classes/classes.service.ts` -- đặt acquire/replay/recover, sorted Class locks, Student update và complete response trong một serializable transaction retry toàn bộ; loại bỏ pre-transaction pending create/delete behavior -- không để crash window hoặc retry tạo double transfer.
- [x] `apps/api/src/modules/classes/classes.integration.test.ts`, `apps/api/src/modules/operations/operations.integration.test.ts` -- thêm PostgreSQL tests cho rollback không để pending mới, pending legacy recover cùng key, concurrent same-key replay và archive race còn đúng -- chứng minh persistence/concurrency invariant.
- [x] `apps/web/src/features/classes/api.ts`, `apps/web/src/features/classes/detail-page.tsx` -- parse PENDING transfer response; quản lý persisted operation tuple bằng state, tự đối soát khi reload, retry có chủ đích cùng key và chỉ refresh khi completed -- tránh key mới hoặc optimistic invalidation.
- [x] `apps/web/src/features/classes/detail-page.test.tsx` -- thay expectation 404 cũ và thêm delayed POST, same-key retry, PENDING/404 persistence và reload reconciliation tests -- phủ timeout edge-case matrix.

**Acceptance Criteria:**
- Given POST transfer timeout rồi GET operation trả 404 trước khi POST đầu tới server, when Admin chọn gửi lại, then mọi POST dùng cùng `Idempotency-Key` và server chỉ hoàn tất một transfer với response replayable.
- Given transaction transfer mới rollback hoặc process dừng trước commit, when Admin retry cùng key, then không có PENDING mới bị kẹt và transfer có thể hoàn tất an toàn một lần.
- Given legacy PENDING cùng owner, route và fingerprint, when retry cùng key chạy, then transaction recover record thành completed mà không vi phạm active-Student/Class archive invariant; request khác scope hoặc fingerprint vẫn conflict.
- Given operation PENDING, lookup 404/network error hoặc reload khi chưa biết outcome, when UI đối soát, then source/destination/key vẫn được giữ và cache chỉ refresh sau TransferResult xác nhận.

## Design Notes

`PENDING` được tạo trong transaction mới sẽ rollback cùng domain mutation nếu chưa commit; khi commit, response đã là `COMPLETED` cùng kết quả. Với PENDING legacy do protocol cũ, row lock operation và sorted Class locks serialize recovery; nếu một recoverer thắng, request khác retry serialization rồi replay response completed.

## Verification

**Commands:**
- `pnpm --filter api test` -- expected: unit/API contract tests pass.
- `docker compose -f docker-compose.test.yml up -d --wait && pnpm --filter api test:integration` -- expected: clean PostgreSQL migration and idempotency recovery/concurrency coverage pass.
- `pnpm --filter web test -- src/features/classes/detail-page.test.tsx` -- expected: timeout, delayed request, same-key retry and reload flows pass.
- `pnpm --filter web test:e2e` -- expected: browser class transfer regression pass.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: workspace checks pass.

## Suggested Review Order

**Protocol nguyên tử**

- Acquire, replay legacy recovery và kết quả completed cùng transaction domain.
  [`operations.service.ts:20`](../../apps/api/src/modules/operations/operations.service.ts#L20)

- Retry serializable bao trọn acquire, khóa lớp, chuyển học sinh và complete.
  [`classes.service.ts:71`](../../apps/api/src/modules/classes/classes.service.ts#L71)

**Đối soát web**

- Giữ tuple đã persist, chỉ tạo UUID cho thao tác hoàn toàn mới.
  [`detail-page.tsx:71`](../../apps/web/src/features/classes/detail-page.tsx#L71)

- Lookup PENDING, 404 và network error đều giữ trạng thái chưa xác định.
  [`detail-page.tsx:56`](../../apps/web/src/features/classes/detail-page.tsx#L56)

- Cache chỉ invalidated bởi kết quả transfer confirmed ở tầng UI.
  [`api.ts:60`](../../apps/web/src/features/classes/api.ts#L60)

**Bằng chứng**

- PostgreSQL chứng minh rollback không để PENDING và recovery legacy replay an toàn.
  [`classes.integration.test.ts:55`](../../apps/api/src/modules/classes/classes.integration.test.ts#L55)

- Web chứng minh timeout cộng lookup 404 vẫn retry với đúng idempotency key.
  [`detail-page.test.tsx:34`](../../apps/web/src/features/classes/detail-page.test.tsx#L34)

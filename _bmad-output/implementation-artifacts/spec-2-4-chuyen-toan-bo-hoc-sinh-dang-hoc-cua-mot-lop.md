---
title: 'Story 2.4: Chuyển toàn bộ Học sinh đang học của một Lớp'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_commit: 'dd1441cb70875c23772cdc46cc180701abef7d08'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Admin chưa thể chuyển nhanh toàn bộ Học sinh đang học khi cơ cấu một Lớp thay đổi. Thao tác này phải tránh chuyển nhầm Học sinh nghỉ học, tránh kết quả nửa chừng và cho phép đối soát an toàn khi mạng bị gián đoạn.

**Approach:** Bổ sung luồng từ trang chi tiết Lớp, nơi Admin xác nhận Lớp đích active và số em bị ảnh hưởng. API sở hữu transaction, locking và operation idempotent được lưu bền; web chỉ cập nhật dữ liệu sau kết quả hoặc đối soát operation đã được xác nhận.

## Boundaries & Constraints

**Always:** Chỉ Admin đã xác thực được gọi API. Chuyển cả Lớp chỉ cập nhật `Student.classId` của Học sinh `ACTIVE`; source và destination phải là hai Lớp `ACTIVE`, được khóa và kiểm tra lại trong transaction serializable để không thể commit Học sinh active thuộc Lớp archived. API nhận UUID `Idempotency-Key`, scope theo Admin + route, fingerprint request và lưu/replay final response trong cùng transaction; operation ID chính là key, chỉ owner được `GET /operations/:operationId`. Response/list giữ REST camelCase và envelope lỗi chuẩn. Danh sách Học sinh ở chi tiết Lớp phải phân trang, không nhúng danh sách không giới hạn vào Class. Web không tự retry write; timeout giữ operation ID, khóa modal ở trạng thái `Đang kiểm tra kết quả`, đối soát trước khi cho retry và chỉ invalidate Classes/Students sau confirmed success. Snapshot Hóa đơn không thay đổi.

**Ask First:** Dừng hỏi nếu cần thay đổi schema/snapshot Hóa đơn, thay đổi semantics operation dùng lại cho batch invoice/completion ngoài contract chung, hoặc thay đổi contract archive/Student lifecycle đã có.

**Never:** Không hard-delete, không sửa migration lịch sử, không chuyển Học sinh `INACTIVE`, không nhận source/destination archived, không dùng count từ client làm nguồn chân lý, không tự gửi lại mutation sau timeout và không mở API trả danh sách Student không phân trang.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Xác nhận chuyển cả Lớp | Source và destination khác nhau, đều `ACTIVE`; source có active/inactive Students | Transaction chuyển đúng toàn bộ active Student sang destination, giữ inactive Student ở source và trả source, destination, affected count cùng operation outcome | Không đổi snapshot Hóa đơn; web refresh sau response/reconciliation thành công |
| Replay idempotent | Cùng Admin, route, UUID key và fingerprint | Không chạy lại update; trả final response đã lưu của operation | Cùng key nhưng fingerprint khác trả conflict; key không được replay lẫn Admin/route |
| Source/destination không dùng được | UUID sai, source/destination missing/archived hoặc hai ID trùng | Không Học sinh nào bị đổi | API trả envelope lỗi ổn định gần field/action, modal giữ destination đã chọn |
| Timeout sau write | Client không nhận kết quả của POST | Modal khóa đóng/action, truy vấn operation bằng retained UUID | Chỉ bật retry khi operation xác nhận chưa áp dụng; unknown/không thuộc owner không làm lộ outcome |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- thêm model operation/idempotency và migration mới; quan hệ `Student.classId` cùng index `(classId, status)` đã đủ cho bulk update, không sửa migration lịch sử.
- `apps/api/src/modules/classes/classes.controller.ts` và `classes.service.ts` -- thêm action chuyển cả Lớp, tái dùng convention archive `Serializable`/`FOR UPDATE`, lấy source summary và `activeStudentCount` qua `GET /classes/:id`.
- `apps/api/src/modules/students/students.service.ts` -- `lockActiveClass` là convention kiểm tra active trong transaction; tái dùng hoặc trích primitive phù hợp để khóa cả source/destination trước bulk update.
- `apps/api/src/modules/students/students.dto.ts` và service list -- bổ sung filter `classId` phân trang cho chi tiết Lớp, không thay đổi response Class thành embedded list.
- `apps/api/src/common/auth/current-admin.decorator.ts` -- nhận Admin hiện hành để scope operation.
- `apps/api/src/modules/operations/` -- module/service/controller mới cho acquire/replay operation, fingerprint, persisted final result và `GET /operations/:operationId` thuộc owner.
- `apps/api/src/modules/classes/classes.service.test.ts`, `classes.integration.test.ts`, `students.integration.test.ts` -- mở rộng validation, atomicity, idempotency/replay và race archive-versus-bulk-transfer PostgreSQL.
- `apps/api/scripts/test-integration.ts` và `apps/api/vitest.integration.config.ts` -- harness PostgreSQL fail-closed và serial hiện có cần được giữ nguyên.
- `apps/web/src/app/api/client.ts` -- tái dùng credentialed CSRF/write-once timeout client; mở rộng truyền `Idempotency-Key` và read operation, không auto replay.
- `apps/web/src/features/classes/api.ts` và `page.tsx` -- tái dùng active-class picker, parser/query và ArchiveDialog pattern; thêm API/mutation cho transfer, link từ list đến Class detail và invalidate confirmed success.
- `apps/web/src/app/app.tsx` -- thêm route `/lop/:id` bên cạnh exact `/lop`.
- `apps/web/src/features/classes/` -- trang chi tiết Lớp, bảng Student phân trang và modal xác nhận/reconciliation; không thêm dữ liệu Student vào Class resource.
- `apps/web/src/features/classes/page.test.tsx` và `apps/web/e2e/classes.spec.ts` -- cover modal keyboard/focus, key header, timeout reconciliation, retry gating, success link và active-only picker.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` và migration mới trong `apps/api/prisma/migrations/` -- persist operation scoped Admin/route/key, fingerprint, state/final response và timestamps; generate client, không sửa migration cũ.
- [x] `apps/api/src/modules/operations/` và API module registration -- implement acquire/replay/conflict, owner-only lookup và stable error mapping để operation result được ghi atomically với domain mutation.
- [x] `apps/api/src/modules/classes/classes.dto.ts`, `classes.controller.ts`, `classes.service.ts` -- expose validated bulk-transfer action; khóa/revalidate hai Class active, bulk update chỉ Student active, tính affected count trong transaction và hoàn tất operation cùng result.
- [x] `apps/api/src/modules/students/students.dto.ts`, `students.controller.ts`, `students.service.ts` -- hỗ trợ list Student phân trang theo `classId` cho trang chi tiết mà vẫn giữ contract resource/list hiện hữu.
- [x] `apps/api/src/modules/classes/*.test.ts`, `apps/api/src/modules/students/students.integration.test.ts`, `apps/api/src/modules/operations/*.test.ts` -- cover mọi edge case matrix, rollback, concurrent same-key replay và archive source/destination cạnh tranh với bulk transfer trên PostgreSQL.
- [x] `apps/web/src/app/api/client.ts`, `apps/web/src/features/classes/api.ts`, `apps/web/src/app/app.tsx` -- thêm typed API, operation lookup, UUID write header, route detail và invalidate only after confirmed result.
- [x] `apps/web/src/features/classes/` cùng unit/E2E tests -- tạo detail source, paginated Students và confirmation modal nêu destination/count/inactive unaffected; lock during submit/reconcile, preserve selection/errors, toast số chuyển kèm link destination và accessible focus behavior.

**Acceptance Criteria:**
- Given Admin mở chi tiết một Lớp active, when chọn transfer và một destination active, then modal nêu Lớp đích, số Học sinh đang học bị ảnh hưởng, Học sinh nghỉ học không đổi, và Cancel không tạo write.
- Given Admin xác nhận với UUID `Idempotency-Key`, when API hoàn tất, then một transaction chỉ chuyển Student `ACTIVE`, source/destination được revalidate active, kết quả/count là server-authoritative và snapshot Hóa đơn không đổi.
- Given cùng Admin gửi lại cùng key/cùng request, when operation đã hoàn tất, then API replay final response; given key đó với request khác, then API trả conflict mà không đổi dữ liệu.
- Given archive Class cạnh tranh với chuyển cả Lớp, when các transaction kết thúc, then PostgreSQL không lưu Student `ACTIVE` tham chiếu Class `ARCHIVED` và không có bulk update nửa chừng.
- Given write timeout hoặc mất kết nối sau gửi, when web chưa biết kết quả, then modal hiển thị `Đang kiểm tra kết quả`, đối soát owner operation trước retry, và chỉ làm mới source/destination/Students sau outcome thành công.

## Spec Change Log

## Design Notes

Đặt operation thành module dùng chung ngay từ Story 2.4 vì architecture spine đã yêu cầu cùng model idempotency cho bulk invoice và completion. Kết quả final response phải được persist với mutation, không chỉ lưu marker đã xử lý, để retry và reconciliation có một nguồn chân lý. Trang chi tiết Lớp dùng Student resource phân trang nhằm giữ Class resource bounded.

## Verification

**Commands:**
- `docker compose -f docker-compose.test.yml up -d --wait` -- expected: PostgreSQL integration database healthy.
- `pnpm --filter api prisma:generate` -- expected: Prisma client khớp operation schema/migration mới.
- `pnpm --filter api test:integration` -- expected: atomic transfer, idempotency và concurrency coverage pass trên PostgreSQL.
- `pnpm --filter api test` -- expected: DTO/service/operation validation tests pass.
- `pnpm --filter web test -- src/features/classes/page.test.tsx` -- expected: detail, dialog, timeout reconciliation và cache behavior pass.
- `pnpm --filter web exec playwright test e2e/classes.spec.ts` -- expected: accessible whole-class transfer flow pass.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: toàn workspace checks pass.
- `docker compose -f docker-compose.test.yml down -v` -- expected: integration service/data được dọn sau xác minh.

## Suggested Review Order

**Giao dịch và idempotency**

- Chuyển active Students atomically, khóa hai Class và lưu final operation response.
  [`classes.service.ts:71`](../../apps/api/src/modules/classes/classes.service.ts#L71)

- Schema operation scope theo Admin, route, UUID key và fingerprint.
  [`schema.prisma:20`](../../apps/api/prisma/schema.prisma#L20)

- Replay/conflict và operation lookup được giới hạn theo owner.
  [`operations.service.ts:1`](../../apps/api/src/modules/operations/operations.service.ts#L1)

**REST contract**

- Endpoint transfer và operation lookup áp validation/owner guard.
  [`classes.controller.ts:1`](../../apps/api/src/modules/classes/classes.controller.ts#L1)

- Student list nhận filter `classId` có phân trang, giữ Class resource bounded.
  [`students.service.ts:1`](../../apps/api/src/modules/students/students.service.ts#L1)

**Trải nghiệm đối soát**

- Detail Lớp, modal transfer, timeout polling và feedback destination nằm tại một điểm.
  [`detail-page.tsx:1`](../../apps/web/src/features/classes/detail-page.tsx#L1)

- Client gửi UUID key, đọc operation và chỉ invalidate sau outcome xác nhận.
  [`api.ts:53`](../../apps/web/src/features/classes/api.ts#L53)

**Regression coverage**

- PostgreSQL xác nhận atomicity, concurrent replay và race archive-versus-transfer.
  [`classes.integration.test.ts:40`](../../apps/api/src/modules/classes/classes.integration.test.ts#L40)

- Browser flow kiểm tra detail link, modal focus và idempotency header.
  [`classes.spec.ts:39`](../../apps/web/e2e/classes.spec.ts#L39)

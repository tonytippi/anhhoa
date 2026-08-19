---
title: 'Story 2.3: Chuyển một Học sinh giữa các Lớp'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_commit: '15bdc102480740b8f300905821339bccc1b1df16'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Admin hiện chưa thể gán hoặc chuyển Lớp hiện tại của một Học sinh, khiến dữ liệu nguồn cho thu phí không phản ánh Lớp đang học thực tế.

**Approach:** Mở rộng luồng sửa Học sinh để chọn hoặc bỏ gán Lớp hiện tại, với API chỉ chấp nhận Lớp đang hoạt động và bảo vệ đồng thời với thao tác lưu trữ Lớp.

## Boundaries & Constraints

**Always:** Dùng `PATCH /students/:id` với `classId` UUID hoặc `null`; `classId` chỉ cập nhật Lớp hiện tại và không làm thay đổi bất kỳ snapshot Hóa đơn nào. API giữ REST/camelCase/envelope lỗi chuẩn, Admin guard, origin validation và double-submit CSRF. Việc gán/chuyển Lớp, kích hoạt lại Học sinh có Lớp và archive Lớp phải cùng transaction serializable, kiểm tra Lớp đích vẫn `ACTIVE` trong transaction, để không thể tồn tại Học sinh `ACTIVE` thuộc Lớp `ARCHIVED`. Client dùng request write một lần hiện hữu, chỉ invalidates Student và Class sau response thành công, và giữ form khi lỗi/timeout. Picker chỉ có Lớp `ACTIVE`; trước khi lưu phải nêu thay đổi chỉ áp dụng hiện tại, không đổi snapshot Hóa đơn.

**Ask First:** Dừng hỏi nếu cần thêm endpoint lựa chọn Lớp chuyên dụng, thay đổi contract Class hiện hữu, thêm Idempotency-Key/operation reconciliation, hoặc thay đổi schema/snapshot Hóa đơn.

**Never:** Không hard-delete, không chỉnh sửa migration lịch sử, không cho chọn Lớp `ARCHIVED`, không tự retry mutation, không chuyển hàng loạt, và không tự động đổi Lớp khi tạo Học sinh.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Chuyển hoặc bỏ gán Lớp | Admin sửa Học sinh với `classId` UUID của Lớp `ACTIVE` hoặc `null` | Persist đúng quan hệ hiện tại, trả Học sinh kèm thông tin Lớp hiện tại để danh sách phản ánh tên Lớp mới | Không chạm snapshot Hóa đơn; web chỉ refresh sau response thành công |
| Lớp đích không hợp lệ | UUID sai, Lớp không tồn tại hoặc `ARCHIVED` | Không thay đổi Học sinh | API trả envelope lỗi chuẩn với lỗi gần `classId`; dialog giữ giá trị đã chọn |
| Race archive/gán hoặc kích hoạt | Archive Lớp chạy đồng thời với gán Lớp hay kích hoạt lại Học sinh có Lớp | Chỉ một trạng thái hợp lệ được commit | Không thể commit Học sinh `ACTIVE` trỏ tới Lớp `ARCHIVED`; lỗi transaction được chuẩn hóa, không persist nửa chừng |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma:29-52` -- `Student.classId` nullable, quan hệ restrict và index `(classId, status)` đã đủ; không cần migration chỉ cho chuyển từng em.
- `apps/api/src/modules/students/students.dto.ts:14-20` -- `UpdateStudentDto` hiện chỉ nhận identity; thêm validate UUID/null phân biệt với omitted cho `classId`.
- `apps/api/src/modules/students/students.controller.ts:9-14` -- giữ `PATCH /students/:id` làm contract sửa Học sinh.
- `apps/api/src/modules/students/students.service.ts:6-52` -- mở rộng serialize bằng summary Lớp, update và reactivation chạy transaction serializable, revalidate Class active và trả lỗi domain chuẩn.
- `apps/api/src/modules/classes/classes.service.ts:57-67` -- archive đã dùng transaction serializable; điều chỉnh locking/revalidation cùng convention assignment để đóng race hai chiều.
- `apps/api/src/modules/students/students.dto.test.ts`, `students.service.test.ts`, `students.integration.test.ts` -- mở rộng validation, transfer/reject và race PostgreSQL; harness integration hiện có fail-closed.
- `apps/web/src/features/students/api.ts:5-29` -- parser `Student` đã có `classId`; thêm current-Class summary, input PATCH và invalidate cả query Student/Class khi thành công.
- `apps/web/src/features/classes/api.ts:5-32` -- tái dùng resource/list query Lớp `ACTIVE` cho picker, không sửa contract Class.
- `apps/web/src/features/students/page.tsx:9-34` -- thay placeholder Story 2.3 bằng trường Lớp, cột tên Lớp, cảnh báo snapshot và field error giữ form.
- `apps/web/src/features/students/page.test.tsx`, `apps/web/e2e/students.spec.ts` -- bổ sung picker active, PATCH payload, lỗi/timeout retention, invalidation sau thành công và flow keyboard.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/modules/students/students.dto.ts`, `students.controller.ts`, `students.service.ts` -- nhận `classId` khi sửa, trả current-Class summary và thực hiện gán/bỏ gán trong transaction serializable; revalidate Lớp active và bảo vệ kích hoạt lại để giữ invariant archive-assignment.
- [x] `apps/api/src/modules/classes/classes.service.ts` -- đồng bộ archive với locking/transaction convention của Student mutation, không cho archive vượt qua active assignment đồng thời.
- [x] `apps/api/src/modules/students/*.test.ts` và `apps/api/src/modules/classes/classes.integration.test.ts` -- cover UUID/null/omitted, chuyển thành công, target archived/missing, không đổi record khi reject, reactivation và race PostgreSQL archive-versus-assignment.
- [x] `apps/web/src/features/students/api.ts`, `page.tsx`, và tests -- hiển thị tên Lớp, picker Lớp active khi sửa, cảnh báo snapshot, map lỗi `classId`, giữ selection sau lỗi/timeout và invalidate hai resource chỉ khi success.
- [x] `apps/web/e2e/students.spec.ts` -- xác minh Admin chọn Lớp active, request credentialed/CSRF đúng, danh sách hiện Lớp mới và Lớp archived không là lựa chọn.

**Acceptance Criteria:**
- Given Admin sửa một Học sinh, when chọn Lớp đích `ACTIVE` hoặc bỏ gán rồi lưu, then API cập nhật duy nhất Lớp hiện tại và web hiển thị tên Lớp mới sau response thành công.
- Given Học sinh có Hóa đơn lịch sử, when current Class thay đổi, then dữ liệu nguồn thay đổi không làm đổi identity, Lớp, học phí hay line snapshot của mọi Hóa đơn tồn tại và web cảnh báo điều này trước submit.
- Given Lớp đích archived, không tồn tại hoặc input không hợp lệ, when Admin lưu, then API trả envelope chuẩn, Học sinh không đổi, dialog giữ toàn bộ dữ liệu và lỗi nằm gần field/action liên quan.
- Given archive Lớp chạy cạnh tranh với assignment hoặc reactivation, when transactions hoàn tất, then PostgreSQL không thể lưu Học sinh `ACTIVE` thuộc Lớp `ARCHIVED`.
- Given write timeout hoặc API lỗi, when request đã bắt đầu, then client không replay, không invalidate cache sớm và Admin vẫn có form để đối soát trước khi tự gửi lại.

## Design Notes

`classId` thuộc cùng form sửa identity nhưng chỉ được cho sửa trên Học sinh tồn tại, giữ quyết định Story 2.2 rằng tạo Học sinh không gán Lớp. Response Student cần summary Lớp tối thiểu để bảng không suy diễn tên từ trang Class phân trang. Không thêm confirmation modal vì chuyển một Học sinh không phải destructive action; cảnh báo snapshot là guardrail bắt buộc.

## Verification

**Commands:**
- `docker compose -f docker-compose.test.yml up -d --wait` -- expected: PostgreSQL integration database healthy.
- `pnpm --filter api prisma:generate` -- expected: Prisma client khớp schema hiện hữu.
- `pnpm --filter api test:integration` -- expected: Student/Class persistence và concurrency coverage pass trên PostgreSQL test database.
- `pnpm --filter api test` -- expected: DTO/service validation và transition tests pass.
- `pnpm --filter web test -- src/features/students/page.test.tsx` -- expected: picker, error/timeout retention và cache behavior pass.
- `pnpm --filter web exec playwright test e2e/students.spec.ts` -- expected: Admin transfer flow accessible pass.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: toàn workspace checks pass.
- `docker compose -f docker-compose.test.yml down -v` -- expected: integration service/data được dọn sau xác minh.

## Suggested Review Order

**Giao dịch và invariant**

- Khóa Lớp và xác thực trạng thái trong transaction trước khi ghi Student.
  [`students.service.ts:43`](../../apps/api/src/modules/students/students.service.ts#L43)

- Chuẩn hóa lỗi Lớp đích để UI đặt tại đúng field.
  [`domain.exception.ts:1`](../../apps/api/src/common/errors/domain.exception.ts#L1)

- Chuyển xung đột serialization thành error envelope ổn định.
  [`api-exception.filter.ts:5`](../../apps/api/src/common/filters/api-exception.filter.ts#L5)

- Archive giữ cùng row-locking convention với assignment.
  [`classes.service.ts:57`](../../apps/api/src/modules/classes/classes.service.ts#L57)

**Contract và giao diện**

- Parser bắt buộc summary Lớp nhất quán với `classId`.
  [`api.ts:10`](../../apps/web/src/features/students/api.ts#L10)

- Picker active bảo toàn Lớp archived hiện hữu và chặn submit khi tải lỗi.
  [`page.tsx:39`](../../apps/web/src/features/students/page.tsx#L39)

- Mutation làm mới cả Student và Class sau response xác nhận.
  [`api.ts:28`](../../apps/web/src/features/students/api.ts#L28)

**Coverage**

- Race archive với assignment/reactivation được xác nhận trên PostgreSQL.
  [`students.integration.test.ts:55`](../../apps/api/src/modules/students/students.integration.test.ts#L55)

- Form cover selection active, retention và lỗi tải Lớp.
  [`page.test.tsx:65`](../../apps/web/src/features/students/page.test.tsx#L65)

- Browser flow kiểm tra CSRF, payload và bảng phản ánh Lớp mới.
  [`students.spec.ts:19`](../../apps/web/e2e/students.spec.ts#L19)

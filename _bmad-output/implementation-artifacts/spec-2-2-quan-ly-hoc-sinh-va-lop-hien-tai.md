---
title: 'Story 2.2: Quản lý Học sinh và Lớp hiện tại'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_commit: '60f61e46cbcb3e4dd6347b104b51f140b43f148a'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
  - '_bmad-output/planning-artifacts/epics.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Hệ thống đã có Lớp nhưng chưa có resource hay giao diện Học sinh, nên Admin chưa thể duy trì danh sách đối tượng thu phí và trạng thái đang học/nghỉ học một cách truy vết được.

**Approach:** Bổ sung lifecycle Học sinh có lưu trữ mềm, danh sách/tìm kiếm và form dữ liệu cơ bản trên API và web. Theo quyết định của người dùng, Story này không gán hoặc chuyển Lớp hiện tại; Story 2.3 sở hữu toàn bộ luồng đó.

## Boundaries & Constraints

**Always:** Bảo vệ `/students` bằng global Admin guard, origin validation và double-submit CSRF đang có; API là nguồn chân lý với REST camelCase, UUID, timestamp UTC ISO 8601, list `{ data, meta }`, action `{ data }` và lỗi `{ error: { code, message, fieldErrors? } }`. Học sinh có `fullName` bắt buộc đã trim, `nickname` tùy chọn đã trim, và trạng thái `ACTIVE`/`INACTIVE`; không xóa cứng. Danh sách tìm theo tên đầy đủ/biệt danh trước khi lọc trạng thái, có phân trang xác định và Học sinh nghỉ học vẫn tìm/xem được. Chỉ thay đổi status qua xác nhận nghỉ học/kích hoạt lại; form, dialog và table đáp ứng các yêu cầu accessibility đã có, giữ dữ liệu khi lưu lỗi, dùng client credentialed không tự replay write. Mọi thay đổi schema là migration mới trong `apps/api/prisma` và test PostgreSQL phải dùng harness database riêng.

**Ask First:** Dừng để hỏi nếu cần thêm trường Học sinh ngoài họ tên, biệt danh và status; thay đổi API Lớp; thực hiện bất kỳ gán/chuyển Lớp nào; hoặc cần một toast library/deployment dependency mới.

**Never:** Không thêm `classId` vào create/update UI hay API DTO của Story này, không tạo picker Lớp, không sửa migration lịch sử, không hard-delete, không đổi snapshot Hóa đơn, không tự retry mutation, và không sửa artifact planning đã final.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Tạo Học sinh | `fullName` hợp lệ và `nickname` tùy chọn | Persist Học sinh `ACTIVE`, `classId` luôn `null`, trả resource chuẩn | Tên trống sau trim hoặc vượt giới hạn trả field error, dialog giữ giá trị |
| Danh sách/tìm kiếm | Search, status, page hợp lệ; gồm page vượt phạm vi | Trả `{ data, meta }`, lọc tên/biệt danh và giữ requested page rỗng hợp lệ | DTO từ chối status/page không hợp lệ |
| Nghỉ học/kích hoạt | Học sinh tồn tại ở `ACTIVE` hoặc `INACTIVE` | Action đổi trạng thái, không xóa record; action lặp cùng trạng thái an toàn | Không tìm thấy trả lỗi resource chuẩn; UI giữ modal khi mutation thất bại |
| Gán Lớp | Create/update Học sinh có `classId` hoặc UI yêu cầu chọn Lớp | Không có mutation hay picker nhận gán Lớp trong Story này | Không mở rộng scope; Story 2.3 sẽ sở hữu contract/UX gán và chuyển Lớp |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma:41-50` -- Student model sẵn có `fullName`, `status`, `classId`; thêm `nickname` nullable nhưng không expose/gán `classId` tại Story 2.2.
- `apps/api/prisma/migrations/20260819010000_add_classes_and_students/migration.sql:15-27` -- migration lịch sử tạo Student, chỉ tham chiếu; tạo migration mới cho `nickname`.
- `apps/api/src/app.module.ts:7-12` -- đăng ký `StudentsModule`; global auth/CSRF đang tự áp dụng cho module mới.
- `apps/api/src/modules/classes/classes.dto.ts:5-17`, `classes.service.ts:16-66` -- mẫu DTO trim/validation, list metadata, serialization JSON-safe và transaction; không thêm Student vào Class resource.
- `apps/api/src/modules/classes/classes.integration.test.ts:1-38` -- harness PostgreSQL fail-closed và pattern test persistence để tái sử dụng cho Student.
- `apps/web/src/app/app.tsx:5-48` -- route `/hoc-sinh` hiện có sidebar nhưng chưa render trang Student.
- `apps/web/src/features/classes/api.ts:4-32`, `page.tsx:8-56`, `page.test.tsx:13-109` -- mẫu parser REST nghiêm ngặt, React Query invalidation sau thành công, URL filters, dialog/error/focus và test UI.
- `apps/web/src/app/api/client.ts:26-84` -- client bắt CSRF, cookie credentials và timeout một-write/no-replay bắt buộc dùng cho mutation Student.
- `apps/web/e2e/classes.spec.ts:6-36` -- mẫu Playwright mock auth/API/CSRF và kiểm tra keyboard/focus cho trang quản trị.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` và migration mới trong `apps/api/prisma/migrations/` -- thêm biệt danh nullable cho Student bằng migration commit được, giữ `classId` nullable nhưng không thao tác ở Story này.
- [x] `apps/api/src/modules/students/` và `apps/api/src/app.module.ts` -- tạo DTO, controller, service, module cho list/detail/create/update identity và action status; validate/serialize contract và không nhận `classId`.
- [x] `apps/api/src/modules/students/*.test.ts` và integration test phù hợp -- cover trim/boundary, search/filter/pagination, inactive visibility, transitions mềm và persistence migration trên PostgreSQL test database.
- [x] `apps/web/src/features/students/api.ts`, `page.tsx`, và tests -- consume contract Student, table search/filter URL, create/edit identity dialog, confirmation nghỉ học/kích hoạt và lỗi/timeout không mất form.
- [x] `apps/web/src/app/app.tsx` và `apps/web/e2e/students.spec.ts` -- render `/hoc-sinh` và cover authenticated administrative flow, accessible table/dialog và status action bằng browser test.

**Acceptance Criteria:**
- Given Admin truy cập `/hoc-sinh`, when tìm theo tên hoặc biệt danh, đổi filter trạng thái hay trang, then web phản ánh filter trên URL và API trả trang `{ data, meta }` hợp lệ, gồm cả Học sinh `INACTIVE` và trang vượt phạm vi.
- Given Admin tạo hoặc sửa Học sinh, when họ nhập họ tên và biệt danh tùy chọn, then API lưu identity hợp lệ với `classId: null`, web validate khi blur/lưu, giữ dialog khi lỗi và nêu rõ Lớp hiện tại sẽ được quản lý ở Story 2.3.
- Given Học sinh `ACTIVE`, when Admin xác nhận cho nghỉ học, then record chuyển `INACTIVE` thay vì bị xóa, modal xử lý focus/submit đúng và UI hiển thị trạng thái chữ cùng phản hồi ngắn.
- Given Học sinh `INACTIVE`, when Admin kích hoạt lại, then record chuyển `ACTIVE` mà không tự gán Lớp và vẫn không có endpoint/UI nhận `classId`.
- Given API hoặc web nhận dữ liệu Học sinh không hợp lệ hay mutation timeout, when request bị từ chối hoặc hết hạn, then error theo envelope chuẩn/timeout một request, không replay và dữ liệu form vẫn sẵn để Admin đối soát rồi tự gửi lại.

## Design Notes

Tách gán Lớp khỏi lifecycle tránh vi phạm ownership của Story 2.3 và không tạo quan hệ active-Student-to-archived-Class trước khi transaction/locking chung được triển khai. Help text ở form phải minh bạch đây là giới hạn tạm thời của luồng hiện tại, không được dựng picker Lớp không hoạt động.

## Verification

**Commands:**
- `docker compose -f docker-compose.test.yml up -d --wait` -- expected: PostgreSQL test riêng healthy.
- `pnpm --filter api prisma:generate` -- expected: Prisma client khớp schema Student mới.
- `pnpm --filter api test:integration` -- expected: migration sạch và Student integration tests pass trên database test.
- `pnpm --filter api test` -- expected: DTO/service API tests pass.
- `pnpm --filter web test -- src/features/students/page.test.tsx` -- expected: contract, URL filters, form retention và lifecycle UI pass.
- `pnpm --filter web exec playwright test e2e/students.spec.ts` -- expected: browser flow Student pass.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` -- expected: workspace checks pass.
- `docker compose -f docker-compose.test.yml down -v` -- expected: test service/data được dọn sau xác minh.

## Suggested Review Order

**Student API Contract**

- Resource Student giới hạn identity/lifecycle, không nhận gán Lớp ở Story này.
  [`students.controller.ts:9`](../../apps/api/src/modules/students/students.controller.ts#L9)

- Service chuẩn hóa identity, phân trang và status transition mềm idempotent.
  [`students.service.ts:16`](../../apps/api/src/modules/students/students.service.ts#L16)

- DTO phân biệt nickname bỏ qua với nickname `null` để xóa chủ động.
  [`students.dto.ts:14`](../../apps/api/src/modules/students/students.dto.ts#L14)

**Persistence And Integration**

- Migration bổ sung cột biệt danh nullable, không thay đổi migration lịch sử.
  [`migration.sql:1`](../../apps/api/prisma/migrations/20260819020000_add_student_nickname/migration.sql#L1)

- Integration test áp migration sạch và xác nhận persistence/lifecycle thực trên PostgreSQL.
  [`students.integration.test.ts:13`](../../apps/api/src/modules/students/students.integration.test.ts#L13)

**Operations UI**

- Trang đồng bộ search, filter và phân trang vào URL; dialog giữ focus và dữ liệu.
  [`page.tsx:9`](../../apps/web/src/features/students/page.tsx#L9)

- API client parse response nghiêm ngặt nhưng tương thích `classId` của Story 2.3.
  [`api.ts:10`](../../apps/web/src/features/students/api.ts#L10)

- Router gắn bề mặt quản trị Student vào route đã có trên sidebar.
  [`app.tsx:46`](../../apps/web/src/app/app.tsx#L46)

**Regression Coverage**

- Unit test kiểm tra form, timeout, lifecycle và focus return của CTA empty state.
  [`page.test.tsx:13`](../../apps/web/src/features/students/page.test.tsx#L13)

- Browser test kiểm tra route, table và confirmation dialog có thể truy cập.
  [`students.spec.ts:6`](../../apps/web/e2e/students.spec.ts#L6)

---
title: 'Cung cấp Parent REST read model'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_revision: 'd4d321fd8209c62c2bc788012b7d18f8a93ab505'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-6-context.md'
warnings: []
deferred:
  - summary: >-
      Vitest unit suite exits non-zero because a Nest worker crashes during initialization after most tests pass.
    evidence: |-
      `pnpm --dir apps/api test` reported 26/27 files and 113/114 tests passed, then emitted `[vitest-pool]: Worker forks emitted error`; build and PostgreSQL integration suites pass.
    location: >-
      apps/api Vitest worker runtime
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Parent PWA mới chỉ bootstrap được identity qua `/api/parent/me`, chưa có read model riêng để nhận danh sách Học sinh và Hóa đơn mà không lộ dữ liệu quản trị hoặc dữ liệu ngoài phạm vi liên kết active.

**Approach:** Tạo `parent-portal` chỉ đọc với DTO và query riêng, đặt dưới `/api/parent`, dùng Parent session guard và luôn giới hạn dữ liệu bằng Parent/StudentParent `ACTIVE` tại server.

## Boundaries & Constraints

**Always:** `/me` tiếp tục trả identity tối thiểu. Mọi endpoint portal phải `@Public()` để bỏ qua global Admin guard nhưng dùng `ParentSessionGuard` cục bộ. Students chỉ gồm các liên kết `ACTIVE`; invoices chỉ gồm `PENDING` hoặc `COMPLETED`, có `{ data, meta }`, page size bounded, sort ổn định và validation server-side. Direct ID và filter unauthorized phải bị từ chối mơ hồ, trước khi dựng DTO. Dùng snapshot invoice/item; chỉ trả Học sinh snapshot, billing month, dòng phí, tổng VND, payment method và status cần cho Parent.

**Block If:** Schema invoice hiện hữu không có snapshot tối thiểu để trả student, billing month, dòng phí, tổng VND, phương thức và trạng thái mà không đọc source mutable hoặc dữ liệu Admin.

**Never:** Không gọi lại Admin controller hoặc tái sử dụng Admin invoice/student serializer; không trả `DRAFT`, QR/payment payload, mutable bank account, audit, Parent khác, mutation controls hay filter/search Admin. Không thêm payment endpoint hay UI cho Story 6.3/6.4.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Authorized list | Parent active có hai StudentParent active | `/students` chỉ trả DTO tối thiểu của hai Học sinh; `/invoices` chỉ trả snapshot `PENDING`/`COMPLETED` trong phạm vi đó với meta phân trang | Không có lỗi |
| Valid filter/page | `studentId` được quyền, `billingMonth` hợp lệ, status `PENDING` hoặc `COMPLETED`, page/pageSize hợp lệ | List giới hạn đúng dữ liệu, thứ tự `createdAt desc, id desc` ổn định và meta bounded | Page vượt dữ liệu trả list rỗng theo convention |
| Unauthorized or invalid filter | Student UUID ngoài quyền, status ngoài allowlist, billing month/page/pageSize malformed | Không query/return dữ liệu ngoài quyền hoặc `DRAFT` | Error envelope chuẩn; student ngoài quyền bị từ chối mơ hồ |
| Direct invoice access | Invoice UUID `DRAFT`, ngoài quyền, không tồn tại hoặc malformed | Không trả DTO hay xác nhận tồn tại | Unauthorized envelope giống nhau cho các direct-ID denial |
| Revoked link | StudentParent đã `REVOKED` nhưng Parent còn link active khác | Student/invoice của student revoked biến mất hoặc bị từ chối; Parent vẫn dùng endpoint cho student còn active | Không sign out Parent session chỉ vì một link bị revoke |

</intent-contract>

## Code Map

- `apps/api/src/modules/parent-auth/parent-auth.controller.ts` -- `GET /parent/me` là identity contract có sẵn; không mở rộng DTO ngoài nhu cầu bootstrap.
- `apps/api/src/modules/parent-auth/parent-session.guard.ts` -- local guard xác thực cookie Parent, active Parent và còn ít nhất một link active, rồi gắn `request.user`.
- `apps/api/src/modules/parents/parents.service.ts` -- `authorizeStudent` và `authorizeInvoice` là primitive direct-ID opaque; list phải query relation-scoped thay vì serialize rồi authorize từng dòng.
- `apps/api/src/app.module.ts` -- global `SessionAuthGuard` là Admin-only, nên Parent portal module/controller phải `@Public()` và tự áp guard Parent.
- `apps/api/prisma/schema.prisma` -- relation retained Parent/StudentParent cùng invoice snapshots và `InvoiceItem` là nguồn read-only cho Parent DTO.
- `apps/api/src/modules/invoices/invoices.service.ts` -- chỉ làm mẫu pagination/repeatable-read/stable sort; serializer và query Admin không được tái dùng vì chứa fields nội bộ.
- `apps/api/src/modules/students/students.service.ts` -- làm mẫu `{ data, meta }` và pagination; DTO Admin không phù hợp Parent.
- `apps/api/src/common/filters/api-exception.filter.ts`, `apps/api/src/main.ts` -- error envelope và validation pipe chuẩn cần được giữ nguyên.
- `apps/api/src/modules/parents/parents.integration.test.ts` -- fixtures và bằng chứng relation/authorization hiện có để mở rộng hoặc tham chiếu từ test portal.

## Tasks & Acceptance

**Execution:**
- `apps/api/src/modules/parent-portal/**` -- tạo module, public controller, DTO query/response và service read-only cho `/parent/students`, `/parent/invoices`, `/parent/invoices/:invoiceId`; local Parent guard và Prisma relation-scoped query bảo đảm boundary Parent portal.
- `apps/api/src/app.module.ts` -- đăng ký `ParentPortalModule` để các route Parent có thể hoạt động, không thay đổi Admin route surface.
- `apps/api/src/modules/parent-portal/parent-portal.integration.test.ts` -- tạo PostgreSQL integration coverage cho identity/student scope, multi-child, revoke, list pagination/sort/filter, `DRAFT`, direct UUID denial và minimized response DTO.
- `apps/api/src/modules/parent-portal/parent-portal.controller.test.ts` -- chứng minh controller bỏ global Admin guard đúng cách nhưng yêu cầu local Parent session guard.

**Acceptance Criteria:**
- Given Parent session hợp lệ, when gọi `GET /api/parent/me` hoặc `GET /api/parent/students`, then API trả identity tối thiểu và các Học sinh có `StudentParent ACTIVE`, không kèm audit, Parent khác hoặc Học sinh ngoài quyền.
- Given Parent gọi `GET /api/parent/invoices` với filter hợp lệ `studentId`, `billingMonth` hoặc `status`, when service xử lý, then chỉ `PENDING`/`COMPLETED` của Student active được trả trong `{ data, meta }` có page size bounded, sort ổn định và validation server-side.
- Given filter invalid, student không được quyền, invoice UUID direct không tồn tại/ngoài quyền hoặc invoice `DRAFT`, when endpoint xử lý, then API từ chối hoặc không trả kết quả theo error contract chuẩn mà không lộ tồn tại hay trả `DRAFT`.
- Given Parent mở invoice `PENDING` hoặc `COMPLETED` được quyền, when API trả detail, then DTO chỉ có student snapshot, billing month, dòng phí, tổng VND, payment method và status read-only, không có bank source mutable, payment payload, audit hay mutation control.
- Given PostgreSQL integration tests chạy, when nhiều con, link `REVOKED`, pagination/sort/filter và direct UUID được kiểm tra, then authorization được đánh giá tại server cho từng endpoint và DTO Parent được tối giản.

## Spec Change Log

Không có thay đổi spec sau planning.

## Review Triage Log

### 2026-08-22 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 5 (medium 4, low 1)
- defer: 1 (medium 1)
- reject: 7
- addressed_findings:
  - `[medium] [patch]` Chạy count và page query trong transaction `RepeatableRead` để metadata pagination nhất quán.
  - `[medium] [patch]` Từ chối fail-closed invoice visible thiếu payment snapshot method bắt buộc.
  - `[medium] [patch]` Siết integration assertions thành exact Parent DTO shape để ngăn lộ audit, bank và payment data.
  - `[medium] [patch]` Thêm coverage stable sort xuyên page boundary cùng validation filter hợp lệ/không hợp lệ.
  - `[low] [patch]` Mở rộng guard-contract test tới đủ ba Parent portal routes.

## Design Notes

`ParentSessionGuard` xác nhận Parent còn ít nhất một link active nhưng không đủ để cấp quyền cho một student/invoice cụ thể. Danh sách phải constrain ngay trong Prisma relation query; direct route phải dùng authorization primitive trước khi serialize để response không trở thành oracle cho UUID.

## Verification

**Commands:**
- `pnpm --dir apps/api test` -- expected: unit tests, gồm guard/controller portal, pass.
- `pnpm --dir apps/api test:integration` -- expected: PostgreSQL Parent portal contract và regression suite pass.
- `pnpm --dir apps/api build` -- expected: Nest API compile thành công.
- `git diff --check` -- expected: không có whitespace error.

## Auto Run Result

- Summary: Thêm Parent portal read-only cho danh sách Học sinh, danh sách Hóa đơn và chi tiết Hóa đơn, luôn giới hạn theo Parent/StudentParent active và chỉ trả DTO tối thiểu.
- Files changed: `apps/api/src/modules/parent-portal/**` thêm module/controller/service/DTO và test; `apps/api/src/app.module.ts` đăng ký module; `apps/api/src/modules/parent-auth/parent-auth.module.ts` export guard dependency; artifact Epic/Story và sprint tracker ghi execution state.
- Review findings: 5 patches đã áp dụng (medium 4, low 1); 1 deferred (medium); 7 rejected. Follow-up review recommendation: `false` (score 13, không có high severity).
- Verification: `pnpm --dir apps/api build` passed; `pnpm --dir apps/api test:integration` passed (9 files, 51 tests); `git diff --check` passed. `pnpm --dir apps/api test` remains non-zero do Nest/Vitest worker crash after 113/114 tests; deferred for focused runtime investigation.
- Residual risks: Không thêm index mới cho Parent invoice query vì chưa có workload evidence; theo dõi query plan khi volume invoice thực tế tăng.

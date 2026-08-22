---
title: 'Story 5.1: Luu tru lien ket Parent-Hoc sinh'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_revision: '9959ce120108ac39075eeeb483225cb8f8cb0d51'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** API chua co du lieu Parent hay lien ket nhieu-nhieu retained voi Hoc sinh, nen cac story sau khong the cap, thu hoi va kiem tra quyen Parent ma van giu lich su.

**Approach:** Them Prisma models/migration va `parents` service noi bo quan ly grant, reactivate, revoke lien ket. Chung minh lifecycle va rang buoc database bang PostgreSQL integration tests.

## Boundaries & Constraints

**Always:** Luu UUID, FK restrictive va unique `(parentId, studentId)` tai PostgreSQL; `Parent` moi mac dinh `ACTIVE`, `googleSubject` va `displayName` nullable truoc Parent OAuth; link chi co `ACTIVE`/`REVOKED`; revoke luu Admin/thoi diem va khong xoa record; service mutation chay trong transaction.

**Block If:** Prisma migration khong the ap dung hoac codebase hien co yeu cau contract Parent status khac `ACTIVE`/`INACTIVE`.

**Never:** Them Admin REST endpoint/UI, Parent OAuth/session/PWA, Parent read model/authorization endpoint, hard delete Parent/Student/link, hay sua lifecycle Hoa don.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Grant moi | Parent va Hoc sinh chua co link | Tao Parent neu can va `StudentParent ACTIVE` | Unique conflict khong tao link trung |
| Cap lai | Link duy nhat `REVOKED` | Dung lai record, doi sang `ACTIVE`, xoa revoke metadata | Khong tao record moi |
| Thu hoi | Link `ACTIVE`, Admin thu hoi | Doi sang `REVOKED`, luu `revokedAt`, `revokedBy` | Link khong active bi tu choi |
| Nhieu chieu | Mot Parent/Student da co links active khac | Cac link khac van ton tai va active | FK restrictive ngan xoa record tham chieu |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- khai bao `Admin`, `Student` va cac enum/model Prisma; them relations Parent retained.
- `apps/api/prisma/migrations/` -- chua cac migration PostgreSQL da commit; migration Story 5.1 phai nam tai day.
- `apps/api/src/app.module.ts` -- noi dang ky domain module va global Admin auth/CSRF; import `ParentsModule` khong expose route.
- `apps/api/src/common/prisma/prisma.module.ts` -- Prisma provider dung chung cho domain service.
- `apps/api/src/modules/students/students.integration.test.ts` -- mau PostgreSQL integration test va cleanup theo FK.
- `apps/api/src/modules/operations/operations.service.ts` -- pattern transaction/idempotency cua endpoint Admin, de lai cho Story 5.2 vi Story nay chua co HTTP mutation.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` -- them Parent/StudentParent enums, fields va relations nguoc -- tao model retained nhieu-nhieu co rang buoc database.
- [x] `apps/api/prisma/migrations/*_add_parents_and_student_parents/migration.sql` -- tao enum, tables, FK restrictive, indexes va unique constraint -- version hoa thay doi PostgreSQL.
- [x] `apps/api/src/modules/parents/parents.module.ts` va `apps/api/src/modules/parents/parents.service.ts` -- cung cap grant/reactivate va revoke noi bo trong transaction -- tao lifecycle dung lai cho Story 5.2/5.3 ma khong mo endpoint som.
- [x] `apps/api/src/app.module.ts` -- import `ParentsModule` -- dua service vao application composition.
- [x] `apps/api/src/modules/parents/parents.integration.test.ts` -- kiem thu PostgreSQL unique, grant/reactivate, revoke retained va quan he nhieu-chieu -- bao ve cac tinh huong trong matrix.

**Acceptance Criteria:**
- Given Prisma schema chua co Parent, when migration Story 5.1 duoc ap dung, then `Parent` luu identity/status can thiet va `StudentParent` luu lifecycle/revoke metadata voi FK den Parent va Student.
- Given cung mot Parent va Hoc sinh, when service grant hoac reactivate, then PostgreSQL enforce unique `(parentId, studentId)` va record `REVOKED` duy nhat duoc dung lai thanh `ACTIVE`.
- Given link `ACTIVE`, when service revoke voi Admin, then link chuyen sang `REVOKED` va luu thoi diem/Admin ma khong xoa Parent, Student hay link.
- Given PostgreSQL integration tests, when chay, then chung minh mot Parent co nhieu Hoc sinh active va mot Hoc sinh co nhieu Parent active.

## Spec Change Log

## Review Triage Log

## Design Notes

`ParentStatus` dung `ACTIVE`/`INACTIVE`; `ACTIVE` la default cua Parent duoc Admin grant, con `INACTIVE` cung cap trang thai ma Parent authorization cua story sau can kiem tra. `displayName` nullable vi chua co nguon du lieu truoc Google OAuth.

## Verification

**Commands:**
- `pnpm --filter api prisma:generate` -- expected: Prisma client generate thanh cong.
- `pnpm --filter api test:integration` -- expected: migrations va PostgreSQL integration tests, bao gom Parents, deu pass.
- `pnpm --filter api build` -- expected: Nest API typecheck/build thanh cong.

## Suggested Review Order

**Retained data model**

- Định nghĩa lifecycle và quan hệ retained được PostgreSQL thực thi.
  [`schema.prisma:52`](../../apps/api/prisma/schema.prisma#L52)

- Migration tạo enum, unique constraint và các restrictive foreign key.
  [`migration.sql:1`](../../apps/api/prisma/migrations/20260822000000_add_parents_and_student_parents/migration.sql#L1)

**Domain lifecycle**

- Module nội bộ export service mà không mở HTTP controller.
  [`parents.module.ts:1`](../../apps/api/src/modules/parents/parents.module.ts#L1)

- Grant/reactivate và revoke chạy trong serializable transactions.
  [`parents.service.ts:7`](../../apps/api/src/modules/parents/parents.service.ts#L7)

- Application composition đăng ký domain module mới.
  [`app.module.ts:15`](../../apps/api/src/app.module.ts#L15)

**Verification**

- Integration tests chứng minh lifecycle, unique, retained và many-to-many.
  [`parents.integration.test.ts:22`](../../apps/api/src/modules/parents/parents.integration.test.ts#L22)

- Existing test cleanup xóa retained relations trước Student.
  [`students.integration.test.ts:12`](../../apps/api/src/modules/students/students.integration.test.ts#L12)

- Timeout integration đủ cho các seed subprocess hợp lệ.
  [`vitest.integration.config.ts:3`](../../apps/api/vitest.integration.config.ts#L3)

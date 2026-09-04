# Báo cáo rà soát stack - PassionEdu

**Ngày rà soát:** 2026-09-04  
**Tài liệu được rà soát:** `ARCHITECTURE-SPINE.md`  
**Phạm vi:** Chỉ đánh giá các quyết định stack/kiến trúc được nêu tên trong spine ở mức `CRITICAL` hoặc `HIGH` khi chúng đã lỗi thời, không được hỗ trợ, hoặc mâu thuẫn với mã nguồn và manifest hiện hữu. Package manifest và lockfile là nguồn sự thật cho phiên bản. Không thực hiện duyệt web.

## Phán quyết

**KHÔNG THỂ ADOPT nguyên trạng.** Stack phiên bản cốt lõi trong spine là khả thi và đang được manifest/lockfile xác nhận, nhưng hai quyết định kiến trúc nền tảng của target PassionEdu mâu thuẫn trực tiếp với implementation/deployment hiện tại. Không thể xem codebase hiện tại là substrate tuân thủ spine mà không có một workstream clean-break/migration rõ ràng.

## Nguồn bằng chứng

- `package.json` và `pnpm-lock.yaml` tại root; manifest của `apps/api`, `apps/web`, `apps/parent-web`.
- `pnpm-workspace.yaml`, `turbo.json`, `compose.yaml` và Dockerfile các app.
- `apps/api/prisma/schema.prisma`, `apps/api/src/app.module.ts`, `apps/api/src/common/config/auth-config.ts`.

## Tính hợp lệ của stack

| Thành phần spine | Bằng chứng trong repository | Kết luận |
| --- | --- | --- |
| Node.js 22.x | Dockerfile API và hai web app dùng `node:22-alpine`; `@types/node` lock tại 22.20.1. | Phù hợp. |
| pnpm 11.9.0 | Root `package.json` pin `packageManager: pnpm@11.9.0`. | Phù hợp. |
| Turborepo 2.8.x | Manifest khai báo `^2.8.0`; lockfile giải quyết 2.10.10; `turbo.json` hiện diện. | Phù hợp trong cùng major. |
| TypeScript 5.9.x | Manifest khai báo `^5.9.3`; lockfile giải quyết 5.9.3. | Phù hợp. |
| React 19.2.x, Vite 8.2.x, TanStack React Query 5.90.x | Cả `web` và `parent-web` khai báo các dải tương ứng; lockfile giải quyết React 19.2.8, Vite 8.2.1, React Query 5.101.4. | Phù hợp. |
| NestJS 11.2.x, Prisma 7.9.x | API khai báo Nest 11.2.1 và Prisma 7.9.1; lockfile xác nhận. | Phù hợp. |
| PostgreSQL 16+ | `compose.yaml` sử dụng `postgres:16-alpine`; Prisma datasource là PostgreSQL. | Phù hợp. |
| Docker Compose trên VPS | `compose.yaml` có API, migration, PostgreSQL durable volume, `web` và `parent-web`. | Có nền tảng, nhưng không đủ cho mô hình ba portal theo AD-1/AD-10. |

Không có phát hiện `HIGH` hoặc `CRITICAL` nào về phiên bản Node.js, pnpm, Turborepo, TypeScript, React, Vite, TanStack React Query, NestJS, Prisma hoặc PostgreSQL được liệt kê trong spine.

## Phát hiện

### CRITICAL-1 - Quyết định ba portal độc lập không có implementation hay deployment tương ứng

**Quyết định mâu thuẫn:** AD-1, AD-4, AD-5, AD-10 và Structural Seed yêu cầu ba client độc lập `apps/web`, `apps/parent-web`, `apps/ops-web`, cùng các host/cookie/callback/session riêng cho Admin/Staff, Parent và Ops.

**Bằng chứng:**

- `pnpm-workspace.yaml` chỉ có workspace theo `apps/*`; danh sách package thực tế chỉ có `api`, `web`, `parent-web`. Không có thư mục hay manifest `apps/ops-web`.
- `compose.yaml` chỉ tạo service `web` và `parent-web`; không có service, Dockerfile, cổng, host route hoặc healthcheck cho Ops.
- `apps/api/src/common/config/auth-config.ts` chỉ mô hình hóa cấu hình Admin (`WEB_ORIGIN`, OAuth callback, `ADMIN_EMAILS`) và Parent (`PARENT_*`). Không có audience `ops`, `OPS_*` origin/callback/cookie hay `SUPERADMIN_EMAIL` như AD-5 quy định.
- API module hiện import các module Ánh Hoa đơn trường (`auth`, `classes`, `students`, `invoice-template`, `bank-accounts`, `invoices`, `reports`, `parents`, `parent-auth`, `parent-portal`); không có Ops control-plane module hay model grant tương ứng.

**Tác động:** Platform Operator không thể provision, suspend/reactivate School hoặc bootstrap owner qua một audience tách biệt. Việc áp dụng host-only cookie, callback allowlist và session audience `ops` theo AD-4 cũng không thể được chứng minh. Nếu triển khai spine trên nền hiện tại mà không tạo đủ portal và API boundary, quyền Ops sẽ hoặc không tồn tại, hoặc bị gộp sai vào Admin/Staff, vi phạm trực tiếp tenant/audience isolation.

**Yêu cầu xử lý trước khi adopt:** Xây `apps/ops-web` độc lập, endpoint/module control plane và toàn bộ cấu hình/deployment Ops; hoặc sửa spine để loại bỏ Ops portal và thay đổi rõ ràng các yêu cầu/giả định liên quan. Không được coi `apps/web` hiện tại là thay thế tương đương vì nó không có session audience hoặc quyền Platform Operator.

### CRITICAL-2 - Quyết định Prisma/PostgreSQL multi-school clean-break mâu thuẫn với schema và API đơn trường đang chạy

**Quyết định mâu thuẫn:** AD-2, AD-3, AD-6, AD-7, AD-8 và AD-9 yêu cầu multi-school target schema: `School` là tenant root, mọi bản ghi nghiệp vụ/unique constraint/Operation có `schoolId`, quyền dựa trên `UserIdentity` + `SchoolMembership` + `SchoolRoleGrant`, roster theo `SchoolYear`/enrollment hiệu lực thời gian và finance ledger theo `CollectionRun`, Receipt/Allocation/Prepayment/Reversal/Refund/DebtTransfer append-only.

**Bằng chứng:**

- `apps/api/prisma/schema.prisma` vẫn có `Admin` toàn cục; không có model `School`, `SchoolMembership`, `SchoolRoleGrant`, `SchoolYear`, `StudentEnrollment`, `UserIdentity`, `ParentProfile`, `CollectionRun`, ledger record hoặc bất kỳ trường `schoolId` nào.
- Các unique constraint hiện tại là đơn trường, ví dụ `Invoice @@unique([studentId, billingMonth])` và `Operation @@unique([adminId, route, id])`; chúng không thể đáp ứng scoped uniqueness và idempotency theo School + actor membership mà AD-3/AD-8 bắt buộc.
- `Class` mang `monthlyTuition` trực tiếp; `Student` chỉ có `classId` mutable; `InvoiceTemplate` dùng singleton global. Đây là mô hình invoice template/monthly invoice mà AD-9 yêu cầu loại bỏ, không phải target policy/roster/CollectionRun model.
- `apps/api/src/app.module.ts` đăng ký module `ClassesModule`, `StudentsModule`, `InvoiceTemplateModule`, `InvoicesModule` và không có các domain module target như `schools`, `memberships`, `authorization`, `roster`, `settings`, `finance` theo AD-2.
- `apps/api/src/common/config/auth-config.ts` cấp Admin bằng danh sách `ADMIN_EMAILS`, trái với access model membership/role grant per-request trong AD-3/AD-4; AD-5 yêu cầu `SUPERADMIN_EMAIL` chỉ bootstrap `PlatformOperatorGrant` nhưng cấu hình này không tồn tại.

**Tác động:** Không có lớp DB/API nào để thực thi tenant isolation. Mọi route, transaction, audit và idempotency hiện hữu đều thiếu school scope, do đó thêm route `/schools/:schoolId/` trên facade không khắc phục được cross-tenant access hoặc historical/ledger invariants. Finance hiện cũng không thể đáp ứng append-only payment ledger hay immutable issued obligation của target.

**Yêu cầu xử lý trước khi adopt:** Thực hiện clean-break target schema, migration và thay thế domain modules/API theo AD-9 trước khi xem spine là nền kiến trúc áp dụng được. Nếu có dữ liệu vận hành của schema hiện tại, dừng thay thế trực tiếp và mở workstream onboarding/migration riêng như chính AD-9 quy định. Không được chạy song song global Admin, global invoice template và resource không scoping như một target release.

## Ghi chú ngoài phạm vi phát hiện

- `compose.yaml` dùng PostgreSQL durable volume, nhưng chưa thể hiện TLS reverse proxy, định tuyến fixed host hoặc backup/restore drill. Đây là gap triển khai AD-10 đáng theo dõi, nhưng không được liệt kê là finding vì báo cáo này chỉ giữ các mâu thuẫn `HIGH`/`CRITICAL` đã có bằng chứng trực tiếp.
- `packages/contracts` và `packages/ui` chưa tồn tại. Đây là lệch Structural Seed, nhưng chưa tự nó chứng minh một quyết định stack không được hỗ trợ ở mức `HIGH`/`CRITICAL`.
- Các dải phiên bản trong manifest dùng dấu `^`; lockfile là bản cài đặt đã xác thực cho thời điểm rà soát. Khi cần reproducibility tuyệt đối ngoài lockfile, policy pinning là một quyết định riêng, không phải mâu thuẫn phiên bản hiện tại.

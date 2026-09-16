# Epic 1 Context: Vận hành nền tảng đa trường và truy cập có kiểm soát

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 1 tạo nền móng clean-break cho PassionEdu như một nền tảng đa trường: Platform Operator chỉ provision và quản trị vòng đời School qua Ops, còn Admin/Staff và Parent chỉ nhận session, School context và capability đã được API xác thực. Mọi đường truy cập phải chứng minh School là tenant root, không thể dùng UUID, route, filter, header hay trạng thái browser để vượt quyền. Đây là release gate bắt buộc: không phát hành nghiệp vụ School ở Epic sau cho đến khi tự động chứng minh được cô lập tenant, audience session và hiệu lực revoke/suspend.

## Stories

- Story 1.1: Khởi tạo nền tảng target đa portal
- Story 1.2: Đăng nhập Google và cô lập session theo audience
- Story 1.3: Provision và lifecycle School qua Ops
- Story 1.4: Membership, capability và School context an toàn
- Story 1.5: Tenant graph, mutation protection và audit provenance
- Story 1.6: Release gate về tenant isolation và audience access

## Requirements & Constraints

School là tenant root. Mọi aggregate, query, mutation, aggregate/report, unique constraint, audit record và Operation nghiệp vụ phải scope theo `schoolId`. Lệnh update/delete phải khớp cả ID tài nguyên và School trong cùng transaction; relation tenant-owned phải dùng composite `(schoolId, id)` khi cơ sở dữ liệu hỗ trợ, nếu không owning command phải xác minh toàn bộ graph trong transaction. Các ngoại lệ global chỉ là `UserIdentity`, `ParentProfile` và `PlatformOperatorGrant`; đường vào tenant của chúng luôn phải tường minh qua membership hoặc StudentParent. Không được suy ra authorization từ UUID không scope.

Google OAuth tạo hoặc bind `UserIdentity` canonical. Mỗi audience `app`, `teacher`, `parent`, `ops` có callback allowlist, origin allowlist, host-only cookie `Secure`, `httpOnly`, `SameSite=Lax` và session audience riêng; cookie không dùng `.passionedu.org` và session sai audience bị từ chối trước khi trả dữ liệu bảo vệ. Khi logout, expiry, `401` hoặc revoke, portal phải xóa protected memory/query state trước khi render tiếp. Parent không được service-worker cache API response đã xác thực, payment instruction, media hoặc evidence URL. Parent chỉ được issue session sau khi bind ParentProfile và kiểm tra lại atomic active `StudentParent`; một School active đi thẳng home, nhiều School chỉ được chọn trong tập School có link active, không có link thì từ chối session.

Platform Operator được bootstrap duy nhất từ `SUPERADMIN_EMAIL` qua `PlatformOperatorGrant`; grant này không bao hàm SchoolMembership hay quyền đọc dữ liệu nghiệp vụ. Provision phải atomically tạo hoặc tái dùng pending owner UserIdentity theo normalized email, pending SchoolMembership và `SCHOOL_ADMIN` grant; lỗi không để lại dữ liệu partial. School chỉ suspend/reactivate, không hard-delete; suspend chặn business request kế tiếp trong School đó nhưng không xóa global identity session hay context hợp lệ khác. Pending owner chỉ bind Google subject khi email verified khớp; subject mismatch hoặc email đã reassigned bị từ chối cho đến flow revoke/gán lại có audit.

Authorization staff phải resolve active `SchoolMembership`, `SchoolRoleGrant` và capability theo từng request. Preset role phát hành gồm `SCHOOL_ADMIN`, `FINANCE_MANAGER`, `CLASS_TEACHER`; menu/navigation chỉ hiển thị capability server grant. Quản lý membership/grant phải giới hạn trong selected School, lưu actor, reason khi cần và audit; Staff profile/assignment không tự tạo login, membership hoặc role. Revoke ở School A phải chặn request kế tiếp ở A, xóa client state A, nhưng không làm hỏng quyền hợp lệ ở School B.

Mọi cookie mutation bắt buộc origin validation và double-submit CSRF. Mutation high-impact dùng UUID `Idempotency-Key`; Operation lưu route, actor context, request fingerprint và outcome, replay request cùng fingerprint, từ chối key dùng lại với fingerprint khác. Operation School-scoped không conflict khi cùng key ở School khác. Provision là ngoại lệ trước khi School tồn tại: Operation scope theo PlatformOperatorGrant. Sau timeout, UI giữ Operation ID, gọi `GET /operations/:operationId` với đúng actor context để đối soát trước khi cho retry.

Workspace là pnpm/Turborepo Node 22, TypeScript, NestJS/Prisma/PostgreSQL và React/Vite. Dựng `apps/api`, Admin `apps/web`, Teacher `apps/teacher-web`, Parent `apps/parent-web`, Ops `apps/ops-web`, `packages/contracts`, `packages/ui`, `deploy/compose`. Prisma, schema, migration và resettable seed chỉ ở `apps/api/prisma`, chỉ theo target multi-school; không tái dùng schema/API/session/lifecycle legacy, compatibility layer, dual model hay `db push` production. Pilot Compose build source, proxy TLS tách host portal/API, PostgreSQL dùng durable volume, secrets ngoài Git, migration chạy trước API cần migration và không destructive rollback.

## Technical Decisions

API là nguồn chân lý duy nhất cho authorization, context resolution, state transition, idempotency, audit và Operation. `apps/api` là modular monolith: controller chỉ là HTTP adapter gọi owning service; service dùng Prisma hoặc narrow export, không gọi controller khác. Các module liên quan E1 gồm `identity`, `schools`, `memberships`, `authorization`, `parents`, `parent-auth` và `operations`. Portal chỉ gọi REST; chúng không import app khác hoặc API internals. `packages/contracts` chỉ chứa contract/validator thuần, formatter hoặc UI primitive stateless.

Staff route dùng `/schools/:schoolId/...`; resolver luôn xác thực membership/capability hiện hành trước scoped query. Parent route dùng `/api/parent/schools/:schoolId/...`; `ParentSchoolContext` xác thực parent audience, ParentProfile đã bind và active StudentParent trong School trước mọi query. Ops authorizes bằng audience `ops` cộng PlatformOperatorGrant, không có `OpsUser` model và không có destination dữ liệu nghiệp vụ School. REST JSON dùng camelCase; list trả `{ data, meta }`, action trả `{ data }`, lỗi trả `{ error: { code, message, fieldErrors? } }`; ID là UUID string và timestamp UTC ISO 8601.

Kiểm thử phải gồm unit cho transition, PostgreSQL integration cho tenant graph, read/write/delete/report cross-School, scoped uniqueness, revoke, audit/Operation provenance, transaction và idempotency; E2E cho OAuth callback, audience cookie/session, Parent active-link selection, chooser/switcher, suspend và safe fallback. Cross-School UUID, route, filter, header, join, aggregate và relation insert đều là negative case bắt buộc. E1 chưa hoàn tất nếu suite tenant isolation còn lỗi.

## UX & Interaction Patterns

Admin và Ops dùng shell desktop-first; Teacher và Parent mobile-first. Bốn portal không chuyển audience trong cùng shell. School name luôn hiển thị rõ trong heading/context switcher, route change đưa focus tới `h1`, navigation chỉ hiện capability server grant. Thiết kế dùng giao diện vận hành tỉnh táo, nhãn tiếng Việt ngắn, bảng cho danh sách quản trị, trạng thái luôn có text kèm màu và đáp ứng WCAG 2.1 AA.

School chooser/switcher chỉ cho phép chọn School đã authorize. Khi form dirty hoặc mutation đã submit nhưng outcome chưa chắc chắn, switch guard chỉ có ở lại, discard trước submit hoặc đối soát Operation; không auto-save, không silently switch và không retry trước reconciliation. Permission denied, revoke hoặc `401` phải đóng sheet/dialog, xóa state bảo vệ rồi đưa về chooser hoặc signed-out safe state. School suspended giữ identity session, thay nội dung bằng giải thích tạm ngưng và lựa chọn School hợp lệ khác.

Ops chỉ có School list, provision và suspend/reactivate. Provision và suspend/reactivate dùng dialog xác nhận nêu rõ tên School, trạng thái/tác động; timeout hiển thị trạng thái đang đối soát, vô hiệu thao tác trùng và refresh server-confirmed list. Ops tuyệt đối không mở dashboard hay dữ liệu nghiệp vụ của School. Form validation giữ input, error summary nhận focus và fieldErrors hiển thị cạnh field. Skeleton không được hiển thị stale content của School trước đó.

## Cross-Story Dependencies

Story 1.1 cung cấp workspace, deployment boundary và target schema cho toàn Epic. Story 1.2 thiết lập identity/audience và Parent callback contract mà Story 1.3-1.5 dùng để authorize actor. Story 1.3 tạo School, pending owner và lifecycle mà Story 1.4 quản lý context/membership trên đó. Story 1.5 chuẩn hóa tenant graph, CSRF, audit và Operation mà các mutation của 1.3-1.4 phải dùng. Story 1.6 xác minh toàn bộ các boundary này và là blocker cho Epic 2 trở đi; Epic 7 chỉ mở rộng Parent read model trên contract Parent session, active-link và School selection đã phát hành tại E1.

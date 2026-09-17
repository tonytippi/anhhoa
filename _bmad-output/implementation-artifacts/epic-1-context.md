# Epic 1 Context: Vận hành nền tảng đa trường và truy cập có kiểm soát

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Thiết lập control plane clean-break cho PassionEdu: Platform Operator provision, suspend và reactivate School mà không nhận quyền dữ liệu nghiệp vụ; Admin/Staff đăng nhập đúng audience, chọn School được cấp quyền và chỉ thực hiện capability hiện hành trong tenant đó. Epic này phải chứng minh tenant isolation, audience/session isolation, revoke/suspension và provenance bằng kiểm thử tự động trước khi bất kỳ nghiệp vụ School nào của Epic 2 trở đi được phát hành.

## Stories

- Story 1.1: Khởi tạo nền tảng target đa portal
- Story 1.2: Đăng nhập Google và cô lập session theo audience
- Story 1.3: Provision và lifecycle School qua Ops
- Story 1.4: Membership, capability và School context an toàn
- Story 1.5: Tenant graph, mutation protection và audit provenance
- Story 1.6: Release gate về tenant isolation và audience access

## Requirements & Constraints

- Đây là clean-break multi-school; không tái sử dụng schema, API, session, lifecycle, compatibility layer hoặc dữ liệu vận hành single-school. Seed/dev/test chỉ nhắm target model.
- `School` là tenant root. Mọi aggregate nghiệp vụ, query, write, unique constraint, audit và Operation phải scope theo School; URL, UUID, filter, header, local/browser state chỉ là selector, không phải bằng chứng authorization.
- Mỗi update/delete và tenant graph phải kiểm tra đồng thời record và `schoolId` trong cùng transaction. Dùng khóa/FK composite `(schoolId, id)` khi hỗ trợ; nếu không, owning command phải xác minh toàn bộ graph trong transaction. Cross-School insert/join là kiểm thử âm bắt buộc.
- `UserIdentity` là global canonical identity, không mang role hoặc `schoolId`. Active `SchoolMembership` và `SchoolRoleGrant`/capability được resolve lại server-side trên mọi request. Revoke tại School A phải chặn request kế tiếp tại A nhưng không làm hỏng context hợp lệ tại School B.
- Preset role đã phát hành là `SCHOOL_ADMIN`, `FINANCE_MANAGER`, `CLASS_TEACHER`; không tự tạo Staff login, membership hoặc role từ Staff profile/assignment. Capability attendance, handover và DailyJournal chưa là destination mutation của Admin trong Epic này.
- Provision chỉ dành cho actor có Ops audience và `PlatformOperatorGrant` được bootstrap từ `SUPERADMIN_EMAIL`; grant này không suy ra School membership hay quyền đọc/ghi dữ liệu School. Provision phải atomically tạo/tái sử dụng pending owner `UserIdentity`, pending `SchoolMembership` và `SCHOOL_ADMIN` grant theo normalized email; lỗi không để lại partial record. School không hard-delete; suspend chặn business request kế tiếp nhưng không xóa global identity session hay context khác.
- Google OAuth chỉ issue session cho audience khởi tạo flow. Callback/origin phải thuộc allowlist riêng; cookie là host-only, `Secure`, `httpOnly`, `SameSite=Lax`, không dùng `.passionedu.org`. Session dùng sai audience phải bị từ chối trước khi có protected data. Logout, expiry, `401` và revoke phải xóa protected client memory/query state trước safe fallback. Parent service worker không cache authenticated response, payment instruction, media hoặc evidence URL.
- Cookie-auth mutation cần origin validation và double-submit CSRF. High-impact mutation dùng UUID `Idempotency-Key`, transaction, request fingerprint và Operation; retry cùng actor context/cùng fingerprint replay kết quả, fingerprint khác conflict. Client phải `GET /operations/:operationId` reconcile trước retry sau timeout. Provision là ngoại lệ duy nhất: Operation scope theo `PlatformOperatorGrant` trước khi School tồn tại.
- Audit lưu School khi có, actor identity/reference, actor membership khi có, timestamp, provenance và reason khi bắt buộc. Operation read chỉ authorize đúng actor context đã tạo Operation.
- E1 release gate chỉ kiểm chứng facts/routes do E1 sở hữu: ít nhất hai School, nhiều SchoolMembership, audience Admin/Teacher/Parent/Ops, tenant graph, scoped uniqueness, audit/Operation provenance, origin/CSRF, idempotency, membership revoke, School suspension và portal safe state. Parent chưa có `StudentParent` trong E1 phải fail-closed: không issue Parent session, không lộ protected DTO/cache. Proof active Parent-link, multi-School chooser và revoke chuyển sang Story 2.3 sau khi domain tồn tại.
- Kiểm thử tenant/audience E1 phải là task release/CI thực thi được và fail CI khi hỏng. E1 không hoàn thành nếu tenant-isolation suite còn lỗi; đây là blocker cho các Epic sau.
- API là nguồn chân lý cho authorization, state transition, audit và Operation. REST dùng JSON camelCase; list trả `{ data, meta }`, action trả `{ data }`, lỗi trả `{ error: { code, message, fieldErrors? } }`; ID là UUID string, timestamp UTC ISO 8601.

## Technical Decisions

- Workspace pnpm/Turborepo dùng Node 22, TypeScript, React/Vite, NestJS, Prisma và PostgreSQL. Cấu trúc target gồm `apps/api`, `apps/web` (Admin), `apps/teacher-web`, `apps/parent-web`, `apps/ops-web`, `packages/contracts`, `packages/ui` và `deploy/compose`.
- Bốn portal build/deploy độc lập, chỉ gọi REST và chỉ share pure contracts, formatter hoặc stateless UI primitives từ `packages`; không app nào import app khác hay API internals. `teacher-web` là PWA riêng tại `teacher.passionedu.org`.
- API là modular monolith. Prisma, migrations và schema chỉ ở `apps/api/prisma`; controllers chỉ là HTTP adapters gọi owning service. Các module E1 chính là `identity`, `schools`, `memberships`, `authorization` và `operations`; service chỉ dùng Prisma hoặc narrow exported service/query contract, không gọi controller khác.
- Staff operational route dùng `/schools/:schoolId/...`; resolver trước query phải resolve active membership, role grant/capability và trạng thái School. Không resolver nào authorize từ resource UUID không scoped.
- Fixed hosts là `app.passionedu.org`, `teacher.passionedu.org`, `parent.passionedu.org`, `ops.passionedu.org`, `api.passionedu.org`, với callback allowlist, origin allowlist và cookie/session audience riêng.
- Pilot deployment dùng Docker Compose trên một VPS, build image từ source; TLS reverse proxy route từng host tới container tương ứng, PostgreSQL có durable volume, secret ngoài Git. Migration chạy trước API cần migration; cấm destructive rollback và không dùng `db push` cho production.
- Unit test bao phủ transition/policy nhỏ; PostgreSQL integration test bao phủ tenant isolation, composite/scoped uniqueness, revoke, transaction, idempotency và cross-School graph; portal E2E bao phủ audience/session isolation, chooser/switcher, safe fallback và reconciliation.

## UX & Interaction Patterns

- Admin và Ops là desktop-first responsive PWA; Teacher và Parent là mobile-first PWA. Bốn shell không switch audience trong cùng một UI. Admin/Ops dùng sidebar từ `>= 1024px`; route change đưa focus tới `h1`, có skip link, named navigation và `aria-current`.
- Ops chỉ có School list, provision, suspend/reactivate và trạng thái bootstrap owner; không có destination dữ liệu nghiệp vụ School. Provision/suspend/reactivate dialog phải nêu tên School, current/next-request effect, require named confirmation và chỉ hiển thị server-confirmed result.
- School chooser/switcher luôn hiển thị tên School. Khi form dirty hoặc mutation đang pending/không chắc chắn, switch guard chỉ cho phép ở lại, discard trước submit hoặc reconcile Operation; không auto-save, không đổi School silently và không retry trước reconciliation.
- Navigation Admin/Staff chỉ hiện capability do server grant. Heading operational luôn hiển thị selected School. Khi revoke/permission denied/`401`, xóa protected state, đóng sheet/dialog rồi về chooser hoặc signed-out safe state; khi School suspended, giữ identity session nhưng thay nội dung School bằng giải thích và chooser context khác nếu có.
- Cold load dùng skeleton đúng layout và không hiển thị stale content từ School khác. Timeout vô hiệu hóa submit lặp, thông báo đang kiểm tra kết quả với hệ thống, rồi reconcile Operation trước khi cho retry. Form validation giữ input, focus error summary và hiển thị `fieldErrors` cạnh field.
- Dùng token calm green/canvas/surface, Be Vietnam Pro cho heading và Inter cho body; WCAG 2.1 AA, status luôn có text label, focus ring rõ ràng. Management list là table-first với caption, keyboard row action, pagination và responsive scroll/card; dùng nhãn tiếng Việt ngắn gọn.

## Cross-Story Dependencies

- Story 1.1 tạo workspace, portal boundary, Prisma target schema và Compose foundation mà các story 1.2-1.6 dựa vào.
- Story 1.2 thiết lập UserIdentity, audience/session và client protected-state contract; Story 1.3 dùng Ops audience/PlatformOperatorGrant, còn Story 1.4-1.6 dùng cơ chế audience đó để enforce và kiểm chứng access boundary.
- Story 1.3 tạo School lifecycle/control-plane; Story 1.4 tạo School membership/capability context; Story 1.5 áp dụng tenant graph, CSRF, idempotency, audit và Operation cross-cutting cho các mutation; Story 1.6 chứng minh toàn bộ E1 contract bằng release gate.
- Epic 2 và mọi Epic sau bị chặn bởi E1 tenant-isolation gate. Story 2.3 mới sở hữu Student, ParentProfile và StudentParent nên phải bổ sung integration/E2E proof cho Parent active-link, cross-School chooser và revoke; E1 chỉ giữ Parent fail-closed contract.

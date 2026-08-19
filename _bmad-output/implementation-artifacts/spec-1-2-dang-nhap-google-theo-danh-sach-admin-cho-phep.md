---
title: 'Story 1.2: Đăng nhập Google theo danh sách Admin cho phép'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: '0fc9a1e66688348e505a78bf89ea3479aa83e1cc'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** API hiện chỉ là scaffold, chưa có cơ chế nhận diện Admin qua Google, kiểm soát email được phép, phiên cookie hay lớp phòng vệ cho các route vận hành. Vì vậy chưa thể bảo đảm chỉ nhân sự được cho phép mới tạo được danh tính dùng cho audit và gọi API nội bộ.

**Approach:** Hoàn thiện auth/admin foundation tại API: cấu hình fail-fast, OAuth Google có allowlist, lưu Admin, JWT cookie session, `/auth/me`, bảo vệ mặc định, CORS/CSRF/origin validation và REST error contract. Story này không bootstrap giao diện hay route gate web; các hành vi đó thuộc Story 1.3.

## Boundaries & Constraints

**Always:** Giữ API là chủ sở hữu OAuth, session, Prisma và quyết định allowlist; chuẩn hóa email trước khi so sánh với `ADMIN_EMAILS`; chỉ phát JWT trong cookie `Secure`, `httpOnly`, `SameSite=Lax`; web không nhận token trong JSON. Validate đầy đủ environment tại bootstrap, credentialed CORS chỉ echo đúng `WEB_ORIGIN`, và OAuth callback/redirect chỉ chấp nhận URL có trong allowlist cấu hình. Mọi unsafe request có cookie phải vượt qua exact-origin validation và double-submit CSRF; lỗi API dùng `{ error: { code, message, fieldErrors? } }`. Prisma model/migration chỉ nằm trong `apps/api/prisma`, ID Admin là UUID, timestamp UTC và migration phải được commit. Controller chỉ điều phối service; service không gọi controller domain khác.

**Ask First:** Dừng hỏi trước khi thay đổi architecture spine, thay OAuth provider, làm session token đọc được bởi JavaScript, nới lỏng thuộc tính cookie production, thêm role ngoài Admin, hoặc đưa UI bootstrap/route guard/màn đăng nhập vào Story 1.2.

**Never:** Không commit secret hay giá trị environment thật; không trả `ADMIN_EMAILS`, JWT, OAuth client secret hoặc dữ liệu vận hành trong response/lỗi; không tạo session cho email bị từ chối; không dùng wildcard CORS với credentials; không chỉ dựa vào validation client; không thêm API domain của Lớp, Học sinh hay Hóa đơn.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Bootstrap | Thiếu, rỗng hoặc sai format environment auth/CORS/OAuth/JWT | API không bind port cho đến khi tất cả cấu hình hợp lệ | Lỗi cấu hình rõ, không in giá trị secret |
| OAuth được phép | Google trả email khác hoa-thường nhưng sau chuẩn hóa thuộc `ADMIN_EMAILS` | Upsert Admin với email, tên, ảnh mới nhất; callback phát session cookie rồi redirect URL allowlisted | Không trả JWT trong body hay URL |
| OAuth bị từ chối | Email Google vắng mặt hoặc không thuộc allowlist | Không tạo/cập nhật Admin và không phát session; redirect về trạng thái từ chối an toàn | Thông báo không tiết lộ allowlist |
| Phiên hiện tại | `GET /auth/me` có JWT cookie hợp lệ | Trả `{ data: admin }` với profile an toàn cho client | Cookie thiếu/sai/hết hạn trả JSON unauthenticated chuẩn |
| Unsafe credentialed request | `POST`/`PUT`/`PATCH`/`DELETE` thiếu origin hợp lệ, CSRF cookie hoặc header khớp | Request không tới controller nghiệp vụ | JSON error shape chuẩn, không thay đổi state |

</frozen-after-approval>

## Code Map

- `apps/api/src/main.ts:4-26` -- hiện chỉ parse `PORT` và tạo Nest app; mở rộng bootstrap validation, CORS, cookie parser, global validation/error handling và middleware CSRF/origin.
- `apps/api/src/app.module.ts:1-4` -- root module scaffold cần import config/Prisma và các module `auth`, `admins`; dùng guard mặc định cho operational controllers và đánh dấu rõ route OAuth/public.
- `apps/api/package.json:6-30` -- scripts Vitest hiện hữu, nhưng chưa có Passport Google, JWT, validation, cookie parsing hoặc dependency type cần cho Story 1.2.
- `apps/api/prisma/schema.prisma:1-7` và `apps/api/prisma.config.ts:4-10` -- thêm model `Admin` với email chuẩn hóa unique và migration commit, giữ datasource/migration ownership tại API.
- `apps/api/.env.example:1-4` -- chỉ có database/port; thêm tên biến placeholder cho Google OAuth, JWT, `ADMIN_EMAILS`, `WEB_ORIGIN`, allowlisted redirects và CSRF, không có giá trị thật.
- `apps/api/src/main.test.ts:16-59`, `apps/api/src/app.module.test.ts:1-8`, `apps/api/vitest.config.ts:1-3` -- baseline test API hiện chỉ kiểm tra port/module; mở rộng coverage auth/security theo conventions Vitest đang dùng, không đổi framework chỉ để khớp tài liệu cũ.
- `_bmad-output/implementation-artifacts/epic-1-context.md:15-32` -- constraints Epic 1 đã tổng hợp cho auth, REST, cookie và verification.
- `_bmad-output/planning-artifacts/architecture/architecture-anhhoa-2026-08-18/ARCHITECTURE-SPINE.md:59-75,107-120` -- nguồn bất biến về module direction, session cookie, REST error, config/bootstrap và test boundary.
- `apps/web/src/app/app.tsx:10-25` và `apps/web/src/components/sidebar.tsx:5-10` -- hiện shell/identity placeholder công khai; chỉ là evidence read-only cho Story 1.3, không sửa trong Story 1.2.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/package.json`, `pnpm-lock.yaml`, `apps/api/src/common/config/*`, `apps/api/src/main.ts` -- thêm dependency và config typed/fail-fast, thiết lập exact-origin credentialed CORS, cookie parsing, global DTO validation và error filter -- tạo bootstrap security contract có thể kiểm thử.
- [x] `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*` -- thêm Admin UUID với email normalized unique, Google profile audit fields và timestamps; tạo migration PostgreSQL được commit -- bảo toàn ownership persistence và nhận diện audit.
- [x] `apps/api/src/common/prisma/*`, `apps/api/src/modules/admins/*` -- cung cấp Prisma lifecycle và service upsert Admin chỉ nhận profile Google đã chuẩn hóa/được phép -- cô lập persistence khỏi OAuth controller.
- [x] `apps/api/src/modules/auth/*`, `apps/api/src/common/guards/*`, `apps/api/src/app.module.ts` -- triển khai Google callback, JWT cookie session, `/auth/me`, endpoint/token CSRF cần thiết, auth guard mặc định và public-route metadata -- chỉ Admin đã xác thực mới đi qua operational boundary.
- [x] `apps/api/.env.example`, `README.md` -- tài liệu hóa tất cả environment bắt buộc, callback/redirect allowlist, local setup không secret và cách chạy migration/test -- cấu hình được vận hành mà không commit credential.
- [x] `apps/api/src/**/*.test.ts` -- kiểm tra config invalid, normalizing/allow-deny, upsert refresh, cookie flags, `/auth/me`, CORS, origin/CSRF, guard và error shape -- khóa các edge case ma trận mà không gọi Google thật.

**Acceptance Criteria:**
- Given API được khởi động với cấu hình hợp lệ, when khởi tạo HTTP, then CORS credentialed chỉ chấp nhận chính xác `WEB_ORIGIN`, redirect OAuth bị giới hạn bởi allowlist và route vận hành mặc định cần session hợp lệ.
- Given Google xác thực email cho phép, when callback hoàn tất, then API upsert identity Admin và phát session JWT chỉ qua cookie `Secure`, `httpOnly`, `SameSite=Lax`; `GET /auth/me` trả profile an toàn theo `{ data }`.
- Given email không được phép hoặc OAuth profile thiếu email, when callback xử lý, then không có Admin/session hợp lệ được tạo và response/redirect không tiết lộ danh sách email cho phép.
- Given request mutation credentialed, when origin hoặc cặp double-submit CSRF không hợp lệ, then API từ chối trước handler với JSON `{ error: { code, message, fieldErrors? } }`; DTO mutation hợp lệ được validate server-side.
- Given migration được áp dụng, when truy vấn Admin, then email normalized là unique và profile Google cập nhật sau lần đăng nhập được phép tiếp theo.

## Design Notes

Cookie session vẫn là cookie an toàn, còn CSRF là cookie/token riêng có thể được client gửi lại qua header. Đặt route OAuth và endpoint cấp CSRF vào explicit public-route allowlist; guard global bảo vệ phần còn lại để module domain thêm ở các story sau không vô tình mở public.

## Verification

**Commands:**
- `pnpm --filter api prisma:generate` -- expected: Prisma Client sinh từ schema Admin thành công.
- `pnpm --filter api test` -- expected: test config, auth, guard, CORS, CSRF và error contract pass không cần OAuth credential thật.
- `pnpm lint && pnpm typecheck && pnpm build` -- expected: toàn workspace strict typecheck, lint và build pass.

**Manual checks (if no CLI):**
- Với Google test client và môi trường cục bộ hợp lệ, đăng nhập bằng email trong allowlist rồi kiểm tra cookie không đọc được trong JavaScript và `/auth/me` trả profile; thử email ngoài allowlist, origin sai và CSRF header sai để xác nhận đều không có session/state được tạo.

## Suggested Review Order

**Bootstrap And Configuration**

- Nạp và validate toàn bộ boundary auth trước khi Nest bind port.
  [`main.ts:11`](../../apps/api/src/main.ts#L11)

- Ràng buộc origin, redirect, cookie và JWT tại một cấu hình typed.
  [`auth-config.ts:57`](../../apps/api/src/common/config/auth-config.ts#L57)

**OAuth And Session Boundary**

- State ký, giới hạn thời gian và cookie-bound ngăn login CSRF.
  [`google-auth.guard.ts:16`](../../apps/api/src/modules/auth/google-auth.guard.ts#L16)

- Callback chỉ phát session sau profile được ủy quyền và state hợp lệ.
  [`auth.controller.ts:32`](../../apps/api/src/modules/auth/auth.controller.ts#L32)

- Chấp nhận duy nhất Google email đã xác minh và có trong allowlist.
  [`google.strategy.ts:16`](../../apps/api/src/modules/auth/google.strategy.ts#L16)

**Identity And Request Protection**

- Reconcile identity bằng Google subject bất biến, không chiếm email audit.
  [`admins.service.ts:16`](../../apps/api/src/modules/admins/admins.service.ts#L16)

- Guard toàn cục kiểm tra JWT, record Admin và allowlist hiện thời.
  [`session-auth.guard.ts:14`](../../apps/api/src/common/guards/session-auth.guard.ts#L14)

- Schema và migration giữ Admin identity trong API-owned persistence.
  [`schema.prisma:9`](../../apps/api/prisma/schema.prisma#L9)

**Tests And Operation**

- Test module auth bao phủ state, cookie, callback và response profile.
  [`auth.controller.test.ts:1`](../../apps/api/src/modules/auth/auth.controller.test.ts#L1)

- Environment mẫu và tài liệu vận hành không chứa secret.
  [`.env.example:1`](../../apps/api/.env.example#L1)

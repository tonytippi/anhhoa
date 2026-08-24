---
title: 'Triển khai Parent PWA qua Docker Compose'
type: 'feature'
created: '2026-08-24'
status: 'done'
baseline_commit: '198abeb80b5dac5ce744ae98a2881947565b3d30'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-anhhoa-parent-pwa-2026-08-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Compose production hiện chỉ build và public Admin PWA. `apps/parent-web` có Vite proxy cho local development nhưng không có Docker image/Nginx gateway, nên Parent PWA chưa thể được triển khai với một public origin riêng và không thể chuyển tiếp các request `/api` tới API giống Admin.

**Approach:** Thêm service Parent PWA độc lập vào Compose, phục vụ bundle qua Nginx trên loopback port cấu hình riêng. Gateway Parent nhận browser request relative `/api`, bỏ prefix khi proxy nội bộ đến `api:3000`, và rewrite OAuth state-cookie path để callback Parent tiếp tục có state cookie.

## Boundaries & Constraints

**Always:** Giữ `apps/parent-web` tách biệt với Admin app; browser Parent chỉ dùng `VITE_API_URL=/api`; API và PostgreSQL không được map ra host; proxy phải forward `/api/parent/...` thành `/parent/...` tới `api:3000`; Parent dùng `PARENT_WEB_ORIGIN`, callback/redirect allowlist và cookie names cấu hình riêng; OAuth state cookie path `/parent/auth/google` phải được rewrite public thành `/api/parent/auth/google`; các session/CSRF cookie Parent hiện có Path `/` không được đổi. Compose test database không thay đổi. Không ghi secret vào image hay file mẫu.

**Ask First:** Dừng nếu Parent phải chia sẻ Admin public origin/path, nếu infrastructure ngoài Compose đã proxy `/api` theo quy tắc khác, hoặc nếu cần công khai API/Database thay vì dùng gateway Parent.

**Never:** Không thêm prefix global `/api` vào Nest; không cho Parent gọi API host/public trực tiếp; không dùng Admin Nginx config/Docker artifact như một shared runtime; không thay auth, CSRF, cookie isolation, OAuth authorization hoặc Parent REST contract; không thêm Tunnel, TLS termination, database backup hay monitoring container.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Parent REST | Browser Parent gọi `/api/parent/me` | Nginx Parent strip `/api` và API nhận `/parent/me` qua Docker network | API vẫn không public host port; status/error envelope được chuyển nguyên trạng |
| Parent OAuth callback | Google callback public `/api/parent/auth/google/callback` và response state cookie từ API có Path `/parent/auth/google` | Gateway rewrite path cookie thành `/api/parent/auth/google`; browser gửi state cookie trong callback | State hợp lệ đi tới Nest `/parent/auth/google/callback`, không rơi vào SPA fallback |
| Browser route | Parent mở deep link không phải `/api` | Nginx trả `index.html` để React router xử lý | Không áp dụng SPA fallback cho `/api` khi upstream lỗi |
| Thiếu config Parent | `.env.production` thiếu origin, OAuth hoặc cookie Parent bắt buộc | `docker compose config`/API fail fast thay vì chạy cấu hình không an toàn | File mẫu liệt kê toàn bộ biến không-secret cần điền |

</frozen-after-approval>

## Code Map

- `compose.yaml:31-77` -- topology production Admin hiện có: API chỉ internal, `web` build `/api`, map loopback và đợi API healthy; dùng làm khuôn cho `parent-web`, không sửa `docker-compose.test.yml`.
- `apps/web/Dockerfile:1-20` và `apps/web/nginx.conf:1-29` -- mẫu build Vite/Nginx, SPA fallback, strip `/api` bằng `proxy_pass .../`, forwarded headers và cookie-path rewrite Admin.
- `apps/parent-web/vite.config.ts:5-8` -- local Parent đã proxy `/api` tới API và strip prefix; bổ sung cookie path rewrite để local OAuth có cùng contract production.
- `apps/parent-web/src/api.ts:1-68` -- Parent REST client mặc định base `/api`; giữ nguyên client API khi đóng gói Docker.
- `apps/api/src/common/config/auth-config.ts:67-149` -- API bắt buộc cấu hình `PARENT_WEB_ORIGIN`, Parent OAuth URLs và distinct session cookie; `PARENT_CSRF_COOKIE_NAME` có default `parent_csrf_token`.
- `apps/api/src/modules/parent-auth/parent-google.guard.ts` -- xác nhận state cookie Parent scope `/parent/auth/google`, là lý do phải rewrite ở gateway.
- `.env.production.example:1-26` -- mẫu vận hành hiện chỉ liệt kê Admin web/OAuth variables; cần mô tả cổng và cấu hình Parent không-secret.
- `README.md:44-58` -- tài liệu deployment hiện giả định một Admin gateway/origin; mở rộng chính xác cho hai PWA và hai Google callback.
- `apps/web/vite.config.test.ts:1-13` -- mẫu contract test proxy/cookie rewrite; Parent cần test tương đương riêng.

## Tasks & Acceptance

**Execution:**
- [x] `apps/parent-web/Dockerfile` -- tạo image multi-stage Node 22/Nginx build isolated Parent workspace với `VITE_API_URL=/api`, copy bundle Parent và config Nginx -- cung cấp artifact deployable không phụ thuộc Admin app.
- [x] `apps/parent-web/nginx.conf` -- thêm Nginx Parent với SPA fallback; proxy exact `/api` và `/api/` đến `api:3000` có trailing slash, forwarded headers, và `proxy_cookie_path /parent/auth/google /api/parent/auth/google` -- giữ REST/OAuth same-origin contract.
- [x] `apps/parent-web/vite.config.ts` và `apps/parent-web/vite.config.test.ts` -- bổ sung/assert Parent OAuth cookie path rewrite trong Vite local, đồng thời giữ rewrite prefix chính xác -- tránh local/prod khác biệt và regression callback.
- [x] `compose.yaml` -- thêm `parent-web` build args, loopback `PARENT_WEB_PORT` (mặc định riêng), API-health dependency, restart và Nginx healthcheck; truyền tất cả biến `PARENT_*` cần thiết cho API environment -- triển khai Parent gateway mà không expose upstream services.
- [x] `.env.production.example` -- thêm `PARENT_WEB_PORT`, Parent origin, callback, redirect allowlist/denied URL, session và CSRF cookie names với comment/callback example không-secret -- giúp Compose fail-fast có cấu hình đầy đủ.
- [x] `README.md` -- tài liệu hóa Parent port/gateway, public HTTPS origin, callback `/api/parent/auth/google/callback`, cấu hình cloud tunnel riêng và lệnh kiểm tra -- hỗ trợ vận hành đúng hai app độc lập.

**Acceptance Criteria:**
- Given `.env.production` có Admin và Parent configuration hợp lệ, when chạy `docker compose --env-file .env.production up --build -d`, then `parent-web` healthy sau API và phục vụ PWA qua cổng loopback Parent, trong khi API/PostgreSQL không có host port.
- Given browser ở Parent origin gọi `/api/parent/invoices`, when gateway forward request, then Nest nhận `/parent/invoices` qua service `api:3000` và response được trả lại không đổi HTTP status/body.
- Given Parent Google OAuth bắt đầu từ public Parent origin, when callback quay về `/api/parent/auth/google/callback`, then state cookie path public khớp callback và API xử lý callback thay vì Nginx trả SPA HTML.
- Given local Parent Vite proxy và Docker Nginx proxy, when xử lý Parent OAuth cookie, then cả hai rewrite `/parent/auth/google` thành `/api/parent/auth/google`.

## Design Notes

`proxy_pass http://api:3000/` trong `location /api/` là intentional: trailing slash thay thế phần location bằng `/`, nên upstream nhận `/parent/...` thay vì `/api/parent/...`. Hai PWA có gateway, service worker và port riêng; chỉ cùng dùng internal API service.

## Verification

**Commands:**
- `pnpm --filter parent-web test` -- expected: Parent UI và proxy config contract tests pass.
- `pnpm --filter parent-web typecheck` -- expected: Vite config Parent type-check pass.
- `pnpm --filter parent-web build` -- expected: Parent production PWA build pass.
- `docker compose --env-file .env.production config` -- expected: Compose resolves Parent service and all required variables without exposing API/Database ports.
- `docker compose --env-file .env.production up --build -d` -- expected: migration, API, Admin web và Parent web become healthy in dependency order.
- `curl -i http://127.0.0.1:${PARENT_WEB_PORT:-8081}/api/parent/auth/csrf` -- expected: Parent gateway returns API CSRF response, not SPA document.

## Suggested Review Order

**Compose Gateway**

- Parent gateway chỉ public loopback và đợi API healthy.
  [`compose.yaml:85`](../../compose.yaml#L85)

- API nhận đầy đủ cấu hình origin/OAuth/cookie Parent riêng.
  [`compose.yaml:46`](../../compose.yaml#L46)

**Request Routing**

- Nginx strip `/api`, giữ SPA fallback và rewrite OAuth state cookie.
  [`nginx.conf:1`](../../apps/parent-web/nginx.conf#L1)

- Image Parent build bundle độc lập rồi phục vụ qua Nginx.
  [`Dockerfile:1`](../../apps/parent-web/Dockerfile#L1)

- Vite local dùng cùng rewrite prefix và cookie OAuth.
  [`vite.config.ts:5`](../../apps/parent-web/vite.config.ts#L5)

**Operational Contract**

- Mẫu production liệt kê cổng và config Parent không-secret.
  [`.env.production.example:27`](../../.env.production.example#L27)

- Hướng dẫn vận hành hai origin, tunnel và callback Google.
  [`README.md:44`](../../README.md#L44)

**Regression Coverage**

- Test proxy local khóa rewrite cookie và loại trừ exact `/api` khỏi SPA fallback.
  [`vite.config.test.ts:1`](../../apps/parent-web/vite.config.test.ts#L1)

- Test deployment kiểm tra topology Compose và Nginx Parent.
  [`deployment-config.test.ts:1`](../../apps/parent-web/deployment-config.test.ts#L1)

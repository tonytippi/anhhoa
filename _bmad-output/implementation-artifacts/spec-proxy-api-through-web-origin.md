---
title: 'Proxy API qua web origin cho OAuth và API client'
type: 'bugfix'
created: '2026-08-20'
status: 'done'
baseline_commit: 'dc0d506a093f0a52f1a25e7a4505240ff12cae72'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Khi development, web gọi API trực tiếp ở `localhost:3000`, nhưng callback OAuth được mong muốn đi qua `/api` của web origin. Vite hiện không proxy `/api`, nên callback `localhost:5173/api/auth/google/callback` trả 404 thay vì đến Nest route `/auth/google/callback`.

**Approach:** Đặt `/api` là public API base path duy nhất của browser. Vite development proxy `/api` tới API cục bộ và bỏ prefix trước khi forward, đồng nhất với Nginx production hiện có. Cập nhật mẫu cấu hình và tài liệu OAuth để callback Google luôn dùng web origin `/api/auth/google/callback`, không public API port trực tiếp.

## Boundaries & Constraints

**Always:** Browser chỉ gọi URL relative `/api`; proxy phải bỏ chính xác prefix `/api` để Nest giữ các route không prefix như `/auth/google/callback`; giữ API port `3000` nội bộ cho Vite proxy và Docker network; giữ `VITE_API_URL=/api` trong Compose production; OAuth callback phải được đăng ký chính xác với Google Console.

**Ask First:** Dừng và hỏi nếu proxy cần hỗ trợ API backend khác `localhost:3000` mà không thể biểu đạt bằng biến development rõ ràng, hoặc nếu hạ tầng production ngoài Compose đã định tuyến `/api` khác Nginx hiện hữu.

**Never:** Không thêm global prefix `/api` vào Nest; không expose port API qua Compose; không đưa giá trị OAuth thật vào `.env.example`; không thay cookie/CSRF auth contract.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Local login | Web ở `http://localhost:5173`, callback Google là `/api/auth/google/callback` | Vite forward thành API `http://localhost:3000/auth/google/callback`; Nest Google guard xử lý callback | Nếu API không chạy, browser báo network/proxy error, không trả SPA 404 |
| API browser request | Client gọi `apiUrl('/auth/me')` không có `VITE_API_URL` | URL là `/api/auth/me`, dùng cùng web origin | Không tạo URL trực tiếp `localhost:3000` |
| Production deployment | Nginx nhận `/api/auth/...` | Nginx tiếp tục strip `/api` rồi forward cho service `api:3000` nội bộ | API và PostgreSQL vẫn không map port host |

</frozen-after-approval>

## Code Map

- `apps/web/vite.config.ts:1-16` -- Vite development config chưa có `server.proxy`; thêm proxy `/api` đến `http://localhost:3000` với rewrite bỏ prefix.
- `apps/web/src/app/api/client.ts:15-20` -- API client mặc định hiện là absolute `http://localhost:3000`; đổi default thành `/api` để login link, CSRF và fetch dùng web origin.
- `apps/web/src/app/api/client.test.ts` -- mở rộng assertion URL mặc định để chặn quay lại direct API origin.
- `apps/api/.env.example:5-15` -- ví dụ local callback hiện trỏ thẳng API; đổi thành `http://localhost:5173/api/auth/google/callback` và giải thích Vite proxy.
- `apps/web/nginx.conf:8-22` -- evidence production proxy đã strip `/api`; không thay đổi nếu contract hiện hữu đủ.
- `compose.yaml:60-77` -- evidence web production build đã inject `VITE_API_URL=/api` và chỉ Nginx map ra host; không expose service API.
- `README.md:12-24,42-58` -- hướng dẫn local và OAuth cần mô tả public callback qua web `/api`, phân biệt API upstream nội bộ.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/vite.config.ts` -- thêm Vite `server.proxy` cho `/api` tới port API local và rewrite prefix -- cho OAuth callback/API browser request đi qua web development server.
- [x] `apps/web/src/app/api/client.ts` và `apps/web/src/app/api/client.test.ts` -- đặt default browser API base là `/api`, kiểm chứng URL tương đối -- đảm bảo mọi consumer gồm login dùng proxy khi không có override.
- [x] `apps/api/.env.example` và `README.md` -- cập nhật callback local, hướng dẫn Google Console và mô hình upstream internal -- ngăn cấu hình callback direct API gây 404 hoặc expose sai.
- [x] `apps/web/vite.config.ts` test hoặc kiểm chứng cấu hình phù hợp -- xác nhận rewrite `/api/auth/google/callback` thành `/auth/google/callback` -- bắt regression prefix forwarding.

**Acceptance Criteria:**
- Given `pnpm dev` đang chạy với web và API cục bộ, when browser mở `/api/auth/google/callback?code=...`, then Vite forward request đến Nest route `/auth/google/callback` thay vì trả Vite/SPA 404.
- Given không khai báo `VITE_API_URL`, when web tạo login link hoặc gọi API, then URL bắt đầu bằng `/api/` và không chứa `localhost:3000`.
- Given Compose production build, when web gửi `/api/auth/me`, then Nginx forward request đến `api:3000/auth/me` và service API không có host port mapping.
- Given cấu hình Google OAuth local, when đăng ký redirect URI, then URI chính xác là `http://localhost:5173/api/auth/google/callback`.

## Verification

**Commands:**
- `pnpm --filter web test` -- expected: API client/proxy configuration tests pass.
- `pnpm --filter web typecheck` -- expected: cấu hình Vite và TypeScript không lỗi.
- `pnpm --filter web build` -- expected: production bundle vẫn tạo được với relative API base.
- `pnpm dev` -- expected: xác nhận thủ công `http://localhost:5173/api/auth/csrf` được proxy đến API và OAuth callback không còn 404 Vite.

## Suggested Review Order

**Public API Boundary**

- Browser dùng một `/api` origin, Vite chỉ strip prefix trên upstream request.
  [`vite.config.ts:7`](../../apps/web/vite.config.ts#L7)

- API client mặc định relative để login, CSRF và fetch cùng đi qua proxy.
  [`client.ts:15`](../../apps/web/src/app/api/client.ts#L15)

**Regression Coverage**

- Khóa rewrite OAuth callback và loại trừ đường dẫn không phải `/api` segment.
  [`vite.config.test.ts:4`](../../apps/web/vite.config.test.ts#L4)

- Khóa URL browser mặc định, bao gồm REST và CSRF.
  [`client.test.ts:6`](../../apps/web/src/app/api/client.test.ts#L6)

**Operational Configuration**

- Hướng dẫn callback local đúng với public web origin.
  [`.env.example:10`](../../apps/api/.env.example#L10)

- Hướng dẫn development và Google Console cho mô hình proxy nội bộ.
  [`README.md:12`](../../README.md#L12)

---
title: 'Khắc phục phiên Admin hết hạn và chẩn đoán OAuth Google'
type: 'bugfix'
created: '2026-08-31'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'c68076784601701b4e8745f54d81f5178df96a03'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-anhhoa-2026-08-18/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Sau khi phiên Admin hết hạn, dashboard trở về trang đăng nhập nhưng cookie `session` JWT cũ vẫn tồn tại trong browser. Khi người dùng thực hiện lại Google OAuth mà callback bị từ chối vì state/cookie/proxy/runtime, ứng dụng quay về trang đăng nhập chung, không nêu nguyên nhân; người dùng chỉ thấy nút nháy rồi trở lại như cũ và xóa site data mới đăng nhập được.

**Approach:** Đồng bộ thời hạn cookie session với thời hạn JWT cấu hình, dọn session bị từ chối, và phân loại an toàn các lỗi OAuth callback để frontend hiển thị hướng dẫn phục hồi. Giữ nguyên mô hình cookie-only, OAuth state ràng buộc browser và topology gateway `/api` hiện có.

## Boundaries & Constraints

**Always:** Giữ session trong cookie `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`; giữ OAuth state `HttpOnly` và cookie-path upstream `/auth/google` để Nginx rewrite thành `/api/auth/google`. JWT vẫn có expiry hữu hạn và `JWT_EXPIRES_IN` tiếp tục là nguồn thời hạn duy nhất. Không đưa token, OAuth state, allowlist hoặc lỗi nội bộ vào URL, response hay log client. Chỉ cho phép redirect OAuth từ allowlist hiện hữu. Thêm regression tests ở API và web/gateway cho vòng đời cookie và các reason công khai.

**Ask First:** Dừng hỏi trước khi đổi thời gian mặc định `JWT_EXPIRES_IN`, thêm refresh token/remember-me, thay đổi thuộc tính bảo mật cookie, thay OAuth provider, hoặc thay topology gateway/Cloudflare Tunnel.

**Never:** Không bỏ expiry JWT; không chuyển token vào localStorage/response body; không dùng `SameSite=None`, wildcard domain hay wildcard CORS; không coi việc xóa site data là cách xử lý sản phẩm; không commit hoặc in secret production. Không đổi `proxy_cookie_path /auth/google /api/auth/google` đang cần cho callback public.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Phiên hợp lệ | JWT và cookie còn trong cùng thời hạn | `/auth/me` xác thực Admin như hiện tại | Không đổi contract profile |
| Phiên hết hạn | JWT cookie qua `JWT_EXPIRES_IN` | Guard trả 401 và response xóa cookie `session` với đúng thuộc tính | Web hiển thị yêu cầu đăng nhập lại, không cần xóa site data |
| OAuth callback state lỗi | Cookie state thiếu/khác hoặc JWT state hết hạn | Xóa state cookie và redirect về login với mã lỗi công khai, không nhạy cảm | Web giải thích rằng phiên đăng nhập đã hết hạn/lỗi xác thực và cho thử lại |
| OAuth bị từ chối allowlist | Google profile không trong allowlist | Giữ mã `reason=denied` hiện có, không cấp session | Web giữ thông báo email không có quyền |
| OAuth callback hợp lệ | State khớp, profile được phép | Ghi đè session cũ bằng JWT mới và cookie có TTL đồng bộ | Redirect allowlisted, `/auth/me` xác thực thành công |

</frozen-after-approval>

## Code Map

- `apps/api/src/common/config/auth-config.ts:3-25,116-170` -- cấu hình typed hiện chỉ giữ chuỗi `jwtExpiresIn`; bổ sung/chuẩn hóa TTL milliseconds dùng chung cho cookie session, validate duration hiện hữu vẫn là nguồn cấu hình.
- `apps/api/src/modules/auth/auth.controller.ts:20-50` -- cấp CSRF, hoàn tất callback và set `session`; thêm `maxAge` session đồng bộ JWT và dùng helper cookie options để set/clear nhất quán.
- `apps/api/src/common/guards/session-auth.guard.ts:12-26` -- hiện chỉ ném 401 khi verify JWT hoặc allowlist thất bại; lấy Response từ context để dọn session không hợp lệ trước khi trả unauthorized.
- `apps/api/src/modules/auth/google-auth.guard.ts:18-46` -- state ký 10 phút, so với cookie và redirect denied chung; phân loại lỗi state/OAuth không thuộc allowlist bằng reason an toàn, luôn clear đúng state cookie.
- `apps/api/src/modules/auth/oauth-denied-redirect.ts` -- helper tạo redirect query/fragment; mở rộng chỉ cho reason public được kiểm soát và giữ query/fragment của URL allowlisted.
- `apps/api/src/modules/auth/auth.controller.test.ts`, `apps/api/src/common/guards/session-auth.guard.test.ts`, `apps/api/src/modules/auth/google-auth.guard.test.ts`, `apps/api/src/common/config/auth-config.test.ts` -- test patterns Vitest hiện hữu cho cookie, guard, config và redirect; bổ sung ma trận regression.
- `apps/web/src/features/auth/login-page.tsx:4-15` -- chỉ hiểu `reason=denied`; thêm copy cho session hết hạn và OAuth state/callback lỗi, vẫn tạo login link relative `/api` với origin hiện tại.
- `apps/web/src/app/app.test.tsx` -- test boundary hiện kiểm tra login OAuth; mở rộng assertions thông báo lỗi công khai tại UI.
- `apps/web/nginx.conf:8-27`, `apps/web/vite.config.ts:7-15` -- evidence read-only: proxy bỏ prefix `/api` và rewrite OAuth state cookie path; không sửa trừ khi test chứng minh contract lệch.
- `apps/parent-web/deployment-config.test.ts:16-22` -- mẫu test deployment config; tạo test tương đương Admin để khóa `proxy_cookie_path`, proxy và SPA fallback.
- `.env.production.example:12-26` -- ghi rõ `JWT_SECRET` phải ổn định giữa deploy/restart và `JWT_EXPIRES_IN` là thời hạn cả JWT/session cookie, không thêm giá trị secret.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/common/config/auth-config.ts` và test config -- parse duration hợp lệ thành TTL session số nguyên, expose qua `AuthConfig`, kiểm tra biên và giữ fail-fast không lộ secret -- tạo một nguồn thời hạn đáng tin cậy.
- [x] `apps/api/src/modules/auth/auth.controller.ts`, `apps/api/src/common/guards/session-auth.guard.ts` và unit tests -- áp cùng cookie options khi cấp/xóa `session`; callback đặt `maxAge` theo config và guard dọn cookie khi session bị reject -- loại bỏ JWT chết còn lưu trong browser.
- [x] `apps/api/src/modules/auth/google-auth.guard.ts`, `oauth-denied-redirect.ts` và tests -- phân biệt state không hợp lệ/hết hạn với allowlist denied qua reason công khai giới hạn; không log state/token và không đổi redirect allowlist -- biến callback lỗi có thể phục hồi và chẩn đoán.
- [x] `apps/web/src/features/auth/login-page.tsx`, `apps/web/src/app/app.test.tsx` -- render thông báo tiếng Việt phù hợp cho từng reason OAuth/session, có accessibility status hiện hữu, giữ thông báo allowlist -- người dùng biết thử đăng nhập lại thay vì xóa site data.
- [x] `apps/web/deployment-config.test.ts` -- kiểm tra contract Admin gateway: `/api` proxy, rewrite state-cookie path và SPA fallback -- ngăn deployment regression gây callback mất cookie state.
- [x] `.env.production.example` và `README.md` nếu cần -- tài liệu hóa secret JWT ổn định, TTL session và checklist Network/response callback để vận hành kiểm chứng -- xử lý nghi phạm runtime không thể xác thực từ source.

**Acceptance Criteria:**
- Given `JWT_EXPIRES_IN` hợp lệ, when callback Admin thành công, then JWT và cookie `session` có cùng thời hạn cấu hình, cookie vẫn `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, và token không xuất hiện trong body/URL.
- Given browser gửi JWT hết hạn, when gọi route được bảo vệ bao gồm `/auth/me`, then API trả unauthorized và xóa chính xác cookie `session`; lần tải sau hiển thị thông báo yêu cầu đăng nhập lại.
- Given state callback thiếu, không khớp hoặc đã hết hạn, when Google callback trở về gateway, then API xóa OAuth state, redirect tới URL allowlisted với reason công khai không nhạy cảm, và login page mô tả được thao tác thử lại.
- Given Google từ chối email ngoài allowlist, when callback bị chặn, then behavior `reason=denied` và thông báo quyền truy cập giữ nguyên, không tạo session.
- Given callback state hợp lệ và Admin được phép sau khi từng có cookie session hết hạn, when OAuth hoàn tất, then cookie session mới ghi đè cookie cũ và `/api/auth/me` xác thực được.
- Given cấu hình gateway Admin, when test deployment config chạy, then bắt buộc có `proxy_cookie_path /auth/google /api/auth/google;`, upstream API và SPA fallback.

## Design Notes

`JWT_EXPIRES_IN` hiện là chuỗi (`8h` mặc định) mà Nest dùng để ký token. Bản sửa chuyển đúng cùng duration sang `maxAge` cookie thay vì dùng một giá trị expiry độc lập, tránh session cookie sống lâu hơn JWT. Reason callback chỉ phân loại tình trạng có thể hướng dẫn người dùng, ví dụ `session_expired` và `oauth_state_invalid`; không phản ánh lỗi Passport, giá trị state, email hay cấu hình máy chủ.

## Verification

**Commands:**
- `pnpm --filter api test` -- expected: config, auth callback, state errors và expired-session cleanup pass.
- `pnpm --filter web test` -- expected: login message và Admin gateway deployment contract pass.
- `pnpm --filter api typecheck && pnpm --filter web typecheck` -- expected: TypeScript không lỗi.
- `pnpm lint && pnpm build` -- expected: workspace lint/build pass.

**Manual checks:**
- DevTools Network với Preserve log: `GET /api/auth/google` phải set `oauth_state` path `/api/auth/google`; callback hợp lệ phải set `session` path `/`, có `Max-Age` đúng TTL và landing `/api/auth/me` là 200.
- Kiểm tra runtime production không đổi `JWT_SECRET` qua deploy/restart, `WEB_ORIGIN`, callback Google và redirect allowlist khớp tuyệt đối `https://admin-anhhoa.passionedu.org`.

## Suggested Review Order

**Session Lifecycle**

- Một TTL cấu hình duy nhất đồng bộ JWT và cookie, đồng thời loại bỏ duration không thể serialize an toàn.
  [`auth-config.ts:127`](../../apps/api/src/common/config/auth-config.ts#L127)

- Cookie session dùng chung thuộc tính khi cấp và xóa, tránh path/security lệch nhau.
  [`session-cookie.ts:4`](../../apps/api/src/common/auth/session-cookie.ts#L4)

- Chỉ dọn session khi JWT hoặc quyền Admin không hợp lệ, không che lỗi database thành logout.
  [`session-auth.guard.ts:15`](../../apps/api/src/common/guards/session-auth.guard.ts#L15)

**OAuth Recovery**

- Callback phát cookie session có TTL và vẫn redirect độc quyền từ state đã xác thực.
  [`auth.controller.ts:37`](../../apps/api/src/modules/auth/auth.controller.ts#L37)

- State callback lỗi có reason công khai giới hạn; allowlist-denied giữ hành vi riêng.
  [`google-auth.guard.ts:28`](../../apps/api/src/modules/auth/google-auth.guard.ts#L28)

- Mã session hết hạn được bảo toàn qua HTTP error contract cho web xử lý.
  [`api-exception.filter.ts:20`](../../apps/api/src/common/filters/api-exception.filter.ts#L20)

- Trang Login diễn giải các reason phục hồi được mà không tiết lộ OAuth internals.
  [`login-page.tsx:4`](../../apps/web/src/features/auth/login-page.tsx#L4)

**Deployment And Regression Coverage**

- Test khóa rewrite state-cookie path của Admin gateway qua public `/api`.
  [`deployment-config.test.ts:7`](../../apps/web/deployment-config.test.ts#L7)

- Test config, guard, filter và callback bao phủ TTL, cleanup, reason và error contract.
  [`auth-config.test.ts:48`](../../apps/api/src/common/config/auth-config.test.ts#L48)

- Hướng dẫn production nhấn mạnh secret ổn định và Network checklist callback.
  [`.env.production.example:21`](../../.env.production.example#L21)

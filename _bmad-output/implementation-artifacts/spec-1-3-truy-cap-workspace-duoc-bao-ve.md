---
title: 'Story 1.3: Truy cập workspace được bảo vệ'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: '1e2b95e485c13c048934049fb7a75bf9f76b25cf'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Web hiện render application shell và các placeholder vận hành như một bề mặt công khai, chưa thiết lập danh tính từ session cookie hoặc ngăn khách xem workspace. Admin đã đăng nhập cũng chưa thấy danh tính API trong shell hay trạng thái truy cập rõ ràng khi session không còn hợp lệ.

**Approach:** Tạo REST client credentialed và query identity `GET /auth/me`, dùng kết quả API để phân nhánh loading, đăng nhập và workspace được bảo vệ. Bổ sung màn Đăng nhập Google ngắn gọn, truyền danh tính vào shell và kiểm thử các trạng thái bootstrap/route chính mà không thay đổi giao thức auth phía API.

## Boundaries & Constraints

**Always:** Mọi gọi API từ web dùng REST JSON credentialed và response API là nguồn chân lý; query key danh tính bắt đầu bằng `auth`; không đọc, lưu, refresh hoặc persist JWT/access token trong JavaScript. Không mount sidebar, placeholder hay dữ liệu vận hành trước khi `GET /auth/me` xác thực thành công. Route vận hành không có session phải đi đến Đăng nhập Google; sidebar hiển thị `displayName` và avatar API nếu có, với fallback truy cập được. Thông báo login phân biệt email không có quyền và cần đăng nhập lại, nhưng không lộ allowlist hay dữ liệu vận hành. Giữ mỗi route đúng một `h1`, navigation keyboard/screen-reader hoạt động và thích ứng shell hiện có.

**Ask First:** Dừng hỏi trước khi thay cơ chế cookie session, bổ sung đăng xuất/refresh token, hoặc thay đổi OAuth redirect/callback ngoài redirect OAuth bị từ chối đã được chấp thuận: API phải bổ sung `reason=denied` vào `OAUTH_DENIED_REDIRECT_URL`, còn web chỉ dùng chính xác tín hiệu này để thông báo email không có quyền.

**Never:** Không thêm token vào localStorage, sessionStorage, URL hoặc React Query persistence; không coi cache client là bằng chứng auth sau lỗi `401`; không nới CORS/CSRF; không thực hiện API domain nghiệp vụ hoặc sửa schema/migration trong Story này; không render workspace công khai chỉ để tránh loading.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Bootstrap hợp lệ | Cookie session hợp lệ, `GET /auth/me` trả `{ data: admin }` | Hiện shell và Tổng quan; identity API dùng lại qua React Query `auth` | Không phát sinh token JavaScript |
| Khách/deep link | Không cookie hoặc API trả `401` khi truy cập route vận hành | Chỉ hiện màn Đăng nhập Google, không mount shell/nội dung vận hành | Thông báo cần đăng nhập lại, giữ bề mặt không lộ dữ liệu |
| OAuth bị từ chối | API redirect về entry surface với `reason=denied` | Hiện thông báo email không có quyền và CTA đăng nhập lại | Không hiển thị `ADMIN_EMAILS` hoặc lỗi nội bộ |
| Lỗi bootstrap khác | Mạng lỗi hoặc API trả lỗi không phải `401` | Hiện trạng thái không thể kiểm tra phiên và nút thử lại; không coi lỗi là đăng nhập thành công | Giữ workspace ẩn, mô tả lỗi trực tiếp và ngắn |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/app.tsx:10-25` -- hiện tạo QueryClient/BrowserRouter nhưng mount ngay shell công khai; thay bằng auth bootstrap boundary và giữ QueryClient ổn định.
- `apps/web/src/app/routes.ts:1-9` -- danh sách URL vận hành hiện có; giữ làm navigation protected, bổ sung route đăng nhập/boundary phù hợp.
- `apps/web/src/features/overview/page.tsx:4-9` -- placeholder phụ thuộc `useLocation`; chỉ render sau khi identity đã xác thực, giữ handling đường dẫn không hợp lệ và `h1`.
- `apps/web/src/components/sidebar.tsx:5-10` -- thay account hard-code bằng profile an toàn từ `/auth/me`, xử lý avatar URL null/fallback.
- `apps/web/src/components/navigation-sheet.tsx`, `apps/web/src/components/menu-button.tsx`, `apps/web/src/components/offline-notice.tsx` -- tái dùng trong shell được bảo vệ, không đưa vào login surface.
- `apps/web/src/app/api/*` (mới) -- REST client `credentials: 'include'`, parse error contract và auth identity query; chuẩn bị lấy/gửi CSRF cho mutation mà không đọc session cookie.
- `apps/web/src/features/auth/*` (mới) -- trang đăng nhập, CTA tới endpoint OAuth và auth bootstrap/route guard theo React Query.
- `apps/api/src/modules/auth/auth.controller.ts:19-53` -- read-only contract: `/auth/me` trả safe Admin; `/auth/google` bắt đầu OAuth; JWT chỉ ở cookie `httpOnly`.
- `apps/api/src/modules/auth/google-auth.guard.ts:41-45` và `apps/api/src/modules/auth/auth.controller.ts:35-50` -- bổ sung nhất quán `reason=denied` khi OAuth bị từ chối, vẫn redirect duy nhất tới `OAUTH_DENIED_REDIRECT_URL` đã allowlist.
- `apps/api/src/common/filters/api-exception.filter.ts:5-13` -- read-only API error shape `{ error: { code, message, fieldErrors? } }` cần REST client parse.
- `apps/web/src/components/sidebar.test.tsx` và `apps/web/e2e/application-shell.spec.ts` -- baseline shell test cần đổi/mở rộng để không giả định workspace công khai.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/app/app.tsx`, `apps/web/src/app/routes.ts`, `apps/web/src/app/api/*`, `apps/web/src/features/auth/*` -- thêm API client credentialed, query `['auth', 'me']`, bootstrap/loading/error boundary, login route và rào chắn tất cả URL vận hành -- thiết lập identity trước mọi bề mặt dữ liệu.
- [x] `apps/web/src/components/sidebar.tsx` -- nhận profile Admin đã xác thực, hiển thị tên/avatar hoặc fallback có nhãn -- bỏ identity placeholder khỏi workspace.
- [x] `apps/api/src/modules/auth/*.test.ts`, `apps/web/src/**/*.test.tsx`, `apps/web/e2e/application-shell.spec.ts` -- kiểm thử API client/auth boundary cho success, `401`, OAuth-denied redirect, lỗi bootstrap và avatar fallback; cập nhật shell test chỉ chạy sau identity hợp lệ -- khóa rò rỉ workspace và regression responsive/a11y.

**Acceptance Criteria:**
- Given web khởi động với session cookie hợp lệ, when credentialed `GET /auth/me` thành công, then app bootstrap Admin từ `{ data }`, hiển thị Tổng quan và application shell, không lưu access token trong JavaScript.
- Given khách mở bất kỳ URL vận hành hoặc `/auth/me` trả unauthenticated, when bootstrap kết thúc, then họ chỉ thấy Đăng nhập Google và không thấy shell/dữ liệu vận hành trước xác thực.
- Given OAuth bị từ chối vì email không có quyền hoặc session đã hết hạn, when màn Đăng nhập được hiển thị, then thông báo ngắn nêu đúng email không có quyền hoặc cần đăng nhập lại mà không tiết lộ allowlist.
- Given Admin điều hướng các route được bảo vệ, when identity được tái sử dụng, then web dùng React Query/REST client với query key bắt đầu `auth` và chỉ tin API response; `401` không tiếp tục render cache identity cũ.

## Design Notes

`401` chỉ là tín hiệu session không hợp lệ, nên login surface dùng thông báo trung tính. Chỉ `reason=denied` do API thêm vào URL redirect bị từ chối mới nêu email không có quyền. Lỗi mạng/5xx không bị ép thành `401`: giữ workspace ẩn và cho phép thử lại để tránh vừa rò dữ liệu vừa diễn giải sai trạng thái phiên.

## Spec Change Log

- Review phát hiện API OAuth redirect bị từ chối không mang tín hiệu mà web có thể dùng để phân biệt với session không hợp lệ. Theo phê duyệt `[A]` của human, bổ sung contract `reason=denied` trên redirect an toàn đã cấu hình và kiểm thử xuyên API/web; tránh thông báo “phiên hết hạn” sai cho email bị từ chối. KEEP: workspace vẫn chỉ mount sau `/auth/me` thành công, REST luôn credentialed và lỗi bootstrap không lộ dữ liệu.

## Verification

**Commands:**
- `pnpm --filter web test` -- expected: auth client/boundary và sidebar identity tests pass.
- `pnpm --filter web test:e2e` -- expected: protected shell, login redirect, responsive navigation và accessibility flows pass.
- `pnpm lint && pnpm typecheck && pnpm build` -- expected: lint, strict typecheck và production build toàn workspace pass.

**Manual checks (if no CLI):**
- Khởi động web/API với môi trường auth hợp lệ, mở deep link không có session để xác nhận chỉ có Đăng nhập Google; đăng nhập allowlisted để xác nhận shell hiện profile `/auth/me`, rồi xóa/hết hạn cookie và reload để xác nhận workspace biến mất.

## Suggested Review Order

**Identity Boundary**

- Bootstrap only reveals the operational shell after an authoritative identity response.
  [`app.tsx:38`](../../apps/web/src/app/app.tsx#L38)

- Credentialed REST parsing rejects malformed profiles before they reach the shell.
  [`auth.ts:15`](../../apps/web/src/app/api/auth.ts#L15)

- Login distinguishes only the API-issued allowlist-denial signal from neutral re-authentication.
  [`login-page.tsx:4`](../../apps/web/src/features/auth/login-page.tsx#L4)

**OAuth Denial Contract**

- The strategy identifies missing or unallowlisted verified Google emails explicitly.
  [`google.strategy.ts:18`](../../apps/api/src/modules/auth/google.strategy.ts#L18)

- Guard redirects technical OAuth failures neutrally and allowlist rejection with the safe signal.
  [`google-auth.guard.ts:28`](../../apps/api/src/modules/auth/google-auth.guard.ts#L28)

- Redirect helper preserves valid configured destinations without throwing on malformed configuration.
  [`oauth-denied-redirect.ts:1`](../../apps/api/src/modules/auth/oauth-denied-redirect.ts#L1)

**Identity Presentation**

- Sidebar normalizes profile names and safely falls back when avatars fail.
  [`sidebar.tsx:7`](../../apps/web/src/components/sidebar.tsx#L7)

**Verification**

- Web tests cover credentialed bootstrap, stale session eviction, retries, and identity rendering.
  [`app.test.tsx:16`](../../apps/web/src/app/app.test.tsx#L16)

- API tests prove denial reasons remain distinct across OAuth failure paths.
  [`google-auth.guard.test.ts:17`](../../apps/api/src/modules/auth/google-auth.guard.test.ts#L17)

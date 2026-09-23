---
title: 'Khắc phục vòng lặp đăng nhập Google ở local'
type: 'bugfix'
created: '2026-09-23'
status: 'done'
review_loop_iteration: 0
baseline_commit: '9b8f10b1a5b5ac63a879e57e36a66993fd636b4e'
context:
  - 'apps/api/src/modules/auth/auth.config.ts'
  - 'apps/api/src/modules/auth/auth.controller.ts'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Khi API local chạy HTTP, callback Google phát correlation và session cookie với cờ `Secure`. Browser không lưu/gửi cookie trên HTTP, OAuth callback bị từ chối rồi quay về màn hình Đăng nhập sau trạng thái “Đang xác thực phiên...”, đặc biệt dễ tái hiện sau khi xóa site data.

**Approach:** Tách chính sách cookie khỏi `NODE_ENV`: chỉ đặt `Secure` khi endpoint callback chạy HTTPS (và luôn giữ bắt buộc trong production). Giữ nguyên host-only, `HttpOnly`, `SameSite=Lax`, audience isolation, OAuth state/correlation và CSRF behavior.

## Boundaries & Constraints

**Always:** Production phải fail closed nếu callback OAuth không dùng HTTPS và mọi auth cookie production phải có `Secure`. Development HTTP local phải phát correlation/session cookie không `Secure` để browser hoàn thành OAuth. Không log hoặc đưa secret Google/session vào test hay repository.

**Ask First:** Dừng nếu cần thay đổi domain, Google redirect URI, OAuth client configuration hoặc chuyển session sang server-side storage.

**Never:** Không nới lỏng cookie production, không thêm `Domain`, `SameSite=None`, bearer token browser storage hoặc silent authentication bypass. Không thay đổi authentication/authorization semantics của Staff feature.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Local OAuth start/callback | Callback `http://localhost:3000/...`, development | Correlation/session/CSRF cookie không có `Secure`; browser có thể gửi correlation vào callback và bootstrap session | Không redirect denied do cookie bị browser loại bỏ |
| Production cookie issue | `NODE_ENV=production`, callback HTTPS | Correlation/session/CSRF cookie có `Secure` | Startup từ chối callback không HTTPS |
| Invalid production transport | `NODE_ENV=production`, callback HTTP | Không khởi động API | Báo lỗi cấu hình rõ ràng trước khi phục vụ request |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/auth/auth.config.ts:22-34` -- nguồn callback URL theo audience; điểm phù hợp để kiểm tra HTTPS production một lần cho toàn bộ audience.
- `apps/api/src/modules/auth/auth.controller.ts:9,19-29,42-47` -- hiện dùng `process.env.NODE_ENV !== 'test'` để suy ra `Secure`, làm development HTTP nhận cookie `Secure` sai.
- `apps/api/src/modules/auth/auth.controller.test.ts:35-56` -- test HTTP boundary cho callback cookies và logout; mở rộng proof cho development HTTP và production HTTPS.
- `apps/api/src/main.ts:51-57` -- gọi validation config strict trước bootstrap HTTP listener.
- `apps/web/src/main.tsx:61-101` -- chỉ hiển thị signed-out UI khi `GET /api/app/auth/session` không có cookie hợp lệ; read-only proof của symptom.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/modules/auth/auth.config.ts` -- thêm policy xác định cookie `Secure` từ callback URL và strict production validation; tránh phụ thuộc `NODE_ENV !== test` để local HTTP hoạt động.
- [x] `apps/api/src/modules/auth/auth.controller.ts` -- dùng policy cấu hình chung khi phát/xóa correlation, session và CSRF cookie cho mọi audience.
- [x] `apps/api/src/modules/auth/auth.controller.test.ts` -- kiểm tra cookie callback local HTTP không Secure, HTTPS/production Secure, và production callback HTTP fail closed; giữ coverage host-only/audience/CSRF.

**Acceptance Criteria:**
- Given API development callback là `http://localhost:3000/api/app/auth/google/callback`, when bắt đầu và hoàn tất Google OAuth, then cookies cần thiết không chứa `Secure` và browser local có thể bootstrap `GET /api/app/auth/session` thành công.
- Given API production callback là HTTPS, when callback phát hoặc logout xóa auth cookie, then session, CSRF và correlation cookies có `Secure`, `SameSite=Lax`, path `/`, host-only semantics.
- Given production callback OAuth cấu hình HTTP, when API bootstrap, then API từ chối khởi động trước khi nhận request.

## Design Notes

`Secure` được quyết định bằng transport của callback, không bằng môi trường test. Điều này cho phép test HTTP kiểm tra cookie local chính xác, vẫn mặc định production fail-closed và không phụ thuộc proxy/header có thể bị spoof.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test -- auth.controller.test.ts` -- expected: callback cookie policy, production transport validation, audience và CSRF tests pass.
- `pnpm --filter @passionedu/api typecheck` -- expected: TypeScript compile pass.
- `curl -i http://localhost:3000/api/app/auth/google/start` sau khi restart API dev -- expected: `Set-Cookie: app_oauth_correlation` không có `Secure` với HTTP local.

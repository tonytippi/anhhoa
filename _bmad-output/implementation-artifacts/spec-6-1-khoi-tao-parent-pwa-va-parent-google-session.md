---
title: 'Khởi tạo Parent PWA và Parent Google session'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_revision: 'a9a97a9d3c2631bfb6866347cb95fc130baebbe1'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-6-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Parent đã được cấp quyền chưa có PWA hay session riêng để đăng nhập và xem dữ liệu an toàn. Session Admin hiện hữu không thể dùng chung vì identity, cookie, OAuth callback và bề mặt API phải cô lập.

**Approach:** Tạo `apps/parent-web` độc lập và module API `parent-auth` cho Google OAuth, Parent session, bootstrap `/api/parent/me` và logout. Mở rộng validation/cross-origin/CSRF để nhận biết riêng Parent origin và cookie, đồng thời chỉ phát session sau khi toàn bộ điều kiện Parent và liên kết active được xác nhận.

## Boundaries & Constraints

**Always:** Parent OAuth state random, browser/callback-bound, single-use và expiring; Google email phải verified và normalized. Bind `googleSubject` chỉ ở login đầu với Parent `ACTIVE` có ít nhất một `StudentParent` `ACTIVE`; subject đổi hoặc mọi điều kiện không đạt phải từ chối không tạo session. Parent cookie khác Admin, `Secure`, `httpOnly`, `SameSite=Lax`; logout mutation dùng origin validation và double-submit CSRF. Client phải clear React Query/protected state trước redirect khi logout hoặc `/me` trả `401`; service worker không cache `/api` hay protected data.

**Block If:** Cấu hình bắt buộc Parent origin, callback allowlist, cookie name hoặc cookie scope không thể ánh xạ an toàn vào cơ chế config hiện có.

**Never:** Không import `apps/web`, dùng router/session/service worker/browser state hay endpoint nghiệp vụ Admin; không tạo `/students`, `/invoices` hay invoice read DTO (Story 6.2); không thêm payment, VietQR, push notification hoặc forced install prompt; không tự active/khôi phục Parent hay StudentParent trong luồng OAuth.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Login lần đầu | Google verified email khớp Parent ACTIVE có link ACTIVE, subject chưa bind | Subject được bind và cookie Parent riêng được cấp | Không trả Parent DTO trước `/api/parent/me` |
| Login bị từ chối | Email chưa cấp, Parent inactive/không link active, subject khác, state/provider lỗi | Callback an toàn, không cấp cookie/session một phần | Thông báo chung, không tiết lộ quyền hay dữ liệu |
| Logout/expiry | Parent logout hoặc `/api/parent/me` trả 401 | Server invalid session; client clear cache rồi tới Đăng nhập | Không giữ protected route/data cũ |
| OAuth replay | State đã consume hoặc hết hạn/khác browser-callback | Không đăng nhập | Từ chối an toàn, không cấp session |

</intent-contract>

## Code Map

- `apps/web/package.json`, `vite.config.ts`, `src/app/api/auth.tsx` -- chỉ là mẫu cấu trúc/tooling PWA và bootstrap, không import vào Parent app.
- `apps/api/src/modules/auth/google-auth.guard.ts` -- mẫu state redirect hiện có nhưng không đáp ứng one-time state Parent.
- `apps/api/src/modules/auth/auth.controller.ts`, `session-auth.guard.ts` -- mẫu cookie/session Admin, phải giữ cô lập.
- `apps/api/src/common/config/auth-config.ts`, `main.ts`, `common/middleware/csrf.middleware.ts` -- validation topology/cookie, credentialed CORS và CSRF hiện chỉ nhận biết Admin.
- `apps/api/prisma/schema.prisma` -- `Parent.googleSubject`, trạng thái Parent và `StudentParent` retained relation.
- `apps/api/src/modules/parents/parents.service.ts` -- owner của Parent/link; không cho OAuth tự thay đổi lifecycle.
- `apps/api/src/modules/parents/parents.integration.test.ts` -- bằng chứng revoke được kiểm tra tại request tiếp theo.

## Tasks & Acceptance

**Execution:**
- `apps/parent-web/**` -- tạo React/Vite PWA độc lập với manifest/icons, router, credentialed REST client, React Query cache memory-only, session bootstrap/login shell/account logout và kiểm thử app -- cung cấp Parent surface mobile-first mà không tái sử dụng Admin browser code.
- `apps/api/src/modules/parent-auth/**`, `apps/api/src/app.module.ts` -- tạo Parent Google OAuth, server-side one-time state, Parent session guard/controller, `/api/parent/me` DTO tối thiểu và logout -- cô lập authentication Parent.
- `apps/api/src/common/config/auth-config.ts`, `main.ts`, `common/middleware/csrf.middleware.ts` -- validate fail-fast Parent auth topology/cookie, permit credentialed Parent origin và bắt Parent logout qua đúng CSRF boundary -- duy trì cookie-auth invariants cho hai surfaces.
- `apps/api/src/modules/parents/parents.service.ts`, `apps/api/prisma/schema.prisma` -- thêm thao tác truy vấn/bind subject nguyên tử tối thiểu nếu cần và giữ schema migration-safe -- xác minh identity không đổi lifecycle/link ngoài OAuth bind cho phép.
- `apps/api/src/**/*.test.ts`, `apps/parent-web/src/**/*.test.tsx`, `apps/parent-web/e2e/*.spec.ts` -- thêm test config/state/session/identity, logout-401 clear và app/PWA contract -- bao phủ matrix và AC.

**Acceptance Criteria:**
- Given repository có Admin PWA, when Parent PWA được khởi tạo, then `apps/parent-web` có tooling, router, manifest, icon, service worker, REST client và cache riêng, không import hay gọi bề mặt Admin.
- Given Parent mở login shell trên mobile, when UI render, then một cột dùng token Parent, gutter 20px, controls tối thiểu 44px và không forced install/push.
- Given Google callback hợp lệ với Parent active còn link active, when one-time state được consume, then chỉ cookie Parent riêng được phát và `/api/parent/me` trả identity tối thiểu.
- Given identity/state/provider không hợp lệ, when callback chạy, then không phát partial Parent session hay dữ liệu Parent.
- Given logout, expiry hoặc `/api/parent/me` trả 401, when Parent PWA xử lý, then server session và protected client state bị xóa trước route login.
- Given Parent API bật, when config thiếu/invalid Parent topology, callback allowlist hay cookie scope/name, then API fail fast trước nhận request.

## Spec Change Log

Không có thay đổi spec sau implementation.

## Review Triage Log

### 2026-08-22 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 7 (high 2, medium 3, low 2)
- defer: 2 (medium 2)
- reject: 13
- addressed_findings:
  - `[high] [patch]` Đồng nhất cookie path OAuth Parent với callback route và thêm test state one-time, browser-bound, expiry/replay.
  - `[high] [patch]` Chọn CSRF policy theo `/parent/` route surface để tách Parent/Admin ngay cả khi browser giữ cả hai cookies.
  - `[medium] [patch]` Từ chối Google subject/email malformed trước bind và kiểm tra Parent session khi mất active link.
  - `[medium] [patch]` Logout luôn clear cache/token và điều hướng login khi API lỗi; bottom navigation dùng controls focusable.
  - `[low] [patch]` Prune OAuth state hết hạn và tránh xử lý deny sau khi response đã được gửi.

## Design Notes

Session Admin và Parent cần guard, cookie name, OAuth state namespace và origin allowlist tách biệt để cookie Parent không bao giờ được diễn giải là Admin. `/api/parent/me` là bootstrap contract duy nhất ở Story 6.1; read model được để nguyên cho Story 6.2.

## Verification

**Commands:**
- `pnpm --filter api test` -- expected: API unit suite passes.
- `pnpm --filter api test:integration` -- expected: Parent identity/session lifecycle integration coverage passes with PostgreSQL.
- `pnpm --filter parent-web test` -- expected: Parent session/UI unit suite passes.
- `pnpm --filter parent-web build` -- expected: isolated PWA production build succeeds.

## Auto Run Result

- Summary: Tạo Parent PWA độc lập và Parent Google OAuth/session với bootstrap `/api/parent/me`, logout CSRF-protected và cache clearing khi logout/401.
- Files changed: `apps/parent-web/**` tạo PWA độc lập; `apps/api/src/modules/parent-auth/**` tạo OAuth/session Parent; config/CORS/CSRF được mở rộng cho bề mặt Parent; `ParentsService` thêm bind identity active-only; artifact Epic/Story ghi implementation context.
- Review findings: 7 patches đã áp dụng (high 2, medium 3, low 2); 2 deferred; 13 rejected. Follow-up review recommendation: `true` (2 high patches, score 11).
- Verification: `pnpm --filter api test` passed (26 files, 113 tests); `pnpm --filter api test:integration` passed (8 files, 47 tests); `pnpm --filter parent-web test` passed (1 file, 2 tests); `pnpm --filter parent-web build` passed; `git diff --check` passed.
- Residual risks: OAuth state store hiện in-process; restart hoặc multi-instance non-sticky callback sẽ bị từ chối an toàn và cần shared store nếu topology đó được triển khai. Session JWT stateless theo cơ chế Admin hiện tại; revoke được re-check tại `/me`, nhưng logout không tạo denylist cho token bị sao chép.

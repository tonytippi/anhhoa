---
title: 'Story 1.1: Khắc phục workspace và application shell'
type: 'bugfix'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 1
baseline_commit: '6e79252d684f927cb7a853ab2dc77b362eec7fbc'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-1-khoi-tao-workspace-va-application-shell.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Story 1.1 đã scaffold được workspace nhưng Prisma client/seed workflow chưa chạy được, API chưa có contract chạy production hay validate port, và một số chi tiết shell/PWA không bảo đảm contract responsive, typography, Base UI và install metadata. Các test hiện tại cũng bỏ sót các hành vi đó.

**Approach:** Hoàn thiện các contract runtime còn thiếu trong giới hạn scaffold, sửa application shell/PWA theo yêu cầu đã chốt và mở rộng test để các lỗi đã phát hiện không tái diễn. Không thêm domain API, auth hay dữ liệu vận hành.

## Boundaries & Constraints

**Always:** Giữ TypeScript strict, Prisma schema/migration/seed chỉ dưới `apps/api/prisma`, và không đưa secret vào repository. Dùng Prisma 7 config để chạy generate không cần `DATABASE_URL` và chạy seed khi có `DATABASE_URL`; API fail-fast nếu `PORT` không phải integer 1-65535. PWA giữ tên `Ánh Hoa Admin`, `display: standalone`, install browser-native và không queue/replay mutation offline. Sheet phải dùng Base UI dialog, có trap focus, Escape, backdrop close và trả focus trigger. Bundle font local được cấp phép, dùng Inter cho nội dung và Be Vietnam Pro cho heading/branding để bảo đảm đủ tiếng Việt, icon PWA PNG khai báo đúng kích thước. Mỗi outage chỉ hiện đúng một notice và `online` phải ẩn notice.

**Ask First:** Dừng hỏi trước khi thay version stack, thêm OAuth/API domain/database model, thêm package shared runtime, chọn nền tảng deploy hoặc thay architecture spine.

**Never:** Không sửa final planning artifact; không thêm font CDN, forced install UI, background sync, API reachability retry hay queue mutation. Không giả lập rewrite deploy trong source khi chưa chọn hosting. Không thêm record nghiệp vụ hoặc migration chỉ để test seed.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Prisma scaffold | Clean install, `prisma generate` | Prisma Client sinh thành công; `prisma db seed` chạy seed no-op qua Prisma config | Báo thiếu `DATABASE_URL` rõ ràng khi command cần datasource |
| API port | `PORT` missing hoặc integer hợp lệ | Missing dùng 3000; integer 1-65535 được listen | Giá trị rỗng, decimal, ký tự, <=0 hoặc >65535 fail trước khi bind |
| Sheet resize | Sheet mở tại 768px, viewport sang 1024px | Dialog unmount, trigger không còn expanded và focus được khôi phục | Không để modal CSS-hidden còn trong accessibility tree |
| Offline lifecycle | Nhiều `offline`, rồi `online`, rồi `offline` | Mỗi outage có một notice; online ẩn notice; outage mới hiện lại | Không queue hay replay request |
| PWA artifact | Production build đọc manifest | Tên, standalone và hai PNG 192/512 đúng MIME/kích thước | Test fail nếu metadata hoặc icon sai |

</frozen-after-approval>

## Code Map

- `apps/api/package.json` -- scripts và dependency contract; thiếu `@prisma/client`, Prisma seed workflow và production start script.
- `apps/api/prisma/schema.prisma` -- Prisma 7 schema datasource PostgreSQL, giữ ownership tại API.
- `apps/api/prisma/seed.ts` -- seed no-op hợp lệ cho scaffold, phải được Prisma config gọi.
- `apps/api/prisma.config.ts` -- mới; nơi Prisma 7 nhận schema, datasource, migrations path và seed command.
- `apps/api/src/main.ts` -- Nest bootstrap; tách helper parse port để unit test mà không tự listen khi import.
- `apps/api/src/main.test.ts` -- mới; bảo vệ parse port hợp lệ/không hợp lệ.
- `apps/api/vitest.config.ts` -- hiện phát warning ESM loader; đồng bộ package module mode nếu cần.
- `apps/web/src/app/app.tsx` -- giữ QueryClient/router/shell, đóng sheet khi rời `max-width: 1023px`.
- `apps/web/src/components/navigation-sheet.tsx` -- thay dialog/focus trap tự viết bằng primitive `@base-ui/react`.
- `apps/web/src/index.css` -- tokens shell hiện hữu; thêm `@font-face` local và style Base UI dialog mà không đổi breakpoint.
- `apps/web/public/manifest.webmanifest` -- đổi icon declarations sang PNG 192/512 đúng MIME và sizes.
- `apps/web/public/fonts/*`, `apps/web/public/icons/icon-*.png` -- assets local mới, không dùng network font/CDN.
- `apps/web/e2e/application-shell.spec.ts` -- mở rộng assertions manifest, computed shell tokens, breakpoint boundaries, resize sheet và full offline lifecycle.
- `apps/web/src/lib/network-status.test.ts` -- giữ dedupe contract và bổ sung initial-offline/cleanup nếu cần.
- `apps/web/playwright.config.ts` -- chạy e2e trên production build/preview để kiểm tra PWA asset thực.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/package.json`, `apps/api/prisma.config.ts`, `apps/api/prisma/seed.ts`, `pnpm-lock.yaml` -- thêm Prisma Client, Prisma 7 config/seed và production start contract; cập nhật lockfile bằng pnpm.
- [x] `apps/api/src/main.ts`, `apps/api/src/main.test.ts`, `apps/api/package.json` -- validate `PORT` fail-fast bằng helper testable và sửa module/test configuration warning nếu cần.
- [x] `apps/web/public/fonts/*`, `apps/web/src/index.css` -- bundle Inter và Be Vietnam Pro local, áp dụng cho body/heading token với coverage tiếng Việt.
- [x] `apps/web/public/icons/icon-192.png`, `apps/web/public/icons/icon-512.png`, `apps/web/public/manifest.webmanifest` -- dùng icon PNG thật có metadata PWA chính xác.
- [x] `apps/web/src/components/navigation-sheet.tsx`, `apps/web/src/app/app.tsx`, `apps/web/src/index.css` -- dùng Base UI Dialog và đóng dialog khi breakpoint sheet không còn áp dụng.
- [x] `apps/web/e2e/application-shell.spec.ts`, `apps/web/src/lib/network-status.test.ts`, `apps/web/playwright.config.ts` -- kiểm tra production PWA, manifest/icon, responsive boundaries, lifecycle offline và keyboard dialog.
- [x] `README.md` -- ghi command Prisma/API production chính xác và yêu cầu hosting phải rewrite SPA route về `index.html` khi deploy.

**Acceptance Criteria:**
- Given clean dependencies, when chạy Prisma generate không cần environment hoặc Prisma seed với `DATABASE_URL` hợp lệ, then cả hai command hoàn tất và Prisma Client được sinh từ cấu trúc chỉ thuộc `apps/api/prisma`.
- Given API bắt đầu, when `PORT` missing hoặc integer 1-65535, then API dùng port mặc định hoặc port chỉ định; when invalid, then process fail trước khi listen với lỗi cấu hình rõ ràng.
- Given web app dùng local asset, when browser tải shell, then Inter và Be Vietnam Pro được khai báo từ asset cùng origin, đủ glyph tiếng Việt, và navigation sheet dùng primitive Base UI với hành vi modal keyboard giữ nguyên.
- Given sheet đang mở ở tablet, when viewport sang >=1024px, then sheet đóng hoàn toàn và trigger phản ánh trạng thái đóng.
- Given production PWA artifact, when browser đọc manifest và icon, then `Ánh Hoa Admin`, standalone và PNG 192/512 hợp lệ được phục vụ; không có UI ép cài.
- Given outage lifecycle, when browser offline lặp lại, online, rồi offline lần nữa, then mỗi outage chỉ có một thông báo, online xóa thông báo, và không có retry/queue mutation.

## Spec Change Log

- Vòng review 1: Clash Grotesk asset sẵn có không đủ glyph tiếng Việt, trong khi không có source redistributable thay thế trong repository và CDN bị cấm. Đổi contract heading/branding sang Be Vietnam Pro local có coverage tiếng Việt; giữ Inter cho nội dung, PWA/Base UI/asset local và toàn bộ breakpoint hiện có.

## Design Notes

Sửa deep link cần contract ở tầng hosting, không thể chứng minh bằng Vite source duy nhất. README sẽ nêu rõ production host phải trả `index.html` cho SPA route; Playwright chỉ phục vụ artifact production để kiểm chứng shell sau khi route đã được fallback.

## Verification

**Commands:**
- `pnpm install --frozen-lockfile` -- expected: dependency graph khớp lockfile.
- `pnpm --filter api prisma:generate` -- expected: Prisma Client generate thành công.
- `DATABASE_URL=postgresql://user:password@localhost:5432/anhhoa pnpm --filter api prisma:seed` -- expected: Prisma config gọi seed no-op thành công.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- expected: toàn workspace pass không warning config mới.
- `pnpm --filter web exec playwright test` -- expected: test chạy production artifact và bao phủ manifest, icon, responsive sheet, focus, offline lifecycle.

**Manual checks (if no CLI):**
- Mở sheet tại 768px, resize sang 1024px và xác nhận sheet đóng, focus quay về menu trigger, desktop sidebar hiển thị.
- Mở direct URL `/bao-cao` trên hosting production đã cấu hình rewrite và xác nhận route render thay vì 404.

## Suggested Review Order

**Runtime Contracts**

- Prisma client generation is environment-free while database operations remain configuration-driven.
  [`prisma.config.ts:1`](../../../apps/api/prisma.config.ts#L1)

- API validates port input before constructing or binding the Nest application.
  [`main.ts:4`](../../../apps/api/src/main.ts#L4)

- Package scripts establish Prisma and compiled API execution contracts.
  [`package.json:5`](../../../apps/api/package.json#L5)

**Application Shell**

- Responsive state closes the Base UI sheet when desktop navigation becomes active.
  [`app.tsx:10`](../../../apps/web/src/app/app.tsx#L10)

- Base UI owns modal behavior, focus trapping, backdrop closing, and restoration.
  [`navigation-sheet.tsx:1`](../../../apps/web/src/components/navigation-sheet.tsx#L1)

- Local Vietnamese-capable typography and constrained sheet controls preserve the visual accessibility baseline.
  [`index.css:4`](../../../apps/web/src/index.css#L4)

**PWA And Verification**

- Manifest declares the exact PNG icons required for browser-native installation.
  [`manifest.webmanifest:1`](../../../apps/web/public/manifest.webmanifest#L1)

- Production build precaches fonts alongside install assets.
  [`vite.config.ts:10`](../../../apps/web/vite.config.ts#L10)

- Browser tests cover manifest integrity, boundaries, dialog focus, and outage lifecycle.
  [`application-shell.spec.ts:3`](../../../apps/web/e2e/application-shell.spec.ts#L3)

- API tests verify port parsing and fail-fast bootstrap behavior.
  [`main.test.ts:16`](../../../apps/api/src/main.test.ts#L16)

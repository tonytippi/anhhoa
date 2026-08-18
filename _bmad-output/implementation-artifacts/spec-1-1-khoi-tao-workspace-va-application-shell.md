---
title: 'Story 1.1: Khởi tạo workspace và application shell'
type: 'feature'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'ab1f5848e74fd9d073fd25b31c4d863fb60749db'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Repository hiện chỉ có planning artifact, nên chưa có workspace chạy được hoặc bề mặt quản trị nhất quán để phát triển các luồng vận hành tiếp theo. Admin cần mở được Ánh Hoa Admin với điều hướng rõ ràng, responsive, có nền tảng PWA và các baseline accessibility từ ngày đầu.

**Approach:** Khởi tạo pnpm monorepo dùng Turborepo với web React/Vite/PWA và API NestJS/Prisma theo architecture spine. Xây dựng application shell tĩnh bằng tiếng Việt, responsive theo các breakpoint đã chốt, dùng token thiết kế đã định nghĩa và hiển thị một thông báo offline duy nhất cho mỗi đợt mất mạng.

## Boundaries & Constraints

**Always:** Dùng TypeScript strict; giữ Prisma schema, migration và seed chỉ tại `apps/api/prisma`; web chỉ chuẩn bị gọi REST API, không import Prisma/database hoặc lưu token. Dùng React 19, Vite 8, NestJS 11, Prisma 7, Tailwind CSS v4, tw-animate-css và shadcn/ui trên Base UI. Application là PWA tên `Ánh Hoa Admin`, có manifest/icon và `display: standalone`; chỉ dùng browser-native install, không ép cài. Mỗi route render đúng một `h1`; focus thấy rõ màu brand; mọi icon button có nhãn truy cập được và target ít nhất 40x40px. Giữ UI text tiếng Việt, nền `#FFFDF7`, card trắng viền mảnh, brand `#277E48`, selected nav `#E7F2E9`, Inter cho nội dung và Clash Grotesk cho heading.

**Ask First:** Dừng hỏi trước khi thay đổi architecture spine, thêm package shared có runtime dependency từ app, thay đổi phạm vi stack/version đã chốt, hoặc thêm luồng xác thực/OAuth thực tế vào Story 1.1.

**Never:** Không đưa secret hoặc giá trị thật vào repository; `.env.example` không có giá trị thật. Không sửa final planning artifact. Không triển khai API domain, database business model, OAuth, session, `GET /auth/me`, mutation queue/retry offline, màn hình dữ liệu vận hành thật, hoặc điều hướng cho role/portal ngoài Admin trong story này.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Shell desktop | Viewport >= 1280px | Sidebar cố định đầy đủ, content gutter 32px, nav Tổng quan đang chọn | Không áp dụng |
| Shell tablet/mobile | Viewport dưới 1280px | 1024-1279px có sidebar thu gọn; 768-1023px dùng sheet; dưới 768px vẫn mở được toàn bộ điều hướng quản trị | Menu đóng sau khi chọn route trên sheet/mobile |
| Mất mạng | Browser phát `offline` nhiều lần trong cùng đợt | Toast đúng câu `Bạn đang ngoại tuyến. Không thể lưu thay đổi.` chỉ hiện một lần | Reset khả năng thông báo khi browser phát `online`, không queue/replay request |
| Cài ứng dụng | Browser hỗ trợ PWA install | Manifest xác định đúng tên, icon và standalone behavior; browser tự quyết định thời điểm prompt | Không có UI/prompt ép người dùng cài |

</frozen-after-approval>

## Code Map

- `AGENTS.md` -- chính sách không secret, ranh giới API/web, invariant dữ liệu và artifact cần giữ nguyên.
- `_bmad-output/implementation-artifacts/epic-1-context.md:15-40` -- bản tổng hợp ràng buộc Epic 1; dùng làm nguồn chính cho shell, PWA và accessibility.
- `_bmad-output/planning-artifacts/epics.md:177-207` -- acceptance criteria gốc của Story 1.1.
- `_bmad-output/planning-artifacts/architecture/architecture-anhhoa-2026-08-18/ARCHITECTURE-SPINE.md:47-57,122-164` -- ràng buộc workspace, ownership API và cấu trúc thư mục đích.
- `_bmad-output/planning-artifacts/ux-designs/ux-anhhoa-2026-08-18/DESIGN.md:9-138` -- design token, typography, spacing và shell visual language.
- `_bmad-output/planning-artifacts/ux-designs/ux-anhhoa-2026-08-18/EXPERIENCE.md:87-105,151-155` -- hành vi responsive/accessibility và giới hạn IA.
- `README.md:22-29` -- stack dự kiến; không có source/config ứng dụng hiện hữu để tái sử dụng.
- `.gitignore:5-8` -- chính sách local environment file hiện hữu, cần giữ tương thích.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json` -- tạo root pnpm workspace, lệnh Turbo chuẩn cho dev/build/lint/typecheck/test và strict TypeScript -- thiết lập entrypoint tái lập được cho cả hai app.
- [x] `apps/api/package.json`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`, `apps/api/.env.example` -- scaffold NestJS 11 tối thiểu và Prisma 7 ở đúng ownership boundary, với cấu hình môi trường không secret -- tạo nền API sẵn sàng cho Story 1.2 mà không thêm domain/auth thực tế.
- [x] `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/index.html` -- scaffold React 19/Vite 8 strict với entrypoint web và dependency UI/PWA đã chốt -- cho phép chạy/build web độc lập trong workspace.
- [x] `apps/web/public/manifest.webmanifest`, `apps/web/public/icons/*`, `apps/web/vite.config.ts` -- khai báo PWA manifest, icon và service-worker integration chỉ phục vụ install/asset cache -- đáp ứng metadata install mà không tạo offline mutation behavior.
- [x] `apps/web/src/app/*`, `apps/web/src/components/*`, `apps/web/src/features/overview/*`, `apps/web/src/index.css` -- dựng routing và shell Tổng quan placeholder, sidebar/nav/account area, responsive sheet/collapsed variants, token design và focus style -- tạo bề mặt dùng được tại mọi breakpoint.
- [x] `apps/web/src/lib/network-status.ts`, `apps/web/src/components/offline-notice.tsx` -- theo dõi `online`/`offline` và dedupe toast theo từng outage -- bảo đảm đúng hành vi offline, không có request queue/retry.
- [x] `apps/web/src/**/*.test.*`, `apps/web/e2e/application-shell.spec.ts`, cấu hình test tương ứng -- thêm kiểm tra cấu trúc route/accessibility cơ bản, responsive navigation và một-offline-toast -- ngăn regression của baseline Story 1.1.
- [x] `README.md`, `.env.example` (nếu root config cần) -- ghi chính xác command setup/verify và environment placeholder không secret -- biến scaffold thành điểm bắt đầu vận hành được.

**Acceptance Criteria:**
- Given repository planning-only, when cài dependencies và chạy command workspace, then pnpm/Turborepo điều phối được web React 19/Vite 8 và API NestJS 11/Prisma 7 với TypeScript strict.
- Given source database cần được thêm sau này, when kiểm tra cấu trúc repository, then Prisma schema, migration và seed chỉ nằm dưới `apps/api/prisma` và không có package shared import app runtime.
- Given Admin mở route Tổng quan trên desktop, when shell render, then sidebar hiển thị logo/tên Ánh Hoa, đủ bảy mục nav, khu vực tài khoản Admin, selected state xanh nhạt và content gutter 32px theo token thiết kế.
- Given viewport đổi qua các breakpoint đặc tả, when Admin điều hướng, then full/collapsed/sidebar sheet hoạt động phù hợp và toàn bộ nav quản trị vẫn truy cập được ở mobile.
- Given route shell render, when kiểm tra bằng keyboard và screen reader, then chỉ có một `h1`, focus visible, action không phụ thuộc hover và mọi icon control có label/target đạt chuẩn.
- Given app đã build, when browser đọc PWA metadata, then manifest và icon định danh `Ánh Hoa Admin` với standalone behavior, không có forced install UI.

## Design Notes

Shell là contract thị giác và điều hướng chung, không phải dashboard dữ liệu. Dùng route placeholder cho các mục chưa triển khai để giữ cấu trúc IA mà không giả lập operational data; tránh coupling Story 1.1 với auth/data của Story 1.2 và 1.3.

## Verification

**Commands:**
- `pnpm install` -- expected: workspace resolve thành công, không cần secret.
- `pnpm lint` -- expected: lint toàn workspace pass.
- `pnpm typecheck` -- expected: strict TypeScript pass ở web và API.
- `pnpm test` -- expected: unit/component test pass.
- `pnpm build` -- expected: Turbo build pass và web sinh PWA assets/manifest.
- `pnpm --filter web exec playwright test` -- expected: shell responsive, accessibility baseline và offline dedupe test pass.

**Manual checks (if no CLI):**
- Mở web tại >=1280px, 1024px, 768px và 375px; xác nhận menu phù hợp breakpoint, target icon có thể focus và route title chỉ có một `h1`.
- DevTools Offline rồi phát sinh/re-render nhiều lần; xác nhận toast tiếng Việt chỉ hiện một lần, về Online rồi Offline xác nhận có thể hiện lại một lần.

## Suggested Review Order

**Workspace Foundation**

- Root scripts establish the repeatable monorepo build, lint, test, and typecheck entry points.
  [`package.json:1`](../../package.json#L1)

- Turbo declares task dependencies and cache outputs for both applications.
  [`turbo.json:1`](../../turbo.json#L1)

- API scaffold keeps Prisma ownership isolated under the API application.
  [`apps/api/prisma/schema.prisma:1`](../../apps/api/prisma/schema.prisma#L1)

**Application Shell**

- App composition joins routing, query provider, responsive navigation, and offline notice.
  [`apps/web/src/app/app.tsx:1`](../../apps/web/src/app/app.tsx#L1)

- The navigation sheet implements modal keyboard behavior and focus restoration.
  [`apps/web/src/components/navigation-sheet.tsx:1`](../../apps/web/src/components/navigation-sheet.tsx#L1)

- Global tokens define the cream, green, typography, focus, and responsive shell contract.
  [`apps/web/src/index.css:1`](../../apps/web/src/index.css#L1)

**PWA And Resilience**

- Vite PWA integration generates the asset-only service worker without forced installation UI.
  [`apps/web/vite.config.ts:1`](../../apps/web/vite.config.ts#L1)

- Offline events are deduplicated per outage without persisting or replaying mutations.
  [`apps/web/src/lib/network-status.ts:1`](../../apps/web/src/lib/network-status.ts#L1)

**Verification**

- E2E tests exercise responsive navigation, accessibility behavior, PWA metadata, and offline deduplication.
  [`apps/web/e2e/application-shell.spec.ts:1`](../../apps/web/e2e/application-shell.spec.ts#L1)

- Setup documentation records the exact package-manager requirement and all verification commands.
  [`README.md:1`](../../README.md#L1)

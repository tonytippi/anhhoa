# Epic 1 Context: Truy cập dashboard quản trị

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Establish the secure, responsive operational foundation for Anh Hoa Admin: authorized staff can sign in with Google, the application reliably establishes their authenticated identity before exposing school data, and they can use a consistent dashboard shell on desktop or mobile. This provides the trusted entry point and application structure required for all later administration and invoicing work.

## Stories

- Story 1.1: Khởi tạo workspace và application shell
- Story 1.2: Đăng nhập Google theo danh sách Admin cho phép
- Story 1.3: Truy cập workspace được bảo vệ

## Requirements & Constraints

- Only authenticated Admins whose normalized Google email appears in `ADMIN_EMAILS` may access operational data or routes. Reject unauthorized emails without issuing a valid session or revealing the allowlist.
- Create an Admin identity on first successful sign-in and refresh its email, display name, and avatar from Google on later sign-ins so later audit records have a consistent identity.
- The web client must establish identity from the authenticated API response before rendering operational data; unauthenticated or expired sessions must lead to the Google sign-in surface with a brief, specific access or re-login message.
- All operational mutations require server-side DTO validation. Unsafe credentialed requests must pass origin validation and double-submit CSRF checks; API errors use `{ error: { code, message, fieldErrors? } }`.
- The application is a responsive installable PWA named `Ánh Hoa Admin`, with icons and standalone installed behavior. Use the browser-native installation flow; do not force an install prompt or queue/replay offline mutations. Show the offline warning once per outage.
- Every route has exactly one `h1`; visible keyboard focus, labeled icon controls with at least 40x40px targets, and no hover-only action are required. Meet WCAG 2.2 AA and ensure operation surfaces remain accessible at all breakpoints.

## Technical Decisions

- Use a pnpm workspace orchestrated by Turborepo. `apps/web` contains the React 19/Vite 8 PWA and `apps/api` contains NestJS 11, Prisma 7, and server rules; shared packages, if needed, contain only pure TypeScript and cannot import either app.
- Keep Prisma schema, committed migrations, and explicit development/test seeds exclusively in `apps/api/prisma`. Use strict TypeScript and environment-driven API configuration validated at bootstrap; production-like environments apply migrations rather than `prisma db push`.
- Maintain a layered modular REST boundary: web communicates only with credentialed REST JSON through React Query, treats API responses as authoritative, and never accesses database code. API controllers delegate to module services; services do not call controllers from other domains.
- Implement Google OAuth in the API `auth` and `admins` modules. Limit credentialed CORS to `WEB_ORIGIN` and OAuth callbacks to configured allowlisted redirect URLs. Protect operational routes by default with an auth guard.
- Issue the authenticated session as a `Secure`, `httpOnly`, `SameSite=Lax` JWT cookie. Web calls credentialed `GET /auth/me`; it must not read, store, refresh, or persist access tokens in JavaScript. React Query keys begin with the REST resource name.
- REST uses camelCase JSON, UUID string identifiers, UTC ISO 8601 timestamps, `{ data, meta }` for list responses, and `{ data }` for action responses. The auth surface lives under `/auth`.
- Cover authentication and authorization behavior with API tests appropriate to the module; preserve the architecture verification boundary of API unit tests for pure rules, PostgreSQL-backed integration tests for persisted behavior, and Playwright for primary web flows as those surfaces become available.

## UX & Interaction Patterns

- Build a calm, desktop-first operations shell with a fixed desktop sidebar containing the small Ánh Hoa sunflower logo/name, navigation for Tổng quan, Hóa đơn, Học sinh, Lớp, Mẫu hóa đơn, Tài khoản nhận tiền, Báo cáo, and an Admin account area. The selected item uses a soft green treatment; content uses a 32px gutter.
- Apply the established visual system: light cream application background, white thin-bordered cards without heavy shadows, green for primary actions and focus, Inter for body/data, and Clash Grotesk for page and large card titles. Use Tailwind CSS v4, tw-animate-css, and shadcn/ui on Base UI.
- At `>= 1280px`, show the full sidebar; from `1024px` through `1279px`, it may collapse; from `768px` through `1023px`, use a sidebar sheet; below `768px`, preserve access to administration even though reporting/overview is the preferred mobile entry. Use near-full-screen modals and horizontally scrollable tables with a pinned identifying column where later data tables require it.
- The unauthenticated entry surface is Google sign-in. Keep language concise, direct, and operational; distinguish an unauthorized email from an expired session without disclosing operational data.
- Use structural skeletons for loading list/report surfaces, preserve user input on errors, place errors near the failed action with a short toast, and use explicit saves rather than autosave for business forms.

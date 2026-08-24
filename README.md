# Kindergarten Invoice Management

## Khởi chạy workspace

Yêu cầu Node.js 22 LTS và pnpm 11.9.0 (theo trường `packageManager` ở root).

```bash
pnpm install
pnpm dev
```

Web chạy tại `http://localhost:5173`; API tối thiểu chạy nội bộ tại `http://localhost:3000`. Browser chỉ gọi API relative qua `http://localhost:5173/api`; Vite development proxy `/api` tới API và bỏ prefix này trước khi forward.

Các lệnh kiểm tra workspace:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter web exec playwright test
```

## Chạy Parent PWA local

Parent PWA là ứng dụng riêng tại `apps/parent-web`. Sau khi đã chạy `pnpm install`, khởi động ứng dụng bằng:

```bash
pnpm --filter parent-web dev
```

Chạy test Vitest của riêng Parent PWA tại môi trường local bằng:

```bash
pnpm --filter parent-web test
```

Lệnh này chạy các test trong `apps/parent-web` với cấu hình local `vitest.config.ts`; không cần khởi động API cho các test component hiện có.

API tự động nạp `apps/api/.env` khi khởi động; repository chỉ giữ biến môi trường mẫu trong `apps/api/.env.example`, không thêm giá trị thật. Để chạy API, sao chép file này thành `apps/api/.env`, đặt các biến OAuth Google, `JWT_SECRET` (ít nhất 32 ký tự), `ADMIN_EMAILS`, `WEB_ORIGIN`, callback và redirect URLs đã đăng ký. `OAUTH_REDIRECT_URLS` là allowlist URL sau đăng nhập, phân tách bằng dấu phẩy; `OAUTH_DENIED_REDIRECT_URL` phải là một URL trong allowlist này. Khi phát triển local, đăng ký chính xác `http://localhost:5173/api/auth/google/callback` trong Google Console và đặt URL này cho `GOOGLE_CALLBACK_URL`; Vite chuyển tiếp callback đến Nest tại `/auth/google/callback`. `WEB_ORIGIN` và public origin của `GOOGLE_CALLBACK_URL` phải cùng schemeful site: khác port hoặc sibling subdomain được phép, còn cross-site hoặc khác `http`/`https` sẽ bị từ chối khi API khởi động. Web mặc định dùng `VITE_API_URL=/api`; chỉ đặt override này khi có một public API base path khác.

## Font assets

Inter và Be Vietnam Pro được bundle từ các gói Fontsource tương ứng, đều theo SIL Open Font License 1.1. Hai file WOFF2 cục bộ chỉ chứa subset tiếng Việt và được phục vụ cùng origin, không dùng font CDN.

## Prisma và production API

Prisma chỉ thuộc `apps/api/prisma`. `prisma:generate` chỉ đọc schema nên chạy được khi chưa cấu hình database; các lệnh truy cập datasource như `prisma:seed` vẫn yêu cầu `DATABASE_URL` cục bộ hợp lệ.

```bash
pnpm --filter api prisma:generate
pnpm --filter api exec prisma migrate deploy
pnpm --filter api prisma:seed
pnpm --filter api build
pnpm --filter api start
```

`PORT` là tùy chọn và mặc định là `3000`; nếu được đặt, phải là số nguyên từ `1` đến `65535`. API fail-fast khi thiếu hoặc sai cấu hình auth/CORS. Session chỉ được cấp trong cookie `Secure`, `httpOnly`, `SameSite=Lax`; client cần lấy CSRF token tại `GET /auth/csrf` và gửi lại qua `X-CSRF-Token` cho mutation đã có session. Khi triển khai web PWA, hosting phải rewrite mọi SPA route (ví dụ `/bao-cao`) về `index.html`; Vite source không thể thay thế cấu hình rewrite của hosting.

## Docker Compose test deployment

Compose test deployment gồm PostgreSQL 16 trên named volume, migration one-shot, API NestJS và Nginx phục vụ PWA. Chỉ Nginx được map ra loopback của host; PostgreSQL và API chỉ nằm trên Docker network. Nginx rewrite SPA route về `index.html` và proxy `/api` tới API, vì vậy public web và API luôn cùng một HTTPS origin. Đặt `DATABASE_URL` trong `.env.production` dùng hostname Docker nội bộ `postgres` (ví dụ `postgresql://user:password@postgres:5432/database?schema=public`), không dùng `localhost`.

```bash
cp .env.production.example .env.production
# Điền giá trị thật trong .env.production, không commit file này.
docker compose --env-file .env.production config
docker compose --env-file .env.production up --build -d
docker compose --env-file .env.production ps
```

`migrate` chạy `prisma migrate deploy` từ migrations đã commit trước khi API được khởi động. Lần chạy lại an toàn; nếu migration lỗi, API không khởi động. Không dùng `prisma db push` cho deployment. Các giá trị `POSTGRES_DB`, `POSTGRES_USER` và `POSTGRES_PASSWORD` chỉ được dùng khi khởi tạo volume lần đầu; muốn đổi chúng phải tạo database role thủ công hoặc chủ động xóa volume. Dừng stack giữ nguyên database trong named volume `postgres-data`; chỉ chạy `docker compose --env-file .env.production down -v` khi chủ động muốn xóa toàn bộ dữ liệu test.

Tạo Cloudflare Tunnel bên ngoài Compose tới `http://localhost:<WEB_PORT>` (mặc định `8080`). Cấu hình `WEB_ORIGIN` là public HTTPS origin, ví dụ `https://admin.example.com`; đặt `GOOGLE_CALLBACK_URL` là `https://admin.example.com/api/auth/google/callback`; và đăng ký callback đó trong Google OAuth. `OAUTH_REDIRECT_URLS` cùng `OAUTH_DENIED_REDIRECT_URL` phải dùng public origin này. Không thêm container Tunnel, TLS termination, database port hoặc secrets vào Compose/image.

## Yêu cầu
Tôi muốn làm hệ thống quản lý hóa đơn cho trường mầm non. Hệ thống phải thật đơn giản.
- chỉ có admin login, không có giáo viên, không có phụ huynh.
- chỉ có giao diện dashboard admin: 
- quản lý danh sách học sinh: tên, biệt danh, lớp.
- quản lý danh sách lớp (không cần quản lý giáo viên).
- hóa hóa đơn cho mỗi học sinh mỗi tháng.
- hóa đơn gồm nhiều dòng: học phí, tiền ăn, các tiền khác.
- học phí được điền tự động từ lớp.
- các dòng khác được admin thêm thủ công bằng tay.
- khi tạo hóa đơn, admin chọn 1 trong 2 dạng thanh toán: chuyển khoản hoặc tiền mặt.
- nếu chọn chuyển khoản, thì chọn một trong các tài khoản nhận tiền được config trước.
- khi xác nhận, nếu là chuyển khoản thì sinh ra mã QR để phụ huynh chuyển khoản, gồm số tiền, và nội dung chuyển khoản. Nội dung chuyển khoản là Tên + biệt danh (nếu có) + lớp + " chuyển tiền".
- hóa đơn được tạo mỗi tháng. Hóa đơn được tạo ra có thể chỉnh sửa. Nếu admin xác nhận đã nhận được tiền thì chỉ xem.
- mỗi tháng có report: tổng thu, về tài khoản của ai bao nhiêu, tiền mặt bao nhiêu.

## Ghi chú:
- rất nhiều phần trong đây đã đươc làm ở dự án ../grapeseed, như phần lập hóa đơn, sinh ra mã QR.
- login bằng Google. So sánh với biến ADMIN_EMAIL trong .env
- admin dashboard nên dùng khung đơn giản thế này:
```
 Tailwind CSS v4 + tw-animate-css
- shadcn/ui (Button, Badge, các CSS tokens)
- Base UI là primitive nền cho shadcn
- Font chính trong admin: Inter
- Branding/heading có Clash Grotesk
```

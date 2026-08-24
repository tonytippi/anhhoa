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

Vite development server chạy cố định tại `http://localhost:5174`. Trong `apps/api/.env` local, đặt `PARENT_WEB_ORIGIN=http://localhost:5174` để API chấp nhận origin này. Nếu port `5174` đang được sử dụng, lệnh khởi động sẽ báo lỗi thay vì tự đổi port; hãy giải phóng port đó để giữ origin API nhất quán.

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

Compose test deployment gồm PostgreSQL 16 trên named volume, migration one-shot, API NestJS va hai Nginx gateway PWA doc lap: Admin va Parent. Chi hai gateway duoc map ra loopback cua host; PostgreSQL va API chi nam tren Docker network. Moi gateway rewrite SPA route ve `index.html` va proxy relative `/api` toi API, vi vay PWA va API luon dung cung public HTTPS origin. Dat `DATABASE_URL` trong `.env.production` dung hostname Docker noi bo `postgres` (vi du `postgresql://user:password@postgres:5432/database?schema=public`), khong dung `localhost`.

```bash
cp .env.production.example .env.production
# Điền giá trị thật trong .env.production, không commit file này.
docker compose --env-file .env.production config
docker compose --env-file .env.production up --build -d
docker compose --env-file .env.production ps
```

`migrate` chạy `prisma migrate deploy` từ migrations đã commit trước khi API được khởi động. Lần chạy lại an toàn; nếu migration lỗi, API không khởi động. Không dùng `prisma db push` cho deployment. Các giá trị `POSTGRES_DB`, `POSTGRES_USER` và `POSTGRES_PASSWORD` chỉ được dùng khi khởi tạo volume lần đầu; muốn đổi chúng phải tạo database role thủ công hoặc chủ động xóa volume. Dừng stack giữ nguyên database trong named volume `postgres-data`; chỉ chạy `docker compose --env-file .env.production down -v` khi chủ động muốn xóa toàn bộ dữ liệu test.

Tao hai Cloudflare Tunnel ben ngoai Compose: Admin toi `http://localhost:<WEB_PORT>` (mac dinh `8080`) va Parent toi `http://localhost:<PARENT_WEB_PORT>` (mac dinh `8081`). Cau hinh `WEB_ORIGIN` la public HTTPS origin Admin, vi du `https://admin.example.com`; dat `GOOGLE_CALLBACK_URL` la `https://admin.example.com/api/auth/google/callback`. Cau hinh `PARENT_WEB_ORIGIN` la public HTTPS origin Parent rieng, vi du `https://parent.example.com`; dat `PARENT_GOOGLE_CALLBACK_URL` la `https://parent.example.com/api/parent/auth/google/callback`. Dang ky ca hai callback trong Google OAuth. Moi cap `*_OAUTH_REDIRECT_URLS` va `*_OAUTH_DENIED_REDIRECT_URL` phai dung origin tuong ung; Parent phai dung `PARENT_SESSION_COOKIE_NAME` va `PARENT_CSRF_COOKIE_NAME` khac cookie Admin. Kiem tra gateway Parent bang `curl -i http://127.0.0.1:${PARENT_WEB_PORT:-8081}/api/parent/auth/csrf`. Khong them container Tunnel, TLS termination, database port hoac secrets vao Compose/image.

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

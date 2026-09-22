# PassionEdu

## Khởi chạy workspace

Yêu cầu Node.js 24.21.0 LTS và pnpm 11.9.0 (theo trường `packageManager` ở root). Dùng `nvm use` để nạp version được ghim trong `.nvmrc`.

```bash
pnpm install
pnpm dev
```

`pnpm dev` khởi động toàn workspace, không phải topology tối thiểu để test Finance Admin MVP. Admin chạy tại `http://localhost:5173`, Ops chạy tại `http://localhost:5176`, và API tại `http://localhost:3000`; Admin/Ops local gọi trực tiếp API với `VITE_API_URL=http://localhost:3000`. Hai Vite app này không khai báo development proxy `/api`.

Để test Release 1 Finance Admin MVP trên database local mới, xem [runbook local Finance Admin MVP](docs/local-finance-admin-mvp.md). Runbook chỉ yêu cầu PostgreSQL, API, Admin và Ops; Teacher/Parent không cần chạy nhưng API vẫn cần đầy đủ cấu hình audience của bốn portal.

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

API tự động nạp `apps/api/.env`; repository chỉ giữ `apps/api/.env.example`, không thêm giá trị thật. Để chạy local, sao chép file này thành `apps/api/.env` và đặt OAuth Google, `SESSION_SECRET` (ít nhất 32 ký tự), `SESSION_TTL_SECONDS`, `SUPERADMIN_EMAIL`, và origin/callback/redirect/cookie của đầy đủ bốn audience App, Teacher, Parent, Ops. API fail-fast nếu thiếu hoặc sai cấu hình auth/CORS. Xem [runbook local Finance Admin MVP](docs/local-finance-admin-mvp.md) cho callback OAuth và lệnh khởi động đúng theo Finance MVP.

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

`PORT` là tùy chọn và mặc định là `3000`; nếu được đặt, phải là số nguyên từ `1` đến `65535`. API fail-fast khi thiếu hoặc sai cấu hình auth/CORS. `SESSION_SECRET` phải ổn định giữa deploy/restart và `SESSION_TTL_SECONDS` xác định thời hạn session. Session audience `app` dùng cookie `APP_SESSION_COOKIE_NAME` và CSRF cookie `APP_CSRF_COOKIE_NAME`; mutation gửi `X-CSRF-Token`. Khi triển khai web PWA, hosting phải rewrite mọi SPA route (ví dụ `/bao-cao`) về `index.html`; Vite source không thể thay thế cấu hình rewrite của hosting.

`pnpm --filter api prisma:seed` chi phuc vu development fixture va chi tao School mau. No khong provision initial School owner, membership/capability, dang nhap OAuth, hay du lieu Finance; dung Ops voi `SUPERADMIN_EMAIL` theo runbook de bootstrap test Finance.

## Pilot VPS deployment

Pilot dùng Docker Compose tại `deploy/compose/compose.yaml`: PostgreSQL 16 lưu trên named volume `postgres-data`, một job migration one-shot, API NestJS, bốn portal độc lập và Caddy làm TLS reverse proxy. Caddy phục vụ năm host cố định: `app.passionedu.org`, `teacher.passionedu.org`, `parent.passionedu.org`, `ops.passionedu.org` và `api.passionedu.org`.

```bash
cp deploy/compose/.env.example /path/outside/repository/passionedu.env
# Điền giá trị thật vào file ngoài Git, gồm OAuth, SESSION_SECRET, database va TLS.
docker compose --env-file /path/outside/repository/passionedu.env -f deploy/compose/compose.yaml config
docker compose --env-file /path/outside/repository/passionedu.env -f deploy/compose/compose.yaml up --build -d
docker compose --env-file /path/outside/repository/passionedu.env -f deploy/compose/compose.yaml ps
```

Mount thư mục chứng chỉ TLS của VPS qua `TLS_CERT_DIR`; `TLS_CERT_FILE` và `TLS_KEY_FILE` là các đường dẫn bên trong mount `/certs`. Đăng ký bốn callback OAuth API và redirect URL tương ứng với từng portal trong file env. API fail-fast nếu thiếu audience origin, callback, redirect, cookie, OAuth, session hoặc bootstrap configuration.

`migrate` chạy `prisma migrate deploy` trước API. Không dùng `prisma db push`, không sửa migration đã deploy và không rollback destructive. Dừng stack giữ `postgres-data`; chỉ dùng `down -v` khi chủ động xóa toàn bộ dữ liệu pilot. Xem hướng dẫn vận hành ngắn tại `deploy/compose/README.md`.

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

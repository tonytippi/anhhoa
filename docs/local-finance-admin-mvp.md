# Runbook local: Finance Admin MVP

Runbook nay dung de kiem thu Release 1 Finance Admin MVP tren database PostgreSQL local moi. Chi chay API, Ops va Admin; khong dung `pnpm dev` vi lenh do khoi dong toan workspace, bao gom cac portal khong can cho luong nay.

## Pham vi

Topology toi thieu:

| Thanh phan | URL/port | Can cau hinh | Can chay |
| --- | --- | --- | --- |
| PostgreSQL | theo `DATABASE_URL` | Co | Co |
| API | `http://localhost:3000` | Co | Co |
| Admin | `http://localhost:5173` | Co | Co |
| Ops | `http://localhost:5176` | Co | Co |
| Teacher | `http://localhost:5175` | Co | Khong |
| Parent | `http://localhost:5174` | Co | Khong |

API fail-fast khi thieu cau hinh cho bat ky audience nao trong bon audience `app`, `teacher`, `parent`, `ops`. Do do Teacher va Parent khong can chay trong manual Finance MVP, nhung cac bien moi truong cua chung van phai co trong `apps/api/.env`.

Release test nay bao gom provision School, danh bo toi thieu, cau hinh tai chinh, mo dot thu, tao hoa don nhap va phat hanh hoa don. Khong bao gom Receipt, settlement, refund, ledger report, hay hanh vi Teacher/Parent.

## Dieu kien

- Node.js `24.21.0` va pnpm `11.9.0`. Chay `nvm use` neu dung nvm.
- PostgreSQL local dang chay va co database rong ma nguoi dung local co quyen migrate. Khong dung Compose pilot/production cho manual local test nay.
- Google OAuth client local. Cac secret chi nam trong `apps/api/.env` local, khong commit file nay hay thong tin OAuth vao repository.
- Can hai tai khoan Google khac nhau: tai khoan Ops co email dung bang `SUPERADMIN_EMAIL`; tai khoan School Admin la email owner khi provision School va **phai khac** `SUPERADMIN_EMAIL`.

Cai dependencies tu root:

```bash
pnpm install
```

## Cau hinh API local

Sao chep template, sau do dien gia tri local that vao file khong duoc commit:

```bash
cp apps/api/.env.example apps/api/.env
```

`apps/api/.env` phai co `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` it nhat 32 ky tu va `SUPERADMIN_EMAIL` hop le. Giu `PORT=3000` de dung topology trong runbook.

Khai bao day du bon audience theo template. Cac gia tri local can dung la:

```dotenv
WEB_ORIGIN=http://localhost:5173
TEACHER_WEB_ORIGIN=http://localhost:5175
OPS_WEB_ORIGIN=http://localhost:5176
PARENT_WEB_ORIGIN=http://localhost:5174

APP_GOOGLE_CALLBACK_URL=http://localhost:3000/api/app/auth/google/callback
APP_OAUTH_REDIRECT_URLS=http://localhost:5173
APP_OAUTH_DENIED_REDIRECT_URL=http://localhost:5173
APP_SESSION_COOKIE_NAME=app_session
APP_CSRF_COOKIE_NAME=app_csrf

TEACHER_GOOGLE_CALLBACK_URL=http://localhost:3000/api/teacher/auth/google/callback
TEACHER_OAUTH_REDIRECT_URLS=http://localhost:5175
TEACHER_OAUTH_DENIED_REDIRECT_URL=http://localhost:5175
TEACHER_SESSION_COOKIE_NAME=teacher_session
TEACHER_CSRF_COOKIE_NAME=teacher_csrf

OPS_GOOGLE_CALLBACK_URL=http://localhost:3000/api/ops/auth/google/callback
OPS_OAUTH_REDIRECT_URLS=http://localhost:5176
OPS_OAUTH_DENIED_REDIRECT_URL=http://localhost:5176
OPS_SESSION_COOKIE_NAME=ops_session
OPS_CSRF_COOKIE_NAME=ops_csrf

PARENT_GOOGLE_CALLBACK_URL=http://localhost:3000/api/parent/auth/google/callback
PARENT_OAUTH_REDIRECT_URLS=http://localhost:5174
PARENT_OAUTH_DENIED_REDIRECT_URL=http://localhost:5174
PARENT_SESSION_COOKIE_NAME=parent_session
PARENT_CSRF_COOKIE_NAME=parent_csrf
```

Dat `SESSION_TTL_SECONDS` va `OAUTH_STATE_TTL_SECONDS` thanh so nguyen duong; template cung cap gia tri local hop le. Cookie name cua cac audience phai khac nhau. `SUPERADMIN_EMAIL` la email Google duy nhat co the bootstrap Platform Operator cho Ops.

Dang ky hai redirect URI sau trong Google OAuth client cho happy path nay, va dat chung trong cac bien callback tuong ung:

```text
http://localhost:3000/api/app/auth/google/callback
http://localhost:3000/api/ops/auth/google/callback
```

Khong can dang ky hay chay Teacher/Parent de test Finance MVP. Tuy vay, khong xoa hay bo trong bien cau hinh Teacher/Parent: API van validate chung khi khoi dong.

## Migrate va khoi dong

Ap dung migrations vao database local rong:

```bash
pnpm --filter @passionedu/api prisma:migrate:deploy
```

Mo ba terminal rieng tu root workspace. Ca hai Vite app phai nhan URL API tuyet doi; khong co Vite development proxy `/api`.

Terminal 1, API:

```bash
pnpm --filter @passionedu/api dev
```

Cho API lang nghe tai `http://localhost:3000`. Neu API khong khoi dong, kiem tra `apps/api/.env`: database, OAuth, `SESSION_SECRET`, `SUPERADMIN_EMAIL`, va toan bo bien audience phai hop le.

Terminal 2, Ops:

```bash
VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/ops-web dev -- --port 5176
```

Mo `http://localhost:5176` chi sau khi process Ops da chay.

Terminal 3, Admin:

```bash
VITE_API_URL=http://localhost:3000 pnpm --filter @passionedu/admin-web dev -- --port 5173
```

Mo `http://localhost:5173`. Neu mot port dang duoc dung, dung process dang chiem port thay vi doi port, vi origin OAuth/API trong runbook nay la co dinh.

## Bootstrap School qua Ops

1. Mo Ops tai `http://localhost:5176` va dang nhap Google bang chinh email `SUPERADMIN_EMAIL`.
2. Chon `Khoi tao truong`.
3. Nhap ten truong, ma truong dang lowercase kebab-case, tien to ma hoc sinh uppercase, va email owner.
4. Email owner phai la email Google School Admin khac email Ops. Ops khong the tu lam initial owner cua School.
5. Xac nhan tao School va doi soat School xuat hien voi trang thai dang hoat dong.
6. Dang xuat Ops. Mo Admin tai `http://localhost:5173` va dang nhap bang email owner vua provision.
7. Chon School trong `Chon truong`. Initial owner co quyen truy cap danh bo, cau hinh va Finance da duoc cap khi provision.

Khong dung School tu `prisma:seed` de thay the luong nay. Seed chi tao School mau; no khong tao initial owner, dang nhap, membership/capability dung cho bootstrap, hay du lieu Finance.

## Thiet lap du lieu Finance toi thieu

Trong Admin cua School vua provision, hoan thanh theo thu tu sau. Chon ngay hieu luc va thang thu nam trong khoang nam hoc, va dung ngay thuc te phu hop voi database test.

1. Mo `Danh bo`.
2. Trong `Tao nam hoc`, tao nam hoc co ten, ngay bat dau va ngay ket thuc.
3. Chon nam hoc vua tao, sau do dung `Them lop` de tao it nhat mot lop dang hoat dong.
4. Trong form hoc sinh, tao it nhat mot hoc sinh, chon lop, dat lifecycle `ENROLLED`, va dat `Ngay hieu luc` khong muon hon ngay dau cua thang thu. Day la enrollment can thiet de hoc sinh du dieu kien tao hoa don.
5. Mo `Cau hinh truong`, phan `Tai chinh va thanh toan`.
6. Tao `FinancePolicy` bang `Tao phien ban chinh sach`: ngay hieu luc, so ngay han thanh toan, nhan thue, dao nguoc va ly do. Policy can co hieu luc tai ngay phat hanh hoa don.
7. Trong cung phan nay, them mot `Tai khoan nhan tien` dang hoat dong. Tai khoan nay duoc chon luc phat hanh hoa don.
8. Mo `Finance`.
9. Trong `Nhom khoan thu`, them mot nhom dang ap dung.
10. Trong `Khoan thu`, chon nhom va them it nhat mot khoan thu voi ten, don vi va don gia VND mac dinh.

## Tao va phat hanh hoa don

1. Trong `Finance`, o `Mo dot thu thang`, chon nam hoc va thang thu, sau do chon `Mo hoac vao dot thu`.
2. Trong dot `DRAFT`, chon hoc sinh, chon `Luu danh sach da chon`, roi chon `Xem truoc tu may chu`.
3. Kiem tra hoc sinh nam trong danh sach du dieu kien. Neu bi bo qua, sua roster/effective date theo ly do ma may chu tra ve, roi lap lai preview.
4. Chon `Xac nhan preview va chuyen READY`, sau do chon `Tao hoa don nhap` va xac nhan thang thu trong dialog.
5. Trong ket qua tao hoa don hoac danh sach hoa don cua dot, chon `Ra soat hoa don` cho hoc sinh.
6. Hoa don bat dau o trang thai `DRAFT`. Them it nhat mot line bang khoan thu da tao; dieu chinh quantity/don gia theo giao dien neu can. Tong phai lon hon 0.
7. Chon `Phat hanh hoa don`, chon tai khoan nhan dang hoat dong, nhap dung ten hoc sinh de xac nhan, roi xac nhan phat hanh.
8. Xac nhan hoa don chuyen sang `ISSUED` va co thong tin han thanh toan, tai khoan nhan, noi dung chuyen khoan va policy snapshot.

Neu mot mutation timeout hoac ket noi bi gian doan, khong gui lai ngay. Portal giu Operation ID va tu doi soat. Doi ket qua doi soat truoc khi thu lai thao tac.

## Kiem tra ket thuc

- API dang chay tai port `3000`, Ops tai `5176`, Admin tai `5173`; ca hai portal goi truc tiep `http://localhost:3000` qua `VITE_API_URL`.
- Dang nhap Ops chi thanh cong cho `SUPERADMIN_EMAIL`; School owner dang nhap qua Admin, khong qua Ops.
- School co nam hoc, lop, hoc sinh `ENROLLED`, FinancePolicy co hieu luc, tai khoan nhan dang hoat dong, nhom/khoan thu, CollectionRun, hoa don `DRAFT` va hoa don `ISSUED` sau khi hoan thanh happy path.
- Teacher va Parent khong chay trong toan bo qua trinh.

Co the chay cac kiem tra khong can database test rieng sau khi thay doi tai lieu:

```bash
pnpm --filter @passionedu/admin-web typecheck
pnpm --filter @passionedu/ops-web typecheck
git diff --check
```

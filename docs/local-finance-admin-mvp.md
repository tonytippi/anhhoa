# Runbook cục bộ: Finance Admin MVP

Runbook này dùng để kiểm thử Release 1 Finance Admin MVP trên database PostgreSQL cục bộ mới. Chỉ chạy API, Ops và Admin; không dùng `pnpm dev` vì lệnh đó khởi động toàn workspace, bao gồm các portal không cần cho luồng này.

## Phạm vi

Topology tối thiểu:

| Thành phần | URL/port | Cần cấu hình | Cần chạy |
| --- | --- | --- | --- |
| PostgreSQL | theo `DATABASE_URL` | Có | Có |
| API | `http://localhost:3000` | Có | Có |
| Admin | `http://localhost:5173` | Có | Có |
| Ops | `http://localhost:5176` | Có | Có |
| Teacher | `http://localhost:5175` | Có | Không |
| Parent | `http://localhost:5174` | Có | Không |

API fail-fast khi thiếu cấu hình cho bất kỳ audience nào trong bốn audience `app`, `teacher`, `parent`, `ops`. Do đó Teacher và Parent không cần chạy trong manual Finance MVP, nhưng các biến môi trường của chúng vẫn phải có trong `apps/api/.env`.

Release test này bao gồm provision School, danh bạ tối thiểu, cấu hình tài chính, mở đợt thu, tạo hóa đơn nháp và phát hành hóa đơn. Không bao gồm Receipt, settlement, refund, ledger report, hay hành vi Teacher/Parent.

## Điều kiện

- Node.js `24.21.0` và pnpm `11.9.0`. Chạy `nvm use` nếu dùng nvm.
- PostgreSQL cục bộ đang chạy và có database rỗng mà người dùng cục bộ có quyền migrate. Không dùng Compose pilot/production cho manual local test này.
- Google OAuth client cục bộ. Các secret chỉ nằm trong `apps/api/.env` cục bộ, không commit file này hay thông tin OAuth vào repository.
- Cần hai tài khoản Google khác nhau: tài khoản Ops có email đúng bằng `SUPERADMIN_EMAIL`; tài khoản School Admin là email owner khi provision School và **phải khác** `SUPERADMIN_EMAIL`.

Cài dependencies từ root:

```bash
pnpm install
```

## Cấu hình API cục bộ

Sao chép template, sau đó điền giá trị cục bộ thật vào file không được commit:

```bash
cp apps/api/.env.example apps/api/.env
```

`apps/api/.env` phải có `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` ít nhất 32 ký tự và `SUPERADMIN_EMAIL` hợp lệ. Giữ `PORT=3000` để đúng topology trong runbook.

Khai báo đầy đủ bốn audience theo template. Các giá trị cục bộ cần dùng là:

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

Đặt `SESSION_TTL_SECONDS` và `OAUTH_STATE_TTL_SECONDS` thành số nguyên dương; template cung cấp giá trị cục bộ hợp lệ. Cookie name của các audience phải khác nhau. `SUPERADMIN_EMAIL` là email Google duy nhất có thể bootstrap Platform Operator cho Ops.

Đăng ký hai redirect URI sau trong Google OAuth client cho happy path này, và đặt chúng trong các biến callback tương ứng:

```text
http://localhost:3000/api/app/auth/google/callback
http://localhost:3000/api/ops/auth/google/callback
```

Không cần đăng ký hay chạy Teacher/Parent để test Finance MVP. Tuy vậy, không xóa hay bỏ trống biến cấu hình Teacher/Parent: API vẫn validate chúng khi khởi động.

## Migrate và khởi động

Áp dụng migrations vào database cục bộ rỗng:

```bash
pnpm --filter @passionedu/api prisma:migrate:deploy
```

Mở ba terminal riêng từ root workspace. Ops và Admin có mặc định development tương ứng là `5176`/`5173` và gọi trực tiếp API `http://localhost:3000`; không có Vite development proxy `/api`.

Terminal 1, API:

```bash
pnpm --filter @passionedu/api dev
```

Chờ API lắng nghe tại `http://localhost:3000`. Nếu API không khởi động, kiểm tra `apps/api/.env`: database, OAuth, `SESSION_SECRET`, `SUPERADMIN_EMAIL`, và toàn bộ biến audience phải hợp lệ.

Terminal 2, Ops:

```bash
pnpm --filter @passionedu/ops-web dev
```

Mở `http://localhost:5176` chỉ sau khi process Ops đã chạy. Config Vite đặt sẵn `5176`, `--strictPort` và `VITE_API_URL=http://localhost:3000` cho development. Nếu `5176` đang bị chiếm, Vite dừng ngay; dừng process đang chiếm port thay vì đổi origin OAuth/API.

Terminal 3, Admin:

```bash
pnpm --filter @passionedu/admin-web dev
```

Mở `http://localhost:5173`. Nếu một port đang được dùng, dừng process đang chiếm port thay vì đổi port, vì origin OAuth/API trong runbook này là cố định.

## Bootstrap School qua Ops

1. Mở Ops tại `http://localhost:5176` và đăng nhập Google bằng chính email `SUPERADMIN_EMAIL`.
2. Chọn `Khởi tạo trường`.
3. Nhập tên trường, mã trường dạng lowercase kebab-case, tiền tố mã học sinh uppercase, và email owner.
4. Email owner phải là email Google School Admin khác email Ops. Ops không thể tự làm initial owner của School.
5. Xác nhận tạo School và đối soát School xuất hiện với trạng thái đang hoạt động.
6. Đăng xuất Ops. Mở Admin tại `http://localhost:5173` và đăng nhập bằng email owner vừa provision.
7. Chọn School trong `Chọn trường`. Initial owner có quyền truy cập danh bạ, cấu hình và Finance đã được cấp khi provision.

Không dùng School từ `prisma:seed` để thay thế luồng này. Seed chỉ tạo School mẫu; nó không tạo initial owner, đăng nhập, membership/capability đúng cho bootstrap, hay dữ liệu Finance.

## Thiết lập dữ liệu Finance tối thiểu

Trong Admin của School vừa provision, hoàn thành theo thứ tự sau. Chọn ngày hiệu lực và tháng thu năm trong khoảng năm học, và dùng ngày thực tế phù hợp với database test.

1. Mở `Danh bạ`.
2. Trong `Tạo năm học`, tạo năm học có tên, ngày bắt đầu và ngày kết thúc.
3. Chọn năm học vừa tạo, sau đó dùng `Thêm lớp` để tạo ít nhất một lớp đang hoạt động.
4. Trong form học sinh, tạo ít nhất một học sinh, chọn lớp, đặt lifecycle `ENROLLED`, và đặt `Ngày hiệu lực` không muộn hơn ngày đầu của tháng thu. Đây là enrollment cần thiết để học sinh đủ điều kiện tạo hóa đơn.
5. Mở `Cấu hình trường`, phần `Tài chính và thanh toán`.
6. Tạo `FinancePolicy` bằng `Tạo phiên bản chính sách`: ngày hiệu lực, số ngày hạn thanh toán, nhãn thuế, đảo ngược và lý do. Policy cần có hiệu lực tại ngày phát hành hóa đơn.
7. Trong cùng phần này, thêm một `Tài khoản nhận tiền` đang hoạt động. Tài khoản này được chọn lúc phát hành hóa đơn.
8. Mở `Finance`.
9. Trong `Nhóm khoản thu`, thêm một nhóm đang áp dụng.
10. Trong `Khoản thu`, chọn nhóm và thêm ít nhất một khoản thu với tên, đơn vị và đơn giá VND mặc định.

## Tạo và phát hành hóa đơn

1. Trong `Finance`, ở `Mở đợt thu tháng`, chọn năm học và tháng thu, sau đó chọn `Mở hoặc vào đợt thu`.
2. Trong đợt `DRAFT`, chọn học sinh, chọn `Lưu danh sách đã chọn`, rồi chọn `Xem trước từ máy chủ`.
3. Kiểm tra học sinh nằm trong danh sách đủ điều kiện. Nếu bị bỏ qua, sửa roster/effective date theo lý do mà máy chủ trả về, rồi lặp lại preview.
4. Chọn `Xác nhận preview và chuyển READY`, sau đó chọn `Tạo hóa đơn nháp` và xác nhận tháng thu trong dialog.
5. Trong kết quả tạo hóa đơn hoặc danh sách hóa đơn của đợt, chọn `Rà soát hóa đơn` cho học sinh.
6. Hóa đơn bắt đầu ở trạng thái `DRAFT`. Thêm ít nhất một line bằng khoản thu đã tạo; điều chỉnh quantity/đơn giá theo giao diện nếu cần. Tổng phải lớn hơn 0.
7. Chọn `Phát hành hóa đơn`, chọn tài khoản nhận đang hoạt động, nhập đúng tên học sinh để xác nhận, rồi xác nhận phát hành.
8. Xác nhận hóa đơn chuyển sang `ISSUED` và có thông tin hạn thanh toán, tài khoản nhận, nội dung chuyển khoản và policy snapshot.

Nếu một mutation timeout hoặc kết nối bị gián đoạn, không gửi lại ngay. Portal giữ Operation ID và tự đối soát. Đợi kết quả đối soát trước khi thử lại thao tác.

## Kiểm tra kết thúc

- API đang chạy tại port `3000`, Ops tại `5176`, Admin tại `5173`; cả hai portal gọi trực tiếp `http://localhost:3000` qua `VITE_API_URL`.
- Đăng nhập Ops chỉ thành công cho `SUPERADMIN_EMAIL`; School owner đăng nhập qua Admin, không qua Ops.
- School có năm học, lớp, học sinh `ENROLLED`, FinancePolicy có hiệu lực, tài khoản nhận đang hoạt động, nhóm/khoản thu, CollectionRun, hóa đơn `DRAFT` và hóa đơn `ISSUED` sau khi hoàn thành happy path.
- Teacher và Parent không chạy trong toàn bộ quá trình.

Có thể chạy các kiểm tra không cần database test riêng sau khi thay đổi tài liệu:

```bash
pnpm --filter @passionedu/admin-web typecheck
pnpm --filter @passionedu/ops-web typecheck
git diff --check
```

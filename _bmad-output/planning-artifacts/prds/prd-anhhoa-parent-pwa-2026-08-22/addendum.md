# Addendum ky thuat: Parent PWA

Tai lieu nay giu cac chi tiet de architecture, UX va implementation tinh chinh; no khong thay the yeu cau san pham trong `prd.md`.

## Ranh gioi de xuat

- Tao `apps/parent-web` la React/Vite PWA rieng; giu `apps/web` la Admin PWA.
- `apps/api` la noi duy nhat xu ly Prisma schema, authorization, invoice snapshot, QR payload va read model Parent.
- Parent PWA chi goi REST API va khong chua quy tac tinh tien, payment eligibility hay authorization.

## Du lieu va authorization de xuat

- Dung `Parent` de luu Google subject, email normalized, display name, status va metadata dang nhap can thiet. Chi chap nhan Google email da verified; first login bind email normalized da duoc Admin gan voi subject, va subject thay doi can Admin thu hoi/gan lai email.
- Dung `StudentParent` de mo hinh quan he nhieu-nhieu, co status, createdAt, revokedAt va revokedBy.
- Moi query Parent lay identity tu session va kiem tra Parent status + StudentParent status server-side; khong tin `studentId` hoac `invoiceId` tu client.
- Revoke can vo hieu hoa cac Parent session lien quan va xoa client cache; khong xoa cung du lieu lich su. Client revalidate khi focus, foreground va truoc protected view; request sau revoke phai bi tu choi.

## API read model de xuat

- `GET /api/parent/me`
- `GET /api/parent/students`
- `GET /api/parent/invoices`
- `GET /api/parent/invoices/:invoiceId`
- `GET /api/parent/invoices/:invoiceId/payment`

Danh sach invoice can phan trang, gioi han page size, stable sort va validate filter. Payment endpoint chi tra payload khi Hoa don duoc authorize, `PENDING`, `TRANSFER` va co Payment snapshot hop le.

## Thanh toan va QR

- Payment snapshot phai gom bank code, so tai khoan, ten chu tai khoan, so tien VND va ma tham chieu; validate truoc `DRAFT -> PENDING`.
- QR duoc tu sinh/host trong he thong tu snapshot; tai PNG dung ten `anh-hoa-<invoiceCode>.png`.
- Noi dung chuyen khoan giu quy tac hien tai: `Ho ten [biet danh neu co] Lop chuyen tien`. Day la du lieu ca nhan xuat hien trong lich su giao dich va rui ro rieng tu da duoc chap nhan cho giai doan 1.
- Danh sach ngan hang va URI template phai nam o server/config co version, co expiry/revalidation date, khong hard-code phan tan trong UI.

## Bao mat va PWA

- OAuth Parent co callback, state, redirect allowlist va cookie rieng; khuyen nghi Google OAuth client rieng trong production.
- Cookie Parent can `Secure`, `httpOnly`, `SameSite=Lax` va scope domain/path toi thieu; deployment can chot CORS credential policy va origin allowlist.
- Service worker khong cache response co du lieu Parent. Khi logout, expiry, `401` hay revoke, PWA xoa cache/state Parent.
- Moi Parent mutation cookie-auth, bao gom cap va thu hoi lien ket, dung origin validation va double-submit CSRF. Cac mutation co the retry hoac xu ly hang loat dung idempotency UUID.

## Kiem thu can co

- PostgreSQL integration tests cho authorization, revoke va Payment snapshot eligibility.
- E2E Parent PWA: login tu choi, multiple students, UUID enumeration, revoke trong phien, completed trong payment sheet, QR/download failure va deep-link fallback.
- Test vector VietQR va kiem thu deep link tren Android Chrome, Android in-app browser, iOS Safari va PWA installed neu ho tro.

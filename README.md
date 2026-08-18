# Kindergarten Invoice Management

## Khởi chạy workspace

Yêu cầu Node.js 22 LTS và pnpm 11.9.0 (theo trường `packageManager` ở root).

```bash
pnpm install
pnpm dev
```

Web chạy tại `http://localhost:5173`; API tối thiểu chạy tại `http://localhost:3000`.

Các lệnh kiểm tra workspace:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter web exec playwright test
```

API chỉ giữ biến môi trường mẫu trong `apps/api/.env.example`; không thêm giá trị thật vào repository.

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

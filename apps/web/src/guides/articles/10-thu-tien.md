---
title: Ghi nhận thu tiền
summary: Đối chiếu sao kê theo từng tài khoản và ghi thực nhận; hiểu kết quả đủ, thiếu, thừa.
order: 10
requires: receipt-queue
---
Mở `Tài chính › Thu tiền`. Bảng liệt kê **hóa đơn chờ thu** và **phiếu hoàn tiền chờ chi**. Mỗi dòng là một phần hóa đơn theo một tài khoản nhận; hai phần của cùng học sinh nằm liền nhau (tài khoản trường trước).

![Danh sách chờ thu](thu-tien-danh-sach.jpg)

## Đối chiếu theo sao kê

1. Chọn `Tài khoản nhận` đúng tài khoản của sao kê đang đối chiếu (có thể lọc thêm `Tháng thu`, `Lớp`, `Tìm học sinh`) rồi bấm `Lọc`.
2. Với từng giao dịch trên sao kê, tìm học sinh theo **nội dung chuyển khoản** (tên học sinh + tên lớp, không dấu).

![Lọc theo tài khoản Vietcombank](thu-tien-loc-tai-khoan.jpg)

## Ghi thực nhận

1. Bấm `...` ở dòng hóa đơn, chọn `Ghi thực nhận`.
2. `Số thực nhận (đ)` điền sẵn bằng số còn phải thu. Sửa lại nếu phụ huynh chuyển khác số.
3. Bấm `Xác nhận ghi thực nhận`.

![Ghi thực nhận khi phụ huynh chuyển thiếu](thu-tien-ghi-thieu.jpg)

Hệ thống trả về kết quả:

- **Đủ** — hóa đơn đóng.
- **Thu thiếu** — hóa đơn vẫn đóng; số còn thiếu tự chuyển sang hóa đơn **cùng tài khoản** của tháng sau.
- **Thu thừa** — hóa đơn đóng; số thừa được trừ vào hóa đơn cùng tài khoản tháng sau.

![Kết quả thu thiếu 500.000 đ](thu-tien-ghi-thieu-ket-qua.jpg)

![Kết quả thu thừa 100.000 đ](thu-tien-ghi-thua-ket-qua.jpg)

> [!WARNING]
> Mỗi hóa đơn chỉ ghi thực nhận **một lần** — không có thu từng đợt. Nếu phụ huynh chuyển làm hai lần, hãy cộng lại và ghi một lần khi đã nhận đủ hoặc khi chốt sổ. Phần của tài khoản kia không bị ảnh hưởng.

> Hóa đơn có gói nộp trước chỉ ghi được khi thực nhận **đúng bằng** số phải thu.

## Ghi nhận đã chi (phiếu hoàn tiền)

Dòng có trạng thái `Chờ chi hoàn` là tiền trường phải trả lại phụ huynh (thường do học sinh nghỉ học, xem [Học sinh nghỉ học](guide:quyet-toan-nghi-hoc)). Sau khi chuyển tiền:

1. Bấm `...`, chọn `Ghi nhận đã chi`.
2. Nhập `Ngày chi`, `Hình thức` (Chuyển khoản / Tiền mặt) và `Mã giao dịch hoặc ghi chú` (bắt buộc).
3. Bấm `Xác nhận đã chi`. Phải chi đúng số tiền hệ thống xác nhận, một lần.

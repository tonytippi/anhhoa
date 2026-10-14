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
2. Hộp ghi thực nhận hiện học sinh, mã hóa đơn, khung **Tiền vào tài khoản** (tô đậm ngân hàng và số tài khoản nhận) và các dòng hóa đơn với số **Cần thu**. Đối chiếu tài khoản này với sao kê đang xem trước khi ghi.
3. `Số thực nhận (đ)` điền sẵn bằng số còn phải thu. Sửa lại nếu phụ huynh chuyển khác số.
4. Bấm `Xác nhận ghi thực nhận`.

![Ghi thực nhận khi phụ huynh chuyển thiếu](thu-tien-ghi-thieu.jpg)

Form đóng lại và bạn quay về danh sách; thông báo kết quả hiện ở đầu trang (bấm `×` để ẩn). Hệ thống trả về kết quả:

- **Đủ** — hóa đơn đóng.
- **Thu thiếu** — hóa đơn vẫn đóng; số còn thiếu tự chuyển sang hóa đơn **cùng tài khoản** của tháng sau.
- **Thu thừa** — hóa đơn đóng; số thừa được trừ vào hóa đơn cùng tài khoản tháng sau.

![Kết quả thu thiếu 500.000 đ](thu-tien-ghi-thieu-ket-qua.jpg)

![Kết quả thu thừa 100.000 đ](thu-tien-ghi-thua-ket-qua.jpg)

Tháng sau, khoản chênh lệch hiện thành một dòng riêng trên hóa đơn nháp cùng tài khoản: **Khoản thu thiếu kỳ trước** (cộng thêm) hoặc **Khoản thu thừa kỳ trước được khấu trừ** (trừ bớt). Dòng này cũng in trên ảnh thông báo học phí gửi phụ huynh.

![Thu thiếu 500.000 đ tháng 10 được cộng vào phần tài khoản cá nhân tháng 11](hoa-don-chenh-lech-ky-truoc.jpg)

> Chênh lệch chỉ chuyển sang hóa đơn **tạo sau** khi đã ghi thực nhận. Nếu đợt thu tháng sau đã tạo hóa đơn trước khi bạn ghi thực nhận tháng này, khoản chênh lệch sẽ vào đợt thu kế tiếp nữa. Nên ghi thực nhận xong trước khi tạo đợt thu tháng sau.

> [!WARNING]
> Mỗi hóa đơn chỉ ghi thực nhận **một lần** — không có thu từng đợt. Nếu phụ huynh chuyển làm hai lần, hãy cộng lại và ghi một lần khi đã nhận đủ hoặc khi chốt sổ. Phần của tài khoản kia không bị ảnh hưởng.

> Hóa đơn có gói nộp trước hiện nhãn `Gói nộp trước … · thu đúng số` và chỉ ghi được khi thực nhận **đúng bằng** số phải thu. Phụ huynh chuyển thiếu hoặc thừa thì đề nghị chuyển bổ sung hoặc hoàn phần thừa trước khi ghi; khi đợt thu chưa đóng có thể [điều chỉnh hóa đơn](guide:dieu-chinh-hoa-don) để bỏ gói. Hóa đơn gói vẫn ghi thực nhận được sau khi đã đóng đợt thu.

## Xem hóa đơn đã thu

Chọn `Trạng thái` là `Đã xử lý` rồi bấm `Lọc` (chọn thêm `Loại` là `Hóa đơn thu tiền` hoặc `Phiếu hoàn tiền` nếu chỉ muốn xem một loại). Bảng liệt kê hóa đơn đã ghi thực nhận (số thực nhận, ngày ghi, kết quả **Đủ / Thu thiếu / Thu thừa**) và phiếu hoàn tiền đã chi. Các bộ lọc tháng, lớp, tài khoản nhận và tìm học sinh dùng như bình thường, nên có thể đối chiếu lại một sao kê đã ghi xong.

> Đây là chế độ xem: hóa đơn đã thu không sửa hay ghi lại được.

## Đợt thu đã đóng

Đóng (khóa) đợt thu chỉ cần mọi hóa đơn đã phát hành, không cần đã thu đủ. Sau khi đợt đã đóng, bạn vẫn ghi thực nhận và ghi nhận đã chi cho hóa đơn của đợt đó ở `Thu tiền` như bình thường; chỉ việc thêm học sinh, sửa hay điều chỉnh hóa đơn là bị khóa. Hóa đơn chưa thu có thể chuyển sang tháng sau bằng [Chuyển công nợ kỳ trước](guide:chuyen-cong-no).

## Ghi nhận đã chi (phiếu hoàn tiền)

Dòng có trạng thái `Chờ chi hoàn` là tiền trường phải trả lại phụ huynh (thường do học sinh nghỉ học, xem [Học sinh nghỉ học](guide:quyet-toan-nghi-hoc)). Sau khi chuyển tiền:

1. Bấm `...`, chọn `Ghi nhận đã chi`.
2. Nhập `Ngày chi`, `Hình thức` (Chuyển khoản / Tiền mặt) và `Mã giao dịch hoặc ghi chú` (bắt buộc).
3. Bấm `Xác nhận đã chi`. Phải chi đúng số tiền hệ thống xác nhận, một lần.

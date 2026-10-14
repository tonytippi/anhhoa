---
title: Ghi nhận thu tiền
summary: Đối chiếu sao kê theo từng tài khoản và ghi thực nhận; hiểu kết quả đủ, thiếu, thừa.
order: 11
requires: receipt-queue
---
Mở `Tài chính › Thu tiền`. Bảng liệt kê **hóa đơn chờ thu** của mọi lớp. Mỗi dòng là một phần hóa đơn theo một tài khoản nhận; hai phần của cùng học sinh nằm liền nhau (tài khoản trường trước). Cột `Kỳ` ghi tên lớp và tên đợt, ví dụ "Movers 2 · Unit 3".

![Danh sách chờ thu, cột Kỳ ghi lớp và tên đợt](tt-thu-tien-danh-sach.jpg)

## Đối chiếu theo sao kê

1. Chọn `Tài khoản nhận` đúng tài khoản của sao kê đang đối chiếu (có thể lọc thêm `Tháng thu` — tháng có ngày bắt đầu kỳ, `Lớp`, `Tìm học sinh`) rồi bấm `Lọc`.
2. Với từng giao dịch trên sao kê, tìm học sinh theo **nội dung chuyển khoản** (tên học sinh + tên lớp, không dấu).

## Ghi thực nhận

1. Bấm `...` ở dòng hóa đơn, chọn `Ghi thực nhận`.
2. Hộp ghi thực nhận hiện học sinh, mã hóa đơn, khung **Tiền vào tài khoản** (tô đậm ngân hàng và số tài khoản nhận) và các dòng hóa đơn với số **Cần thu**. Đối chiếu tài khoản này với sao kê đang xem trước khi ghi.
3. `Số thực nhận (đ)` điền sẵn bằng số còn phải thu. Sửa lại nếu phụ huynh chuyển khác số.
4. Bấm `Xác nhận ghi thực nhận`.

![Ghi thực nhận khi phụ huynh chuyển thiếu](tt-thu-tien-ghi-thieu.jpg)

Form đóng lại và bạn quay về danh sách; thông báo kết quả hiện ở đầu trang (bấm `×` để ẩn). Hệ thống trả về kết quả:

- **Đủ** — hóa đơn đóng.
- **Thu thiếu** — hóa đơn vẫn đóng; số còn thiếu tự chuyển sang hóa đơn kỳ sau **cùng tài khoản** của học sinh.
- **Thu thừa** — hóa đơn đóng; số thừa được trừ vào hóa đơn kỳ sau cùng tài khoản.

![Kết quả thu thiếu 300.000 đ](tt-thu-tien-ghi-thieu-ket-qua.jpg)

Khoản chênh lệch hiện thành một dòng riêng trên hóa đơn nháp kỳ sau: **Khoản thu thiếu kỳ trước** (cộng thêm) hoặc **Khoản thu thừa kỳ trước được khấu trừ** (trừ bớt). Hóa đơn kỳ sau là hóa đơn nháp đầu tiên của học sinh ở một đợt thu bắt đầu muộn hơn, **kể cả khi em đã chuyển sang lớp khác**.

![Thu thiếu Unit 1 được cộng vào hóa đơn Unit 2](tt-hoa-don-chenh-lech-ky-truoc.jpg)

> Chênh lệch chỉ chuyển sang hóa đơn **tạo sau** khi đã ghi thực nhận. Nếu đợt kỳ sau đã tạo hóa đơn trước khi bạn ghi thực nhận kỳ này, khoản chênh lệch sẽ vào đợt kế tiếp nữa. Nên ghi thực nhận xong trước khi tạo hóa đơn kỳ sau.

> [!WARNING]
> Mỗi hóa đơn chỉ ghi thực nhận **một lần** — không có thu từng đợt. Nếu phụ huynh chuyển làm hai lần, hãy cộng lại và ghi một lần khi đã nhận đủ hoặc khi chốt sổ. Phần của tài khoản kia không bị ảnh hưởng.

## Xem hóa đơn đã thu

Chọn `Trạng thái` là `Đã xử lý` rồi bấm `Lọc`. Bảng liệt kê hóa đơn đã ghi thực nhận (số thực nhận, ngày ghi, kết quả **Đủ / Thu thiếu / Thu thừa**). Các bộ lọc tháng, lớp, tài khoản nhận và tìm học sinh dùng như bình thường, nên có thể đối chiếu lại một sao kê đã ghi xong.

> Đây là chế độ xem: hóa đơn đã thu không sửa hay ghi lại được.

## Đợt thu đã đóng

Đóng đợt thu chỉ cần mọi hóa đơn đã phát hành, không cần đã thu đủ. Sau khi đợt đã đóng, bạn vẫn ghi thực nhận cho hóa đơn của đợt đó ở `Thu tiền` như bình thường. Hóa đơn chưa thu có thể chuyển sang kỳ sau bằng [Chuyển công nợ kỳ trước](guide:chuyen-cong-no).

## Trả lại tiền cho phụ huynh

Trung tâm không có phiếu hoàn tiền tự động. Nếu cần trả lại tiền (ví dụ học sinh nghỉ hẳn), làm theo thỏa thuận của trung tâm ngoài phần mềm và ghi chú lại; xem [Học sinh vào giữa kỳ, chuyển lớp, nghỉ học](guide:hoc-sinh-giua-ky).

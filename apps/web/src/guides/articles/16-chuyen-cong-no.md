---
title: Chuyển công nợ kỳ trước
summary: Gộp hóa đơn tháng trước chưa thu vào hóa đơn tháng này khi phụ huynh chưa đóng; việc hiếm, làm bằng tay và không hoàn tác.
order: 13.5
requires: collection-runs
---
Phụ huynh thường đóng đủ trước khi đưa trẻ đến lớp, nên việc chuyển công nợ **hiếm khi cần**. Chỉ dùng khi một hóa đơn tháng trước đã phát hành nhưng vẫn chưa thu và bạn muốn phụ huynh nộp cùng hóa đơn tháng này. Hệ thống không tự gộp: kế toán phải chủ động chuyển.

## Điều kiện

- Đợt thu tháng trước đã đóng (xem [Đóng đợt thu](guide:dong-dot-thu)).
- Đợt thu tháng này đã tạo hóa đơn nháp và học sinh có hóa đơn trong đợt. Chuyển **trước khi phát hành** hóa đơn tháng này.
- Hóa đơn tháng trước chưa ghi thực nhận và không có gói nộp trước.

## Các bước

1. Mở đợt thu tháng này (trạng thái `Đã tạo hóa đơn`). Nếu có công nợ đủ điều kiện, bên dưới bảng hóa đơn hiện mục `Công nợ kỳ trước` với bảng `Công nợ kỳ trước chưa thu`. Không có mục này nghĩa là chưa có gì để chuyển.
2. Chuyển từng hóa đơn bằng `Chuyển vào hóa đơn tháng này` ở dòng của học sinh, hoặc bấm `Chuyển tất cả công nợ`.
3. Hộp xác nhận nêu số hóa đơn và tổng tiền. Bấm `Chuyển công nợ` để xác nhận.

## Điều gì xảy ra

- Toàn bộ số còn nợ của mỗi hóa đơn cũ trở thành một dòng `Công nợ kỳ trước` trong hóa đơn nháp tháng này, ở phần **cùng loại tài khoản** (tài khoản trường hoặc tài khoản cá nhân). Nếu học sinh chưa có phần đó trong tháng này, hệ thống tạo phần đó.
- Lý do của dòng tự ghi "Chuyển công nợ tháng MM/YYYY". Dòng này không sửa hay xóa được.
- Hóa đơn cũ **rời trang `Thu tiền`** và không còn tải được ảnh VietQR; báo cáo không tính nó là còn nợ nữa. Phụ huynh nhận ảnh của hóa đơn tháng này, đã gồm khoản nợ cũ.
- Nếu phụ huynh lỡ chuyển khoản theo hóa đơn cũ, hãy ghi khoản đó vào hóa đơn tháng này khi phát hành và ghi thực nhận ở đó.
- Thao tác chọn nhiều hóa đơn là **tất cả hoặc không**: một hóa đơn không còn đủ điều kiện thì không hóa đơn nào được chuyển.

> [!WARNING]
> Chuyển công nợ không thể hoàn tác. Kiểm tra kỹ học sinh và số tiền trong hộp xác nhận trước khi bấm `Chuyển công nợ`.

Xem tiếp [Rà soát và phát hành hóa đơn](guide:ra-soat-phat-hanh) để phát hành hóa đơn đã có dòng công nợ, và [Ghi nhận thu tiền](guide:thu-tien) để ghi thực nhận.

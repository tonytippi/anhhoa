---
title: Chuyển công nợ kỳ trước
summary: Gộp hóa đơn kỳ trước chưa thu vào hóa đơn kỳ này khi phụ huynh chưa đóng; việc hiếm, làm bằng tay và không hoàn tác.
order: 14.5
requires: collection-runs
---
Chỉ dùng khi một hóa đơn kỳ trước đã phát hành nhưng vẫn chưa thu và bạn muốn phụ huynh nộp cùng hóa đơn kỳ này. Hệ thống không tự gộp: kế toán phải chủ động chuyển.

Công nợ **đi theo học sinh, kể cả khi em đã chuyển sang lớp khác**: hóa đơn chưa thu ở lớp cũ hiện ở đợt thu của lớp em đang học.

## Điều kiện

- Đợt thu chứa hóa đơn cũ đã đóng (xem [Đóng đợt thu](guide:dong-dot-thu)) và có kỳ bắt đầu trước đợt này.
- Đợt thu kỳ này đã tạo hóa đơn nháp và học sinh có hóa đơn trong đợt. Chuyển **trước khi phát hành** hóa đơn kỳ này.
- Hóa đơn cũ chưa ghi thực nhận.

## Các bước

1. Mở đợt thu kỳ này (trạng thái `Đã tạo hóa đơn`). Nếu có công nợ đủ điều kiện, bên dưới bảng hóa đơn hiện mục `Công nợ kỳ trước`; cột `Kỳ` cho biết hóa đơn cũ thuộc lớp và đợt nào. Không có mục này nghĩa là chưa có gì để chuyển.

![Công nợ Unit 1 chưa thu trong đợt Unit 2](tt-cong-no-danh-sach.jpg)

2. Chuyển từng hóa đơn bằng `Chuyển vào hóa đơn đợt này` ở dòng của học sinh, hoặc bấm `Chuyển tất cả công nợ`.
3. Hộp xác nhận nêu số hóa đơn và tổng tiền. Bấm `Chuyển công nợ` để xác nhận.

![Xác nhận chuyển công nợ](tt-cong-no-xac-nhan.jpg)

## Điều gì xảy ra

- Toàn bộ số còn nợ của mỗi hóa đơn cũ trở thành một dòng `Công nợ kỳ trước` trong hóa đơn nháp kỳ này, ở phần **cùng loại tài khoản** (tài khoản trường hoặc tài khoản cá nhân). Nếu học sinh chưa có phần đó trong kỳ này, hệ thống tạo phần đó.
- Lý do của dòng tự ghi "Chuyển công nợ" kèm tên đợt cũ (ví dụ "Chuyển công nợ Unit 3"). Dòng này không sửa hay xóa được.
- Hóa đơn cũ **rời trang `Thu tiền`** và không còn tải được ảnh VietQR; báo cáo không tính nó là còn nợ nữa. Phụ huynh nhận ảnh của hóa đơn kỳ này, đã gồm khoản nợ cũ.
- Thao tác chọn nhiều hóa đơn là **tất cả hoặc không**: một hóa đơn không còn đủ điều kiện thì không hóa đơn nào được chuyển.

![Dòng Công nợ kỳ trước trên hóa đơn Unit 2](tt-cong-no-tren-hoa-don.jpg)

> [!WARNING]
> Chuyển công nợ không thể hoàn tác. Kiểm tra kỹ học sinh và số tiền trong hộp xác nhận trước khi bấm `Chuyển công nợ`.

> Học sinh nghỉ rồi quay lại là hồ sơ mới: nợ của hồ sơ cũ không hiện ở đây, xem [Học sinh vào giữa kỳ, chuyển lớp, nghỉ học](guide:hoc-sinh-giua-ky).

---
title: Đóng đợt thu
summary: Khóa đợt thu khi mọi hóa đơn đã phát hành; phải đóng đợt trước của lớp mới phát hành được hóa đơn đợt sau.
order: 14
requires: collection-runs
---
Đóng (khóa) đợt thu khi đã **phát hành** xong mọi hóa đơn của kỳ; không cần chờ phụ huynh đóng đủ tiền. Sau khi đóng, không thể thêm học sinh, tạo hoặc sửa hóa đơn trong đợt; việc ghi thực nhận vẫn tiếp tục bình thường ở trang `Thu tiền`.

## Khóa theo từng lớp

Hóa đơn của một đợt chỉ phát hành được sau khi **đợt trước của cùng lớp đã đóng**. Nếu chưa, trang đợt thu báo "Chưa thể phát hành hóa đơn của đợt này: cần đóng đợt … của lớp … trước.", kèm nút `Mở đợt thu …` để sang đóng đợt đó, và nút phát hành hóa đơn bị khóa. Đợt của lớp khác không ảnh hưởng.

![Unit 2 báo cần đóng Unit 1 của lớp trước](tt-dot-thu-khoa-dot-truoc.jpg)

Kỳ sau vẫn **mở đợt, xem trước và tạo hóa đơn nháp** được trước khi đóng kỳ trước; chỉ việc phát hành là phải chờ. Bản thay thế của hóa đơn (xem [Điều chỉnh hóa đơn](guide:dieu-chinh-hoa-don)) thuộc đợt chưa đóng nên không bị chặn.

## Các bước

1. Mở đợt thu. Dưới bảng hóa đơn, dòng trạng thái cho biết:
   - "Chưa thể đóng: còn N phiếu thu nháp cần phát hành." — phát hành hết trước đã.
   - "Mọi hóa đơn đã phát hành; có thể đóng đợt thu."
2. Bấm `Đóng đợt thu`, nhập `Lý do đóng đợt thu` và xác nhận.

![Xác nhận đóng đợt thu](tt-dot-thu-dong.jpg)

Đợt đã đóng hiện "Đợt thu đã đóng"; các hóa đơn chỉ còn xem được bằng `Xem hóa đơn`.

> [!WARNING]
> Đóng đợt thu không thể mở lại. Hãy thêm xong học sinh vào giữa kỳ và xử lý xong các dòng `Trùng kỳ` trước khi đóng.

Hóa đơn của đợt đã đóng mà phụ huynh chưa đóng tiền vẫn ghi thực nhận bình thường ở `Thu tiền` (xem [Ghi nhận thu tiền](guide:thu-tien)). Nếu muốn thu cùng hóa đơn kỳ sau, chuyển hóa đơn chưa thu bằng [Chuyển công nợ kỳ trước](guide:chuyen-cong-no).

Sau khi đóng, nếu phát hiện sai sót thì không điều chỉnh hóa đơn của đợt đã đóng. Sửa ở hóa đơn kỳ sau của học sinh: thêm dòng thu thêm hoặc dùng phần `Bớt` để trừ lại.

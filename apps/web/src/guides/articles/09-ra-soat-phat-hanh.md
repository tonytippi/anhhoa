---
title: Rà soát và phát hành hóa đơn
summary: Kiểm tra từng hóa đơn nháp, sửa số lượng hoặc phần bớt, phát hành và gửi ảnh hóa đơn cho phụ huynh.
order: 9
requires: collection-runs
---
Trong đợt thu ở trạng thái `Đã tạo hóa đơn`, bấm `Rà soát hóa đơn` ở dòng học sinh đầu tiên. Dùng `Học sinh trước` / `Học sinh tiếp theo` để đi lần lượt; sau khi phát hành một hóa đơn, hệ thống tự chuyển sang hóa đơn nháp kế tiếp.

## Đọc hóa đơn

Phiếu thu chia theo tài khoản nhận: **Phần 1 · Thu vào tài khoản trường** (khoản có thuế) và **Phần 2 · Thu vào tài khoản cá nhân** (khoản không kê khai). Mỗi dòng có:

- `Số lượng`, `Đơn giá`, `Tổng trước giảm`
- `Ưu đãi` — do chính sách ưu đãi đã gán
- `Bớt` — phần trả lại, bằng *số lượng bớt × giá hoàn trả* (ví dụ ngày nghỉ có phép)
- `Thuế GTGT` — tính trên số tiền sau ưu đãi và bớt
- `Tổng phải thu`

## Sửa trên hóa đơn nháp

Hóa đơn nháp sửa trực tiếp trên bảng như bảng tính:

1. Sửa ô `Số lượng`, `Đơn giá` hoặc số lượng ở ô `Bớt`.
2. Khi đổi đơn giá, nhập **Lý do đổi đơn giá**. Khi phần bớt khác số hệ thống đề xuất, nhập **Lý do sửa phần bớt** (hoặc bấm `Dùng số đề xuất` để quay về số gợi ý).
3. Số in nghiêng là số dự kiến do hệ thống tính lại, chưa lưu. Bấm `Lưu thay đổi` (hoặc `Hoàn tác`).

![Sửa phần bớt tiền ăn 2 ngày nghỉ ốm, kèm lý do](hoa-don-sua-bot.jpg)

Các thao tác khác: `Thêm dòng` để thêm khoản phát sinh riêng cho học sinh này, `Xóa` để bỏ một dòng, `Nguồn` để ghi chú căn cứ (ngày dịch vụ, điểm danh, giờ đón, số phút trông muộn).

> Gợi ý "Đề xuất N ngày × giá · nghỉ có phép MM/YYYY" lấy từ đơn nghỉ có phép đã duyệt của **tháng trước**.

## Phát hành

Ở khung **Rà soát trước khi phát hành**, kiểm tra tài khoản nhận cho từng phần (chọn sẵn theo tài khoản mặc định của lớp), rồi bấm `Phát hành phiếu thu` (hoặc `Phát hành hóa đơn` nếu chỉ có một phần).

![Khung rà soát trước khi phát hành](hoa-don-ra-soat-phat-hanh.jpg)

Hộp xác nhận nhắc lại tổng tiền đã gồm thuế. Bấm phát hành để hoàn tất. Hai phần được phát hành cùng lúc.

![Xác nhận phát hành phiếu thu](hoa-don-xac-nhan-phat-hanh.jpg)

> [!WARNING]
> Sau khi phát hành, hóa đơn **không sửa trực tiếp được**. Nút phát hành bị khóa khi còn thay đổi chưa lưu trên dòng hóa đơn.

## Gửi thông tin thanh toán cho phụ huynh

Sau khi phát hành, khung **Thanh toán** hiện mã hóa đơn, hạn thanh toán, số tiền và tài khoản của từng phần, cùng nội dung chuyển khoản.

![Khung thanh toán sau khi phát hành](hoa-don-thanh-toan.jpg)

Bấm `Xem ảnh hóa đơn` hoặc `Tải ảnh hóa đơn` để lấy ảnh thông báo học phí có mã VietQR, rồi gửi cho phụ huynh qua kênh liên lạc của trường (Zalo, email…). Phụ huynh quét mã là đúng số tiền, đúng tài khoản và đúng nội dung chuyển khoản.

![Ảnh thông báo học phí có mã VietQR](hoa-don-anh.jpg)

> Ảnh chỉ tạo được cho hóa đơn đã phát hành và chưa thu tiền. Phiếu thu hai phần nghĩa là phụ huynh cần chuyển khoản **hai lần** vào hai tài khoản.

## Gói nộp trước

Trên hóa đơn nháp, mục `Quản lý ưu đãi nộp trước` cho phép chọn gói (xem [Ưu đãi và gói nộp trước](guide:uu-dai)) và bấm `Áp dụng ưu đãi nộp trước`. Bảng **Ưu đãi nộp trước** liệt kê từng tháng của gói với giá gốc, phần giảm và thành tiền.

![Gói 3 tháng đã áp dụng: từng tháng và phần giảm](hoa-don-nop-truoc.jpg)

Dòng khoản thu của gói chuyển thành **đủ số tháng** (ví dụ Học phí 3 tháng = 10.500.000 đ, ưu đãi 525.000 đ). Gói tự gắn vào đúng phần của phiếu thu theo tài khoản nhận của khoản thu (học phí "Không kê khai" → phần tài khoản cá nhân), dù bạn đang mở phần nào.

![Học phí thu đủ 3 tháng của gói trên phần tài khoản cá nhân](hoa-don-nop-truoc-dong.jpg)

> [!WARNING]
> Khi phần hóa đơn đang có gói nộp trước, các dòng của phần đó **bị khóa**. Muốn sửa số lượng, đơn giá hay phần bớt, bấm `Xóa ưu đãi nộp trước` (dòng trở về 1 tháng), sửa xong rồi áp dụng lại gói. Phụ huynh phải chuyển **đúng** số tiền của phần đó; chuyển thiếu hoặc thừa sẽ không ghi thực nhận được.

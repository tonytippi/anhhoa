---
title: Ưu đãi và gói nộp trước
summary: Tạo chính sách ưu đãi, kích hoạt, gán học sinh và áp dụng gói nộp trước nhiều tháng.
order: 6
requires: promotions
---
Mở `Tài chính › Ưu đãi`. Mỗi chính sách có nhiều **phiên bản**; muốn thay đổi thì tạo phiên bản mới, không sửa phiên bản cũ.

![Danh sách chính sách ưu đãi và học sinh đang áp dụng](uu-dai-danh-sach.jpg)

## Tạo chính sách giảm trên hóa đơn

1. Bấm `Thêm chính sách`.
2. Để `Chính sách hiện có` là "Chính sách mới" (hoặc chọn chính sách cũ để tạo phiên bản mới).
3. Điền `Tên chính sách`, đánh dấu `Khoản thu áp dụng`.
4. Chọn `Loại giảm` (Phần trăm hoặc Số tiền) và `Mức giảm`.
5. Chọn `Hiệu lực từ`, `Hiệu lực đến (bao gồm)` (để trống nếu không thời hạn), `Ưu tiên` và `Quy tắc kết hợp` (Có thể kết hợp / Độc quyền).
6. Ở `Cách thực hiện`, chọn **Giảm trên hóa đơn**.
7. Bấm `Lưu phiên bản ưu đãi`. Phiên bản mới ở trạng thái `Nháp`.

![Tạo ưu đãi giảm 10% học phí](uu-dai-them.jpg)

## Kích hoạt phiên bản

Bấm `...` ở dòng phiên bản, chọn `Kích hoạt phiên bản` rồi `Xác nhận kích hoạt`. Chỉ phiên bản `Đang áp dụng` mới gán được cho học sinh.

![Menu của phiên bản nháp](uu-dai-menu.jpg)

## Gán ưu đãi cho học sinh

1. Ở phiên bản đang áp dụng, chọn `Gán học sinh`.
2. Chọn `Phiên bản đang áp dụng`, `Áp dụng từ` và (nếu có) `Áp dụng đến (bao gồm)`.
3. Lọc theo lớp hoặc tìm tên, đánh dấu các học sinh. Học sinh đã có ưu đãi này hiện "Đã gán ưu đãi này".
4. Nhập `Lý do` (ví dụ "Có anh/chị đang học tại trường") rồi bấm `Lưu gán học sinh`.

![Gán ưu đãi cho hai học sinh](uu-dai-gan-hoc-sinh.jpg)

Học sinh đã gán hiện ở bảng `Học sinh đang áp dụng ưu đãi`. Muốn dừng, chọn `Kết thúc áp dụng`, nhập ngày kết thúc và lý do.

## Gói nộp trước (đóng nhiều tháng)

Dùng khi phụ huynh đóng trước nhiều tháng liên tiếp. Ở bước `Cách thực hiện`, chọn **Ưu đãi nộp trước** và nhập `Thời hạn nộp trước (tháng)`. Mức giảm có thể để 0 nếu trường không giảm giá.

![Tạo gói đóng trước 3 tháng giảm 5%](uu-dai-nop-truoc.jpg)

Sau khi kích hoạt, gói được áp dụng **trên từng hóa đơn nháp** ở mục `Quản lý ưu đãi nộp trước` (xem [Rà soát và phát hành hóa đơn](guide:ra-soat-phat-hanh)). Khi áp dụng, hóa đơn thu luôn **đủ số tháng của gói** (ví dụ gói 3 tháng: Học phí 3 tháng, trừ phần giảm của cả 3 tháng); các đợt thu tháng sau sẽ tự bỏ qua học phí của những tháng đã nộp trước. Quyền ưu đãi các tháng sau chỉ được phát hành khi hóa đơn đó được thu **đủ đúng số tiền**.

> Khi tạo gói, chỉ chọn các khoản thu **cùng loại tài khoản nhận** (cùng "Không kê khai" hoặc cùng có thuế). Hệ thống từ chối gói trộn khoản thu tài khoản trường với khoản thu tài khoản cá nhân.

> [!WARNING]
> Không thu nhiều tháng bằng cách tăng số lượng học phí trên hóa đơn: các tháng sau sẽ vẫn bị thu và không được hoàn khi học sinh nghỉ. Hãy dùng gói nộp trước.

> Nếu ưu đãi thay đổi sau khi đã tạo hóa đơn nháp, khi phát hành hệ thống có thể báo "Kết quả ưu đãi đã thay đổi. Hãy rà soát lại hóa đơn trước khi phát hành." — kiểm tra lại số tiền rồi phát hành lại.

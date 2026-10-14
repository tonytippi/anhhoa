---
title: Thiết lập tài khoản nhận tiền
summary: Chính sách tài chính (hạn thanh toán) và các tài khoản ngân hàng nhận học phí.
order: 3
requires: settings
---
Phần này nằm ở `Cấu hình trường › Cấu hình chung`, thẻ `Tài chính & thanh toán`. Cần làm xong trước khi phát hành hóa đơn đầu tiên; nếu thiếu, hệ thống sẽ báo *"Chưa có chính sách Finance hiệu lực để phát hành."* hoặc *"Máy chủ không có tài khoản nhận đang hoạt động để phát hành hóa đơn."*

## Chính sách tài chính

- `Số ngày hạn thanh toán`: hạn nộp in trên hóa đơn, tính từ ngày phát hành.
- `Ngày học trong tuần` và `Hoàn tiền ưu đãi`: dùng cho trường thu theo tháng. Đợt thu theo lớp của trung tâm không tự trừ ngày nghỉ và không có gói nộp trước, nên có thể để mặc định.

Muốn đổi chính sách, nhập `Ngày hiệu lực` mới, điền `Lý do` và bấm `Tạo phiên bản chính sách`. Phiên bản cũ vẫn được giữ để đối chiếu hóa đơn đã phát hành.

## Thêm tài khoản nhận tiền

1. Chọn `Loại tài khoản`:
   - **Tài khoản trường (khoản có thuế)** — nhận các khoản có thuế suất 0%, 5%, 8%, 10% hoặc "Không chịu thuế".
   - **Tài khoản cá nhân (khoản không kê khai)** — nhận các khoản có mức thuế "Không kê khai nộp thuế".
2. Chọn `Ngân hàng nhận`, nhập `Số tài khoản` và `Chủ tài khoản` (viết hoa không dấu như trên thẻ/ứng dụng ngân hàng).
3. Bấm `Thêm tài khoản nhận tiền`.

Sau khi thêm, tài khoản hiện trong bảng tương ứng với trạng thái `Đang hiệu lực`. Số tài khoản được che bớt (•••• 4567); rê chuột vào để xem đầy đủ.

> Nội dung chuyển khoản trên hóa đơn luôn là **tên học sinh + tên lớp**, bỏ dấu, tối đa 50 ký tự. Khi đối chiếu sao kê, tìm theo nội dung này.

## Ngừng dùng một tài khoản

Bấm `Ngừng dùng`, nhập lý do và xác nhận. Tài khoản ngừng dùng không còn được chọn cho hóa đơn mới, nhưng hóa đơn cũ và lịch sử thu vẫn giữ nguyên. Có thể `Dùng lại` bất cứ lúc nào; `Xem lịch sử` cho biết ai đã thêm, ngừng hoặc dùng lại.

Tiếp theo: [Tài khoản thu mặc định của lớp](guide:tai-khoan-thu-cua-lop).

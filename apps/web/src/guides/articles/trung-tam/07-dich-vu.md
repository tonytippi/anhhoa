---
title: Dịch vụ
summary: Tạo dịch vụ (đưa đón…), gắn khoản thu, thêm hoặc kết thúc học sinh dùng dịch vụ và cách tính tiền theo kỳ.
order: 7
requires: extracurricular-classes
---
Dịch vụ nằm ở `Danh bộ › Dịch vụ`. Mỗi dịch vụ gắn với một khoản thu nhóm **Dịch vụ**; học sinh dùng dịch vụ sẽ được tính khoản đó trong đợt thu của lớp em đang học. Dịch vụ không thay đổi lớp, điểm danh hay quyền của giáo viên.

![Danh sách dịch vụ](tt-dich-vu-danh-sach.jpg)

## Tạo dịch vụ

1. Bấm `Thêm dịch vụ`.
2. Nhập `Tên dịch vụ` (ví dụ "Đưa đón tuyến 1") và chọn `Khoản thu`. Chỉ khoản thu nhóm Dịch vụ đang áp dụng mới hiện ở đây; nếu chưa có, tạo ở [Quản lý khoản thu](guide:khoan-thu).
3. Đánh dấu `Điểm danh riêng` nếu dịch vụ cần điểm danh riêng. Hiện đây chỉ là đánh dấu, chức năng điểm danh sẽ có sau.
4. Bấm `Lưu dịch vụ`.

![Thêm dịch vụ đưa đón](tt-dich-vu-them.jpg)

> Nhiều dịch vụ có thể dùng chung một khoản thu, nên dùng chung một giá. Muốn dịch vụ có giá khác, hãy tạo khoản thu Dịch vụ khác. Nút `Sửa giá` trong trang dịch vụ sẽ đổi giá cho **mọi dịch vụ** dùng chung khoản thu đó.

## Thêm học sinh dùng dịch vụ

1. Bấm `Xem thành viên` ở dòng của dịch vụ.
2. Bấm `Thêm học sinh`, lọc theo `Lớp` hoặc tìm tên, đánh dấu học sinh. Học sinh đã có trong dịch vụ hiện "Đã dùng dịch vụ này".
3. Chọn `Hiệu lực từ`, nhập `Lý do` (ví dụ "Đăng ký đưa đón từ kỳ này") rồi bấm `Thêm học sinh đã chọn`.

![Trang dịch vụ với danh sách học sinh đang dùng](tt-dich-vu-chi-tiet.jpg)

![Chọn học sinh dùng dịch vụ](tt-dich-vu-them-hoc-sinh.jpg)

## Kết thúc dùng dịch vụ

Đánh dấu học sinh trong bảng thành viên, bấm `Kết thúc tham gia`, chọn `Ngày kết thúc` và lý do. Học sinh vẫn được tính kỳ có ngày dùng dịch vụ cuối cùng.

Muốn tạm dừng cả dịch vụ (ví dụ dừng một tuyến xe), bấm `Ngừng hoạt động`: dịch vụ không được tính vào đợt thu mới. `Kích hoạt lại` để dùng tiếp.

## Cách tính tiền

- Học sinh được tính nếu dùng dịch vụ **ít nhất một ngày trong kỳ** của đợt thu, và chỉ trong đợt thu **của lớp em đang học**.
- Mỗi kỳ tính **trọn giá** (số lượng 1); hệ thống không tự chia theo ngày. Học sinh vào hoặc thôi dùng giữa kỳ được đánh dấu `Vào/nghỉ giữa kỳ` trên hóa đơn nháp. Nếu cần thu ít hơn, kế toán sửa số lượng hoặc dùng `Bớt` trên hóa đơn kèm lý do.
- Có thể bỏ một dịch vụ khỏi một đợt thu riêng lẻ bằng `Loại khỏi đợt này` trong trang đợt thu (xem [Mở đợt thu theo lớp](guide:mo-dot-thu)).

> Trang chi tiết dịch vụ thống kê theo tháng (`Tính trong tháng`, `Vào giữa tháng`…). Số tính tiền thật sự là số trong bảng **Dịch vụ trong đợt** của từng đợt thu.

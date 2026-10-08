---
title: Lớp ngoại khóa
summary: Tạo lớp ngoại khóa, gắn khoản thu, thêm hoặc kết thúc học sinh tham gia; học sinh "Chỉ ngoại khóa".
order: 7
requires: extracurricular-classes
---
Lớp ngoại khóa nằm ở `Danh bộ › Lớp ngoại khóa`. Mỗi lớp gắn với một khoản thu nhóm **Ngoại khóa**; học sinh tham gia lớp sẽ được tính khoản đó trong đợt thu.

## Tạo lớp ngoại khóa

1. Bấm `Thêm lớp ngoại khóa`.
2. Nhập `Tên lớp` (nên ghi cả lịch học, ví dụ "Tiếng Anh A1 (T3-T5)"), chọn `Năm học` và `Khoản thu`.
3. Đánh dấu `Điểm danh riêng` nếu lớp cần điểm danh riêng (ví dụ lớp buổi tối). Hiện đây chỉ là đánh dấu, chức năng điểm danh sẽ có sau.
4. Bấm `Lưu lớp ngoại khóa`.

![Thêm lớp ngoại khóa](ngoai-khoa-them-lop.jpg)

![Danh sách lớp ngoại khóa](ngoai-khoa-danh-sach.jpg)

> Nhiều lớp có thể dùng chung một khoản thu, nên dùng chung một giá. Muốn lớp có giá khác, hãy tạo khoản thu Ngoại khóa khác. Nút `Sửa giá` trong trang lớp sẽ đổi giá cho **mọi lớp** dùng chung khoản thu đó.

## Thêm học sinh vào lớp

1. Bấm `Xem thành viên` ở dòng của lớp.
2. Bấm `Thêm học sinh`, lọc theo lớp chính thức hoặc tìm tên, đánh dấu học sinh.
3. Chọn `Hiệu lực từ`, nhập `Lý do` rồi bấm `Thêm học sinh đã chọn`.

![Chọn học sinh tham gia lớp ngoại khóa](ngoai-khoa-them-hoc-sinh.jpg)

![Trang chi tiết lớp với danh sách thành viên](ngoai-khoa-chi-tiet.jpg)

## Kết thúc tham gia

Đánh dấu học sinh trong bảng thành viên, bấm `Kết thúc tham gia`, chọn `Ngày kết thúc` và lý do. Học sinh vẫn được tính tháng có ngày tham gia cuối cùng.

## Cách tính tiền

- Học sinh tham gia **ít nhất một ngày** trong tháng được tính **trọn giá** tháng đó; hệ thống không tự chia theo ngày.
- Học sinh vào hoặc nghỉ giữa tháng, hoặc chuyển giữa các lớp dùng chung khoản thu, được đánh dấu trên hóa đơn nháp (chuyển lớp chỉ tính một lần). Nếu cần thu ít hơn, kế toán sửa số lượng hoặc đơn giá trên hóa đơn kèm lý do.
- Có thể loại cả lớp khỏi một đợt thu riêng lẻ bằng `Loại khỏi đợt này` trong trang đợt thu (xem [Tạo đợt thu](guide:tao-dot-thu)).

## Học sinh "Chỉ ngoại khóa"

Học sinh chỉ học ngoại khóa (không học chính khóa) được tạo ở `Danh bộ › Học sinh`, phần `Ghi danh` chọn **Chỉ ngoại khóa**. Học sinh này không có lớp chính thức và chỉ được thu các khoản của lớp ngoại khóa đang tham gia (hoặc khoản linh hoạt chọn đích danh).

![Chọn "Chỉ ngoại khóa" khi tạo học sinh](hoc-sinh-chi-ngoai-khoa.jpg)

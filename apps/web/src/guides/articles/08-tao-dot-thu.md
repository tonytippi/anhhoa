---
title: Tạo đợt thu và hóa đơn nháp
summary: Mở đợt thu của tháng, thêm khoản linh hoạt, xem trước danh sách và tạo hóa đơn nháp cho cả trường.
order: 8
requires: collection-runs
---
Mở `Tài chính › Đợt thu`. Một đợt thu đi qua 4 bước: **Nháp → Sẵn sàng tạo hóa đơn → Đã tạo hóa đơn → Đã đóng**.

## 1. Tạo đợt thu

Bấm `Tạo đợt thu`, chọn `Năm học` và `Tháng thu`, rồi `Xác nhận tạo hoặc mở`. Nếu tháng đó đã có đợt thu, hệ thống mở đợt có sẵn.

![Chọn tháng thu](dot-thu-tao.jpg)

## 2. Kiểm tra khoản thu trong đợt

Các **khoản cố định** được tự thêm khi mở đợt. Khoản tự trừ theo ngày nghỉ (ví dụ tiền ăn) tự lấy số ngày học của tháng làm số lượng.

Để thu thêm khoản **linh hoạt** (dã ngoại, đồng phục…), bấm `Thêm khoản thu`:

1. Chọn `Khoản thu` và `Số lượng`.
2. Chọn `Phạm vi`: `Toàn bộ`, `Lớp chính thức` (đánh dấu các lớp) hoặc `Học sinh cụ thể` (lọc và chọn từng em; bộ lọc lớp có cả mục "Chỉ ngoại khóa").
3. Bấm `Lưu khoản thu mẫu`.

![Thêm Phí dã ngoại cho lớp Lá 1](dot-thu-them-khoan-thu.jpg)

![Bảng khoản thu của đợt sau khi xem trước](dot-thu-khoan-thu-trong-dot.jpg)

Dùng `Sửa` để đổi số lượng/phạm vi, `Bỏ` để bỏ khoản khỏi đợt này (không ảnh hưởng danh mục khoản thu).

Bảng **Lớp ngoại khóa trong đợt** liệt kê các lớp ngoại khóa đang hoạt động và số học sinh tính trong tháng. Bấm `Loại khỏi đợt này` nếu tháng này không thu lớp đó (ví dụ lớp nghỉ cả tháng); `Khôi phục` để tính lại.

![Lớp ngoại khóa trong đợt](dot-thu-ngoai-khoa-trong-dot.jpg)

## 3. Xem trước

Bấm `Xem trước từ máy chủ`. Hệ thống tính tạm cho từng khoản và từng học sinh, gồm ưu đãi, phần bớt và thuế GTGT.

![Tạm tính theo dòng khoản thu](dot-thu-xem-truoc-tong.jpg)

Kiểm tra kỹ bảng **Học sinh đủ điều kiện** (cột `Lý do ưu đãi` cho biết vì sao em được giảm) và bảng **Học sinh bị bỏ qua** (kèm lý do, ví dụ chưa có lớp vào đầu tháng, đã có hóa đơn trong đợt).

![Danh sách học sinh đủ điều kiện](dot-thu-xem-truoc-hoc-sinh.jpg)

Khi số liệu đúng, bấm `Xác nhận xem trước và chuyển sẵn sàng`.

> Nếu sau khi xem trước có ai đó sửa khoản thu, ưu đãi hoặc danh bộ, hệ thống báo "Bản xem trước đã cũ. Hãy tải lại trước khi tiếp tục." — bấm `Xem trước từ máy chủ` lại.

## 4. Tạo hóa đơn nháp

Ở trạng thái `Sẵn sàng tạo hóa đơn`, bấm `Tạo hóa đơn nháp` và xác nhận. Hệ thống đánh giá lại danh sách học sinh rồi tạo hóa đơn cho từng em.

![Xác nhận tạo hóa đơn nháp](dot-thu-tao-hoa-don-xac-nhan.jpg)

Với trường đông học sinh, việc tạo có thể mất vài phút; màn hình hiện tiến độ "Đang xử lý…". Không cần bấm lại, có thể rời trang và quay lại sau.

![Tiến độ tạo hóa đơn](dot-thu-tien-do.jpg)

Xong, đợt thu chuyển sang `Đã tạo hóa đơn` và hiện bảng **Hóa đơn trong đợt**. Mỗi dòng là một phiếu thu của một học sinh, gồm phần tài khoản trường và phần tài khoản cá nhân.

![Danh sách hóa đơn nháp trong đợt](dot-thu-da-tao-hoa-don.jpg)

Học sinh nhập học sau khi đã tạo hóa đơn: bấm `Thêm học sinh` trong bảng này để tạo hóa đơn bổ sung.

Tiếp theo: [Rà soát và phát hành hóa đơn](guide:ra-soat-phat-hanh).

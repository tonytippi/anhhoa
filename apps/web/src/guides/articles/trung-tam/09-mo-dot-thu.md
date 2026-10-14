---
title: Mở đợt thu theo lớp và tạo hóa đơn nháp
summary: Mở đợt thu cho một lớp theo tên và ngày của kỳ, kiểm tra khoản thu và dịch vụ, xem trước và tạo hóa đơn nháp.
order: 9
requires: collection-runs
---
Mở `Tài chính › Đợt thu`. Danh sách có cột `Lớp`, `Tên đợt`, `Kỳ`, `Trạng thái` và `Đã thu / Phải thu (đ)`; lọc theo trạng thái ở ô `Lọc trạng thái`. Một đợt thu đi qua 4 bước: **Nháp → Sẵn sàng tạo hóa đơn → Đã tạo hóa đơn → Đã đóng**.

![Danh sách đợt thu của nhiều lớp, mỗi lớp một chuỗi kỳ](tt-dot-thu-danh-sach.jpg)

## 1. Mở đợt thu cho một lớp

1. Bấm `Mở đợt thu`.
2. Chọn `Lớp` (chỉ lớp đang hoạt động).
3. Nhập `Tên đợt`, ví dụ "Unit 3". Tên này hiện trên hóa đơn, trang `Thu tiền`, báo cáo và ứng dụng phụ huynh, kèm tên lớp.
4. Nhập `Từ ngày` và `Đến ngày` của kỳ, rồi bấm `Xác nhận mở đợt thu`.

![Mở đợt thu Unit 1 cho lớp Starters 1](tt-dot-thu-mo.jpg)

Hai đợt của **cùng một lớp** không được trùng ngày; hệ thống báo "Kỳ này trùng với đợt … của lớp …". Đợt của lớp khác không ảnh hưởng.

## 2. Khoản thu trong đợt

- **Khoản thu cố định** áp dụng cho `Toàn trường` hoặc cho lớp này được tự thêm khi mở đợt, số lượng 1, áp dụng `Cả lớp` (ghi chú "Tự thêm khi mở đợt thu"). Gắn lớp cho khoản thu ở [Quản lý khoản thu](guide:khoan-thu).
- **Khoản thu linh hoạt**: bấm `Thêm khoản thu`, chọn khoản thu, `Số lượng` và `Phạm vi` là `Cả lớp` hoặc `Học sinh cụ thể`, rồi `Lưu khoản thu mẫu`.

![Thêm Giáo trình cho cả lớp](tt-dot-thu-them-khoan-thu.jpg)

![Khoản thu trong đợt: học phí cố định tự thêm và giáo trình cho cả lớp](tt-dot-thu-khoan-thu-trong-dot.jpg)

**Từ đợt thứ hai** của lớp, hệ thống sao chép các dòng linh hoạt phạm vi `Cả lớp` của đợt liền trước; hộp `Mở đợt thu` báo trước điều này khi bạn chọn lớp. Dòng dành cho học sinh cụ thể không được sao chép; cần thì thêm lại.

![Đợt thứ hai: hệ thống báo sẽ sao chép khoản thu linh hoạt từ đợt trước](tt-dot-thu-mo-dot-sau.jpg)

Khi đợt còn `Nháp`, dùng `Sửa` để đổi số lượng/phạm vi, `Bỏ` để bỏ khoản khỏi đợt này (không ảnh hưởng danh mục khoản thu). Khoản cố định chỉ sửa được số lượng.

> [!WARNING]
> Mức học phí của đợt lấy từ khoản thu cố định đang gắn lớp **lúc mở đợt**. Muốn lớp sang mức giá khác, sửa danh sách lớp của khoản thu **trước khi mở đợt**; đợt đã mở không đổi theo.

## 3. Dịch vụ trong đợt

Bảng **Dịch vụ trong đợt** liệt kê các dịch vụ đang hoạt động, số học sinh **của lớp này** dùng dịch vụ trong kỳ và số tạm tính. Bấm `Loại khỏi đợt này` nếu kỳ này không thu dịch vụ đó cho lớp (ví dụ lớp không dùng xe trong unit này); `Khôi phục` để tính lại. Xem [Dịch vụ](guide:dich-vu).

![Dịch vụ trong đợt chỉ tính học sinh của lớp](tt-dot-thu-dich-vu-trong-dot.jpg)

## 4. Xem trước

Bấm `Xem trước từ máy chủ`. Hệ thống xác định học sinh thuộc lớp **ít nhất một ngày trong kỳ** và tính tạm cho từng khoản, gồm ưu đãi và thuế GTGT.

![Kết quả xem trước: tạm tính theo khoản thu và theo học sinh](tt-dot-thu-xem-truoc.jpg)

Kiểm tra bảng **Học sinh đủ điều kiện** và bảng **Học sinh bị bỏ qua** (kèm lý do). Khi số liệu đúng, bấm `Xác nhận xem trước và chuyển sẵn sàng`.

> Nếu sau khi xem trước có ai đó sửa khoản thu, ưu đãi hoặc danh bộ, hệ thống báo "Bản xem trước đã cũ. Hãy tải lại trước khi tiếp tục." — bấm `Xem trước từ máy chủ` lại.

## 5. Tạo hóa đơn nháp

Ở trạng thái `Sẵn sàng tạo hóa đơn`, bấm `Tạo hóa đơn nháp` và xác nhận. Hệ thống đánh giá lại danh sách học sinh rồi tạo hóa đơn cho từng em; màn hình hiện tiến độ "Đang xử lý…", không cần bấm lại.

![Xác nhận tạo hóa đơn nháp](tt-dot-thu-tao-hoa-don-xac-nhan.jpg)

Xong, đợt thu chuyển sang `Đã tạo hóa đơn` và hiện bảng **Hóa đơn trong đợt**. Mỗi dòng là một phiếu thu của một học sinh, gồm phần tài khoản trường và phần tài khoản cá nhân. Nhãn `Trùng kỳ` cạnh tên học sinh cần xử lý trước khi phát hành, xem [Học sinh vào giữa kỳ, chuyển lớp, nghỉ học](guide:hoc-sinh-giua-ky).

![Hóa đơn nháp trong đợt](tt-dot-thu-hoa-don-trong-dot.jpg)

Tiếp theo: [Rà soát và phát hành hóa đơn](guide:ra-soat-phat-hanh).

## Lưu ý cho kế toán

- **Doanh thu ghi theo tháng bắt đầu kỳ.** Học phí của cả unit được ghi nhận trọn vào tháng có ngày bắt đầu của đợt, dù unit kéo dài sang tháng sau. Báo cáo theo tháng vì vậy không chia đều học phí theo số buổi của từng tháng.
- **Đợt sau chỉ phát hành khi đợt trước của cùng lớp đã đóng.** Bạn vẫn mở đợt, xem trước và tạo hóa đơn nháp cho kỳ sau được trong lúc chờ. Xem [Đóng đợt thu](guide:dong-dot-thu).

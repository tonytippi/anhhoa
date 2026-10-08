---
title: Quản lý khoản thu
summary: Thêm, sửa, ngừng áp dụng khoản thu; chọn đúng nhóm, đơn vị, giá hoàn trả và mức thuế.
order: 5
requires: receivables
---
Mở `Tài chính › Khoản thu`. Đây là danh mục mọi khoản trường thu (học phí, tiền ăn, dã ngoại, ngoại khóa…). Hóa đơn được tạo từ danh mục này.

![Danh sách khoản thu](khoan-thu-danh-sach.jpg)

## Ba nhóm khoản thu

- **Khoản thu cố định** — tự thêm vào mọi đợt thu cho toàn bộ học sinh (ví dụ học phí, tiền ăn).
- **Khoản thu linh hoạt** — chỉ thêm vào đợt thu khi cần, chọn phạm vi toàn bộ, theo lớp hoặc từng học sinh (ví dụ dã ngoại, đồng phục).
- **Ngoại khóa** — thu theo lớp ngoại khóa; gắn khoản thu vào lớp ở trang [Lớp ngoại khóa](guide:lop-ngoai-khoa).

> [!WARNING]
> Sau khi khoản thu đã xuất hiện trên hóa đơn, đợt thu hoặc lớp ngoại khóa thì **không đổi được nhóm**. Hãy chọn nhóm cẩn thận ngay từ đầu.

## Thêm khoản thu

1. Bấm `Thêm khoản thu`.
2. Điền `Tên khoản thu` và (không bắt buộc) `Mã khoản thu`.
3. Chọn `Nhóm khoản thu`.
4. Nhập `Giá / đơn vị (chưa VAT)` và `Đơn vị tính` (tháng, ngày, lần, bộ…).
5. Nếu khoản này được trả lại khi học sinh nghỉ, nhập `Giá hoàn trả / đơn vị (chưa VAT)`. Để 0 nếu không hoàn.
6. Chọn `Mức thuế suất`. Mức thuế quyết định tiền vào tài khoản nào:
   - "Không kê khai nộp thuế" → tài khoản cá nhân.
   - Các mức còn lại → tài khoản trường.
7. Bấm `Lưu khoản thu`.

![Thêm khoản Tiền ăn: cố định, tính theo ngày, tự trừ ngày nghỉ, thuế 8%](khoan-thu-them.jpg)

### Khoản tự trừ theo ngày nghỉ có phép (ví dụ tiền ăn)

Đánh dấu `Tự động trừ theo ngày nghỉ có phép` (chỉ bật được khi giá hoàn trả lớn hơn 0). Khi đó:

- Mỗi đợt thu tự lấy **số lượng = số ngày học trong tháng** (theo `Ngày học trong tuần` và lịch nghỉ lễ). Vì vậy hãy đặt **đơn vị tính là "ngày" và giá là giá một ngày**.
- Hệ thống đề xuất phần **Bớt = số ngày nghỉ có phép của tháng trước × giá hoàn trả**. Kế toán vẫn sửa được trên từng hóa đơn (kèm lý do).

> Nếu không bật tự trừ, kế toán tự nhập phần Bớt trên dòng hóa đơn khi cần.

## Sửa khoản thu

Bấm `...` ở cột `Tùy chọn` của dòng, chọn `Chỉnh sửa`.

![Menu tùy chọn của khoản thu](khoan-thu-menu.jpg)

Sửa thông tin cần thiết, nhập `Lý do` (bắt buộc) rồi bấm `Lưu thay đổi`.

![Sửa khoản Tiền ăn sang giá theo ngày](khoan-thu-sua.jpg)

- Hóa đơn **đã tạo** giữ nguyên tên, đơn vị, giá và mức thuế lúc tạo.
- Giá mới chỉ áp dụng cho dòng hóa đơn thêm mới hoặc làm mới sau đó. Nếu đợt thu tháng này còn ở trạng thái nháp, hãy `Xem trước từ máy chủ` lại.
- Đơn giá không được thấp hơn giá hoàn trả.

## Ngừng áp dụng

Chọn `Ngừng áp dụng` trong menu, nhập lý do và xác nhận. Khoản ngừng áp dụng không được thêm vào đợt thu mới nhưng vẫn giữ để đối soát lịch sử; có thể `Kích hoạt` lại.

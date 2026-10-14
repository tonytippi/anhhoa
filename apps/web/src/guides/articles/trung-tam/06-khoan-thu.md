---
title: Quản lý khoản thu
summary: Thêm, sửa, ngừng áp dụng khoản thu; mỗi mức học phí là một khoản thu gắn các lớp của mình.
order: 6
requires: receivables
pages: receivables, classes
---
Mở `Tài chính › Khoản thu`. Đây là danh mục mọi khoản trung tâm thu (học phí, giáo trình, đưa đón…). Hóa đơn được tạo từ danh mục này.

## Ba nhóm khoản thu

- **Khoản thu cố định** — tự thêm vào mỗi đợt thu khi mở đợt, cho mọi lớp hoặc chỉ các lớp được chọn (ví dụ học phí theo trình độ).
- **Khoản thu linh hoạt** — chỉ thêm vào đợt thu khi cần, cho cả lớp hoặc từng học sinh (ví dụ giáo trình, phí thi).
- **Dịch vụ** — thu theo học sinh dùng dịch vụ (ví dụ đưa đón); gắn khoản thu vào dịch vụ ở trang [Dịch vụ](guide:dich-vu).

> [!WARNING]
> Sau khi khoản thu đã xuất hiện trên hóa đơn, đợt thu hoặc gắn vào dịch vụ thì **không đổi được nhóm**. Hãy chọn nhóm cẩn thận ngay từ đầu.

## Thêm khoản thu

1. Bấm `Thêm khoản thu`.
2. Điền `Tên khoản thu` và (không bắt buộc) `Mã khoản thu`.
3. Chọn `Nhóm khoản thu`. Với `Khoản thu cố định`, chọn thêm `Áp dụng cho`: `Toàn trường` (mọi lớp của trung tâm) hoặc `Các lớp được chọn` (đánh dấu ít nhất một lớp).
4. Nhập `Giá / đơn vị (chưa VAT)` và `Đơn vị tính` (unit, kỳ, cuốn, lần…). Khoản cố định được thêm vào đợt với số lượng 1, nên giá nên là **giá của cả một kỳ**.
5. `Giá hoàn trả / đơn vị (chưa VAT)`: để 0. Trung tâm không tự hoàn tiền khi học sinh nghỉ; mục `Tự động trừ theo ngày nghỉ có phép` cũng không có tác dụng với đợt thu theo lớp, không cần đánh dấu.
6. Chọn `Mức thuế suất`. Mức thuế quyết định tiền vào tài khoản nào:
   - "Không kê khai nộp thuế" → tài khoản cá nhân.
   - Các mức còn lại → tài khoản trường.
7. Bấm `Lưu khoản thu`.

## Học phí theo trình độ: mỗi mức giá một khoản thu

Giá nằm trên khoản thu, không nằm trên lớp. Vì vậy mỗi mức học phí là **một khoản thu cố định riêng** (ví dụ "Học phí Starter", "Học phí Movers"), mỗi khoản chọn `Các lớp được chọn` và đánh dấu các lớp học mức đó.

Danh sách lớp của khoản thu cố định sửa được ở hai nơi:

- Trang `Khoản thu`: sửa khoản thu, đổi mục `Lớp áp dụng`.
- Theo từng lớp: mở `Danh bộ › Lớp học`, bấm `Khoản thu cố định` ở dòng của lớp, đánh dấu các khoản áp dụng cho lớp rồi `Lưu khoản thu cố định`. Khoản `Toàn trường` luôn được đánh dấu và không bỏ được ở đây.

Cột `Khoản thu` của danh sách ghi `Toàn trường`, tên các lớp, hoặc `Chưa gán lớp` khi khoản theo lớp chưa còn lớp nào.

Lưu ý cho kế toán:

- **Đổi lớp không sửa đợt thu đã mở.** Muốn chuyển một lớp sang mức giá khác (ví dụ lên trình độ mới), hãy sửa danh sách lớp của các khoản thu **trước khi mở đợt kế tiếp** của lớp đó.
- **Lớp mới chưa gắn khoản học phí nào** thì đợt thu của lớp chỉ có khoản `Toàn trường`. Kiểm tra cột `Khoản thu cố định` ở trang `Lớp học` trước khi mở đợt.
- **Thôi áp dụng cho một lớp:** bỏ đánh dấu khoản thu ở `Danh bộ › Lớp học › Khoản thu cố định`. Nếu đó là lớp cuối cùng, khoản thu ghi `Chưa gán lớp` và không được thêm cho lớp nào cho đến khi gắn lại.

## Sửa khoản thu

Bấm `...` ở cột `Tùy chọn` của dòng, chọn `Chỉnh sửa`. Sửa thông tin cần thiết, nhập `Lý do` (bắt buộc) rồi bấm `Lưu thay đổi`.

- Hóa đơn **đã tạo** giữ nguyên tên, đơn vị, giá và mức thuế lúc tạo.
- Giá mới chỉ áp dụng cho dòng hóa đơn thêm mới hoặc làm mới sau đó. Nếu đợt thu của lớp còn `Nháp`, hãy `Xem trước từ máy chủ` lại.
- Đổi `Áp dụng cho` của khoản thu cố định chỉ có hiệu lực với đợt thu mở sau đó; đợt đã mở giữ nguyên.

## Ngừng áp dụng

Chọn `Ngừng áp dụng` trong menu, nhập lý do và xác nhận. Khoản ngừng áp dụng không được thêm vào đợt thu mới nhưng vẫn giữ để đối soát lịch sử; có thể `Kích hoạt` lại.

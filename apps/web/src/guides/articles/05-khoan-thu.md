---
title: Quản lý khoản thu
summary: Thêm, sửa, ngừng áp dụng khoản thu; chọn đúng nhóm, đơn vị, giá hoàn trả và mức thuế.
order: 5
requires: receivables
---
Mở `Tài chính › Khoản thu`. Đây là danh mục mọi khoản trường thu (học phí, tiền ăn, dã ngoại, ngoại khóa…). Hóa đơn được tạo từ danh mục này.

![Danh sách khoản thu](khoan-thu-danh-sach.jpg)

## Ba nhóm khoản thu

- **Khoản thu cố định** — tự thêm vào đợt thu, cho toàn trường hoặc chỉ các lớp được chọn (ví dụ học phí, tiền ăn). Xem mục "Khoản thu cố định áp dụng cho lớp nào" bên dưới.
- **Khoản thu linh hoạt** — chỉ thêm vào đợt thu khi cần, chọn phạm vi toàn bộ, theo lớp hoặc từng học sinh (ví dụ dã ngoại, đồng phục).
- **Ngoại khóa** — thu theo lớp ngoại khóa; gắn khoản thu vào lớp ở trang [Lớp ngoại khóa](guide:lop-ngoai-khoa).

> [!WARNING]
> Sau khi khoản thu đã xuất hiện trên hóa đơn, đợt thu hoặc lớp ngoại khóa thì **không đổi được nhóm**. Hãy chọn nhóm cẩn thận ngay từ đầu.

## Thêm khoản thu

1. Bấm `Thêm khoản thu`.
2. Điền `Tên khoản thu` và (không bắt buộc) `Mã khoản thu`.
3. Chọn `Nhóm khoản thu`. Với `Khoản thu cố định`, chọn thêm `Áp dụng cho`: `Toàn trường` hoặc `Các lớp được chọn` (đánh dấu ít nhất một lớp).
4. Nhập `Giá / đơn vị (chưa VAT)` và `Đơn vị tính` (tháng, ngày, lần, bộ…).
5. Nếu khoản này được trả lại khi học sinh nghỉ, nhập `Giá hoàn trả / đơn vị (chưa VAT)`. Để 0 nếu không hoàn.
6. Chọn `Mức thuế suất`. Mức thuế quyết định tiền vào tài khoản nào:
   - "Không kê khai nộp thuế" → tài khoản cá nhân.
   - Các mức còn lại → tài khoản trường.
7. Bấm `Lưu khoản thu`.

![Thêm khoản Tiền ăn: cố định, tính theo ngày, tự trừ ngày nghỉ, thuế 8%](khoan-thu-them.jpg)

### Khoản thu cố định áp dụng cho lớp nào

Mỗi khoản thu cố định có mục `Áp dụng cho`:

- `Toàn trường` (mặc định) — mọi đợt thu tự thêm khoản này cho tất cả học sinh.
- `Các lớp được chọn` — đợt thu chỉ tự thêm khoản này cho học sinh của các lớp đã đánh dấu. Ở trung tâm, chỉ đợt thu của các lớp đó có khoản này.

Cột `Khoản thu` của danh sách ghi `Toàn trường`, tên các lớp, hoặc `Chưa gán lớp` khi khoản theo lớp chưa còn lớp nào. Trên đợt thu, phạm vi của khoản cố định không sửa được; chỉ sửa số lượng hoặc bỏ dòng khi đợt còn `Nháp`.

Lưu ý cho kế toán:

- **Giá nằm trên khoản thu.** Mỗi mức giá là một khoản thu riêng (ví dụ "Học phí Mầm" và "Học phí Lá"), mỗi khoản gắn các lớp của mình.
- **Đổi lớp không sửa đợt thu đã mở.** Muốn chuyển một lớp sang mức giá khác, hãy sửa danh sách lớp của các khoản thu **trước khi mở đợt thu kế tiếp**.
- **Gắn theo từng lớp:** danh sách lớp của khoản thu cố định cũng sửa được từ phía lớp: mở `Danh bộ › Lớp học`, bấm `Khoản thu cố định` ở dòng của lớp, đánh dấu các khoản áp dụng cho lớp rồi `Lưu khoản thu cố định`. Khoản `Toàn trường` luôn được đánh dấu và không bỏ được ở đây.
- **Sang năm học mới phải chọn lại lớp** (trường mầm non): lớp thuộc một năm học, nên khoản thu chưa gắn lớp của năm mới sẽ không được thêm vào đợt thu của năm đó.
- **Thôi áp dụng cho một lớp:** bỏ đánh dấu khoản thu ở `Danh bộ › Lớp học › Khoản thu cố định`, kể cả khi đó là lớp duy nhất còn lại. Khoản thu khi ấy ghi `Chưa gán lớp` và không được thêm cho lớp nào cho đến khi gắn lại. Chọn `Toàn trường` nghĩa là thu của mọi học sinh.

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
- Đổi `Áp dụng cho` của khoản thu cố định chỉ có hiệu lực với đợt thu mở sau đó; đợt đã mở giữ nguyên.

## Ngừng áp dụng

Chọn `Ngừng áp dụng` trong menu, nhập lý do và xác nhận. Khoản ngừng áp dụng không được thêm vào đợt thu mới nhưng vẫn giữ để đối soát lịch sử; có thể `Kích hoạt` lại.

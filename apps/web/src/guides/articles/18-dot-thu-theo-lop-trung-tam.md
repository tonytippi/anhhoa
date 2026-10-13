---
title: Đợt thu theo lớp cho trung tâm
summary: Mở đợt thu cho từng lớp theo tên và ngày của kỳ, thu dịch vụ, thêm học sinh vào giữa kỳ, xử lý "Trùng kỳ" và các lưu ý cho kế toán.
order: 8.5
requires: collection-runs
runScope: CLASS
---
Trung tâm thu tiền theo **từng lớp và từng kỳ** (ví dụ một unit), không theo tháng của cả trường. Mỗi lớp có chuỗi đợt thu riêng; nhiều lớp có thể có đợt đang mở cùng lúc. Một đợt thu vẫn đi qua 4 bước: **Nháp → Sẵn sàng tạo hóa đơn → Đã tạo hóa đơn → Đã đóng**.

## 1. Mở đợt thu cho một lớp

1. Mở `Tài chính › Đợt thu`, bấm `Mở đợt thu`.
2. Chọn `Lớp` (chỉ lớp đang hoạt động).
3. Nhập `Tên đợt`, ví dụ "Unit 3". Tên này hiện trên hóa đơn, trang `Thu tiền` và báo cáo, kèm tên lớp.
4. Nhập `Từ ngày` và `Đến ngày` của kỳ, rồi bấm `Xác nhận mở đợt thu`.

Hai đợt của **cùng một lớp** không được trùng ngày; hệ thống báo rõ đợt nào đang trùng. Đợt của lớp khác không ảnh hưởng.

## 2. Khoản thu của đợt

- **Khoản thu cố định** áp dụng cho `Toàn trường` hoặc cho lớp này được tự thêm mỗi khi mở đợt, số lượng 1, tính cả lớp. Gắn lớp cho khoản thu ở `Tài chính › Khoản thu`, mục `Áp dụng cho`; xem [Quản lý khoản thu](guide:khoan-thu).
- **Khoản thu linh hoạt**: bấm `Thêm khoản thu`, chọn khoản thu, số lượng và phạm vi `Cả lớp` hoặc `Học sinh cụ thể`. **Từ đợt thứ hai**, hệ thống sao chép các dòng linh hoạt phạm vi `Cả lớp` của đợt liền trước cùng lớp. Dòng dành cho học sinh cụ thể không được sao chép; cần thì thêm lại.
- Khi đợt còn `Nháp`, bạn sửa số lượng, thêm hoặc bỏ dòng tùy ý. Khoản cố định không đổi được phạm vi trên đợt.

> [!WARNING]
> Lưu ý cho kế toán: giá nằm trên khoản thu, nên mỗi mức học phí là một khoản thu cố định riêng, gắn các lớp của mình. Muốn chuyển lớp sang mức giá khác, sửa danh sách lớp của các khoản thu (ở trang `Khoản thu`, hoặc theo từng lớp ở `Danh bộ › Lớp học › Khoản thu cố định`) **trước khi mở đợt kế tiếp**; đợt đã mở không đổi. Khoản cố định `Toàn trường` được thêm vào đợt của mọi lớp.

## 3. Dịch vụ (đưa đón…)

Dịch vụ được tạo ở `Danh bộ › Dịch vụ`, mỗi dịch vụ gắn một khoản thu nhóm **Dịch vụ**. Trong đợt thu, bảng **Dịch vụ trong đợt** liệt kê các dịch vụ được tính:

- Chỉ tính học sinh **của lớp này** đang dùng dịch vụ ít nhất một ngày trong kỳ của đợt.
- Số lượng mặc định là 1 cho cả kỳ; hệ thống không tự chia theo ngày. Cần thu ít hơn thì sửa trên hóa đơn nháp.
- Bấm `Loại khỏi đợt này` nếu kỳ này không thu dịch vụ đó cho lớp; `Khôi phục` để tính lại. Việc này chỉ áp dụng cho đợt đang mở.

## 4. Xem trước, tạo và phát hành hóa đơn

Bấm `Xem trước từ máy chủ`, kiểm tra danh sách học sinh của lớp trong kỳ, rồi chuyển sẵn sàng và `Tạo hóa đơn nháp`. Các bước rà soát, phát hành và thu tiền giống mọi đợt thu: xem [Rà soát và phát hành hóa đơn](guide:ra-soat-phat-hanh) và [Ghi nhận thu tiền](guide:thu-tien).

## 5. Học sinh vào lớp giữa kỳ

Học sinh được xếp vào lớp sau khi đợt đã tạo hóa đơn: mở đợt thu, bấm `Thêm học sinh` trong bảng hóa đơn để tạo hóa đơn bổ sung cho em. Hóa đơn bổ sung tính trọn kỳ; nếu chỉ thu phần còn lại của unit, hãy sửa số lượng hoặc dùng `Bớt` trên hóa đơn nháp, kèm lý do.

## 6. Nhãn "Trùng kỳ"

Nhãn `Trùng kỳ` cạnh tên học sinh nghĩa là em **đã có cùng khoản thu đó** trên một đợt thu của **lớp khác** có ngày trùng với kỳ này (thường do chuyển lớp giữa kỳ, hoặc học hai lớp cùng lúc).

Hệ thống không tự bỏ dòng nào. Kế toán mở hóa đơn nháp và quyết định trước khi phát hành:

- Thu đủ cả hai nếu học sinh thật sự học cả hai lớp.
- Giảm số lượng, dùng `Bớt` hoặc bỏ dòng nếu khoản đó đã thu ở lớp kia.

## 7. Đóng đợt trước khi phát hành đợt sau

Hóa đơn của một đợt chỉ phát hành được sau khi **đợt trước của cùng lớp đã đóng**. Nếu chưa, trang đợt thu báo "Chưa thể phát hành hóa đơn của đợt này" kèm tên đợt cần đóng. Bạn vẫn mở đợt, xem trước và tạo hóa đơn nháp cho kỳ sau được; chỉ việc phát hành phải chờ. Xem [Đóng đợt thu](guide:dong-dot-thu).

> [!WARNING]
> Đóng đợt thu không thể mở lại. Hãy thêm xong học sinh vào giữa kỳ và xử lý xong các dòng `Trùng kỳ` trước khi đóng.

## 8. Công nợ cũ đi theo học sinh

Hóa đơn đã phát hành nhưng chưa thu của đợt đã đóng **đi theo học sinh, kể cả khi em đã chuyển sang lớp khác**. Khi đợt mới của lớp hiện tại đã tạo hóa đơn nháp, mục `Công nợ kỳ trước` liệt kê các hóa đơn đó; bấm `Chuyển vào hóa đơn đợt này` để phụ huynh nộp cùng. Hệ thống không tự gộp và thao tác không hoàn tác được: xem [Chuyển công nợ kỳ trước](guide:chuyen-cong-no).

## Lưu ý cho kế toán

- **Doanh thu ghi theo tháng bắt đầu kỳ.** Học phí của cả unit được ghi nhận trọn vào tháng có ngày bắt đầu của đợt, dù unit kéo dài sang tháng sau. Báo cáo theo tháng vì vậy không chia đều học phí theo số buổi của từng tháng.
- **Nghỉ học không tự hoàn tiền.** Hệ thống không tự trừ tiền khi học sinh nghỉ buổi. Muốn giảm, kế toán nhập `Bớt` bằng tay trên dòng hóa đơn, kèm lý do.
- **Học sinh nghỉ rồi quay lại là hồ sơ mới.** Em được tạo lại như một học sinh mới. Hóa đơn chưa thu của hồ sơ cũ **không chuyển sang** hồ sơ mới và không hiện ở mục `Công nợ kỳ trước` của hồ sơ mới; phải thu trên hồ sơ cũ ở trang `Thu tiền`.
- **Phụ huynh có con học ở hai trường.** Cả hai trường phải nhập **cùng một email** của phụ huynh thì phụ huynh mới thấy cả hai trường trong một ứng dụng. Khác email là hai tài khoản riêng.

---
title: Rà soát và phát hành hóa đơn
summary: Kiểm tra từng hóa đơn nháp, xử lý dòng Trùng kỳ, sửa số lượng hoặc phần bớt, phát hành và gửi ảnh hóa đơn cho phụ huynh.
order: 10
requires: collection-runs
---
Trong đợt thu ở trạng thái `Đã tạo hóa đơn`, bấm `Rà soát hóa đơn` ở dòng học sinh đầu tiên. Dùng `Học sinh trước` / `Học sinh tiếp theo` để đi lần lượt trong đợt. Sau khi phát hành, trang vẫn giữ hóa đơn vừa phát hành để bạn tải ảnh gửi phụ huynh; bấm `Học sinh kế tiếp` để sang hóa đơn nháp kế tiếp, hoặc `Về đợt thu` khi đã phát hành toàn bộ.

## Đọc hóa đơn

Phiếu thu chia theo tài khoản nhận: **Phần 1 · Thu vào tài khoản trường** (khoản có thuế) và **Phần 2 · Thu vào tài khoản cá nhân** (khoản không kê khai). Mỗi dòng có:

- Nhãn nguồn: `Cố định`, `Linh hoạt · Cả lớp`, `Dịch vụ · …`; và khi cần chú ý: `Vào/nghỉ giữa kỳ`, `Chuyển nhóm trong kỳ`, `Trùng kỳ`.
- `Số lượng`, `Đơn giá`, `Tổng trước giảm`
- `Ưu đãi` — do chính sách ưu đãi đã gán
- `Bớt` — phần giảm kế toán nhập tay (ví dụ học sinh vào giữa kỳ)
- `Thuế GTGT` — tính trên số tiền sau ưu đãi và bớt
- `Tổng phải thu`

![Hóa đơn nháp: phần tài khoản trường (giáo trình, đưa đón) và phần tài khoản cá nhân (học phí)](tt-hoa-don-chi-tiet.jpg)

## Sửa trên hóa đơn nháp

Hóa đơn nháp sửa trực tiếp trên bảng như bảng tính:

1. Sửa ô `Số lượng`, `Đơn giá` hoặc ô `Bớt`.
2. Khi đổi đơn giá, nhập **Lý do đổi đơn giá**. Khi nhập phần bớt, nhập **Lý do sửa phần bớt**.
3. Số in nghiêng là số dự kiến do hệ thống tính lại, chưa lưu. Bấm `Lưu thay đổi` (hoặc `Hoàn tác`).

Các thao tác khác: `Thêm dòng` để thêm khoản phát sinh riêng cho học sinh này, `Xóa` để bỏ một dòng, `Nguồn` để ghi chú căn cứ (ngày học, số buổi…).

> Trung tâm không có đề xuất tự trừ theo ngày nghỉ: học sinh nghỉ buổi vẫn thu đủ, trừ khi kế toán tự nhập `Bớt`.

### Dòng có nhãn Trùng kỳ

Học sinh **đã có cùng khoản thu đó** trên hóa đơn của một đợt thu **lớp khác** có ngày trùng với kỳ này (thường do chuyển lớp giữa kỳ hoặc học hai lớp cùng lúc). Hệ thống không tự bỏ dòng nào; kế toán quyết định:

- Thu đủ nếu học sinh thật sự học cả hai lớp.
- Giảm số lượng, dùng `Bớt` hoặc `Xóa` dòng nếu khoản đó đã thu ở lớp kia.

![Dòng học phí có nhãn Trùng kỳ: đã có trên hóa đơn đợt Starters 3 · Unit 2](tt-hoa-don-trung-ky.jpg)

![Bớt toàn bộ học phí trùng kỳ, kèm lý do](tt-hoa-don-sua-bot.jpg)

## Phát hành

Ở khung **Rà soát trước khi phát hành**, kiểm tra tài khoản nhận cho từng phần (chọn sẵn theo tài khoản mặc định của lớp), rồi bấm `Phát hành phiếu thu` (hoặc `Phát hành hóa đơn` nếu chỉ có một phần). Hộp xác nhận hiện tên học sinh, lớp, các dòng của từng phần và **Tổng cần thu** (đã gồm thuế GTGT), cùng tài khoản nhận của từng phần (vẫn đổi được tại đây). Kiểm tra lần cuối rồi bấm phát hành để hoàn tất. Hai phần được phát hành cùng lúc.

![Khung rà soát trước khi phát hành](tt-hoa-don-ra-soat-phat-hanh.jpg)

![Xác nhận phát hành phiếu thu](tt-hoa-don-xac-nhan-phat-hanh.jpg)

> [!WARNING]
> Sau khi phát hành, hóa đơn **không sửa trực tiếp được**. Nút phát hành bị khóa khi còn thay đổi chưa lưu, hoặc khi đợt trước của cùng lớp chưa đóng (trang báo "Đợt thu … của lớp … chưa đóng").

## Gửi thông tin thanh toán cho phụ huynh

Sau khi phát hành, khung **Thanh toán** hiện mã hóa đơn, hạn thanh toán, số tiền và tài khoản của từng phần, cùng nội dung chuyển khoản.

![Khung thanh toán sau khi phát hành](tt-hoa-don-thanh-toan.jpg)

Bấm `Xem ảnh hóa đơn` hoặc `Tải ảnh hóa đơn` để lấy ảnh thông báo học phí có mã VietQR, rồi gửi cho phụ huynh qua kênh liên lạc của trung tâm (Zalo, email…). Phụ huynh quét mã là đúng số tiền, đúng tài khoản và đúng nội dung chuyển khoản.

![Ảnh thông báo học phí có mã VietQR](tt-hoa-don-anh.jpg)

> Ảnh chỉ tạo được cho hóa đơn đã phát hành và chưa thu tiền. Phiếu thu hai phần nghĩa là phụ huynh cần chuyển khoản **hai lần** vào hai tài khoản.

> Nếu tổng của hóa đơn âm (bớt nhiều hơn số phải thu), phần âm **không hoàn ngay** mà được trừ vào hóa đơn kỳ sau của học sinh; hóa đơn đó tự đóng khi phát hành.

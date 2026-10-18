---
title: Rà soát, gửi duyệt và phát hành hóa đơn
summary: Kiểm tra từng hóa đơn nháp, xử lý dòng Trùng kỳ, sửa số lượng hoặc phần bớt, gửi duyệt, quản lý duyệt để phát hành, rồi gửi ảnh hóa đơn cho phụ huynh.
order: 10
requires: collection-runs
---
Trong đợt thu ở trạng thái `Duyệt & thu tiền`, bấm `Rà soát hóa đơn` ở dòng học sinh đầu tiên. Dùng `Học sinh trước` / `Học sinh tiếp theo` để đi lần lượt trong đợt. Sau khi gửi duyệt, trang vẫn giữ hóa đơn vừa gửi; bấm `Học sinh kế tiếp` để sang hóa đơn nháp kế tiếp, hoặc `Về đợt thu` khi đã gửi duyệt toàn bộ.

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

## Gửi duyệt

Mọi hóa đơn phải được **quản lý duyệt** trước khi đến phụ huynh. Kế toán rà soát xong từng hóa đơn thì gửi duyệt ngay, không cần chờ làm xong cả đợt.

Ở khung **Rà soát trước khi gửi duyệt**, mỗi phần hiện tài khoản nhận **theo tài khoản của lớp** (xem [Tài khoản thu của lớp](guide:tai-khoan-thu-cua-lop)). Bấm `Gửi duyệt phiếu thu` (hoặc `Gửi duyệt hóa đơn` nếu chỉ có một phần). Hộp xác nhận hiện tên học sinh, lớp, các dòng của từng phần và **Tổng cần thu** (đã gồm thuế GTGT); kiểm tra lần cuối rồi bấm gửi. Hóa đơn chuyển `Chờ duyệt`.

![Khung rà soát trước khi gửi duyệt: tài khoản theo lớp](tt-hoa-don-ra-soat-gui-duyet.jpg)

![Xác nhận gửi duyệt phiếu thu](tt-hoa-don-xac-nhan-gui-duyet.jpg)

> Chỉ khi lớp **chưa có** tài khoản mặc định, khung mới hiện ô chọn tài khoản cho lần gửi duyệt này.

Muốn gửi nhiều hóa đơn một lần: ở bảng hóa đơn của đợt thu, đánh dấu các dòng `Nháp` hoặc `Cần sửa` rồi bấm `Gửi duyệt` trên thanh phía trên bảng. Nếu có hóa đơn chưa gửi được (ví dụ chưa có tài khoản nhận), hộp thoại liệt kê từng hóa đơn và lý do; **không hóa đơn nào được gửi** cho đến khi bạn bỏ chọn hoặc xử lý các hóa đơn đó.

> [!WARNING]
> Hóa đơn `Chờ duyệt` **không sửa được**. Cần sửa thì **người gửi duyệt** bấm `Rút lại` (trên trang hóa đơn hoặc thanh chọn của đợt thu): hóa đơn về `Nháp`, sửa xong gửi duyệt lại. Người khác không thấy nút `Rút lại`; quản lý dùng `Trả lại` kèm ghi chú. Nút gửi duyệt bị khóa khi còn thay đổi chưa lưu trên dòng hóa đơn.

## Duyệt và gửi phụ huynh

Người có quyền **Duyệt hóa đơn** (xem [Cấp quyền đăng nhập](guide:cap-quyen-dang-nhap)) thấy số hóa đơn chờ duyệt cạnh mục `Đợt thu` trên menu. Có hai cách duyệt:

- **Từng hóa đơn**: mở hóa đơn `Chờ duyệt`, xem các dòng rồi bấm `Duyệt & gửi phụ huynh`.
- **Nhiều hóa đơn**: ở đợt thu, bấm `Chờ duyệt` trên thanh tiến độ để lọc, đánh dấu các dòng rồi bấm `Duyệt & gửi phụ huynh`. Hộp thoại hiện tổng phải thu, tổng phải hoàn, bảng theo lớp (tổng, bình quân mỗi học sinh, bình quân đợt trước) và danh sách **Cần chú ý** (dòng thêm tay, sửa đơn giá, ưu đãi, bớt, quyết toán, gói nộp trước). Bấm `Xem hóa đơn` để mở, hoặc `Trả lại` ngay tại đây.

Khi duyệt, hóa đơn được **phát hành**: hệ thống kiểm tra lại ưu đãi và tài khoản, khóa số tiền, rồi phụ huynh thấy hóa đơn trên app. Người gửi duyệt cũng được tự duyệt nếu có đủ cả hai quyền.

> [!WARNING]
> Không duyệt được khi đợt trước của cùng lớp chưa đóng (trang báo "Đợt thu … của lớp … chưa đóng"); hóa đơn vẫn ở `Chờ duyệt`. Nếu kế toán vừa sửa hoặc gửi lại hóa đơn trong lúc bạn đang xem, hệ thống từ chối và yêu cầu tải lại để duyệt đúng bản mới.

## Trả lại hóa đơn cần sửa

> `Trả lại` và `Rút lại` đều đưa hóa đơn về để sửa. `Trả lại` dành cho **quản lý** và bắt buộc ghi chú, hóa đơn hiện `Cần sửa`. `Rút lại` dành cho **người đã gửi duyệt** tự lấy về, không cần ghi chú, hóa đơn về `Nháp`. Dòng chú thích dưới các nút trên trang hóa đơn nhắc lại điều này.

Thấy hóa đơn chưa ổn, quản lý bấm `Trả lại` và **bắt buộc ghi chú** điều cần sửa. Chỉ hóa đơn đó về lại; hóa đơn khác vẫn duyệt bình thường. Hóa đơn bị trả lại có nhãn `Cần sửa` trên bảng của đợt thu, ghi chú hiện ngay dưới dòng và ở khung **Ghi chú của quản lý** trên trang hóa đơn. Kế toán sửa rồi bấm `Gửi duyệt lại phiếu thu`.

## Gửi thông tin thanh toán cho phụ huynh

Sau khi được duyệt, khung **Thanh toán** hiện mã hóa đơn, hạn thanh toán, số tiền và tài khoản của từng phần, cùng nội dung chuyển khoản.

![Khung thanh toán sau khi phát hành](tt-hoa-don-thanh-toan.jpg)

Bấm `Xem ảnh hóa đơn` hoặc `Tải ảnh hóa đơn` để lấy ảnh thông báo học phí có mã VietQR, rồi gửi cho phụ huynh qua kênh liên lạc của trung tâm (Zalo, email…). Phụ huynh quét mã là đúng số tiền, đúng tài khoản và đúng nội dung chuyển khoản.

![Ảnh thông báo học phí có mã VietQR](tt-hoa-don-anh.jpg)

> Ảnh chỉ tạo được cho hóa đơn đã phát hành và chưa thu tiền. Phiếu thu hai phần nghĩa là phụ huynh cần chuyển khoản **hai lần** vào hai tài khoản.

### Tải ảnh cả đợt (ZIP)

Với phụ huynh không dùng app, ở đợt thu bấm `Tải ảnh hóa đơn (ZIP)`, chọn một lớp hoặc `Tất cả lớp`, rồi `Tạo và tải ZIP`. Mỗi học sinh một ảnh, tên file dạng `Lớp_Tên học sinh_Tên đợt thu.png` (trùng tên trong lớp thì thêm mã học sinh). File chỉ gồm hóa đơn **đã phát hành và chưa thu tiền**; hóa đơn nháp hoặc chờ duyệt chưa có ảnh. Liên kết tải hết hạn sau 10 phút, cần thì tạo lại.

> Nếu tổng của hóa đơn âm (bớt nhiều hơn số phải thu), phần âm **không hoàn ngay** mà được trừ vào hóa đơn kỳ sau của học sinh; hóa đơn đó tự đóng khi phát hành.

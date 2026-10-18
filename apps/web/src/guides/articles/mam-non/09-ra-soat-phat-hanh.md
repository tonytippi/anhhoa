---
title: Rà soát, gửi duyệt và phát hành hóa đơn
summary: Kiểm tra từng hóa đơn nháp, sửa số lượng hoặc phần bớt, gửi duyệt, quản lý duyệt để phát hành, rồi gửi ảnh hóa đơn cho phụ huynh.
order: 9
requires: collection-runs
---
Trong đợt thu ở trạng thái `Duyệt & thu tiền`, bấm `Rà soát hóa đơn` ở dòng học sinh đầu tiên. Dùng `Học sinh trước` / `Học sinh tiếp theo` để đi lần lượt. Sau khi gửi duyệt, trang vẫn giữ hóa đơn vừa gửi; bấm `Học sinh kế tiếp` để sang hóa đơn nháp kế tiếp **cùng lớp**. Hết lớp, nút đổi thành `Học sinh kế tiếp · Lớp …` để sang lớp khác; khi đã gửi duyệt toàn bộ, nút là `Về đợt thu`.

Muốn làm gọn từng lớp (các khoản thu trong một lớp thường giống nhau), chọn lớp ở ô `Lớp` phía trên bảng hóa đơn trước khi bấm `Rà soát hóa đơn`. Khi đó `Học sinh trước` / `Học sinh tiếp theo` chỉ đi trong lớp đã chọn, và khi `Học sinh kế tiếp` sang lớp khác thì bộ lọc lớp cũng chuyển theo; đầu trang rà soát ghi rõ `Học sinh 2/30 · Lớp …`.

## Đọc hóa đơn

Phiếu thu chia theo tài khoản nhận: **Phần 1 · Thu vào tài khoản trường** (khoản có thuế) và **Phần 2 · Thu vào tài khoản cá nhân** (khoản không kê khai). Mỗi dòng có:

- `Số lượng`, `Đơn giá`, `Tổng trước giảm`
- `Ưu đãi` — do chính sách ưu đãi đã gán
- `Bớt` — phần trả lại, bằng *số lượng bớt × giá hoàn trả* (ví dụ ngày nghỉ có phép)
- `Thuế GTGT` — tính trên số tiền sau ưu đãi và bớt
- `Tổng phải thu`

## Sửa trên hóa đơn nháp

Hóa đơn nháp sửa trực tiếp trên bảng như bảng tính:

1. Sửa ô `Số lượng`, `Đơn giá` hoặc số lượng ở ô `Bớt`.
2. Khi đổi đơn giá, nhập **Lý do đổi đơn giá**. Khi phần bớt khác số hệ thống đề xuất, nhập **Lý do sửa phần bớt** (hoặc bấm `Dùng số đề xuất` để quay về số gợi ý).
3. Số in nghiêng là số dự kiến do hệ thống tính lại, chưa lưu. Bấm `Lưu thay đổi` (hoặc `Hoàn tác`).

![Bớt tiền ăn 3 ngày: 2 ngày nghỉ có phép và 1 ngày phụ huynh báo sau, kèm lý do](hoa-don-sua-bot.jpg)

Các thao tác khác: `Thêm dòng` để thêm khoản phát sinh riêng cho học sinh này (chọn `Loại dòng` **Chỉ bớt (Thu 0)** khi chỉ cần trả lại tiền của một khoản không thu tháng này, kèm lý do), `Xóa` để bỏ một dòng, `Nguồn` để ghi chú căn cứ (ngày dịch vụ, điểm danh, giờ đón, số phút trông muộn).

> Gợi ý "Đề xuất N ngày × giá · nghỉ có phép MM/YYYY" lấy từ đơn nghỉ có phép đã duyệt của **tháng trước**.

## Gửi duyệt

Mọi hóa đơn phải được **quản lý duyệt** trước khi đến phụ huynh. Kế toán rà soát xong từng hóa đơn thì gửi duyệt ngay, không cần chờ làm xong cả đợt.

Ở khung **Rà soát trước khi gửi duyệt**, mỗi phần hiện tài khoản nhận **theo tài khoản của lớp** (xem [Tài khoản thu của lớp](guide:tai-khoan-thu-cua-lop)). Bấm `Gửi duyệt phiếu thu` (hoặc `Gửi duyệt hóa đơn` nếu chỉ có một phần). Hộp xác nhận hiện tên học sinh, lớp, các dòng của từng phần và **Tổng cần thu** (đã gồm thuế GTGT); kiểm tra lần cuối rồi bấm gửi. Hóa đơn chuyển `Chờ duyệt`.

![Khung rà soát trước khi gửi duyệt: tài khoản theo lớp](hoa-don-ra-soat-gui-duyet.jpg)

![Xác nhận gửi duyệt phiếu thu](hoa-don-xac-nhan-gui-duyet.jpg)

> Chỉ khi lớp **chưa có** tài khoản mặc định (hoặc học sinh chỉ học ngoại khóa), khung mới hiện ô chọn tài khoản cho lần gửi duyệt này.

Muốn gửi nhiều hóa đơn một lần: ở bảng hóa đơn của đợt thu, đánh dấu các dòng `Nháp` hoặc `Cần sửa` rồi bấm `Gửi duyệt` trên thanh phía trên bảng. Nếu có hóa đơn chưa gửi được (ví dụ chưa có tài khoản nhận), hộp thoại liệt kê từng hóa đơn và lý do; **không hóa đơn nào được gửi** cho đến khi bạn bỏ chọn hoặc xử lý các hóa đơn đó.

> [!WARNING]
> Hóa đơn `Chờ duyệt` **không sửa được**. Cần sửa thì **người gửi duyệt** bấm `Rút lại` (trên trang hóa đơn hoặc thanh chọn của đợt thu): hóa đơn về `Nháp`, sửa xong gửi duyệt lại. Người khác không thấy nút `Rút lại`; quản lý dùng `Trả lại` kèm ghi chú. Nút gửi duyệt bị khóa khi còn thay đổi chưa lưu trên dòng hóa đơn.

## Duyệt và gửi phụ huynh

Người có quyền **Duyệt hóa đơn** (xem [Cấp quyền đăng nhập](guide:cap-quyen-dang-nhap)) thấy số hóa đơn chờ duyệt cạnh mục `Đợt thu` trên menu. Có hai cách duyệt:

- **Từng hóa đơn**: mở hóa đơn `Chờ duyệt`, xem các dòng rồi bấm `Duyệt & gửi phụ huynh`.
- **Nhiều hóa đơn**: ở đợt thu, bấm `Chờ duyệt` trên thanh tiến độ để lọc, đánh dấu các dòng rồi bấm `Duyệt & gửi phụ huynh`. Hộp thoại hiện tổng phải thu, tổng phải hoàn, bảng theo lớp (tổng, bình quân mỗi học sinh, bình quân đợt trước) và danh sách **Cần chú ý** (dòng thêm tay, sửa đơn giá, ưu đãi, bớt, quyết toán, gói nộp trước). Bấm `Xem hóa đơn` để mở, hoặc `Trả lại` ngay tại đây.

![Hóa đơn chờ duyệt: Duyệt & gửi phụ huynh, Trả lại, Rút lại](hoa-don-cho-duyet.jpg)

![Duyệt nhiều hóa đơn: tổng theo lớp và các hóa đơn cần chú ý](dot-thu-duyet.jpg)

Khi duyệt, hóa đơn được **phát hành**: hệ thống kiểm tra lại ưu đãi và tài khoản, khóa số tiền, rồi phụ huynh thấy hóa đơn trên app. Người gửi duyệt cũng được tự duyệt nếu có đủ cả hai quyền.

> [!WARNING]
> Không duyệt được khi đợt trước của cùng lớp chưa đóng (trang báo "Đợt thu tháng … chưa đóng"); hóa đơn vẫn ở `Chờ duyệt`. Nếu kế toán vừa sửa hoặc gửi lại hóa đơn trong lúc bạn đang xem, hệ thống từ chối và yêu cầu tải lại để duyệt đúng bản mới.

## Trả lại hóa đơn cần sửa

> `Trả lại` và `Rút lại` đều đưa hóa đơn về để sửa. `Trả lại` dành cho **quản lý** và bắt buộc ghi chú, hóa đơn hiện `Cần sửa`. `Rút lại` dành cho **người đã gửi duyệt** tự lấy về, không cần ghi chú, hóa đơn về `Nháp`. Dòng chú thích dưới các nút trên trang hóa đơn nhắc lại điều này.

Thấy hóa đơn chưa ổn, quản lý bấm `Trả lại` và **bắt buộc ghi chú** điều cần sửa. Chỉ hóa đơn đó về lại; hóa đơn khác vẫn duyệt bình thường.

![Trả lại hóa đơn kèm ghi chú cho kế toán](hoa-don-tra-lai.jpg)

Hóa đơn bị trả lại có nhãn `Cần sửa` trên bảng của đợt thu, ghi chú hiện ngay dưới dòng và ở khung **Ghi chú của quản lý** trên trang hóa đơn. Kế toán sửa rồi bấm `Gửi duyệt lại phiếu thu`.

![Hóa đơn Cần sửa trên bảng của đợt thu, kèm ghi chú](dot-thu-can-sua.jpg)

![Ghi chú của quản lý trên trang hóa đơn](hoa-don-ghi-chu-tra-lai.jpg)

## Gửi thông tin thanh toán cho phụ huynh

Sau khi được duyệt, khung **Thanh toán** hiện mã hóa đơn, hạn thanh toán, số tiền và tài khoản của từng phần, cùng nội dung chuyển khoản.

![Khung thanh toán sau khi phát hành](hoa-don-thanh-toan.jpg)

Bấm `Xem ảnh hóa đơn` hoặc `Tải ảnh hóa đơn` để lấy ảnh thông báo học phí có mã VietQR, rồi gửi cho phụ huynh qua kênh liên lạc của trường (Zalo, email…). Phụ huynh quét mã là đúng số tiền, đúng tài khoản và đúng nội dung chuyển khoản.

![Ảnh thông báo học phí có mã VietQR](hoa-don-anh.jpg)

> Ảnh chỉ tạo được cho hóa đơn đã phát hành và chưa thu tiền. Phiếu thu hai phần nghĩa là phụ huynh cần chuyển khoản **hai lần** vào hai tài khoản.

### Tải ảnh cả đợt (ZIP)

Với phụ huynh không dùng app, ở đợt thu bấm `Tải ảnh hóa đơn (ZIP)`, chọn một lớp hoặc `Tất cả lớp`, rồi `Tạo và tải ZIP`. Mỗi học sinh một ảnh, tên file dạng `Lớp_Tên học sinh_Tên đợt thu.png` (trùng tên trong lớp thì thêm mã học sinh). File chỉ gồm hóa đơn **đã phát hành và chưa thu tiền**; hóa đơn nháp hoặc chờ duyệt chưa có ảnh. Liên kết tải hết hạn sau 10 phút, cần thì tạo lại.

![Tải ảnh hóa đơn của đợt thành file ZIP](dot-thu-tai-zip.jpg)

## Gói nộp trước

Dưới bảng dòng của hóa đơn nháp có thẻ `Gói nộp trước`. Bấm `Áp dụng gói nộp trước`, chọn gói (chỉ hiện gói có khoản thu trên phiếu thu này, xem [Ưu đãi và gói nộp trước](guide:uu-dai)). Hộp thoại hiện **xem trước** do hệ thống tính: từng tháng với giá, ưu đãi (gồm cả ưu đãi đang gán cho học sinh, như anh chị em) và số phải thu, cùng tổng dòng gói. Kiểm tra rồi bấm `Áp dụng gói`.

![Xem trước gói 3 tháng trước khi áp dụng](hoa-don-nop-truoc-xem-truoc.jpg)

Sau khi áp dụng, thẻ hiện tên gói, số tháng, khoảng tháng và trạng thái `Chờ thu đủ`; khi phần thu được ghi thực nhận đủ, trạng thái chuyển `Đã thu`.

![Gói 3 tháng đã áp dụng: từng tháng và phần giảm](hoa-don-nop-truoc.jpg)

Dòng khoản thu của gói chuyển thành **đủ số tháng** (ví dụ Học phí Chồi 3 tháng = 10.200.000 đ, ưu đãi 510.000 đ), tính theo **đơn giá của dòng** — nếu đã sửa đơn giá kèm lý do (ví dụ con nhân viên) thì gói dùng đơn giá đó. Gói tự gắn vào đúng phần của phiếu thu theo tài khoản nhận của khoản thu (học phí "Không kê khai" → phần tài khoản cá nhân), dù bạn đang mở phần nào.

![Học phí thu đủ 3 tháng của gói trên phần tài khoản cá nhân](hoa-don-nop-truoc-dong.jpg)

> [!WARNING]
> Khi phần hóa đơn đang có gói nộp trước, các dòng của phần đó **bị khóa**. Muốn sửa số lượng, đơn giá hay phần bớt, bấm `Bỏ gói nộp trước` (dòng trở về 1 tháng), sửa xong rồi áp dụng lại gói. Phụ huynh phải chuyển **đúng** số tiền của phần đó; chuyển thiếu hoặc thừa sẽ không ghi thực nhận được.

Hệ thống từ chối áp dụng gói khi:

- Hóa đơn có **hai dòng cùng khoản thu** của gói — giữ lại một dòng.
- Một tháng của gói **đã được thu ở hóa đơn khác** (ví dụ đợt tháng sau đã tạo hóa đơn có học phí) — xóa dòng đó hoặc điều chỉnh hóa đơn kia trước.
- Một tháng của gói đã thuộc gói khác (đã thu hoặc đang chờ thu).

> Khi gói đang chờ thu, các đợt thu tháng sau trong thời hạn gói **tự bỏ qua** học phí đó; trang xem trước đợt thu ghi "Đã nộp trước" cạnh tên học sinh. Nếu bỏ gói sau khi đã tạo đợt tháng sau, hóa đơn các tháng đó không có học phí — thêm lại bằng tay.

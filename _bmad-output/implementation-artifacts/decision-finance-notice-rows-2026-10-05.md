# Quyết định: Danh sách hóa đơn trong đợt hiển thị theo phiếu thu; Thu tiền giữ theo tài khoản nhận

**Trạng thái:** Người dùng duyệt hướng và mockup ngày 2026-10-05; đã implementation.

**Thay đổi so với:** `planning-artifacts/sprint-change-proposal-2026-09-30-taxed-receivables-and-two-payment-channels.md` §4.7 dòng "Run invoice table and receipt queue list one row per channel Invoice". D4 (một Invoice cho mỗi kênh, settlement exact theo Invoice, phiếu thu chỉ để hiển thị) giữ nguyên.

## Bối cảnh

Rà soát và phát hành đã làm theo phiếu thu: màn rà soát mở cả Phần 1 và Phần 2, một Operation phát hành cả hai Invoice. Danh sách hóa đơn trong đợt lại liệt kê từng Invoice, nên một đợt 126 học sinh hiện 252 dòng và tiến độ "0/252" trong khi rà soát hiện "Học sinh i/126". Kế toán phải tự ghép hai dòng của cùng một bé.

Thu tiền thì khác: tiền về hai tài khoản khác nhau, thường khác thời điểm, và kế toán đối chiếu từng sao kê riêng. Mỗi Invoice có một Receipt exact; gộp dòng sẽ đặt hai thao tác ghi thực nhận trên cùng một dòng và dễ ghi nhầm phần.

## Quyết định

1. **Danh sách hóa đơn trong đợt: một dòng cho mỗi phiếu thu (Student × CollectionRun).**
   - Cột: `Học sinh`, `Lớp`, `Tài khoản trường`, `Tài khoản cá nhân`, `Tổng`, `Trạng thái`, `Tùy chọn`.
   - Hai cột tài khoản hiện tổng của từng Invoice; phần không có hiện `—`. Phần đã phát hành hiện thêm tài khoản cụ thể từ snapshot dưới số tiền theo cách hiển thị tài khoản ở mục 3; phần nháp chưa có snapshot nên không hiện. `Tổng` là tổng phiếu thu do máy chủ trả; browser không cộng tiền.
   - `Trạng thái` gộp do máy chủ trả: `Nháp`, `Đã phát hành`, `Đã thu 1/2 phần`, `Hoàn tất`, `Đã hủy`. Dòng một phần dùng trạng thái của phần đó.
   - Tiến độ đếm theo phiếu thu: `x/n phiếu thu đã phát hành hoặc hoàn tất.`, cùng đơn vị với `Học sinh i/n` khi rà soát. Ô tổng của đợt dùng nhãn `Phiếu thu` thay cho `Hóa đơn`; nhắc đóng đợt nêu số phiếu thu nháp còn lại.
   - `Rà soát hóa đơn` mở phiếu thu như hiện nay.
   - Phiếu quyết toán/hoàn tiền và bản thay thế giữ quy tắc hiện có của màn rà soát; chỉ cách nhóm trong danh sách thay đổi.
2. **Thu tiền: giữ một dòng cho mỗi Invoice theo tài khoản nhận, làm dễ dùng hơn.**
   - Cột `Tài khoản nhận` hiện tài khoản cụ thể từ snapshot của Invoice theo cách hiển thị ở mục 3.
   - Thêm bộ lọc `Tài khoản nhận` theo tài khoản cụ thể để đối chiếu từng sao kê: `Tất cả tài khoản`, rồi từng tài khoản (`Mã NH - Chủ tài khoản · Số tài khoản`) nhóm theo `Tài khoản trường` và `Tài khoản cá nhân`. Danh sách lựa chọn do máy chủ trả từ các tài khoản (snapshot `bankAccountIdSnapshot`) có hóa đơn trong phạm vi Trường; máy chủ kiểm tra tài khoản được lọc thuộc Trường, không tin ID từ browser.
   - Hai dòng của cùng một học sinh và cùng tháng luôn liền nhau, thứ tự `Tài khoản trường` trước `Tài khoản cá nhân`.
   - Bộ lọc theo mockup, nằm một hàng: `Tìm học sinh`, `Tháng thu`, `Lớp`, `Tài khoản nhận`, `Loại`. Không có bộ chọn năm học (tháng thu đã xác định năm học). `Tháng thu` liệt kê các tháng còn hóa đơn chờ thu do máy chủ trả, kèm `Tất cả tháng`; mặc định là tháng gần nhất còn hóa đơn chờ thu, không có thì tháng hiện tại (điều chỉnh 2026-10-06 theo phản hồi người dùng).
   - Dialog `Ghi thực nhận` là modal có backdrop như mockup, nêu mã hóa đơn, tài khoản nhận và nghĩa vụ do hệ thống xác nhận; nhắc rằng hóa đơn của tài khoản kia không thay đổi.
3. **Cách hiển thị một tài khoản nhận (dùng chung cho hai màn).**
   - Dòng 1: `Mã ngân hàng - Chủ tài khoản` (ví dụ `TCB - NGUYEN VAN A`). Dòng 2 nhỏ, màu phụ: số tài khoản đầy đủ, chữ số canh đều.
   - Tài khoản trường đánh dấu bằng icon tòa nhà màu chủ đạo trước tên, không hiện chữ; icon có nhãn trợ năng `Tài khoản trường` cho trình đọc màn hình. Tài khoản cá nhân không có icon nhưng giữ khoảng trống để tên thẳng hàng.
   - Mã ngân hàng là mã viết tắt VietQR (TCB, VCB, ABB…) do máy chủ suy ra từ BIN trong snapshot qua danh mục ngân hàng; BIN không có mã thì dùng tên ngân hàng trong snapshot.

## Ranh giới

- Không đổi persistence, lifecycle, Operation, settlement exact theo Invoice hay Parent DTO.
- Tổng phiếu thu và trạng thái gộp do API trả; không tính ở browser.
- Thêm ngày/hình thức/mã giao dịch cho Receipt, phát hành hàng loạt và gộp preview theo học sinh nằm ngoài quyết định này.

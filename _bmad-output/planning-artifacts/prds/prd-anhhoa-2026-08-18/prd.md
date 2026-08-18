---
title: "PRD - Hệ thống quản lý hóa đơn trường mầm non"
status: final
created: 2026-08-18
updated: 2026-08-18
---

# PRD: Hệ thống quản lý hóa đơn trường mầm non Ánh Hoa

## 0. Mục đích tài liệu

PRD này xác định MVP web nội bộ để các admin của trường mầm non Ánh Hoa quản lý lớp, học sinh và thu học phí theo tháng. Tài liệu là nguồn yêu cầu cho UX, kiến trúc, chia epic/story và triển khai; ưu tiên thao tác rõ ràng, dữ liệu lịch sử không thay đổi và audit tối thiểu cho hoạt động thu tiền.

## 1. Tầm nhìn

Hệ thống thay thế việc lập thông báo học phí thủ công bằng một dashboard duy nhất cho admin. Admin có thể quản lý danh sách lớp và học sinh, tạo sẵn hóa đơn theo tháng, điều chỉnh từng hóa đơn và ghi nhận ai đã xác nhận nhận tiền.

Trọng tâm của MVP là giảm nhập liệu lặp lại nhưng không tự động hóa vượt quá nhu cầu vận hành: toàn trường dùng một mẫu hóa đơn chung, học phí được điền từ lớp, và các khoản phát sinh vẫn do admin kiểm soát trước khi gửi/thu. Hệ thống phải bảo toàn nội dung hóa đơn đã tạo, nhất là sau khi học sinh chuyển lớp hoặc tài khoản ngân hàng bị ngừng dùng.

## 2. Người dùng mục tiêu

### 2.1 Công việc cần hoàn thành

- Admin cần duy trì lớp và học sinh đang theo học để có danh sách lập hóa đơn chính xác.
- Admin cần lập nhanh hóa đơn tháng cho nhiều học sinh nhưng vẫn chỉnh được các khoản phát sinh từng em.
- Admin cần cung cấp QR chuyển khoản đúng số tiền, tài khoản nhận và nội dung chuyển khoản.
- Admin cần xác nhận thu tiền có chủ ý, biết ai đã lập và ai đã xác nhận từng hóa đơn.
- Admin cần xem tổng thu tháng theo chuyển khoản, từng tài khoản nhận tiền và tiền mặt.

### 2.2 Không phải người dùng MVP

- Giáo viên, phụ huynh và học sinh không có tài khoản hoặc giao diện.
- Không có quản lý cha mẹ, giáo viên, campus hoặc khóa học.

### 2.3 Hành trình chính

- **UJ-1. Lan tạo dữ liệu đầu năm.** Lan, một admin, đăng nhập bằng Google, thêm các lớp với học phí tháng, thêm học sinh và gán mỗi em vào lớp. Khi có thay đổi lớp, Lan chuyển từng em hoặc chuyển toàn bộ học sinh đang học sang lớp mới mà không làm mất lịch sử.
- **UJ-2. Lan chuẩn bị hóa đơn tháng.** Đầu tháng, Lan chọn tháng và phạm vi lớp để tạo hóa đơn hàng loạt. Hệ thống tạo hóa đơn `DRAFT` cho các học sinh đang học chưa có hóa đơn tháng đó, sao chép mẫu chung và tự điền học phí theo lớp. Lan mở từng hóa đơn cần thiết để điều chỉnh trước khi chuyển sang `PENDING`.
- **UJ-3. Minh ghi nhận thanh toán.** Minh mở hóa đơn `PENDING`; với chuyển khoản, Minh xem QR chứa đúng số tiền và nội dung. Khi đã nhận đủ tiền, Minh chọn xác nhận, đọc lại thông tin trong modal và hoàn tất. Hóa đơn thành `COMPLETED`, lưu Minh và thời điểm xác nhận, sau đó chỉ xem.
- **UJ-4. Lan đối soát tháng.** Cuối tháng, Lan chọn tháng trong báo cáo để xem tổng đã thu, phần tiền mặt và phần chuyển khoản phân theo tài khoản nhận tiền.

## 3. Thuật ngữ

- **Admin** - Người dùng nội bộ đăng nhập bằng Google, có email trong danh sách cho phép.
- **Lớp** - Nhóm học sinh có tên, học phí tháng và trạng thái hoạt động hoặc lưu trữ.
- **Học sinh** - Trẻ có họ tên, biệt danh tùy chọn, lớp hiện tại tùy chọn và trạng thái đang học hoặc nghỉ học.
- **Mẫu hóa đơn chung** - Danh sách dòng phí được áp dụng khi tạo Hóa đơn cho mọi Lớp.
- **Dòng mẫu** - Một dòng trong Mẫu hóa đơn chung, có mô tả, thứ tự, nhóm thu tùy chọn và nguồn số tiền.
- **Hóa đơn** - Bản ghi thu tiền duy nhất của một Học sinh trong một tháng, có các Dòng hóa đơn, phương thức thanh toán và trạng thái.
- **Dòng hóa đơn** - Bản sao độc lập của Dòng mẫu hoặc dòng do Admin thêm vào Hóa đơn; có mô tả và số tiền.
- **Tháng hóa đơn** - Tháng mà Hóa đơn áp dụng, biểu diễn theo tháng/năm và không có ngày cụ thể.
- **Tài khoản nhận tiền** - Tài khoản ngân hàng có thể được chọn cho Hóa đơn chuyển khoản; có trạng thái hoạt động hoặc ngừng dùng.
- **DRAFT** - Hóa đơn đã tạo sẵn, còn được chỉnh sửa.
- **PENDING** - Hóa đơn đã sẵn sàng chờ thanh toán/xác nhận, nội dung đã khóa và chưa hoàn tất.
- **COMPLETED** - Hóa đơn đã được Admin xác nhận đã thu đủ; chỉ xem.

## 4. Tính năng và yêu cầu chức năng

### 4.1 Đăng nhập và nhận diện Admin

**Mô tả:** Chỉ Admin được xác thực qua Google và có email trong danh sách cho phép mới truy cập dashboard. Hệ thống lưu thông tin nhận diện cần cho audit khi Admin lập hoặc hoàn tất Hóa đơn.

#### FR-1: Đăng nhập Google và danh sách cho phép

Admin có thể đăng nhập bằng Google khi email của họ nằm trong `ADMIN_EMAILS`.

**Hệ quả kiểm thử:**
- Email không nằm trong danh sách cho phép bị từ chối truy cập dashboard.
- Khi Admin đăng nhập lần đầu, hệ thống lưu email, tên hiển thị và ảnh đại diện Google nếu có.
- Admin đã từng đăng nhập được cập nhật thông tin hiển thị khi Google trả về thông tin mới.

### 4.2 Quản lý Lớp và Học sinh

**Mô tả:** Admin duy trì dữ liệu nguồn cho việc lập hóa đơn. Lớp và Học sinh có lịch sử phát sinh Hóa đơn không bị xóa cứng. Thao tác chuyển lớp chỉ thay đổi lớp hiện tại của Học sinh, không thay đổi bản chụp dữ liệu trên Hóa đơn đã tạo.

#### FR-2: Quản lý Lớp

Admin có thể tạo, xem, sửa tên và học phí tháng của Lớp, cũng như chuyển Lớp giữa trạng thái hoạt động và lưu trữ.

**Hệ quả kiểm thử:**
- Lớp đang lưu trữ không xuất hiện trong lựa chọn gán mới hoặc tạo Hóa đơn mới.
- Lớp có lịch sử Hóa đơn vẫn xem được sau khi lưu trữ.
- Mỗi Lớp hiển thị danh sách Học sinh đang học hiện thuộc Lớp đó.

#### FR-3: Quản lý Học sinh

Admin có thể tạo, xem và sửa họ tên, biệt danh và Lớp hiện tại của Học sinh; Admin có thể chuyển trạng thái Học sinh thành nghỉ học hoặc đang học lại.

**Hệ quả kiểm thử:**
- Học sinh có thể được tạo khi chưa gán Lớp, nhưng không đủ điều kiện tạo Hóa đơn cho đến khi có Lớp hoạt động.
- Học sinh nghỉ học không được chọn khi tạo Hóa đơn hàng loạt mới.
- Học sinh nghỉ học và toàn bộ Hóa đơn lịch sử vẫn xem được.

#### FR-4: Chuyển Học sinh và chuyển cả Lớp

Admin có thể chuyển một Học sinh sang Lớp hoạt động khác hoặc chuyển toàn bộ Học sinh đang học từ một Lớp sang một Lớp đích.

**Hệ quả kiểm thử:**
- Trước khi chuyển cả Lớp, hệ thống hiển thị Lớp đích và số Học sinh đang học sẽ bị ảnh hưởng, rồi yêu cầu xác nhận.
- Chỉ Học sinh đang học được chuyển hàng loạt; Học sinh nghỉ học không bị thay đổi.
- Các Hóa đơn đã tồn tại giữ nguyên tên Học sinh, biệt danh, Lớp, học phí và Dòng hóa đơn tại thời điểm tạo.

### 4.3 Mẫu hóa đơn chung

**Mô tả:** Một Mẫu hóa đơn chung giúp toàn trường giữ bố cục thu phí nhất quán. Mẫu được khởi tạo với các dòng từ thông báo học phí hiện có, như học phí, tiền ăn, phụ phí, các điều chỉnh ăn, ngoài giờ, ăn tối, đổi trừ và khoản khác; đây chỉ là dữ liệu khởi tạo, không phải danh mục bắt buộc.

#### FR-5: Quản lý Mẫu hóa đơn chung

Admin có thể xem, thêm, sửa, sắp xếp và bỏ Dòng mẫu trong Mẫu hóa đơn chung.

**Hệ quả kiểm thử:**
- Mỗi Dòng mẫu lưu mô tả, nhóm thu tùy chọn, thứ tự và nguồn số tiền.
- Nguồn số tiền là số tiền cố định hoặc học phí tháng của Lớp.
- Chỉ một Mẫu hóa đơn chung được dùng để tạo Hóa đơn mới tại một thời điểm.
- Sửa Mẫu hóa đơn chung không thay đổi Dòng hóa đơn của Hóa đơn đã tạo.

### 4.4 Tạo và quản lý Hóa đơn

**Mô tả:** Hệ thống tạo sẵn Hóa đơn theo Tháng hóa đơn để Admin rà soát trước khi chuyển sang chờ thanh toán. Tổng tiền bằng tổng các Dòng hóa đơn, bao gồm cả dòng giảm trừ có số tiền âm. Hóa đơn giữ bản chụp các dữ liệu cần thiết để lịch sử, QR và báo cáo không đổi khi dữ liệu nguồn thay đổi.

#### FR-6: Tạo Hóa đơn hàng loạt

Admin có thể tạo Hóa đơn hàng loạt cho một Tháng hóa đơn, trên toàn trường hoặc theo một hay nhiều Lớp hoạt động. Điều kiện của Học sinh và Lớp được đánh giá theo trạng thái tại thời điểm Admin chạy thao tác; MVP không hỗ trợ tính học phí theo ngày nhập học, nghỉ học hoặc chuyển Lớp trong tháng.

**Hệ quả kiểm thử:**
- Hệ thống chỉ tạo cho Học sinh đang học, có Lớp hoạt động và chưa có Hóa đơn trong Tháng hóa đơn đó.
- Mỗi Học sinh có tối đa một Hóa đơn cho một Tháng hóa đơn.
- Hệ thống sao chép Mẫu hóa đơn chung vào Hóa đơn; Dòng mẫu lấy học phí Lớp được thay bằng học phí tháng hiện tại của Lớp.
- Hóa đơn tạo hàng loạt có trạng thái `DRAFT` và lưu Admin tạo cùng thời điểm tạo.
- Kết quả cho biết số Hóa đơn đã tạo và số Học sinh bị bỏ qua vì không đủ điều kiện hoặc đã có Hóa đơn.
- Lệnh tạo hàng loạt được xử lý nguyên tử: hai Admin tạo cùng Tháng hóa đơn và phạm vi chồng lấp không thể tạo Hóa đơn trùng; kết quả cuối cùng phản ánh chính xác Hóa đơn được tạo và Học sinh bị bỏ qua.

#### FR-7: Chỉnh sửa Hóa đơn và chuyển sang chờ thanh toán

Admin có thể xem Hóa đơn ở mọi trạng thái và sửa Hóa đơn `DRAFT`: thêm, sửa, xóa, sắp xếp Dòng hóa đơn; chọn phương thức thanh toán; và chọn Tài khoản nhận tiền khi chuyển khoản.

**Hệ quả kiểm thử:**
- Tổng tiền được tính lại ngay khi Dòng hóa đơn thay đổi.
- Admin có thể chuyển Hóa đơn từ `DRAFT` sang `PENDING` khi đã kiểm tra xong; `PENDING` khóa toàn bộ nội dung thanh toán, bao gồm Dòng hóa đơn, tổng tiền, phương thức và Tài khoản nhận tiền.
- Nếu cần sửa Hóa đơn `PENDING` trước khi nhận tiền, Admin phải chuyển Hóa đơn về `DRAFT`; khi chuyển lại `PENDING`, hệ thống tạo QR theo dữ liệu mới.
- Hóa đơn chuyển khoản chỉ có thể ở `PENDING` khi đã chọn Tài khoản nhận tiền đang hoạt động.
- Hóa đơn tiền mặt không yêu cầu Tài khoản nhận tiền.
- Tổng Hóa đơn phải lớn hơn 0 để được chuyển sang `PENDING` hoặc `COMPLETED`; Dòng hóa đơn được phép bằng 0 hoặc âm để biểu diễn khoản chưa phát sinh hoặc giảm trừ.
- Mỗi Hóa đơn lưu bản chụp họ tên, biệt danh, tên Lớp, các Dòng hóa đơn, phương thức thanh toán và thông tin Tài khoản nhận tiền đã chọn.

#### FR-8: Hoàn tất Hóa đơn

Admin có thể xác nhận đã nhận đủ tiền cho Hóa đơn `PENDING` thông qua modal xác nhận.

**Hệ quả kiểm thử:**
- Modal hiển thị Học sinh, Tháng hóa đơn, phương thức thanh toán và tổng tiền trước khi hoàn tất.
- Người dùng phải xác nhận rõ ràng trong modal; đóng hoặc hủy modal không làm thay đổi Hóa đơn.
- Xác nhận thành công chuyển trạng thái sang `COMPLETED`, lưu Admin xác nhận và thời điểm xác nhận.
- Hóa đơn `COMPLETED` chỉ xem, không thể chỉnh sửa, mở lại hay hủy trong MVP.
- Hoàn tất luôn biểu thị đã thu đủ đúng tổng Hóa đơn; không hỗ trợ thu thiếu, thu thừa, trả góp hoặc hoàn tiền trong MVP.
- Nếu xác nhận nhầm, MVP không có thao tác sửa số liệu hoặc đảo Hóa đơn; Admin phải xử lý và lưu biên bản điều chỉnh ngoài hệ thống. Báo cáo trong MVP phản ánh các Hóa đơn đã được xác nhận.

### 4.5 Thanh toán chuyển khoản và Tài khoản nhận tiền

**Mô tả:** Admin quản lý danh sách Tài khoản nhận tiền để dùng cho Hóa đơn chuyển khoản. Không được xóa tài khoản vì Hóa đơn lịch sử phải luôn tra được nơi nhận tiền. QR chuyển khoản được tạo từ dữ liệu Hóa đơn đã chụp.

#### FR-9: Quản lý Tài khoản nhận tiền

Admin có thể xem, thêm mới, kích hoạt và ngừng dùng Tài khoản nhận tiền; không thể xóa Tài khoản nhận tiền.

**Hệ quả kiểm thử:**
- Tài khoản mới gồm ngân hàng/mã ngân hàng VietQR, số tài khoản, tên chủ tài khoản và trạng thái.
- Chỉ Tài khoản nhận tiền hoạt động xuất hiện khi chọn cho Hóa đơn `DRAFT`.
- Tài khoản ngừng dùng vẫn hiển thị trên Hóa đơn lịch sử đã chọn nó.
- Hóa đơn `PENDING` đã chụp Tài khoản nhận tiền vẫn hợp lệ và có thể hoàn tất sau khi tài khoản nguồn ngừng dùng; tài khoản đó không thể được chọn cho Hóa đơn `DRAFT` khác hoặc sau khi Hóa đơn được trả về `DRAFT`.
- Hệ thống không cung cấp thao tác xóa cứng Tài khoản nhận tiền.

#### FR-10: QR thanh toán chuyển khoản

Hệ thống tạo QR VietQR cho Hóa đơn chuyển khoản có Tài khoản nhận tiền.

**Hệ quả kiểm thử:**
- QR chứa số tiền bằng tổng Hóa đơn, số tài khoản nhận và ngân hàng của bản chụp trên Hóa đơn.
- Nội dung chuyển khoản có dạng `Họ tên [biệt danh nếu có] Lớp chuyển tiền`.
- QR và nội dung chuyển khoản không đổi nếu Học sinh, Lớp hoặc Tài khoản nhận tiền nguồn được sửa hay ngừng dùng sau đó.

### 4.6 Báo cáo tháng

**Mô tả:** Admin cần đối soát nhanh các Hóa đơn đã hoàn tất. Báo cáo chỉ ghi nhận tiền đã thu, không tính Hóa đơn `DRAFT` hoặc `PENDING`.

#### FR-11: Xem báo cáo thu theo tháng

Admin có thể chọn Tháng hóa đơn để xem báo cáo thu.

**Hệ quả kiểm thử:**
- Báo cáo hiển thị tổng thu từ các Hóa đơn `COMPLETED`.
- Báo cáo tách tổng tiền mặt và tổng chuyển khoản.
- Báo cáo phân tổng chuyển khoản theo từng Tài khoản nhận tiền đã dùng.
- MVP chỉ hiển thị báo cáo trên dashboard/bảng, không xuất Excel hoặc CSV.

## 5. Yêu cầu phi chức năng

- Dashboard phải là ứng dụng web responsive, dùng được trên desktop và điện thoại.
- Chỉ Admin được xác thực mới được đọc hoặc thay đổi dữ liệu vận hành.
- Giá tiền phải được lưu và tính chính xác, không dùng số thực dấu chấm động cho tiền tệ.
- MVP dùng số nguyên đồng Việt Nam (VND), không có phần thập phân. Mỗi Dòng hóa đơn lưu số nguyên VND; tổng Hóa đơn là phép cộng chính xác các Dòng hóa đơn, không có quy tắc làm tròn.
- Các thao tác tạo hàng loạt, chuyển cả Lớp và hoàn tất Hóa đơn phải chống tạo/ghi nhận trùng khi người dùng bấm lặp hoặc gửi lại yêu cầu.
- Lịch sử Hóa đơn phải bảo toàn bản chụp dữ liệu để có thể kiểm tra lại người tạo, người xác nhận, thời điểm và số tiền đã thu.
- Giao diện admin dùng Tailwind CSS v4, tw-animate-css, shadcn/ui trên Base UI; font nội dung Inter và font heading/branding Clash Grotesk.

## 6. Không làm trong MVP

- Tài khoản hoặc giao diện cho phụ huynh, giáo viên, học sinh.
- Quản lý cha mẹ, giáo viên, campus, khóa học, điểm danh hoặc lịch học.
- Đồng bộ giao dịch ngân hàng và tự động xác nhận thanh toán.
- Gửi thông báo hóa đơn qua email, SMS, Zalo hoặc ứng dụng.
- PDF, in hóa đơn hoặc xuất Excel/CSV.
- Thu thiếu, thu thừa, trả góp, hoàn tiền, hủy hoặc mở lại Hóa đơn `COMPLETED`.
- Lịch sử chi tiết Học sinh chuyển Lớp ngoài bản chụp trên Hóa đơn.
- Phân quyền chi tiết giữa các Admin.

## 7. Phạm vi MVP

### 7.1 Trong phạm vi

- Đăng nhập Google theo danh sách `ADMIN_EMAILS`.
- Quản lý Lớp, Học sinh, chuyển từng Học sinh và chuyển cả Lớp.
- Một Mẫu hóa đơn chung có dòng linh hoạt, trong đó học phí có thể lấy từ Lớp.
- Tạo Hóa đơn hàng loạt theo Tháng hóa đơn ở trạng thái `DRAFT`.
- Chỉnh sửa Hóa đơn, chuyển `DRAFT` sang `PENDING`, xác nhận qua modal sang `COMPLETED`.
- Tiền mặt, chuyển khoản, QR VietQR và Tài khoản nhận tiền chỉ thêm/kích hoạt/ngừng dùng.
- Audit Admin tạo và Admin xác nhận, cùng báo cáo thu tháng trên màn hình.

### 7.2 Ngoài phạm vi MVP

- Các mục tại phần Không làm trong MVP.

## 8. Chỉ số thành công

- **SM-1:** Admin tạo được Hóa đơn `DRAFT` cho toàn bộ Học sinh đủ điều kiện của một tháng trong một thao tác, không có Hóa đơn trùng. Xác thực FR-6.
- **SM-2:** Admin có thể hoàn tất một Hóa đơn và xác định được người tạo, người xác nhận, số tiền, phương thức thanh toán và thời điểm từ trang chi tiết. Xác thực FR-8.
- **SM-3:** Báo cáo tháng khớp với tổng các Hóa đơn `COMPLETED`, bao gồm phân tách tiền mặt và từng Tài khoản nhận tiền. Xác thực FR-11.
- **SM-C1:** Không tối ưu tốc độ tạo Hóa đơn bằng cách tự động chuyển chúng sang `PENDING` hoặc `COMPLETED`; Admin phải luôn có cơ hội rà soát và xác nhận. Cân bằng SM-1.

## 9. Câu hỏi mở

Không còn câu hỏi chặn triển khai cho MVP. Các quy tắc hiển thị chi tiết và luồng màn hình sẽ được cụ thể hóa trong UX specification.

## 10. Chỉ mục giả định

Không có giả định chưa được xác nhận.

---
title: "Khảo sát Kidsonline và danh mục chức năng đề xuất cho Ánh Hoa"
status: discovery
created: 2026-08-31
source: "Khảo sát thủ công phiên quản trị Kidsonline đã được cấp quyền truy cập"
---

# Khảo sát Kidsonline và danh mục chức năng đề xuất cho Ánh Hoa

## 1. Mục đích và phạm vi khảo sát

Tài liệu này ghi nhận các chức năng quan sát được trong giao diện quản trị Kidsonline của trường đang đăng nhập, sau đó chuyển chúng thành danh mục chức năng có thứ tự ưu tiên cho Ánh Hoa.

Đây là tài liệu discovery, không phải PRD và không thay đổi các artifact đã `final`. Không nên sao chép toàn bộ Kidsonline: Ánh Hoa nên giữ mục tiêu là hệ thống vận hành và thu phí gọn, đáng tin cậy cho một trường mầm non trước khi mở rộng thành bộ quản trị trường học đầy đủ.

### Giới hạn bằng chứng

- Khảo sát thực hiện ngày 31/08/2026, bằng phiên quản trị sẵn có tại `https://komt.kidsonline.edu.vn`.
- Chỉ ghi nhận màn hình, nhãn, dữ liệu hiển thị và luồng đọc được; không tạo, sửa hoặc gửi dữ liệu trên Kidsonline.
- Một số menu cấp cao dùng submenu JavaScript không thể liệt kê đầy đủ qua accessibility tree. Các hạng mục được đánh dấu "cần xác minh" phải được walkthrough cùng người vận hành trước khi đưa vào PRD.

## 2. Kết luận điều hành

Kidsonline tổ chức sản phẩm quanh bốn mảng: **dashboard vận hành hằng ngày**, **danh bộ**, **hoạt động lớp học và giao tiếp phụ huynh**, **tài chính/báo cáo**. Ánh Hoa đã có nền tảng yêu cầu phù hợp cho mảng danh bộ, hóa đơn, VietQR và báo cáo thu; Parent PWA đã bao phủ một phần quan trọng của trải nghiệm phụ huynh.

Khuyến nghị thứ tự đầu tư:

1. Hoàn thành Admin MVP và Parent PWA đã chốt trước; đây là lõi thu phí và nguồn dữ liệu cần thiết cho mọi phần sau.
2. Xây dựng vận hành lớp học hằng ngày: điểm danh đến/về, đơn xin nghỉ và nhật ký hoạt động/ngày.
3. Bổ sung giao tiếp phụ huynh có kiểm soát: thông báo, album và đọc/xác nhận đơn.
4. Chỉ sau khi quy trình thực tế ổn định mới cân nhắc y tế, thực đơn, kế hoạch học tập, nhân sự, báo cáo chuyên sâu và tự động hóa tài chính.

## 3. Chức năng đã quan sát

### 3.1 Dashboard vận hành

Màn "Bảng tin" tập hợp tình hình trong ngày và tháng:

- Trung tâm đơn với số lượng đơn theo loại: xin nghỉ, dặn thuốc, lời nhắn, đưa đón, lời cảm ơn và nhắn gửi phụ huynh.
- Việc cần hoàn tất theo lớp: bài viết mới, album mới, kế hoạch ngày và thực đơn ngày.
- Báo cáo điểm danh: tổng số học sinh, tỷ lệ/trạng thái và liên kết đến báo cáo chi tiết.
- Báo cáo hoạt động theo lớp: điểm danh đến/về, học, ăn, ngủ, vệ sinh, nhận xét ngày/tuần, album và bài viết.
- Chỉ số danh bộ: học sinh trong lớp, học thử, mới nhập học, phụ huynh đã kích hoạt và học sinh chưa cập nhật y tế.
- Biểu đồ bài viết/album trong tuần, chỉ số nhân sự/giáo viên, tổng quan học phí tháng và sinh nhật tháng.

**Nhận định:** mô hình dashboard theo "việc cần xử lý hôm nay" hữu ích hơn dashboard chỉ có KPI. Ánh Hoa nên đưa các shortcut từ dashboard tới đúng danh sách đã lọc theo tháng, lớp hoặc trạng thái.

### 3.2 Danh bộ: học sinh, phụ huynh, nhân viên

Màn "Học sinh" có các tab Nhân viên, Phụ huynh và Học sinh. Danh sách học sinh quan sát được có:

- Năm học, tạo mới, lọc, lọc theo tuổi, tìm kiếm, phân trang, tải xuống và tải lên.
- Trạng thái hành chính: học thử, chờ phân lớp, sắp vào lớp, trong lớp, bảo lưu, nghỉ học, tốt nghiệp.
- Mã học sinh, tên/biệt danh, ngày sinh, giới tính, lớp hiện tại, mẹ, bố, số điện thoại và tình trạng đã đăng nhập của phụ huynh.
- Thao tác theo từng học sinh qua menu ngữ cảnh.

**Nhận định:** Ánh Hoa hiện đã có Lớp, Học sinh và liên kết Parent-Học sinh trong phạm vi. Những khả năng còn thiếu nhưng có giá trị sau MVP là năm học, danh bộ phụ huynh riêng, import/export có kiểm soát và vòng đời học sinh chi tiết hơn.

### 3.3 Trung tâm đơn và yêu cầu từ phụ huynh

Màn "Trung tâm đơn" có các tab:

- Xin nghỉ.
- Dặn thuốc.
- Lời nhắn đầu ngày.
- Lời cảm ơn.
- Đưa đón.

Danh sách đơn xin nghỉ cho thấy: khoảng ngày, lọc, tìm kiếm, tải xuống; thông tin học sinh/lớp; số ngày nghỉ; nội dung; thời điểm/người gửi; trạng thái người gửi và người nhận; thời điểm/người xác nhận.

**Nhận định:** đây là mô-đun có tác động vận hành cao nhất sau thu phí. Nên bắt đầu bằng xin nghỉ, sau đó mới cân nhắc lời nhắn và thay đổi đưa đón. Dặn thuốc có rủi ro an toàn và trách nhiệm cao, không nên đưa vào sớm nếu chưa có quy trình phê duyệt và lưu vết rõ ràng.

### 3.4 Điểm danh và báo cáo hoạt động

Màn "Báo cáo điểm danh đến" có:

- Chọn ngày và chuyển giữa điểm danh đến/điểm danh về.
- Tổng hợp toàn trường: sĩ số, đơn xin nghỉ, đi học, có phép, không phép, chưa xác định.
- Bảng theo lớp gồm sĩ số, số lượng từng trạng thái và trạng thái đã/chưa điểm danh.
- Xuất báo cáo.

Màn "Báo cáo hoạt động" có báo cáo ngày/tuần và ma trận theo lớp: điểm danh, học, ăn, ngủ, vệ sinh, nhận xét ngày/tuần, điểm danh về, album ảnh và bài viết.

**Nhận định:** nên thiết kế điểm danh là nguồn dữ liệu gốc cho dashboard, đơn xin nghỉ và báo cáo. Tránh chỉ làm bảng báo cáo trước khi định nghĩa nghiệp vụ ghi nhận điểm danh tại lớp.

### 3.5 Truyền thông trường - phụ huynh

Màn "Bài viết" có:

- Tạo bài viết, khoảng thời gian, lọc, sắp xếp và tìm kiếm.
- Các trạng thái/khu vực: bài viết, bài nháp, bài ghim, thùng rác.
- Phạm vi gửi: toàn trường, nhóm học sinh, trong lớp và nội bộ.
- Thống kê hoặc chỉ số tương tác theo bài viết.

Dashboard còn liên kết tới album ảnh theo ngày/tuần.

**Nhận định:** thông báo văn bản có phạm vi người nhận rõ ràng nên đi trước album ảnh. Album đòi hỏi xử lý upload, phân quyền, dung lượng, thời hạn lưu và bảo vệ dữ liệu trẻ em.

### 3.6 Tài chính

Dashboard thể hiện tổng học phí kỳ/tháng, số học sinh, tỷ lệ đã/chưa thu và dẫn tới chi tiết đợt thu. Điều này tương đồng trực tiếp với hướng Admin MVP của Ánh Hoa.

**Nhận định:** không cần sao chép mô hình tài chính tổng quát của Kidsonline. Phạm vi Ánh Hoa hiện có, gồm tạo hóa đơn hàng loạt, snapshot, QR VietQR, xác nhận thủ công và báo cáo theo tháng, là đúng ưu tiên. Bất kỳ tính năng thu thiếu/thừa, công nợ, hoàn tiền, đồng bộ ngân hàng hoặc xuất chứng từ nào cần được tách thành một discovery/PRD riêng.

### 3.7 Các mảng được dashboard nhắc đến nhưng chưa khảo sát sâu

- Kế hoạch ngày và hoạt động học tập.
- Thực đơn.
- Y tế, chiều cao/cân nặng.
- Sinh nhật.
- Quản trị cấu hình trường, lớp, vai trò/quyền và tài khoản.
- Báo cáo tài chính chi tiết, xuất dữ liệu.

Các mảng này chỉ là tín hiệu từ dashboard hoặc URL liên kết, chưa đủ bằng chứng để mô tả chi tiết nghiệp vụ.

## 4. Bản đồ chức năng cho Ánh Hoa

| Nhóm chức năng | Khả năng cụ thể | Tình trạng với Ánh Hoa | Quyết định đề xuất |
| --- | --- | --- | --- |
| Truy cập quản trị | Google login, dashboard, audit admin | Đã chốt Admin MVP | Hoàn thành theo PRD hiện tại |
| Danh bộ cơ bản | Lớp, học sinh, chuyển lớp, trạng thái | Đã chốt Admin MVP | Hoàn thành theo PRD hiện tại |
| Tài chính | Mẫu phí, hóa đơn tháng, VietQR, xác nhận, báo cáo | Đã chốt Admin MVP | Hoàn thành theo PRD hiện tại |
| Parent PWA | Liên kết Parent-Học sinh, xem hóa đơn, QR/copy/tải QR | Đã chốt release mở rộng | Hoàn thành sau Admin MVP |
| Dashboard việc cần làm | Hàng đợi tác vụ theo ngày, lớp, trạng thái | Mới có tổng quan tài chính | Nâng cấp trong giai đoạn vận hành lớp học |
| Năm học và vòng đời học sinh | Nhập học, học thử, chờ phân lớp, bảo lưu, tốt nghiệp | Chưa có | Discovery sau khi dữ liệu học sinh cơ bản ổn định |
| Danh bộ phụ huynh/nhân viên | Danh sách, kích hoạt tài khoản, liên kết | Parent link đã chốt; nhân viên chưa có | Parent directory ở giai đoạn giao tiếp; nhân viên để sau |
| Đơn xin nghỉ | Parent gửi, trường xác nhận, liên kết điểm danh | Chưa có | Ưu tiên cao sau Parent PWA |
| Điểm danh đến/về | Theo ngày/lớp/học sinh, trạng thái vắng | Chưa có | Ưu tiên cao sau đơn xin nghỉ |
| Đón muộn | Ghi nhận giờ đón thực tế, lý do, người bàn giao và phụ phí nếu áp dụng | Chưa có | Ưu tiên cao, làm cùng điểm danh về nhưng là mô-đun riêng |
| Nhật ký hằng ngày | Ăn, ngủ, vệ sinh, học, nhận xét | Chưa có | Ưu tiên trung bình; làm theo gói tối thiểu trước |
| Thông báo | Nháp, xuất bản, ghim, phạm vi người nhận | Chưa có | Ưu tiên trung bình sau Parent PWA |
| Album ảnh | Upload, album, quyền xem, retention | Chưa có | Backlog, cần đánh giá riêng tư trước |
| Dặn thuốc | Yêu cầu, xác nhận, nhật ký thực hiện | Chưa có | Backlog rủi ro cao, cần quy trình an toàn riêng |
| Đưa đón | Ủy quyền/đổi người đón, xác nhận | Chưa có | Backlog, cần xác minh quy trình thực tế |
| Thực đơn/kế hoạch học | Lập và công bố theo lớp/ngày | Chưa có | Backlog; chỉ làm khi có người chịu trách nhiệm dữ liệu |
| Y tế | Chỉ số phát triển, hồ sơ sức khỏe | Chưa có | Backlog rủi ro dữ liệu nhạy cảm cao |
| Xuất báo cáo | Excel/CSV/PDF | Ngoài phạm vi MVP | Chỉ bổ sung theo nhu cầu vận hành đã đo lường |

## 5. Lộ trình đề xuất

### Giai đoạn 0: Lõi thu phí và dữ liệu nguồn

Giữ đúng các PRD đã chốt:

- Admin authentication và shell.
- Lớp, học sinh, chuyển lớp, mẫu hóa đơn và tài khoản nhận tiền.
- Hóa đơn `DRAFT -> PENDING -> COMPLETED`, snapshot, QR VietQR, audit và báo cáo tháng.
- Parent PWA chỉ đọc hóa đơn được ủy quyền và hướng dẫn chuyển khoản.

**Điều kiện hoàn thành:** trường có thể lập hóa đơn đúng, phụ huynh xem đúng hóa đơn của con, admin xác nhận thu tiền và đối soát được tháng mà không dựa vào bảng tính song song.

### Giai đoạn 1: Vận hành hằng ngày tối thiểu

Mục tiêu là xử lý việc trường cần biết ngay trong ngày.

- Parent gửi đơn xin nghỉ cho một học sinh và một hoặc nhiều ngày.
- Admin/giáo viên phụ trách lớp xem, chấp nhận hoặc từ chối đơn; lưu người và thời điểm xử lý.
- Điểm danh đến/về theo lớp và ngày, gồm đi học, nghỉ có phép, nghỉ không phép, chưa xác định.
- Ghi nhận đón muộn sau giờ chuẩn: học sinh, giờ chuẩn của trường, giờ đón thực tế, lý do tùy chọn, người ghi nhận và trạng thái đã bàn giao.
- Dashboard "Hôm nay" hiển thị đơn chờ xử lý, lớp chưa điểm danh và liên kết thao tác trực tiếp.
- Báo cáo điểm danh ngày theo lớp, không cần xuất file trong release đầu.

**Quyết định cần chốt trước PRD:** có cần tài khoản giáo viên riêng không, hay admin thực hiện điểm danh trong phiên bản đầu.

#### Phạm vi tối thiểu cho đón muộn

- Cấu hình giờ đón chuẩn theo toàn trường; chỉ hỗ trợ cấu hình riêng theo lớp nếu trường thực sự vận hành khác nhau.
- Khi điểm danh về, hệ thống đánh dấu "đón muộn" nếu giờ bàn giao thực tế sau giờ chuẩn; nhân viên vẫn có thể ghi nhận ngoại lệ có lý do.
- Danh sách cuối ngày cho thấy học sinh chưa được đón, đã đón đúng giờ và đã đón muộn; không cho kết thúc ngày khi còn học sinh chưa có trạng thái bàn giao mà không có lý do.
- Parent chỉ xem được trạng thái/bản ghi của học sinh được ủy quyền. Có thể thông báo trong ứng dụng ở release sau; không nên mặc định gửi SMS/Zalo trong phạm vi đầu.
- Nếu trường thu phụ phí đón muộn, trước tiên chỉ xuất báo cáo các lượt đủ điều kiện. Chỉ tích hợp thành dòng hóa đơn sau khi có quy tắc được phê duyệt về thời gian grace, mức phí, miễn giảm, xử lý tranh chấp và tháng ghi nhận.

**Tách biệt nghiệp vụ:** đón muộn trả lời "khi nào trẻ được bàn giao"; ủy quyền đưa đón trả lời "ai được phép nhận trẻ". Có thể dùng chung bản ghi bàn giao sau này, nhưng không nên gộp hai quy trình trong release đầu.

### Giai đoạn 2: Nhật ký lớp và giao tiếp nền tảng

- Thông báo có nháp, xuất bản, ghim và phạm vi gửi: toàn trường hoặc theo lớp.
- Parent PWA nhận và đọc thông báo thuộc phạm vi được phép.
- Nhật ký ngày tối thiểu theo học sinh hoặc theo lớp: ăn, ngủ, vệ sinh, nhận xét ngắn.
- Báo cáo tuần chỉ tổng hợp từ dữ liệu ngày đã được khóa hoặc có lịch sử chỉnh sửa.

**Nguyên tắc:** không thêm chat tự do ở giai đoạn này; dùng luồng đơn/biểu mẫu và thông báo một chiều để giảm rủi ro bỏ sót trao đổi quan trọng.

### Giai đoạn 3: Mở rộng có kiểm soát

- Album ảnh với phân quyền Parent-Học sinh/Lớp, xóa mềm, giới hạn loại/dung lượng tệp, retention và audit download/xem nếu cần.
- Danh bộ theo năm học và vòng đời học sinh đầy đủ.
- Thực đơn và kế hoạch hoạt động theo lớp/ngày.
- Báo cáo vận hành và export theo nhu cầu đã xác nhận.

### Giai đoạn 4: Chỉ làm khi có business case riêng

- Dặn thuốc, do đây là dữ liệu sức khỏe và thao tác có rủi ro an toàn trẻ em.
- Thay đổi/ủy quyền đưa đón, do cần xác thực người đón và quy trình xử lý ngoại lệ.
- Hồ sơ y tế, biểu đồ phát triển và tài liệu nhạy cảm.
- Đồng bộ ngân hàng, tự đối soát, trả góp, hoàn tiền hay công nợ.
- Chat, SMS/Zalo/email notification, tích hợp bên thứ ba.

## 6. Invariant kỹ thuật cho các giai đoạn mới

Các mô-đun sau phải tuân theo các nguyên tắc hiện có của Ánh Hoa, không đưa nghiệp vụ về client:

- API là nguồn chân lý cho authorization, state transition, thời gian nghiệp vụ, audit và báo cáo.
- Mọi Parent chỉ đọc dữ liệu qua liên kết Parent-Học sinh còn hiệu lực tại thời điểm request; không dựa vào UUID hay dữ liệu client.
- Mutation cookie-auth có origin validation, double-submit CSRF; thao tác có thể bị retry hoặc ảnh hưởng nhiều bản ghi dùng idempotency key và endpoint đối soát operation.
- Không xóa cứng dữ liệu vận hành quan trọng; chọn trạng thái, xóa mềm và snapshot/audit khi cần truy nguyên.
- Điểm danh, đơn xin nghỉ và trạng thái xử lý cần có state machine rõ ràng, người thực hiện và timestamp; không ghi đè không lưu vết với dữ liệu đã công bố cho phụ huynh.
- Ảnh, thông tin sức khỏe và đưa đón là dữ liệu trẻ em nhạy cảm: cần policy quyền xem, retention, upload scanning/giới hạn, và quyết định owner xử lý sự cố trước khi triển khai.
- Tiền tiếp tục dùng VND nguyên `BIGINT`; chỉ server tính tổng và điều khiển trạng thái hóa đơn.

## 7. Câu hỏi cần xác minh trước discovery tiếp theo

1. Ai thực hiện điểm danh đầu ngày và cuối ngày: giáo viên, lễ tân hay admin? Có cần tài khoản giáo viên hay chỉ cần thiết bị dùng chung theo lớp?
2. Đơn xin nghỉ có tự chuyển thành "nghỉ có phép" khi được duyệt không, hay vẫn yêu cầu điểm danh xác nhận riêng?
3. Phụ huynh có thực sự cần gửi dặn thuốc, đổi người đón và lời nhắn trong kênh số không? Quy trình giấy/téléphone hiện tại là gì khi hệ thống lỗi?
4. Giờ đón chuẩn, thời gian grace, ngoại lệ được miễn và người có quyền ghi nhận/chỉnh sửa đón muộn là gì?
5. Trường có thu phụ phí đón muộn không? Nếu có, mức phí tính theo lượt, mốc thời gian hay số phút; ai duyệt miễn/giảm và cách xử lý tranh chấp là gì?
6. Dữ liệu nhật ký nào nhà trường cam kết nhập hằng ngày: ăn, ngủ, vệ sinh, học hay chỉ nhận xét chung?
7. Thông báo có cần xác nhận đã đọc, lịch xuất bản, đa ngôn ngữ hoặc đính kèm không?
8. Ảnh của trẻ được phép lưu bao lâu, ai được upload, ai được xem và quy trình phụ huynh rút đồng ý là gì?
9. Năm học, tuyển sinh và chuyển lớp có cần giữ lịch sử chi tiết ngoài snapshot hóa đơn không?
10. Báo cáo/Excel nào đang được dùng thật mỗi tuần hoặc mỗi tháng? Chỉ đưa các báo cáo đó vào phạm vi.

## 8. Bước tiếp theo

Tổ chức một buổi walkthrough 60-90 phút với quản lý trường và một giáo viên để trả lời các câu hỏi ở phần 7. Sau đó, tạo một PRD độc lập cho **Giai đoạn 1: Đơn xin nghỉ và điểm danh**, thay vì gộp tất cả chức năng Kidsonline vào PRD hóa đơn hiện tại.

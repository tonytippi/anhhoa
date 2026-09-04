---
title: "Danh mục cấu hình trường: tham chiếu Kidsonline cho Ánh Hoa"
status: discovery-proposal
created: 2026-08-31
source: "Khảo sát Kidsonline /v4/school/3139/config/general"
---

# Danh Mục Cấu Hình Trường Cho Ánh Hoa

## 1. Kết luận

Cấu hình trường là năng lực nền bắt buộc khi Ánh Hoa mở rộng từ hệ thống hóa đơn sang hệ thống vận hành trường. Nhưng không nên sao chép một trang "Cấu hình chung" khổng lồ. Mỗi giá trị cấu hình phải thuộc về domain sở hữu nó, có kiểu dữ liệu rõ, phạm vi, validation, audit, thời điểm hiệu lực và quy tắc snapshot nếu nó ảnh hưởng đến tiền/hóa đơn.

Khuyến nghị kiến trúc:

- Có trang điều hướng `Cấu hình trường` để Admin tìm các thiết lập.
- Không có bảng key-value tự do cho quy tắc nghiệp vụ quan trọng.
- Mỗi domain sở hữu API/schema của cấu hình mình: `school-profile`, `calendar`, `finance`, `attendance`, `notifications`, `parent-access`, `daily-activities`.
- Mỗi cập nhật cấu hình phải lưu Admin, thời điểm, giá trị cũ/mới và lý do khi tác động tiền, điểm danh hoặc dữ liệu phụ huynh.
- Cấu hình thay đổi sau khi một đợt thu/hóa đơn/sự kiện đã phát sinh không được sửa lịch sử; transaction phải snapshot policy áp dụng.

## 2. Bằng chứng Kidsonline đã quan sát

Màn `Cấu hình trường học > Chung` có các tab: `Chung`, `Điểm danh`, `Ngoại khóa`, `Thông báo`, `Chương trình đào tạo`, `Cấu hình SMS`.

Trong tab Chung quan sát trực tiếp được:

- Ngày nghỉ cuối tuần: thứ 7/chủ nhật, chỉ chủ nhật, hoặc không nghỉ cuối tuần.
- Bài viết: kiểm duyệt, chuyên mục, ảnh bìa mặc định.
- Album: kiểm duyệt.
- Phụ huynh/nhân viên: buộc đổi mật khẩu lần đăng nhập đầu và mật khẩu mặc định khi tạo mới.
- Hoạt động học: nhận xét từng buổi/cả ngày; kiểu kế hoạch học cơ bản/nâng cao/dạng tệp.
- Hoạt động ăn: nhận xét từng bữa/cả ngày; kiểu thực đơn cơ bản/nâng cao/dạng tệp.
- Kiểm duyệt nhận xét ngày, tệp đính kèm và nhận xét cuối tuần.
- Mẫu câu nhận xét cơ bản/nâng cao.

Trang `Mẫu câu nhận xét` riêng có các loại mẫu cho học, ngủ, vệ sinh, ăn và nhận xét giáo viên; có tạo mới, tìm kiếm, phân trang và thao tác theo từng mẫu.

Các tab còn lại là bằng chứng về phạm vi cấu hình nhưng Browser MCP không trả nội dung tab ổn định. Không suy diễn field chi tiết của Điểm danh, Ngoại khóa, Thông báo, Chương trình đào tạo hoặc SMS nếu chưa walkthrough thêm.

## 3. Phân loại cho Ánh Hoa

| Nhóm | Cấu hình | Ưu tiên | Lý do |
| --- | --- | --- | --- |
| Hồ sơ trường | Tên, logo, timezone `Asia/Ho_Chi_Minh`, địa chỉ/liên hệ, năm học hiển thị | Cao | Nền cho app, receipt, Parent PWA và báo cáo |
| Lịch trường | Lịch chung toàn trường: ngày làm việc, cuối tuần, ngày nghỉ/lễ, ngày bù | Cao | Nguồn cho điểm danh, tiền ăn, đón muộn, kỳ thu |
| Tài chính | Đơn vị VND, tài khoản nhận, hạn thu mặc định, tax treatment, quy tắc đóng trước/công nợ | Cao | Lõi finance ledger và VietQR |
| Đón muộn | Giờ cutoff, grace, block phút, khoản thu, exemption/override policy | Cao khi phát hành điểm danh về | Trực tiếp tác động phí và tranh chấp |
| Điểm danh | Trạng thái hợp lệ, giờ khóa/chỉnh sửa, quy tắc đơn nghỉ, ai được sửa | Cao khi phát hành attendance | Tránh dữ liệu thiếu/ghi đè sau khi đã tính tiền |
| Parent access | Google-only hoặc phương thức login, revalidation/revoke, thông tin liên hệ hỗ trợ | Cao | Bảo vệ dữ liệu trẻ em |
| Thông báo | Phạm vi gửi, mặc định publish/approval, retention, cho phép đính kèm | Trung bình | Chỉ cần khi phát hành communications |
| Nhật ký lớp | Các activity bật/tắt, granular theo buổi/ngày, review/approval | Trung bình | Chỉ cần khi phát hành daily journal |
| Mẫu câu nhận xét | Danh mục và câu gợi ý theo hoạt động | Thấp/trung bình | Tăng tốc nhập liệu, không phải nền nghiệp vụ |
| Album | Review, loại/dung lượng file, retention, consent | Trung bình nhưng rủi ro cao | Dữ liệu ảnh trẻ em |
| SMS/email/Zalo | Provider, template, quota, consent, delivery log | Để sau | Rủi ro chi phí/pháp lý và cần notification domain hoàn chỉnh |
| Ngoại khóa/chương trình đào tạo | Chương trình, học phần, lịch, pricing | Để sau | Là domain riêng, không phải trường settings đơn giản |
| Default password | Không sao chép | Không làm | Parent/Admin dùng Google OAuth; không giữ mật khẩu mặc định |

## 4. Cấu hình cốt lõi cần làm trước

### 4.1 Hồ sơ và lịch trường

`SchoolProfile`:

- Tên hiển thị, logo, địa chỉ, số điện thoại/email hỗ trợ, timezone cố định `Asia/Ho_Chi_Minh`.
- Các trường này snapshot vào receipt hoặc thông báo nếu cần in/hiển thị lịch sử.

`SchoolCalendar` và `CalendarException`:

- Một lịch chung toàn trường: working weekdays, ví dụ thứ 2-thứ 7; chưa có lịch riêng theo lớp ở release đầu.
- Ngày nghỉ/lễ, ngày học bù và mô tả.
- API hỏi calendar bằng ngày, không để web tự suy ra ngày nghỉ.
- Thay đổi lịch có `effectiveFrom`; không tự tính lại hoàn trả/nộp trước/late-pickup/meal đã snapshot hoặc invoice đã `ISSUED`.

### 4.2 Finance settings

`FinancePolicy` phải do finance module sở hữu:

- Currency: VND nguyên, không cho Admin đổi sang tiền tệ khác.
- Default due day hoặc policy tính `dueOn` khi tạo `CollectionRun`; run vẫn snapshot hạn thu thực tế.
- Tax treatment options được phép: `NOT_DECLARED`, `ZERO_PERCENT`; không tự tính VAT trước khi có yêu cầu pháp lý riêng.
- Nợ cũ trong cùng `SchoolYear` được gộp thành từng dòng `PRIOR_DEBT` khi preview/generate invoice mới; không auto-carryover sang năm học mới.
- Prepayment policy: nộp trước gắn cố định với một học sinh, có thể nhắm run/khoản, không chuyển nhượng và được hoàn tiền nếu học sinh nghỉ trước khi áp dụng.
- `reversalApprovalMode`: `DIRECT` hoặc `SCHOOL_ADMIN_APPROVAL`; mode hai bước yêu cầu Finance Manager tạo yêu cầu và School Admin duyệt.
- Một School có nhiều tài khoản nhận tiền active; batch từ CollectionRun chỉ tạo invoice `DRAFT`, không chọn tài khoản. Finance Manager bắt buộc chọn một tài khoản riêng khi rà soát và issue từng invoice; API snapshot nó vào payment instruction. Transfer content mặc định là mã học sinh + tên lớp snapshot.

Không lưu các policy trên trong JSON blob. Chúng phải có typed columns/enums, validate server-side và version/audit.

### 4.3 Attendance và đón muộn

`AttendancePolicy`:

- Các status đến/về được phép, deadline điểm danh, thời hạn/lý do bắt buộc khi sửa sau cutoff.
- Parent tạo đơn nghỉ cho trẻ được ủy quyền. Đơn gửi trước `15:00` ngày ngay trước ngày nghỉ đầu tiên tự duyệt; từ `15:00` trở đi cần `SCHOOL_ADMIN` hoặc `FINANCE_MANAGER` duyệt mới được trừ tiền ăn. Một đơn nhiều ngày hợp lệ áp dụng toàn bộ ngày đã duyệt. API snapshot thời điểm gửi, approval và ngày áp dụng vào invoice.
- `AttendancePolicy.photoEvidenceMode` là cấu hình theo School: `REQUIRED` buộc giáo viên upload ảnh trước khi xác nhận `PRESENT`; `OPTIONAL` cho phép xác nhận không ảnh. API snapshot mode áp dụng. Parent nhận notification in-app sau confirmation nhưng không xem evidence ảnh release đầu. Attendance không được tạo/xác nhận vào ngày SchoolCalendar nghỉ/lễ, trừ ngày học bù đã cấu hình.
- Đơn duyệt tạo proposed absence cho attendance nhưng không khóa giáo viên xác nhận `PRESENT`. `PRESENT` có ảnh trên ngày trùng override deduction finance/gói thứ bảy của ngày đó, đánh dấu conflict trên leave request và thông báo Parent; không sửa invoice đã `ISSUED`.
- Ảnh attendance là evidence nhạy cảm: blob/bản xem giữ đúng hai tháng lịch từ confirmation rồi xóa; audit metadata giữ deletion timestamp nhưng không giữ ảnh. Chỉ Staff có attendance capability và School Admin xem trong school scope; Parent không xem/browse/tải ảnh release đầu. Parent notification chỉ xác nhận event, không đính kèm ảnh.
- Quyền sửa dữ liệu quá khứ và audit bất biến.

`ServiceEnrollmentPolicy`:

- School cấu hình dịch vụ thu định kỳ như học full thứ bảy; `StudentServiceEnrollment` có effective dates, trạng thái và audit.
- Học sinh không có đăng ký thứ bảy bị tính học lẻ từ attendance giáo viên ghi. Không charge trùng ngày đã được service enrollment active bao phủ.
- Gói thứ bảy chỉ được trừ khi có leave request đủ điều kiện và không có `PRESENT` đã xác nhận trong ngày đó; hủy dịch vụ được duyệt là nguồn hợp lệ cho refund. Finance chỉ tạo refund/adjustment trong `DRAFT` hoặc record mới có liên kết sau `ISSUED`.
- Parent hoặc School Admin tạo yêu cầu nghỉ dài hạn; chỉ School Admin duyệt/từ chối và xác nhận effective date không trước ngày yêu cầu. School Admin hoặc Finance Manager tạo/hủy service enrollment theo thông báo/yêu cầu Parent; Parent không tự hủy dịch vụ. Sau approval, API dừng charge future run từ effective date.

`LatePickupPolicy`:

- School cấu hình cutoff, grace, `blockMinutes` và rounding `CEILING`; `17:30` chỉ là ví dụ, không phải default platform. Policy có version/effective date khi thay đổi sau.
- Giáo viên xác nhận `pickedUpAt` thực tế trong app; API tính blocks và snapshot cutoff/block/unit price/source event vào invoice.
- Danh sách lý do miễn/override và vai trò có quyền duyệt.
- `effectiveFrom` và phiên bản policy snapshot trên sự kiện phí.

Không cho sửa grace/cutoff để thay đổi phí của các bản ghi đã bill. Quy tắc mới chỉ áp dụng cho record có thời điểm sau hiệu lực.

### 4.4 Parent access và notification foundation

`ParentAccessPolicy`:

- Google identity required, revoke có hiệu lực request tiếp theo, session lifetime, đường dẫn hỗ trợ.
- Không có default password, SMS password hay phone fallback nếu không có release riêng.

`NotificationPolicy` chỉ thêm khi có communications:

- Kênh cho phép, quiet hours, approval requirement, audience scope, retention và audit delivery/read.
- Không đưa API key provider vào setting UI/DB. Secrets chỉ qua environment/secret manager.

## 5. Những chức năng ngoài tài chính đáng quan tâm tiếp theo

Ngoài cấu hình, Kidsonline còn gợi ý các capability nên đưa vào product map của Ánh Hoa theo thứ tự:

1. **Năm học và calendar**: nền cho lớp, ngày nghỉ, đợt thu, điểm danh và báo cáo.
2. **Điểm danh đến/về và bàn giao**: nguồn dữ liệu cho đơn nghỉ, an toàn trẻ em và phí đón muộn.
3. **Finance ledger**: danh mục khoản thu, giảm trừ, đợt thu, invoice, receipt, allocation, đóng trước, credit, công nợ.
4. **Parent communication**: thông báo phạm vi lớp/trường, trạng thái đọc và lịch sử gửi.
5. **Nhật ký hoạt động/ngày**: ăn, ngủ, vệ sinh, nhận xét, sau khi giáo viên/nhân viên có vai trò phù hợp.
6. **Đưa đón được ủy quyền**: người được phép đón, thay đổi tạm thời, mã/xác nhận bàn giao, exception audit.
7. **Album và tệp đính kèm**: chỉ sau khi có consent, retention, scan/upload policy và phân quyền chặt.
8. **Sức khỏe/dặn thuốc**: domain rủi ro cao, phải có policy dữ liệu nhạy cảm, approval và audit riêng.

## 6. Nguyên tắc thiết kế cấu hình

- Chỉ expose setting khi có domain/module tiêu thụ nó. Không tạo settings rỗng cho roadmap xa.
- Cấu hình có ảnh hưởng tiền, access, attendance hoặc dữ liệu trẻ em cần version, effective date, audit và confirmation UI.
- Cấu hình hiển thị phải mô tả tác động, ví dụ: `Áp dụng cho lượt bàn giao từ 01/09/2026; không đổi phí đã phát sinh.`
- Không lưu secret OAuth/SMS/bank provider trong database hoặc cho Admin xem lại. Dùng `.env`/secret manager và validate bootstrap.
- Không dùng boolean mơ hồ như `enableLateFee`; dùng policy typed có giá trị/điều kiện đầy đủ.
- Tất cả mutation cookie-auth yêu cầu origin validation và double-submit CSRF; mutation ảnh hưởng hàng loạt hoặc tính tiền dùng `Idempotency-Key` và operation reconciliation.
- Các cấu hình policy phải được API áp dụng, không để Parent PWA/web tự tính ngày nghỉ, công nợ, phí muộn hoặc quyền truy cập.

## 7. IA đề xuất

Sidebar chỉ thêm `Cấu hình trường` khi ít nhất hai domain dùng setting. Trang có section card/link, không nhồi toàn bộ form vào một tab:

- Thông tin trường
- Lịch và ngày nghỉ
- Tài chính và thanh toán
- Điểm danh và bàn giao
- Truy cập phụ huynh
- Thông báo
- Nội dung lớp học
- Dữ liệu, consent và retention

Mỗi section mở trang riêng, có `h1`, mô tả phạm vi, last changed metadata, danh sách phiên bản/tác động nếu là policy nhạy cảm, form rõ ràng và confirm modal cho thay đổi có hiệu lực thực tế.

## 8. Câu hỏi cần chốt

1. Trường có một lịch làm việc chung hay cần lịch theo lớp/chương trình?
2. Ngày nghỉ/lễ có ảnh hưởng tự động tới học phí, tiền ăn, giảm trừ và đón muộn như thế nào?
3. Ai được quyền thay đổi policy tài chính/điểm danh và cần phê duyệt hai người cho thay đổi nào?
4. Chính sách lưu giữ receipt, invoice, notification, ảnh và sức khỏe là bao lâu?
5. Parent có cần xem lịch, deadline thu phí, số dư credit/công nợ và lịch sử payment hay chỉ invoice hiện tại?
6. Nếu thêm SMS/Zalo/email, ai trả phí, ai quản template, cách lưu consent và xử lý gửi lỗi là gì?
7. Có trường hợp giờ đón cutoff khác nhau theo lớp, ngày hoặc dịch vụ không?

## 9. Bước tiếp theo

Viết PRD/architecture change theo hai lát độc lập:

1. `School profile, calendar và finance policy` cùng finance ledger, vì các policy này chi phối đợt thu, công nợ, đóng trước và đón muộn.
2. `Attendance, handover và late pickup` sau khi chốt ai là người thao tác và quy trình ngoại lệ tại cổng trường.

Không triển khai các setting nội dung, SMS, album hoặc đào tạo trước khi domain sử dụng chúng có PRD riêng.

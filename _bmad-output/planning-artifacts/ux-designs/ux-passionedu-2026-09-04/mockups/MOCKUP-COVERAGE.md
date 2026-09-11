# Phạm vi bản mẫu PassionEdu

Mở `review.html` trong trình duyệt để bắt đầu rà soát. Các bản mẫu là HTML tĩnh có hộp thoại mô phỏng; không gửi yêu cầu hay lưu dữ liệu. `DESIGN.md` và `EXPERIENCE.md` vẫn được ưu tiên nếu có xung đột.

Các trang Admin/Nhân viên hiện hành nằm trong `admin/` và chia sẻ `admin/admin-shell.js`: script `defer` cổ điển dựng skip link, sidebar, ngữ cảnh Ánh Hoa · Năm học 2026-2027 và avatar từ `data-admin-route`. Script không dùng module, network hay API của extension, nên mở trực tiếp từ hệ thống tệp hoặc VS Code Preview đều hoạt động. Các trang trực tiếp trong `admin/` dùng `../prototype.css`, `admin-shell.js` và `../prototype.js`; các trang trong `admin/roster/` dùng cố định `../../prototype.css`, `../admin-shell.js` và `../../prototype.js` để tương thích Preview. `admin/admin-operational-queue.html` chuyển rõ ràng sang workspace dùng shell chung, không còn dashboard/CSS riêng. Parent và Ops nằm lần lượt trong `parent/` và `ops/`, dùng tài nguyên chung qua `../`.

| Cổng thông tin | Tệp | Màn hình được mô phỏng |
| --- | --- | --- |
| Mục lục rà soát | `review.html` | Điểm bắt đầu và hướng dẫn rà soát toàn bộ quy trình. |
| Quản trị và nhân sự | `admin/admin-staff.html` | Workspace vận hành: Tổng quan ưu tiên đơn nghỉ và bàn giao theo bảng có ngữ cảnh Trường/ngày, bộ lọc, xác nhận có tên và đối soát thao tác. Điểm danh chỉ được cấu hình theo chính sách tại Cấu hình trường. |
| Cấu hình trường | `admin/school-settings.html` | Hồ sơ Trường Ánh Hoa, lịch, chính sách tài chính/điểm danh/bàn giao/quyền xem Phụ huynh theo hiệu lực và lịch sử; tài khoản nhận tiền có tìm, lọc, sắp xếp, trang URL-backed, ngừng dùng không xóa và đối soát thao tác. |
| Danh bộ | `admin/roster/roster.html` | Danh sách Trường Ánh Hoa với tìm kiếm, lọc, sắp xếp và trang trong URL; bảng, caption, empty state và mã chỉ trong thông tin đối soát. |
| Năm học và lớp | `admin/roster/school-year-classes.html` | Một năm học đang hiệu lực, lớp thuộc năm học, ngày hiệu lực và lỗi máy chủ có summary được focus/liên kết. |
| Hồ sơ và ghi danh | `admin/roster/student-enrollment.html` | Hồ sơ học sinh tách ghi danh, khoảng hiệu lực và lịch sử bằng nhãn nghiệp vụ ngắn. |
| Liên kết Phụ huynh | `admin/roster/student-parent-links.html` | Hồ sơ/lời mời tách liên kết với học sinh; trạng thái quyền chỉ theo kết quả hệ thống và thu hồi có đối soát. |
| Nhân sự và phân công | `admin/roster/staff-assignments.html` | Hồ sơ, quyền truy cập và phân công hiệu lực tách biệt; không ngụ ý đăng nhập hay năng lực thao tác. |
| Chuyển danh bộ | `admin/roster/roster-transition.html` | Xem trước từ hệ thống, bản ghi không chuyển không có thao tác, xác nhận có tên và đối soát kết quả. |
| Cấu hình khoản thu | `admin/receivable-configuration.html` | Bốn tab có thể mở trực tiếp bằng liên kết: Danh sách khoản thu, Bảng khoản thu theo lớp, Chính sách ưu đãi và Phí đón muộn. Danh sách khoản thu cho xem ngay phạm vi áp dụng của mỗi khoản. Từ Thêm mới hoặc Sửa trong danh sách, bản mẫu mở biểu mẫu của khoản thu đó; biểu mẫu gồm thông tin, phạm vi áp dụng và cách tính số lượng. Bảng khoản thu theo lớp là ma trận có lọc theo kỳ/lớp: mỗi hàng là học sinh, mỗi cột là mọi khoản thu đang áp dụng cho lớp. Khoản thu theo phạm vi chỉ đọc trong bảng; Kế toán bật hoặc bỏ dịch vụ chọn riêng, ví dụ Học thứ 7, cho từng học sinh. Chính sách ưu đãi là danh mục versioned: một hoặc nhiều khoản thu target, số lượng/đơn vị, mức giảm, cách áp dụng, kết hợp và hiệu lực; policy gán học sinh là cơ chế tổng quát, không suy luận quan hệ gia đình. Bảng không đặt giá riêng hoặc thay hóa đơn đã phát hành. Phạm vi chỉ có Toàn trường, Khối, Lớp và Nhóm học sinh; Khối/Nhóm học sinh là taxonomy minh họa, chưa có API hay dữ liệu thật. Phí đón muộn chỉ hiển thị khung giờ và thống kê do hệ thống trả về. |
| Thống kê đón muộn | `admin/late-pickup-statistics.html` | Finance lọc đợt thu hoặc khoảng ngày, tìm học sinh và xem ma trận học sinh-ngày fixture từ hệ thống: giờ trả trẻ, block/VND materialized, tổng block và tổng phí. Export chỉ là bản mẫu; trình duyệt không tính lại. |
| Đợt thu | `admin/invoice-generation.html` | Đây là workspace Finance trên sidebar: landing table-first cho các đợt thu vận hành, filter fixture, chỉ số ngắn và tạo run từ Receivable active/đúng scope/còn hiệu lực. Click một đợt mở detail theo Student: lớp, khoản thu snapshot, gross/ưu đãi/cần thu/đã thu/còn thiếu, trạng thái Invoice và projection chỉ đọc khi không tạo hóa đơn. `PREPAID_COVERAGE` không hiện là run/flow trên trang này; browser chỉ render projection server-confirmed. |
| Rà soát hóa đơn | `admin/invoice-detail-review.html` | Deep destination chỉ sau khi chọn Student và Invoice từ Đợt thu, không phải sidebar workspace. Hóa đơn nháp có dòng tiền, điều chỉnh, tài khoản nhận tiền và phát hành; hóa đơn đã phát hành là chỉ đọc. Thu tiền bắt đầu từ Invoice đã phát hành còn thiếu, thanh toán đủ cho đúng một học sinh; Invoice đã thu đủ chỉ đọc. Mã đối soát chỉ nằm trong disclosure. |
| Thiết lập Payroll | `admin/payroll-overview.html` | Payroll entitlement không tự cấp quyền; Kế toán là persona Finance Manager, School Admin khác người gửi phê duyệt và Finance Manager xác nhận chi. |
| Chấm công Payroll | `admin/payroll-timekeeping-import.html` | Finance Manager Kế toán có capability import/review; dữ liệu nguồn đã commit bất biến và không lộ qua route khi thiếu entitlement/capability. |
| Rà soát Payroll | `admin/payroll-run-review.html` | Finance Manager prepare/reconcile/submit; cùng identity không tự duyệt qua grant khác, sau duyệt chỉ Finance Manager có capability payout mới xác nhận chi. |
| Correction Payroll | `admin/payroll-correction.html` | Finance Manager tạo/gửi correction, School Admin khác identity duyệt, Finance Manager xác nhận chi bổ sung; Payroll gốc đã paid luôn chỉ đọc. |
| Giáo viên | `teacher/teacher.html` | Cổng Teacher mobile-first: chỉ hiện Class được phân công; nhận trẻ, trả trẻ và DailyJournal per Student/date. Danh sách nhận xét tìm/lọc trong các trẻ đã được hiển thị, nêu count/trạng thái/CTA theo current journal do server xác nhận, có empty state giữ Class/ngày và được xóa khi revoke. Mô phỏng xác nhận server, đối soát idempotency, ảnh JPEG/PNG/WebP tối đa 10 MB/ảnh và tách ảnh journal khỏi attendance evidence. |
| Phụ huynh | `parent/parent.html` | Trang chủ phụ huynh; thẻ hôm nay; lịch sử điểm danh của trẻ; đơn xin nghỉ; thông tin thanh toán theo bản chụp; hộp thư và trạng thái an toàn khi thu hồi quyền. |
| Vận hành nền tảng | `ops/ops.html` | Danh sách trường; khởi tạo/chủ sở hữu ban đầu; tạm ngừng/kích hoạt lại; đối soát thao tác và trạng thái lỗi. |

## Trạng thái liên thông

- Cảnh báo khi đổi trường và ngữ cảnh thao tác có dữ liệu chưa lưu/chưa xác định kết quả.
- Đối soát thao tác sau khi hết thời gian chờ; không gửi lại yêu cầu khi chưa xác định kết quả.
- Xem trước do máy chủ quyết định, khóa vòng đời, kết quả bỏ qua và số tiền tài chính.
- Xung đột trường dữ liệu/chính sách, trạng thái quyền truy cập an toàn khi thu hồi và tối thiểu hóa dữ liệu phụ huynh.
- Phí đón muộn dùng phiên bản cấu hình theo Trường, thời điểm trả trẻ đã xác nhận và số liệu hệ thống đã ghi nhận; trang không tự tính phí. Phí nộp tiền muộn không có tab, mức phí hay thao tác vì chưa có chính sách được chốt.
- Teacher là cổng duy nhất ghi nhận điểm danh theo School/Class/date có binding, capability và assignment hiệu lực; Admin chỉ cấu hình policy điểm danh typed/versioned tại Cấu hình trường, không có danh sách, route hay mutation điểm danh.
- DailyJournal là current version theo Student/date; phụ huynh chỉ xem nội dung/ảnh được server xác nhận, không xem attendance evidence, danh tính Teacher hay audit/version history.
- Danh sách nhận xét Teacher chỉ đổi từ `Chưa có nhận xét` sang `Đã có nhận xét` sau kết quả terminal; khi đang đối soát, list giữ nguyên và không cho gửi lại.
- Thanh toán chính xác, khoản trả trước tường minh, ngữ cảnh điều chỉnh/hoàn tiền hai bước.
- School cấu hình program; chỉ School Admin chọn program active/tháng bắt đầu sau thỏa thuận trực tiếp. `PREPAID` source chứa fact nhiều kỳ và coverage chỉ phát hành sau exact Receipt/Allocation khiến source `PAID`; Parent không có lựa chọn gói, payment mutation hay detail coverage.
- Cấu hình trường luôn nêu ngữ cảnh Trường, giá trị đang áp dụng/dự kiến, ngày hiệu lực, lý do khi cần và thông tin đối soát; xung đột giữ giá trị để sửa, không thay bản chụp quá khứ. Tài khoản ngừng dùng chỉ đọc trong lịch sử và không có thao tác xóa hoặc dùng cho hóa đơn mới.
- Partial, excess, unallocated, mixed-Student và cross-School/cross-SchoolYear settlement bị từ chối; không có Student Prepayment hay generic balance. Coverage issued giữ snapshot bất biến, thay đổi dịch vụ đi qua correction/refund review.
- “Kế toán” trên bốn trang Payroll là persona của `FINANCE_MANAGER`, không phải role mới. Mọi trang/action cần Payroll entitlement và capability riêng; Finance Manager prepare/reconcile/submit và xác nhận payout, School Admin khác identity approve/refuse và có thể reopen approved-unpaid. Same-identity approval bị server từ chối kể cả khi actor có nhiều grant.

## Bản mẫu mốc hiện có

Các bản mẫu mốc không thuộc workspace Admin hiện hành vẫn được giữ để truy vết:

- `admin/finance-run-preview.html`
- `parent/parent-home.html`
- `parent/parent-inbox.html`

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
| Cấu hình khoản thu | `admin/receivable-configuration.html` | Catalog theo bảng, nhóm, tìm/lọc/sắp xếp, phân trang, đơn giá VND, hiệu lực, trạng thái và tùy chọn ngắn. Quy tắc, lịch sử và thông tin đối soát chỉ đọc nằm trong disclosure; chương trình nộp trước tách khỏi catalog và chỉ quản trị viên trường mới có điểm vào tạo nguồn. |
| Tạo hóa đơn | `admin/invoice-generation.html` | Luồng tạo đợt thu theo bảng: xem trước, khoản thu, nợ cũ, lý do bỏ qua, tổng VND và tạo hóa đơn nháp. Luồng nộp trước riêng cho quản trị viên trường, nêu rõ chỉ có quyền miễn thu sau khi thanh toán đủ; mã đối soát chỉ nằm trong disclosure. |
| Rà soát hóa đơn | `admin/invoice-detail-review.html` | Hóa đơn nháp có dòng tiền, điều chỉnh, tài khoản nhận tiền và phát hành; hóa đơn đã phát hành là chỉ đọc. Nộp trước nêu thanh toán đủ cho đúng một học sinh, thông tin đã chốt và rà soát khi hoàn tiền; mã đối soát chỉ nằm trong disclosure. |
| Giáo viên | `teacher/teacher.html` | Cổng Teacher mobile-first: chỉ hiện Class được phân công; nhận trẻ, trả trẻ và DailyJournal per Student/date. Mô phỏng xác nhận server, đối soát idempotency, ảnh JPEG/PNG/WebP tối đa 10 MB/ảnh và tách ảnh journal khỏi attendance evidence. |
| Phụ huynh | `parent/parent.html` | Trang chủ phụ huynh; thẻ hôm nay; lịch sử điểm danh của trẻ; đơn xin nghỉ; thông tin thanh toán theo bản chụp; hộp thư và trạng thái an toàn khi thu hồi quyền. |
| Vận hành nền tảng | `ops/ops.html` | Danh sách trường; khởi tạo/chủ sở hữu ban đầu; tạm ngừng/kích hoạt lại; đối soát thao tác và trạng thái lỗi. |

## Trạng thái liên thông

- Cảnh báo khi đổi trường và ngữ cảnh thao tác có dữ liệu chưa lưu/chưa xác định kết quả.
- Đối soát thao tác sau khi hết thời gian chờ; không gửi lại yêu cầu khi chưa xác định kết quả.
- Xem trước do máy chủ quyết định, khóa vòng đời, kết quả bỏ qua và số tiền tài chính.
- Xung đột trường dữ liệu/chính sách, trạng thái quyền truy cập an toàn khi thu hồi và tối thiểu hóa dữ liệu phụ huynh.
- Bằng chứng điểm danh bắt buộc, xung đột đơn nghỉ và không tự động tính phí đón muộn.
- Teacher là cổng duy nhất ghi nhận điểm danh theo School/Class/date có binding, capability và assignment hiệu lực; Admin chỉ cấu hình policy điểm danh typed/versioned tại Cấu hình trường, không có danh sách, route hay mutation điểm danh.
- DailyJournal là current version theo Student/date; phụ huynh chỉ xem nội dung/ảnh được server xác nhận, không xem attendance evidence, danh tính Teacher hay audit/version history.
- Thanh toán chính xác, khoản trả trước tường minh, ngữ cảnh điều chỉnh/hoàn tiền hai bước.
- School cấu hình program; chỉ School Admin chọn program active/tháng bắt đầu sau thỏa thuận trực tiếp. `PREPAID` source chứa fact nhiều kỳ và coverage chỉ phát hành sau exact Receipt/Allocation khiến source `PAID`; Parent không có lựa chọn gói, payment mutation hay detail coverage.
- Cấu hình trường luôn nêu ngữ cảnh Trường, giá trị đang áp dụng/dự kiến, ngày hiệu lực, lý do khi cần và thông tin đối soát; xung đột giữ giá trị để sửa, không thay bản chụp quá khứ. Tài khoản ngừng dùng chỉ đọc trong lịch sử và không có thao tác xóa hoặc dùng cho hóa đơn mới.
- Partial, excess, unallocated, mixed-Student và cross-School/cross-SchoolYear settlement bị từ chối; không có Student Prepayment hay generic balance. Coverage issued giữ snapshot bất biến, thay đổi dịch vụ đi qua correction/refund review.

## Bản mẫu mốc hiện có

Các bản mẫu mốc không thuộc workspace Admin hiện hành vẫn được giữ để truy vết:

- `admin/finance-run-preview.html`
- `parent/parent-home.html`
- `parent/parent-inbox.html`

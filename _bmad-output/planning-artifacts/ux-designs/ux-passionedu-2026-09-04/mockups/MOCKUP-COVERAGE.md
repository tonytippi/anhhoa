# Phạm vi bản mẫu PassionEdu

Mở `review.html` trong trình duyệt để bắt đầu rà soát. Các bản mẫu là HTML tĩnh có hộp thoại mô phỏng; không gửi yêu cầu hay lưu dữ liệu. `DESIGN.md` và `EXPERIENCE.md` vẫn được ưu tiên nếu có xung đột.

Các trang Admin/Nhân viên hiện chia sẻ `admin/admin-shell.js`: script `defer` cổ điển dựng skip link, sidebar, ngữ cảnh Ánh Hoa · Năm học 2026-2027 và avatar từ `data-admin-route`. Script không dùng module, network hay API của extension, nên mở trực tiếp từ hệ thống tệp hoặc VS Code Preview đều hoạt động. Các trang trong `admin/roster/` dùng cố định `../../prototype.css`, `../admin-shell.js` và `../../prototype.js` để tương thích Preview.

| Cổng thông tin | Tệp | Màn hình được mô phỏng |
| --- | --- | --- |
| Mục lục rà soát | `review.html` | Điểm bắt đầu và hướng dẫn rà soát toàn bộ quy trình. |
| Quản trị và nhân sự | `admin-staff.html` | Dashboard điều phối vận hành gọn: hàng đợi điểm danh, đơn nghỉ, bàn giao và tín hiệu tài chính; liên kết tới các trang Danh bộ, cấu hình khoản thu, tạo hóa đơn và rà soát hóa đơn chi tiết, không giữ toàn bộ workflow trên một trang. |
| Danh bộ | `admin/roster/roster.html` | Landing danh sách School-scoped, filter năm/lớp/lifecycle, mã Student bất biến, caption/pagination và điểm vào các luồng Danh bộ. |
| Năm học và lớp | `admin/roster/school-year-classes.html` | Boundary một SchoolYear active, lớp thuộc năm học, effective date, lỗi server/focus state và dữ liệu active/proposed. |
| Hồ sơ và ghi danh | `admin/roster/student-enrollment.html` | Student tách StudentEnrollment, AS-OF facts, interval `[effectiveFrom, endedOn)`, lifecycle và audit history. |
| Liên kết Phụ huynh | `admin/roster/student-parent-links.html` | Bind atomic, PENDING/ACTIVE/REVOKED, không tự cấp login/role, revoke safe state và audit. |
| Nhân sự và phân công | `admin/roster/staff-assignments.html` | Staff profile tối thiểu, login/role state tách biệt, class assignment effective-dated và lịch sử. |
| Chuyển danh bộ | `admin/roster/roster-transition.html` | Preview server, mapping nguồn/đích, record excluded không force move, confirm idempotent và đối soát Operation. |
| Cấu hình khoản thu | `receivable-configuration.html` | Danh mục nhóm/khoản thu, giá, rule, giảm giá, hiệu lực, trạng thái, precedence và dấu vết nguồn; quản lý `StudentPromotionalCoverage` nhiều kỳ theo Học sinh/Năm học, hóa đơn nguồn DRAFT và điều kiện chờ tất toán đủ. |
| Tạo hóa đơn | `invoice-generation.html` | Wizard CollectionRun DRAFT → READY → GENERATED → CLOSED: cấu hình, phạm vi, preview máy chủ, phân nhóm lý do bỏ qua, xác nhận và đối soát timeout trước retry. |
| Rà soát hóa đơn | `invoice-detail-review.html` | Hóa đơn DRAFT có dòng nghĩa vụ, override/điều chỉnh có kiểm toán, tài khoản nhận tiền và boundary phát hành; snapshot ISSUED khóa cùng chỉ dẫn handoff thu tiền tất toán chính xác. |
| Phụ huynh | `parent.html` | Trang chủ phụ huynh; thẻ hôm nay; lịch sử điểm danh của trẻ; đơn xin nghỉ; thông tin thanh toán theo bản chụp; hộp thư và trạng thái an toàn khi thu hồi quyền. |
| Vận hành nền tảng | `ops.html` | Danh sách trường; khởi tạo/chủ sở hữu ban đầu; tạm ngừng/kích hoạt lại; đối soát thao tác và trạng thái lỗi. |

## Trạng thái liên thông

- Cảnh báo khi đổi trường và ngữ cảnh thao tác có dữ liệu chưa lưu/chưa xác định kết quả.
- Đối soát thao tác sau khi hết thời gian chờ; không gửi lại yêu cầu khi chưa xác định kết quả.
- Xem trước do máy chủ quyết định, khóa vòng đời, kết quả bỏ qua và số tiền tài chính.
- Xung đột trường dữ liệu/chính sách, trạng thái quyền truy cập an toàn khi thu hồi và tối thiểu hóa dữ liệu phụ huynh.
- Bằng chứng điểm danh bắt buộc, xung đột đơn nghỉ và không tự động tính phí đón muộn.
- Thanh toán chính xác, khoản trả trước tường minh, ngữ cảnh điều chỉnh/hoàn tiền hai bước.
- Coverage ưu đãi theo học sinh chỉ phát hành sau khi hóa đơn nguồn tất toán đủ; không là gói catalog hoặc lựa chọn của Phụ huynh.

## Bản mẫu mốc hiện có

Bộ bản mẫu cũ vẫn được giữ để truy vết các màn hình chính ban đầu:

- `admin-operational-queue.html`
- `finance-run-preview.html`
- `parent-home.html`
- `parent-inbox.html`

# Phạm vi bản mẫu PassionEdu

Mở `review.html` trong trình duyệt để bắt đầu rà soát. Các bản mẫu là HTML tĩnh có hộp thoại mô phỏng; không gửi yêu cầu hay lưu dữ liệu. `DESIGN.md` và `EXPERIENCE.md` vẫn được ưu tiên nếu có xung đột.

Các trang Admin/Nhân viên hiện hành nằm trong `admin/` và chia sẻ `admin/admin-shell.js`: script `defer` cổ điển dựng skip link, sidebar, ngữ cảnh Ánh Hoa · Năm học 2026-2027 và avatar từ `data-admin-route`. Script không dùng module, network hay API của extension, nên mở trực tiếp từ hệ thống tệp hoặc VS Code Preview đều hoạt động. Các trang trực tiếp trong `admin/` dùng `../prototype.css`, `admin-shell.js` và `../prototype.js`; các trang trong `admin/roster/` dùng cố định `../../prototype.css`, `../admin-shell.js` và `../../prototype.js` để tương thích Preview. `admin/admin-operational-queue.html` chuyển rõ ràng sang workspace dùng shell chung, không còn dashboard/CSS riêng. Parent và Ops nằm lần lượt trong `parent/` và `ops/`, dùng tài nguyên chung qua `../`.

| Cổng thông tin | Tệp | Màn hình được mô phỏng |
| --- | --- | --- |
| Mục lục rà soát | `review.html` | Điểm bắt đầu và hướng dẫn rà soát toàn bộ quy trình. |
| Quản trị và nhân sự | `admin/admin-staff.html` | Tổng quan vận hành read-only theo Trường/ngày: dải chỉ số ngắn và bảng theo lớp cho sĩ số, có mặt, nghỉ có đơn, chưa đến lớp/nghỉ không phép/chưa ghi nhận và đã được đón. Danh sách đơn nghỉ là detail URL-backed mở từ overview. Admin không có route hay mutation điểm danh/giờ đón. |
| Cấu hình trường | `admin/school-settings.html` | Bốn tab liên kết trực tiếp: Thông tin trường (Hồ sơ trường với banner/logo fallback nguyên bản, xem trước cục bộ JPEG/PNG/WebP tối đa 10 MB, tên, địa chỉ, liên hệ và timezone chỉ đọc), Lịch hoạt động, Tài chính & thanh toán (FinancePolicy và BankAccount), Điểm danh & bàn giao. Quyền Parent là baseline server-enforced theo liên kết StudentParent hiệu lực, revoke và retention, không có toggle hay cấu hình School. Hồ sơ chỉ cập nhật fixture/timestamp sau kết quả Operation cuối cùng; đổi Trường hoặc bỏ bản nháp giải phóng preview cục bộ. Lịch hoạt động chỉ đọc lịch mặc định Thứ hai đến Thứ bảy và quản lý kỳ nghỉ Trường theo khoảng ngày bao gồm; lỗi thứ tự/chồng lấn giữ input và tạo mới dùng đối soát thao tác. Các policy khác giữ hiệu lực/lịch sử; BankAccount giữ `q`, `status`, `sort`, `page` trên URL đồng thời bảo toàn `#finance-payment`, ngừng dùng không xóa và đối soát thao tác. |
| Danh bộ | `admin/roster/roster.html` | Danh sách Trường Ánh Hoa với tìm kiếm, lọc, sắp xếp và trang trong URL; bảng, caption, empty state và mã chỉ trong thông tin đối soát. |
| Năm học và lớp | `admin/roster/school-year-classes.html` | Một năm học đang hiệu lực, lớp thuộc năm học, ngày hiệu lực và lỗi máy chủ có summary được focus/liên kết. |
| Hồ sơ và ghi danh | `admin/roster/student-enrollment.html` | Hồ sơ học sinh tách ghi danh, khoảng hiệu lực và lịch sử bằng nhãn nghiệp vụ ngắn. |
| Liên kết Phụ huynh | `admin/roster/student-parent-links.html` | Hồ sơ/lời mời tách liên kết với học sinh; trạng thái quyền chỉ theo kết quả hệ thống và thu hồi có đối soát. |
| Nhân sự và phân công | `admin/roster/staff-assignments.html` | Hồ sơ, quyền truy cập và phân công hiệu lực tách biệt; không ngụ ý đăng nhập hay năng lực thao tác. |
| Chuyển danh bộ | `admin/roster/roster-transition.html` | Xem trước từ hệ thống, bản ghi không chuyển không có thao tác, xác nhận có tên và đối soát kết quả. |
| Khoản thu | `admin/receivable-configuration.html` | Catalog ReceivableGroup/Receivable active/inactive, default price và lịch sử bất biến. Tiền ăn là `35.000 đ/ngày`; không có service/scope automation. |
| Ưu đãi | `admin/promotion-configuration.html` | Pha 1b table-first cho policy/version, Receivable target, fixed-VND/percentage, priority/exclusivity và Student assignment có interval/reason/audit. Không có nộp trước, Receipt hay coverage. |
| Đợt thu | `admin/invoice-generation.html` | Template và preview/generate server-authoritative; policy application per line là server result, stale khi policy fact đổi. Không có actual Receipt, carry, settlement KPI, scope Class/Student hay service. |
| Rà soát hóa đơn | `admin/invoice-detail-review.html` | Deep destination hiển thị gross, policy/version, discount và net snapshot theo dòng; Issue recheck server result. Không có Receipt, coverage, carry hay refund trong Pha 1b. |
| Báo cáo tài chính | `admin/finance-report.html` | Workspace Finance chỉ đọc chỉ hiện với fixture Finance Manager/School Admin trong Trường đang chọn: tổng quan, đối soát đợt thu, công nợ và sổ tiền/điều chỉnh. Controls SchoolYear, billing month, lớp và khi phù hợp CollectionRun, nhóm khoản thu, trạng thái Invoice chỉ gửi query; chỉ query fixture đã được cấp quyền mới hydrate metadata/summary/rows. Bốn workspace giữ provenance settlement outcome, difference/carry, revision/cancellation, coverage/refund; cash ledger dùng posting time, event type và giá trị có dấu. CSV là fixture server-returned duy nhất. Loading/error, empty giữ asOf an toàn; deep-link lạ, hết hạn, thu hồi quyền và đổi Trường xóa hoặc đánh dấu metadata không khả dụng, không khôi phục kết quả cũ. |
| Thiết lập Payroll | `admin/payroll-overview.html` | Payroll entitlement không tự cấp quyền; Kế toán là persona Finance Manager, School Admin khác người gửi phê duyệt và Finance Manager xác nhận chi. |
| Chấm công Payroll | `admin/payroll-timekeeping-import.html` | Finance Manager Kế toán có capability import/review; dữ liệu nguồn đã commit bất biến và không lộ qua route khi thiếu entitlement/capability. |
| Rà soát Payroll | `admin/payroll-run-review.html` | Finance Manager prepare/reconcile/submit; cùng identity không tự duyệt qua grant khác, sau duyệt chỉ Finance Manager có capability payout mới xác nhận chi. |
| Correction Payroll | `admin/payroll-correction.html` | Finance Manager tạo/gửi correction, School Admin khác identity duyệt, Finance Manager xác nhận chi bổ sung; Payroll gốc đã paid luôn chỉ đọc. |
| Giáo viên | `teacher/teacher.html` | Cổng Teacher mobile-first: chỉ hiện Class được phân công; nhận trẻ, trả trẻ, DailyJournal per Student/date và Hàng đợi lớp read-only. Hàng đợi nêu count server-confirmed cho `Chưa ghi nhận` trung tính và đơn nghỉ chờ xử lý, mở detail có date/class/status trên URL; không có CTA mutation, Finance hay fee. Danh sách nhận xét tìm/lọc trong các trẻ đã được hiển thị, nêu count/trạng thái/CTA theo current journal do server xác nhận, có empty state giữ Class/ngày và được xóa khi revoke. Mô phỏng xác nhận server, đối soát idempotency, ảnh JPEG/PNG/WebP tối đa 10 MB/ảnh và tách ảnh journal khỏi attendance evidence. |
| Phụ huynh | `parent/parent.html` | Trang chủ phụ huynh; thẻ hôm nay; lịch sử điểm danh, current DailyJournal và giờ trả trẻ đã xác nhận của trẻ; đơn xin nghỉ; thông tin thanh toán theo bản chụp; hộp thư và trạng thái an toàn khi thu hồi quyền. |
| Vận hành nền tảng | `ops/ops.html` | Danh sách trường với tìm kiếm/phân trang; khởi tạo có bước xem lại tên/mã Trường và chủ sở hữu ban đầu; tạm ngừng/kích hoạt lại; đối soát thao tác và trạng thái lỗi. |

## Trạng thái liên thông

- Cảnh báo khi đổi trường và ngữ cảnh thao tác có dữ liệu chưa lưu/chưa xác định kết quả.
- Đối soát thao tác sau khi hết thời gian chờ; không gửi lại yêu cầu khi chưa xác định kết quả.
- Xem trước do máy chủ quyết định, khóa vòng đời, kết quả bỏ qua và số tiền tài chính.
- Xung đột trường dữ liệu/chính sách, trạng thái quyền truy cập an toàn khi thu hồi và tối thiểu hóa dữ liệu phụ huynh.
- Giờ trả trẻ là dữ liệu vận hành tham chiếu có audit; không có cấu hình, thống kê block/VND hay tự động tính phí đón muộn. Finance Admin MVP chỉ thêm dòng DRAFT từ Receivable active với quantity dương; tham chiếu giải thích cần audit nhưng không tự tính tiền.
- Teacher là cổng duy nhất ghi nhận điểm danh theo School/Class/date có binding, capability và assignment hiệu lực; Admin chỉ cấu hình policy điểm danh typed/versioned tại Cấu hình trường, không có danh sách, route hay mutation điểm danh.
- Hàng đợi lớp Teacher chỉ hiện khi server cap `OPERATIONAL_QUEUE_READ` cho School/Class assignment effective. Queue/detail re-authorize trên mỗi request, giữ School/date khi empty/error và xóa rows School cũ khi switch/revoke; `NOT_RECORDED` không đồng nghĩa vắng mặt.
- Tổng quan Admin dùng fact server-returned theo School/date: hôm nay chưa có attendance xác nhận là `Chưa đến lớp`; ngày quá khứ chỉ `ABSENT` xác nhận không có đơn duyệt mới là `Nghỉ không phép`, còn không có record là `Chưa ghi nhận`. `Đã được đón` là fact read-only, không gợi ý phí.
- DailyJournal là current version theo Student/date; phụ huynh chỉ xem nội dung/ảnh được server xác nhận, không xem attendance evidence, danh tính Teacher hay audit/version history.
- Danh sách nhận xét Teacher chỉ đổi từ `Chưa có nhận xét` sang `Đã có nhận xét` sau kết quả terminal; khi đang đối soát, list giữ nguyên và không cho gửi lại.
- Actual Receipt đóng một Invoice với outcome exact/thiếu/thừa, carry source-linked sang đợt tháng sau và ngữ cảnh điều chỉnh/hoàn tiền hai bước.
- School cấu hình `PromotionPolicy`; Finance Manager hoặc School Admin chọn version `PREPAID_COVERAGE` cho Student trong preview của đợt `MONTHLY` sau thỏa thuận trực tiếp. Invoice DRAFT duy nhất chứa fact target kỳ tương lai và các khoản không-covered của billingMonth đang mở; coverage chỉ phát hành sau khi Invoice đóng `CLOSED` với outcome `EXACT`. Parent không có lựa chọn policy, payment mutation hay detail coverage.
- Cấu hình trường luôn nêu ngữ cảnh Trường, giá trị đang áp dụng/dự kiến, ngày hiệu lực, lý do khi cần và thông tin đối soát; xung đột giữ giá trị để sửa, không thay bản chụp quá khứ. Tài khoản ngừng dùng chỉ đọc trong lịch sử và không có thao tác xóa hoặc dùng cho hóa đơn mới.
- Lịch mặc định của Trường là Thứ hai đến Thứ bảy; Chủ nhật không hoạt động. Kỳ nghỉ đã xác nhận theo khoảng ngày bao gồm là nguồn calendar cho nhãn non-operating, leave eligibility, loại trừ điều chỉnh bữa ăn và snapshot, nhưng bản mẫu không tính các fact này trên trình duyệt.
- Normal Receipt closes one Invoice with actual received VND and shows exact/shortfall/overpayment outcome. Non-exact difference is source-linked and materialized only as bounded carry in the next eligible same-Student/School/SchoolYear run; there is no generic balance or unallocated Receipt. An issued-content correction creates a replacement Invoice and cancels the source without overwriting history. Coverage issued giữ snapshot bất biến, thay đổi dịch vụ đi qua correction/refund review.
- “Kế toán” trên bốn trang Payroll là persona của `FINANCE_MANAGER`, không phải role mới. Mọi trang/action cần Payroll entitlement và capability riêng; Finance Manager prepare/reconcile/submit và xác nhận payout, School Admin khác identity approve/refuse và có thể reopen approved-unpaid. Same-identity approval bị server từ chối kể cả khi actor có nhiều grant.

## Bản mẫu mốc hiện có

Các bản mẫu mốc không thuộc workspace Admin hiện hành vẫn được giữ để truy vết:

- `admin/finance-run-preview.html`
- `parent/parent-home.html`
- `parent/parent-inbox.html`

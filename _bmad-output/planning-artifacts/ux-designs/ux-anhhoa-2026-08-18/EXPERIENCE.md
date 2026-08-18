---
name: Anh Hoa Admin
status: final
sources:
  - ../../prds/prd-anhhoa-2026-08-18/prd.md
design: DESIGN.md
created: 2026-08-18
updated: 2026-08-18
---

# Anh Hoa Admin - Experience Spine

## Foundation

Ứng dụng web nội bộ, desktop-first và có thể cài đặt dạng PWA. `DESIGN.md` là nguồn nhận diện trực quan; shadcn/ui trên Base UI là hệ component. Desktop/laptop là bề mặt thao tác đầy đủ. Trên mobile, báo cáo được tối ưu để đọc; các thao tác quản trị phức tạp vẫn truy cập được nhưng được cảnh báo là thuận tiện hơn trên desktop.

Mỗi Admin chỉ thấy một workspace trường. Không có vai trò chi tiết trong MVP: mọi Admin được phép dùng tất cả bề mặt. Mọi dữ liệu thay đổi qua lưu rõ ràng, không autosave cho form nghiệp vụ.

## Information Architecture

| Surface | Đi từ | Mục đích |
|---|---|---|
| Đăng nhập | URL chưa xác thực | Đăng nhập Google, báo email không có quyền khi cần |
| Tổng quan | App mở, sidebar | Điểm vào: tháng đang xem, tổng thu tháng, số hóa đơn theo trạng thái và lối tắt công việc |
| Hóa đơn | Sidebar, lối tắt Tổng quan | Lọc theo tháng/trạng thái/lớp, tạo hàng loạt và mở chi tiết |
| Chi tiết Hóa đơn | Hàng trong danh sách | Sửa `DRAFT`, xem `PENDING`/`COMPLETED`, QR và audit |
| Học sinh | Sidebar | Tìm, tạo, sửa, gán/chuyển lớp, đánh dấu nghỉ học |
| Lớp | Sidebar | Tạo/sửa/lưu trữ lớp, xem học sinh trong lớp, chuyển cả lớp |
| Mẫu hóa đơn | Sidebar | Quản lý một danh sách dòng mẫu chung và thứ tự của chúng |
| Tài khoản nhận tiền | Sidebar | Thêm, kích hoạt hoặc ngừng dùng tài khoản ngân hàng |
| Báo cáo | Sidebar, Tổng quan | Đối soát `COMPLETED` theo tháng, tiền mặt và tài khoản nhận tiền |

Sidebar desktop luôn hiển thị. `Hóa đơn` là điểm điều hướng nổi bật nhất sau `Tổng quan`. Trang `Cấu hình` không cần một lớp điều hướng riêng trong MVP: `Mẫu hóa đơn` và `Tài khoản nhận tiền` là hai mục độc lập để admin tìm nhanh.

## Voice and Tone

Ngắn, trực tiếp, tôn trọng công việc thu tiền. Dùng động từ cụ thể và số tiền/lớp/học sinh thực tế thay cho thông báo chung chung.

| Nên dùng | Không dùng |
|---|---|
| `Tạo hóa đơn tháng 08/2026` | `Bắt đầu ngay` |
| `Đã tạo 42 hóa đơn, bỏ qua 3 học sinh` | `Thành công!` |
| `Hóa đơn này sẽ bị khóa sau khi chuyển sang chờ xác nhận.` | `Bạn có chắc không?` |
| `Xác nhận đã nhận 3.360.000 đ` | `Hoàn tất` |
| `Không có học sinh đủ điều kiện.` | `Không có dữ liệu` |

## Component Patterns

| Pattern | Bề mặt | Quy tắc hành vi |
|---|---|---|
| Month picker | Tổng quan, Hóa đơn, Báo cáo | Hiển thị `MM/YYYY`; mặc định tháng hiện tại; đổi tháng làm tải lại dữ liệu bề mặt. |
| Filter bar | Hóa đơn, Học sinh, Lớp | Search theo tên đặt trước filter; filter hiển thị dạng select/chip có nút xóa tất cả. URL phản ánh filter để quay lại vẫn giữ ngữ cảnh. |
| Data table | Danh sách | Hàng click được mở chi tiết; action có nút văn bản/icon kèm nhãn `aria-label`; bảng phân trang, không infinite scroll. |
| Form dialog | Lớp, Học sinh, Tài khoản nhận tiền | Dialog cho form ngắn; validate tại chỗ khi blur và khi lưu; không đóng khi save lỗi. Form Học sinh chỉ cho chọn Lớp đang hoạt động; khi đổi Lớp, nhắc đây chỉ là Lớp hiện tại và Hóa đơn đã tạo không thay đổi. |
| Invoice editor | Chi tiết Hóa đơn `DRAFT` | Trang riêng, không dialog. Dòng tiền dạng bảng: mô tả, nhóm tùy chọn, số tiền, action. Thêm dòng tạo hàng mới; xóa cần xác nhận nhẹ khi dòng có giá trị khác 0. |
| Invoice summary | Chi tiết Hóa đơn | Cột phải hiển thị tháng, học sinh/lớp snapshot, tổng, trạng thái, phương thức, tài khoản/QR nếu có và audit. |
| Status transition | Chi tiết Hóa đơn | `DRAFT` có `Chuyển sang chờ xác nhận`; `PENDING` có `Trả về nháp` và `Xác nhận đã nhận tiền`; `COMPLETED` không có action sửa. |
| Confirmation modal | Hoàn tất, chuyển cả lớp, lưu trữ/deactivate | Một modal một quyết định. Nêu số bản ghi/số tiền bị ảnh hưởng, có `Hủy` là nút phụ; focus vào modal và trả về trigger khi đóng. Khi gửi, khóa mọi action, hiển thị loading trên nút xác nhận và không cho đóng modal. |
| Toast | Toàn app | Xác nhận thay đổi đã lưu hoặc lỗi ngắn. Không dùng toast thay thế cho validation hoặc quyết định không đảo được. |

## State Patterns

| State | Bề mặt | Cách xử lý |
|---|---|---|
| Đang tải | Danh sách/báo cáo | Skeleton theo cấu trúc bảng/card, không nhấp nháy placeholder chung. |
| Không có dữ liệu | Học sinh/Lớp/Tài khoản | Nêu nguyên nhân và một CTA duy nhất, ví dụ `Thêm học sinh`. |
| Không có hóa đơn tháng | Hóa đơn | Giữ month picker; giải thích chưa có hóa đơn và CTA `Tạo hóa đơn tháng`. |
| Không có Học sinh đủ điều kiện | Modal tạo hàng loạt | Hiển thị lý do tổng hợp: nghỉ học, chưa gán lớp, lớp lưu trữ hoặc đã có hóa đơn; không gửi lệnh tạo. |
| `DRAFT` | Chi tiết Hóa đơn | Có editor, tổng cập nhật ngay, có thể chuyển `PENDING` khi tổng > 0 và dữ liệu thanh toán hợp lệ. |
| `PENDING` | Chi tiết Hóa đơn | Toàn bộ nội dung thanh toán read-only; QR và tài khoản là snapshot. Hiển thị rõ `Trả về nháp để chỉnh sửa`. |
| `COMPLETED` | Chi tiết Hóa đơn | Read-only toàn trang ngoại trừ sao chép nội dung chuyển khoản; audit gồm người tạo, người xác nhận và thời điểm. |
| Tài khoản ngừng dùng | Danh sách và Hóa đơn | Badge `Ngừng dùng`; không xuất hiện trong picker của `DRAFT`. Nếu đã snapshot trên `PENDING`/`COMPLETED`, vẫn hiện kèm badge. |
| Lỗi lưu/đổi trạng thái | Form/chi tiết | Giữ nguyên dữ liệu người dùng đã nhập, hiển thị lỗi gần action và toast ngắn; không tự chuyển trạng thái UI. |
| Kết quả thao tác chưa rõ | Tạo hàng loạt, chuyển cả Lớp, hoàn tất Hóa đơn | Nếu request timeout/mất kết nối sau khi gửi, giữ modal ở trạng thái `Đang kiểm tra kết quả`, gọi lại trạng thái server theo định danh thao tác trước khi mở lại action. Chỉ cho thử lại khi server xác nhận thao tác chưa được áp dụng. |
| Offline | Global | Toast một lần: `Bạn đang ngoại tuyến. Không thể lưu thay đổi.` Không xếp hàng thay đổi offline trong MVP. |

## Interaction Primitives

- `Tab` di chuyển theo thứ tự đọc; `Enter` chỉ submit khi focus trong form hoặc kích hoạt button, không vô tình hoàn tất Hóa đơn.
- `Esc` đóng popover/dialog/modal trên cùng; không lưu thay đổi nháp.
- Sort Dòng mẫu và Dòng hóa đơn dùng nút `Lên`/`Xuống` có nhãn, không phụ thuộc drag-and-drop.
- Numeric field định dạng số nguyên VND khi blur; chấp nhận nhập số không có dấu phân tách. Giá trị âm hợp lệ cho Dòng hóa đơn, không hợp lệ cho học phí Lớp.
- Action không đảo được luôn cần confirm: hoàn tất Hóa đơn, chuyển cả Lớp, lưu trữ Lớp, chuyển Học sinh sang nghỉ học và ngừng dùng Tài khoản nhận tiền.
- Tạo hóa đơn hàng loạt có modal: chọn tháng, `Toàn trường` hoặc các Lớp hoạt động, xem số lượng dự kiến, rồi `Tạo hóa đơn nháp`. Khi xong, hiển thị created/skipped và link tới danh sách đã lọc tháng đó.
- Khi gửi tạo hàng loạt, chuyển cả Lớp hoặc hoàn tất Hóa đơn, trigger bị disable ngay và UI chờ kết quả cuối từ server. Timeout không được coi là lỗi có thể bấm lại ngay; UI phải đối soát kết quả trước để tránh hiểu sai hoặc gửi lệnh trùng.

## Accessibility Floor

- Tuân WCAG 2.2 AA; màu và contrast kế thừa từ `DESIGN.md` và shadcn/ui.
- Mỗi trang đổi route có một `h1`; bảng có caption hoặc `aria-label` nêu tập dữ liệu và tháng/filter hiện tại.
- Table giữ header liên kết cột, số tiền có nhãn đơn vị VND cho screen reader, trạng thái không chỉ truyền qua màu.
- Dialog trap focus, có tên/miêu tả rõ, `Esc` đóng được trừ khi đang gửi dữ liệu; destructive/irreversible confirmation không tự focus nút xác nhận.
- Validation gắn vào field với `aria-describedby`; lỗi được đọc bằng live region.
- Không có action chỉ hoạt động khi hover; kích thước target tối thiểu 40x40px với icon button.

## Responsive & Platform

| Breakpoint | Hành vi |
|---|---|
| `>= 1280px` | Sidebar đầy đủ; chi tiết Hóa đơn hai cột; bảng hiển thị toàn bộ cột chính. |
| `1024-1279px` | Sidebar thu gọn icon nếu cần; chi tiết Hóa đơn vẫn hai cột hẹp hoặc summary xuống dưới tùy không gian. |
| `768-1023px` | Sidebar thành sheet; bảng có vùng scroll ngang với cột định danh ghim bên trái. |
| `< 768px` | Mặc định dẫn vào Báo cáo/Tổng quan; Báo cáo xếp card dọc thay bảng; dashboard quản trị vẫn khả dụng nhưng list/table dùng scroll ngang, modal gần full-screen. |

PWA hiển thị install prompt theo cơ chế trình duyệt, không làm popup ép cài. Có app icon và tên `Ánh Hoa Admin`; sau khi cài, mở ở chế độ standalone. MVP không hỗ trợ chỉnh sửa offline.

## Key Flows

### Flow 1 - Lan tạo hóa đơn đầu tháng

1. Lan mở `Hóa đơn`; month picker mặc định tháng hiện tại và bảng cho biết chưa có hóa đơn.
2. Lan chọn `Tạo hóa đơn tháng`, chọn `08/2026`, chọn `Toàn trường` hoặc một số Lớp.
3. Modal hiển thị số Học sinh đủ điều kiện và các lý do sẽ bỏ qua; Lan chọn `Tạo hóa đơn nháp`.
4. Hệ thống báo số đã tạo/bỏ qua và đưa Lan về danh sách đã lọc `08/2026`, trạng thái `Nháp`.
5. Lan mở một Hóa đơn, chỉnh dòng phát sinh và phương thức thanh toán. Tổng cập nhật ngay.
6. **Climax:** Lan chọn `Chuyển sang chờ xác nhận`; trang chuyển read-only với badge `Chờ xác nhận`, QR chuẩn bị sẵn nếu là chuyển khoản. Lan biết nội dung thanh toán không thể bị thay đổi vô ý.

Lỗi: nếu tổng không dương hoặc chuyển khoản chưa chọn tài khoản hoạt động, action bị chặn và lỗi chỉ đúng field/section cần sửa.

### Flow 2 - Minh xác nhận đã nhận chuyển khoản

1. Minh vào `Hóa đơn`, lọc `Chờ xác nhận`, mở Hóa đơn của một Học sinh.
2. Minh so khớp giao dịch với tổng, thông tin tài khoản và nội dung chuyển khoản trên QR card.
3. Minh chọn `Xác nhận đã nhận tiền`.
4. Modal nhắc lại Học sinh, tháng, `Chuyển khoản` và tổng tiền; nút xác nhận ghi đúng số tiền.
5. **Climax:** Minh xác nhận. Badge thành `Đã hoàn tất`; audit card hiện `Xác nhận bởi Minh` cùng thời điểm. Không còn action chỉnh sửa.

Lỗi: nếu request timeout sau khi gửi, modal chuyển `Đang kiểm tra kết quả` và đối soát Hóa đơn với server. Nếu server đã hoàn tất, trang cập nhật `COMPLETED`; chỉ khi server xác nhận chưa áp dụng thay đổi, modal mới mở lại action để Minh thử lại.

### Flow 3 - Lan chuyển cả Lớp

1. Lan vào chi tiết một Lớp và xem danh sách Học sinh đang học.
2. Lan chọn `Chuyển toàn bộ học sinh`, chọn Lớp đích đang hoạt động.
3. Modal cho biết chính xác số Học sinh đang học sẽ được chuyển và nhắc Học sinh nghỉ học không bị ảnh hưởng.
4. **Climax:** Sau xác nhận, danh sách Lớp nguồn cập nhật; toast xác nhận số đã chuyển và cung cấp link mở Lớp đích. Hóa đơn lịch sử không đổi.

### Flow 4 - Lan chuyển một Học sinh

1. Lan tìm và mở Học sinh trong danh sách `Học sinh`, rồi chọn `Sửa`.
2. Form chỉ hiển thị các Lớp đang hoạt động trong trường `Lớp hiện tại`.
3. Lan chọn Lớp đích. Help text nhắc thay đổi chỉ áp dụng cho Lớp hiện tại; Hóa đơn đã tạo giữ nguyên bản chụp Lớp và số tiền.
4. **Climax:** Lan lưu. Chi tiết và danh sách Học sinh hiển thị Lớp mới, còn mọi Hóa đơn lịch sử vẫn trình bày Lớp đã chụp tại lúc tạo.

### Flow 5 - Lan xem báo cáo trên điện thoại

1. Lan mở PWA trên điện thoại và vào `Báo cáo`.
2. Lan đổi tháng qua month picker.
3. Các KPI xếp dọc: tổng thu, tiền mặt, chuyển khoản; bên dưới là card từng Tài khoản nhận tiền thay vì bảng rộng.
4. **Climax:** Lan thấy ngay tổng thu và phần tiền đi vào mỗi tài khoản mà không cần pinch-zoom hoặc xuất file.

## Decisions and Boundaries

- Không có command palette, phím tắt chuyên dụng hay drag-and-drop trong MVP; đây không phải bề mặt power-user cần thiết để hoàn thành công việc.
- Không đưa parent/teacher portal, gửi thông báo, PDF hay export vào navigation vì đều ngoài phạm vi PRD.
- Mobile không phải trải nghiệm tạo/chỉnh hàng loạt tối ưu; báo cáo là hành trình ưu tiên trên mobile.
- Mọi màn hình IA đều được đặc tả bằng spine; không tạo mockup HTML riêng trong Fast path.

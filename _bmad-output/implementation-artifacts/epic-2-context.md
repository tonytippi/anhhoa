# Epic 2 Context: Chuẩn bị dữ liệu thu phí

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Trang bị cho Admin dữ liệu vận hành đáng tin cậy để lập hóa đơn định kỳ: duy trì Lớp, Học sinh và Lớp hiện tại; chuyển một em hoặc cả Lớp có kiểm soát; cấu hình Mẫu hóa đơn chung; và quản lý Tài khoản nhận tiền. Các thay đổi nguồn phải không phá hủy lịch sử và không được làm sai dữ liệu đã snapshot trên Hóa đơn.

## Stories

- Story 2.1: Quản lý Lớp đang hoạt động và lưu trữ
- Story 2.2: Quản lý Học sinh và Lớp hiện tại
- Story 2.3: Chuyển một Học sinh giữa các Lớp
- Story 2.4: Chuyển toàn bộ Học sinh đang học của một Lớp
- Story 2.5: Quản lý Mẫu hóa đơn chung
- Story 2.6: Quản lý Tài khoản nhận tiền

## Requirements & Constraints

- Chỉ Admin đã xác thực mới được đọc hoặc thay đổi dữ liệu vận hành. API là nguồn chân lý; mọi mutation phải được server validate và trả lỗi theo shape chuẩn.
- Lớp có tên, học phí tháng không âm và trạng thái active/archived. Không xóa cứng; Lớp archived không được gán mới hoặc tham gia luồng tạo Hóa đơn, nhưng vẫn tra cứu được lịch sử. Không được archive Lớp còn Học sinh active; trả `CLASS_HAS_ACTIVE_STUDENTS` cùng số lượng bị ảnh hưởng để Admin chuyển Lớp hoặc cho nghỉ học trước.
- Học sinh giữ họ tên, biệt danh tùy chọn, Lớp hiện tại tùy chọn và trạng thái active/inactive. Không xóa cứng. Chỉ Lớp active được chọn làm Lớp hiện tại; Học sinh inactive và Học sinh chưa có Lớp active không đủ điều kiện cho batch invoice mới, nhưng vẫn hiển thị lịch sử.
- Chuyển từng Học sinh chỉ thay đổi Lớp hiện tại và chỉ chấp nhận Lớp đích active. Chuyển cả Lớp chỉ di chuyển Học sinh active sang Lớp đích active; phải xác nhận trước và chạy nguyên tử. Lịch sử Hóa đơn, gồm snapshot Học sinh, Lớp, học phí và dòng tiền, không đổi sau các thay đổi nguồn này.
- Chỉ có một Mẫu hóa đơn chung dùng cho Hóa đơn mới. Mỗi Dòng mẫu có mô tả, nhóm thu tùy chọn, thứ tự và nguồn tiền: số VND cố định không phân số hoặc học phí tháng của Lớp. Sửa, bỏ hoặc sắp xếp Mẫu chỉ tác động Hóa đơn tạo sau đó. Seed tạo đúng một Mẫu hóa đơn chung rỗng để Admin tự cấu hình.
- Tài khoản nhận tiền gồm ngân hàng/mã ngân hàng VietQR, số tài khoản, tên chủ tài khoản và trạng thái. Không có xóa cứng. Chỉ tài khoản active được chọn cho Hóa đơn `DRAFT`; tài khoản ngừng dùng vẫn hiển thị trên Hóa đơn `PENDING`/`COMPLETED` đã snapshot và không cản trở hoàn tất các Hóa đơn đó.
- Lưu và truyền các giá trị tiền VND dưới dạng số nguyên an toàn, không dùng số thực; học phí tháng lưu PostgreSQL `BIGINT`.

## Technical Decisions

- Dữ liệu và quy tắc nghiệp vụ nằm độc quyền trong `apps/api`; web chỉ dùng REST JSON credentialed qua React Query và coi response API là authoritative. Module API liên quan là `classes`, `students`, `invoice-template`, và `bank-accounts`; controller chỉ gọi service, không gọi controller domain khác.
- REST resources dùng `/classes`, `/students`, `/invoice-template`, `/bank-accounts`; JSON camelCase, list response là `{ data, meta }`, action response là `{ data }`, UUID là string. API map `BIGINT` sang JSON integer an toàn.
- Giữ Class, Student và BankAccount bằng status thay vì xóa. Invoice là chủ sở hữu snapshot; các domain nguồn không được cập nhật snapshot trực tiếp.
- Chuyển cả Lớp là high-impact mutation: client tạo và giữ UUID `Idempotency-Key`; API scope theo Admin + route, lưu fingerprint và kết quả cùng transaction, replay khi request giống nhau và trả conflict khi cùng key nhưng request khác. `GET /operations/:operationId` cho phép đối soát kết quả không chắc chắn; chỉ invalidate React Query sau response hoặc reconciliation đã xác nhận.
- Cần PostgreSQL-backed integration coverage cho whole-class transfer và unit/integration coverage cho các quy tắc trạng thái, money, lịch sử snapshot liên quan.

## UX & Interaction Patterns

- Dùng các trang danh sách Lớp, Học sinh, Mẫu hóa đơn và Tài khoản nhận tiền theo data table phân trang: header, hàng tối thiểu 48px, search trước filter, action luôn truy cập được, empty state một CTA, loading skeleton theo cấu trúc và lỗi gần action kèm toast ngắn. Filter liên quan phản ánh trên URL.
- Tạo/sửa Lớp, Học sinh và Tài khoản nhận tiền qua form dialog ngắn. Validate khi blur và khi lưu, liên kết lỗi với field, giữ dialog mở và dữ liệu đã nhập khi lỗi. Giá trị VND được định dạng phân tách hàng nghìn và hậu tố `đ` khi blur.
- Picker Lớp của Học sinh chỉ hiển thị Lớp active và phải nhắc thay đổi chỉ áp dụng hiện tại, không đổi Hóa đơn đã tạo. Dòng mẫu sắp xếp bằng nút `Lên`/`Xuống` có nhãn, không drag-and-drop.
- Archive Lớp, cho Học sinh nghỉ học, ngừng dùng Tài khoản và chuyển cả Lớp đều cần confirmation modal nêu ảnh hưởng, có Hủy, trap focus, trả focus trigger, không tự focus action phá hủy. Khóa action và đóng modal trong lúc submit.
- Modal chuyển cả Lớp nêu Lớp đích, số Học sinh active bị ảnh hưởng và việc Học sinh inactive không đổi. Khi timeout hoặc mất kết nối sau submit, giữ `Đang kiểm tra kết quả`, khóa retry, đối soát operation ID; thành công hiển thị số đã chuyển và link Lớp đích.
- Giữ nhận diện vận hành desktop-first: nền kem, card trắng viền mảnh, CTA xanh lá, Inter cho form/bảng và Clash Grotesk cho heading. Đáp ứng WCAG 2.2 AA, gồm một `h1` mỗi route, bảng có caption hoặc aria-label, status có nhãn chữ, không có action chỉ hover, và icon target ít nhất 40x40px. Ở màn hẹp, bảng scroll ngang với cột định danh ghim, modal gần full-screen.

## Cross-Story Dependencies

- Story 2.1 cung cấp Lớp active và học phí tháng cho tạo/sửa Học sinh, chuyển Lớp, Mẫu dùng nguồn học phí Lớp, và các Hóa đơn tạo sau này.
- Story 2.2 cung cấp trạng thái cùng Lớp hiện tại để Story 2.3 chuyển một Học sinh, Story 2.4 chuyển cả Lớp và Epic 3 xác định học sinh đủ điều kiện tạo Hóa đơn.
- Story 2.4 phụ thuộc Lớp nguồn/đích và dữ liệu Học sinh active; dùng hạ tầng idempotency và operation lookup dùng chung với các mutation trọng yếu Epic 3.
- Story 2.5 phải được cấu hình Dòng mẫu trước batch invoice của Epic 3; Mẫu rỗng khiến batch preview và creation bị từ chối với `INVOICE_TEMPLATE_EMPTY`.
- Story 2.6 cung cấp chỉ các Tài khoản active cho payment flow `DRAFT` của Epic 3; các tài khoản snapshot phải tiếp tục hỗ trợ hiển thị và hoàn tất Hóa đơn lịch sử.

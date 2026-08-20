# Epic 4 Context: Đối soát thu tiền theo tháng

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Cho phép Admin đối soát chính xác số tiền thực đã thu trong một tháng bằng báo cáo lấy riêng từ các Hóa đơn đã hoàn tất, tách rõ tiền mặt, chuyển khoản và tổng chuyển khoản theo từng Tài khoản nhận tiền đã được snapshot. Điều này cung cấp số liệu cuối tháng ổn định, không bị thay đổi bởi việc sửa hay ngừng dùng dữ liệu nguồn.

## Stories

- Story 4.1: Xem báo cáo thu theo tháng

## Requirements & Constraints

- Admin đã xác thực có thể chọn Tháng hóa đơn; month picker hiển thị `MM/YYYY`, mặc định tháng hiện tại và tải lại số liệu tháng đã chọn.
- Báo cáo chỉ aggregate Hóa đơn `COMPLETED`; không tính `DRAFT` hoặc `PENDING`.
- Kết quả gồm tổng đã thu, tổng tiền mặt, tổng chuyển khoản và tổng chuyển khoản theo từng Tài khoản nhận tiền.
- Dữ liệu nhóm chuyển khoản, gồm định danh và tên hiển thị Tài khoản nhận tiền, phải lấy từ snapshot thanh toán của Hóa đơn hoàn tất, không từ Tài khoản nguồn có thể đã đổi hoặc ngừng dùng.
- Tổng tiền VND phải chính xác, không có phần thập phân hay làm tròn. API trả số nguyên JSON an toàn; `billingMonth` trả `YYYY-MM`.
- Tổng quan cùng tháng hiển thị tổng thu, số Hóa đơn theo trạng thái `DRAFT`/`PENDING`/`COMPLETED`, cùng các lối tắt có ngữ cảnh tháng hoặc trạng thái đến Hóa đơn/Báo cáo.
- MVP chỉ cung cấp báo cáo trên màn hình, không có xuất Excel hoặc CSV.

## Technical Decisions

- API là chủ sở hữu duy nhất của phép aggregate và nguồn chân lý cho số liệu; web chỉ gọi REST JSON bằng React Query.
- Chức năng thuộc module `reports`, là read-only trên Hóa đơn hoàn tất; controller chỉ ủy quyền service và service không gọi controller domain khác.
- Giá trị tiền lưu PostgreSQL `BIGINT`, được map tại biên API sang số nguyên JSON an toàn; không serialize `BIGINT` trực tiếp.
- Dùng REST resource `/reports`; JSON camelCase, action response bọc trong `{ data }` khi áp dụng và lỗi theo `{ error: { code, message, fieldErrors? } }`.
- Route vận hành yêu cầu auth guard mặc định. Query key React Query bắt đầu bằng tên resource REST; chỉ invalidation sau response xác nhận.
- Bổ sung Playwright cho luồng báo cáo sau khi bề mặt web tồn tại; kiểm chứng hành vi tài chính chủ yếu ở API, không chỉ ở UI.

## UX & Interaction Patterns

- Báo cáo desktop trình bày rõ KPI tổng thu, tiền mặt, chuyển khoản và breakdown theo Tài khoản nhận tiền; số tiền căn phải, có phân tách hàng nghìn và hậu tố `đ`.
- Trong Tổng quan, month picker và số liệu tháng phải dẫn được đến Hóa đơn/Báo cáo có ngữ cảnh thay vì là card trang trí.
- Khi tải, dùng skeleton theo cấu trúc card/báo cáo. Khi lỗi, giữ dữ liệu đã thấy, báo lỗi gần bề mặt và toast ngắn.
- Trên mobile dưới 768px, các KPI xếp thành card dọc và từng Tài khoản nhận tiền là card, không bắt buộc bảng rộng; Báo cáo là hành trình ưu tiên trên mobile.
- Mỗi route có một `h1`; số tiền có nhãn đơn vị VND cho screen reader; trạng thái không chỉ thể hiện bằng màu; tuân WCAG 2.2 AA.
- Tuân design system: nền kem, card trắng viền mảnh, CTA xanh lá, Inter cho nội dung/số tiền và Clash Grotesk cho tiêu đề; không dùng shadow nặng hay UI kiểu landing page.

## Cross-Story Dependencies

- Story 4.1 phụ thuộc Epic 3 cung cấp lifecycle Hóa đơn, snapshot phương thức thanh toán/Tài khoản nhận tiền và transition `PENDING -> COMPLETED` có audit bất biến.
- Tổng quan và báo cáo dùng cùng ngữ cảnh Tháng hóa đơn; lối tắt phải liên kết với danh sách Hóa đơn đã được triển khai trong Epic 3.

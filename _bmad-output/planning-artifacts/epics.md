---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - prds/prd-anhhoa-2026-08-18/prd.md
  - architecture/architecture-anhhoa-2026-08-18/ARCHITECTURE-SPINE.md
  - ux-designs/ux-anhhoa-2026-08-18/DESIGN.md
  - ux-designs/ux-anhhoa-2026-08-18/EXPERIENCE.md
---

# Anh Hoa - Epic Breakdown

## Overview

Tài liệu này phân rã đầy đủ yêu cầu từ PRD, thiết kế UX và architecture spine thành các epic và story có thể triển khai cho Anh Hoa Admin MVP.

## Requirements Inventory

### Functional Requirements

FR-1: Admin có email nằm trong `ADMIN_EMAILS` có thể đăng nhập Google; hệ thống từ chối email khác, tạo hoặc cập nhật thông tin nhận diện Google để audit.

FR-2: Admin có thể tạo, xem, sửa tên và học phí tháng của Lớp, đồng thời chuyển Lớp giữa trạng thái hoạt động và lưu trữ mà vẫn xem được lịch sử.

FR-3: Admin có thể tạo, xem, sửa họ tên, biệt danh và Lớp hiện tại của Học sinh, cũng như chuyển trạng thái nghỉ học hoặc đang học lại.

FR-4: Admin có thể chuyển một Học sinh sang Lớp hoạt động khác hoặc chuyển toàn bộ Học sinh đang học sang Lớp đích đang hoạt động, sau khi xác nhận tác động.

FR-5: Admin có thể xem, thêm, sửa, sắp xếp và bỏ Dòng mẫu trong Mẫu hóa đơn chung; mỗi dòng có mô tả, nhóm thu tùy chọn, thứ tự và nguồn số tiền cố định hoặc học phí Lớp.

FR-6: Admin có thể xem trước và tạo Hóa đơn hàng loạt theo Tháng hóa đơn cho toàn trường hoặc một hay nhiều Lớp hoạt động; chỉ tạo `DRAFT` duy nhất cho từng Học sinh đủ điều kiện, sao chép mẫu và báo kết quả tạo/bỏ qua chính xác, nguyên tử.

FR-7: Admin có thể xem Hóa đơn mọi trạng thái, chỉnh sửa `DRAFT` gồm Dòng hóa đơn và thanh toán, chuyển `DRAFT` sang `PENDING`, và trả `PENDING` về `DRAFT` trước khi nhận tiền, với các ràng buộc tổng tiền, tài khoản và snapshot.

FR-8: Admin có thể xác nhận đã nhận đủ tiền cho Hóa đơn `PENDING` qua modal; hệ thống chuyển sang `COMPLETED`, lưu Admin/thời điểm xác nhận và giữ Hóa đơn chỉ xem.

FR-9: Admin có thể xem, thêm, kích hoạt và ngừng dùng Tài khoản nhận tiền; không thể xóa cứng và các tài khoản snapshot vẫn hiển thị trong Hóa đơn lịch sử.

FR-10: Hệ thống tạo QR VietQR cho Hóa đơn chuyển khoản có Tài khoản nhận tiền, dùng số tiền, ngân hàng, số tài khoản và nội dung chuyển khoản từ snapshot Hóa đơn.

FR-11: Admin có thể chọn Tháng hóa đơn để xem báo cáo chỉ từ Hóa đơn `COMPLETED`, gồm tổng thu, tiền mặt, chuyển khoản và chuyển khoản theo từng Tài khoản nhận tiền snapshot.

### NonFunctional Requirements

NFR-1: Dashboard là ứng dụng web responsive, dùng được trên desktop và điện thoại.

NFR-2: Chỉ Admin đã xác thực được đọc hoặc thay đổi dữ liệu vận hành.

NFR-3: Tiền tệ được lưu và tính chính xác, không dùng số thực dấu chấm động.

NFR-4: Mọi giá trị tiền là số nguyên VND không có phần thập phân; tổng Hóa đơn là phép cộng chính xác Dòng hóa đơn, không làm tròn.

NFR-5: Tạo Hóa đơn hàng loạt, chuyển cả Lớp và hoàn tất Hóa đơn chống thao tác trùng do bấm lặp hoặc gửi lại yêu cầu.

NFR-6: Lịch sử Hóa đơn bảo toàn snapshot để kiểm tra người tạo, người xác nhận, thời điểm và số tiền đã thu.

NFR-7: UI dùng Tailwind CSS v4, tw-animate-css và shadcn/ui trên Base UI; font nội dung Inter, font heading/branding Clash Grotesk.

### Additional Requirements

- Khởi tạo monorepo pnpm/Turborepo với `apps/web` là React 19/Vite 8 PWA và `apps/api` là NestJS 11/Prisma 7; package dùng chung chỉ chứa TypeScript thuần.
- API là chủ sở hữu duy nhất của PostgreSQL, Prisma schema/migration, tiền, snapshot, QR, state transition và audit; web chỉ gọi REST JSON qua React Query.
- Tổ chức API theo các module `auth`, `admins`, `classes`, `students`, `invoice-template`, `invoices`, `bank-accounts`, `reports`; controller chỉ gọi service và service không gọi controller domain khác.
- Hoàn thành Google OAuth ở API; chuẩn hóa email và kiểm tra `ADMIN_EMAILS`; upsert Admin; phát JWT session qua cookie `Secure`, `httpOnly`, `SameSite=Lax`; web khởi tạo danh tính bằng `GET /auth/me` và không lưu token trong JavaScript.
- CORS credentialed chỉ chấp nhận `WEB_ORIGIN`; OAuth redirect allowlist; unsafe request cần origin validation và double-submit CSRF.
- REST JSON dùng các resource `/auth`, `/classes`, `/students`, `/invoice-template`, `/invoices`, `/bank-accounts`, `/reports`; thêm `POST /invoices/batch-preview`; mutation DTO được server validate và lỗi có dạng `{ error: { code, message, fieldErrors? } }`.
- REST dùng camelCase; endpoint list trả `{ data, meta }`, action trả `{ data }`; UUID string là định danh; `billingMonth` là first-of-month trong PostgreSQL và trả `YYYY-MM`; timestamp trả UTC ISO 8601.
- Tiền lưu PostgreSQL `BIGINT`, được map thành số nguyên JSON an toàn; API tự tính tổng từ line item, không tin tổng từ web.
- Database áp unique `(studentId, billingMonth)`; tạo batch, chuyển cả Lớp và hoàn tất chạy transaction; lifecycle chỉ cho phép `DRAFT -> PENDING`, `PENDING -> DRAFT`, và `PENDING -> COMPLETED`; `COMPLETED` chỉ xem.
- Khi tạo Hóa đơn, sao chép snapshot Học sinh, Lớp, Dòng mẫu và Tài khoản nhận tiền; QR chỉ được dựng từ snapshot; completion idempotent và chỉ ghi Admin/thời điểm một lần.
- Lớp, Học sinh và Tài khoản nhận tiền dùng trạng thái, không xóa cứng; chỉ record active được dùng cho luồng mới, record inactive snapshot vẫn hiển thị ở Hóa đơn `PENDING`/`COMPLETED`.
- Batch invoice creation, whole-class transfer và invoice completion yêu cầu UUID `Idempotency-Key`; API lưu fingerprint/kết quả theo Admin + route, replay retry giống nhau, báo conflict nếu key khác request; `GET /operations/:operationId` đối soát kết quả không chắc chắn.
- Báo cáo chỉ aggregate Hóa đơn `COMPLETED` bằng snapshot thanh toán và Tài khoản nhận tiền, không đọc dữ liệu nguồn có thể thay đổi.
- Viết unit test API cho tính tiền và lifecycle; integration test PostgreSQL cho uniqueness batch, snapshot, transition, idempotent completion, whole-class transfer; thêm Playwright cho luồng Hóa đơn và báo cáo.
- Prisma schema/migration/seed chỉ đặt trong `apps/api/prisma`; migration được commit và production-like dùng migration, không dùng `prisma db push`.
- Cấu hình API qua environment và được validate lúc bootstrap; tất cả operational route mặc định cần auth guard.

### UX Design Requirements

UX-DR1: Cài đặt token nhận diện từ `DESIGN.md`: nền kem, card trắng viền mảnh, màu brand xanh lá, các token trạng thái nghiệp vụ, spacing, bo góc và typography Inter/Clash Grotesk.

UX-DR2: Xây dựng layout desktop-first có sidebar cố định với logo/tên trường, trạng thái mục đang chọn, menu tài khoản Admin, vùng nội dung gutter 32px và điều hướng cho toàn bộ IA đã chỉ định.

UX-DR3: Cung cấp màn đăng nhập Google và trạng thái báo rõ email không có quyền truy cập.

UX-DR4: Xây dựng Tổng quan có month picker, tổng thu, số Hóa đơn theo trạng thái và lối tắt công việc.

UX-DR5: Xây dựng danh sách Hóa đơn với month picker mặc định tháng hiện tại, search trước filter, filter tháng/trạng thái/lớp phản ánh trên URL, phân trang và empty state có CTA tạo hóa đơn.

UX-DR6: Cung cấp modal tạo Hóa đơn hàng loạt chọn tháng, toàn trường hoặc Lớp active, hiển thị preflight eligible/skipped theo lý do, khóa gửi khi không có Học sinh đủ điều kiện, rồi hiển thị kết quả và link danh sách đã lọc.

UX-DR7: Xây dựng trang chi tiết Hóa đơn riêng với hai cột trên desktop: editor/Dòng hóa đơn bên trái, summary snapshot thanh toán, QR và audit bên phải.

UX-DR8: Cung cấp editor `DRAFT` dạng bảng cho Dòng hóa đơn: mô tả, nhóm tùy chọn, số tiền VND, thêm/xóa/sắp xếp bằng nút Lên/Xuống; xác nhận nhẹ khi xóa dòng khác 0 và cập nhật tổng tức thì.

UX-DR9: Hiển thị trạng thái `Nháp`, `Chờ xác nhận`, `Đã hoàn tất` bằng badge có nhãn chữ và hành động lifecycle đúng từng trạng thái; `PENDING` read-only có hành động trả nháp, `COMPLETED` chỉ xem.

UX-DR10: Cung cấp QR card có QR đủ khoảng trắng, tổng tiền, Tài khoản nhận tiền snapshot và nội dung chuyển khoản có nút sao chép.

UX-DR11: Xây dựng form dialog ngắn cho Lớp, Học sinh và Tài khoản nhận tiền, validate tại field khi blur/lưu, giữ dialog mở nếu lỗi; picker Lớp của Học sinh chỉ hiển thị Lớp active và nêu rõ snapshot Hóa đơn không đổi.

UX-DR12: Cung cấp danh sách/quản trị Học sinh, Lớp, Mẫu hóa đơn và Tài khoản nhận tiền với data table có header, hàng tối thiểu 48px, hover nhẹ, action luôn truy cập được và empty state một CTA.

UX-DR13: Cung cấp luồng chuyển cả Lớp qua modal nêu Lớp đích, số Học sinh đang học bị ảnh hưởng và việc Học sinh nghỉ học không thay đổi; trả về link Lớp đích khi thành công.

UX-DR14: Cung cấp confirmation modal cho hoàn tất Hóa đơn, chuyển cả Lớp, lưu trữ Lớp, cho Học sinh nghỉ học và ngừng dùng Tài khoản: nêu dữ liệu ảnh hưởng, có Hủy, trap focus, trả focus trigger, khóa action/đóng khi submit và không tự focus nút phá hủy.

UX-DR15: Khi timeout hoặc mất kết nối sau batch creation, whole-class transfer hoặc completion, UI giữ trạng thái “Đang kiểm tra kết quả”, đối soát operation ID với server, chỉ cho retry khi server xác nhận chưa áp dụng thay đổi.

UX-DR16: Hiển thị skeleton theo cấu trúc ở list/report; lỗi giữ dữ liệu đã nhập và hiển thị gần action kèm toast ngắn; offline chỉ báo một lần và không xếp hàng mutation.

UX-DR17: Cung cấp báo cáo responsive theo tháng: KPI tổng thu/tiền mặt/chuyển khoản và breakdown tài khoản; trên mobile trình bày card dọc, ưu tiên đọc báo cáo.

UX-DR18: Cài PWA có app icon, tên `Ánh Hoa Admin`, standalone sau khi cài, browser-native install prompt và không hỗ trợ chỉnh sửa offline.

UX-DR19: Đáp ứng WCAG 2.2 AA: `h1` mỗi route, caption/aria-label cho bảng, đơn vị VND cho screen reader, status không chỉ bằng màu, dialog chuẩn, validation `aria-describedby`/live region, icon target tối thiểu 40x40px và không có action chỉ hover.

UX-DR20: Áp dụng responsive breakpoints: sidebar đầy đủ từ 1280px, thu gọn 1024-1279px, sheet 768-1023px, và mobile dưới 768px với table scroll ngang/cột định danh ghim, modal gần full-screen và ưu tiên Tổng quan/Báo cáo.

### FR Coverage Map

FR-1: Epic 1 - Truy cập dashboard quản trị.

FR-2: Epic 2 - Chuẩn bị dữ liệu thu phí.

FR-3: Epic 2 - Chuẩn bị dữ liệu thu phí.

FR-4: Epic 2 - Chuẩn bị dữ liệu thu phí.

FR-5: Epic 2 - Chuẩn bị dữ liệu thu phí.

FR-6: Epic 3 - Lập và xác nhận hóa đơn tháng.

FR-7: Epic 3 - Lập và xác nhận hóa đơn tháng.

FR-8: Epic 3 - Lập và xác nhận hóa đơn tháng.

FR-9: Epic 2 - Chuẩn bị dữ liệu thu phí.

FR-10: Epic 3 - Lập và xác nhận hóa đơn tháng.

FR-11: Epic 4 - Đối soát thu tiền theo tháng.

## Epic List

### Epic 1: Truy cập dashboard quản trị

Admin có thể đăng nhập Google an toàn, được nhận diện nhất quán và truy cập workspace vận hành trên desktop hoặc mobile.

**FRs covered:** FR-1

### Epic 2: Chuẩn bị dữ liệu thu phí

Admin có thể duy trì Lớp, Học sinh, chuyển lớp, Mẫu hóa đơn chung và Tài khoản nhận tiền để dữ liệu sẵn sàng cho mỗi kỳ lập hóa đơn.

**FRs covered:** FR-2, FR-3, FR-4, FR-5, FR-9

### Epic 3: Lập và xác nhận hóa đơn tháng

Admin có thể tạo nháp theo tháng, rà soát/chỉnh từng hóa đơn, cung cấp QR chuyển khoản đúng dữ liệu, rồi xác nhận đã thu tiền với audit bất biến.

**FRs covered:** FR-6, FR-7, FR-8, FR-10

### Epic 4: Đối soát thu tiền theo tháng

Admin có thể xem chính xác kết quả tiền đã thu của một tháng, tách tiền mặt, chuyển khoản và từng Tài khoản nhận tiền.

**FRs covered:** FR-11

## Epic 1: Truy cập dashboard quản trị

Admin có thể đăng nhập Google an toàn, được nhận diện nhất quán và truy cập workspace vận hành trên desktop hoặc mobile.

### Story 1.1: Khởi tạo workspace và application shell

As an Admin,
I want mở được ứng dụng Ánh Hoa Admin có cấu trúc và điều hướng vận hành rõ ràng,
So that tôi có một bề mặt quản trị nhất quán để thực hiện công việc hằng ngày.

**Acceptance Criteria:**

**Given** repository chưa có ứng dụng
**When** Story được hoàn thành
**Then** repository là pnpm workspace có Turborepo, `apps/web` là React 19/Vite 8 PWA và `apps/api` là NestJS 11/Prisma 7 với TypeScript strict
**And** Prisma schema, migration và seed chỉ đặt trong `apps/api/prisma`; shared package nếu có chỉ chứa TypeScript thuần, không import app.

**Given** Admin mở web app trên desktop
**When** application shell hiển thị
**Then** sidebar có logo/tên Ánh Hoa, điều hướng Tổng quan, Hóa đơn, Học sinh, Lớp, Mẫu hóa đơn, Tài khoản nhận tiền, Báo cáo và khu vực tài khoản Admin
**And** mục đang chọn dùng nền xanh nhạt, vùng nội dung dùng gutter 32px, nền kem/card trắng viền mảnh, typography Inter và Clash Grotesk theo `DESIGN.md`.

**Given** app được mở tại các breakpoint đặc tả
**When** viewport đổi giữa desktop, tablet và mobile
**Then** sidebar đầy đủ tại từ 1280px, có thể thu gọn tại 1024-1279px, thành sheet tại 768-1023px và thao tác quản trị vẫn truy cập được dưới 768px
**And** PWA có manifest, icon, tên `Ánh Hoa Admin`, mở standalone sau khi cài và không tự hiện popup ép cài.

**Given** một route trong web app được render
**When** Admin dùng keyboard hoặc screen reader
**Then** route có đúng một `h1`, focus nhìn thấy được theo token brand, không có action chỉ hiện khi hover, và icon button có vùng tương tác tối thiểu 40x40px cùng nhãn truy cập được.

**Given** browser chuyển sang trạng thái offline
**When** trạng thái này bắt đầu hoặc app re-render trong cùng một đợt mất kết nối
**Then** app shell chỉ hiển thị một toast `Bạn đang ngoại tuyến. Không thể lưu thay đổi.` cho đợt đó
**And** app không xếp hàng hay tự gửi lại mutation offline.

### Story 1.2: Đăng nhập Google theo danh sách Admin cho phép

As an Admin có email được cho phép,
I want đăng nhập bằng Google,
So that hệ thống nhận diện an toàn tôi cho các thao tác vận hành và audit.

**Acceptance Criteria:**

**Given** API khởi động
**When** cấu hình môi trường được nạp
**Then** API validate cấu hình cần thiết, chỉ cho credentialed CORS từ `WEB_ORIGIN` và chỉ dùng OAuth redirect URL đã allowlist
**And** các route vận hành mặc định được bảo vệ bằng auth guard.

**Given** người dùng hoàn thành Google OAuth với email được chuẩn hóa nằm trong `ADMIN_EMAILS`
**When** API xử lý callback
**Then** API tạo Admin lần đầu hoặc cập nhật email, tên hiển thị và ảnh đại diện khi Google trả thông tin mới
**And** API phát session JWT trong cookie `Secure`, `httpOnly`, `SameSite=Lax` mà web không thể đọc token bằng JavaScript.

**Given** Google OAuth trả về email không thuộc `ADMIN_EMAILS`
**When** callback được xử lý
**Then** người dùng bị từ chối truy cập dashboard
**And** không có session hợp lệ được phát.

**Given** client gửi unsafe credentialed request
**When** request thiếu origin hợp lệ hoặc double-submit CSRF token hợp lệ
**Then** API từ chối request theo một JSON error shape `{ error: { code, message, fieldErrors? } }`
**And** controller validate DTO mutation trên server, không tin validation chỉ từ web.

### Story 1.3: Truy cập workspace được bảo vệ

As an Admin đã đăng nhập,
I want vào workspace và biết rõ trạng thái truy cập của mình,
So that tôi chỉ làm việc trên dữ liệu vận hành khi phiên của mình hợp lệ.

**Acceptance Criteria:**

**Given** web app khởi động với session cookie hợp lệ
**When** web gọi credentialed `GET /auth/me`
**Then** app bootstrap danh tính Admin từ REST response và hiển thị Tổng quan cùng application shell
**And** web không lưu, refresh hay persist access token trong JavaScript.

**Given** khách chưa có session hợp lệ
**When** họ truy cập route vận hành hoặc `GET /auth/me` trả unauthenticated
**Then** app chuyển họ đến màn Đăng nhập Google
**And** không hiển thị dữ liệu vận hành trước khi xác thực thành công.

**Given** OAuth bị từ chối do email không có quyền hoặc session hết hạn
**When** trang Đăng nhập hiển thị
**Then** thông báo ngắn, trực tiếp nêu email không có quyền hoặc cần đăng nhập lại
**And** không làm lộ danh sách `ADMIN_EMAILS` hay dữ liệu vận hành.

**Given** Admin điều hướng giữa các route đã xác thực
**When** dữ liệu identity cần dùng lại
**Then** web dùng REST client và React Query theo convention query key bắt đầu bằng resource REST
**And** mọi request credentialed chỉ coi response API là nguồn chân lý.

## Epic 2: Chuẩn bị dữ liệu thu phí

Admin có thể duy trì Lớp, Học sinh, chuyển lớp, Mẫu hóa đơn chung và Tài khoản nhận tiền để dữ liệu sẵn sàng cho mỗi kỳ lập hóa đơn.

### Story 2.1: Quản lý Lớp đang hoạt động và lưu trữ

As an Admin,
I want tạo, xem, sửa và lưu trữ Lớp,
So that danh sách Lớp và học phí tháng phản ánh đúng vận hành hiện tại mà không mất lịch sử.

**Acceptance Criteria:**

**Given** Admin truy cập Lớp
**When** xem danh sách hoặc chi tiết Lớp
**Then** API REST trả list theo `{ data, meta }` và UI có table được gắn nhãn, phân trang, tìm kiếm/filter, trạng thái hoạt động/lưu trữ và danh sách Học sinh đang học hiện thuộc Lớp
**And** empty, loading, error state dùng một CTA phù hợp, skeleton theo cấu trúc và giữ dữ liệu nhập khi lưu lỗi.

**Given** Admin tạo hoặc sửa Lớp qua form dialog
**When** nhập tên và học phí tháng nguyên VND không âm rồi lưu
**Then** API persist dữ liệu với tiền `BIGINT` và trả JSON integer an toàn, UI định dạng dấu phân tách và hậu tố `đ` khi blur
**And** validation tại field chạy khi blur/lưu, liên kết lỗi bằng `aria-describedby` và dialog không đóng nếu lưu thất bại.

**Given** một Lớp active cần ngừng dùng
**When** Admin xác nhận lưu trữ trong modal nêu rõ Lớp bị ảnh hưởng
**Then** Lớp chuyển sang trạng thái lưu trữ thay vì bị xóa cứng
**And** Lớp lưu trữ không còn là lựa chọn gán mới hoặc luồng tạo Hóa đơn mới nhưng vẫn xem được cùng lịch sử tham chiếu.

**Given** một Lớp active còn Học sinh đang học được gán vào
**When** Admin thử lưu trữ Lớp
**Then** API từ chối với `CLASS_HAS_ACTIVE_STUDENTS` cùng số lượng Học sinh bị ảnh hưởng
**And** UI hướng Admin chuyển hoặc cho nghỉ học các em trước khi lưu trữ.

### Story 2.2: Quản lý Học sinh và Lớp hiện tại

As an Admin,
I want tìm, tạo và cập nhật Học sinh cùng trạng thái đang học,
So that danh sách đối tượng đủ điều kiện thu phí luôn chính xác.

**Acceptance Criteria:**

**Given** Admin truy cập Học sinh
**When** tìm theo tên, xem danh sách hoặc mở chi tiết
**Then** UI cung cấp data table phân trang có search trước filter, URL phản ánh filter và action luôn truy cập được bằng chuột, cảm ứng và keyboard
**And** Học sinh nghỉ học vẫn hiển thị cùng toàn bộ tham chiếu lịch sử.

**Given** Admin tạo hoặc sửa Học sinh trong form dialog
**When** nhập họ tên, biệt danh tùy chọn và chọn Lớp hiện tại
**Then** Học sinh có thể không gán Lớp và picker chỉ liệt kê Lớp active
**And** help text nêu rõ thay đổi Lớp chỉ áp dụng hiện tại, không thay đổi snapshot Hóa đơn đã tạo.

**Given** Học sinh đang học cần chuyển thành nghỉ học hoặc ngược lại
**When** Admin thực hiện action và xác nhận modal không đảo được khi nghỉ học
**Then** API cập nhật trạng thái, không xóa cứng Học sinh, và UI phản ánh kết quả bằng trạng thái/toast ngắn
**And** Học sinh nghỉ học không đủ điều kiện cho tạo Hóa đơn hàng loạt mới.

### Story 2.3: Chuyển một Học sinh giữa các Lớp

As an Admin,
I want chuyển Lớp hiện tại của một Học sinh sang Lớp active khác,
So that dữ liệu nguồn thu phí theo đúng Lớp hiện tại của em.

**Acceptance Criteria:**

**Given** Admin sửa một Học sinh
**When** chọn Lớp đích và lưu
**Then** API chỉ chấp nhận Lớp đích đang active và cập nhật quan hệ Lớp hiện tại của Học sinh
**And** UI hiển thị Lớp mới tại danh sách/chi tiết sau khi API xác nhận.

**Given** Học sinh đã có Hóa đơn lịch sử
**When** Lớp hiện tại được thay đổi
**Then** tên Học sinh, biệt danh, tên Lớp, học phí và Dòng hóa đơn snapshot trên mọi Hóa đơn tồn tại không thay đổi
**And** UI nêu rõ điều này trước khi lưu thay đổi Lớp.

**Given** Lớp đích bị lưu trữ hoặc request không hợp lệ
**When** Admin thử lưu
**Then** API từ chối theo error shape chuẩn và UI giữ dữ liệu đã nhập, hiển thị lỗi gần trường/action
**And** client invalidates dữ liệu Học sinh/Lớp bị ảnh hưởng chỉ sau response thành công.

### Story 2.4: Chuyển toàn bộ Học sinh đang học của một Lớp

As an Admin,
I want chuyển toàn bộ Học sinh đang học sang một Lớp active khác,
So that tôi xử lý thay đổi cơ cấu Lớp nhanh và có kiểm soát.

**Acceptance Criteria:**

**Given** Admin mở chi tiết Lớp nguồn
**When** chọn chuyển toàn bộ và chọn Lớp đích active
**Then** modal nêu rõ Lớp đích, số Học sinh đang học sẽ bị ảnh hưởng và việc Học sinh nghỉ học không thay đổi
**And** Admin có thể hủy mà không có bản ghi nào thay đổi.

**Given** Admin xác nhận chuyển cả Lớp
**When** web gửi mutation với UUID `Idempotency-Key`
**Then** API chạy việc chuyển trong một database transaction, chỉ đổi Học sinh đang học và lưu/replay kết quả theo Admin + route + request fingerprint
**And** retry cùng key/cùng request trả kết quả đã lưu, còn cùng key/request khác trả conflict.

**Given** request chuyển cả Lớp timeout hoặc mất kết nối sau khi gửi
**When** UI chưa biết kết quả cuối
**Then** modal khóa action và hiển thị `Đang kiểm tra kết quả`, sau đó gọi `GET /operations/:operationId`
**And** chỉ mở retry khi server xác nhận thao tác chưa áp dụng; nếu thành công, UI cập nhật Lớp nguồn, toast số đã chuyển và có link Lớp đích.

### Story 2.5: Quản lý Mẫu hóa đơn chung

As an Admin,
I want duy trì Mẫu hóa đơn chung,
So that Hóa đơn mới có bố cục thu phí nhất quán và tự điền đúng học phí Lớp khi cần.

**Acceptance Criteria:**

**Given** Admin truy cập Mẫu hóa đơn
**When** xem hoặc thay đổi Mẫu hóa đơn chung duy nhất đang dùng
**Then** Admin có thể thêm, sửa, bỏ và xem các Dòng mẫu gồm mô tả, nhóm thu tùy chọn, thứ tự và nguồn số tiền
**And** nguồn tiền chỉ là số cố định VND không phân số hoặc học phí tháng của Lớp.

**Given** hệ thống được khởi tạo
**When** Admin chưa cấu hình Mẫu hóa đơn chung
**Then** seed tạo đúng một Mẫu hóa đơn chung không có Dòng mẫu
**And** Admin có thể thêm và sắp xếp Dòng mẫu trước khi dùng mẫu để tạo Hóa đơn.

**Given** Admin cần đổi thứ tự Dòng mẫu
**When** chọn nút `Lên` hoặc `Xuống` có nhãn truy cập được
**Then** thứ tự được persist và phản ánh lại trong danh sách
**And** UI không phụ thuộc drag-and-drop.

**Given** Admin sửa hoặc bỏ Dòng mẫu
**When** thay đổi được lưu
**Then** thay đổi chỉ tác động Hóa đơn tạo mới
**And** Dòng hóa đơn của Hóa đơn đã tạo giữ nguyên snapshot độc lập.

### Story 2.6: Quản lý Tài khoản nhận tiền

As an Admin,
I want thêm và quản lý trạng thái Tài khoản nhận tiền,
So that chỉ thông tin ngân hàng hợp lệ được dùng cho các Hóa đơn chuyển khoản mới mà lịch sử vẫn tra cứu được.

**Acceptance Criteria:**

**Given** Admin truy cập Tài khoản nhận tiền
**When** xem danh sách hoặc mở form dialog thêm mới
**Then** mỗi Tài khoản gồm ngân hàng/mã ngân hàng VietQR, số tài khoản, tên chủ tài khoản và trạng thái
**And** danh sách có trạng thái rõ ràng, empty/loading/error state và table/action đáp ứng accessibility floor.

**Given** Admin thêm hoặc kích hoạt Tài khoản nhận tiền
**When** dữ liệu hợp lệ được lưu
**Then** API trả Tài khoản active để các Hóa đơn `DRAFT` trong luồng sau có thể chọn
**And** không có endpoint hay action xóa cứng Tài khoản nhận tiền.

**Given** Admin ngừng dùng một Tài khoản active
**When** xác nhận modal nêu rõ ảnh hưởng
**Then** Tài khoản chuyển trạng thái ngừng dùng và không còn xuất hiện trong picker của Hóa đơn `DRAFT`
**And** Tài khoản đã snapshot trên Hóa đơn `PENDING`/`COMPLETED` vẫn hiển thị cùng badge `Ngừng dùng` và vẫn cho phép hoàn tất `PENDING` đã chụp nó.

## Epic 3: Lập và xác nhận hóa đơn tháng

Admin có thể tạo nháp theo tháng, rà soát/chỉnh từng hóa đơn, cung cấp QR chuyển khoản đúng dữ liệu, rồi xác nhận đã thu tiền với audit bất biến.

### Story 3.1: Xem danh sách Hóa đơn theo tháng

As an Admin,
I want xem và lọc Hóa đơn theo tháng,
So that tôi nhanh chóng tìm được Hóa đơn cần tạo, rà soát hoặc xác nhận.

**Acceptance Criteria:**

**Given** Admin truy cập Hóa đơn
**When** trang tải lần đầu
**Then** month picker hiển thị `MM/YYYY`, mặc định tháng hiện tại và đổi tháng làm tải lại danh sách từ REST API
**And** UI cung cấp search theo tên trước filter trạng thái/lớp, phản ánh filter trên URL, phân trang và table có caption hoặc `aria-label` nêu tháng/filter hiện tại.

**Given** danh sách có Hóa đơn ở các trạng thái khác nhau
**When** Admin xem table hoặc chọn hàng
**Then** mỗi Hóa đơn thể hiện Học sinh/Lớp snapshot, tổng VND căn phải, badge có nhãn `Nháp`, `Chờ xác nhận` hoặc `Đã hoàn tất` và hàng có thể mở chi tiết
**And** status không chỉ truyền bằng màu, action không bị giấu khi hover và table mobile hỗ trợ scroll ngang với cột định danh ghim.

**Given** tháng đã chọn chưa có Hóa đơn
**When** trang hoàn tất tải
**Then** UI giữ month picker, giải thích chưa có Hóa đơn tháng và hiển thị đúng một CTA `Tạo hóa đơn tháng`
**And** loading dùng skeleton theo cấu trúc, lỗi hiển thị gần bề mặt kèm toast ngắn.

### Story 3.2: Xem trước và tạo Hóa đơn nháp hàng loạt

As an Admin,
I want xem trước và tạo Hóa đơn nháp cho một tháng theo phạm vi Lớp,
So that tôi chuẩn bị thu phí nhanh mà không tạo Hóa đơn trùng hoặc sai đối tượng.

**Acceptance Criteria:**

**Given** Admin mở modal tạo Hóa đơn tháng
**When** chọn Tháng hóa đơn và `Toàn trường` hoặc một hay nhiều Lớp active
**Then** web gọi `POST /invoices/batch-preview` là nguồn preflight chính thức và hiển thị số Học sinh đủ điều kiện cùng skip được phân loại: nghỉ học, chưa gán Lớp, Lớp lưu trữ hoặc đã có Hóa đơn
**And** nếu không có Học sinh đủ điều kiện, UI không gửi lệnh tạo.

**Given** Mẫu hóa đơn chung chưa có Dòng mẫu
**When** Admin yêu cầu batch preview hoặc tạo Hóa đơn hàng loạt
**Then** API từ chối bằng lỗi `INVOICE_TEMPLATE_EMPTY`
**And** không tạo Hóa đơn rỗng.

**Given** Học sinh đang học có Lớp active chưa có Hóa đơn trong tháng
**When** Admin gửi tạo với UUID `Idempotency-Key`
**Then** API trong transaction tạo đúng một `DRAFT` cho mỗi cặp `(studentId, billingMonth)`, PostgreSQL enforce unique constraint và response nêu chính xác created/skipped
**And** mỗi Hóa đơn lưu Admin tạo, timestamp, Học sinh/Lớp snapshot, Dòng mẫu snapshot và giá trị học phí tháng hiện tại khi dòng mẫu dùng nguồn học phí Lớp.
**And** phương thức thanh toán và Tài khoản nhận tiền chưa được đặt tại thời điểm tạo `DRAFT`.

**Given** hai Admin gửi tạo đồng thời với phạm vi chồng lấp hoặc client retry cùng request
**When** API xử lý
**Then** không có Hóa đơn trùng, kết quả cuối phản ánh đúng created/skipped và retry có cùng operation key/request nhận stored response
**And** key bị dùng lại cho request khác trả conflict.

**Given** kết quả tạo không chắc chắn do timeout sau khi submit
**When** modal chuyển `Đang kiểm tra kết quả`
**Then** trigger/action bị khóa và web gọi `GET /operations/:operationId` trước khi cho thao tác lại
**And** khi thành công UI hiển thị created/skipped và link về danh sách tháng đó lọc `Nháp`.

### Story 3.3: Rà soát và chỉnh sửa Hóa đơn nháp

As an Admin,
I want rà soát và chỉnh sửa Hóa đơn `DRAFT`,
So that số tiền và phương thức thanh toán được kiểm tra trước khi chờ xác nhận.

**Acceptance Criteria:**

**Given** Admin mở Hóa đơn `DRAFT`
**When** trang chi tiết hiển thị trên desktop
**Then** trang riêng, không phải dialog, có editor Dòng hóa đơn ở cột trái và summary bên phải gồm tháng, Học sinh/Lớp snapshot, tổng, trạng thái, phương thức, Tài khoản và audit
**And** tại màn hẹp, hai cột thu gọn hoặc summary xuống dưới mà không che thông tin quan trọng.

**Given** Admin chỉnh Dòng hóa đơn
**When** thêm, sửa, xóa hoặc dùng nút `Lên`/`Xuống` có nhãn để sắp xếp
**Then** mỗi dòng lưu mô tả, nhóm tùy chọn và số nguyên VND; dòng có thể là âm hoặc bằng 0 và xóa dòng khác 0 yêu cầu xác nhận nhẹ
**And** UI cập nhật preview tổng tức thì, còn API là nguồn tính tổng chính xác từ line item và không tin tổng client gửi.
**And** API chỉ chấp nhận amount của mỗi Dòng hóa đơn trong phạm vi từ `-100.000.000` đến `100.000.000` VND.

**Given** Admin chọn phương thức thanh toán và Tài khoản nhận tiền
**When** lưu Hóa đơn `DRAFT`
**Then** tiền mặt không yêu cầu Tài khoản, còn picker chuyển khoản chỉ cho chọn Tài khoản active
**And** API trả current resource với `billingMonth` `YYYY-MM`, UUID string, timestamp UTC ISO 8601 và tổng/VND JSON integer an toàn.
**And** các lựa chọn thanh toán còn có thể chỉnh sửa và không thay đổi snapshot của Hóa đơn đã khóa.

**Given** Hóa đơn là `PENDING` hoặc `COMPLETED`
**When** Admin mở chi tiết
**Then** API từ chối mọi mutation editor và UI hiển thị nội dung payment read-only
**And** `COMPLETED` không có action mở lại, hủy hoặc sửa.

### Story 3.4: Chuyển Hóa đơn sang chờ xác nhận và cung cấp QR

As an Admin,
I want chuyển Hóa đơn hợp lệ sang chờ xác nhận và xem QR chuyển khoản,
So that thông tin nhận tiền được cố định, rõ ràng trước khi đối chiếu giao dịch.

**Acceptance Criteria:**

**Given** Hóa đơn `DRAFT` có tổng lớn hơn 0 và không vượt `100.000.000` VND
**When** Admin chọn `Chuyển sang chờ xác nhận`
**Then** API chỉ cho phép transition `DRAFT -> PENDING` khi tiền mặt không có Tài khoản hoặc chuyển khoản đã chọn Tài khoản active
**And** khi điều kiện không hợp lệ, UI giữ dữ liệu, chỉ lỗi đúng field/section cần sửa và không tự đổi trạng thái.

**Given** transition sang `PENDING` thành công
**When** Admin xem lại chi tiết
**Then** toàn bộ Dòng hóa đơn, tổng, phương thức và Tài khoản nhận tiền được khóa read-only
**And** snapshot Học sinh, Lớp, Dòng hóa đơn, phương thức và Tài khoản bảo toàn dù dữ liệu nguồn sau đó bị sửa/ngừng dùng.
**And** API snapshot phương thức thanh toán và Tài khoản nhận tiền đang được chọn chỉ tại transition thành công này.

**Given** Hóa đơn `PENDING` thanh toán chuyển khoản có Tài khoản snapshot
**When** summary hiển thị QR card
**Then** QR VietQR được dựng từ snapshot số tiền, ngân hàng và số Tài khoản
**And** nội dung chuyển khoản có dạng `Họ tên [biệt danh nếu có] Lớp chuyển tiền`, kèm số tiền, Tài khoản và nút sao chép có nhãn, không thay đổi theo dữ liệu nguồn.

**Given** Hóa đơn `PENDING` chưa được xác nhận đã nhận tiền
**When** Admin chọn `Trả về nháp để chỉnh sửa`
**Then** API chỉ cho phép `PENDING -> DRAFT` và UI mở lại editor
**And** khi gửi lại `PENDING`, API thay thế snapshot thanh toán bằng dữ liệu đang được chọn hợp lệ và QR được dựng từ snapshot mới.

### Story 3.5: Xác nhận đã nhận tiền và audit Hóa đơn

As an Admin,
I want xác nhận đã nhận đủ tiền của Hóa đơn `PENDING`,
So that trạng thái thu tiền, người xác nhận và thời điểm được lưu chính xác, không bị chỉnh sửa.

**Acceptance Criteria:**

**Given** Admin mở Hóa đơn `PENDING`
**When** chọn `Xác nhận đã nhận tiền`
**Then** modal nêu Học sinh, Tháng hóa đơn, phương thức thanh toán và tổng tiền, có Hủy là action phụ và nút xác nhận ghi đầy đủ `Xác nhận đã nhận [tổng tiền] đ`
**And** modal trap focus, trả focus về trigger khi đóng, không tự focus nút phá hủy và đóng/hủy không đổi Hóa đơn.

**Given** Admin xác nhận trong modal
**When** web gửi UUID `Idempotency-Key`
**Then** API transaction chỉ cho phép `PENDING -> COMPLETED` với tổng dương, ghi Admin xác nhận và timestamp đúng một lần
**And** completion retry cùng key/request replay stored response, key với fingerprint khác trả conflict và `COMPLETED` là read-only vĩnh viễn trong MVP.

**Given** completion request đang gửi hoặc kết quả chưa rõ
**When** UI chờ response, timeout hoặc mất kết nối
**Then** modal khóa tất cả action/đóng, hiển thị loading hoặc `Đang kiểm tra kết quả` và đối soát `GET /operations/:operationId`
**And** nếu server đã hoàn tất, UI cập nhật badge `Đã hoàn tất` và audit; chỉ retry khi server xác nhận chưa áp dụng.

**Given** Hóa đơn đã `COMPLETED`
**When** Admin xem chi tiết
**Then** audit hiển thị Admin tạo, Admin xác nhận, timestamp, tổng tiền và phương thức snapshot
**And** MVP không hỗ trợ thu thiếu/thừa, trả góp, hoàn tiền, hủy hoặc mở lại Hóa đơn.

## Epic 4: Đối soát thu tiền theo tháng

Admin có thể xem chính xác kết quả tiền đã thu của một tháng, tách tiền mặt, chuyển khoản và từng Tài khoản nhận tiền.

### Story 4.1: Xem báo cáo thu theo tháng

As an Admin,
I want chọn một tháng để xem báo cáo tiền đã thu,
So that tôi đối soát được tổng thu, tiền mặt và tiền chuyển khoản theo từng Tài khoản nhận tiền.

**Acceptance Criteria:**

**Given** Admin truy cập Tổng quan hoặc Báo cáo
**When** chọn Tháng hóa đơn qua month picker hiển thị `MM/YYYY`
**Then** web tải báo cáo tháng từ REST API và month picker mặc định tháng hiện tại
**And** response dùng `billingMonth` `YYYY-MM`, tổng VND là JSON integer an toàn và API là nguồn chân lý của số liệu.

**Given** Admin truy cập Tổng quan sau khi các dữ liệu Hóa đơn và báo cáo đã có
**When** tháng đang xem được tải
**Then** Tổng quan hiển thị tổng thu tháng, số Hóa đơn `Nháp`/`Chờ xác nhận`/`Đã hoàn tất` và lối tắt công việc phù hợp
**And** các lối tắt dẫn đến Hóa đơn/Báo cáo với ngữ cảnh tháng hoặc trạng thái liên quan, không chỉ là card trang trí.

**Given** tháng có Hóa đơn ở nhiều trạng thái
**When** API tính báo cáo
**Then** chỉ Hóa đơn `COMPLETED` được aggregate
**And** response gồm tổng đã thu, tổng tiền mặt, tổng chuyển khoản và tổng chuyển khoản nhóm theo từng Tài khoản nhận tiền snapshot.

**Given** Tài khoản nhận tiền nguồn đã bị sửa hoặc ngừng dùng sau khi Hóa đơn hoàn tất
**When** Admin xem báo cáo tháng
**Then** tổng và tên/định danh của từng nhóm chuyển khoản được lấy từ snapshot thanh toán trên Hóa đơn
**And** báo cáo không đọc dữ liệu Tài khoản nguồn có thể thay đổi.

**Given** Admin mở báo cáo trên desktop
**When** dữ liệu tải xong
**Then** UI hiển thị rõ KPI tổng thu, tiền mặt, chuyển khoản và breakdown từng Tài khoản nhận tiền; tiền căn phải, có phân tách hàng nghìn và hậu tố `đ`
**And** loading dùng skeleton theo cấu trúc, lỗi không xoá dữ liệu đã thấy và có thông báo ngắn phù hợp.

**Given** Admin mở báo cáo trên mobile dưới 768px
**When** xem cùng dữ liệu tháng
**Then** KPI xếp card dọc và breakdown mỗi Tài khoản nhận tiền hiển thị dạng card thay vì buộc dùng bảng rộng
**And** trang có một `h1`, mọi số tiền/status có nhãn truy cập được và đáp ứng WCAG 2.2 AA.

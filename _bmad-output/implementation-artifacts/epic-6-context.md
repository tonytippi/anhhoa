# Epic 6 Context: Phụ huynh đăng nhập và xem Hóa đơn cần thanh toán

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Cho phép Parent đã được ủy quyền đăng nhập Google an toàn vào Parent PWA độc lập, xem ngay các Hóa đơn `PENDING` của một hoặc nhiều Học sinh trên Home mobile-first, đồng thời mở chi tiết read-only và lịch sử `COMPLETED`. Epic bảo đảm Parent chỉ nhận dữ liệu tối thiểu còn được ủy quyền và dữ liệu đã bảo vệ bị xóa ngay khi session hoặc quyền truy cập không còn hợp lệ.

## Stories

- Story 6.1: Khởi tạo Parent PWA và Parent Google session.
- Story 6.2: Cung cấp Parent REST read model.
- Story 6.3: Home hiển thị Hóa đơn cần thanh toán của nhiều con.
- Story 6.4: Chi tiết Hóa đơn và lịch sử thanh toán read-only.

## Requirements & Constraints

- Parent đăng nhập bằng Google email đã verified. Lần đăng nhập đầu bind email đã chuẩn hóa với Google subject; những lần sau subject phải khớp. Email chưa được gán, Parent inactive, không còn liên kết `StudentParent` `ACTIVE`, subject thay đổi hoặc OAuth lỗi phải bị từ chối an toàn, không tạo partial session.
- Session Parent riêng với Admin. Logout, session expiry và `401` phải xóa protected state trước khi điều hướng về Đăng nhập. Revoke một Học sinh chỉ xóa dữ liệu của Học sinh đó; Parent giữ session và dữ liệu các liên kết `ACTIVE` khác, chỉ bị sign-out khi không còn liên kết active hoặc session không hợp lệ.
- Mọi request Parent kiểm tra server-side Parent active và liên kết `StudentParent` active hiện hành. UUID, URL và filter không là bằng chứng ủy quyền; không tiết lộ sự tồn tại của Học sinh hay Hóa đơn không được phép. DTO chỉ gồm dữ liệu cần cho Parent, không audit Admin, Parent khác hay dữ liệu nội bộ.
- Parent chỉ xem Hóa đơn `PENDING` và `COMPLETED`; không được trả hoặc lọc `DRAFT`. Danh sách phải có pagination, page size giới hạn, stable sort và filter server-validated theo Học sinh được ủy quyền, tháng hóa đơn và trạng thái hợp lệ. Chi tiết là read-only: Học sinh snapshot, tháng, dòng phí, tổng VND, phương thức và trạng thái.
- Không cache protected REST response hoặc payment snapshot trong service worker; protected client data chỉ ở memory. Revalidate khi app foreground, tab focus và trước protected view; khi bị từ chối, không để dữ liệu cũ tiếp tục hiển thị.
- Epic không bao gồm payment eligibility, VietQR, CTA `Chuyển tiền`, payment sheet, download PNG hay deep link ngân hàng. `PENDING` + `CASH` chỉ hướng dẫn thanh toán tiền mặt; `PENDING` + `TRANSFER` vẫn chỉ đọc trong Epic này.
- Kiểm thử API PostgreSQL phải bao phủ identity, authorization từng endpoint, nhiều con, revoke, pagination/sort/filter, direct UUID, `DRAFT` và DTO minimization. Playwright E2E phải bao phủ login, nhiều Học sinh, revoke trong session và protected-state clearing.

## Technical Decisions

- Tạo `apps/parent-web` là React/Vite PWA độc lập, có router, manifest, icon, service worker, REST client và React Query cache riêng. Không import `apps/web`, dùng chung router/session/service worker/browser state hay gọi Admin business endpoint; chỉ có thể chia sẻ pure contracts/utilities từ `packages`.
- Trong `apps/api`, `parent-auth` sở hữu Google OAuth và Parent session; `parent-portal` sở hữu read DTO đã authorize; `parents` sở hữu Parent/StudentParent. Portal chỉ phụ thuộc Prisma cùng query service hẹp được export từ `parents`, `students`, `invoices`; không gọi controller khác hoặc ghi invoice lifecycle.
- Parent REST được namespace dưới `/api/parent`: `/me`, `/students`, `/invoices`, `/invoices/:invoiceId`. List dùng `{ data, meta }`; JSON camelCase, DTO/validation/error envelope theo convention API hiện có. Query keys bắt đầu bằng `parent`; `401` là chuyển trạng thái authorization, không phải query error để retry.
- OAuth state phải random, browser/callback-bound, single-use và expiring. Chỉ cấp cookie Parent `Secure`, `httpOnly`, `SameSite=Lax` sau toàn bộ kiểm tra identity và active link; cookie không đọc được từ JavaScript hay được chấp nhận như Admin session. API bootstrap phải validate Parent origin, callback allowlist, cookie name và scope cấu hình, không khởi động với default không an toàn.
- Giữ các invariant nền tảng: UUID, tháng `YYYY-MM`, UTC timestamp, tiền VND `BIGINT` boundary mapping, controller delegate service. Parent PWA chỉ gọi REST; API giữ mọi quyết định authorization và dữ liệu tiền.

## UX & Interaction Patterns

- Parent PWA mobile-first, một cột, nền kem, card trắng, gutter 20px, Inter cho nội dung và Clash Grotesk cho heading. Sau login luôn mở tab `Trang chủ` với một `h1` `Hóa đơn cần thanh toán`; không dùng KPI, bảng, carousel, sidebar hoặc push notification. Bottom navigation gồm `Trang chủ` và `Lịch sử`; menu header hiện email, trợ giúp ngắn và đăng xuất không cần modal.
- Home ưu tiên `PENDING` ngay vùng nhìn thấy đầu tiên. Khi có từ hai Học sinh, dùng student switcher scroll ngang với `Tất cả` mặc định; ở chế độ này mọi card vẫn hiện rõ tên Học sinh. Chỉ group Học sinh có `PENDING`, group theo invoice mới nhất rồi tên Học sinh; card trong group theo billing month mới nhất. Không có pending thì hiện `Không còn Hóa đơn cần thanh toán` và link `Xem lịch sử`.
- Card hoặc row mở chi tiết bằng touch/keyboard. Chi tiết hiển thị snapshot, dòng phí, tổng VND, phương thức và status, toàn bộ read-only. `CASH` nêu `Thanh toán tiền mặt tại nhà trường`; `COMPLETED` chỉ là lịch sử, không có payment CTA.
- `Lịch sử` chỉ hiện `COMPLETED`, có pagination và filter Học sinh/tháng; filter được đồng bộ URL/query state và không được chọn Học sinh không còn quyền. Trong chế độ `Tất cả`, mỗi row vẫn nêu tên Học sinh.
- Loading dùng skeleton theo header, chips và card/row; refresh giữ dữ liệu đang đọc với indicator nhỏ. Offline hiển thị một banner và không coi data cached là mới hay queue action. Revoke đóng/xóa chi tiết của Học sinh đó và refresh switcher; `401` đóng protected surface, clear toàn bộ state rồi về Đăng nhập.
- Tuân WCAG 2.2 AA: target tối thiểu 44x44px, status có nhãn chữ, tổng tiền đọc kèm VND, live region cho lỗi/trạng thái và responsive một cột. Trên tablet/desktop chỉ mở rộng content tối đa, không chuyển sang layout Admin.

## Cross-Story Dependencies

- Epic 5, đặc biệt Story 5.1 và 5.3, phải hoàn thành trước Epic 6 để cung cấp relation retained và server-side Parent authorization. Story 5.2 cung cấp luồng Admin grant/revoke tạo dữ liệu truy cập thực tế.
- Story 6.1 thiết lập Parent PWA, OAuth và session bootstrap qua `/me`. Story 6.2 mở rộng read model bằng `/students`, `/invoices` và `/invoices/:invoiceId`; Story 6.3 và 6.4 chỉ bắt đầu sau Story 6.2.
- Epic 7 phụ thuộc read model của Story 6.2 và chỉ tích hợp UI sau Home/chi tiết khi cần. Epic 6 không được chờ endpoint payment để hoàn thành luồng xem read-only.

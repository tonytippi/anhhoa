---
title: "Đối chiếu UX PassionEdu với PRD và Architecture Spine Ánh Hoa"
status: draft
created: 2026-09-05
sources-reviewed:
  - DESIGN.md
  - EXPERIENCE.md
  - ../../prds/prd-anhhoa-2026-08-18/prd.md
  - ../../architecture/architecture-anhhoa-2026-08-18/ARCHITECTURE-SPINE.md
---

# Báo cáo đối chiếu nguồn

## Kết luận

`DESIGN.md` và `EXPERIENCE.md` chưa có thể dùng làm UX specification cho MVP Ánh Hoa. Chúng là specification nháp cho một sản phẩm khác, PassionEdu, với kiến trúc đa trường, nhiều vai trò và cổng Parent/Ops/Staff. Những khái niệm này bị PRD Ánh Hoa loại trừ rõ ràng. Đồng thời, hai tài liệu không đặc tả đủ một số luồng cốt lõi của MVP hóa đơn, QR, báo cáo và thao tác idempotent.

Nguồn có thẩm quyền để giải quyết xung đột là PRD `final` và Architecture Spine `final`. Không sửa các tài liệu `final`; cần thay thế hoặc viết lại hai UX document trong workspace này để chúng chỉ mô tả Anh Hoa Admin MVP.

## Phạm vi đối chiếu

- **Nguồn UX được kiểm:** `DESIGN.md` và `EXPERIENCE.md`, trạng thái `draft`, cập nhật 2026-09-05.
- **Nguồn chuẩn:** PRD Ánh Hoa và Architecture Spine Ánh Hoa, đều trạng thái `final`, ngày 2026-08-18.
- **Tiêu chí material:** khác biệt làm thay đổi đối tượng người dùng, chức năng MVP, trạng thái/dữ liệu hóa đơn, bảo mật, hoặc khả năng hoàn thành các hành trình UJ-1 đến UJ-4.

## Mâu thuẫn material

| Mức độ | Chủ đề | UX PassionEdu | PRD / Architecture Spine Ánh Hoa | Quyết định đối chiếu cần áp dụng |
| --- | --- | --- | --- | --- |
| Chặn | Ranh giới sản phẩm và tenant | `DESIGN.md` gọi sản phẩm là PassionEdu; `EXPERIENCE.md` định nghĩa multi-school, School switcher, selected School, Platform Operator và các session riêng. | Ánh Hoa là một dashboard nội bộ cho một trường; architecture chỉ có Admin, Class, Student, Invoice, BankAccount và Report. Không có School entity, tenant context, Ops portal hay chọn trường. | Loại toàn bộ School context/switcher, provisioning/suspend School, Ops portal và multi-school wording. Đổi nhận diện sản phẩm thành Ánh Hoa Admin MVP. |
| Chặn | Người dùng và cổng truy cập | UX có Admin/Staff, Finance Manager, Parent và Platform Operator; có parent PWA, child detail, inbox, leave request và attendance history. | PRD 2.2, 6 và 7.2 quy định giáo viên, phụ huynh và học sinh không có tài khoản hoặc giao diện; không có phân quyền chi tiết giữa Admin. | Chỉ một web app Admin. Loại toàn bộ Parent, Staff, Finance role, Operator role, audience-separated sessions và capability navigation theo role. |
| Chặn | Chức năng ngoài MVP | UX đưa vào điểm danh, xin nghỉ, bàn giao, calendar, attendance evidence/retention, inbox 30 ngày, enrollment, parent links, staff assignments, prepayment, ledger/correction/reversal và CollectionRun. | PRD 6 loại trừ phụ huynh, giáo viên, điểm danh, lịch học, thông báo, campus/khóa học, thu thiếu/thừa/trả góp/hoàn tiền và phân quyền chi tiết. | Xóa các IA, component, state, flow và copy liên quan. Không triển khai hoặc giữ chỗ cho các capability này trong UX MVP. |
| Chặn | Vòng đời hóa đơn và chỉnh sửa số liệu | UX nói về ledger posting, correction dialog, two-step reversal và approval khác người yêu cầu; mô tả issued obligation. | AD-7 và FR-8: chỉ `DRAFT -> PENDING -> COMPLETED`; `PENDING` chỉ có thể trả về `DRAFT`; `COMPLETED` chỉ xem, không hủy, mở lại, đảo, sửa hay hoàn tiền. Không có luồng phê duyệt. | Thay luồng correction/reversal bằng: Admin đưa `PENDING` về `DRAFT`, chỉnh sửa, rồi chuyển lại `PENDING` trước khi thu. Sau `COMPLETED`, UI chỉ cho xem audit/snapshot và hướng dẫn xử lý sai sót ngoài hệ thống nếu cần. |
| Cao | Thanh toán QR | UX Parent payment instruction nói VietQR, copy và deep link không thuộc release; các flow không chỉ ra Admin xem QR của hóa đơn `PENDING`. | FR-10 yêu cầu QR VietQR cho hóa đơn chuyển khoản, đúng tổng tiền, ngân hàng/tài khoản snapshot và nội dung chuyển khoản; UJ-3 yêu cầu Admin mở hóa đơn `PENDING` để xem QR. | Bổ sung Invoice detail cho Admin: khi `PENDING` và phương thức chuyển khoản, hiển thị QR và nội dung chuyển khoản chỉ đọc từ snapshot. Không đưa QR hay thao tác thanh toán cho Parent vì Parent không tồn tại trong MVP. |
| Cao | Xác nhận đã thu | UX đề cập settlement/reversal nhưng không đặc tả đầy đủ modal hoàn tất hóa đơn của Admin. | FR-8: chỉ `PENDING` được hoàn tất; modal bắt buộc hiển thị Học sinh, Tháng hóa đơn, phương thức, tổng tiền; xác nhận rõ ràng; lưu Admin xác nhận và timestamp; completion idempotent. | Bổ sung luồng/modal confirm completion đúng dữ liệu bắt buộc, trạng thái loading/reconcile và trạng thái chỉ xem sau thành công. Không hỗ trợ partial payment hoặc tự động xác nhận từ ngân hàng. |
| Cao | Luồng lập hóa đơn hàng loạt | UX dùng CollectionRun/catalog/eligible row/prior debt và generated drafts, nhưng không gắn với Mẫu hóa đơn chung, trạng thái lớp/học sinh và giới hạn một hóa đơn mỗi học sinh/tháng. | FR-5, FR-6, AD-5, AD-7, AD-8: một Mẫu hóa đơn chung; batch theo tháng và toàn trường/một hay nhiều lớp hoạt động; chỉ Student đang học có Class hoạt động; unique `(studentId, billingMonth)`; API preview trả eligible và skip theo nhóm; tạo `DRAFT` từ snapshot. | Đổi thành wizard tạo hóa đơn hàng loạt: tháng + toàn trường/lớp hoạt động -> preview API -> xác nhận tạo `DRAFT` -> kết quả created/skipped. Bỏ catalog, prior debt và CollectionRun như domain riêng. |
| Cao | Danh mục dữ liệu nguồn | IA có SchoolYear, enrollment, Parent links và Staff assignments, nhưng không có màn hình/luồng rõ cho Mẫu hóa đơn chung, Lớp/Học sinh theo yêu cầu hiện hành. | FR-2 đến FR-5 yêu cầu quản lý Lớp, Học sinh, chuyển từng em/chuyển cả lớp và Mẫu hóa đơn chung. | IA Admin phải có các khu vực: Lớp, Học sinh, Mẫu hóa đơn chung, Hóa đơn, Tài khoản nhận tiền, Báo cáo. Đặc tả trạng thái active/archived, studying/left và không hard delete. |
| Cao | Chuyển cả lớp | UX không đặc tả transfer một học sinh hoặc chuyển cả lớp; thay vào đó dùng enrollment. | FR-4 yêu cầu preview lớp đích và số học sinh đang học bị ảnh hưởng, confirmation rõ ràng, chỉ chuyển học sinh đang học; AD-9 yêu cầu idempotency cho whole-class transfer. | Bổ sung flow chuyển từng học sinh và dialog chuyển cả lớp với lớp nguồn/đích, số học sinh ảnh hưởng, xác nhận có tên và Operation reconciliation sau timeout. |
| Cao | Mẫu, dòng và trạng thái `DRAFT` | UX không nêu UI chỉnh sửa dòng hóa đơn: thêm/sửa/xóa/sắp xếp, dòng âm hoặc 0, tổng API authoritative; cũng không nêu trả `PENDING` về `DRAFT`. | FR-5, FR-7 và AD-6/7 quy định các hành vi này. `PENDING` khóa thanh toán; total phải lớn hơn 0 khi sang `PENDING`/`COMPLETED`. | Bổ sung template editor và invoice draft editor. UI hiển thị tổng từ API, cho phép dòng âm/0, kiểm tra tổng dương trước transition; chỉ `DRAFT` được sửa và có action đưa `PENDING` về `DRAFT`. |
| Cao | Tài khoản nhận tiền và snapshot | UX chỉ nói chọn active BankAccount trong flow và immutable payment instruction, nhưng không mô tả quản lý tài khoản, ngừng dùng, hoặc cách hiển thị tài khoản snapshot cũ. | FR-9 và AD-8: có thêm/kích hoạt/ngừng dùng, không xóa; chỉ account active chọn được ở DRAFT; account snapshot không hoạt động vẫn hiển thị ở PENDING/COMPLETED. | Bổ sung Bank Account management và quy tắc lựa chọn/hiển thị lịch sử. Không cho delete và không làm mất QR/hướng dẫn của invoice snapshot. |
| Cao | Báo cáo tháng | UX nêu report school-scoped, debt/prepayment/ledger nhưng không nêu chính xác báo cáo thu tháng. | FR-11 và AD-10: chỉ aggregate `COMPLETED`; tổng thu, tiền mặt, chuyển khoản, chuyển khoản theo từng bank-account snapshot; không CSV/Excel. | Đặc tả report theo `billingMonth`, số liệu server-returned và các breakdown bắt buộc. Bỏ debt/prepayment/ledger và export. |
| Trung bình | Xác thực và quyền | UX đề cập các session/capability/permission revoke đa vai trò, nhưng thiếu Google allowlist và bootstrap Admin cho dashboard. | FR-1 và AD-4: Google OAuth, normalized email trong `ADMIN_EMAILS`, session JWT cookie httpOnly; web gọi `GET /auth/me`; không đọc/lưu token JS; unsafe mutation có origin validation + double-submit CSRF. | Thay login/access UX bằng Google sign-in, từ chối email không allowlist, signed-out/unauthorized states. Không thiết kế token UI; mọi mutation phản ánh CSRF/session failure an toàn. |
| Trung bình | Idempotency và timeout | UX có reconciliation tốt nhưng áp dụng cho CollectionRun, attendance approval và các operation không có trong MVP; không liên kết đúng ba high-impact mutation. | AD-9: batch invoice creation, whole-class transfer và invoice completion dùng UUID `Idempotency-Key`/operation ID; timeout phải `GET /operations/:operationId` trước retry; invalidate React Query sau confirmed/reconciled result. | Giữ pattern reconcile nhưng chỉ áp dụng cho ba thao tác trên. UI cần giữ operation ID trước submit, khóa submit lại, hiển thị kết quả stored/replayed và chỉ retry sau khi đối soát. |
| Trung bình | Thông tin audit và snapshot | UX chỉ chạm đến immutable obligation, không yêu cầu hiển thị đủ audit tạo/hoàn tất và snapshot học sinh/lớp/tài khoản. | FR-6, FR-7, FR-8 và PRD NFR: lịch sử phải kiểm tra được Admin tạo, Admin xác nhận, thời điểm, số tiền và các snapshot. | Invoice detail ở mọi trạng thái cần hiển thị snapshot và audit thích hợp: creator/createdAt; confirmer/completedAt khi hoàn tất. Không đọc lại tên/lớp/tài khoản mutable để thay lịch sử. |
| Trung bình | Visual system và typography | DESIGN đặt display/heading là Be Vietnam Pro, mô tả multi-school branding và School accent. | PRD NFR bắt buộc body Inter, heading/branding Clash Grotesk; sản phẩm không có selected School identity. | Giữ Inter cho body/numeric nếu phù hợp nhưng đổi heading/branding sang Clash Grotesk. Xóa School logo/accent/context pattern; xây visual identity cho dashboard nội bộ Ánh Hoa. |

## Các yêu cầu UX còn thiếu cần bổ sung

### Điều hướng và màn hình

- Một App Shell Admin duy nhất, responsive cho desktop và điện thoại; không có phân tách portal hay chuyển audience.
- Đăng nhập Google, trạng thái email không nằm trong `ADMIN_EMAILS`, bootstrapping/loading `GET /auth/me` và logout/signed-out.
- Tổng quan phù hợp MVP: shortcut tới hóa đơn tháng, hóa đơn `DRAFT`/`PENDING` và báo cáo; không mô tả queue điểm danh.
- Danh sách/chi tiết Lớp với học phí tháng, active/archived và danh sách học sinh đang học.
- Danh sách/chi tiết Học sinh với họ tên, biệt danh tùy chọn, lớp hiện tại tùy chọn và studying/left; lịch sử invoice vẫn truy cập được khi inactive.
- Template editor cho một Mẫu hóa đơn chung: mô tả, nhóm thu tùy chọn, thứ tự và nguồn số tiền fixed/class monthly tuition.
- Invoice list/detail có lọc tối thiểu theo tháng/trạng thái/lớp khi cần vận hành; detail phân biệt rõ action được phép của `DRAFT`, `PENDING`, `COMPLETED`.
- Bank Account list/form với ngân hàng hoặc mã VietQR, số tài khoản, tên chủ tài khoản, active/inactive, không delete.
- Monthly report với bộ chọn tháng và bốn mức số liệu bắt buộc: total collected, cash, transfer, transfer theo bank-account snapshot.

### Ràng buộc và trạng thái tương tác

- Tất cả text UI bằng tiếng Việt theo Architecture Spine. Money là VND nguyên, format rõ ràng và API là nguồn authoritative; browser không hiển thị tổng client tính là kết quả chính thức.
- Form validation phía client chỉ hỗ trợ; hiển thị error shape API `{ error: { code, message, fieldErrors? } }` và `fieldErrors` sát trường tương ứng.
- Xử lý lỗi điều kiện: học sinh không có lớp active, học sinh left, lớp archived, account inactive, transfer thiếu account active, total invoice không dương khi issue/complete, và invoice đã tồn tại trong tháng.
- Dialog destructive/committing cho chuyển cả lớp và hoàn tất; với hoàn tất cần đầy đủ student, billing month, payment method và total trước khi xác nhận.
- Sau `COMPLETED`, loại toàn bộ affordance edit, return-to-draft, cancel, reopen, reversal hoặc refund; chỉ giữ detail/audit/report.
- Snapshot history luôn hiển thị dữ liệu đã chụp, bao gồm account inactive, không thay bằng dữ liệu nguồn đã thay đổi.
- Thiết kế accessible tối thiểu: keyboard/focus rõ, modal trap/return focus, trạng thái không chỉ dùng màu, bảng responsive không làm mất tiền/trạng thái và contrast đạt WCAG 2.1 AA.

## Các phần UX có thể giữ lại sau khi đổi phạm vi

Một số nguyên tắc lành mạnh và có thể tái sử dụng nhưng phải bỏ tất cả ngữ cảnh PassionEdu:

- Giao diện tài chính nghiêm túc, không dùng minh họa trẻ em trong bảng tiền hay dialog nguy hiểm.
- Status luôn có nhãn text và không chỉ phân biệt bằng màu.
- Amount VND căn phải, nguyên đồng và có hierarchy rõ.
- Server result là authoritative; timeout không được diễn giải là thất bại hoặc gửi lại ngay.
- Dialog không chồng lớp, có focus management và confirmation rõ cho action không thể đảo.
- Table giữ khả năng đọc trên màn hình hẹp bằng responsive cards hoặc horizontal scroll.

## Thứ tự xử lý khuyến nghị

1. Đổi metadata, tên sản phẩm, phạm vi actor và information architecture của cả hai UX document sang Anh Hoa Admin MVP; xóa toàn bộ Parent/Staff/Ops/multi-school/attendance/leave/ledger content.
2. Viết lại các luồng chính tương ứng UJ-1 đến UJ-4: thiết lập Lớp/Học sinh và chuyển lớp; batch invoice; review/edit/issue; QR + completion; monthly report.
3. Bổ sung state matrix cho invoice lifecycle, inactive records, snapshot history, API validation và idempotency/reconciliation của batch, whole-class transfer, completion.
4. Cập nhật design tokens/font từ Be Vietnam Pro sang Clash Grotesk cho heading/branding, giữ Inter cho nội dung; loại School-context component.
5. Kiểm tra lại mọi UX requirement với FR-1 đến FR-11 và AD-1 đến AD-10 trước khi nâng trạng thái tài liệu khỏi `draft`.

## Truy vết nguồn chính

- PRD 2.2, 6, 7.2: một Admin dashboard và các capability ngoài phạm vi MVP.
- PRD FR-2 đến FR-5: Lớp, Học sinh, chuyển lớp và Mẫu hóa đơn chung.
- PRD FR-6 đến FR-8: batch DRAFT, edit/issue PENDING và completion modal/COMPLETED read-only.
- PRD FR-9 đến FR-11: tài khoản nhận tiền, VietQR và báo cáo tháng.
- PRD NFR, mục 5: responsive, Admin-only, tiền VND nguyên, idempotency, audit và font.
- Architecture AD-4: Google cookie session, `GET /auth/me`, CORS/origin/CSRF.
- Architecture AD-5 đến AD-10: REST/API authority, preview, money format, invoice lifecycle/snapshot, active records, idempotency/Operation reconciliation và report snapshot projection.

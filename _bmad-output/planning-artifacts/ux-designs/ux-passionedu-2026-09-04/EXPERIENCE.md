---
name: PassionEdu
status: final
updated: 2026-10-06
sources:
  - ../../../specs/spec-passionedu/SPEC.md
  - ../../prds/prd-passionedu-2026-09-04/prd.md
  - ../../architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md
  - ../../sprint-change-proposal-2026-09-30-taxed-receivables-and-two-payment-channels.md
  - ../../sprint-change-proposal-2026-10-01-receivable-refund-price-and-leave-deduction.md
  - ../../sprint-change-proposal-2026-10-02-receivable-kinds-and-extracurricular-classes.md
  - ../../sprint-change-proposal-2026-10-06-unified-receivable-edit.md
  - ../../sprint-change-proposal-2026-10-06-promotion-assignment-picker.md
  - ../../sprint-change-proposal-2026-10-06-run-template-student-picker.md
  - ../../sprint-change-proposal-2026-10-06-extracurricular-class-receivable-edit.md
  - ../../sprint-change-proposal-2026-10-06-invoice-review-lines-first.md
  - ../../sprint-change-proposal-2026-10-07-invoice-lines-inline-edit.md
design: DESIGN.md
---

# PassionEdu - Experience Spine

## Foundation

Multi-surface web: Admin and Ops are desktop-first responsive PWAs; Teacher and Parent are mobile-first responsive PWAs. `DESIGN.md` owns visual identity; this document owns behavior. The four portals have separate sessions and never switch audience in one shell. Spines win on conflict with mockups.

## Information Architecture

| Surface | Audience | Purpose |
| --- | --- | --- |
| Ops School list and provision | Platform Operator | Create, suspend/reactivate School; bootstrap owner; never read School business data. |
| School chooser | Admin/Staff Home; Parent with multiple active Schools | Admin/Teacher select an authorized School only from Home before scoped work. Scoped Admin/Teacher pages show a read-only School context and return to Home to choose another. Parent with one active School enters its home directly; a Parent with no active StudentParent link is denied a Parent session. |
| Tổng quan | Admin | Tổng quan vận hành theo School/ngày, read-only: sĩ số/lớp, điểm danh do server trả về, trẻ đã được đón và đơn nghỉ; không là nơi mutation điểm danh, giờ đón hay nhật ký. |
| Danh bộ | School Admin | SchoolYear, Class, Student enrollment, Parent links, Staff assignments; `Lớp ngoại khóa` (Finance) nằm trong cùng nhóm điều hướng. |
| Chức danh | School Admin | Quản lý Chức danh School-scoped, capability catalog được phép và trạng thái; không tạo quyền tự do hay thay login binding/phân công Lớp. |
| Cấu hình trường | School Admin | Typed School, fixed workweek/holiday calendar, finance and attendance policy. The finance form has no School-level tax treatment field; tax is set per Receivable. Parent authorization is a server-enforced baseline, not a School setting. |
| Khoản thu / Ưu đãi / Đợt thu | Finance | Ba destination table-first cho catalog active/inactive, policy/version/Student assignment và CollectionRun. Mỗi list có filter phù hợp, phân trang, cột `Tùy chọn` cuối dòng và modal tạo/thay đổi quan trọng. Form khoản thu có `Giá / đơn vị (chưa VAT)` và select `Mức thuế suất` (`Không kê khai nộp thuế` mặc định, `Không chịu thuế`, `Thuế suất 0%`, `5%`, `8%`, `10%`); hint dưới select nêu `Thu vào tài khoản cá nhân` cho `Không kê khai nộp thuế` và `Thu vào tài khoản trường` cho mọi mức khác. Bảng catalog có cột `Thuế`. Form có `Giá hoàn trả / đơn vị (chưa VAT)` (mặc định 0, không lớn hơn giá thu; bằng giá thu là hoàn đủ) và bảng có cột `Giá hoàn trả`. Đổi mức thuế có audit và chỉ áp dụng cho dòng tạo/sửa sau đó; browser không gửi rate, VAT hay channel. Từ 2026-10-06 row menu chỉ có một `Chỉnh sửa` cho mọi trường (tên, đơn vị, nhóm, giá, giá hoàn trả, mức thuế suất) với lý do bắt buộc, lưu bằng một lệnh; bị từ chối thì không trường nào được lưu. Gán ưu đãi cho học sinh chọn từ bảng học sinh đang theo học (lọc lớp chính thức, tìm mã/tên, chọn tất cả đang hiện), khóa học sinh đã có ưu đãi chồng lấp; lựa chọn giữ qua các lần lọc. Phạm vi `Học sinh cụ thể` của khoản thu trong đợt thu dùng cùng bảng chọn (lọc lớp chính thức, tìm mã/tên, chọn tất cả đang hiện, `Đã chọn N học sinh`). Từ 2026-10-02 catalog có đúng ba nhóm cố định `Khoản thu cố định`, `Khoản thu linh hoạt`, `Ngoại khóa` (không tạo/đổi tên/ngừng nhóm) và Finance có màn `Lớp ngoại khóa` (`extracurricular-classes.html`) quản lý lớp ngoại khóa và thành viên; xem component `Receivable kinds and extracurricular classes`. Review/issue Invoice là deep destination theo Student, không phải sidebar item. |
| Thu tiền / Công nợ / Báo cáo | Finance | `Thu tiền` là hàng đợi Invoice `ISSUED` table-first theo School context, một dòng mỗi hóa đơn theo tài khoản nhận (Student có hai phần hiện trên hai dòng); Receipt close, settlement carry, promotional coverage, debt, correction and school-scoped report vẫn do API trả về. |
| Lương & Nhân sự | Payroll-enabled School Admin, Finance Manager Accountant | Employment terms, common payroll policy, machine-code mapping, file timekeeping review, payroll reconciliation, separated approval/payout and correction. “Kế toán” is a persona label for `FINANCE_MANAGER`, not a role. Hidden when the server does not grant Payroll entitlement and the action capability. |
| Teacher home / Class day | Teacher | Assigned-Class attendance, handover and daily-journal progress for the selected date. |
| Parent home | Parent | Today cards for authorized children, current daily journals, unread inbox badge and outstanding obligations. |
| Child detail | Parent | Daily attendance, current daily journals, leave requests, authorized obligations and snapshot instruction. |
| Parent inbox | Parent | 30-day attendance and confirmed-handover events; deep-link to authorized child/date. |

Admin/Staff navigation only shows capabilities the server grants. Parent child filters and content remain within the selected School; a child never persists visually after School switch or revoke. See `mockups/admin/admin-operational-queue.html`, `mockups/admin/finance-run-preview.html`, `mockups/admin/payroll-overview.html`, `mockups/admin/payroll-timekeeping-import.html`, `mockups/admin/payroll-run-review.html`, `mockups/admin/payroll-correction.html`, `mockups/parent/parent-home.html`, and `mockups/parent/parent-inbox.html`.

The desktop shell starts with a skip link, then `banner`, named `navigation`, contextual `main` and optional complementary queue/summary. The active navigation item uses `aria-current`; route change moves focus to the route `h1`. Bell, inbox item, sidebar link, stepper navigation and mock actions are buttons/links with names, never decorative text containers.

## Voice and Tone

| Situation | Say | Avoid |
| --- | --- | --- |
| Not recorded attendance | "Trường chưa ghi nhận" | "Vắng mặt" |
| Attendance present | "Đã ghi nhận có mặt" | "Con bạn an toàn" |
| Leave result | "Đang chờ duyệt" / "Đã duyệt" / "Đã từ chối" | Explaining internal deadline or approval mechanics |
| Timeout | "Đang kiểm tra kết quả với hệ thống" | "Thao tác thất bại, hãy gửi lại" |
| Revoked access | "Bạn không còn quyền xem nội dung này" | "Không tìm thấy dữ liệu" |
| Suspended School | "Trường này hiện đang tạm ngưng" | Global sign-out or ambiguous error |

Operational and management copy is direct, short and Vietnamese-first. Prefer task nouns and familiar actions such as `Thêm`, `Sửa`, `Lọc`, `Tìm kiếm`, `Trạng thái` and `Tùy chọn`. Daily Admin/Ops work communicates through columns, values, text status and labeled buttons, not instructional paragraphs. Do not show English terms, internal codes, API names, lifecycle labels or implementation detail by default; place an essential technical fact in a short help message, a disclosure or a protected audit/detail view only when the task requires it.

## Component Patterns

| Component | Use | Behavioral rules |
| --- | --- | --- |
| School context and Home return | Admin/Staff, Parent | Visible School name is mandatory. Admin/Teacher scoped pages use read-only context and an explicit Home return; Parent retains its chooser behavior. On dirty form or pending/uncertain mutation, a leave-workspace guard offers remain, discard before submit, or reconcile Operation. No auto-save draft. |
| Tổng quan theo ngày | Admin | Dải chỉ số ngắn và bảng theo lớp hiển thị sĩ số, đã có mặt, nghỉ có đơn, đã được đón và trạng thái chưa đến lớp. Count/nhãn/date context là dữ liệu server, không optimistic hay tự tính trên browser. Hôm nay chưa có `PRESENT`/`ABSENT` xác nhận là `Chưa đến lớp`; ngày quá khứ `ABSENT` xác nhận không có đơn duyệt là `Nghỉ không phép`, còn không có bản ghi là `Chưa ghi nhận`. Card nghỉ có đơn mở danh sách đơn với filter URL-backed. |
| SchoolYear setup | School Admin | Creates one active SchoolYear through a named confirmation. Class, Student, pending Parent link and Staff assignment forms show effective date and server validation; Staff profile never implies a login grant. |
| Chức danh | School Admin | Workspace desktop table-first luôn nêu rõ Trường đang chọn ở heading/caption. Bảng có `Tên chức danh`, `Mã`, `Trạng thái`, `Số nhân sự`, `Khả năng thao tác` và `Tùy chọn`; capability hiển thị bằng nhãn tiếng Việt ngắn do server trả về, không dùng raw JSON hay mã kỹ thuật. Có tìm kiếm/lọc trạng thái, phân trang và nút `Thêm chức danh`; card chỉ dùng cho tóm tắt, ngoại lệ hoặc xác nhận. Tạo/Sửa dùng tên, mã và checkbox capability từ catalog Platform được server cho phép, nhóm theo khu vực vận hành; không có ô nhập quyền tự do, tạo capability mới, hoặc capability Platform/Parent/Ops. Tên chức danh chỉ để nhận biết, không mô tả hay chứng minh quyền thực thi. |
| Tạo, sửa và ngừng áp dụng Chức danh | School Admin | Form hiển thị Trường đang chọn, label/help/error cạnh từng trường và error summary được focus khi server từ chối; focus vào heading khi mở route và quay lại control khởi phát khi đóng dialog. Lưu là thao tác có thể đối soát: trong lúc chờ hoặc timeout khóa gửi lặp, nêu “Đang kiểm tra kết quả với hệ thống” và chỉ cho thử lại sau khi đối soát Operation. `Ngừng áp dụng` là xác nhận có tên Chức danh, bắt buộc lý do audit và nêu rõ Staff đang gán sẽ mất capability ở yêu cầu kế tiếp; không xóa Chức danh có Staff hoặc lịch sử. Thành công làm mới bảng theo dữ liệu server; lỗi giữ nguyên input và không hiển thị trạng thái local như đã lưu. |
| Evidence setting | School Admin | Shows separate `Bắt buộc`/`Tùy chọn` settings for an image when Teacher records `PRESENT` and when Teacher confirms handover. Confirmation and Operation reconciliation refresh the server-confirmed setting; no cutoff, grace or free-form policy appears. |
| School holiday calendar | School Admin | Default schedule is read-only: Monday through Saturday, with Sunday non-operating. Add a named inclusive holiday range only through a server-validated Operation; overlap/order errors retain input, and audit/history never rewrites calendar snapshots, attendance, leave or Finance facts. |
| Roster transition wizard | School Admin | Preview -> confirm -> Operation reconciliation. Source history stays visible; records excluded by server cannot be force-moved. |
| CollectionRun list and detail | Finance | `Đợt thu` mở bằng monthly-run table-first tại `/collection-runs`; `Tạo đợt thu` dùng dialog nêu rõ tạo mới hay mở run đã có. Mở một dòng đi tới `/collection-runs/:runId`, nơi detail giữ template, Student và Invoice tables cùng Back về list context. Changing template/catalog/policy/version/target/assignment requires a new server preview. Generate snapshots common template plus applications; Student thêm sau khi đã tạo hóa đơn dùng snapshot run, không đọc template/catalog live. Detail header hiện step indicator `Nháp → Sẵn sàng tạo hóa đơn → Đã tạo hóa đơn → Đã đóng` với `aria-current="step"` theo server status (không điều hướng, không chuyển trạng thái) và hàng số liệu từ server `summary`: đủ điều kiện/bị bỏ qua/cần thu dự kiến khi đã xem trước hoặc READY; hóa đơn/đã phát hành/tổng phải thu khi GENERATED/CLOSED; browser không cộng tiền. READY hiện template đã chốt. GENERATED hiện thông báo kết quả tạo thay cho bảng Student trùng lặp; `Thêm học sinh` là dialog. Từ 2026-10-02 bảng `Khoản thu trong đợt` có cột `Loại` và `Áp dụng cho`, và detail có khu `Lớp ngoại khóa trong đợt` (component `Receivable kinds and extracurricular classes`). |
| Receivable kinds and extracurricular classes (2026-10-02) | Finance | **Khoản thu:** catalog nhóm theo ba nhóm cố định `Khoản thu cố định` (học phí, tiền ăn), `Khoản thu linh hoạt` (dã ngoại…) và `Ngoại khóa` (tiếng Anh, võ, vẽ); không có nút tạo, đổi tên hay ngừng nhóm. Form khoản thu chọn nhóm từ ba loại; đổi loại của khoản đã dùng trên hóa đơn hoặc gắn lớp ngoại khóa hiện lỗi server. **Lớp ngoại khóa** (`extracurricular-classes.html`, nhóm điều hướng `Danh bộ`, cùng mẫu trang Danh bộ: route-head, filter, bảng, detail, dialog): bảng table-first theo SchoolYear với `Tên lớp`, `Khoản thu` (chỉ khoản loại Ngoại khóa đang hiệu lực; nhiều lớp được chọn cùng một khoản, cùng giá), `Số học sinh`, `Trạng thái`, `Tùy chọn`. Detail lớp liệt kê thành viên với `Từ ngày`/`Đến ngày`; `Thêm học sinh` chọn nhiều Student từ một lớp chính thức, nhập ngày hiệu lực và một lý do chung; `Kết thúc tham gia` (đơn lẻ hoặc hàng loạt, ở thanh chọn ngay trên bảng) nhập ngày kết thúc và lý do. Từ 2026-10-06: header detail chỉ có tên lớp, dòng phụ gồm badge trạng thái, năm học, khoản thu kèm giá và nút nhỏ `Sửa giá`; nút `Chỉnh sửa` mở một dialog sửa tên lớp và khoản thu (khoản Ngoại khóa đang áp dụng, hint `Dùng chung với`) kèm lý do; `Sửa giá` mở đúng dialog `Chỉnh sửa khoản thu` của trang Khoản thu, dialog này liệt kê `Đang dùng cho N lớp ngoại khóa`. Đổi khoản thu hoặc giá không rewrite hóa đơn đã tạo và đòi xem trước lại đợt thu nháp. Chồng thời gian trong cùng lớp, Student khác School/SchoolYear hiện lỗi server theo hàng; mutation có Operation reconciliation. Không có giáo viên, lịch học, điểm danh hay hiển thị Parent. **Đợt thu:** khi mở đợt mới, `Khoản thu trong đợt` đã có sẵn mọi khoản cố định đang hiệu lực, số lượng 1; Finance sửa số lượng hoặc bỏ dòng khi Nháp. Các bảng trên trang chỉ đọc kèm thao tác dòng; mọi thao tác mở modal: `Thêm khoản thu` và `Sửa` dùng cùng modal (khoản, số lượng, phạm vi), `Bỏ` và `Loại khỏi đợt này`/`Khôi phục` qua dialog xác nhận. `Thêm khoản thu` chỉ liệt kê khoản linh hoạt và bắt buộc chọn `Áp dụng cho`: `Toàn bộ`, `Lớp` (chọn nhiều lớp chính thức, theo lớp hiệu lực ngày đầu tháng) hoặc `Học sinh` (chọn nhiều). Bảng có cột `Loại`, `Áp dụng cho`, `Số học sinh` và `Tạm tính` do server trả; khoản cố định luôn `Toàn bộ`; khoản Ngoại khóa không thêm được vào bảng. Khu `Lớp ngoại khóa trong đợt` liệt kê lớp ngoại khóa đang hiệu lực với khoản thu, đơn giá và số học sinh hiệu lực trong tháng; Finance `Loại khỏi đợt này`/`Khôi phục` cả lớp khi Nháp. Ghi chú đặt cuối trang trong `Hướng dẫn` thu gọn, nêu rõ chỉ học sinh đủ điều kiện và được chọn mới có dòng ngoại khóa, không tự tính theo ngày. Mọi thay đổi khoản, phạm vi, lớp hoặc thành viên đòi xem trước lại. **Rà soát hóa đơn:** bảng dòng có cột `Nguồn` (`Cố định`, `Linh hoạt · <phạm vi>`, `Ngoại khóa · <lớp>`, `Sửa tay`); dòng ngoại khóa có cờ `Vào/nghỉ giữa tháng` hoặc `Chuyển lớp trong tháng` (status badge có chữ) để kế toán điều chỉnh số lượng/giá với lý do theo workflow audit hiện có. Học sinh chuyển giữa hai lớp dùng chung khoản chỉ có một dòng, `Nguồn` liệt kê cả hai lớp. Preview/kết quả generate liệt kê học sinh bị bỏ qua vì `Không có khoản thu áp dụng` (`NO_APPLICABLE_LINES`); template rỗng không tự chặn generate. Thêm học sinh sau khi đã tạo hóa đơn dùng cùng quy tắc: khoản cố định, khoản linh hoạt nếu thuộc phạm vi, dòng ngoại khóa nếu có thành viên hiệu lực trong tháng; dialog thêm học sinh hiển thị trước các dòng sẽ tạo do server trả về. |
| Invoice review and issue | Finance | DRAFT review is contextual after CollectionRun và giữ originating server list/query/order. Finance may add/remove active catalog line or make an audited allowed base-price exception, then requests server refresh; it cannot edit policy-derived discount. The screen discloses server gross, policy/version, discount and net per line. Khi có adjacent item server-authorized, hành động `Học sinh trước`/`Học sinh tiếp theo` xuất hiện; sau save/issue, UI hiện kết quả rồi người dùng chủ động chọn item tiếp theo, không tự nhảy. Invoice review là route `/collection-runs/:runId/invoices/:invoiceId` theo `invoice-detail-review.html` (bố cục theo `sprint-change-proposal-2026-10-06-invoice-review-lines-first.md`): bảng dòng hóa đơn hiện trước, toàn chiều rộng như bảng tính, từ 2026-10-07 (`sprint-change-proposal-2026-10-07-invoice-lines-inline-edit.md`) số lượng, đơn giá và `Bớt` (số lượng × giá hoàn) nhập ngay trên dòng, lý do hiện ở hàng phụ dưới dòng khi cần, số dự kiến do lệnh tính thử của server trả về hiện in nghiêng, thanh `Hoàn tác`/`Lưu thay đổi` lưu mọi dòng trong một Operation; cột cuối chỉ còn `Nguồn` và `Xóa`; lý do ưu đãi dưới số tiền ưu đãi; `Thêm dòng` ở tiêu đề bảng mở hộp thoại; chi tiết phiếu thu gồm `Phần 1 · Thu vào tài khoản trường` (dòng có thuế, dòng `Thuế GTGT x%` server-calculated sau giảm trừ, tổng phần) và `Phần 2 · Thu vào tài khoản cá nhân` (dòng không kê khai, tổng phần) cùng tổng cần thu; một phần không có dòng thì không hiện. Panel rà soát trước khi phát hành nằm dưới bảng, các phần đặt cạnh nhau: tài khoản trường đang hiệu lực hiển thị read-only và tự áp dụng cho phần 1; select tài khoản cá nhân cho phần 2 được chọn sẵn theo `Tài khoản thu mặc định` của lớp, Finance có thể đổi sang tài khoản cá nhân đang hiệu lực khác. `Phát hành phiếu thu` phát hành cả hai hóa đơn trong một Operation; thiếu tài khoản trường (khi có phần 1) hoặc tài khoản cá nhân (khi có phần 2) hiện lỗi server và không phát hành phần nào; reload/bookmark fetch lại Invoice được ủy quyền, bị từ chối thì về run kèm thông báo server; `Quay lại đợt thu` về run detail giữ list context. |
| Daily receipt queue | Finance | `Thu tiền` mặc định hiển thị Invoice `ISSUED` bằng table-first, một dòng mỗi hóa đơn theo tài khoản nhận: cột `Học sinh`, `Lớp`, `Tháng`, `Tài khoản nhận` (`Tài khoản trường`/`Tài khoản cá nhân`), `Còn phải thu`, `Trạng thái`, `Tùy chọn`; Student có cả phần tài khoản trường và phần tài khoản cá nhân hiện trên hai dòng. Filter SchoolYear/tháng/lớp/mã hoặc tên Student, server sort/cursor/pagination ổn định và row menu. Receipt được ghi riêng cho từng hóa đơn (row menu của dòng đó); ghi một hóa đơn không đổi hóa đơn kia và chênh lệch chỉ carry sang hóa đơn cùng tài khoản kỳ sau. Receipt dialog có tiêu đề `Ghi thực nhận cho <tên> · Tài khoản trường|cá nhân`, nêu mã hóa đơn và tài khoản, chỉ nhận actual VND, hiện context/outcome/difference/carry/coverage server-returned, reconciles Operation before retry và chỉ sau terminal result mới cho mở `Hóa đơn tiếp theo`. |
| Promotion policy and debt transfer | School Admin, Finance | Pha 1b quản lý policy/version `DRAFT -> ACTIVE -> RETIRED`, một hoặc nhiều Receivable target cùng School, fixed-VND/percentage, priority/exclusivity và Student assignment có interval/reason/audit. Version active chỉ thêm/kết thúc assignment, không sửa cấu hình. Finance có thể gán batch nhiều Student cùng interval/lý do; lỗi một Student từ chối toàn batch và trả lỗi theo hàng. `PREPAID_COVERAGE` selection after offline Parent agreement and debt transfer remain later Finance settlement enhancement. |
| Student promotion coverage | School Admin, Finance | Finance settlement enhancement after the Finance Admin MVP provides back-office review of policy-version-derived Student/SchoolYear receivable-period facts, service intervals, snapshot price/discount/calendar, overlap/eligibility and waiting-for-`EXACT`-close state. Coverage is issued by the server only after the selected monthly-run Invoice closes `EXACT`; no direct create action exists. Parent has no policy catalog, assignment, request or selection action. |
| Ledger correction dialog | Finance | Names source amount and impact. Existing posting is never editable. Với policy `DIRECT`, School Admin hoặc Finance Manager được cấp quyền xác nhận và post ngay sau named confirmation. Với `SCHOOL_ADMIN_APPROVAL`, Finance Manager tạo request, requester không thấy approve action và School Admin khác người tạo mới approve/refuse. Cả hai nhánh dùng Operation reconciliation. |
| Finance report | Finance | Bon workspace read-only: tong quan Finance, doi soat CollectionRun, cong no/prior debt, va so cash/adjustment. Chi Finance Manager/School Admin duoc cap quyen trong School context moi thay destination. Moi ket qua hien `asOf`, generated time, timezone, filter va definition version do server tra; filter theo SchoolYear, ky/billing month, run, lop, nhom/khoan thu va status khi phu hop. Drill-down chi mo Invoice/Receipt/refund/reversal/difference/carry/coverage source ma actor da duoc cap quyen. CSV la export duy nhat: nut tai chi xuat hien sau result, tai dung rows va metadata server-returned, va failure/expiry/revoke quay ve report safe state. Khong co period close/reopen, scheduled/custom report, PDF/XLSX hay Payroll report. Từ 2026-10-01 (yêu cầu người dùng) mỗi workspace mở đầu bằng 4 thẻ số liệu chính và biểu đồ trực quan (phải thu/đã thu theo tháng, cầu nối tổng phải thu → phải thu ròng, thu theo lớp, trạng thái hóa đơn, công nợ theo thời gian quá hạn, tiền vào theo tuần), có tooltip và `Xem dạng bảng`; bảng chi tiết đặt bên dưới. Metadata kết quả (`asOf`, bộ lọc) chỉ là một dòng chú thích `Số liệu chốt …`; timezone và phiên bản định nghĩa nằm trong CSV, không hiển thị thành thẻ riêng. Nhãn dùng tiếng Việt nghiệp vụ (`Chênh lệch chờ chuyển kỳ sau`, `Nợ kỳ trước`, `Gói nộp trước`, `Đảo phiếu thu`) thay cho thuật ngữ kỹ thuật. |
| Payroll entitlement state | Platform Ops, School Admin, Finance Manager Accountant | Payroll navigation and destinations remain absent without entitlement and the route capability; deep links/jobs are denied server-side before record disclosure. `PILOT_ENABLED` carries “Đang thử nghiệm”; `SUSPENDED`/`RETIRED` deny new work and retain only authorized historical read/export. Entitlement never grants role/capability. |
| Employment terms | School Admin, authorized Finance Manager Accountant | Management table separates base/probation salary, insurance contribution base and fixed allowances. Every change has effective date; a value referenced by a calculated Payroll version is visible as history, not inline-editable. |
| Timekeeping import and review | Finance Manager Accountant, School Admin | Upload -> preview -> resolve machine-code mapping/row errors -> commit -> review workdays/late-care -> calculate. Each action is capability-gated. Source name is comparison aid only; committed raw events are immutable and manual correction requires reason. |
| Payroll reconciliation | Finance Manager Accountant | A `FINANCE_MANAGER` with prepare/reconcile capability sees the server version, components/source snapshots, adjustments and submit action. After submit the view is read-only until a different-identity School Admin decides. |
| Payroll approval and payout | School Admin, Finance Manager Accountant | Only a different-identity School Admin with `PAYROLL_APPROVE` sees approve/refuse; the submitter never does even through another grant. School Admin with `PAYROLL_REOPEN` may reopen approved unpaid work. After approval only Finance Manager with `PAYROLL_PAYOUT_CONFIRM` sees payout confirmation naming Staff/count, total, method and reference. |
| Payroll correction | Finance Manager Accountant, School Admin | Finance Manager prepares/submits from a paid source version; a different-identity School Admin approves/refuses; Finance Manager confirms resulting payout. Original paid Payroll remains read-only and every step uses Operation reconciliation. |
| Management list | Admin/Staff, Ops, Finance | Default pattern for comparable records: concise Vietnamese column labels, search/filter/sort, explicit pagination, text status and a final `Tùy chọn` menu. The menu follows the roster `...` keyboard behavior and only contains actions permitted by the server-returned state. A compact summary may precede the table only when it helps prioritize work. Technical identifiers and verbose policy explanations remain outside the default row surface. |
| Attendance entry | Teacher | Requires evidence before `PRESENT` when its setting requires it. Calendar/leave conflicts show server result and do not let the user override locally. |
| Handover entry | Staff có capability | Records server-validated picked-up time for one Student in the selected School and requires evidence when its setting requires it. `HANDOVER_WRITE` áp dụng toàn Trường: UI không đòi hoặc suy diễn phân công Lớp, nhưng mỗi submit vẫn để server xác nhận Staff/binding/Chức danh đang hiệu lực, School, Student enrollment, ngày, policy và evidence. Missing capability, binding/Chức danh bị thu hồi, correction/error shows no action or refreshes server state. It is explicitly labeled operational reference, never pickup authorization or automatic fee calculation. |
| Daily journal editor | Teacher | One current journal per Student/date in an assigned Class. Same-day edits create audited versions. Multi-image upload accepts only JPEG/PNG/WebP up to 10 MB per file; UI does not set Parent-visible state until server confirms. |
| Daily journal | Parent | Shows only the current authorized text and protected images of one child/date within retention. It never shows Teacher identity, journal versions/audit, Class facts or attendance evidence. |
| Service, short leave and preservation | School Admin, Finance, Parent | Finance manages extracurricular applicability through `Lớp ngoại khóa` and its effective-dated memberships (component `Receivable kinds and extracurricular classes`, 2026-10-02); there is no separate service-enrollment screen. Parent creates short leave for an authorized child; School Admin/Finance Manager with capability decides pending late leave and Parent sees only its own result. Only School Admin uses the roster preservation transition after direct agreement; there is no Parent long-leave form or automatic fee/reduction UI. |
| Thu/Bớt, settlement Invoice and payout (2026-10-01) | Finance | Mỗi dòng khoản thu trên DRAFT hiện `Thu` (số lượng x đơn giá) và `Bớt` (số lượng x giá hoàn trả) cùng dòng; `Bớt` do server đề xuất từ ngày nghỉ có phép tháng trước, hiện ngày đã đếm; từ 2026-10-07 số lượng và giá hoàn trả sửa ngay trên dòng, lý do khi khác đề xuất và `Dùng số đề xuất` ở hàng phụ dưới dòng. Ưu đãi hiển thị nhãn `Ưu đãi`, không dùng `Giảm trừ`. Run detail có mục `Cần quyết toán` cho học sinh nghỉ học tháng trước; `invoice-settlement-review.html` hiện hóa đơn quyết toán theo kênh với `Bớt` tiền ăn và `Hoàn học phí nộp trước` (đã nộp, giá gốc x tháng đã học, đã hoàn trước đó, VAT hoàn), tổng âm hiển thị `Trường hoàn lại cho phụ huynh`, phát hành không có VietQR. Thu tiền có lọc `Cần chi hoàn` và hộp `Ghi nhận đã chi` (số tiền read-only, ngày chi, hình thức, mã giao dịch). Ảnh phiếu hoàn tiền theo `invoice-refund-image.html`. Standalone promotional refund review below is superseded for withdrawal by the settlement Invoice. Amendments A1, A3, A4: form and `Sửa bớt` refuse a refund price above the charged price (`Giá hoàn trả không được vượt đơn giá`); a monthly (non-settlement) DRAFT whose total is below zero shows `Tổng âm: tiền thừa X đ không hoàn ngay mà trừ vào hóa đơn tháng sau. Hóa đơn tự đóng khi phát hành.` and issues normally; only settlement Invoices become refund notices; the standalone refund request review is removed. |
| Adjustment, carry and promotional refund review | Finance | Shows immutable source, target DRAFT Invoice or no/issued/cancelled target outcome, server-returned negative amount and refund path. A settlement difference shows the closed source Invoice/Receipt, remaining amount and the next-run carry adjustment outcome; Finance cannot alter or manually reapply it. Promotional withdrawal/transfer refund shows coverage fact/Invoice/Receipt, service interval, calendar version, operating days used/remaining, calculated amount and remaining paid-source limit; editable approved amount is non-negative, cannot exceed that limit and needs a reason when overridden. |
| Suspend/reactivate dialog | Platform Operator | Names School, current status and result of the next-request block. Requires confirmation, uses Operation reconciliation on timeout, and never offers business-data access after completion. |
| Today card | Parent | One per authorized child. Opens child attendance and daily journal for today. Status text is always explicit; `NOT_RECORDED` is neutral. |
| Attendance history | Parent | Date-first list; each entry contains only allowed child snapshot, date, status and update time. No Staff, reason, media or class content. |
| Leave request | Parent | Create from child detail when server-authorized; edit/cancel only `PENDING`. Result is pending/approved/rejected without deadline explanation. |
| Parent inbox | Parent | Bell badge counts unread in-app events. Events retain 30 days, mark read on open, and deep-link to the authorized child/date. Attendance events show the permitted attendance facts; handover events show only confirmed picked-up time. Revoked/ineligible event data disappears. Active StudentParent, revoke and retention are server-enforced, never configured by School Admin. |
| Issued Invoice payment image | Finance | On an issued payment notice with an unsettled part, the review route replaces `Rà soát trước khi phát hành` with `Thanh toán`: due date, then one block per part (`Phần 1 · Tài khoản trường`, `Phần 2 · Tài khoản cá nhân`) with obligation code, own status badge (`Chưa thu` or the Invoice status), part total, bank, account number and holder (no receipt action here; receipts are posted from the `Thu tiền` queue); then `Tổng cần nộp` for the notice and transfer content on one row, then `Xem ảnh hóa đơn` (dialog with the server PNG and `Tải ảnh hóa đơn`) and primary `Tải ảnh hóa đơn`, per `invoice-detail-review.html#issued`; the panel sits below the line tables, parts side by side, and the PNG is requested only when viewed or downloaded. The PNG (`invoice-payment-image.html`) is rendered by the API from the issue snapshots with one section per unsettled part (lines, VAT, part total, bank and a VietQR whose amount equals that Invoice obligation total) and `Tổng cần nộp (2 lần chuyển khoản)`; a settled, transferred or zero part is omitted, so a single remaining part renders one QR; Finance sends it to the Parent outside the system. Transfer content is `<Student name> <Class name>` without diacritics, max 50 characters. No email/send action, bulk download or Parent access in this release. |
| BankAccount create | Finance / School Admin | `Ngân hàng nhận` is a required select box from the server VietQR list (`Short name - Full name`, value = BIN); no free-text bank name. `Loại tài khoản` is required: `Tài khoản cá nhân (khoản không kê khai)` or `Tài khoản trường (khoản có thuế)`. `Tài khoản nhận tiền` shows two sections, `Tài khoản trường (khoản có thuế)` and `Tài khoản cá nhân (khoản không kê khai)`; at most one School account is active, and activating a second is refused until the current one is deactivated. |
| Class default receiving account | School Admin / Finance | The class table in `Năm học và lớp` has a `Tài khoản thu mặc định` column (bank · •••• last4 with holder on a second line, or `Chưa chọn`). Each active class row has a `Tài khoản thu` action that opens the dialog `Tài khoản thu mặc định · <tên lớp>` with a select (`Chưa chọn` + active personal BankAccounts of the same School as `Bank · •••• 2088 · HOLDER`), help text and `Hủy` / `Lưu tài khoản thu`; the `Thêm lớp` create form has no account select. The default pre-fills the personal part at issue. The roster transition does not create or carry over Classes, so each Class of a new SchoolYear sets its own default; without a default, Finance picks a personal account at issue. A deactivated default is ignored at issue and flagged on the Class. |
| Payment instruction | Parent | Read-only snapshot text for the current effective obligation: obligation code, period, issued Invoice total snapshot, server-returned actual receipt/outcome/current outstanding, current state, update time, receiving bank, account number, account-holder name and transfer content. The two channel Invoices of one payment notice are listed together, each with its own receiving account and state. A cancelled source is not payable; the replacement is shown as the effective obligation without internal correction reason or transfer detail. No “I paid” action; VietQR/copy/deep links are not part of this release. |

## State Patterns

| State | Treatment |
| --- | --- |
| Cold load | Skeleton matches the destination layout; never shows stale content from another School. |
| No authorized Parent data | Gentle `{components.illustration-panel}` empty state with signed-out/safe next action; no child names remain. |
| No attendance on a working day | `NOT_RECORDED` text label and update context; never infer absence. |
| Holiday / non-operating date | Date history labels the calendar status instead of implying missing attendance. The server calendar uses the fixed Monday-Saturday schedule and confirmed inclusive School holiday ranges. |
| Permission denied / revoke / `401` | Clear protected memory, close sheets/dialogs, then route Admin/Teacher to Home chooser, Parent to its safe chooser, or signed-out state. |
| School suspended | Keep identity session; replace School content with suspended explanation and Home return for another authorized Admin/Teacher School. |
| Validation error | Error summary receives focus and links to fields; `fieldErrors` appear adjacent to the field. |
| Mutation timeout | Disable repeat submit, show reconciliation state, request Operation result before retry is offered. |
| Operation completed with skips | Result screen lists created/skipped categories and links to affected filtered records. |
| Evidence unavailable after retention | Staff/Admin sees audit-safe "Tệp bằng chứng đã hết hạn" for attendance or handover evidence; Parent never sees this state. |
| Offline | Read-only chrome may remain, but protected Parent API data is never service-worker cached. Mutations show offline state and do not pretend to queue or complete. |
| Provision failure | Ops shows no partial School/owner success. The failed form remains editable with field/action error; retry is explicit. |
| Roster transition conflict | Wizard preserves server preview, names records that cannot move and blocks confirmation until a new preview succeeds. |
| Finance lifecycle conflict | Draft/issue/correction/cancel/close/carry actions refresh server state and explain why the action is unavailable; no local state override. |
| No report data | Report retains School, period and filter context and says no ledger activity matches; it does not show zero as a confirmed collection result without an as-of context. |
| Report/export unavailable | Giữ School/filter/as-of đang xem, nêu rõ không còn quyền, file đã hết hạn hoặc dữ liệu đã đổi sau `asOf`; không tạo CSV ở browser, không tự chuyển School hay thay kết quả bằng tổng live. |
| Handover unavailable | Missing permission, required evidence, already-recorded state or validation error names the reason and refreshes the child/day record; no late-fee suggestion appears. |
| Position unavailable | Khi Chức danh inactive, capability bị thu hồi hoặc Staff/binding không còn hiệu lực, xóa dữ liệu protected đang mở trước khi nêu trạng thái an toàn; không suy diễn quyền từ tên Chức danh, cache hoặc trạng thái browser. |
| Daily Admin overview | Shows selected School/date and server-returned loading, error or no-authorized-data state; it never substitutes zero for an unresolved state or offers attendance/handover mutation. |
| Parent inbox empty | Bell opens "Chưa có thông báo trong 30 ngày gần đây." |
| Policy conflict | Form keeps active and proposed effective-dated values visible, focuses server validation, and does not claim policy changed until confirmed. |
| Adjustment unavailable | Finance sees source reason and target state such as no eligible DRAFT Invoice, issued or cancelled; no manual fallback is implied. |
| Payroll not enabled | Do not render Payroll navigation or an empty data screen. Direct/deep link explains "Trường này chưa được bật tính lương" and offers a safe School context action; no record detail is revealed. |
| Payroll pilot | A restrained text badge "Đang thử nghiệm" appears near the route heading. It does not imply reduced authorization, audit or correction requirements. |
| Timekeeping review required | Batch summary names unresolved machine codes and row errors; calculate is unavailable until server reports review completion. Source display name mismatch is shown as comparison context, never as a selectable identity. |
| Payroll calculation conflict | Keep the returned version/source time visible. Recalculate creates a new draft version; no row total changes optimistically in the browser. |
| Payroll awaiting approval | Finance Manager submitter sees read-only summary. Only a different-identity School Admin with `PAYROLL_APPROVE` sees approve/refuse; the server rejects same-identity approval across grants. |
| Payroll approved unpaid | Components/source facts are locked. School Admin with `PAYROLL_REOPEN` sees reopen; Finance Manager with `PAYROLL_PAYOUT_CONFIRM` sees payout. Neither action is inferred from entitlement or the other role. |
| Payroll paid | Original version is read-only. Payout date/method/reference and any correction links are visible; reopen is absent. |
| Payroll correction | The original paid version remains visible as source. Correction shows signed delta, reason, approval/payout state and no affordance to alter the original. |
| Suspend/reactivate timeout | Ops shows reconciliation and disables duplicate action; School list refreshes from server before another action. |

### Finance Lifecycle States

| Server state | Visible facts | Permitted UI actions | Locked/unavailable treatment |
| --- | --- | --- | --- |
| CollectionRun `DRAFT` | Editable SchoolYear, billing month and Student selection; template preloaded with fixed receivables, flexible lines with `Áp dụng cho`, and `Lớp ngoại khóa trong đợt` with member counts | Edit, change quantity/remove fixed lines, add scoped flexible lines, exclude/restore an extracurricular class, preview | Generate is unavailable until server accepts `READY`. |
| CollectionRun `READY` | Server preview of eligible/selected Students and skips | Return to edit, final-confirm generate | Student selection change returns to `DRAFT`; client cannot alter preview result. |
| CollectionRun `GENERATED` | Locked generated-Student result | Review DRAFT Invoice; add eligible Student without an Invoice | Existing Invoice selection cannot edit; only server permits eligible addition. |
| CollectionRun `CLOSED` | Final run summary | Read/filter/report | Create/edit is unavailable with server explanation. |
| Invoice `DRAFT` | Editable catalog lines, positive quantity, authorized price override and explanatory reason; lines grouped per payment channel with server VAT per line; `Nguồn` column and server mid-month/class-change flags on extracurricular lines | Add/edit/remove line (a line goes to the Invoice of its receivable channel), review the read-only School account, choose the personal account (Class default pre-selected), issue both channel Invoices of the notice at once | Server blocks inactive/wrong-School receivable, zero/invalid price or quantity, missing School or personal account for a present part, and lifecycle conflict. |
| Invoice `ISSUED` | Immutable obligation/Payment instruction snapshot and outstanding; while unsettled, panel `Thanh toán` with payment details and the server image preview | Read, `Tải ảnh hóa đơn` (while any part is unsettled), record one actual Receipt per channel Invoice or prepare correction | Content edit and BankAccount change are unavailable. Download failure keeps text payment details and offers retry; download never changes state. |
| Invoice `CLOSED` | Server-confirmed actual Receipt and exact/shortfall/overpayment outcome | Read; permitted refund/reversal workflow | UI never lets client set receipt, outcome or carry; difference stays source-linked. |
| Invoice `CANCELLED` | Replaced source snapshot | Read limited audit/reference | It is not payable and only the replacement is Parent-effective. |
| No outstanding | Settlement summary | Read history | Parent Payment instruction action is hidden; no payment invitation remains. |
| Reversal/refund `DIRECT` | Source, reason, server-returned impact and current policy | Authorized School Admin/Finance Manager posts after named confirmation | Promotional refund shows calculated/approved amount and required override reason; Operation reconciliation refreshes ledger and source remains immutable. |
| Reversal/refund pending | Source, reason, required approver and current request state | Requester views/cancels only if server permits; different School Admin approves in `SCHOOL_ADMIN_APPROVAL` policy | Promotional refund also shows calculated/approved amount and required override reason; request creator never sees approve action; refusal/approval refreshes ledger. |

## Interaction Primitives

- Desktop tables support keyboard row navigation, sort/filter controls and explicit pagination; mobile uses cards or horizontal table scroll with identifying columns retained.
- Management tasks with comparable records use a table first. Cards support summaries, confirmations, exceptions and non-tabular decisions; they do not replace a list merely to explain each record.
- A daily operational detail replaces its landing header/actions with a single contextual title and Back action. Do not leave create/configure actions visible when they cannot act on the selected record.
- Keep table cells scannable: one primary value, short secondary context only where necessary, and a labeled button/link for the next task. Put long explanation, source provenance and audit identifiers behind a disclosure or destination view.
- Dialogs trap focus, restore focus to their trigger, have one obvious dismiss path and never stack. Create/change with financial effect, destructive, issue, settlement, reversal and discard actions require a named confirmation.
- Add/edit modals on desktop use horizontal field rows (paired fields such as name + code, quantity + price, date + reason; scope and group choices as compact chips) so the form fits without scrolling; they collapse to a single column on narrow screens.
- Trước khi rời workspace School-scoped từ form Chức danh chưa lưu, mở leave guard: `Ở lại để tiếp tục`, `Bỏ thay đổi` hoặc `Đối soát thao tác`. Khi mutation đã gửi hoặc chưa chắc kết quả, không cho bỏ thay đổi; chỉ đối soát Operation hoặc hủy điều hướng.
- Date controls are keyboard reachable and announce selected day/calendar status. Status filters use text labels, not color-only chips.
- Parent notification deep-links re-authorize child and School before rendering; if unavailable, show safe inbox context rather than stale detail.
- Parent has no attendance edit affordance. Finance totals/statuses always display API-returned values.
- Parent journal media is requested only after child/date authorization, never preloaded or service-worker cached; a retention/revoke denial clears journal text, thumbnails and dialog before safe fallback.
- All protected navigation re-evaluates School and child authorization after deep link, foreground return or inbox action. A denied destination removes previous child/date content before presenting the safe fallback.

## Accessibility Floor

- WCAG 2.1 AA across all portals; token combinations in `DESIGN.md` meet contrast targets.
- One `h1` per route includes selected School where operationally relevant; route change announces purpose and context.
- Every status has text; `NOT_RECORDED` cannot use red/error iconography.
- Touch targets are at least 44 by 44 CSS pixels in Parent PWA. Parent does not rely on hover.
- Tables use captions, headers and keyboard-reachable row actions. Dialog focus returns to the launching control.
- Attendance evidence is inaccessible in Parent DOM, route, cache or alternate text. Authorized DailyJournal media is separately protected and rendered only after Parent child/date re-authorization.

## Responsive & Platform

| Breakpoint | Admin/Staff and Ops | Parent |
| --- | --- | --- |
| `>= 1024px` | Persistent sidebar; queue and finance summaries may use two columns. | Centered single reading column. |
| `768-1023px` | Collapsed navigation; tables retain scroll. | Single column with full-width cards. |
| `< 768px` | Navigation sheet; operational actions remain available but dense finance tables use responsive cards/scroll. | Primary target: today cards, attendance history, leave, inbox and obligation detail. |

## Inspiration & Anti-patterns

- **Reference:** Kidsonline login screenshot informs a reassuring kindergarten feeling: clean sky/green warmth and illustration as welcome support, not copied layout or branding.
- **Keep:** calm bordered surfaces, operational status labels, VND hierarchy, mobile Parent cards, explicit timeout reconciliation.
- **Reject:** childlike finance controls, gamification, payment countdowns, red-by-default absence, child/class evidence in Parent views, and auto-save that silently crosses School context.

## Key Flows

### Flow 1 - Morning operational queue (Hoa, School Admin, 07:20)

1. Hoa signs into `app.passionedu.org` and selects Anh Hoa if she has more than one School membership.
2. Tổng quan opens to attendance gaps and pending leave for today's classes, with visible School and date.
3. Hoa opens a queue card for a class; its filter remains in the URL and shows which Students still need attendance.
4. She opens a pending leave record and sees the server result after approval.
5. **Climax:** The queue count and class list refresh from the server; Hoa knows which class still needs attention without checking a finance screen.
6. Failure: Hoa attempts to return Home while an approval mutation times out. The leave guard offers to remain and reconcile the Operation, discard only before submit, or cancel navigation.

### Flow 1b - Provision and owner bootstrap (Linh, Platform Operator)

1. Linh opens Ops and sees only School list, provision action and suspend/reactivate controls.
2. She enters School identity and first-owner email, then reviews the named School and owner before confirming.
3. The result shows provisioning in progress or completed; it never opens the new School business dashboard for Linh.
4. The owner signs in with Google and reaches the new School shell after identity binding.
5. **Climax:** Linh sees School provisioned and owner bootstrap status without receiving a School membership herself.
6. Failure: provision or identity binding fails. The form gives a clear retryable error and never claims a partial owner or School is ready.

### Flow 1e - Suspend or reactivate School (Linh, Platform Operator)

1. Linh opens a School row in Ops and sees its current active or suspended state.
2. She selects suspend/reactivate and confirms the named School and consequence.
3. The action submits through an Operation; Ops does not open tenant data while waiting.
4. **Climax:** The list refreshes with server-confirmed status. A suspended School's next business request is blocked, while other authorized contexts remain usable.
5. Failure: timeout enters reconciliation and duplicate action remains unavailable until outcome returns.

### Flow 1c - SchoolYear and roster transition (Hoa, School Admin)

1. Hoa opens Danh bộ in visible School and SchoolYear context.
2. She begins a transition wizard, selects source Students and maps each to a destination Class.
3. Server preview identifies records that move and records that cannot move; Hoa confirms through an idempotent action.
4. **Climax:** Destination enrollment history appears while source history remains readable and unchanged.
5. Failure: timeout or conflicting enrollment enters Operation reconciliation; Hoa cannot leave the workspace or submit a second batch until it resolves.

### Flow 1d - School foundation setup (Hoa, School Admin)

1. Hoa creates the active SchoolYear from Cấu hình trường and confirms its visible date boundary.
2. She creates Classes for that SchoolYear, then creates a Student enrollment with server-generated code.
3. Hoa adds a pending Parent link with required contact information and an effective-dated Staff assignment where needed.
4. The forms show field-level server errors and retain entered values after validation failure.
5. **Climax:** Danh bộ shows the new Student in the correct SchoolYear/Class with pending Parent status; the Staff assignment does not imply that Staff can sign in.
6. Failure: another active SchoolYear or invalid effective date is returned by the server; the form explains the field conflict and does not create a local placeholder record.

### Flow 1g - Quản lý Chức danh (Hoa, School Admin)

1. Hoa mở `Chức danh` và thấy rõ Trường Ánh Hoa ở heading, caption bảng; mỗi dòng cho biết tên, mã, trạng thái, số Staff và các nhãn khả năng thao tác.
2. Hoa chọn `Thêm chức danh`, nhập tên/mã và chọn capability từ catalog được phép, nhóm theo khu vực vận hành; không có quyền tự do hoặc capability ngoài School.
3. Sau khi gửi, UI đối soát Operation rồi làm mới bảng bằng dữ liệu server; tên không được coi là bằng chứng quyền.
4. Hoa muốn ngừng áp dụng một Chức danh đang có Staff. Hộp xác nhận nêu tên, số Staff bị ảnh hưởng, yêu cầu lý do audit và nói rõ yêu cầu tiếp theo của họ sẽ bị chặn theo capability bị mất.
5. **Climax:** Bảng hiển thị trạng thái `Ngừng áp dụng` do server xác nhận và vẫn giữ dòng/lịch sử để đối soát.
6. Failure: lỗi mã trùng hoặc catalog không hợp lệ focus error summary và giữ input. Nếu Hoa về Trang chủ khi form bẩn, leave guard cho ở lại hoặc bỏ thay đổi; nếu mutation đang đối soát, chỉ cho ở lại để đối soát hoặc hủy điều hướng.

### Flow 1f - School policy and holiday calendar (Hoa, School Admin)

1. Hoa opens the read-only calendar schedule or a typed finance, attendance or handover policy.
2. She sees active value, effective date and proposed change; money/access/attendance changes require a reason.
3. For calendar, Hoa adds a named inclusive holiday range; for policy, she submits the server-validated version and reviews any conflict.
4. **Climax:** The confirmed holiday or policy history appears without rewriting past snapshots.
5. Failure: a date-order or overlap error keeps holiday input visible; policy conflict keeps active/proposed values visible and focuses the returned field error.

### Flow 2 - CollectionRun preview and issue (Minh, Finance Manager, end of month)

1. Minh enters a School-scoped CollectionRun wizard, chooses the period and selects eligible Students. Fixed receivables are already in the template; he sets meal days, adds a field trip for selected Classes and checks `Lớp ngoại khóa trong đợt`, excluding a class only when it does not run this month.
2. Server preview returns selected/eligible rows and categorized skips; Minh does not edit a client total.
3. Minh generates drafts with an idempotent submission.
4. A timeout occurs; the screen says it is checking the result and reconciles the saved Operation ID before enabling another submission.
5. Minh opens a Draft from the run Invoice table, reviews it, adds/removes catalog lines, records a reason for an override or explanatory reference, keeps or changes the Class-default personal account (the School account is applied automatically) and issues both parts of the payment notice.
6. Minh reviews the confirmed result, then chooses `Học sinh tiếp theo` to continue in the same server order without returning to the run list.
7. **Climax:** The issued detail shows immutable obligation and Payment instruction snapshots with ledger-derived outstanding amount.
7. Failure: server-returned reversal mode controls the path. `DIRECT` posts only after named confirmation; `SCHOOL_ADMIN_APPROVAL` lets Minh submit a request but not approve it.

### Flow 2b - Ledger correction (Minh, Finance Manager)

1. Minh opens a closed Invoice and sees immutable Receipt, settlement outcome, SettlementDifference/carry status and audit context returned by the server.
2. He starts a source-linked reversal or refund, enters the amount and required reason, and reviews the server-returned impact; he cannot edit the original Receipt, client-allocate money or create a generic prepayment.
3. In two-step policy, he submits a request and sees "Chờ School Admin khác duyệt" instead of an approve action.
4. **Climax:** After approval/posting, the original records remain readable and the append-only ledger shows the correction and any resulting source-linked difference/carry state.
5. Failure: concurrent settlement changes the source state. The dialog refreshes the server outcome and asks Minh to review the permitted action; it never edits the old posting.

### Flow 2c - Actual Receipt close, carry and debt (Minh, Finance Manager)

1. Minh opens the table-first Thu tiền queue for the visible School and period, filters by Student/class if necessary, then opens one `ISSUED` Invoice from its `Tùy chọn` menu.
2. The server closes that one Invoice and returns `EXACT`, `SHORTFALL` or `OVERPAYMENT`; non-exact close appends one immutable SettlementDifference and shows the source-linked next-run carry status.
3. Minh cannot client-allocate money, create a generic prepayment or submit an unallocated, mixed-Student, cross-School or cross-SchoolYear Receipt. An Invoice with selected `PREPAID_COVERAGE` facts remains in the normal monthly run and must close `EXACT` before coverage issues.
4. When prior debt or a remaining difference is included, Minh opens the source trail rather than editing a balance; carry materializes only on the next eligible same-Student/School/SchoolYear monthly DRAFT Invoice.
5. Minh reviews the terminal server result and deliberately selects `Hóa đơn tiếp theo` when another authorized queue item exists.
6. **Climax:** The ledger detail and report refresh show actual Receipt, settlement outcome, SettlementDifference/carry, promotional coverage and outstanding as separate server-derived values with an as-of time.
7. Failure: a concurrent close, filter change or carry materialization changes state. The form refreshes the server outcome/list and prevents a duplicate close, stale next item or manual reapplication.

### Flow 2d - Service, short leave source and Finance review (Hoa and Minh)

1. Sau khi Finance catalog duoc cau hinh, Minh adds Students to an extracurricular class with an effective date in `Lớp ngoại khóa` (replacing StudentServiceEnrollment for extracurricular fees, 2026-10-02); Parent cannot change it.
2. Mai creates a short leave request from child detail; Hoa or Minh only decides a pending late request when the server grants `LEAVE_REQUEST_DECIDE`.
3. Approval creates a meal-eligibility source only; it does not change future CollectionRun eligibility. Finance opens the immutable source and sees the server-selected next DRAFT target, or an issued/cancelled/no-target outcome.
4. **Climax:** Minh reviews the immutable leave-day source and, only on an eligible Invoice `DRAFT`, posts the source-linked negative meal adjustment; the original source and outcome remain traceable. From 2026-10-01 this is the server-proposed `Bớt` on the next month's meal line, editable with a reason.

5. Bao luu sau thoa thuan truc tiep la action danh bo rieng cua Hoa; UI giai thich rang Finance policy/manual adjustment, khong lifecycle, xu ly bat ky giam hoc phi hoac phi khoi phuc nao.
6. Failure: there is no eligible DRAFT target. The UI names that outcome and does not invent a manual credit or automatic charge.

### Flow 3 - Parent checks today's attendance (Mai, Parent, 08:40)

1. Mai opens `parent.passionedu.org`; she selects the School containing her child if needed.
2. Parent home shows a Today card for each authorized child. Mai sees "Đã ghi nhận có mặt" with update time.
3. She taps the card to see date history. A date without a record says "Trường chưa ghi nhận", not absence.
4. She opens the bell inbox; an unread attendance event opens the same child/date after authorization recheck.
5. **Climax:** Mai sees the current-day state of her own child without seeing Staff, class activity, evidence or another child's data.
6. Failure: her link is revoked while history is open; the app clears the detail and returns her to a safe authorized context.

### Flow 4 - Parent sends leave request (Mai, Parent, evening)

1. From child detail, Mai starts a leave request for an authorized child and date.
2. The form validates required input and submits one request.
3. The detail shows `Đang chờ duyệt`, `Đã duyệt` or `Đã từ chối`; it does not expose internal approval mechanics.
4. **Climax:** While still `PENDING`, Mai can correct or cancel the request from the same detail.
5. Failure: attendance is already confirmed `PRESENT`; the server returns the conflict and the UI preserves the submitted request state without implying a finance adjustment.

### Flow 5 - Teacher records attendance (An, 08:05)

1. An opens `teacher.passionedu.org`, then a class/day only after the server confirms his effective assignment.
2. Each Student shows current server status and leave/calendar conflict.
3. When School policy requires evidence, selecting `PRESENT` requires evidence before submit.
4. An submits attendance through an idempotent action and waits for the server result rather than treating a local row update as final.
5. **Climax:** The class list refreshes with explicit text statuses; authorized Parent events are created without exposing An or evidence.
6. Failure: leave/PRESENT conflict or timeout returns server state or Operation reconciliation; An cannot force a fee or edit Parent-facing history.

### Flow 6 - Staff records handover (An, 16:35)

1. An opens the handover list for today in the visible School context. Anh có `HANDOVER_WRITE` từ Chức danh đang hiệu lực nên có thể chọn Student thuộc bất kỳ Lớp nào trong Trường; UI không yêu cầu phân công Lớp.
2. He selects an authorized Student and enters the picked-up time.
3. The server validates active Staff/binding/Chức danh capability, School, Student enrollment, date, policy, evidence and state, then confirms the recorded handover.
4. **Climax:** The child row shows the recorded time as operational history; it does not display or calculate any late-pickup fee.
5. Failure: An lacks handover capability, Position/binding is no longer active, Student belongs to another School or the record changed. The action is unavailable or refreshes with the server reason; An cannot infer or create a finance charge.

### Flow 7 - Teacher publishes daily journal (An, 16:45)

1. An remains in the assigned class/day on Teacher portal and opens a Student journal editor.
2. He enters the daily note and adds any number of JPEG, PNG or WebP images no larger than 10 MB each.
3. Server validates Class assignment, Student/date context and every upload before confirming the current journal version.
4. **Climax:** The Parent child detail shows only the confirmed current note and protected images for that child/date.
5. Failure: invalid media, revoked assignment, timeout or next-day edit attempt preserves safe input/error context; it does not expose an unconfirmed note or create a duplicate version.

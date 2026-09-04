---
title: "Đối chiếu discovery nguồn với PRD PassionEdu"
status: discovery
created: 2026-09-04
sources:
  - ../../../../docs/kidsonline-feature-catalog.md
  - ../../../../docs/multi-school-tenancy-catalog.md
  - ../../../../docs/receivables-clean-break-blueprint.md
  - ../../../../docs/roster-and-people-catalog.md
  - ../../../../docs/school-settings-catalog.md
baseline:
  - prd.md
  - addendum.md
---

# Đối chiếu discovery nguồn với PRD PassionEdu

## Mục đích và phương pháp

Tài liệu này chỉ ghi nhận yêu cầu hoặc quyết định nguồn có ảnh hưởng đáng kể nhưng chưa được PRD/addendum thể hiện, hoặc mâu thuẫn với chúng. Đây là discovery để Product/Architecture quyết định cập nhật PRD; không tự động mở rộng phạm vi release và không sửa các artifact `final`.

Không liệt kê các capability Kidsonline mà PRD đã chủ ý loại trừ hoặc để deferred, như chat, album, y tế, đưa đón được ủy quyền, import/export, SMS/Zalo/email, đồng bộ ngân hàng, thuế/VAT và auto late-pickup fee. Các nguồn này không phải yêu cầu mặc định chỉ vì đã quan sát thấy ở Kidsonline.

## Tóm tắt phát hiện

1. PRD có `CollectionRun` nhưng chưa có lifecycle và khóa vận hành đủ rõ (`DRAFT -> READY -> GENERATED -> CLOSED`), gồm giới hạn sửa rule, thêm học sinh sau generate và điều kiện đóng đợt.
2. PRD nêu `ChargeRule` và `DiscountPolicy` nhưng chưa chốt contract tính tiền thiết yếu: `INCLUDE/EXCLUDE`, nguồn giá, điều kiện quantity, phạm vi khoản được giảm và cách xử lý giảm vượt tổng.
3. PRD yêu cầu giữ lịch sử enrollment nhưng chưa quy định lịch sử chuyển lớp trong cùng năm, wizard chuyển năm/chuyển cả lớp có preview/idempotency, và đóng năm học không làm sai lịch sử.
4. PRD có evidence điểm danh theo mode nhưng thiếu các quyết định an toàn/vận hành về mode `REQUIRED`/`OPTIONAL`, quyền xem evidence, chặn ngày nghỉ và xử lý xung đột `PRESENT` với đơn nghỉ đã duyệt.
5. Một phần blueprint cũ đề xuất quantity tự động từ attendance/handover/service. Quyết định này mâu thuẫn trực tiếp với PRD/addendum hiện hành, vốn chỉ cho `FIXED` hoặc `MANUAL`; phải loại bỏ hoặc viết lại trước khi dùng làm đầu vào implementation.

## Thiếu trong PRD hoặc addendum

### 1. Lifecycle và kiểm soát `CollectionRun`

**Nguồn:** `receivables-clean-break-blueprint.md` §5.4, §7.2, §7.5.

**Thiếu:** PRD FR-8 chỉ định loại đợt thu, preview và generate `DRAFT`, nhưng không định nghĩa state machine của đợt thu. Cần chốt:

- `DRAFT`: được sửa thông tin/rule; `READY`: cấu hình đã hợp lệ và được preview/generate; thay rule phải quay về `DRAFT`.
- `GENERATED`: rule là immutable; chỉ được thêm một học sinh chưa có invoice, tạo đúng một invoice `DRAFT` từ snapshot rule. Học sinh đã có invoice phải dùng adjustment khi invoice còn `DRAFT` hoặc một run bổ sung.
- `CLOSED`: không được tạo invoice hay sửa rule/invoice trong run; thao tác đóng phải hiển thị invoice còn `DRAFT`/chưa settlement để người dùng xác nhận.
- Generate phải trả phân loại skip tối thiểu: invoice đã tồn tại, enrollment không đủ điều kiện, không có lớp active, không có rule áp dụng. Điều này biến preview thành công cụ rà soát có thể giải thích, không chỉ là tổng tiền.

**Tác động:** Đây là ranh giới bất biến cho snapshot và thao tác finance. Không chốt sẽ cho phép thay rule âm thầm sau khi đã rà soát hoặc phát hành một phần.

### 2. Contract `ChargeRule`, giá và giảm trừ

**Nguồn:** `receivables-clean-break-blueprint.md` §5.3, §6.1-§6.3, §6.5; `school-settings-catalog.md` §4.2.

**Thiếu:** FR-7 mới nêu precedence `STUDENT > CLASS > SCHOOL` và cấm conflict cùng độ đặc hiệu. Cần bổ sung contract sau:

- `ChargeRule` phải có `INCLUDE` và `EXCLUDE`; `STUDENT/EXCLUDE` loại khoản của rule rộng hơn. Một rule hẹp `INCLUDE` thay rule rộng hơn cho cùng khoản; conflict cùng độ đặc hiệu bị từ chối.
- Chỉ có các nguồn giá `RECEIVABLE_DEFAULT`, `CLASS_MONTHLY_TUITION`, `OVERRIDE`; `CLASS_MONTHLY_TUITION` chỉ hợp lệ cho đơn vị tháng và lớp active. Rule `OVERRIDE` phải có giá override.
- Quantity chỉ là số nguyên dương: `FIXED` lấy từ rule, `MANUAL` do Finance Manager/School Admin nhập ở Invoice `DRAFT`; không tạo dòng quantity bằng 0.
- `DiscountPolicy` phải chốt loại phần trăm/tiền cố định, khoảng hiệu lực, scope School/Class/Student, danh sách Receivable đủ điều kiện và snapshot căn nguyên. Giảm tiền cố định không được đẩy tổng dòng gốc xuống âm hoặc biến phần dư thành credit vô danh.
- Đơn vị, mã/tên khoản, nhóm, tax treatment, giá, quantity, nguồn giá/cách tính và reference nguồn phải được snapshot ở dòng invoice để report không đọc từ catalog mutable.

**Tác động:** Đây là contract tính tiền và khả năng đối soát; để các quyết định này chỉ ở discovery sẽ làm các implementation Finance khác nhau cho cùng một PRD.

### 3. Ranh giới ledger khi void, allocation và nộp trước

**Nguồn:** `receivables-clean-break-blueprint.md` §6.8, §7.3, §10.

**Thiếu:** FR-10 nói append-only và reversal/refund, nhưng cần xác định rõ:

- Invoice chỉ được `VOIDED` khi chưa có payment allocation hoặc prepayment application. Invoice đã có giao dịch không được void; phải reversal/refund/adjustment có liên kết và audit.
- Receipt có thể được phân bổ nhiều lần nhưng tổng allocation không vượt receipt; invoice có thể nhận nhiều allocation. Receipt thừa bị từ chối trừ khi tạo workflow `Prepayment` rõ ràng, không tự thành credit balance.
- Nộp trước chỉ được áp dụng vào invoice tương lai của cùng Student và không vượt số dư nộp trước hoặc outstanding invoice.
- `PRIOR_DEBT` phải chuyển số dư nguồn bằng giao dịch atomic/traceable để nợ nguồn không còn được thu lần hai; chỉ chuyển trong cùng `SchoolYear`.
- Báo cáo cần tách `receipt posted`, `receipt voided`, `allocated` và `prepayment open` thay vì chỉ nói receipt/allocation tổng quát; số “đã thu” không được suy ra từ invoice status.

**Tác động:** Các điểm này quyết định số dư và báo cáo có nhất quán khi partial payment, void và debt transfer đồng thời xảy ra.

### 4. Lịch sử lớp, chuyển năm và mã học sinh

**Nguồn:** `roster-and-people-catalog.md` §4.1-§4.2, §4.6-§4.7.

**Thiếu:** FR-5 yêu cầu lịch sử enrollment khi chuyển lớp/năm, nhưng chưa quy định cấu trúc và thao tác cần để bảo toàn lịch sử:

- Chuyển lớp trong cùng năm phải tạo assignment theo enrollment có `startsOn`, `endedOn`, actor và lý do; không overwrite một `classId` hiện tại.
- Chuyển năm/chuyển cả lớp phải là wizard chọn học sinh và map lớp đích, preview, confirmation, idempotency, tạo enrollment mới ở `SchoolYear` đích; không tự chuyển toàn bộ lớp nguồn.
- Đóng năm học phải có batch preview/idempotency và kết thúc assignment theo `SchoolYear.endsOn`; enrollment lịch sử không bị ép đổi classification chỉ để biểu thị năm đã đóng.
- `WITHDRAWN`/`GRADUATED` không quay về `ENROLLED` qua status update thường; quay lại cần re-enrollment có lý do/audit.
- `Student.studentCode` cần là mã vận hành bắt buộc, server sinh theo prefix/sequence scoped School, unique không phân biệt hoa thường, không tái sử dụng và bất biến sau khi đã được enrollment/finance/attendance tham chiếu. UUID vẫn là định danh kỹ thuật.

**Tác động:** Finance snapshot lớp và eligibility attendance phụ thuộc lịch sử có hiệu lực; không có contract này sẽ không thể giải thích dữ liệu cũ sau chuyển lớp hoặc chuyển năm hàng loạt.

### 5. Attendance evidence, calendar và xung đột leave

**Nguồn:** `receivables-clean-break-blueprint.md` §6.4-§6.5, §13; `school-settings-catalog.md` §4.1, §4.3.

**Thiếu:** FR-12 đã chốt retention evidence hai tháng và nói policy theo mode, nhưng các behavior material còn thiếu:

- `AttendancePolicy.photoEvidenceMode` phải có tối thiểu `REQUIRED` và `OPTIONAL`; mode `REQUIRED` từ chối xác nhận `PRESENT` không có ảnh. Snapshot mode, actor và timestamp trên event.
- Evidence blob/preview hết hạn đúng hai tháng lịch từ confirmation; audit metadata còn lại phải ghi có/không evidence và thời điểm xóa. Parent không được xem; chỉ Staff có capability attendance và School Admin được xem trong school scope.
- Không tạo/xác nhận attendance vào ngày calendar nghỉ/lễ; ngày học bù đã cấu hình là ngoại lệ hợp lệ.
- Leave đã duyệt tạo absence đề xuất chứ không khóa attendance. `PRESENT` được xác nhận trong ngày trùng phải giữ leave, đánh dấu conflict, loại ngày đó khỏi meal adjustment/gói dịch vụ và không sửa Invoice đã `ISSUED`.
- Calendar cần có working weekdays, ngày nghỉ/lễ, ngày học bù, `effectiveFrom`; thay đổi calendar không hồi tính finance/attendance đã snapshot.

**Tác động:** Các quy tắc này là điều kiện bảo vệ dữ liệu trẻ em và là căn nguyên duy nhất đáng tin cậy trước khi Finance tham chiếu leave/attendance.

### 6. Hợp đồng service enrollment và long leave

**Nguồn:** `receivables-clean-break-blueprint.md` §6.5; `school-settings-catalog.md` §4.3.

**Thiếu:** PRD chỉ nêu service enrollment trong FR-12. Cần chốt:

- `StudentServiceEnrollment` có trạng thái, effective dates, actor/audit; School Admin hoặc Finance Manager tạo/hủy theo yêu cầu/thông báo Parent, còn Parent không tự mutation service/cancellation.
- Long leave do Parent hoặc School Admin khởi tạo, chỉ School Admin duyệt/từ chối và chốt effective date không trước ngày yêu cầu; sau duyệt chỉ dừng eligibility của CollectionRun tương lai.
- Hủy service/long leave không sửa invoice đã issue; dùng refund/adjustment có source. Dịch vụ thứ bảy theo gói active và học lẻ không được charge trùng ngày đã có gói bao phủ.

**Tác động:** Nếu “service enrollment” chỉ là danh từ, các đội có thể tự diễn giải Parent mutation, hiệu lực và hoàn trả trái nhau.

### 7. Payment instruction và DTO Parent tối thiểu

**Nguồn:** `receivables-clean-break-blueprint.md` §7.3, §11; `roster-and-people-catalog.md` §4.3-§4.4.

**Thiếu:** FR-9/FR-15 nêu snapshot payment instruction và Parent DTO tối thiểu, nhưng thiếu các quyết định giao diện/dữ liệu cần kiểm thử:

- Khi issue, snapshot transfer content mặc định phải gồm `studentCode + className` snapshot; invoice code chỉ là reference phụ. QR render số outstanding của Invoice `ISSUED` tại thời điểm render, API là nguồn amount.
- Parent được xem Invoice issued, payment instruction và trạng thái outstanding cần thiết, nhưng không nhận receipt/allocation/prepayment/debt ledger chi tiết.
- Parent được tạo/xem/hủy/sửa leave request khi còn pending; đây là mutation Parent duy nhất ngoài phạm vi read-only finance. Nếu không chấp nhận, PRD phải ghi rõ đây là quyết định loại trừ để tránh mâu thuẫn với blueprint.
- ParentProfile được tạo/bind qua UserIdentity pending theo email Google verified; Parent chỉ tự sửa số điện thoại, không sửa email identity, link hay quyền. Đây là quyết định ownership giúp School Admin quản lý contact trước lần Parent đăng nhập đầu tiên.

**Tác động:** Điều này giảm chuyển khoản sai nội dung, ngăn lộ ledger nội bộ và đóng rõ boundary mutation Parent.

### 8. Ràng buộc policy tối thiểu của School

**Nguồn:** `school-settings-catalog.md` §4; `multi-school-tenancy-catalog.md` §3.4.

**Thiếu:** FR-4 yêu cầu policy typed/versioned nhưng không liệt kê baseline đủ để các domain có cùng behavior. Cần xác nhận các policy typed tối thiểu:

- `FinancePolicy`: default due date, tax treatment được phép, prepayment, debt within SchoolYear, `reversalApprovalMode`, và quy tắc nhiều bank account active/chọn riêng lúc issue.
- `LatePickupPolicy`: cutoff, grace, block minutes, rounding/exemption, actor được override, version/effective date. Đây chỉ là policy tham chiếu cho dòng `MANUAL`, không phải fee engine.
- `ParentAccessPolicy`: Google identity bắt buộc, revoke/session lifetime/support path và retention finance server-side.
- Mọi policy tác động money/access/attendance phải có giá trị cũ-mới, actor, lý do khi yêu cầu và effective date; không được là JSON/key-value tự do.

**Tác động:** “Typed/versioned” không đủ để UX, API và test thống nhất nếu các field và owner policy chưa được chốt.

## Mâu thuẫn cần giải quyết

### C-1. Auto-pricing từ dữ liệu vận hành

**Nguồn mâu thuẫn:** `receivables-clean-break-blueprint.md` §1 mục 5 và §4 (đặc biệt câu “các nguồn số lượng ... tiền ăn ... thứ bảy theo đăng ký dịch vụ hoặc attendance”).

**PRD/addendum:** PRD §4.5, §5 và addendum “Quy tắc finance chi tiết” quy định attendance, handover và service enrollment chỉ là reference; `ChargeRule.quantity` chỉ `FIXED` hoặc `MANUAL`; late pickup và Saturday học lẻ là dòng `MANUAL`. FR-13 cũng cấm tự động tính late-pickup fee.

**Kết luận:** Giữ PRD/addendum. Loại bỏ cách diễn đạt “API xác định quantity” hoặc “attendance tự tạo quantity” khỏi blueprint. Chỉ giữ các behavior tương thích: enrollment có thể quyết định eligibility cho một dịch vụ `FIXED`; Finance tham chiếu attendance/handover rồi nhập quantity hoặc adjustment trong `DRAFT`, có source/audit. Meal leave là proposed negative adjustment cho invoice `DRAFT` kế tiếp, không là calculation mode từ attendance.

### C-2. Parent portal “read-only” và sửa/hủy leave request pending

**Nguồn:** `receivables-clean-break-blueprint.md` §8, §9; `roster-and-people-catalog.md` §4.3.

**PRD:** PRD §1, FR-12 và FR-15 mô tả Parent read-only cho finance, đồng thời cho phép “gửi đơn nghỉ”; không nói Parent có được sửa/hủy đơn pending hay không.

**Kết luận:** Đây là mâu thuẫn phạm vi diễn đạt, không phải mâu thuẫn finance. Cần quyết định rõ trong PRD: hoặc chấp nhận sửa/hủy chỉ khi `PENDING` như nguồn đề xuất, hoặc giới hạn Parent chỉ tạo đơn. Dù chọn cách nào, Parent vẫn không được mutation finance, attendance, handover hay service enrollment.

### C-3. Notification attendance in-app

**Nguồn:** `receivables-clean-break-blueprint.md` §6.5; `school-settings-catalog.md` §4.3.

**PRD:** FR-12 không yêu cầu notification attendance; §5 loại chat, SMS/Zalo/email, nhưng không loại rõ in-app notification.

**Kết luận:** Không suy ra đây là scope release. Nếu giữ notification in-app, PRD phải thêm Notification domain tối thiểu (audience, retention, audit delivery) và cập nhật non-goal. Nếu không, evidence/attendance chỉ được ghi nhận nội bộ trong release này.

## Các nguồn đã được PRD/addendum bao phủ

- Multi-school tenant root, membership/role grants, Platform Operations tách portal, bootstrap owner pending Google, host-only cookie/audience, school-scoped route và cross-tenant/idempotency/audit: đã được PRD FR-1 đến FR-3 và addendum.
- Danh mục khoản thu theo School, mã tùy chọn unique theo School, group, price/refund/tax label, Invoice snapshot, VND `BIGINT`, preview/generate authoritative, debt/prepayment/reversal và report ledger: đã được PRD FR-7 đến FR-11. Các chi tiết còn thiếu được ghi riêng ở trên, không lặp lại toàn catalog.
- SchoolYear, lifecycle bảy trạng thái, Parent multi-school/revoke/retention, Staff không tự có login, class assignment effective date, School calendar/policy typed: đã được PRD FR-4 đến FR-6 và FR-14.
- Leave, attendance, handover, meal adjustment thủ công và không auto late-pickup fee: đã được PRD FR-12, FR-13 và addendum, với các điều kiện chi tiết cần bổ sung ở trên.

## Quyết định đề xuất cho bước tiếp theo

1. Product xác nhận C-2 và C-3; Architecture không nên suy diễn Parent mutation hoặc notification từ catalog.
2. Bổ sung các mục 1-8 vào PRD/addendum qua workflow thay đổi yêu cầu trước khi tạo Architecture Spine hoặc stories finance/roster/attendance.
3. Cập nhật hoặc thay thế các câu auto-pricing trong finance blueprint để mọi artifact nguồn đều tuân theo ranh giới `FIXED | MANUAL` hiện hành.
4. Chuyển các contract đã chốt thành acceptance/integration tests: run lifecycle, rule/discount precedence, ledger void/concurrency, enrollment assignment/year transition, evidence retention/calendar conflict, và Parent DTO/mutation boundary.

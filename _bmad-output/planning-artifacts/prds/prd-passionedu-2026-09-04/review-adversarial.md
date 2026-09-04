# Review Adversarial: PRD PassionEdu

## Phạm vi và phương pháp

- Tài liệu được review: `prd.md` và `addendum.md` trong cùng thư mục.
- Baseline bắt buộc: `../../sprint-change-proposal-2026-08-31.md`, trạng thái `approved` ngày 2026-09-04.
- Lens: adversarial. Review tìm omission, contradiction, unsafe ambiguity và lỗi ranh giới release. Mọi yêu cầu trong proposal được xem là hợp đồng cần được giữ nguyên hoặc được đánh dấu rõ là deferred, không được làm yếu đi bằng diễn giải ngầm.

## Phán quyết

**CHƯA ĐỦ ĐIỀU KIỆN phê duyệt.** PRD phản ánh đúng hướng clean-break, tenant root và ledger ở cấp cao, nhưng chưa bảo toàn một số quyết định đã approved về authorization/provisioning, lifecycle danh bộ, quyền riêng tư evidence, luồng leave-service và dependency giữa các release. Nếu dùng bản này làm đầu vào Architecture Spine/epics, đội triển khai có thể tạo hành vi khác proposal dù vẫn “đạt” các FR hiện có.

## Findings

### 1. Ranh giới E1 làm mất Parent chooser đã được proposal đưa vào release đầu

- **Vị trí:** `prd.md` §6.2, Release 1 và Release 4; proposal §5.1(1), §5.2 E1.
- **Điều kiện kích hoạt:** PRD đưa toàn bộ Parent multi-school portal/chooser sang Release 4, trong khi proposal đã chốt Parent portal domain/cookie decision và Parent school selection thuộc release nền tảng/E1.
- **Guard đề xuất:** Tách rõ hai mức: E1 phải chốt và kiểm thử topology Parent, audience/cookie/callback isolation và authorization/selection contract; E7 chỉ phát hành UI đọc obligation sau E6. Nêu acceptance cho Parent school selection hoặc ghi rõ contract-only nếu chưa phát hành UI.
- **Hệ quả nếu phát hành:** E1 có thể khóa sai session/cookie/route contract, buộc E7 sửa nền authorization đã “hoàn thành”, hoặc Parent chooser không được kiểm thử cho đến rất muộn.

### 2. Dependency E3 bị nới sai: finance configuration có thể chạy trước roster foundation

- **Vị trí:** `prd.md` §6.2, Release 2; proposal §5.2 E3 và §5.2 đoạn sau bảng.
- **Điều kiện kích hoạt:** Release 2 viết E2 và E3 “sau E1”, nhưng proposal quy định E3 phụ thuộc cả E1 lẫn E2; E3-E7 cũng không được bắt đầu trước khi E1 chứng minh tenant isolation.
- **Guard đề xuất:** Viết dependency bắt buộc `E1 gate -> E2 -> E3`; nêu E1 tenant-isolation gate là điều kiện vào E2/E3-E7, không chỉ là blocker chung của Release 1.
- **Hệ quả nếu phát hành:** Receivable, pricing hoặc policy có thể được model trước SchoolYear/Student/Enrollment, dẫn đến FK, scope eligibility và snapshot bị retrofit.

### 3. Dependency E5 không nêu E3 là điều kiện bắt buộc

- **Vị trí:** `prd.md` §6.2, Release 3; proposal §5.2 E5.
- **Điều kiện kích hoạt:** PRD chỉ nói E5 sau E2-E4; proposal yêu cầu E5 phụ thuộc E2, E3 và E4.
- **Guard đề xuất:** Đặt rõ E5 chỉ bắt đầu/phát hành sau E2, E3 và E4, đồng thời yêu cầu E4 định nghĩa input leave adjustment/reference trước khi E5 triển khai.
- **Hệ quả nếu phát hành:** Team có thể xây CollectionRun/Invoice trước catalog, discount và finance policy, rồi tạo một mô hình pricing/snapshot thứ hai.

### 4. Bootstrap owner thiếu hợp đồng pending identity bind Google

- **Vị trí:** `prd.md` FR-1; `addendum.md` §Định hướng kỹ thuật; proposal §2 quyết định 9, §5.2 E1.
- **Điều kiện kích hoạt:** PRD chỉ nói bootstrap School Admin theo email. Nó không yêu cầu tạo/tìm `UserIdentity` pending theo email, bind Google subject ở lần login đầu, cũng không cấm password mặc định.
- **Guard đề xuất:** Bổ sung requirement và acceptance: provisioning nhận `SCHOOL_ADMIN` email, tạo/tìm pending identity normalized-email, chỉ bind subject sau Google OAuth; không tạo password/default credential; `SUPERADMIN_EMAIL` chỉ bootstrap `PlatformOperatorGrant` qua environment.
- **Hệ quả nếu phát hành:** Provisioning có thể tạo account cục bộ, bind nhầm identity, hoặc để một email owner không thể nhận membership khi đăng nhập Google.

### 5. Platform Operator bootstrap và School Admin đang bị mơ hồ về role/capability

- **Vị trí:** `prd.md` FR-1, §2.1, §4.1; proposal §2 quyết định 7, 9, 10.
- **Điều kiện kích hoạt:** PRD không định nghĩa `PlatformOperatorGrant`, session audience `ops`, hay ba preset release đầu `SCHOOL_ADMIN`, `FINANCE_MANAGER`, `CLASS_TEACHER`. Đồng thời §2.1 xem `ATTENDANCE_RECORDER` và `HANDOVER_RECORDER` như user role dù proposal chỉ cho capability khi domain tương ứng được phát hành.
- **Guard đề xuất:** Ghi role/capability matrix theo release: Ops authorize bằng audience `ops` + `PlatformOperatorGrant`, không có `OpsUser` và không cấp School access; release đầu chỉ có ba preset; attendance/handover capability được thêm cùng E4, không tự biến thành preset role trước đó.
- **Hệ quả nếu phát hành:** Kiến trúc và UX có thể tạo global Ops profile hoặc checkbox role trái proposal, hoặc cấp capability vận hành trước policy/domain bảo vệ nó tồn tại.

### 6. `studentCode` server-generated bị bỏ hoàn toàn

- **Vị trí:** `prd.md` FR-5/FR-6; `addendum.md` §Invariant data model; proposal §2 quyết định 11.
- **Điều kiện kích hoạt:** PRD không yêu cầu server sinh `studentCode` theo prefix School với sequence unique trong School, và không loại manual/import code khỏi release đầu.
- **Guard đề xuất:** Thêm vào FR roster: `studentCode` do server sinh, unique theo School, prefix cấu hình/được snapshot theo School; manual/import code là extension sau có validation và audit, không có UI release đầu.
- **Hệ quả nếu phát hành:** Mã chuyển khoản và định danh học sinh có thể không unique hoặc bị client nhập tùy ý; sau đó không thể áp dụng transfer content `studentCode + className` một cách tin cậy.

### 7. Close-year/transition chưa giữ đúng semantics enrollment đã chốt

- **Vị trí:** `prd.md` FR-5; proposal §2 quyết định 16.
- **Điều kiện kích hoạt:** “Chuyển năm/chuyển lớp tạo lịch sử enrollment” không quy định close-year kết thúc class assignment nhưng giữ enrollment lịch sử `ENROLLED`, wizard map một phần học sinh và chỉ tạo enrollment mới `ENROLLED` ở lớp đích; cũng không phân biệt `GRADUATED` với chuyển lớp/năm.
- **Guard đề xuất:** Đặc tả transition wizard và state invariant đúng proposal, bao gồm effective dates/audit, partial mapping, lifecycle nguồn/đích và quy tắc chỉ dùng `GRADUATED` khi thực sự hoàn thành/chuyển cấp rời trường.
- **Hệ quả nếu phát hành:** Team có thể đổi enrollment cũ thành `GRADUATED` hoặc mutate class cũ, làm mất lịch sử, sai eligibility/finance report và retention.

### 8. Parent link provisioning thiếu contact tối thiểu và self-service boundary

- **Vị trí:** `prd.md` FR-6, FR-14; proposal §2 quyết định 13.
- **Điều kiện kích hoạt:** PRD nói School Admin quản lý link nhưng không bắt buộc email, tên, số điện thoại khi tạo Parent trước Google login; cũng không nêu Parent chỉ được tự sửa số điện thoại với audit và không được đổi identity/quyền.
- **Guard đề xuất:** Bổ sung dữ liệu bắt buộc, normalized email/pending binding, phone là contact vận hành chưa cần SMS verification, và mutation boundary/audit của Parent. Nêu active `StudentParent` mặc định cấp portal, obligation và payment instruction; relationship label không là authorization.
- **Hệ quả nếu phát hành:** Parent record không đủ dữ liệu để bootstrap/bind hoặc một UI self-service có thể vô tình cho đổi identity/quyền truy cập của trẻ.

### 9. Retention Parent bị mơ hồ và thiếu mốc `endedOn`/ngoại lệ settlement

- **Vị trí:** `prd.md` FR-14; proposal §2 quyết định 14.
- **Điều kiện kích hoạt:** “Khi enrollment kết thúc” không gắn 30 ngày lịch với `StudentEnrollment.endedOn`, không định nghĩa operational/sensitive data cụ thể, và không nói rõ invoice issued, payment instruction, receipt/refund vẫn xem được khi còn balance/prepayment/refund chưa quyết toán.
- **Guard đề xuất:** Chuyển nguyên văn policy boundary: operational/sensitive data hết sau 30 ngày lịch từ `endedOn`; finance issued/payment instruction/receipt/refund còn xem khi chưa settlement; sau settlement áp dụng `ParentAccessPolicy` server-side mặc định 12 tháng, có audit/version, Parent PWA không tự tính.
- **Hệ quả nếu phát hành:** Có thể xóa quyền xem finance còn phải quyết toán, hoặc giữ data trẻ nhạy cảm quá hạn do mỗi team hiểu “enrollment kết thúc” khác nhau.

### 10. Attendance photo evidence không bị giới hạn Staff/Admin-scoped

- **Vị trí:** `prd.md` FR-12; `addendum.md` §Verification matrix; proposal §5.1, §5.2 E4.
- **Điều kiện kích hoạt:** PRD chỉ cấm Parent xem evidence và đặt retention hai tháng; không giới hạn người được xem là Staff/Admin có capability, không nêu scope School/authorization khi đọc evidence.
- **Guard đề xuất:** Yêu cầu evidence chỉ Staff/Admin được capability trong đúng School truy cập, retention đúng hai tháng, Parent chỉ nhận notification event; thêm negative authorization/revocation test cho media/evidence endpoint và object storage URL.
- **Hệ quả nếu phát hành:** Ảnh trẻ có thể lộ cho bất kỳ authenticated staff hoặc qua URL/storage không được tenant guard dù API attendance chính đã an toàn.

### 11. Long-term leave và service cancellation bị rơi khỏi functional scope

- **Vị trí:** `prd.md` FR-12, §4.5, §5, §6.1; proposal §2 quyết định 23 và 26.
- **Điều kiện kích hoạt:** PRD chỉ mô tả leave theo ngày và service enrollment. Nó không có luồng Parent/School Admin tạo nghỉ dài hạn, chỉ School Admin approve/reject và chọn effective date không trước ngày request, API dừng charge future run, hoặc xử lý invoice đã issue bằng adjustment/refund có source. Hủy service/effective date/audit và Parent không tự hủy cũng thiếu.
- **Guard đề xuất:** Bổ sung hai sub-flow với actor/state/effective-date/audit/source rules; nêu rõ future CollectionRun exclusion sau approval và adjustment/refund cho obligation đã issue.
- **Hệ quả nếu phát hành:** Trẻ nghỉ dài hạn hoặc ngừng dịch vụ vẫn bị batch charge, hoặc nhân viên dùng adjustment thủ công không có provenance và không có quyền duyệt đúng.

### 12. Meal/service rule thiếu guard chống charge trùng

- **Vị trí:** `prd.md` FR-12, FR-13; `addendum.md` §Quy tắc finance; proposal §2 quyết định 23, 25.
- **Điều kiện kích hoạt:** Addendum nói Saturday học lẻ là `MANUAL`, nhưng không bắt buộc Finance chặn charge một ngày đã được `StudentServiceEnrollment` bao phủ; PRD cũng không chốt meal adjustment là adjustment âm cho Invoice `DRAFT` kế tiếp từ leave đủ điều kiện.
- **Guard đề xuất:** Đưa vào FR/acceptance: service enrollment effective-date là nguồn coverage; MANUAL Saturday/late pickup phải validate/reference coverage để không double-charge; meal deduction chỉ sinh vào invoice `DRAFT` kế tiếp với source leave, calendar exclusion, deadline/approval và `PRESENT` conflict.
- **Hệ quả nếu phát hành:** Cùng một ngày có thể bị thu qua gói dịch vụ và dòng manual; meal deduction có thể được áp vào invoice đã issue hoặc không truy vết về leave.

### 13. CollectionRun hậu generate thiếu quyền thêm học sinh và snapshot invariant

- **Vị trí:** `prd.md` FR-8; `addendum.md` §Quy tắc finance; proposal §2 quyết định 22.
- **Điều kiện kích hoạt:** PRD chỉ quy định uniqueness invoice trong run. Nó bỏ behavior đã chốt: run `GENERATED` giữ rule/phạm vi batch gốc bất biến, Finance Manager/SCHOOL_ADMIN có thể thêm một học sinh chưa có invoice và server tạo duy nhất `DRAFT` từ rule snapshot; khoản mới cho hóa đơn đã issue phải dùng run bổ sung.
- **Guard đề xuất:** Bổ sung state/authorization/action riêng sau generate và negative cases cho duplicate student, mutating original scope/rule, và thêm charge vào issued invoice.
- **Hệ quả nếu phát hành:** UI/API có thể sửa batch gốc, tạo invoice thứ hai, hoặc bổ sung khoản vào nghĩa vụ issued phá vỡ snapshot/audit.

### 14. Issue payment instruction thiếu default transfer content đã approved

- **Vị trí:** `prd.md` FR-9, FR-15; proposal §2 quyết định 19.
- **Điều kiện kích hoạt:** PRD yêu cầu chọn account active và snapshot transfer content nhưng không chốt content mặc định là `studentCode + className`; requirement `studentCode` cũng đang thiếu.
- **Guard đề xuất:** Đặt default content và snapshot source rõ ràng tại issue; chỉ cho phép override theo policy/audit nếu sau này cần. Xác định snapshot là dữ liệu Parent được đọc, không phải account live.
- **Hệ quả nếu phát hành:** Các invoice cùng trường có thể chứa nội dung chuyển khoản không nhận diện được học sinh/lớp, làm tăng receipt allocation sai và khiến Parent UI/Finance dùng hai format khác nhau.

### 15. Reversal/refund policy không đủ chi tiết trong PRD chính và chưa gắn quyền actor

- **Vị trí:** `prd.md` FR-10; `addendum.md` §Quy tắc finance; proposal §2 quyết định 18, 20.
- **Điều kiện kích hoạt:** PRD nói reversal theo direct hoặc two-step nhưng không chốt `DIRECT` cho School Admin/Finance Manager, hoặc mode approval yêu cầu Finance Manager tạo request và một School Admin khác actor duyệt trước khi post. Refund prepayment khi trẻ nghỉ trước áp dụng cũng chưa có actor/source requirement.
- **Guard đề xuất:** Chuyển các actor, separation-of-duties, reason/audit, idempotency và refund source/authority vào FR-10 acceptance thay vì chỉ để một dòng addendum.
- **Hệ quả nếu phát hành:** Một Finance Manager có thể tự request và approve reversal, hoặc refund được post mà không gắn với prepayment/leave, làm suy yếu kiểm soát sổ cái.

### 16. High-impact idempotency đang là nhãn chung, không bảo vệ các mutation proposal chỉ mặt

- **Vị trí:** `prd.md` §7; proposal §3.4, §5.3.
- **Điều kiện kích hoạt:** PRD yêu cầu idempotency UUID cho “mutation high-impact” nhưng không định danh create CollectionRun hàng loạt, chuyển cả lớp/năm, receipt/allocation/reversal/refund và các action approval/issue cần operation reconciliation; không yêu cầu operation scope School + actor membership ngoài FR-3 ở mức tổng quát.
- **Guard đề xuất:** Liệt kê mutation phải có idempotency/operation ID, key scope, retry-after-timeout bằng `GET /operations/:operationId`, và test duplicate/concurrent submission cho từng action. Đồng bộ terminology `payment confirmation` cũ với receipt post/allocation của ledger mới.
- **Hệ quả nếu phát hành:** Các team có thể bảo vệ generate nhưng không bảo vệ transition hoặc ledger post; timeout tạo double receipt, duplicate enrollment hoặc thao tác approve/reversal lặp.

### 17. Trial workflow được đưa vào lifecycle mà không có release boundary/audit contract

- **Vị trí:** `prd.md` FR-5; proposal §2 quyết định 12.
- **Điều kiện kích hoạt:** PRD đưa `TRIAL` vào lifecycle release nhưng không nói đây là workflow ngoại lệ chỉ có audit khi được phát hành, trong khi proposal nêu rõ điều đó.
- **Guard đề xuất:** Chọn một trong hai cách rõ ràng: defer UI/mutation `TRIAL` khỏi release hiện tại nhưng giữ state compatibility, hoặc đặc tả workflow exception, actor, audit và eligibility. Giữ invariant chỉ `ENROLLED` mặc định vào attendance/CollectionRun.
- **Hệ quả nếu phát hành:** Triển khai có thể coi `TRIAL` là trạng thái CRUD thông thường, vô tình cho attendance/billing hoặc thay đổi lifecycle không audit.

### 18. Staff profile và class assignment thiếu tập dữ liệu/boundary đã chốt

- **Vị trí:** `prd.md` FR-6; proposal §2 quyết định 15.
- **Điều kiện kích hoạt:** PRD không chốt các field release đầu của Staff (họ tên, email, điện thoại, ngày sinh, giới tính, địa chỉ), assignment many-to-many với effective dates/audit, và không có primary/secondary teacher classification.
- **Guard đề xuất:** Bổ sung field/mutation contract và explicit non-goal cho HR/payroll/password/primary-secondary assignment; quy định Staff profile không đủ login, chỉ UserIdentity có membership/role active vào portal.
- **Hệ quả nếu phát hành:** UX/schema có thể bổ sung role lớp tùy tiện hoặc sử dụng Staff record làm credential, tạo rủi ro dữ liệu cá nhân và authorization drift.

## Điều kiện để đạt phán quyết “đủ điều kiện phê duyệt”

- Khôi phục đầy đủ các contract bị thiếu ở findings 1-18 vào PRD hoặc addendum với normativity rõ ràng, owner và release/epic tương ứng.
- Sửa dependency release để khớp E1 -> E2 -> E3, E4 sau E2, E5 sau E2/E3/E4, E6 sau E5 và Parent read release sau E1/E2/E6; vẫn giữ Parent topology/selection contract ở E1.
- Chuyển các policy access, retention, evidence, financial separation-of-duties và idempotency từ mô tả tổng quát thành acceptance criteria có negative/concurrency tests.
- Sau khi sửa, chạy traceability pass proposal §2, §5.1-§5.3 sang FR, non-goal, release boundary và verification matrix trước khi chuyển Architecture/UX/Epics.

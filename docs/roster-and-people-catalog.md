---
title: "Danh bộ học sinh, phụ huynh và nhân viên: tham chiếu Kidsonline cho Ánh Hoa"
status: discovery-proposal
created: 2026-08-31
source: "Khảo sát Kidsonline /v4/school/3139/users/students"
---

# Danh Bộ Học Sinh, Phụ Huynh Và Nhân Viên

## 1. Kết luận

Khi Ánh Hoa có Parent PWA, finance ledger, điểm danh và đón muộn, danh bộ không còn chỉ là danh sách tên và lớp. Cần ba aggregate tách biệt:

- **Học sinh**: định danh vận hành, thông tin tối thiểu, trạng thái theo năm học và lớp hiện tại/lịch sử.
- **Phụ huynh**: hồ sơ liên hệ/identity riêng, có thể liên kết nhiều học sinh.
- **Nhân viên**: identity vận hành, trạng thái, quyền theo nghiệp vụ và phân công lớp.

Không dùng hai cột `Mẹ`/`Bố` làm mô hình dữ liệu. Quan hệ Parent-Học sinh phải nhiều-nhiều, có trạng thái, quan hệ thân nhân tùy chọn và quyền riêng theo liên kết.

## 2. Bằng chứng đã quan sát từ Kidsonline

### 2.1 Học sinh

Màn danh sách học sinh có:

- Chọn năm học, lọc theo tuổi, tìm kiếm, phân trang, tạo mới, tải lên/tải xuống.
- Bucket vòng đời theo năm học: học thử, chờ phân lớp, sắp vào lớp, trong lớp, bảo lưu, nghỉ học, tốt nghiệp.
- Mã học sinh, tên/biệt danh, ngày sinh, giới tính, lớp, mẹ, bố và trạng thái đã/chưa đăng nhập của từng phụ huynh.
- Học sinh có thể không hiển thị phụ huynh trong danh sách nhưng vẫn có trạng thái trong lớp.

### 2.2 Phụ huynh

Màn danh sách phụ huynh có:

- Tạo phụ huynh, đổi mật khẩu hàng loạt, tìm kiếm, phân trang, trạng thái hoạt động và action theo dòng.
- Tên, ngày sinh, email/tài khoản khi có, số điện thoại, nghề nghiệp và trạng thái đăng nhập/hoạt động.

### 2.3 Nhân viên

Màn danh sách nhân viên có:

- Tạo nhân viên, đổi mật khẩu, tải xuống, tìm kiếm/phân trang và filter trạng thái.
- Trạng thái: hoạt động, chưa đăng nhập, tạm khóa, đã bị xóa, chưa bổ sung hồ sơ.
- Tên, ngày sinh, email/tài khoản, điện thoại, tình trạng hồ sơ, lớp được phân công và chức vụ/quyền.
- Một nhân viên có thể được phân công nhiều lớp và giữ nhiều quyền, như Giáo viên, Điểm danh, Quản lý trường.
- Trang chi tiết nhân viên có thông tin identity, role, lớp phân công, lịch sử tạo/cập nhật quyền và phần hồ sơ mở rộng gồm học vấn, thành tích, kinh nghiệm, ghi chú.

## 3. Mô hình cần sao chép và phần không nên sao chép ngay

| Năng lực | Đề xuất Ánh Hoa | Ghi chú |
| --- | --- | --- |
| Mã học sinh | Server sinh bắt buộc theo prefix trường, unique theo trường, bất biến sau khi dùng finance/attendance | Cần cho tìm kiếm, import và receipt; không dùng UUID nội bộ làm mã vận hành; manual/import là extension sau |
| Năm học | `SchoolYear` có ngày bắt đầu/kết thúc và trạng thái | Nền cho enrollment, lớp, calendar, run tài chính và báo cáo |
| Vòng đời học sinh | Đủ bảy trạng thái Kidsonline theo enrollment năm học, không phải một `Student.status` toàn cục | Một trẻ có thể bảo lưu/nghỉ/tốt nghiệp một năm nhưng vẫn giữ lịch sử identity |
| Parent profile | `ParentProfile` identity/email/điện thoại toàn platform, nhiều-nhiều với học sinh | Không có `schoolId`; trường của Parent được suy ra qua `StudentParent -> Student`; giữ Parent PWA Google flow hiện có, không dùng default password |
| Link Parent-Học sinh | Active/revoked, relation label, quyền thanh toán/thông báo/đón tùy scope | Revoke phải có hiệu lực request tiếp theo |
| Nhân viên | Nhân viên active/inactive, role grant, class assignment, audit | Cần trước attendance/handover; không cần hồ sơ HR đầy đủ ngay |
| Role nghiệp vụ | Permission rõ theo domain, không dùng string title làm authorization | Ví dụ `ATTENDANCE_RECORD`, `HANDOVER_RECORD`, `FINANCE_POST_RECEIPT` |
| Phân công lớp | Many-to-many, effective dates, không phân giáo viên chính/phụ ở release đầu, không tự gán toàn quyền trường | Nhân viên có thể phụ trách nhiều lớp |
| Import/export | Deferred sau khi đưa core vào vận hành; có validation preview, báo lỗi từng dòng, idempotency | Không nhập trực tiếp vào DB từ CSV |
| Hồ sơ HR mở rộng | Để sau | Học vấn/thành tích/kinh nghiệm không phải core của finance/attendance |
| Đổi mật khẩu | Không sao chép | Admin/Parent/Staff dùng Google OAuth hoặc mechanism riêng được thiết kế sau |

## 4. Mô hình miền đề xuất

### 4.1 `Student`

| Field | Quy tắc |
| --- | --- |
| `id` | UUID nội bộ |
| `studentCode` | Bắt buộc, unique không phân biệt hoa thường theo trường, bất biến sau khi phát sinh enrollment/invoice/attendance; release đầu chỉ server sinh |
| `fullName`, `nickname` | Tên bắt buộc, biệt danh tùy chọn |
| `dateOfBirth`, `gender` | Cần cho filter tuổi, kế hoạch và policy phụ phí; xử lý như dữ liệu trẻ em nhạy cảm |
| `status` | Chỉ `ACTIVE`/`INACTIVE` ở identity; không dùng cho classification năm học |
| timestamps/audit | Không xóa cứng |

### 4.2 `StudentEnrollment`

Đây là source of truth cho trạng thái học sinh theo năm học.

| Field | Quy tắc |
| --- | --- |
| `studentId`, `schoolYearId` | Unique một enrollment mỗi học sinh/năm học |
| `classification` | `TRIAL`, `WAITING_FOR_CLASS`, `SCHEDULED_TO_START`, `ENROLLED`, `ON_LEAVE`, `WITHDRAWN`, `GRADUATED` |
| `classId` | Tùy chọn khi `WAITING_FOR_CLASS`; bắt buộc khi `ENROLLED`; có thể được chỉ định trước cho `TRIAL`/`SCHEDULED_TO_START`; giữ class snapshot lịch sử khi `ON_LEAVE`/`WITHDRAWN`/`GRADUATED` |
| `startedOn`, `endedOn` | Dùng cho audit/report, không tự prorate finance nếu policy chưa định nghĩa |
| `changedBy`, timestamps, reason | Bắt buộc reason cho bảo lưu, thôi học, tốt nghiệp và thay đổi backdated |

| UI Kidsonline | Enum Ánh Hoa | Ý nghĩa vận hành | Finance/attendance mặc định |
| --- | --- | --- | --- |
| Học thử | `TRIAL` | Trẻ đang trải nghiệm lớp trước khi nhập học chính thức | Không tự đưa vào đợt thu; có thể điểm danh nếu trường kích hoạt workflow trial |
| Chờ phân lớp | `WAITING_FOR_CLASS` | Đã ở danh bộ/năm học nhưng chưa có lớp hoặc chưa chốt lớp | Không điểm danh, không tự tạo nghĩa vụ thu |
| Sắp vào lớp | `SCHEDULED_TO_START` | Đã có kế hoạch nhập lớp/ngày bắt đầu nhưng chưa bắt đầu học | Không điểm danh, không tự tạo nghĩa vụ thu trước `startedOn` |
| Trong lớp | `ENROLLED` | Đang theo học chính thức | Đủ điều kiện mặc định cho attendance và collection run |
| Bảo lưu | `ON_LEAVE` | Nghỉ tạm, có khả năng quay lại | Không điểm danh/thu mới mặc định |
| Nghỉ học | `WITHDRAWN` | Kết thúc học trong năm học, không phải tốt nghiệp | Không điểm danh/thu mới; ledger cũ vẫn xử lý |
| Tốt nghiệp | `GRADUATED` | Hoàn thành năm học/chương trình | Không điểm danh/thu mới; giữ lịch sử |

Finance preview dùng enrollment/class tại thời điểm generate; invoice snapshot không đổi nếu học sinh đổi lớp/trạng thái sau đó. Attendance chỉ cho ghi nhận học sinh `ENROLLED` trong ngày liên quan, trừ `TRIAL` khi trường phát hành workflow ngoại lệ được audit.

Transition baseline:

```text
WAITING_FOR_CLASS -> SCHEDULED_TO_START -> ENROLLED
TRIAL -> ENROLLED
TRIAL -> WAITING_FOR_CLASS | WITHDRAWN
ENROLLED -> ON_LEAVE | WITHDRAWN | GRADUATED
ON_LEAVE -> ENROLLED | WITHDRAWN
```

Không cho chuyển ngược `WITHDRAWN`/`GRADUATED` thành `ENROLLED` bằng thao tác status thường. Trẻ quay lại dùng workflow re-enrollment có lý do/audit; nếu thuộc năm học mới, tạo enrollment mới.

### 4.3 `ParentProfile` và `StudentParent`

`ParentProfile` là contact/profile toàn platform, không chứa `schoolId`: tên và số điện thoại bắt buộc khi School Admin tạo trước login, trạng thái active/inactive và metadata identity tối thiểu. ParentProfile tham chiếu `UserIdentity`; email normalized/Google subject canonical chỉ nằm trên UserIdentity, không nhân bản thành identity riêng cho Parent. Khi School Admin tạo ParentProfile/link bằng email, API tìm hoặc tạo UserIdentity pending theo email normalized; lần login Google verified đầu tiên bind Google subject vào identity đó. Số điện thoại là phương tiện liên lạc vận hành; Parent được tự cập nhật số điện thoại của chính mình trong Parent portal. Thay đổi lưu actor/timestamp/giá trị cũ-mới, không đổi UserIdentity hoặc quyền `StudentParent`, và chưa yêu cầu OTP/SMS verification ở release đầu.

`StudentParent` là liên kết nhiều-nhiều:

- `studentId`, `parentId`, `status` `ACTIVE`/`REVOKED`, `linkedAt`, `revokedAt`, `revokedBy`.
- `StudentParent` không có `schoolId`: mọi school context, authorization và unique query được suy ra/validate qua `Student.schoolId`. Không tạo một ParentProfile mới khi cùng Parent đã có trẻ ở trường khác.
- `relationshipLabel` tùy chọn, ví dụ Mẹ/Bố/Người giám hộ; chỉ là nhãn hiển thị, không quyết định authorization.
- `canViewParentPortal`, `canViewObligations`, `canViewPaymentInstructions` mặc định true khi link `ACTIVE` trong release đầu.
- `canViewFinancialLedger`, `canReceiveFinancialNotices`, `canApprovePickupChange` chỉ thêm khi các domain tương ứng được phát hành; default deny. Parent không xem receipt/allocation/nộp trước/debt ledger chi tiết, không sửa dữ liệu finance hoặc xác nhận payment. Ngoại lệ release đầu: Parent tạo/xem/hủy/sửa leave request khi request còn pending và nhận attendance-event notification; Parent không xem evidence ảnh.
- Revoke chặn request Parent tiếp theo, xóa state client và không xóa lịch sử link/audit.

Sau Google OAuth với email verified, API bind Google subject vào UserIdentity pending khớp email và dùng ParentProfile đã liên kết lần đầu. Lần login sau Google subject trên UserIdentity phải khớp; subject thay đổi/email bị cấp lại bị từ chối đến khi School Admin revoke và grant lại link. Parent portal vẫn dùng callback, cookie, CSRF scope và ParentSessionGuard riêng, với session audience `parent`; không có password mặc định, reset password hay SMS/OTP fallback ở release đầu. Parent profile self-edit release đầu chỉ gồm số điện thoại; email identity, Parent link và quyền vẫn do trường quản lý.

Parent có link `ACTIVE` ở một trường được vào thẳng home của trường đó. Khi có active Parent portal links ở nhiều trường, `parent.passionedu.org` hiển thị chọn trường; mọi child/obligation/payment request vẫn scoped và authorize theo school context. Revoke một link chỉ xóa data của trẻ/trường đó; chỉ sign-out khi Parent không còn Parent portal link `ACTIVE` nào.

### 4.4 Parent access sau khi enrollment kết thúc

Khi StudentEnrollment chuyển `ON_LEAVE`, `WITHDRAWN` hoặc `GRADUATED`, Parent link không tự revoke. Không tạo obligation mới do enrollment đó không còn `ENROLLED`. Quyền xem dữ liệu vận hành của trẻ và quyền settlement finance được áp dụng độc lập.

- Dữ liệu vận hành/nhạy cảm của enrollment có retention đúng 30 ngày lịch kể từ `StudentEnrollment.endedOn`. `endedOn` là field bắt buộc khi chuyển enrollment sang `ON_LEAVE`, `WITHDRAWN` hoặc `GRADUATED`; API không dùng ngày Admin thao tác hay close date collection run để tính quyền.
- Finance settlement (`ISSUED` invoice, payment instruction, receipt/refund và trạng thái outstanding) vẫn hiển thị khi còn balance, nộp trước hoặc refund/reversal chưa quyết toán. Khi tất cả đã settled, `ParentAccessPolicy` của School áp dụng retention finance riêng có `effectiveFrom`, audit/version; Parent PWA không tự tính ngày hết hạn.
- Khi retention tương ứng hết hạn, API từ chối surface protected đó dù `StudentParent` link vẫn retained; School Admin có thể revoke link sớm khi cần.
- Đây là policy quyền xem, không xóa invoice, receipt, audit hoặc Parent link. Hết hạn tại một trường không ảnh hưởng active links hợp lệ của Parent ở trường khác.

Không trả số điện thoại, nghề nghiệp, lịch sử finance hay link của phụ huynh khác cho Parent PWA trừ trường dữ liệu thật sự cần thiết.

### 4.5 `Staff`, role và assignment lớp

`Staff` là identity vận hành tách Admin. Một người có thể là Staff và có session Google; Admin privilege không tự suy ra từ title nhân sự.

| Model | Quy tắc |
| --- | --- |
| `Staff` | Họ tên, email contact normalized tùy chọn, số điện thoại, ngày sinh, giới tính, địa chỉ, `ACTIVE`/`SUSPENDED`/`INACTIVE`, audit; không tự tạo login/membership |
| `StaffRoleGrant` | Role enum/permission set, effective start/end, granted/revoked by Admin; không dùng text `Giáo viên` làm auth |
| `StaffClassAssignment` | staff, class, effective start/end, reason/audit; many-to-many; không có assignment type giáo viên chính/phụ ở release đầu; inactive staff/lớp không nhận assignment mới |

Staff profile và quyền login tách biệt. Tạo/sửa `Staff` không cấp access portal; chỉ `UserIdentity` có `SchoolMembership` active và `SchoolRoleGrant` mới login/truy cập `app.passionedu.org`. Một staff profile có thể được liên kết UserIdentity/membership sau khi School Admin cấp role, nhưng Staff chưa có login vẫn là staff hợp lệ cho roster/assignment. Role release đầu nên cực nhỏ và tách theo capability: `SCHOOL_ADMIN`, `FINANCE_MANAGER`, `ATTENDANCE_RECORDER`, `HANDOVER_RECORDER`, `CLASS_TEACHER`.

Staff profile không cần học vấn, kinh nghiệm, thành tích, hợp đồng, lương hoặc password ở release đầu. Quyền self-edit số điện thoại của Staff chưa chốt; release đầu School Admin quản lý Staff profile.

### 4.6 Năm học, lớp và calendar đã chốt

`SchoolYear` gồm `name`, `startsOn`, `endsOn` và `DRAFT`/`ACTIVE`/`CLOSED`; chỉ `SCHOOL_ADMIN` tạo, kích hoạt hoặc đóng. Mỗi trường có tối đa một năm học `ACTIVE`.

- Khi đóng năm học, School Admin dùng wizard batch để đóng `SchoolYear` và kết thúc `EnrollmentClassAssignment` tại `SchoolYear.endsOn`, có preview, confirmation, idempotency và audit; không buộc thao tác từng trẻ hoặc đổi status enrollment lịch sử.
- `GRADUATED` chỉ dành cho trẻ thực sự hoàn thành/chuyển cấp rời trường; `WITHDRAWN` cho rút học và `ON_LEAVE` cho bảo lưu. Enrollment của năm học đã đóng giữ `ENROLLED` như lịch sử hoàn thành năm học, không cần status `year completed` mới.
- `Class` là cohort thuộc một `SchoolYear`, không phải một record dùng lại xuyên nhiều năm. Khi tạo năm học mới, School Admin tạo/chọn các lớp đích của năm mới; lớp có thể đổi tên/phạm vi tuổi, ví dụ lớp nguồn `3-4 tuổi` thành lớp đích `4-6 tuổi`. Điều này giữ tên lớp của năm cũ bất biến trong lịch sử.
- Wizard chuyển năm/chuyển cả lớp cho phép chọn từng trẻ từ một lớp nguồn rồi map sang lớp đích thuộc SchoolYear mới. Khi gán lớp đích, wizard tạo `StudentEnrollment` mới có status `ENROLLED` và `EnrollmentClassAssignment` bắt đầu từ ngày hiệu lực; không sửa enrollment năm cũ.
- Không bắt buộc chuyển toàn bộ lớp nguồn sang một lớp đích: School Admin có thể chọn một phần trẻ sang `4-6 tuổi`, để trẻ khác vào một lớp mới cùng tên `3-4 tuổi`, lớp đích khác, hoặc bỏ khỏi batch để xử lý `GRADUATED`, `WITHDRAWN`, `ON_LEAVE` hay workflow riêng có lý do/audit.
- Chuyển lớp trong cùng năm lưu `EnrollmentClassAssignment` có `startsOn`, `endedOn`, actor và reason; không chỉ overwrite `classId`. Chuyển hàng loạt dùng wizard mapping lớp đích, preview, confirmation và idempotency.
- Finance snapshot enrollment/lớp lúc generate; không tự prorate khi chuyển lớp. Mọi khoản điều chỉnh dùng refund/adjustment có lý do/audit. `Cơ sở vật chất` không có policy hệ thống theo ngày nhập học; nếu School dùng đơn vị `năm theo ngày nhập học`, kế toán điều chỉnh invoice `DRAFT` có ghi chú/audit.
- Calendar chung theo toàn trường gồm working weekdays, ngày nghỉ/lễ và ngày học bù. Đây là scope đúng cho release đầu của trường mầm non; chỉ `SCHOOL_ADMIN` sửa. Nếu một trường thực tế cần lịch/policy riêng theo lớp hoặc chương trình, đó là extension domain rõ ràng với override/effective date, không dùng adjustment thủ công để giả lập. Thay đổi calendar không tính lại finance/attendance lịch sử; API/policy snapshot là source of truth.

### 4.7 Chính sách mã học sinh đã chốt

Release đầu server sinh `studentCode` theo prefix đã cấu hình trên `School`, rồi nối sequence tăng dần trong school scope. Ví dụ Ánh Hoa có prefix `AH` sẽ sinh `AH1`, `AH2`, `AH3`.

- Sequence phải được cấp trong database transaction, unique trong `schoolId`, không tái sử dụng khi học sinh inactive/rút học và không dựa vào số dòng UI.
- Admin không nhập hoặc sửa mã ở UI release đầu; mã vận hành và UUID kỹ thuật là hai định danh khác nhau.
- Schema/API giữ khả năng extension cho trường hợp import/manual sau này: một workflow quyền hẹp có thể nhận code đã validate, unique trong trường, lưu `codeSource`/audit và không sửa mã đã được tham chiếu bởi enrollment, finance, attendance hoặc handover.
- Không thêm field/UI manual code, import CSV hay behavior compatibility trước khi có trường hợp vận hành thật và PRD riêng.

## 5. Cần chú ý đặc biệt

- **Bảo mật trẻ em:** ngày sinh, giới tính, ảnh, người giám hộ và trạng thái sức khỏe là dữ liệu nhạy cảm; list API phải trả tối thiểu theo role/surface.
- **Năm học không phải filter UI:** nó là boundary dữ liệu cho enrollment, lớp, calendar, attendance, collection run và báo cáo.
- **Không tự động chuyển lớp toàn trường giữa năm học** chỉ vì tạo year mới. Phải có wizard preview, destination class mapping, confirmation và idempotency.
- **Mã học sinh không tái sử dụng**, kể cả khi học sinh rút học. UUID vẫn là primary key kỹ thuật.
- **Mối quan hệ Parent-Học sinh và quyền đón** không giống nhau. Một Parent có thể xem finance nhưng người khác mới được nhận bàn giao; tạo `PickupAuthorization` domain riêng khi làm đưa đón.
- **Staff account dùng chung** như một tài khoản “Điểm danh” có thể tiện trước mắt nhưng làm mất audit. Nếu cần kiosk, dùng device/session scoped theo lớp và buộc chọn Staff xác nhận, không dùng password chung.
- **Xóa mềm:** học sinh/parent/staff/enrollment có status/revoke; không hard delete nếu đã có invoice, attendance, handover, notification hoặc audit.

## 6. IA và báo cáo đề xuất

`Danh bộ` có các section thay vì ba tab bảng đơn giản:

- Học sinh: theo năm học, status bucket, lớp, tuổi, code; detail gồm enrollment history, parent links, finance summary, attendance summary theo permission.
- Phụ huynh: profile, identity state, các học sinh liên kết, link/revoke audit; không có reset password với Google-only.
- Nhân viên: profile tối thiểu, active state, role grants, class assignments và audit quyền.
- Năm học: kỳ, trạng thái, lớp/enrollment count, transition wizard.

Dashboard nên có các chỉ số có thể hành động: học sinh chờ phân lớp, Parent chưa kích hoạt, Parent chưa liên kết, lớp chưa có người phụ trách điểm danh và Staff assignment hết hạn.

## 7. Câu hỏi chặn

1. Staff nào được đăng nhập ngay giai đoạn attendance? Có cần kiosk/tablet tại cổng hoặc từng lớp không?
2. Đã chốt: khả năng import dữ liệu lịch sử sẽ được xử lý sau khi core đi vào vận hành. Khi bắt đầu, tạo migration/onboarding plan riêng với preview, validation, duplicate policy, idempotency, audit và error export; không đưa vào clean-break release đầu.

## 8. Bước tiếp theo

Tạo PRD riêng cho `Năm học, danh bộ và phân quyền vận hành` trước khi mở attendance/handover. Finance ledger có thể dùng Student và Parent link nền hiện tại, nhưng collection run, công nợ và parent notice nên chuyển sang `StudentEnrollment`/`SchoolYear` trước production dữ liệu thật.

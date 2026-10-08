---
name: Học sinh chỉ học ngoại khóa
status: approved
approved: 2026-10-08
date: 2026-10-08
trigger: Một số bé không theo học chính khóa ở trường nhưng tham gia lớp ngoại khóa (ví dụ Tiếng Anh buổi tối). Hiện hệ thống không có cách ghi danh các bé này mà không xếp lớp chính khóa; Đợt thu bỏ qua bé không có lớp chính khóa (`NO_CLASS_ASSIGNMENT`) nên không thu được khoản ngoại khóa; còn xếp vào một lớp chính khóa thì bé bị tính toàn bộ khoản thu cố định (học phí, tiền ăn).
mode: incremental
amends: PRD §Roster (dòng 134-142), §Finance (dòng 62, 170-171, 185-186, 192); addendum dòng 32-34; sprint-change-proposal-2026-10-02-receivable-kinds-and-extracurricular-classes.md ("ngoại khóa không tạo eligibility")
---

# Sprint Change Proposal - Học sinh chỉ học ngoại khóa

## 1. Vấn đề

Trường có học sinh chỉ đến học lớp ngoại khóa. Theo người dùng (2026-10-08):

1. Bé là học sinh bình thường về mọi mặt (hồ sơ, phụ huynh, cổng phụ huynh, hóa đơn), chỉ khác là không học chính khóa.
2. Điểm danh tùy lớp ngoại khóa: lớp trong giờ chính khóa không cần, lớp buổi tối có thể cần. Thêm tùy chọn `Điểm danh riêng` khi tạo lớp ngoại khóa; phần điểm danh thực sự làm sau.
3. Bé có thể chuyển sang học chính khóa giữa năm (hoặc ngược lại); chỉ cần ghi nhận vào hồ sơ.

Hiện trạng code:

- Vòng đời enrollment không có trạng thái cho bé học ở trường mà không có lớp chính khóa; ghi danh chỉ có `Xếp lớp` / `Chờ xếp lớp`; chuyển sang `ENROLLED` bị chặn nếu chưa có lớp (`ENROLLMENT_CLASS_REQUIRED`).
- Đợt thu chỉ chọn học sinh có lớp chính khóa hiệu lực ngày đầu tháng; dòng ngoại khóa chỉ gắn vào học sinh đã đủ điều kiện.
- Hóa đơn bắt buộc snapshot lớp (`classIdSnapshot`, `classNameSnapshot` NOT NULL); tài khoản cá nhân mặc định lấy theo lớp.

## 2. Quyết định

### 2.1 Trạng thái mới `Chỉ ngoại khóa`

- `StudentEnrollmentLifecycle` thêm giá trị `EXTRACURRICULAR_ONLY`, nhãn **`Chỉ ngoại khóa`**: bé đang học ở trường, chỉ tham gia lớp ngoại khóa, không có lớp chính khóa.
- Bất biến: enrollment `EXTRACURRICULAR_ONLY` không có `EnrollmentClassAssignment` đang mở và `classId`/`className` là null.
- Trạng thái trả lời đồng thời "còn học hay đã nghỉ" và "chính khóa hay chỉ ngoại khóa"; không có cờ riêng.
- `ENROLLED` (`Đang nhập học`) giữ nghĩa học chính khóa và vẫn bắt buộc có lớp. `WAITING_FOR_CLASS` (`Chờ xếp lớp`) giữ nghĩa sẽ vào chính khóa, đang chờ chỗ.

### 2.2 Ghi danh và chuyển trạng thái

Mọi chuyển trạng thái dùng lệnh đổi vòng đời hiện có (ngày hiệu lực, lý do, Operation, audit).

| Từ | Sang | Điều kiện / tác động |
| --- | --- | --- |
| Ghi danh mới | `Chỉ ngoại khóa` | Form ghi danh thêm lựa chọn thứ ba `Chỉ ngoại khóa` cạnh `Xếp lớp` / `Chờ xếp lớp`; không chọn lớp, không tạo assignment |
| `Chỉ ngoại khóa` | `Đang nhập học` | Bắt buộc chọn lớp chính khóa; tạo assignment từ ngày hiệu lực (dùng lại form xếp lớp) |
| `Đang nhập học` | `Chỉ ngoại khóa` | Kết thúc assignment đang mở tại ngày hiệu lực |
| `Chờ xếp lớp` | `Chỉ ngoại khóa` | Bé học ngoại khóa trong lúc chờ chỗ chính khóa |
| `Chỉ ngoại khóa` | `Tạm nghỉ` | Như học sinh thường; hết tạm nghỉ thì quay lại `Chỉ ngoại khóa` (không cần lớp) |
| `Chỉ ngoại khóa` | `Đã thôi học` | Như học sinh thường |

- Thành viên lớp ngoại khóa không tự kết thúc khi chuyển trạng thái; giữ hành vi hiện có với các trạng thái kết thúc.
- Một tháng bé không thuộc lớp ngoại khóa nào thì Đợt thu bỏ qua bé (`NO_APPLICABLE_LINES`); trạng thái không tự đổi. Kế toán chuyển `Đã thôi học` khi bé thật sự nghỉ.
- Chuyển năm học: preview chuyển năm đi theo lớp chính khóa nên không gồm bé `Chỉ ngoại khóa`; năm sau ghi danh lại bằng lựa chọn `Chỉ ngoại khóa`. Chuyển năm cho nhóm này để sau nếu có nhu cầu.

### 2.3 Nơi nhận / không nhận trạng thái `Chỉ ngoại khóa`

Mỗi chỗ đang kiểm tra `ENROLLED` được quyết định riêng; chỗ không liệt kê ở cột nhận giữ nguyên (không thấy bé).

| Nhận `EXTRACURRICULAR_ONLY` | Không nhận |
| --- | --- |
| Thêm thành viên lớp ngoại khóa và danh sách ứng viên (`membershipLifecycles`) | Điểm danh, nhật ký, đơn nghỉ theo lớp, giáo viên chính khóa |
| Đợt thu (theo §2.4), thêm học sinh vào run đã tạo, hóa đơn thủ công | Sĩ số và chỉ số tổng quan hằng ngày |
| Cổng phụ huynh: thông tin, hóa đơn, hộp thư, gửi đơn nghỉ | Chuyển năm học, đóng năm học (không có assignment để kết thúc) |
| Danh sách đón trả (cần cho lớp buổi tối) | Gói nộp trước / coverage học phí (chỉ áp dụng chính khóa) |
| Danh bộ, bộ lọc trạng thái, chọn học sinh cụ thể cho phạm vi khoản linh hoạt | |

### 2.4 Đợt thu

Ngày xét vẫn là ngày đầu tháng thu.

| Học sinh tại ngày xét | Dòng nhận |
| --- | --- |
| `ENROLLED`, có lớp chính khóa đang hoạt động | Như hiện nay |
| `EXTRACURRICULAR_ONLY` | Chỉ dòng `EXTRACURRICULAR` của lớp ngoại khóa có thành viên trong tháng và dòng `FLEXIBLE` phạm vi **Học sinh cụ thể** chọn đích danh bé |

- Dòng `FIXED` và dòng `FLEXIBLE` phạm vi `Toàn bộ` hoặc `Lớp chính thức` **không** áp dụng cho bé `Chỉ ngoại khóa`. Nhãn phạm vi `Toàn bộ` thêm gợi ý `Học sinh chính khóa`.
- Bé không có dòng nào thì bị bỏ qua với lý do `NO_APPLICABLE_LINES` (`Không có khoản thu áp dụng.`).
- Câu "ngoại khóa không tạo eligibility" được thay bằng: enrollment `EXTRACURRICULAR_ONLY` đủ điều kiện **chỉ cho** dòng ngoại khóa và dòng chọn đích danh.
- Fingerprint xem trước gồm trạng thái enrollment nên đổi trạng thái sau khi xem trước làm preview stale.
- Bảng xem trước hiện lớp là `Chỉ ngoại khóa`; bộ lọc lớp có lựa chọn này.

### 2.5 Hóa đơn

- `Invoice.classIdSnapshot` và `classNameSnapshot` thành nullable; hóa đơn của bé `Chỉ ngoại khóa` lưu `null` và hiển thị `Chỉ ngoại khóa`. Snapshot hóa đơn cũ không đổi.
- Báo cáo/công nợ nhóm theo lớp hiển thị nhóm `Chỉ ngoại khóa`; bộ lọc lớp của danh sách hóa đơn có lựa chọn này.
- Tài khoản cá nhân khi phát hành: không có lớp nên không có tài khoản mặc định theo lớp; Finance chọn tài khoản trong hộp phát hành, cùng hành vi với lớp chưa đặt tài khoản mặc định (`PERSONAL_BANK_ACCOUNT_REQUIRED`). Nội dung chuyển khoản `{{studentName}} {{className}}` bỏ phần lớp khi rỗng.
- Ưu đãi và nghỉ phép trừ tiền giữ nguyên quy tắc (không phụ thuộc lớp).

### 2.6 Lớp ngoại khóa: tùy chọn `Điểm danh riêng`

- `ExtracurricularClass` thêm trường boolean `separateAttendance` (mặc định `false`), đặt trong hộp tạo lớp và hộp `Chỉnh sửa` (đổi kèm lý do, audit `EXTRACURRICULAR_CLASS_EDITED` before/after).
- Trang danh sách và chi tiết lớp hiện nhãn `Điểm danh riêng` khi bật.
- Đợt này **chỉ lưu và hiển thị**; không có màn điểm danh, giáo viên, lịch học ngoại khóa. Điểm danh ngoại khóa là thay đổi riêng sau.
- Bộ lọc `Lớp chính thức` trong hộp thêm thành viên lớp ngoại khóa thêm lựa chọn `Chỉ ngoại khóa`.

## 3. Invariant giữ nguyên

- Tenant root `School`; mọi query/mutation scope theo School; không tin `classId`/`studentId` từ browser làm bằng chứng authorization.
- Lớp ngoại khóa không dùng, không sửa `Class`, `EnrollmentClassAssignment`, `StaffClassAssignment`.
- Browser không gửi giá hay tổng tiền; server xác định dòng áp dụng và tính tiền.
- Snapshot Invoice/InvoiceLine đã tạo không bị rewrite.

## 4. Tác động

| Area | Impact |
| --- | --- |
| PRD / addendum / SPEC | Thêm `EXTRACURRICULAR_ONLY` vào danh sách vòng đời và quy tắc chuyển (PRD 134-142); sửa eligibility Đợt thu (PRD 138, 170, 185-186, 192; addendum 32-34); `ExtracurricularClass.separateAttendance`. SPEC ghi nhận. |
| UX spine / mockup | `EXPERIENCE.md`; mockup ghi danh / chi tiết học sinh (lựa chọn `Chỉ ngoại khóa`, chuyển trạng thái có chọn lớp), `extracurricular-classes.html` (`Điểm danh riêng`, bộ lọc), `invoice-generation.html` (lớp `Chỉ ngoại khóa`), `MOCKUP-COVERAGE.md`. |
| Epic 2 / Epic 5 | Story 2.6 (trạng thái, ghi danh, chuyển trạng thái), Story 5.46 (Đợt thu, hóa đơn, `Điểm danh riêng`). |
| API | Migration: enum `EXTRACURRICULAR_ONLY`, `Invoice.classIdSnapshot/classNameSnapshot` nullable, `ExtracurricularClass.separateAttendance`. Roster: `intakeStatus = EXTRACURRICULAR_ONLY`; `changeLifecycle` nhận lớp khi sang `ENROLLED` từ `EXTRACURRICULAR_ONLY`, kết thúc assignment khi sang `EXTRACURRICULAR_ONLY`. Các chỗ theo §2.3: `membershipLifecycles`, `selectionPreview`/`inScope`, parent session/attendance/inbox/leave, handover roster. Finance: tạo hóa đơn với snapshot lớp null (kể cả dòng hóa đơn quyết toán đang đọc `enrollment.classId`); `issueBankAccount` nhận lớp null. |
| Admin web / Parent web | Nhãn trạng thái mới; form ghi danh; hộp đổi trạng thái có chọn lớp; danh bộ; bảng xem trước Đợt thu; danh sách hóa đơn/báo cáo; hộp lớp ngoại khóa. Parent web không đổi giao diện. |
| Verification | Service test cho ghi danh và từng chuyển trạng thái ở §2.2; PostgreSQL integration: bé `Chỉ ngoại khóa` nhận đúng dòng ngoại khóa và dòng đích danh, không nhận `FIXED`/`Toàn bộ`/`Lớp chính thức`, đổi trạng thái làm preview stale, tạo và phát hành hóa đơn không lớp; parent API cho bé `Chỉ ngoại khóa`; web test các form. |

## 5. Phương án đã cân nhắc

- **Lớp chính khóa giả "Chỉ ngoại khóa"**: không cần code nhưng kế toán phải xóa tay học phí, tiền ăn mỗi tháng; lớp giả lẫn vào điểm danh, sĩ số và cổng phụ huynh. Loại.
- **Suy ra từ lịch sử phân lớp** (`ENROLLED` không có lớp hiệu lực tại ngày xét): chính xác theo ngày nhưng khó hiểu với người dùng và không phân biệt được với dữ liệu thiếu lớp do lỗi. Loại.
- **Cờ `extracurricularOnly` trên enrollment `ENROLLED`**: phải giữ cờ và lớp luôn khớp nhau; bé vẫn là `ENROLLED` nên lọt vào mọi nơi đang kiểm tra `ENROLLED` (điểm danh, sĩ số…) trừ khi sửa từng chỗ để loại ra. Trạng thái riêng thì chỗ chưa sửa mặc định không thấy bé. Loại.
- **Dùng `Chờ xếp lớp`**: lẫn bé không bao giờ cần xếp lớp vào danh sách chờ; phải nới các chỗ chỉ nhận `ENROLLED` cho cả bé thật sự đang chờ. Loại.

## 6. Story

### Story 2.6: Trạng thái `Chỉ ngoại khóa` và chuyển đổi với chính khóa

As a School Admin,
I want to enroll a Student who attends only extracurricular classes and later move them to or from an official class,
So that the Student has a normal record and parent access without a fake official class.

**Acceptance Criteria:**

**Given** the intake form
**When** the Admin chooses `Chỉ ngoại khóa`
**Then** an `EXTRACURRICULAR_ONLY` enrollment without class or class assignment is created and the roster shows the Student with status `Chỉ ngoại khóa`.

**Given** a `Chỉ ngoại khóa` Student
**When** the Admin changes the status to `Đang nhập học` with an official class, effective date and reason
**Then** a class assignment starts on that date with one Operation and audit; the change is refused without a class; extracurricular memberships are unchanged.

**Given** a `Đang nhập học` Student
**When** the Admin changes the status to `Chỉ ngoại khóa` with an effective date and reason
**Then** the open class assignment ends on that date.

**And** `Chờ xếp lớp → Chỉ ngoại khóa`, `Chỉ ngoại khóa → Tạm nghỉ → Chỉ ngoại khóa` and `Chỉ ngoại khóa → Đã thôi học` work without a class.

**And** the Parent of a `Chỉ ngoại khóa` Student sees the Student, invoices and inbox and can submit leave as for other Students; the Student appears in handover but not in class attendance, journal or the daily overview counts.

### Story 5.46: Đợt thu và hóa đơn cho học sinh `Chỉ ngoại khóa`; tùy chọn `Điểm danh riêng`

As a Finance user,
I want collection runs to bill extracurricular-only Students only for their extracurricular classes and lines chosen for them,
So that they never receive tuition or meal charges.

**Acceptance Criteria:**

**Given** an `EXTRACURRICULAR_ONLY` enrollment on the first day of the billing month with an extracurricular membership in that month
**When** Finance previews and generates the run
**Then** the Student is eligible with the extracurricular line and any `FLEXIBLE` line scoped to them by name, and receives no `FIXED`, `Toàn bộ` or `Lớp chính thức` line.

**And** such a Student with no applicable line is skipped as `NO_APPLICABLE_LINES`.

**And** the generated Invoice has no class snapshot, shows `Chỉ ngoại khóa`, and issuing a personal-channel part requires Finance to choose the account.

**Given** an extracurricular class
**When** Finance creates or edits it with `Điểm danh riêng`
**Then** the flag is saved, audited on edit, and shown on the class pages; no attendance behaviour changes.

## 7. Approval request

Duyệt quyết định §2 để cập nhật PRD/addendum/SPEC, UX spine, mockup, Epic 2 (Story 2.6), Epic 5 (Story 5.46) và `sprint-status.yaml`, sau đó implementation.

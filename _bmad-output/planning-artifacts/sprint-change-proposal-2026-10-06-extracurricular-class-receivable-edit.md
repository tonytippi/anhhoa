---
name: Đổi khoản thu của lớp ngoại khóa và sửa giá ngay từ trang lớp
status: approved
approved: 2026-10-06
date: 2026-10-06
trigger: Lớp ngoại khóa gắn cố định một khoản thu lúc tạo; sau đó chỉ đổi tên và ngừng/kích hoạt được. Người quản lý chỉ quan tâm hai đối tượng là lớp và khoản thu khớp với nhau, không có nhu cầu tạo lớp mới. Muốn một lớp dùng giá khác hiện phải tạo khoản thu mới, tạo lớp mới, kết thúc rồi thêm lại toàn bộ học sinh và ngừng lớp cũ; việc đổi giá phải rời trang lớp sang trang Khoản thu.
mode: incremental
amends: sprint-change-proposal-2026-10-02-receivable-kinds-and-extracurricular-classes.md §3.3 (khoản thu gắn lúc tạo; "các cột khác vẫn bất biến" khi đổi tên); sprint-change-proposal-2026-10-06-unified-receivable-edit.md (thêm điểm mở hộp `Chỉnh sửa` từ trang lớp)
---

# Sprint Change Proposal - Đổi khoản thu của lớp ngoại khóa và sửa giá ngay từ trang lớp

## 1. Vấn đề

Ở trang chi tiết lớp ngoại khóa, người quản lý cần làm được hai việc:

1. **Gán khoản thu khác cho lớp**: ví dụ lớp Grapeseed chuyển từ `Tiếng Anh bản ngữ · 600.000 đ/tháng` sang `Tiếng Anh nâng cao · 750.000 đ/tháng`, trong khi các lớp còn lại vẫn giữ khoản cũ.
2. **Sửa giá của khoản thu đang gắn**: ví dụ `Tiếng Anh bản ngữ` tăng giá, áp dụng cho mọi lớp dùng chung khoản đó.

Việc 2 đã có lệnh sửa (`PUT .../receivables/:receivableId`, proposal 2026-10-06 unified-receivable-edit) nhưng chỉ mở được từ trang Khoản thu. Việc 1 hiện không làm được nếu không tạo lớp mới và chuyển học sinh, khiến lịch sử thành viên bị cắt đôi và hóa đơn bị gắn cờ `Chuyển lớp trong tháng`.

## 2. Quyết định

### 2.1 Một hộp `Chỉnh sửa` cho lớp ngoại khóa

1. Nút `Đổi tên` trên trang chi tiết lớp đổi thành `Chỉnh sửa`. Hộp thoại có `Tên lớp`, `Khoản thu` (select các khoản Ngoại khóa đang áp dụng, mỗi lựa chọn `tên · giá/đơn vị`, hint `Dùng chung với: …` như form tạo lớp) và `Lý do` bắt buộc. Năm học hiển thị chỉ đọc.
2. Ghi chú cuối hộp (một dòng, chữ nhạt): đổi khoản thu chỉ áp dụng cho dòng hóa đơn tạo sau đó; hóa đơn đã tạo giữ nguyên, đợt thu còn nháp cần xem trước lại.
3. API: `PUT /api/app/schools/:schoolId/finance/extracurricular-classes/:classId` là lệnh sửa duy nhất của lớp. Body nhận các trường thay đổi (`name`, `receivableId`) và `reason` bắt buộc; trường vắng mặt giữ nguyên. Một Operation, một Idempotency-Key, một audit `EXTRACURRICULAR_CLASS_EDITED` với before/after (tên; id, tên và đơn giá khoản thu) và reason. Lỗi bất kỳ không lưu trường nào.
4. Audit `EXTRACURRICULAR_CLASS_RENAMED` đã ghi giữ nguyên; thay đổi mới chỉ ghi `EXTRACURRICULAR_CLASS_EDITED`.

### 2.2 Quy tắc đổi khoản thu

- Khoản thu mới phải cùng School, loại `EXTRACURRICULAR`, đang `ACTIVE`, và khác khoản hiện tại; sai thì từ chối với cùng lỗi như form tạo lớp (`RECEIVABLE_NOT_FOUND` hoặc lỗi trường `receivableId`), không đổi gì. Khoản thu không thuộc năm học nên không kiểm tra năm học.
- Làm được với lớp đang hoạt động và lớp ngừng hoạt động (như đổi tên).
- Thành viên, ngày hiệu lực và lịch sử tham gia của lớp không đổi. Lớp không bị tạo lại, không có cờ `Chuyển lớp trong tháng` do đổi khoản thu.
- Không có ngày hiệu lực cho việc đổi khoản thu, cùng nguyên tắc với sửa giá khoản thu (§3.5 proposal 2026-10-02):
  - InvoiceLine đã tạo giữ snapshot khoản thu, giá và provenance lớp; không rewrite Invoice DRAFT/ISSUED.
  - CollectionRun `DRAFT`: preview stale (fingerprint đã chứa khoản thu của từng lớp), phải xem trước lại; run `READY` bị chặn generate (`PREVIEW_STALE`) đến khi xem trước lại.
  - Run `GENERATED` trở đi: Student được thêm sau đó đọc khoản thu hiện tại của lớp tại thời điểm thêm, như §3.4 proposal 2026-10-02.
  - Đổi giữa tháng không prorate; cả tháng tính theo khoản thu lớp đang gắn khi dòng hóa đơn được tạo. Kế toán điều chỉnh dòng DRAFT kèm lý do nếu cần.
- Gộp dòng: Student thuộc nhiều lớp cùng khoản thu vẫn chỉ có một dòng; sau khi đổi, lớp được gộp theo khoản thu mới.
- Khóa loại khoản thu (§3.1 proposal 2026-10-02) tiếp tục suy ra từ việc đang dùng: khoản mới bị khóa loại vì đã gắn lớp; khoản cũ chỉ còn khóa nếu đã có trên hóa đơn, template hoặc lớp khác.
- Mutation lấy `FOR UPDATE` trên lớp và khoản thu mới; quyền như quản lý catalog Finance.

### 2.3 Sửa giá khoản thu từ trang lớp

1. Dòng phụ dưới tên lớp hiển thị khoản thu kèm nút nhỏ `Sửa giá` cạnh `tên khoản · giá/đơn vị`.
2. `Sửa giá` mở đúng hộp `Chỉnh sửa khoản thu` của trang Khoản thu (cùng component, cùng lệnh `PUT .../receivables/:receivableId`, cùng validation giá hoàn trả và thuế), ngay trên trang lớp; lưu xong trang lớp tải lại giá mới.
3. Khi khoản thu đang dùng cho nhiều lớp, hộp `Chỉnh sửa khoản thu` (ở cả hai trang) hiện một dòng: `Đang dùng cho N lớp ngoại khóa: A1, A2.` để người sửa biết giá mới áp dụng cho những lớp nào. Dữ liệu này do API trả về.
4. Không thêm phiên bản giá theo ngày hiệu lực.

## 3. Invariant giữ nguyên

- Tenant root `School`; mọi query/mutation scope theo School; không tin `receivableId`/`classId` từ browser làm bằng chứng authorization.
- Browser chỉ gửi tên, `receivableId` và lý do; không gửi giá, tổng tiền hay số học sinh. Server tính lại mọi giá trị.
- Snapshot InvoiceLine và provenance `EXTRACURRICULAR` không bị rewrite. Lớp ngoại khóa vẫn không dùng hay sửa `Class` chính thức.

## 4. Tác động

| Area | Impact |
| --- | --- |
| PRD / addendum / SPEC | PRD §Finance dòng lớp ngoại khóa và addendum mục `ExtracurricularClass`: lớp gắn đúng một khoản thu Ngoại khóa ACTIVE và đổi được kèm lý do; SPEC Finance ghi nhận quyết định này. |
| UX spine / mockup | `EXPERIENCE.md` (Lớp ngoại khóa), `mockups/admin/extracurricular-classes.html` (nút `Chỉnh sửa`, hộp `Chỉnh sửa lớp`, nút `Sửa giá`), `mockups/admin/receivable-configuration.html` (dòng `Đang dùng cho N lớp`), `MOCKUP-COVERAGE.md`. |
| Epic 5 | Thêm Story 5.41. |
| API | Mở rộng `PUT .../extracurricular-classes/:classId` nhận `receivableId`; audit `EXTRACURRICULAR_CLASS_EDITED`; DTO khoản thu trả danh sách lớp ngoại khóa đang dùng. Một migration nới trigger append-only của `ExtracurricularClass` cho cột `receivableId` và kiểm tra khoản thu mới như khi tạo. |
| Admin web | Hộp `Chỉnh sửa` thay `Đổi tên`; dùng lại hộp `Chỉnh sửa khoản thu` trên trang lớp. |
| Verification | Service/controller test cho khoản thu sai loại, inactive, khác School, trùng khoản cũ, lỗi không lưu tên; PostgreSQL integration cho preview stale sau khi đổi và Invoice đã tạo giữ snapshot; web test cho hai hộp thoại. |

## 5. Phương án đã cân nhắc

- **Giữ nguyên, tạo lớp mới khi đổi khoản thu**: người quản lý phải chuyển học sinh thủ công, lịch sử bị cắt và hóa đơn có cờ chuyển lớp. Loại.
- **Đổi khoản thu có ngày hiệu lực** (lưu lịch sử khoản thu theo ngày cho lớp): chính xác theo ngày nhưng phải tách dòng hoặc prorate trong tháng, trái với quy tắc một dòng mỗi khoản và không prorate. Để sau nếu có nhu cầu thật.

## 6. Story

### Story 5.41: Đổi khoản thu của lớp ngoại khóa và sửa giá từ trang lớp

As a Finance user,
I want to change which receivable an extracurricular class uses and edit that receivable's price from the class page,
So that the class and its charge stay matched without recreating the class or moving its Students.

**Acceptance Criteria:**

**Given** an extracurricular class and an `ACTIVE` `EXTRACURRICULAR` Receivable of the same School different from the current one
**When** Finance saves `Chỉnh sửa` with the new Receivable and a reason
**Then** the class uses the new Receivable, memberships are unchanged, one Operation and one `EXTRACURRICULAR_CLASS_EDITED` audit with before/after and reason are recorded.

**And** a Receivable of another kind, inactive, of another School or equal to the current one is refused and nothing (including the name) is saved.

**And** generated InvoiceLines keep their snapshot; a DRAFT run preview becomes stale and a READY run cannot generate until previewed again.

**Given** the class detail page
**When** Finance opens `Sửa giá`
**Then** the same `Chỉnh sửa khoản thu` dialog and command as the Khoản thu page are used, the dialog lists the extracurricular classes using the Receivable, and the class page shows the new price after saving.

## 7. Approval request

Duyệt quyết định §2 để cập nhật PRD/addendum/SPEC, UX spine, mockup, Epic 5 (Story 5.41) và `sprint-status.yaml`, sau đó implementation.

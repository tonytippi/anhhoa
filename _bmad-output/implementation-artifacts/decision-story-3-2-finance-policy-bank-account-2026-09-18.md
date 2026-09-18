# Quyết định: Contract FinancePolicy và BankAccount Story 3.2

**Ngày:** 2026-09-18
**Trạng thái:** Đã quyết định
**Phạm vi:** Story 3.2 Settings, FinancePolicy, School BankAccount và payment-instruction snapshot của Finance downstream

## Quyết định

`FinancePolicy` là typed, immutable và effective-dated theo `School`. Một version gồm:

- `dueDaysAfterIssue`: số nguyên từ `0` đến `365`; Finance tính hạn thanh toán từ ngày issue trong timezone `Asia/Ho_Chi_Minh`.
- `taxTreatment`: `NOT_APPLICABLE`, `TAX_INCLUDED` hoặc `TAX_EXCLUDED`; đây chỉ là label/snapshot, không tính VAT, thuế suất hay tạo VAT invoice.
- `debtScope`: `CURRENT_SCHOOL_YEAR_ONLY`; debt không được carry, transfer hay tự tạo nghĩa vụ mới sang SchoolYear khác.
- `reversalMode`: `DIRECT` hoặc `SCHOOL_ADMIN_APPROVAL`.
- `reason` optional khi tạo version policy; server có thể yêu cầu reason theo action/policy governance sau này.

Một `School` có thể có nhiều `BankAccount` active đồng thời. Account có immutable financial identity khi tạo: receiving bank, account number, account-holder name và transfer-content template. Không hard-delete hoặc sửa trực tiếp các field này; nhập sai thì deactivate account cũ và tạo account mới.

Transfer-content template duy nhất là `{{studentName}} {{className}}`. Khi issue Invoice, Finance render hai source fact snapshot rồi chuẩn hóa thành tiếng Việt không dấu; không cho literal text, placeholder khác, xuống dòng hoặc template tự do. Nội dung đã render trở thành Payment instruction snapshot bất biến của Invoice.

BankAccount được tạo ở `ACTIVE`; cho phép `ACTIVE -> INACTIVE` và `INACTIVE -> ACTIVE`, mỗi transition bắt buộc `reason`, lưu audit old/new và timestamp. Account inactive vẫn đọc được trong Settings/history nhưng Finance phải từ chối chọn nó cho Invoice mới. Story 3.2 chưa có Invoice nên không kiểm tra reference Invoice DRAFT khi deactivate.

## Lý do

Contract hẹp giúp Settings cung cấp policy và account history đáng tin cậy mà không biến nó thành pricing, tax, settlement hoặc Invoice domain. Template cố định bảo đảm content chuyển khoản nhất quán và không thể bị cấu hình sai ở School.

## Hệ quả

- Quyết định này thay thế rule default transfer content `studentCode + className` trong các source PassionEdu trước đó, cho phạm vi Story 3.2 và các Finance/Invoice story triển khai sau quyết định này. Invoice/payment instruction phải dùng `studentName + className` đã snapshot, chuẩn hóa không dấu.
- Finance không dùng BankAccount live để render hoặc viết lại Invoice đã issue.
- Migration/API/UI Story 3.2 dùng field/enums nêu trên; không thêm free-text tax, JSON policy, account edit/delete hay template editor.
- Epic 5/6 cần dùng `dueDaysAfterIssue`, `debtScope`, `reversalMode` và rendered account/template snapshot; không được khôi phục rule `studentCode` từ artifact cũ.

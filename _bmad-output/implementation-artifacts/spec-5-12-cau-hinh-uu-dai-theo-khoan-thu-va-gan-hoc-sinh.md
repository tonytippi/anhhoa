---
status: blocked
---

# Story 5.12: Cấu hình ưu đãi theo khoản thu và gán học sinh

## Auto Run Result

Status: blocked

Blocking condition: intent gap

Evidence:
- `epics-passionedu.md` yêu cầu version chứa fixed-VND/percentage, priority và stacking/exclusivity, nhưng không xác định lifecycle version, target gắn policy hay version, quy tắc overlap effective interval, hoặc semantics exclusivity.
- `promotion-configuration.html` chỉ mô tả một Receivable target và các trường loại giảm, mức giảm, hiệu lực, ưu tiên; không có stacking/exclusivity hay quantity/unit.
- `sprint-change-proposal-2026-09-10.md` yêu cầu target có `unit`/`appliedQuantity` cùng nhiều typed mode và wizard nhiều bước; phạm vi này khác observable surface Story 5.12/mockup.
- `spec-5-promotion-policy-phase-1b.md` đóng băng yêu cầu và ghi rõ thay đổi stacking/exclusivity phải Ask First. Không thể tự chọn schema/API/UI semantics mà không vi phạm contract UX hoặc tạo nền dữ liệu sai cho evaluator Story 5.13.

Unresolved questions:
- Target thuộc `PromotionPolicy` hay `PromotionPolicyVersion`, có bắt buộc `unit` và `appliedQuantity` trong Story 5.12 không?
- `stackingMode`/exclusivity có scope nào, priority cao hay thấp thắng, và version active có bất biến hay có thể chỉnh sửa?
- Ngày “Áp dụng đến” là inclusive hay exclusive; assignment/version overlap được phép theo quy tắc nào?

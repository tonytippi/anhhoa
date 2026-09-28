---
id: SPEC-prepaid-coverage-policy-term
companions:
  - implementation-contract.md
sources:
  - ../../planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md
  - ../../planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md
  - ../../implementation-artifacts/spec-6-2-dong-exact-invoice-co-promotion-coverage.md
  - ../../implementation-artifacts/decision-prepaid-coverage-draft-invoice-application-2026-09-28.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Nộp Trước Theo Thời Hạn Chính Sách

## Why

 PREPAID_COVERAGE đã có contract canonical để biến ưu đãi nộp trước N tháng thành một nghĩa vụ có snapshot và provenance, nhưng implementation hiện nhận các tháng coverage do Finance chọn thủ công. Điều đó không biểu đạt được chương trình “đóng trước 6 tháng giảm 10%”, tạo sai lệch giữa policy và Invoice, và cho phép dải kỳ thiếu hoặc tùy ý. Khi kế toán áp dụng policy trên Invoice DRAFT của một học sinh, server phải quyết định các kỳ liên tiếp được nộp trước và ưu đãi.

## Capabilities

- **CAP-1**
  - **intent:** Finance cấu hình một version `PREPAID_COVERAGE` có một thời hạn tháng dương, dùng chung cho một hoặc nhiều target Receivable để tạo ưu đãi theo thời hạn.
  - **success:** Policy “Học phí và tiền ăn, 6 tháng, giảm 10%” được persist, versioned, immutable sau ACTIVE/RETIRED và hiển thị rõ thời hạn nộp trước trong Finance.
- **CAP-2**
  - **intent:** Kế toán chọn version `PREPAID_COVERAGE` khi chỉnh sửa Invoice `DRAFT` của một Student để áp dụng ưu đãi nộp trước.
  - **success:** Request chỉ gửi version intent cho Invoice; API lấy `invoice.collectionRun.billingMonth` làm kỳ đầu, derive đúng số kỳ lịch liên tiếp theo policy, rồi trả Invoice DRAFT server-derived gồm period, gross, discount và net.
- **CAP-3**
  - **intent:** Server snapshot và phát hành coverage của toàn bộ thời hạn nộp trước mà không làm mất tính bất biến của Invoice và các kỳ thu sau.
  - **success:** Invoice DRAFT có đúng future receivable-period facts của target policy; chỉ close `EXACT` mới issue coverage immutable; các normal run sau chỉ skip đúng Student/SchoolYear/Receivable/period đã issue.

## Constraints

- `PREPAID_COVERAGE` vẫn thuộc normal `MONTHLY` CollectionRun; không có PREPAID run, generic balance, direct coverage creation, partial/excess/unallocated Receipt hoặc browser-derived money/eligibility/period.
- Mỗi version `PREPAID_COVERAGE` có đúng một positive consecutive-month term dùng chung cho mọi target; nếu cần term khác, Finance tạo policy version khác.
- Dải coverage bắt đầu đúng `invoice.collectionRun.billingMonth`, có đủ số tháng lịch liên tiếp theo version, nằm trong SchoolYear, version phải hiệu lực tại từng kỳ, và mọi fact phải có operating day eligible. Student phải có same-School `StudentEnrollment` trong SchoolYear bao phủ trọn service interval của từng fact; thiếu hoặc chỉ bao phủ một phần từ chối toàn bộ mutation. Direct Parent agreement là prerequisite offline, không có record hoặc reference trong hệ thống; StudentPromotionAssignment không là điều kiện cho fulfillment mode này.
- Future Invoice facts chỉ gồm Receivable target của policy; current-month Receivable không target vẫn có thể nằm trong Invoice, nhưng không có khoản tương lai không target.
- Với mỗi Student/Receivable/period, tối đa một policy được giảm giá. `PREPAID_COVERAGE` không stack với `DISCOUNT` trên fact covered; các line không liên quan tiếp tục dùng normal discount evaluator.
- Mọi read/write, FK/unique/guard, lock, audit và Operation scope theo School; API re-authorize trong transaction, validate origin/double-submit CSRF, dùng UUID `Idempotency-Key`, VND `BIGINT` và JSON-safe integer.
- Policy version, Invoice/Receipt provenance, issued future fact và issued coverage là immutable; policy/catalog/assignment thay đổi sau close không rewrite fact đã phát hành. Unissued DRAFT facts chỉ thay đổi atomically qua Invoice DRAFT coverage command.

## Non-goals

- Không thêm cadence daily/yearly, pricing theo kỳ tương lai, eligibility tự động từ Class/service/attendance, Parent self-service, hoặc thay đổi stacking/exclusivity của discount thường.
- Không để Finance chọn, thêm hoặc bỏ riêng từng tháng trong dải thời hạn policy; chỉ sửa policy version mới được đổi thời hạn hoặc target.
- Không thay đổi normal `MONTHLY` CollectionRun, settlement exact hoặc discount stacking/exclusivity ngoài các quyết định trong `decision-prepaid-coverage-draft-invoice-application-2026-09-28.md`.

## Success signal

- Với policy “Học phí và tiền ăn, 6 tháng, giảm 10%” và Invoice DRAFT của run tháng 2026-09, server tạo chính xác các fact tháng 2026-09 đến 2027-02 cho từng target, hoặc từ chối atomically nếu một kỳ không hợp lệ.
- Finance không còn có input chọn từng `billingMonth`; sau close `EXACT`, sáu run tương lai chỉ bỏ qua đúng học phí đã coverage, giữ nguyên các khoản thu khác.

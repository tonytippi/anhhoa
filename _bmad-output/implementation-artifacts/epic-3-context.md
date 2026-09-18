# Epic 3 Context: Chính sách trường học theo phiên bản

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Cho School Admin cấu hình hồ sơ, lịch và các policy có schema rõ ràng theo thời điểm hiệu lực. Mọi thay đổi phải có lịch sử và không được làm đổi nghĩa vụ Finance, dữ liệu vận hành hoặc media đã được snapshot. Epic tạo nền rule đáng tin cậy cho Epic 4, Finance và Payroll, nhưng không triển khai logic vận hành lớp hay tính tiền trên trình duyệt.

## Stories

- Story 3.1: Quản lý School profile và calendar có version
- Story 3.2: Cấu hình FinancePolicy và tài khoản nhận tiền có lịch sử
- Story 3.3: Cấu hình evidence điểm danh và trả trẻ theo policy typed
- Story 3.4: Audit và verification cho policy isolation/versioning

## Requirements & Constraints

- Chỉ School Admin có capability hợp lệ trong School đang chọn mới quản lý Settings. Server resolve membership, capability và trạng thái School ở mỗi request; route, UUID, filter, header và browser state chỉ là selector.
- Mọi aggregate Settings, query, unique constraint, audit và Operation phải có `schoolId`. Update/delete match đồng thời ID và `schoolId` trong transaction. Relation tenant dùng composite graph hoặc được kiểm toàn graph trong transaction.
- Settings là domain typed, versioned và effective-dated; cấm JSON blob hoặc key-value tự do thay schema. Thay policy phải tạo version mới, không overwrite dữ liệu đã snapshot.
- Business timezone là `Asia/Ho_Chi_Minh`. Dùng effective interval `[effectiveFrom, effectiveTo)` khi policy có khoảng hiệu lực. API phải trả kết quả calendar/policy theo ngày `as-of` trong timezone này.
- Mỗi thay đổi policy, access, attendance hoặc money lưu School, actor identity/reference, membership khi có, timestamp, provenance, old/new value và reason khi bắt buộc. Không hard-delete BankAccount.
- Profile và calendar thuộc School. Calendar thay đổi không hồi tính attendance, leave, Finance hoặc snapshot cũ. Client không tự suy ra ngày hoạt động, ngày nghỉ hay School context từ cache.
- Lịch mặc định chỉ đọc: Thứ Hai đến Thứ Bảy hoạt động, Chủ Nhật không hoạt động. Holiday là khoảng ngày bao gồm có tên; server từ chối khoảng sai thứ tự hoặc chồng lấn.
- FinancePolicy version gồm due date, tax-treatment label, debt settings trong SchoolYear và reversal mode `DIRECT` hoặc `SCHOOL_ADMIN_APPROVAL`. Không đưa logic pricing, settlement hoặc ledger vào Settings.
- BankAccount chứa receiving bank, account number, account-holder name và transfer-content template đã validate. Account active/inactive, cùng School; account inactive hoặc khác School không dùng cho Invoice mới. Snapshot Invoice đã issue vẫn đọc được và không đổi theo account hiện tại.
- AttendancePolicy và HandoverPolicy tách biệt, mỗi policy chỉ nhận `photoEvidenceMode` là `REQUIRED` hoặc `OPTIONAL`. `REQUIRED` phải được attendance domain enforce tại write boundary cho `PRESENT` hoặc `pickedUpAt`, không chỉ là hint UI.
- DailyJournalPolicy typed quản lý retention và media: Parent journal/media chỉ trong 30 ngày lịch sau `StudentEnrollment.endedOn`; JPEG, PNG hoặc WEBP, tối đa 10 MB mỗi ảnh, không giới hạn số ảnh mỗi journal. API enforce tại upload/read boundary; client không mở rộng retention, MIME, dung lượng hoặc tạo URL blob vĩnh viễn.
- Evidence attendance/handover chỉ Teacher có capability tương ứng hoặc School Admin cùng School đọc được. Parent DTO/media không chứa evidence. Blob/preview evidence bị xóa sau hai tháng lịch từ confirmation, nhưng metadata xóa vẫn audit.
- Mutation cookie-auth luôn kiểm origin và double-submit CSRF. Workflow nhiều record hoặc timeout dùng UUID `Idempotency-Key`, Operation scoped theo School, route và actor context; replay fingerprint giống nhau, từ chối fingerprint khác, và `GET /operations/:operationId` chỉ cho cùng actor context. Client phải reconcile trước retry.
- VND là PostgreSQL `BIGINT` và REST JSON-safe integer. API là nguồn duy nhất cho authorization, policy evaluation, state transition, snapshot, audit và money; portal chỉ gọi REST.
- Kiểm thử PostgreSQL phải chứng minh tenant isolation read/write, scoped uniqueness, policy version `as-of`, account lifecycle, audit scope và không rewrite snapshot. Test domain downstream phải chứng minh policy mới không đổi evidence/calendar source đã snapshot.

## Technical Decisions

- `settings` sở hữu aggregate write của Epic này. Controller chỉ gọi owning service; service dùng Prisma hoặc narrow service/query export, không gọi controller hay truy cập bảng domain khác tùy tiện.
- Prisma, migration, authorization, policy evaluation, snapshot, audit và Operation chỉ nằm ở API. Portal Admin không import API internals hay tự trở thành nguồn policy.
- Giữ integrity School xuyên profile, calendar version/range, FinancePolicy, BankAccount, attendance/handover policy và DailyJournalPolicy. Global identity không được dùng để bỏ qua School scope.
- BankAccount là configuration lịch sử, còn Finance sở hữu Invoice và snapshot Payment instruction lúc issue. Settings không sửa Invoice, Receipt, ledger hoặc outcome settlement.
- Attendance sở hữu enforcement evidence, evidence lifecycle và DailyJournal/versions/media. Settings chỉ xuất typed policy `as-of`; không trộn evidence của attendance/handover với DailyJournal media.
- DailyJournal hiện hành là một record theo `(schoolId, studentId, journalDate)`; sửa trong ngày tạo version audit bất biến. Upload/read phải re-authorize tenant graph và actor/Parent context; Parent chỉ nhận projection riêng trong retention.
- Các domain tiêu thụ policy phải gọi typed server result. Calendar/policy/account thay đổi sau source hay snapshot không được làm domain tự đọc giá trị hiện hành để viết lại lịch sử.

## UX & Interaction Patterns

- Surface là `Cấu hình trường` trong Admin desktop-first, gồm bốn tab: Thông tin trường, Lịch hoạt động, Tài chính & thanh toán, Điểm danh & bàn giao. Parent access là baseline server-enforced, không có tab hoặc toggle School.
- Luôn hiện School đang chọn trong heading; route change focus vào `h1`. Danh sách quản trị dùng table-first, nhãn tiếng Việt ngắn, trạng thái có chữ và row action có tên; dữ liệu so sánh không thay bằng chuỗi card giải thích.
- Form hiển thị active value, effective date và proposed value. Policy ảnh hưởng money, access hoặc attendance yêu cầu reason khi server yêu cầu. Chỉ hiển thị state server-confirmed.
- Calendar hiển thị lịch mặc định read-only và cho thêm holiday range bao gồm qua validation server. Error overlap/date order giữ input; lỗi field đặt cạnh trường và error summary nhận focus.
- Evidence settings hiển thị riêng `Bắt buộc` hoặc `Tùy chọn` cho ảnh `PRESENT` và `pickedUpAt`. Không hiển thị cutoff, grace, block policy hay form JSON tự do.
- Dirty form hoặc mutation chưa chắc chắn kích hoạt School switch guard: ở lại, bỏ trước submit, hoặc reconcile Operation; không autosave và không silent switch. Timeout khóa submit lặp, thông báo đang kiểm tra kết quả rồi refresh server state.
- Skeleton không hiển thị dữ liệu School cũ. Dialog có focus trap/return; validation và policy conflict dùng keyboard/screen reader được. Màu không là kênh trạng thái duy nhất.

## Cross-Story Dependencies

- Epic 3 phụ thuộc Epic 1 cho School-scoped authorization, CSRF, audit, idempotency/Operation, tenant graph và switch guard; phụ thuộc Epic 2 cho SchoolYear, enrollment và temporal context.
- Story 3.1 cung cấp calendar `as-of` cho leave, attendance, adjustment và Finance snapshot ở Epic 4-6.
- Story 3.2 cung cấp FinancePolicy và BankAccount active cho Catalog/Invoice issue; Invoice lịch sử chỉ dùng snapshot, không dùng account live.
- Story 3.3 cung cấp policy evidence và DailyJournal media governance cho Teacher/attendance ở Epic 4 và Parent projection ở Epic 7. Policy không tự tạo attendance, handover, journal, media hay Parent access.
- Story 3.4 là release proof chung: mọi story phải có negative cross-School, effective-version, audit và stale UI coverage trước khi các domain downstream dựa vào Settings.

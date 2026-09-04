# Báo cáo review đối kháng: Architecture Spine PassionEdu

**Tài liệu được review:** `ARCHITECTURE-SPINE.md` (draft, 2026-09-04)  
**Phạm vi:** Tìm các điểm ghép nơi hai đơn vị triển khai độc lập có thể cùng tuân thủ mọi AD hiện hữu nhưng vẫn không tương thích. Chỉ liệt kê phát hiện mức **Critical** và **High**.

## Phán quyết

**Không nên phê duyệt architecture spine để triển khai.** Không phát hiện Critical; có **8 phát hiện High**. Các AD đã xác lập được hướng tenant, ledger và portal đúng, nhưng chưa tạo được contract có thể kiểm chứng tại các ranh giới sở hữu và vòng đời. Nếu mỗi domain team tự diễn giải, hệ thống có thể vẫn “đúng AD” cục bộ nhưng gây leak Parent cross-school, post ledger hai lần, tạo adjustment tài chính sai, hoặc không hoạt động sau triển khai độc lập.

## High Findings

### H-01 — `ParentProfile` toàn cục không có hợp đồng sở hữu/bind nguyên tử giữa hai mô-đun

**Vị trí:** AD-2, dòng 58; AD-4, dòng 70; AD-6, dòng 82; Capability map, dòng 197.

**Cặp đơn vị độc lập:** `parents` tạo `ParentProfile` pending và `StudentParent`; `parent-auth` xử lý Google callback, tìm/bind `UserIdentity` và cấp session.

**Điều kiện gây lỗi:** Cả hai team đều có thể tuân AD-2 bằng cách chỉ gọi narrow export và tuân AD-4 bằng cách bind qua email, nhưng spine không chỉ định mô-đun nào sở hữu trạng thái/bất biến của `ParentProfile`, khóa định danh nào dùng khi bind, hay transaction/unique constraint nào bao toàn bộ chuỗi bind. Một request Admin tạo Parent pending và hai callback Google đồng thời, hoặc một callback đua với revoke/gán lại email, có thể được mỗi team xử lý theo transaction riêng.

**Hậu quả:** Một Google subject có thể bind hai ParentProfile, một ParentProfile có thể bind nhầm/re-bind subject, hoặc session được cấp từ link vừa revoke. Đây là lỗ hổng ủy quyền Parent và có thể lộ dữ liệu trẻ em giữa các School.

**Guard bắt buộc:** Chỉ định `parents` là chủ sở hữu aggregate `ParentProfile` và export một lệnh duy nhất, ví dụ `bindVerifiedGoogleIdentity(...)`, để `parent-auth` gọi. Chốt transaction boundary, normalized-email lookup semantics, các unique index (`googleSubject`, quan hệ ParentProfile--UserIdentity nếu 1:1), thứ tự khóa và kết quả idempotent cho pending/bound/revoked/reassigned. Lệnh phải kiểm active `StudentParent` ngay trước khi tạo session; thêm integration test cho callback đồng thời, revoke đồng thời và email reassignment.

### H-02 — Quy ước school scope cho Parent mâu thuẫn giữa route bắt buộc và scope suy diễn

**Vị trí:** AD-3, dòng 64; AD-4, dòng 70; Consistency conventions, dòng 120; Capability map, dòng 197.

**Cặp đơn vị độc lập:** `parent-portal` xây REST read model/route Parent; `authorization` xây guard lấy `schoolId` từ `/schools/:schoolId/` và capability context.

**Điều kiện gây lỗi:** AD-3 yêu cầu *mọi* operational route mang `/schools/:schoolId/` và resolve `SchoolMembership` + `SchoolRoleGrant`, trong khi Parent không có membership/role grant và AD-4 chỉ nói Parent context “derives” từ `StudentParent`. Không có định nghĩa endpoint Parent có phải mang `schoolId`, có được dùng selected-school trong session hay phải suy từ `studentId`/`invoiceId`, và guard nào là nguồn chân lý cho từng cách.

**Hậu quả:** Một implementation có thể dùng route schoolId và Parent-link guard, implementation khác suy school từ invoice sau khi fetch theo UUID. Cả hai đều đọc “minimum DTO”, nhưng nhánh sau có nguy cơ trả dữ liệu School B cho URL School A, hoặc làm Parent nhiều trường không thể đọc dữ liệu hợp lệ tùy controller.

**Guard bắt buộc:** Tách contract authorization Parent khỏi operational Staff contract: chốt một route shape duy nhất cho Parent (khuyến nghị `/parent/schools/:schoolId/...`) và một `ParentSchoolContext` resolver. Resolver phải xác minh session audience `parent`, ParentProfile bind và active `StudentParent` trong cùng truy vấn school-scoped trước mọi read/write. Cấm resolver suy scope từ resource UUID sau khi truy vấn không scope; thêm endpoint contract và E2E A/B chooser, forged schoolId, forged child/invoice UUID.

### H-03 — `Operation` dùng actor membership nhưng các mutation của Parent không có membership

**Vị trí:** AD-8, dòng 94; Consistency conventions, dòng 121.

**Cặp đơn vị độc lập:** `operations` triển khai key `(schoolId, actorMembership, route, idempotencyKey)` theo AD-8; `parent-portal`/`parents` triển khai Parent leave request có cookie-auth, CSRF và idempotency.

**Điều kiện gây lỗi:** AD-8 nói Operation luôn scope theo “actor membership”; AD-4 quy định Parent được authorize bởi `ParentProfile` + `StudentParent`, không phải `SchoolMembership`. Cả hai đơn vị có thể thực hiện đúng mô tả của mình, nhưng không thể cùng tạo một Operation hợp lệ cho Parent mutation mà không tự thêm `membershipId = null`, tạo membership giả, hoặc bỏ idempotency.

**Hậu quả:** Retry sau timeout của leave request có thể tạo nhiều request/adjustment source, `GET /operations/:operationId` không authorize đúng actor, hoặc Parent mutation bị từ chối không nhất quán. Các cách vá ad-hoc còn làm audit provenance không còn diễn tả actor thực.

**Guard bắt buộc:** Đổi contract Operation thành `actorType` + một actor reference bất biến: `SCHOOL_MEMBERSHIP`/`PARENT_PROFILE` (và Platform grant nếu Ops mutation idempotent), kèm `actorUserIdentityId` khi có. Chốt unique key, fingerprint, replay authorization và audit mapping cho từng actor type; `GET /operations/:operationId` phải kiểm chính actor context đã tạo operation. Test retry/revoke Parent link trong lúc operation chạy.

### H-04 — Attendance/leave và Finance không có hợp đồng tạo adjustment một lần, đúng hóa đơn đích

**Vị trí:** AD-2, dòng 58; AD-6, dòng 82; AD-7, dòng 88; Capability map, dòng 194 và 196.

**Cặp đơn vị độc lập:** `attendance` chấp thuận leave, loại ngày `PRESENT` conflict và tạo dữ liệu meal adjustment; `finance` chọn “Invoice DRAFT kế tiếp”, thêm adjustment và khóa Invoice khi issue.

**Điều kiện gây lỗi:** AD-7 bảo vệ Invoice/ledger nhưng không chỉ định ai sở hữu source adjustment, khi nào snapshot eligibility được đóng, khóa idempotency theo leave-day/source nào, hay chuyện gì xảy ra nếu invoice đích đã issue/void hoặc CollectionRun generate đồng thời. `attendance` có thể emit event sau approval; `finance` có thể polling source và cả hai vẫn hợp AD, nhưng cùng tạo adjustment hoặc chọn khác Invoice DRAFT.

**Hậu quả:** Giảm tiền ăn bị bỏ sót, bị trừ hai lần, hoặc được ghi vào invoice không còn là “kế tiếp”; invoice đã issue có thể bị cố sửa hay tạo manual credit không audit được nguồn. Đây là sai lệch nghĩa vụ và báo cáo tài chính.

**Guard bắt buộc:** Chốt một ownership flow: `attendance` chỉ ghi leave/eligibility source bất biến; `finance` độc quyền materialize adjustment qua exported command hoặc transactional outbox consumer. Định nghĩa khóa duy nhất theo source/day/receivable (hoặc source + target invoice), thuật toán xác định invoice đích tại một thời điểm nghiệp vụ rõ ràng, behavior khi chưa có/đã issue/void, và cơ chế retry. Kiểm thử approval, PRESENT conflict, generate/issue song song và retry event.

### H-05 — Không có protocol khóa/concurrency cho các writer ledger cùng một outstanding balance

**Vị trí:** AD-7, dòng 88; AD-8, dòng 94; Capability map, dòng 195.

**Cặp đơn vị độc lập:** luồng `receipt/allocation` phân bổ Receipt; luồng `prepayment`, `reversal/refund` hoặc `debt transfer` làm thay đổi số dư/nguồn có thể áp dụng.

**Điều kiện gây lỗi:** AD-7 yêu cầu append-only và derived status; AD-8 yêu cầu transaction cho workflow nhiều record. Nhưng không chốt isolation level, row/advisory lock, optimistic version hay constraint cho invariant “tổng Allocation + các khoản settlement không vượt outstanding/source còn lại”. Hai transaction khác idempotency key vẫn có thể cùng đọc outstanding trước khi append record.

**Hậu quả:** Hai receipt/prepayment hoặc receipt và debt transfer có thể over-allocate cùng Invoice; derived outstanding âm, refund/reversal vượt số tiền nguồn, và report có thể reconcile từng dòng nhưng sai tổng. Mỗi writer vẫn append-only và transaction-local đúng AD.

**Guard bắt buộc:** Finance phải công bố một settlement posting boundary duy nhất cho mọi Allocation/Prepayment application/DebtTransfer/Reversal/Refund. Chốt lock order và PostgreSQL isolation/conditional update strategy, các constraint amount/source còn lại, handling serialization failure qua idempotency Operation, và projection invariant. Thêm integration test cho các tổ hợp post song song cùng Invoice/source, không chỉ duplicate cùng idempotency key.

### H-06 — “Mọi business record có schoolId” chưa bảo vệ foreign key/join cross-tenant

**Vị trí:** AD-3, dòng 64; AD-6, dòng 82; AD-7, dòng 88; ER diagram, dòng 160-174.

**Cặp đơn vị độc lập:** `roster` tạo `Student`, `StudentEnrollment`, `Class`, `StudentParent`; `finance` tạo `CollectionRun`, `Invoice`, `Allocation` từ các foreign ID nhận qua narrow contracts.

**Điều kiện gây lỗi:** AD-3 yêu cầu mỗi record/query scope `schoolId`, nhưng không chốt composite foreign keys/unique constraints hoặc database assertion bảo đảm `Invoice.schoolId = Student.schoolId = CollectionRun.schoolId`, `StudentParent.schoolId = Student.schoolId`, và `Enrollment/Class/SchoolYear` cùng School. Một service có thể check input School trước khi gọi service khác; service kia có thể chỉ ghi `schoolId` vào row mới. Cả hai không cần cross-controller và vẫn đúng AD-2/AD-3 theo bề mặt.

**Hậu quả:** Một record có `schoolId` hợp lệ nhưng tham chiếu aggregate của School khác, từ đó làm rò Parent authorization, sai invoice/report, hoặc gây lỗi không thể phục hồi khi scoped query không còn join được record đã ghi.

**Guard bắt buộc:** Bổ sung mô hình integrity vào spine/schema contract: unique composite parent keys `(schoolId, id)` và composite FKs cho mọi quan hệ tenant-owned; với quan hệ không thể biểu diễn trực tiếp, một owning command phải verify toàn bộ graph trong transaction. Liệt kê ngoại lệ global hợp lệ (`UserIdentity`, `ParentProfile`, Platform grant) và đường liên kết tenant của chúng. Test trực tiếp insert/mutation cross-school cho từng join trong ERD.

### H-07 — Temporal roster chưa định nghĩa điểm đọc chuẩn cho Finance và snapshot

**Vị trí:** AD-6, dòng 82; AD-7, dòng 88; Capability map, dòng 193-196.

**Cặp đơn vị độc lập:** `roster` ghi Enrollment/class assignment theo effective date và close-year; `finance` tính CollectionRun scope, payment instruction `className`, invoice enrollment/class snapshot.

**Điều kiện gây lỗi:** Spine bắt buộc effective date/audit nhưng không định nghĩa effective timestamp/timezone, quy tắc interval boundary, “as-of” nào dùng cho generate/issue, hay precedence khi transfer và CollectionRun/close-year xảy ra trong cùng ngày. Roster team có thể coi `effectiveOn` inclusive theo ngày local; Finance team có thể lấy current active assignment khi generate. Cả hai đáp ứng temporal history và snapshot riêng.

**Hậu quả:** Học sinh chuyển lớp có thể được đưa vào sai scope/rule hoặc Payment instruction snapshot sai class; retry generate sau chuyển lớp có thể không tái tạo preview; close-year tạo invoice hoặc debt/read model gắn nhầm SchoolYear. Các lỗi này tác động tiền và tính giải trình lịch sử.

**Guard bắt buộc:** Chốt canonical business timezone của School, kiểu thời gian/interval `[effectiveFrom, effectiveTo)`, as-of timestamp của CollectionRun và các selection rule cho scheduled/closed year. Finance phải yêu cầu `roster` export một query snapshot versioned thay vì tự lọc bảng. Persist snapshot source IDs + effective facts tại generate/issue; test transfer/close-year ở boundary ngày và retry operation.

### H-08 — Deployment độc lập không có compatibility/migration protocol cho portal, API và schema

**Vị trí:** AD-1, dòng 52; AD-9, dòng 100; AD-10, dòng 106; AD-11, dòng 112; Deferred, dòng 204.

**Cặp đơn vị độc lập:** team/deployment `apps/parent-web` hoặc `apps/web` phát hành bundle REST mới; team API/Prisma phát hành endpoint, DTO, migration hoặc policy mới qua Compose.

**Điều kiện gây lỗi:** AD-1 yêu cầu portal build/deploy tách biệt và AD-10 chỉ quy định proxy/container/durable volume. Không có versioning contract, thứ tự expand/migrate/contract, readiness gate, rollback rule, hay cách giữ migration và static bundle tương thích trong thời điểm các container được thay thế khác nhau. Cả hai team vẫn triển khai độc lập đúng AD-1 và deploy Compose đúng AD-10.

**Hậu quả:** Portal mới gọi endpoint/DTO chưa có, API mới yêu cầu field/capability mà bundle cũ không gửi, hoặc migration làm API cũ lỗi. Với auth/policy thay đổi, lỗi rollout có thể hiện thành deny-all, session loop hoặc một route bỏ guard tạm thời để khôi phục sản phẩm.

**Guard bắt buộc:** Chốt deployment contract: API backward-compatible trong một release window, migration theo expand/backfill/contract, migration job chạy và được xác nhận trước API dependent, image digest/version manifest, health/readiness checks, rollback không rollback destructive migration, và smoke/E2E theo từng audience sau deploy. Khi không thể tương thích, bắt buộc coordinated release có maintenance gate thay vì “independent deployment”.

---
title: "Đối chiếu đầu vào với Architecture Spine PassionEdu"
status: review
created: 2026-09-04
baseline:
  - ARCHITECTURE-SPINE.md
sources:
  - ../../prds/prd-passionedu-2026-09-04/prd.md
  - ../../prds/prd-passionedu-2026-09-04/addendum.md
  - ../../sprint-change-proposal-2026-08-31.md
---

# Đối chiếu đầu vào với Architecture Spine PassionEdu

## Mục đích và phương pháp

Đối chiếu `ARCHITECTURE-SPINE.md` bản `draft` ngày 2026-09-04 với PRD và addendum `final` cùng proposal đã `approved`. Báo cáo chỉ ghi các mâu thuẫn hoặc thiếu sót có thể làm thay đổi schema, ranh giới bảo mật, state machine, contract API hoặc kiểm thử phát hành. Các chi tiết đã được spine bao phủ đầy đủ không được lặp lại.

## Tóm tắt kết quả

Phát hiện 6 điểm material: 1 mâu thuẫn/diễn đạt có thể chặn lifecycle Invoice hợp lệ và 5 thiếu sót về invariant Finance, bind/retention Parent, cache dữ liệu Parent và attendance evidence. Không tìm thấy mâu thuẫn material nào khác giữa topology multi-portal, tenant isolation, control plane, danh bộ theo thời gian, clean-break, stack hoặc thứ tự phát hành.

## Mâu thuẫn cần sửa trước khi chốt spine

### R-1. AD-7 làm mơ hồ hoặc phủ định việc `VOIDED` Invoice sau issue

**Nguồn:** Spine AD-7 ghi “an `Invoice` ... [is] immutable after issue”. PRD FR-9 chốt nội dung Invoice chỉ khóa khi issue; cùng lúc PRD FR-10 chốt Invoice có lifecycle `DRAFT`, `ISSUED`, derived `PARTIALLY_PAID`/`PAID`, `VOIDED` và chỉ được `VOIDED` khi chưa có allocation/prepayment.

**Mâu thuẫn:** Nếu “immutable after issue” được thực thi cho toàn record, không thể chuyển `ISSUED` sang `VOIDED`, trái FR-9/FR-10. Nếu ý định chỉ là không sửa nội dung nghĩa vụ, câu hiện tại không đủ chính xác để bảo vệ implementation khỏi hai cách hiểu khác nhau.

**Quyết định cần phản ánh trong spine:** Sau issue, các trường nội dung nghĩa vụ và payment instruction snapshot là bất biến. Chỉ state/settlement projection được thay đổi bởi workflow server-authoritative và ledger append-only. `VOIDED` chỉ hợp lệ khi chưa có allocation hoặc prepayment application; nếu đã có giao dịch, phải reversal/refund/adjustment có source, audit và idempotency, không sửa record ledger gốc.

**Tác động:** Prisma/model transition, service Finance, audit và integration test void-versus-posted-payment.

## Thiếu sót material trong spine

### O-1. AD-7 chưa chốt state machine và khóa vận hành của `CollectionRun`

**Nguồn:** PRD FR-8 và proposal mục 22 chốt lifecycle `DRAFT -> READY -> GENERATED -> CLOSED`, quyền sửa rule, rule/phạm vi bất biến sau `GENERATED`, giới hạn thêm đúng một Invoice `DRAFT` cho Student chưa có Invoice, và `CLOSED` không tạo/sửa Invoice. PRD cũng yêu cầu preview/generate giải thích các lý do skip tối thiểu.

**Thiếu:** AD-7 chỉ gọi `CollectionRun` “server-authoritative” mà không định nghĩa các ranh giới state/snapshot này. `AD-8` có idempotency cho generate nhưng không thay thế được quyền chuyển trạng thái hay điều kiện sau generate.

**Quyết định cần phản ánh trong spine:** Finance module phải sở hữu state machine trên; thay rule sau `READY` phải quay về `DRAFT`; `GENERATED` khóa rule/phạm vi snapshot; chỉ thêm Student chưa có Invoice; `CLOSED` chặn tạo/sửa Invoice. Preview và generate phải dùng cùng policy/query service và trả phân loại skip tối thiểu: Invoice tồn tại, enrollment không đủ điều kiện, không có lớp active, không có rule.

**Tác động:** State enum/schema, transaction boundary generate, endpoint/action contract, UI review flow và test idempotency/snapshot.

### O-2. Invariant settlement chưa ngăn allocation/prepayment vượt giới hạn

**Nguồn:** PRD FR-10 yêu cầu Receipt, Allocation và Prepayment là append-only; receipt thừa bị từ chối trừ khi tạo Prepayment rõ ràng; Prepayment chỉ cho Invoice tương lai của cùng Student. Proposal mục 18 và 20 xác định prepayment không được chuyển nhượng và reversal có policy direct/two-step.

**Thiếu:** AD-7 nói ledger append-only và status derived, nhưng chưa ràng buộc bảo toàn số tiền khi concurrent posting: tổng Allocation không được vượt Receipt hoặc outstanding Invoice; Prepayment application không được vượt số dư Prepayment/outstanding và không được đi sang Student khác. Không có invariant này, append-only vẫn có thể tạo ledger hợp lệ về cấu trúc nhưng sai số dư.

**Quyết định cần phản ánh trong spine:** Finance posting/allocation/prepayment application phải kiểm tra các giới hạn trên trong transaction có concurrency-safe locking/serialization phù hợp; overpayment phải bị từ chối hoặc đi qua workflow tạo Prepayment explicit, không tự sinh credit chung. Derived settlement/report chỉ đọc các ledger record đã qua các kiểm tra này.

**Tác động:** Thiết kế khóa giao dịch PostgreSQL, schema ledger, API validation và integration tests cho concurrent allocations/prepayment.

### O-3. AD-4 chưa bảo vệ đầy đủ bind Parent pending và retention truy cập Parent

**Nguồn:** PRD FR-6 yêu cầu bind `ParentProfile` pending theo normalized email diễn ra atomically sau Google verified; phải từ chối subject mismatch/email reassigned cho đến khi School Admin revoke và gán lại. PRD FR-14 yêu cầu dữ liệu vận hành/nhạy cảm hết quyền sau 30 ngày từ `StudentEnrollment.endedOn`; finance issued/settlement có ngoại lệ và sau settlement áp dụng `ParentAccessPolicy` server-side mặc định 12 tháng, version/audit. Proposal mục 13-14 xác nhận cùng boundary.

**Thiếu:** AD-4 chỉ nói Parent access “derives only from a bound global `ParentProfile` and active `StudentParent` links”, chưa có atomic pending-bind/reassignment guard và chưa đặt retention authorization server-side. Điều này để hở account takeover qua email reassignment và khả năng Parent endpoint trả dữ liệu quá hạn dù link lịch sử còn giữ.

**Quyết định cần phản ánh trong spine:** Parent-auth phải sở hữu bind pending atomically, bất biến association Profile--UserIdentity/Google subject sau bind, và workflow revoke/reassign có audit trước khi bind lại. Parent query/read-model phải áp dụng access window server-side theo `endedOn`, trạng thái settlement và `ParentAccessPolicy` versioned; client không tự tính retention.

**Tác động:** Ràng buộc dữ liệu identity, parent-auth service, Parent DTO query filters, audit và E2E cho reassignment/retention.

### O-4. Boundary cache dữ liệu Parent chưa cấm service-worker cache một cách rõ ràng

**Nguồn:** PRD FR-14 yêu cầu response Parent không được service worker cache; PRD FR-15 chỉ cho DTO/payment instruction snapshot tối thiểu. Proposal mục 13-14 và addendum xác nhận Parent là read model có dữ liệu trẻ em/finance nhạy cảm.

**Thiếu:** AD-4 yêu cầu data Parent memory-only và clear khi logout/expiry/401/revoke, nhưng memory-only không tự cấm Cache Storage hoặc runtime caching của PWA. Một service worker cache response protected vẫn có thể lộ dữ liệu sau khi client state đã được clear.

**Quyết định cần phản ánh trong spine:** `parent-web` không cache bằng service worker bất kỳ authenticated Parent API response, DTO, payment instruction hoặc media/evidence URL; API response phải có cache directive phù hợp. Cache clearing là lớp bổ sung, không thay thế chính sách không lưu protected response.

**Tác động:** PWA/service-worker configuration, HTTP cache headers và E2E/shared-device verification.

### O-5. AD-6/AD-11 chưa chốt vòng đời và quyền xem attendance evidence

**Nguồn:** PRD FR-12 chốt `AttendancePolicy.photoEvidenceMode` `REQUIRED | OPTIONAL`; `REQUIRED` từ chối `PRESENT` không có evidence. Evidence chỉ Staff có capability attendance hoặc School Admin cùng School xem, xóa blob/preview sau hai tháng lịch và giữ audit metadata xóa. Proposal mục 25 quy định Parent chỉ nhận notification event, không xem ảnh; proposal mục 172 cũng xác định evidence retained hai tháng, Staff/Admin-scoped.

**Thiếu:** AD-6 chỉ nói typed policy và AD-11 chỉ nêu E2E Parent cross-school; không có data-lifecycle/access invariant cho evidence. Đây là dữ liệu trẻ em nhạy cảm, nên chỉ ghi “attendance” trong ownership map không đủ để ngăn retention vô hạn, Parent DTO leak hoặc thực thi `REQUIRED` không nhất quán.

**Quyết định cần phản ánh trong spine:** Attendance module phải enforce `REQUIRED | OPTIONAL` tại write boundary, scope evidence read theo capability và `schoolId`, cấm Parent DTO/media access, xóa blob/preview sau hai tháng lịch từ confirmation và giữ metadata audit deletion. Integration/E2E phải chứng minh chặn `PRESENT` thiếu evidence, tenant/capability isolation và expiry cleanup.

**Tác động:** Storage model/job hoặc lifecycle process, signed/media access endpoint, authorization guard và verification matrix.

## Các điểm đã được spine bao phủ

- Tenant root `School`, route school-scoped, membership/capability per request, scoped uniqueness/audit/Operation và tenant-isolation gate: AD-2, AD-3, AD-8, AD-11.
- Ops control plane, `SUPERADMIN_EMAIL`, pending owner bootstrap, tách audience/cookie/portal và không có quyền School mặc định của Platform Operator: AD-4, AD-5.
- SchoolYear, enrollment/class assignment theo hiệu lực, student code server-generated và lifecycle retention không hard-delete: AD-6.
- VND `BIGINT`, snapshot account/payment instruction, Invoice uniqueness, ledger append-only, debt transfer và client không tự set settlement: AD-7.
- Clean-break, CSRF/origin/idempotency, backup gate, deployment topology và các release test nền tảng: AD-8 đến AD-11.

## Kết luận

Không nên chốt Architecture Spine ở trạng thái `final` trước khi R-1 và O-1 đến O-5 được quyết định và phản ánh. Các điểm này không mở rộng scope; chúng làm rõ các contract đã là yêu cầu `final` hoặc đã được proposal `approved` chốt, để schema, API và test không diễn giải khác nhau.

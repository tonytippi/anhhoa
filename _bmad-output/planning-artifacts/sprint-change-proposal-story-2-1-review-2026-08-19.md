---
title: "Sprint Change Proposal - Làm rõ contract Lớp sau review Story 2.1"
status: approved
approved: 2026-08-19
created: 2026-08-19
trigger: "BMad review of Story 2.1 implementation specification"
affected_epics: [2]
---

# Sprint Change Proposal - Làm rõ contract Lớp sau review Story 2.1

## 1. Issue Summary

Review Story 2.1 xác nhận hướng triển khai Lớp phù hợp MVP, nhưng phát hiện các contract còn mở khiến API, web và các Story phụ thuộc có thể tự suy diễn khác nhau. Các khoảng trống tập trung ở phân quyền REST, truy vấn danh sách, chuẩn hóa tên, transition archive lặp/concurrent, lifecycle của Lớp archived, bề mặt Student tối thiểu, error payload, retry mutation và kiểm chứng PostgreSQL.

Tony đã phê duyệt các quyết định sau:

- Mọi endpoint `/classes` yêu cầu Admin đã xác thực.
- Danh sách Lớp dùng thứ tự mặc định `createdAt DESC, id DESC`; page vượt tổng số trang trả `{ data: [], meta }`.
- Tên Lớp được trim, bắt buộc không rỗng sau trim, tối đa 100 ký tự và được phép trùng.
- Archive Lớp là idempotent: archive Lớp đã `ARCHIVED` trả resource hiện tại thành công.
- Lớp `ARCHIVED` chỉ đọc; API từ chối mọi update.
- Archive và mutation gán/kích hoạt Học sinh phải serialize/revalidate cùng Lớp trong transaction.
- Story 2.1 chỉ trả `activeStudentCount`; danh sách Học sinh thuộc bề mặt phân trang của Story 2.2.
- `CLASS_HAS_ACTIVE_STUDENTS` dùng payload lỗi chuẩn có `activeStudentCount` tại vị trí ổn định.
- Client không tự replay mutation sau khi write request bắt đầu; CSRF chỉ được lấy/làm mới trước request. Timeout của create/update giữ form để Admin đối soát danh sách trước khi gửi lại.
- Migration chạy trên PostgreSQL database sạch và archive có integration coverage; concurrency integration coverage hoàn tất khi Story 2.2 có mutation gán/kích hoạt Học sinh.

## 2. Impact Analysis

### Epic Impact

| Epic | Tác động | Hành động |
| --- | --- | --- |
| Epic 2 - Dữ liệu vận hành | Story 2.1 cần contract API/test rõ hơn; Story 2.2 phải kế thừa invariant transaction khi gán hoặc kích hoạt Học sinh. | Bổ sung acceptance criteria/refinement tasks, không thêm Story hoặc Epic. |
| Epic 3 - Hóa đơn | Không đổi behavior. Các luồng sau tiếp tục chỉ dùng Lớp active. | Không thay đổi. |
| Epic 4 - Báo cáo | Không đổi. | Không thay đổi. |

### Artifact Conflicts

- PRD vẫn đạt được: quyết định chỉ cụ thể hóa dữ liệu Lớp, không đổi đối tượng người dùng hay phạm vi MVP.
- Architecture Spine vẫn đúng: API là nguồn chân lý, Lớp/Học sinh giữ bằng trạng thái, tiền dùng `BIGINT`, và client không tự replay mutation.
- UX specification vẫn đúng: không đổi layout; UI chỉ cần phản ánh resource archived read-only, page rỗng hợp lệ và lỗi archive chuẩn.
- `epics.md` là artifact final, không sửa trực tiếp. Các refinement được giao cho Product Owner/Developer qua proposal này và implementation specification kế tiếp.

### Technical Impact

- API `classes` cần authentication guard hiện hữu, DTO name normalization/query validation, deterministic Prisma ordering, update state guard, archive idempotency và error metadata ổn định.
- Archive phải kiểm tra/đếm Student `ACTIVE` trong cùng transaction và lock/revalidate Class theo convention nhất quán với mutation Student ở Story 2.2.
- `GET /classes/:id` hoặc list resource chỉ cần có `activeStudentCount`; không embed danh sách Student không giới hạn.
- Web cần giữ form sau failure/timeout, không replay write request, và dùng `activeStudentCount` cho archive confirmation/error.
- CI/local verification cần apply migration vào PostgreSQL sạch trước integration tests.

## 3. Recommended Approach

**Chọn: Direct Adjustment trong Epic 2 hiện tại.**

Các quyết định được phê duyệt là contract refinement, không đòi hỏi rollback Story đã hoàn thành, không tạo Epic/Story mới và không đổi timeline/sequence. Việc đưa invariant transaction vào Story 2.2 ngăn một future mutation phá rule archive của Story 2.1.

- Effort: Low cho Story 2.1 refinement; Medium khi Story 2.2 bổ sung mutation Student và concurrency integration test.
- Risk: Low nếu archive/assignment dùng cùng lock/revalidation convention.
- Timeline: Không đổi thứ tự Epic 2.

## 4. Detailed Change Proposals

### Story 2.1 - Quản lý Lớp đang hoạt động và lưu trữ

**Section: Acceptance Criteria and implementation refinement**

**OLD:**

```text
- API REST trả list theo { data, meta } và UI có table được gắn nhãn, phân trang, tìm kiếm/filter.
- Admin tạo hoặc sửa Lớp qua form dialog với tên và học phí tháng nguyên VND không âm.
- Lớp active có thể chuyển sang lưu trữ; Lớp còn Học sinh active bị từ chối với CLASS_HAS_ACTIVE_STUDENTS cùng số lượng.
```

**NEW:**

```text
- Mọi endpoint /classes yêu cầu Admin đã xác thực và giữ error shape chuẩn hiện hữu khi không có session hợp lệ.
- List dùng createdAt DESC, id DESC; query status chỉ nhận ACTIVE/ARCHIVED; page vượt tổng trang trả { data: [], meta }.
- Tên Lớp được trim, không rỗng sau trim, tối đa 100 ký tự và không yêu cầu unique name. Học phí là integer VND không âm trong JSON safe range.
- Resource Class trả activeStudentCount. Story này không trả danh sách Student không phân trang; danh sách thuộc Story 2.2 qua resource Student.
- POST archive là idempotent: Lớp đã ARCHIVED trả { data: class } hiện tại. ARCHIVED là read-only và mọi update bị từ chối theo error shape chuẩn.
- Archive đếm Student ACTIVE và quyết định archive trong cùng transaction/locking scope. Nếu bị chặn, CLASS_HAS_ACTIVE_STUDENTS chứa activeStudentCount theo payload lỗi chuẩn ổn định.
- Web không tự replay mutation khi write request đã bắt đầu. CSRF chỉ được lấy/làm mới trước request; timeout create/update giữ form để Admin đối soát danh sách trước khi gửi lại.
- Verification gồm migration deploy vào PostgreSQL database sạch và integration tests cho archive thành công/bị chặn, ngoài unit tests.
```

**Rationale:** Loại bỏ các hành vi không xác định ở boundary REST, lifecycle resource và lỗi concurrent; giữ Story 2.1 trong phạm vi Class thay vì khởi tạo UI/API Student quá sớm.

### Story 2.2 - Quản lý Học sinh và Lớp hiện tại

**Section: Acceptance Criteria and technical implementation constraint**

**OLD:**

```text
- Picker chỉ liệt kê Lớp active.
- API cập nhật trạng thái và Lớp hiện tại của Học sinh.
```

**NEW:**

```text
- Danh sách Học sinh theo Lớp là resource phân trang riêng; Class resource chỉ trả activeStudentCount.
- Mọi mutation gán Lớp hiện tại hoặc chuyển Học sinh sang ACTIVE phải transactionally lock/revalidate Lớp đích là ACTIVE theo cùng convention với archive Class.
- Nếu Lớp đích đã ARCHIVED trong lúc xử lý, API không persist mutation và trả error shape chuẩn.
- PostgreSQL-backed integration tests bao phủ race archive-với-assignment/kích-hoạt để không tồn tại Student ACTIVE gán vào Class ARCHIVED.
```

**Rationale:** Đặt invariant tại mọi đường mutation có thể tạo quan hệ Student `ACTIVE` -> Class, thay vì chỉ bảo vệ archive một phía.

### Editorial Follow-up

Khi artifact Story 2.1 được tái tạo qua workflow phù hợp, gộp `Code Map` với `Suggested Review Order`, tránh lặp I/O matrix và Acceptance Criteria, và chuyển `Design Notes` cạnh task schema/migration. Các thay đổi này chỉ cải thiện khả năng đọc, không thay đổi intent.

## 5. Implementation Handoff

**Phân loại: Minor.**

### Handoff

- Product Owner: dùng proposal này để đưa acceptance/refinement đã phê duyệt vào artifact Story 2.1/2.2 được tạo qua workflow phù hợp; không sửa trực tiếp planning artifact final.
- Developer: kiểm tra implementation Story 2.1 với các contract trên, bổ sung các test/migration verification còn thiếu; áp dụng lock/revalidation và concurrency integration coverage khi triển khai Story 2.2.
- QA/CI: cung cấp PostgreSQL test database sạch cho migration deploy và integration coverage.

### Success Criteria

- Không có request unauthenticated nào đọc hoặc thay đổi Class.
- List Class luôn có thứ tự và page-out-of-range xác định.
- Không thể update Class archived; archive lặp trả resource archived thành công.
- Không thể tạo quan hệ Student `ACTIVE` với Class `ARCHIVED`, kể cả khi archive và assignment cạnh tranh.
- Archive rejection luôn trả `CLASS_HAS_ACTIVE_STUDENTS` với `activeStudentCount` nhất quán.
- Migration SQL chạy được trên PostgreSQL sạch trước khi thay đổi được coi là hoàn tất.

## Approval Record

Tony đã phê duyệt toàn bộ khuyến nghị từ BMad review Story 2.1 ngày 2026-08-19.

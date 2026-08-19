---
title: "Sprint Change Proposal - Làm rõ thanh toán, tiền, mẫu hóa đơn và lưu trữ Lớp"
status: approved
approved: 2026-08-19
created: 2026-08-19
trigger: "Readiness gate concerns and stakeholder decisions"
affected_epics: [2, 3]
---

# Sprint Change Proposal - Anh Hoa Admin MVP

## 1. Issue Summary

Readiness gate phát hiện một số chi tiết chưa được chốt có thể khiến implementation tự suy diễn. Tony đã xác nhận các quyết định sau để giữ MVP đơn giản, không mở rộng phạm vi:

- Hóa đơn tạo hàng loạt chỉ snapshot Học sinh, Lớp và Dòng mẫu; chưa có phương thức thanh toán hoặc Tài khoản nhận tiền.
- Giá trị tiền nhập từ API bị giới hạn trong phạm vi phù hợp vận hành thực tế: từ `-100.000.000` đến `100.000.000` VND cho mỗi Dòng hóa đơn. Tổng Hóa đơn phải lớn hơn `0` và không vượt `100.000.000` VND khi chuyển sang `PENDING` hoặc `COMPLETED`.
- Mẫu hóa đơn chung ban đầu tồn tại nhưng có dữ liệu rỗng; Admin tự cấu hình các Dòng mẫu trước khi tạo Hóa đơn hàng loạt.
- Không cho lưu trữ Lớp nếu vẫn còn Học sinh đang học được gán vào Lớp đó.

Không có thay đổi về đối tượng người dùng, chức năng MVP, stack, hoặc mô hình lifecycle Hóa đơn.

## 2. Impact Analysis

### Epic Impact

| Epic | Tác động | Hành động |
| --- | --- | --- |
| Epic 1 - Nền tảng và xác thực | Không ảnh hưởng | Giữ nguyên trạng thái hoàn thành. |
| Epic 2 - Dữ liệu vận hành | Bị ảnh hưởng bởi rule archive Lớp và seed Mẫu hóa đơn trống. | Bổ sung acceptance criteria cho Stories 2.1 và 2.5. |
| Epic 3 - Hóa đơn | Bị ảnh hưởng bởi vòng đời dữ liệu thanh toán, validation tiền và template rỗng. | Bổ sung acceptance criteria cho Stories 3.2, 3.3 và 3.4. |
| Epic 4 - Báo cáo | Không ảnh hưởng trực tiếp. | Giữ nguyên. |

### Artifact Conflict Resolution

- PRD và Architecture Spine là `final`; không sửa trực tiếp.
- Cụm "Creation copies ... chosen bank-account snapshots" trong Architecture Spine được diễn giải theo proposal này: chỉ snapshot Tài khoản nhận tiền khi một tài khoản đã được chọn trong luồng chỉnh sửa và Hóa đơn được chuyển sang `PENDING`.
- `AGENTS.md` cần được refresh qua `bmad-project-context` để sửa shorthand lifecycle thành `DRAFT -> PENDING`, `PENDING -> DRAFT`, `PENDING -> COMPLETED`.
- UX không cần đổi layout hoặc journey; UI chỉ cần hiển thị validation/template-empty và chặn archive theo rule mới.

### Technical Impact

- API schema giữ PostgreSQL `BIGINT`; DTO và domain service kiểm tra từng amount và invoice total trong phạm vi an toàn `[-100.000.000, 100.000.000]` VND trước khi lưu/trả JSON.
- Batch creation phải từ chối mẫu rỗng bằng lỗi chuẩn `INVOICE_TEMPLATE_EMPTY`; batch preview cũng báo template chưa sẵn sàng thay vì trả eligibility có thể tạo được.
- API archive Lớp phải từ chối nếu còn Student `ACTIVE` gán vào Lớp, trả `CLASS_HAS_ACTIVE_STUDENTS` và số lượng bị ảnh hưởng.
- Không cần endpoint, migration, Epic, hay story mới. Các API contract chi tiết ngoài những hành vi này được để lại cho refinement/implementation của từng story.

## 3. Recommended Approach

**Chọn: Direct Adjustment trong cấu trúc Epic hiện tại.**

Các quyết định là làm rõ rule, không đổi mục tiêu MVP. Bổ sung acceptance criteria cho các story backlog là đủ; không rollback Epic 1, không tạo Epic mới và không cần xem lại PRD MVP.

- Effort: Low
- Risk: Low
- Timeline: Không đổi thứ tự triển khai. Story 2.1 và 2.5 cần được cập nhật trước khi bắt đầu Epic 2; Story 3.2-3.4 dùng các rule này khi đến lượt.

## 4. Detailed Change Proposals

### Stories

#### Story 2.1 - Quản lý Lớp đang hoạt động và lưu trữ

**Thêm Acceptance Criteria:**

```text
- Không thể lưu trữ Lớp còn bất kỳ Học sinh đang học nào được gán vào. API trả `CLASS_HAS_ACTIVE_STUDENTS` cùng số lượng Học sinh bị ảnh hưởng; UI hướng Admin chuyển hoặc cho nghỉ học các em trước.
```

**Lý do:** Tránh làm Học sinh đang học trở thành không đủ điều kiện lập Hóa đơn do một thao tác archive không chủ ý.

#### Story 2.5 - Quản lý Mẫu hóa đơn chung

**Thêm Acceptance Criteria:**

```text
- Seed khởi tạo tạo đúng một Mẫu hóa đơn chung có dữ liệu Dòng mẫu rỗng. Admin có thể thêm và sắp xếp Dòng mẫu để cấu hình mẫu trước khi dùng.
```

**Lý do:** Không giả định dữ liệu học phí thực tế khi chưa được cung cấp.

#### Story 3.2 - Xem trước và tạo Hóa đơn nháp hàng loạt

**Thêm Acceptance Criteria:**

```text
- Nếu Mẫu hóa đơn chung chưa có Dòng mẫu, batch preview và batch creation bị từ chối bằng lỗi `INVOICE_TEMPLATE_EMPTY`; không tạo Hóa đơn rỗng.
- Khi batch tạo `DRAFT`, Hóa đơn snapshot Học sinh, Lớp và Dòng mẫu. Phương thức thanh toán và Tài khoản nhận tiền chưa được đặt ở thời điểm này.
```

**Lý do:** Làm rõ trạng thái hợp lệ của Hóa đơn mới tạo và ngăn luồng tạo hóa đơn chưa thể thu tiền.

#### Story 3.3 - Rà soát và chỉnh sửa Hóa đơn nháp

**Thêm Acceptance Criteria:**

```text
- Mỗi Dòng hóa đơn chỉ nhận số nguyên VND trong phạm vi từ `-100.000.000` đến `100.000.000`.
- API tự tính tổng từ các Dòng hóa đơn; trước khi Hóa đơn đi vào trạng thái thu tiền, tổng phải lớn hơn `0` và không vượt `100.000.000` VND.
- Trong `DRAFT`, Admin chọn hoặc đổi phương thức thanh toán và Tài khoản nhận tiền. Các lựa chọn này còn có thể chỉnh sửa và không làm thay đổi snapshot của một Hóa đơn đã khóa.
```

**Lý do:** Giữ money JSON an toàn, đơn giản cho UI và xác định rõ thanh toán chỉ được cấu hình trong luồng chỉnh sửa.

#### Story 3.4 - Chuyển Hóa đơn sang chờ xác nhận và cung cấp QR

**Thêm Acceptance Criteria:**

```text
- Khi `DRAFT -> PENDING`, API xác thực tổng Hóa đơn lớn hơn `0` và không vượt `100.000.000` VND; với chuyển khoản, Tài khoản nhận tiền phải đang hoạt động.
- Chỉ khi chuyển thành công sang `PENDING`, Hóa đơn snapshot phương thức thanh toán và Tài khoản nhận tiền đã chọn. QR được dựng độc quyền từ snapshot này.
- Khi `PENDING -> DRAFT`, Hóa đơn lại có thể chỉnh sửa phương thức thanh toán và Tài khoản nhận tiền. Một lần chuyển sang `PENDING` tiếp theo thay thế snapshot thanh toán bằng dữ liệu đang được chọn.
```

**Lý do:** Snapshot lịch sử chỉ khóa đúng lúc Hóa đơn sẵn sàng thu tiền, trong khi `DRAFT` vẫn phục vụ rà soát.

### Project Context

**Thay đổi ở lần refresh `bmad-project-context`:**

```text
Hóa đơn chỉ có các transition `DRAFT -> PENDING`, `PENDING -> DRAFT` và `PENDING -> COMPLETED`; `COMPLETED` chỉ xem.
```

**Lý do:** Đồng bộ shorthand với PRD, Architecture Spine và Epic 3.

## 5. Implementation Handoff

**Phân loại: Moderate.** Cần Product Owner/Developer cập nhật backlog acceptance criteria, sau đó Developer triển khai theo các rule đã chốt.

### Handoff

- Product Owner / planning workflow: cập nhật Epic 2 và Epic 3 bằng các acceptance criteria trong proposal này, giữ nguyên số Story và thứ tự.
- Developer: áp dụng validation/API rule, migration/schema nếu cần, cùng unit và PostgreSQL integration tests cho template rỗng, giới hạn tiền, snapshot thanh toán và archive Lớp.
- Project Context workflow: refresh managed `AGENTS.md` sau khi command build/test đã được xác minh; bao gồm lifecycle chính xác.

### Success Criteria

- Không tạo batch invoice khi template rỗng.
- Không lưu trữ Class còn Student `ACTIVE`.
- Không chấp nhận một line item hoặc invoice total vượt giới hạn `100.000.000` VND theo rule trên.
- Hóa đơn batch-created `DRAFT` không có payment/bank-account snapshot.
- QR của `PENDING` tiếp tục dùng snapshot nếu Bank Account nguồn bị sửa hoặc deactivate; trả về `DRAFT` cho phép chọn lại và khóa snapshot mới ở lần pending kế tiếp.
- Sprint status không thay đổi entry vì không có Epic/Story được thêm, bỏ hoặc đổi số.

## 6. Checklist Record

- [x] Trigger: readiness gate phát hiện chi tiết chưa chốt; stakeholder đã đưa quyết định.
- [x] Epic impact: chỉ Epic 2 và Epic 3 cần bổ sung criteria; không đổi thứ tự.
- [x] Artifact impact: final artifacts được bảo toàn; proposal là nguồn thay đổi được chờ phê duyệt.
- [x] Path forward: direct adjustment, effort/risk thấp.
- [x] Handoff: PO/Developer và Project Context workflow được xác định.
- [!] Cần Tony phê duyệt proposal trước khi cập nhật backlog hoặc implementation artifacts.

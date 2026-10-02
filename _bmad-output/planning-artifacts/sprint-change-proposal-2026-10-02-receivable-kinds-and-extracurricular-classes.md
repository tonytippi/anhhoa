---
name: Ba loại khoản thu cố định và lớp ngoại khóa cho Đợt thu
status: approved
approved: 2026-10-02
date: 2026-10-02
trigger: Kế toán phải điều chỉnh tay quá nhiều Invoice DRAFT sau generate. Học phí, tiền ăn áp dụng cho mọi Student; phí dã ngoại áp dụng theo lớp; tiếng Anh, võ, vẽ áp dụng cho nhóm Student ổn định qua nhiều tháng. Template chung của CollectionRun (proposal 2026-09-24) không phân biệt ba trường hợp này.
mode: incremental
supersedes-in-part: sprint-change-proposal-2026-09-24-collection-run-template.md (quyết định 5 - loại trừ scope theo Class/Student và service enrollment)
---

# Sprint Change Proposal - Ba loại khoản thu cố định và lớp ngoại khóa

## 1. Issue summary

Template chung của Đợt thu áp dụng mọi khoản cho mọi Student được generate. Với khoản theo lớp hoặc theo nhóm, kế toán phải mở từng Invoice DRAFT để thêm hoặc xóa dòng. Tháng nào cũng lặp lại cùng một danh sách Student học tiếng Anh tối.

Business owner đã chốt:

1. **Ba loại khoản thu cố định, không cho sửa:** `Cố định`, `Linh hoạt`, `Ngoại khóa`. Mỗi School có đúng ba nhóm này; không tạo, đổi tên hay ngừng nhóm. Loại là thuộc tính typed, không suy ra từ tên.
2. **Cố định** (học phí, tiền ăn): tự thêm vào template khi mở Đợt thu.
3. **Ngoại khóa** (tiếng Anh, võ, vẽ): quản lý bằng **lớp ngoại khóa**, một thực thể riêng, không dùng `Class` chính thức. Kế toán tạo khoản thu loại Ngoại khóa tương ứng và gắn vào lớp ngoại khóa; mỗi lớp ngoại khóa gắn đúng một khoản thu (học phí của lớp). Một khoản thu được gắn cho nhiều lớp ngoại khóa song song, ví dụ Tiếng Anh A1 và Tiếng Anh A2 cùng dùng khoản Tiếng Anh bản ngữ.
4. **Vào/nghỉ giữa tháng:** không tự prorate. Kế toán điều chỉnh trên Invoice DRAFT theo workflow audit hiện có.
5. **Phụ huynh:** sẽ thấy lớp ngoại khóa của con, nhưng làm sau; không thuộc thay đổi này.

## 2. Vì sao không dùng `Class` chính thức

`Class` đang quyết định nhiều thứ ngoài khoản thu:

- `EnrollmentClassAssignment` giả định một lớp hiệu lực mỗi enrollment.
- Eligibility của CollectionRun (NO_CLASS_ASSIGNMENT, CLASS_INACTIVE).
- `StaffClassAssignment` cấp quyền xem Student, điểm danh, DailyJournal, media.
- Snapshot lớp và tài khoản thu mặc định trên Invoice.

Ghép lớp ngoại khóa vào `Class` sẽ phá invariant một lớp và mở quyền cho giáo viên ngoại khóa vào dữ liệu lớp chính thức. Lớp ngoại khóa chỉ là nguồn applicability cho Finance trong thay đổi này.

## 3. Quyết định chi tiết

### 3.1 Loại nhóm khoản thu

- Thêm `ReceivableGroupKind`: `FIXED`, `FLEXIBLE`, `EXTRACURRICULAR`; unique `(schoolId, kind)`.
- Tên hiển thị cố định: **Khoản thu cố định**, **Khoản thu linh hoạt**, **Ngoại khóa**.
- Migration map nhóm hiện có: `Khoản thu chung` -> FIXED, `Khoản thu đột xuất` -> FLEXIBLE, `Ngoại khóa` -> EXTRACURRICULAR. Receivable thuộc nhóm tự tạo khác được chuyển sang FLEXIBLE, nhóm tự tạo bị gỡ khỏi catalog; migration ghi audit/Operation.
- Bỏ endpoint tạo nhóm và đổi lifecycle nhóm. Provisioning School tạo đúng ba nhóm typed.
- Receivable vẫn tạo/ngừng như hiện tại; nhóm chọn từ ba loại. Đổi loại của Receivable đã dùng trên Invoice hoặc lớp ngoại khóa bị từ chối.

### 3.2 Đợt thu theo loại

| Loại | Cách vào Invoice | Kế toán làm gì |
| --- | --- | --- |
| Cố định | Khi mở Đợt thu, API thêm mọi Receivable FIXED đang ACTIVE vào template với quantity 1 | Sửa quantity (ví dụ 22 ngày ăn); được bỏ dòng khi run còn DRAFT |
| Linh hoạt | Thêm thủ công vào template, kèm phạm vi: Toàn bộ / Lớp chính thức (chọn nhiều) / Student cụ thể | Chọn mỗi đợt |
| Ngoại khóa | Không thêm trực tiếp vào template. API lấy thành viên hiệu lực của mỗi lớp ngoại khóa ACTIVE | Xem số Student mỗi lớp; được loại cả một lớp khỏi đợt này khi run DRAFT |

- Receivable EXTRACURRICULAR bị từ chối ở template line; Receivable FIXED luôn phạm vi Toàn bộ.
- Phạm vi theo lớp chính thức dùng lớp hiệu lực tại ngày đầu tháng, cùng rule eligibility hiện tại.
- Invoice chỉ chứa dòng ngoại khóa nếu Student vẫn eligible theo enrollment/lớp chính thức và nằm trong selection của run. Lớp ngoại khóa không mở eligibility mới.
- Thành viên ngoại khóa được tính nếu membership có hiệu lực ít nhất một ngày trong tháng thu. Quantity mặc định 1, giá default của Receivable. Dòng của Student vào hoặc nghỉ trong tháng được đánh dấu **Vào/nghỉ giữa tháng** để kế toán rà soát.
- Preview hiển thị mỗi dòng: loại, phạm vi, số Student, tạm tính. Fingerprint gồm template + phạm vi + danh sách lớp ngoại khóa không bị loại + membership facts. Đổi membership sau READY làm preview stale; sau GENERATED không rewrite Invoice đã tạo.
- Mỗi InvoiceLine generate ghi provenance: `TEMPLATE_FIXED`, `TEMPLATE_FLEXIBLE` (kèm phạm vi), `EXTRACURRICULAR` (kèm lớp ngoại khóa), hoặc `MANUAL`. Màn rà soát Invoice hiển thị cột **Nguồn**.

### 3.3 Lớp ngoại khóa

```text
ExtracurricularClass
  schoolId, schoolYearId, name, receivableId (EXTRACURRICULAR, ACTIVE; nhiều lớp được dùng chung một Receivable), status ACTIVE/INACTIVE + lifecycle
ExtracurricularMembership
  schoolId, extracurricularClassId, enrollmentId, effectiveFrom, effectiveTo?, reason, audit actor
```

- Scope School và SchoolYear; composite tenant FK như các aggregate khác.
- Mỗi lớp ngoại khóa gắn đúng một Receivable; một Receivable được gắn nhiều lớp song song. Các lớp dùng chung Receivable có chung giá; muốn giá khác thì tạo Receivable khác.
- Một dòng Invoice cho mỗi Receivable ngoại khóa: nếu trong tháng thu Student có membership ở nhiều lớp cùng Receivable (ví dụ chuyển từ A1 sang A2 giữa tháng), Invoice chỉ có một dòng, provenance liệt kê các lớp và dòng được đánh dấu **Chuyển lớp trong tháng**. Không thu trùng.
- Một Student có thể thuộc nhiều lớp ngoại khóa; không có hai membership chồng thời gian trong cùng một lớp.
- Thêm/kết thúc membership hàng loạt (chọn nhiều Student từ lớp chính thức) với một reason chung, ghi audit từng membership.
- Mutation dùng Operation/idempotency như Finance hiện tại; quyền giống quản lý catalog Finance.
- Ngoài phạm vi: giáo viên ngoại khóa, lịch học, điểm danh buổi ngoại khóa, Parent projection.

### 3.4 Bổ sung đã duyệt (2026-10-02)

- **Thêm Student sau GENERATED:** Invoice DRAFT của Student đó áp dụng đủ ba loại theo snapshot của run: mọi dòng cố định; dòng linh hoạt khi Student thuộc phạm vi đã snapshot (Toàn bộ, lớp chính thức hiệu lực ngày đầu tháng, hoặc Student cụ thể); dòng ngoại khóa từ membership hiệu lực ít nhất một ngày trong tháng của các lớp ngoại khóa không bị loại khỏi run, đọc tại thời điểm thêm và snapshot vào Invoice.
- **Template rỗng:** không chặn generate chỉ vì template rỗng. Student eligible + selected không có dòng nào (sau khi áp dụng template, phạm vi và ngoại khóa) bị skip với lý do `NO_APPLICABLE_LINES`; generate chỉ bị từ chối khi không Student nào có dòng.

## 4. Impact analysis

| Area | Impact |
| --- | --- |
| PRD FR-7/FR-8 | Template có loại và phạm vi; thêm nguồn applicability lớp ngoại khóa. Bỏ câu "Khong suy dien scope Class/Student, service". ChargeRule đầy đủ vẫn deferred. |
| Addendum | Invariant mới: ba nhóm typed cố định, lớp ngoại khóa, membership fingerprint/snapshot, provenance InvoiceLine. |
| Architecture Spine AD-7/AD-8/AD-11 | `finance` sở hữu ExtracurricularClass/Membership; không phụ thuộc hoặc sửa `Class`/staff authorization. |
| SPEC CAP-4 | Generate từ template typed + phạm vi + membership ngoại khóa; absence vẫn nghĩa là không áp dụng. |
| Epic 5 | Thêm Story 5.33-5.37. Story `StudentServiceEnrollment` (deferred 2026-09-21) được thay bằng lớp ngoại khóa. |
| UX/mockups | Cập nhật `receivable-configuration.html` (ba nhóm cố định), thêm `extracurricular-classes.html`, cập nhật `finance-run-preview.html`/`invoice-generation.html` (bảng khoản thu theo loại, cột phạm vi, khu Lớp ngoại khóa), `invoice-detail-review.html` (cột Nguồn, cờ vào/nghỉ giữa tháng), `MOCKUP-COVERAGE.md`. |
| Parent/Teacher | Không đổi. |

## 5. Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Lớp ngoại khóa là `Class` thường | Rejected | Phá invariant một lớp, eligibility và phân quyền staff. |
| Chọn Student cho khoản ngoại khóa mỗi đợt | Rejected | Lặp lại thao tác hằng tháng, đúng vấn đề cần giải. |
| ChargeRule đầy đủ (STUDENT > CLASS > SCHOOL, INCLUDE/EXCLUDE) | Deferred | Lớn hơn nhu cầu; ba loại + lớp ngoại khóa đủ cho vận hành hiện tại. |
| Tự prorate vào/nghỉ giữa tháng | Rejected | Business owner chọn điều chỉnh tay trên Invoice. |
| Loại suy từ tên nhóm | Rejected | Tên có thể sai lệch giữa School; cần typed kind. |

## 6. Stories

### Story 5.33: Ba loại khoản thu cố định

- Given mọi School, when migration và provisioning chạy, then mỗi School có đúng ba ReceivableGroup typed với tên cố định; Receivable cũ được map như mục 3.1 kèm audit.
- Given request tạo, đổi tên hoặc ngừng nhóm, then API từ chối; UI catalog không còn thao tác nhóm.
- Given Receivable đã dùng trên Invoice hoặc gắn lớp ngoại khóa, when đổi loại, then API từ chối.

### Story 5.34: Lớp ngoại khóa và thành viên

- Given Receivable EXTRACURRICULAR ACTIVE, when Finance tạo lớp ngoại khóa, then lớp được lưu theo School/SchoolYear với audit/Operation, kể cả khi Receivable đã gắn lớp khác; Receivable khác loại hoặc INACTIVE bị từ chối.
- Given lớp ACTIVE, when Finance thêm/kết thúc membership (đơn lẻ hoặc hàng loạt) với reason, then membership effective-dated được lưu, không chồng thời gian trong cùng lớp, Student phải thuộc cùng School/SchoolYear.
- Given Student/Receivable/lớp của School khác, then API từ chối và không lộ fact.

### Story 5.35: Đợt thu tự thêm khoản cố định và phạm vi khoản linh hoạt

- Given mở Đợt thu mới, then template có sẵn mọi Receivable FIXED ACTIVE quantity 1; Finance sửa quantity/bỏ dòng khi DRAFT.
- Given Receivable FLEXIBLE, when Finance thêm dòng với phạm vi Toàn bộ / lớp chính thức / Student cụ thể, then preview trả số Student và tạm tính theo dòng; phạm vi rỗng, lớp/Student khác School bị từ chối.
- Given Receivable EXTRACURRICULAR, when thêm vào template, then API từ chối.
- Given generate, then mỗi Invoice chỉ có dòng FLEXIBLE khi Student thuộc phạm vi; InvoiceLine có provenance.

### Story 5.36: Generate dòng ngoại khóa từ lớp ngoại khóa

- Given run DRAFT, then detail hiển thị các lớp ngoại khóa ACTIVE với số thành viên hiệu lực trong tháng; Finance được loại/khôi phục cả lớp cho đợt này.
- Given generate, then Student eligible + selected có membership hiệu lực ít nhất một ngày trong tháng nhận một dòng cho mỗi Receivable ngoại khóa (gộp các lớp cùng Receivable), giá default, quantity 1, provenance các lớp, cờ vào/nghỉ giữa tháng hoặc chuyển lớp trong tháng khi áp dụng.
- Given membership hoặc Receivable đổi sau preview, then READY/generate bị chặn đến khi preview mới; sau GENERATED không rewrite Invoice.

### Story 5.37: Release gate

- PostgreSQL tests: tenant graph, typed group invariant, membership overlap, scope resolution, fingerprint stale, idempotency/concurrency, provenance snapshot.
- Admin E2E: tạo lớp ngoại khóa -> thêm thành viên hàng loạt -> mở Đợt thu (khoản cố định có sẵn) -> Student chuyển giữa hai lớp ngoại khóa cùng Receivable trong tháng -> thêm dã ngoại theo lớp -> preview -> generate -> rà soát Invoice thấy cột Nguồn và cờ giữa tháng -> điều chỉnh một Student.
- Không có client-calculated VND, Parent/Teacher dependency hoặc sửa `Class`/staff authorization.

## 7. Tracker

```yaml
5-33-ba-loai-khoan-thu-co-dinh: ready-for-dev
5-34-lop-ngoai-khoa-va-thanh-vien: backlog
5-35-dot-thu-tu-them-khoan-co-dinh-va-pham-vi-khoan-linh-hoat: backlog
5-36-generate-dong-ngoai-khoa-tu-lop-ngoai-khoa: backlog
5-37-release-gate-loai-khoan-thu-va-lop-ngoai-khoa: backlog
```

## 8. Implementation handoff

1. Cập nhật mockup theo mục 4 và cho business owner review trước khi code.
2. Áp dụng PRD, Addendum, Spine, SPEC, Epic 5 và tracker sau khi proposal được duyệt.
3. Thứ tự build: 5.33 -> 5.34 -> 5.35 -> 5.36 -> 5.37.

## 9. Open items

- Có giữ được Receivable thuộc nhóm tự tạo của School nào ngoài ba nhóm mặc định không? Mặc định proposal chuyển sang FLEXIBLE.
- Parent xem lớp ngoại khóa: proposal riêng sau.

## 10. Approval request

Duyệt proposal để cập nhật mockup và artifact canonical, rồi bắt đầu Story 5.33. Proposal không cho phép ChargeRule đầy đủ, tự prorate, Parent/Teacher projection hoặc thay đổi `Class` chính thức.

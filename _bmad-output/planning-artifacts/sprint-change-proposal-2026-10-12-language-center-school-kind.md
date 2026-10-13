---
name: Loại trường và Đợt thu theo lớp cho trung tâm ngoại ngữ
status: approved
approved: 2026-10-12
date: 2026-10-12
trigger: Business owner muốn dùng PassionEdu cho trung tâm tiếng Anh. Trung tâm cũng chia lớp, không có tiền ăn, học phí và đưa đón thu theo unit (khoảng 2 tháng) của từng lớp, các lớp bắt đầu lệch nhau, không cần năm học. Hệ thống chưa có người dùng thật nên được đổi kiến trúc.
mode: incremental
supersedes-in-part: PRD FR-8 và Addendum (mỗi CollectionRun là `MONTHLY`, mỗi SchoolYear một run cho một `billingMonth`, không có run khác); PRD §1 (chỉ trường mầm non)
---

# Sprint Change Proposal - Loại trường và Đợt thu theo lớp cho trung tâm ngoại ngữ

## 1. Issue summary

PassionEdu đang giả định mọi School là trường mầm non: mỗi tháng một Đợt thu cho cả trường, dữ liệu chia theo năm học. Trung tâm tiếng Anh không khớp hai giả định đó:

- Mỗi lớp học hết một unit (khoảng 2 tháng) rồi sang unit mới; các lớp bắt đầu lệch nhau. Tuyển lớp mới sau khi Đợt thu tháng đã generate thì không thu được.
- Không có năm học: lớp không chia theo độ tuổi, không lên lớp cuối năm.

Business owner đã chốt (2026-10-11 và 2026-10-12):

1. Một mô hình dữ liệu và một luồng Finance cho cả hai loại trường; khác biệt nằm ở cấu hình theo loại trường, không ở nhánh code theo tên loại.
2. Loại trường chọn khi provision School và không đổi được.
3. Trung tâm: Đợt thu theo từng lớp, kỳ là unit có ngày bắt đầu/kết thúc do kế toán nhập; mở lúc nào cũng được.
4. Một học viên chỉ thuộc một lớp chính thức tại một thời điểm (giữ invariant hiện tại).
5. Nghỉ không tự hoàn tiền. Vẫn giữ bớt trừ thủ công, Invoice âm và payout để phòng.
6. Học viên vào giữa unit: kế toán tự điều chỉnh trên Invoice DRAFT; không prorate.
7. Học phí cả unit ghi nhận vào tháng bắt đầu unit.
8. Đưa đón là khoản thu theo unit, cùng Invoice với học phí.
9. Trung tâm không dùng năm học; năm tài chính lấy từ báo cáo theo khoảng tháng. Khóa sổ theo ngày để sau.

## 2. Quyết định chi tiết

### 2.1 Loại trường

- Thêm `School.kind`: `PRESCHOOL` | `LANGUAGE_CENTER`, bắt buộc khi provision, bất biến. School hiện có nhận `PRESCHOOL`.
- Một feature map server-owned theo `kind` (đặt ở API, `modules/common/school-features.ts`; contracts chỉ có DTO type). Gọi là feature để không lẫn với capability phân quyền của Chức danh:

| Feature | PRESCHOOL | LANGUAGE_CENTER |
| --- | --- | --- |
| `usesSchoolYears` | true | false |
| `collectionRunScope` | `SCHOOL` | `CLASS` |
| `dailyJournal`, `handover` | true | false |
| Nhãn giao diện | Năm học, Tháng | Unit; không có năm học |

- Module đọc feature, không so sánh `kind` trực tiếp. Bản đầu chưa có override theo từng School.
- `GET` context của School trả `schoolKind` và `features` cho portal. Portal ẩn navigation của feature tắt; API từ chối feature tắt với `409 SCHOOL_FEATURE_DISABLED`.
- Tiền ăn không phải feature: trung tâm chỉ không khai Receivable đó. Tự trừ theo ngày nghỉ vẫn là lựa chọn của từng Receivable.

### 2.2 School không dùng năm học

- `SchoolYear` vẫn là container bắt buộc của Class, StudentEnrollment và Finance; mọi composite FK giữ nguyên.
- `SchoolYear.endsOn` được phép null (không giới hạn). Các snapshot `schoolYearEndsOn` theo đó nullable. Null nghĩa là luôn active và không chặn ngày hiệu lực phía sau.
- Provision School có `usesSchoolYears = false` tạo đúng một SchoolYear không ngày kết thúc trong cùng transaction. API từ chối tạo SchoolYear thứ hai, chuyển năm và close year với `409 SCHOOL_YEAR_NOT_USED`. Portal ẩn bộ chọn năm học.
- Lớp học xong được lưu trữ (`ARCHIVED`); học viên sang lớp mới bằng chuyển lớp effective-dated hiện có. Danh sách lớp mặc định chỉ hiện lớp `ACTIVE`.
- **Học sinh quay lại (chốt 2026-10-12, cả hai loại trường):** học sinh đã nghỉ quay lại được coi như học sinh mới: School Admin tạo Student mới với mã mới và liên kết Parent bằng cùng email, nên Parent vẫn dùng một tài khoản. Enrollment `WITHDRAWN` vẫn là trạng thái kết thúc; không có thao tác học lại. Hồ sơ và Invoice cũ giữ nguyên; nợ cũ của hồ sơ cũ không tự chuyển sang hồ sơ mới, kế toán thu trên Invoice cũ.
- Không có khóa sổ năm cho School này; Đợt thu `CLOSED` vẫn chỉ đọc. Khóa sổ theo ngày là proposal riêng.

### 2.3 Đợt thu = phạm vi + kỳ dịch vụ

```text
CollectionRun
  scope SCHOOL | CLASS          (thay `type MONTHLY`)
  classId?                      (bắt buộc khi CLASS, cùng School/SchoolYear)
  name                          (SCHOOL: API đặt "Tháng MM/YYYY"; CLASS: kế toán nhập, ví dụ "Unit 3")
  periodStartsOn, periodEndsOn  (ngày đầu và ngày cuối của kỳ, tính cả hai đầu)
  billingMonth                  (API suy ra = tháng của periodStartsOn; chỉ dùng cho lọc và báo cáo)
```

- Run `SCHOOL`: kỳ luôn là trọn một tháng dương lịch; unique `(schoolId, schoolYearId, billingMonth)` chỉ áp cho scope này. Hành vi mầm non không đổi.
- Run `CLASS`: kế toán chọn lớp `ACTIVE`, nhập tên và hai ngày; `periodStartsOn <= periodEndsOn`, nằm trong SchoolYear. Hai run của cùng một lớp không được chồng kỳ. Nhiều lớp có run mở song song.
- School chỉ mở run đúng `collectionRunScope` của mình; scope khác trả `409 COLLECTION_RUN_SCOPE_NOT_ALLOWED`. Mô hình không chặn hai scope cùng tồn tại, nhưng quy tắc nợ cũ và thu trùng chéo scope chưa được định nghĩa nên chưa mở.
- `billingMonth` không còn là định danh hay thứ tự của run. Mọi so sánh trước/sau dùng `periodStartsOn`.

### 2.4 Quy tắc theo kỳ

Thứ tự giữa các run theo `periodStartsOn`. Tự trừ ngày nghỉ và quyết toán vẫn đọc tháng dương lịch trước và chỉ chạy cho run `SCHOOL`.

| Quy tắc | Hiện tại | Sau thay đổi |
| --- | --- | --- |
| Eligibility và phạm vi theo lớp | Lớp hiệu lực ngày đầu tháng | Run `SCHOOL`: lớp hiệu lực ngày `periodStartsOn`. Run `CLASS`: Student thuộc lớp đó ít nhất một ngày trong kỳ |
| Thêm Student sau GENERATED | Theo snapshot của run | Run `CLASS` nhận thêm Student thuộc lớp ít nhất một ngày trong kỳ |
| Phải đóng đợt trước mới phát hành | Run `MONTHLY` có tháng nhỏ hơn | Run cùng phạm vi có `periodStartsOn` nhỏ hơn (cùng School với `SCHOOL`, cùng lớp với `CLASS`) |
| Nợ kỳ trước | Invoice của run `CLOSED` có tháng nhỏ hơn | Invoice của cùng Student trong run `CLOSED` có `periodStartsOn` nhỏ hơn, bất kể lớp |
| Carry chênh lệch thu | Run tháng kế tiếp | Run kế tiếp theo `periodStartsOn` có Invoice DRAFT của Student |
| Tự trừ ngày nghỉ, quyết toán khi kết thúc enrollment | Tháng trước | Giữ theo tháng, chỉ cho run `SCHOOL`. Run `CLASS` không áp dụng (chốt 2026-10-12: trung tâm không tự trừ ngày nghỉ); kế toán bớt trừ thủ công |
| Ngoại khóa/dịch vụ | Membership hiệu lực trong tháng | Membership hiệu lực ít nhất một ngày trong kỳ, chỉ cho Student của run |

- **Template run `CLASS`:** không tự thêm Receivable `FIXED` (mỗi lớp có mức học phí riêng). Run đầu của lớp có template rỗng; run sau sao chép các dòng phạm vi `ALL` (cả lớp) còn ACTIVE của run liền trước cùng lớp, kế toán sửa khi `DRAFT`; dòng chọn Student cụ thể là khoản một lần nên không sao chép. Phạm vi dòng: `ALL` (cả lớp) hoặc Student cụ thể; phạm vi theo lớp bị từ chối. *(Sửa 2026-10-13: run `CLASS` seed `FIXED` toàn trường hoặc gán lớp của run, và chỉ sao chép dòng `FLEXIBLE`; xem sprint-change-proposal-2026-10-13-fixed-receivable-classes.)*
- **Đưa đón:** dùng lớp ngoại khóa hiện có làm nhóm dịch vụ; portal trung tâm hiển thị nhãn **Dịch vụ**. Quantity mặc định 1 cho cả unit; kế toán sửa trên Invoice DRAFT.
- **Thu trùng:** khi generate hoặc thêm Student, dòng có cùng Receivable với một Invoice chưa hủy của Student ở run khác chồng kỳ được đánh dấu **Trùng kỳ** để kế toán rà soát (trường hợp chuyển lớp giữa unit). Không chặn.
- **Hoàn tiền:** bớt trừ thủ công, Invoice âm, payout, revision giữ nguyên cho cả hai scope.
- **Nộp trước (`PREPAID_COVERAGE`):** vẫn theo tháng và chỉ áp dụng trong run `SCHOOL`; run `CLASS` từ chối chọn coverage. Ưu đãi giảm theo % hoặc số tiền áp dụng cho cả hai scope.

### 2.5 Báo cáo và Parent

- Finance report nhóm billed theo `billingMonth` như hiện tại; dòng CollectionRun hiển thị thêm tên run và lớp. Báo cáo năm tài chính là bộ lọc khoảng tháng.
- Parent obligation trả `periodLabel` (tên run, kèm tên lớp với scope `CLASS`) thay cho tháng; minimum DTO không thêm field khác.

## 3. Impact analysis

| Area | Impact |
| --- | --- |
| PRD §1, §3, FR-1, FR-5, FR-8, FR-10, FR-11, FR-17 | Sản phẩm phục vụ trường mầm non và trung tâm ngoại ngữ; School kind; SchoolYear không ngày kết thúc; CollectionRun theo phạm vi và kỳ. |
| Addendum | Thay invariant "mọi run là MONTHLY"; thêm School kind, feature map, quy tắc kỳ liền trước. |
| Architecture Spine AD-6, AD-7 | `roster` sở hữu School không dùng năm học; `finance` sở hữu scope/period của CollectionRun. |
| SPEC | Constraint MONTHLY đổi thành run cùng phạm vi kế tiếp theo kỳ. |
| Epics | Story 1.8, 2.7, 5.50-5.53. |
| Schema | `School.kind`; `SchoolYear.endsOn` nullable; `CollectionRun` bỏ `type`, thêm `scope`, `classId`, `name`, `periodStartsOn`, `periodEndsOn`; unique theo tháng thành partial. |
| UX/mockups | Mới: `ops/` tạo School có loại trường; `admin/` mở Đợt thu theo lớp, danh sách và chi tiết Đợt thu có cột Lớp/Kỳ, shell trung tâm không có năm học. Cần business owner review trước khi code UI. |
| Teacher/Parent | Ẩn nhật ký và đón trả với trung tâm; Parent thấy `periodLabel`. |

## 4. Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Giữ run tháng, thêm học phí unit bằng dòng linh hoạt theo lớp | Rejected | Lớp tuyển sau khi run tháng generate không thu được; kế toán phải thêm tay từng Invoice. |
| Thêm loại run `UNIT` cạnh `MONTHLY` | Rejected | Hai nhánh code cho nợ cũ, carry, thứ tự và khấu trừ. |
| `schoolYearId` nullable cho trung tâm | Rejected | 58 cột khóa và mọi unique/composite FK chứa SchoolYear; null làm mất ràng buộc. |
| Năm học của trung tâm = năm tài chính | Rejected | Mỗi 31/12 phải tạo lại lớp đang học dở, cắt chuỗi run của lớp và chuyển nợ sang năm; báo cáo năm chỉ cần lọc khoảng tháng. |
| Bỏ hẳn `billingMonth` | Rejected | Vẫn cần một chiều tháng cho lọc, báo cáo và coverage theo tháng; giữ làm field suy ra, bỏ vai trò định danh và thứ tự. |
| Cho enrollment `WITHDRAWN` học lại trên hồ sơ cũ | Rejected | Business owner chọn một quy tắc cho cả hai loại trường: quay lại là học sinh mới; liên kết Parent theo email không bị ảnh hưởng. |
| Lịch học theo lớp, thực thể Unit, prorate theo buổi | Deferred | Không cần khi nghỉ không hoàn tiền và kế toán tự điều chỉnh. |
| Hai scope run trong cùng một School | Deferred | Cần quy tắc nợ cũ và thu trùng chéo scope. |

## 5. Stories

### Story 1.8: Loại trường và feature theo loại

- Given Platform Operator provision School, when chọn `PRESCHOOL` hoặc `LANGUAGE_CENTER`, then `kind` được lưu, audit và không sửa được; thiếu hoặc sai `kind` bị từ chối. School hiện có là `PRESCHOOL`.
- Given actor có membership, when đọc School context, then response có `schoolKind` và `features`; portal ẩn navigation của feature tắt và dùng nhãn theo loại trường.
- Given School tắt `dailyJournal`/`handover`, when gọi mutation tương ứng, then `409 SCHOOL_FEATURE_DISABLED`.

### Story 2.7: School không dùng năm học

- Given provision `LANGUAGE_CENTER`, then có đúng một SchoolYear không ngày kết thúc; tạo năm, chuyển năm, close year trả `409 SCHOOL_YEAR_NOT_USED`.
- Given SchoolYear không ngày kết thúc, when tạo Class, enrollment, chuyển lớp, phân công staff với ngày bất kỳ từ `startsOn`, then hợp lệ và SchoolYear luôn active.

### Story 5.50: Đợt thu theo phạm vi và kỳ dịch vụ

- Given migration, then run hiện có là `SCHOOL` với kỳ trọn tháng và tên "Tháng MM/YYYY"; toàn bộ hành vi và test của run tháng không đổi.
- Given School `collectionRunScope = CLASS`, when Finance mở run cho một lớp `ACTIVE` với tên và kỳ, then run được tạo, `billingMonth` là tháng của `periodStartsOn`; kỳ chồng run khác cùng lớp, lớp khác School/SchoolYear hoặc scope không được phép bị từ chối.
- Given run `CLASS`, then selection chỉ gồm Student thuộc lớp ít nhất một ngày trong kỳ; template rỗng ở run đầu, sao chép dòng cả lớp từ run liền trước cùng lớp ở run sau; `FIXED` không tự thêm. Tự trừ ngày nghỉ và quyết toán không áp dụng cho run `CLASS`. *(Sửa 2026-10-13: run `CLASS` seed `FIXED` toàn trường hoặc gán lớp của run, và chỉ sao chép dòng `FLEXIBLE`; xem sprint-change-proposal-2026-10-13-fixed-receivable-classes.)*

### Story 5.51: Quy tắc theo kỳ cho nợ cũ, carry, dịch vụ và cờ trùng kỳ

- Given hai run cùng phạm vi, when phát hành Invoice của run sau trong khi run trước chưa `CLOSED`, then `409 PREVIOUS_RUN_NOT_CLOSED` nêu tên run cần đóng; run của lớp khác không chặn.
- Given Invoice chưa thu của Student ở run `CLOSED` có kỳ sớm hơn (kể cả lớp cũ), then chuyển nợ kỳ trước và carry chênh lệch hoạt động như run tháng.
- Given run `CLASS`, then dòng ngoại khóa/dịch vụ lấy membership hiệu lực trong kỳ; không có đề xuất tự trừ ngày nghỉ, quyết toán hay coverage.
- Given Student có dòng cùng Receivable ở run khác chồng kỳ, then dòng mới có cờ **Trùng kỳ**.

### Story 5.52: Giao diện Đợt thu theo lớp và Parent period label

- Given School trung tâm, then Admin mở Đợt thu bằng form lớp + tên + kỳ, danh sách và chi tiết hiển thị Lớp/Kỳ, thêm Student vào giữa unit, theo mockup đã duyệt.
- Given Parent xem obligation, then thấy `periodLabel` của run; không có field mới ngoài minimum DTO.

### Story 5.53: Release gate

- PostgreSQL tests: partial unique theo scope, chồng kỳ cùng lớp, tenant graph của `classId`, thứ tự theo kỳ, nợ cũ khi đổi lớp, carry, cờ trùng kỳ, idempotency/concurrency.
- Admin E2E trung tâm: provision -> tạo hai lớp -> mở run unit lệch nhau -> thêm đưa đón -> generate -> thêm học viên giữa unit -> phát hành -> thu tiền -> đóng -> mở unit kế tiếp có nợ cũ.
- Regression mầm non: toàn bộ suite Finance hiện có xanh, không đổi hành vi.

## 6. Tracker

```yaml
1-8-loai-truong-va-feature-theo-loai: ready-for-dev
2-7-school-khong-dung-nam-hoc: backlog
5-50-dot-thu-theo-pham-vi-va-ky-dich-vu: backlog
5-51-quy-tac-theo-ky-cho-no-cu-carry-dich-vu-va-co-trung-ky: backlog
5-52-giao-dien-dot-thu-theo-lop-va-parent-period-label: backlog
5-53-release-gate-trung-tam-ngoai-ngu: backlog
```

## 7. Implementation handoff

1. Áp dụng PRD, Addendum, Spine, SPEC, Epics và tracker.
2. Tạo mockup theo mục 3 và cho business owner review trước khi code UI.
3. Thứ tự build: 1.8 -> 2.7 -> 5.50 -> 5.51 -> 5.52 -> 5.53. Phần API của 1.8, 2.7, 5.50, 5.51 không phụ thuộc mockup.

## 8. Open items

- Khóa sổ theo ngày cho School không dùng năm học: proposal riêng khi có nhu cầu.
- Override feature theo từng School và hai scope run trong một School: deferred.
- Phân bổ doanh thu một unit qua nhiều tháng: không làm; nếu kế toán cần sẽ là báo cáo riêng.

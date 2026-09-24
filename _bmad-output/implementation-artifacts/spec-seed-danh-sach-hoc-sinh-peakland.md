---
title: 'Seed danh sách lớp và học sinh PeakLand'
type: 'feature'
created: '2026-09-23'
status: 'in-review'
review_loop_iteration: 1
baseline_commit: '904c382267e5c66f517b5a51883e670781845360'
context:
  - '_bmad-output/implementation-artifacts/spec-cap-nhat-seed-truong-mau-peakland.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Development seed PeakLand mới chỉ tạo School, owner graph và SchoolYear trống, nên không có danh sách lớp/học sinh thật để kiểm thử các luồng vận hành danh bộ. File `docs/peakland/hocsinh-peakland.csv` là nguồn danh sách 127 học sinh cần phản ánh vào fixture.

**Approach:** Đọc CSV tại thời điểm chạy seed để dựng snapshot roster `2026-2027`: bảy lớp, 126 enrollment `ENROLLED` theo lớp và một enrollment `WAITING_FOR_CLASS`. Mỗi dòng dùng mã fixture tuần tự `PL<STT>` thay cho mã legacy trong CSV, đồng thời giữ họ tên, tên thường gọi, ngày sinh, giới tính và địa chỉ học sinh.

## Boundaries & Constraints

**Always:** Seed chỉ chạy với `NODE_ENV=development`, nằm trong transaction/advisory lock hiện hữu và mọi truy vấn roster luôn scope theo School `pl`. SchoolYear đích duy nhất là `2026-2027`; enrollment và class assignment dùng `2026-08-01` để nằm trong snapshot năm học. `studentCode` fixture `PL1` đến `PL127` là khóa reconcile idempotent; seed tái chạy phải hội tụ lớp, hồ sơ, enrollment và assignment. `studentCodeSequence` phải được nâng tối thiểu lên `127`, để API tạo học sinh tiếp theo cấp `PL128` hoặc mã cao hơn. Map `Nam` thành `NAM`, `Nữ` thành `NU`; chỉ seed địa chỉ học sinh, không seed bất kỳ dữ liệu phụ huynh, tài khoản, số điện thoại, email, định danh hay ghi chú CSV nào.

**Ask First:** Dừng nếu CSV thay đổi số dòng/STT không tuần tự, có tên lớp/trạng thái ngoài bảy lớp và hai trạng thái đang được xử lý, hoặc cần import mã legacy, lịch sử năm học, phụ huynh hay PII khác.

**Never:** Không sửa schema/migration, không gọi RosterService hoặc tạo Operation/audit/lifecycle transition giả, không dùng mã legacy trong CSV, không tạo ParentProfile/StudentParent, không xóa hay thay đổi bản ghi roster không thuộc fixture mã `PL1..PL127`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Seed lần đầu | CSV 127 dòng hợp lệ, database PeakLand trống | Tạo 7 Class cho `2026-2027`, 127 Student `PL1..PL127`, 126 enrollment có lớp/assignment và 1 enrollment chờ xếp lớp | Lỗi parse hoặc persistence rollback toàn transaction |
| Seed chạy lại | Fixture roster đã tồn tại | Cập nhật profile/lớp/enrollment/assignment về snapshot CSV, không tạo Student/enrollment/assignment trùng và nâng sequence tối thiểu lên 127 | Reconcile bằng `schoolId` + mã fixture trong transaction |
| CSV không hợp lệ | Dòng thiếu trường bắt buộc, ngày sinh sai, giới tính/trạng thái/lớp không được hỗ trợ hoặc STT trùng/không tuần tự | Không ghi dữ liệu roster một phần | Ném lỗi nêu rõ dòng và trường lỗi trước khi bắt đầu transaction |
| Học sinh chờ xếp lớp | Dòng `Chờ phân lớp` không có lớp | Tạo enrollment `WAITING_FOR_CLASS` với `classId`/`className` null và không có assignment | Từ chối nếu dòng chờ xếp lớp lại có lớp |

</frozen-after-approval>

## Code Map

- `docs/peakland/hocsinh-peakland.csv` -- nguồn CSV 127 dòng; chỉ dùng cột STT, Học sinh, Tên thường gọi, Lớp, Trạng thái, Ngày sinh, Giới tính và Địa chỉ.
- `apps/api/prisma/seed.ts:5-115` -- development fixture hiện hữu, đã có environment guard, Prisma transaction và advisory lock; mở rộng ở đây để parse/reconcile roster dưới cùng transaction.
- `apps/api/prisma/schema.prisma:75-118,348-445` -- contracts SchoolYear/Class/Student/StudentEnrollment/EnrollmentClassAssignment; không có natural source key nên mã fixture là khóa seed.
- `apps/api/src/modules/roster/roster.service.ts:1165-1279` -- canonical persistence shape: mã do School sequence sinh trong API, enrollment snapshots và assignment "Khởi tạo enrollment". Seed ghi trực tiếp có chủ đích để không tạo Operation/audit giả.
- `apps/api/prisma/migrations/20260918000002_enrollment_class_transition_history/migration.sql:22-23` và `20260918000003_roster_close_year_finality/migration.sql:5-18` -- interval/exclusion và boundary database enforcement mà seed phải tuân theo.
- `apps/api/prisma/seed.test.ts:1-16` -- unit regression hiện có cho guard; mở rộng kiểm tra parser/mapping độc lập database.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/seed.ts` -- thêm parser CSV nội bộ và fixture roster đã validate; tạo/reconcile bảy lớp của `2026-2027`, Student `PL1..PL127`, enrollment snapshot và class assignment theo cùng transaction/advisory lock; sequence tối thiểu là 127.
- [x] `apps/api/prisma/seed.test.ts` -- kiểm tra parser cho 127 record, danh sách bảy lớp, mapping gender/address, dòng chờ xếp lớp và các CSV malformed không chạm database.
- [x] `packages/contracts/src/structure.test.ts` -- bổ sung structural regression để seed giữ tham chiếu CSV, mã fixture tuần tự và không import parent PII nếu test này là nơi khóa fixture contract hiện hành.
- [x] `apps/api/src/integration/bootstrap.integration.test.ts` -- kiểm tra seed trên database integration mục tiêu tạo đủ roster và sequence là 127.

**Acceptance Criteria:**
- Given development seed nhận CSV PeakLand không đổi, when seed hoàn tất trên database trống, then `2026-2027` có đúng bảy lớp, 127 Student mã `PL1` đến `PL127`, 126 enrollment `ENROLLED` với assignment và một `WAITING_FOR_CLASS` không assignment.
- Given một học sinh trong CSV, when seed hoàn tất, then full name, preferred name, date of birth, gender và address bằng các cột học sinh tương ứng; seed không tạo ParentProfile hoặc StudentParent từ CSV.
- Given seed chạy lại, when fixture đã tồn tại, then số Student/enrollment/assignment fixture không tăng, Student `PL1..PL127` giữ nguyên và `studentCodeSequence` tối thiểu là 127 để API cấp mã tiếp theo từ `PL128`.
- Given parser gặp cấu trúc/cột/dòng không hợp lệ, when seed bắt đầu, then ném lỗi mô tả dòng/trường trước transaction và database không nhận roster một phần.

## Design Notes

Ngày bắt đầu học trong CSV là lịch sử legacy, không thể gắn trực tiếp vào SchoolYear snapshot `2026-2027`. Seed cố ý dùng một effective date chung `2026-08-01` và không mô phỏng lịch sử transition. Mã CSV legacy cũng không phải khóa an toàn vì thiếu trên 52 dòng và mâu thuẫn quy tắc mã server-generated; `STT` tuần tự được chuyển thành mã fixture xác định. Sequence được nâng lên 127 để namespace fixture không va chạm API.

## Spec Change Log

- Review phát hiện `studentCodeSequence = 0` sẽ làm API cấp lại `PL1`; theo xác nhận người dùng, nâng sequence tối thiểu lên `127` để API tiếp tục tại `PL128`. Giữ parser CSV, fixture mã tuần tự và không import parent data.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test -- prisma/seed.test.ts` -- expected: environment guard và CSV parser/mapping regressions pass mà không cần database.
- `pnpm --filter @passionedu/contracts test` -- expected: structural fixture contract pass nếu có assertion cập nhật.
- `pnpm --filter @passionedu/api prisma:generate && pnpm --filter @passionedu/api typecheck` -- expected: Prisma client và TypeScript hợp lệ.

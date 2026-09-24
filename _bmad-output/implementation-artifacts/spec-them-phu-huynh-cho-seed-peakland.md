---
title: 'Thêm phụ huynh Bố/Mẹ cho seed PeakLand'
type: 'chore'
created: '2026-09-24'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '33a08e467fecb59307dcb6ebd7fbaed09a2e2081'
context:
  - 'AGENTS.md'
  - '_bmad-output/implementation-artifacts/spec-cap-nhat-seed-truong-mau-peakland.md'
  - '_bmad-output/implementation-artifacts/spec-quan-he-nguoi-than-va-menu-danh-bo.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Seed development PeakLand đã có 127 học sinh và enrollment nhưng không import các cột phụ huynh có sẵn trong CSV nguồn, nên cột Mẹ/Bố của danh bộ không có dữ liệu để kiểm tra trực tiếp.

**Approach:** Cho phép `ParentProfile` tồn tại bằng họ tên và số điện thoại để phục vụ liên hệ nhà trường; email chỉ là định danh tùy chọn khi phụ huynh cần liên kết đăng nhập. Mở rộng parser CSV PeakLand để đọc các cột Họ tên, SĐT, Email và Địa chỉ của Mẹ/Bố, sau đó seed đúng contact có họ tên/số điện thoại từ nguồn với nhãn chính xác `Mẹ` hoặc `Bố`.

## Boundaries & Constraints

**Always:** `ParentProfile.emailNormalized` là nullable; khi có giá trị thì lowercase/trimmed và global-unique, còn `userIdentityId` chỉ được liên kết sau luồng login/claim phù hợp. Họ tên và số điện thoại vẫn bắt buộc để nhà trường liên hệ. Parser giữ nguyên validation roster hiện có và đọc thêm đúng các cột phụ huynh của CSV; mỗi contact seed phải có name và phone nguồn không rỗng sau trim, email nguồn chỉ import nếu có. Link được tạo với label literal `Mẹ` hoặc `Bố`; một học sinh có thể có không, một hoặc hai link tùy dữ liệu đủ điều kiện trong nguồn. Seed reconcile profile theo email khi email có mặt; contact thiếu email phải có identity seed ổn định từ dữ liệu nguồn mà không tự tạo email. Tạo link theo khóa `(schoolId, studentId, parentProfileId)`; link active có thể được sửa label về nhãn chuẩn, nhưng seed phải báo lỗi rõ ràng nếu link nguồn đã bị revoke thay vì âm thầm làm mất lịch sử revoke. Không tạo Operation, audit, session hoặc Google subject từ seed.

**Ask First:** Dừng nếu CSV có contact thiếu name hoặc phone mà vẫn cần import; nếu contact thiếu email không thể định danh ổn định với dữ liệu nguồn; nếu một email nguồn trỏ tới contact mâu thuẫn name/phone; nếu cần thay đổi/re-activate link revoked; hoặc nếu cần reconcile toàn bộ contact/profile hiện hữu như desired-state.

**Never:** Không tự bịa hoặc dẫn xuất contact/email thay thế cho ô nguồn trống; không dùng API `ParentsService` từ seed vì API có Operation/audit/idempotency HTTP; không seed vào test/production; không làm thay đổi authorization Parent.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Seed mới | Database PeakLand trống, contact CSV có đủ name/phone | Tạo Profile và active link đúng Mẹ/Bố cho contact nguồn; email null khi nguồn không có | Transaction rollback nếu bất kỳ create/validation lỗi |
| Ô contact thiếu dữ liệu bắt buộc | Name hoặc phone nguồn rỗng | Không tạo profile/link giả định | Báo lỗi hoặc bỏ qua theo policy source đã chốt |
| Contact thiếu email | Name/phone nguồn có, email rỗng | Tạo ParentProfile không email, vẫn hiện trong danh bộ và có thể được liên lạc | Chỉ yêu cầu email ở login/claim, không ở seed |
| Seed lặp lại | Profile/link nguồn đã active | Count không tăng; profile giữ nguyên và link hội tụ nhãn chuẩn | Không tạo bản ghi trùng |
| Profile đã tồn tại | Email nguồn global đã tồn tại | Reuse profile, không ghi đè contact hay Google binding | Báo lỗi khi source mâu thuẫn profile hiện hữu |
| Link nguồn revoked | Composite StudentParent tồn tại nhưng REVOKED | Không tự active lại | Fail rõ ràng, giữ lịch sử revoke |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma:538-570` và migration mới -- chuyển `ParentProfile.emailNormalized` thành nullable while preserving global uniqueness for non-null values; xác nhận FK/index semantics trước khi migrate.
- `apps/api/prisma/seed.ts:30-140,146-260` -- parser và transaction PeakLand hiện có; mở rộng record/parser với các cột Mẹ/Bố nguồn, validate contact đủ họ tên/số điện thoại, rồi ensure profile/link sau khi Student được resolve.
- `apps/api/prisma/seed.test.ts:20-42` -- unit coverage parser hiện ghi không đọc parent data; bổ sung assertion cho contact nguồn, labels, chuẩn hóa và malformed/missing source policy.
- `apps/api/src/modules/parents/parents.service.ts` và controller/contracts/tests -- tách tạo contact liên hệ không email khỏi yêu cầu email khi parent claim/login; không làm suy yếu School scope, CSRF, idempotency, Operation hoặc audit.
- `apps/api/src/integration/bootstrap.integration.test.ts` -- integration seed graph phù hợp để chứng minh fixture thực chạy với migration/database thật.
- `apps/api/src/modules/roster/roster.service.ts:343-362` -- projection chỉ nhận exact literal `Mẹ` và `Bố`, là lý do fixture không dùng biến thể nhãn.
- `apps/api/src/modules/parents/parents.service.ts:122-159` -- precedent lifecycle profile/link, nhưng không tái dùng từ seed vì mutation service ghi Operation/audit và overwrite contact.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma`, migration mới -- làm email ParentProfile optional trong persistence nhưng unique khi hiện diện; generate client và cover migration semantics.
- [x] `apps/api/src/modules/parents/*`, shared contracts và tests -- cho phép staff tạo contact liên hệ bằng họ tên/số điện thoại không email; giữ yêu cầu email tại boundary claim/login parent.
- [x] `apps/api/prisma/seed.ts` -- parse, validate và persist contact Bố/Mẹ trực tiếp từ CSV, scoped theo Student, idempotent và không sửa lifecycle nghiệp vụ.
- [x] `apps/api/prisma/seed.test.ts` -- kiểm tra parser contact nguồn, nhãn exact, email nullable và policy cho dòng contact không đủ name/phone.
- [x] `apps/api/src/integration/bootstrap.integration.test.ts` -- xác minh database fixture có link Mẹ/Bố tương ứng contact CSV đủ điều kiện và tenant scope đúng sau seed.

**Acceptance Criteria:**
- Given development database trống đã chạy migration, when chạy PeakLand seed, then mỗi contact Bố/Mẹ có họ tên/số điện thoại trong CSV tạo một `StudentParent` active với nhãn tương ứng và đúng contact nguồn, dù Email nguồn rỗng.
- Given cùng seed chạy hai lần, when hoàn thành, then count profile/link nguồn không tăng và labels remain exact `Mẹ`/`Bố`.
- Given ParentProfile theo email nguồn có trước, when seed chạy, then seed không ghi đè full name, phone hay user identity của profile đó; Given contact không có email, when được tạo, then profile có `emailNormalized: null` và vẫn usable cho roster/contact.
- Given một link nguồn từng bị revoke, when seed chạy, then command thất bại thay vì reactivation ngầm.

## Design Notes

Email là optional contact identity, không là điều kiện để nhà trường lưu người thân. Cần khảo sát schema hiện hành để chọn identity seed ổn định cho contact không email, ưu tiên một khóa nguồn thật có tính chống trùng như SĐT sau chuẩn hóa và chỉ reuse khi thông tin nguồn nhất quán. Cùng email nguồn có thể được reuse bởi nhiều StudentParent nếu dữ liệu nguồn trùng nhất quán, vì email là khóa global của ParentProfile. Luồng parent login/claim là nơi buộc email và liên kết UserIdentity, không phải roster seed.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test -- seed.test.ts` -- expected: fixture mapping và environment guard pass.
- `pnpm --filter @passionedu/api typecheck` -- expected: seed TypeScript pass.
- `set -a && source ".env.test" && set +a && pnpm --filter @passionedu/api test:integration -- bootstrap.integration.test.ts` -- expected: migration + seed fixture database assertions pass trên test DB.
- `git diff --check` -- expected: không có whitespace error.

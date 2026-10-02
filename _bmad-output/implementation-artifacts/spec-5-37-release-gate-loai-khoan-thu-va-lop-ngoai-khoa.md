---
title: 'Story 5.37: Release gate loại khoản thu và lớp ngoại khóa'
type: 'feature'
created: '2026-10-02'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_commit: 'c166fe8'
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-02-receivable-kinds-and-extracurricular-classes.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md (AD-11 correction 2026-10-02)'
  - '_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/addendum.md (verification matrix, row Receivable kinds/lớp ngoại khóa)'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Stories 5.33-5.36 đã giao ba loại khoản thu cố định, template theo loại/phạm vi, lớp ngoại khóa và dòng ngoại khóa; cần một release gate chứng minh các invariant tenant, typed group, membership, scope, fingerprint, concurrency, idempotency và provenance cùng một Admin flow end-to-end, mà không thêm hành vi mới.

**Approach:** Audit coverage hiện có theo AC và matrix addendum, chỉ bổ sung khoảng trống (concurrency của lệnh cạnh tranh, E2E chuyển lớp A1 → A2 và rời lớp giữa tháng, kiểm tra tĩnh contract). Tài liệu này là coverage matrix: mỗi AC/invariant ánh xạ tới test cụ thể.

## Boundaries & Constraints

**Always:** Giữ tenant graph theo `(schoolId, …)`, UUID `Idempotency-Key` + Operation + audit cho mọi mutation, VND `BIGINT` do API tính, test PostgreSQL chạy trên database tạo lại từ migration (`.env.test`).

**Never:** Không thêm model/endpoint mới, không client-calculated VND, không phụ thuộc Parent/Teacher, không đổi `Class`, `EnrollmentClassAssignment`, `StaffClassAssignment` hay authorization nhân sự, không sửa migration lịch sử.

</intent-contract>

## Code Map

- `apps/api/src/integration/finance.integration.test.ts` -- typed group, kind lock, seed, scope, preview/READY/generate, provenance, race tests.
- `apps/api/src/integration/extracurricular-classes.integration.test.ts` -- lớp, lifecycle, membership, overlap, interval, provenance kết thúc, concurrency, rename.
- `apps/api/src/integration/receivable-group-kinds.integration.test.ts` -- replay migration chuẩn hoá nhóm trên dữ liệu legacy.
- `apps/api/src/integration/ops.provision.integration.test.ts`, `bootstrap.integration.test.ts` -- provisioning/seed tạo đúng ba nhóm typed.
- `apps/api/src/integration/finance-release-scope.integration.test.ts` -- gate tĩnh: evidence bắt buộc, E2E bắt buộc, không client VND/Parent/Teacher, không đổi Class/staff authorization.
- `apps/web/e2e/finance-release-gate.spec.ts` -- Admin flow end-to-end.
- `apps/web/src/finance/*.test.tsx` -- UI contract: server values, dialog, reconcile, stale response.

## Coverage Matrix

### AC 1 - PostgreSQL, multi-School fixture

| Invariant | Test (file › title) |
| --- | --- |
| Tenant graph: nhóm / Receivable | `finance.integration` › creates a Receivable by kind in the selected School and rejects unknown kinds and foreign or mismatched groups; › changes the kind of an unused Receivable… (foreign Receivable 404) ; › edits name, unit and price… (foreign School 404) |
| Tenant graph: ExtracurricularClass | `extracurricular-classes` › creates classes for ACTIVE EXTRACURRICULAR Receivables only… (foreign Receivable/SchoolYear 404, DB từ chối graph chéo); › renames a class… (foreign 404) |
| Tenant graph: membership | `extracurricular-classes` › replays a bulk add by key… (Student/class/membership School khác và id không tồn tại cho cùng phản hồi); › keeps memberships inside the enrollment interval… |
| Tenant graph: scope target / exclusion | `finance.integration` › validates scope… (foreign class/Student); › guards template scope targets on every write…; › blocks READY on membership and receivable changes… (exclusion foreign class, membership/Operation/identity FK âm tính) |
| Typed group invariant | `finance.integration` › keeps exactly three typed groups per School and refuses to create, rename, retype or remove one; `receivable-group-kinds` › maps legacy groups, removes custom groups and leaves exactly three typed groups per School, idempotently and with audit; `ops.provision`/`bootstrap` (ba nhóm typed khi provision/seed); `finance.service.test` › has no API to create, rename or change the lifecycle of a group |
| Kind lock (Invoice, template, lớp) và race | `finance.integration` › changes the kind…; › serializes kind change against template-line creation in both directions; › serializes kind change against invoice-line creation in both directions; `extracurricular-classes` › creates classes… (khoá kind qua lớp, trigger DB) |
| Membership overlap và all-or-nothing | `extracurricular-classes` › adds and ends memberships singly and in bulk… (overlap, bulk add/end all-or-nothing, một audit mỗi membership, exclusion constraint DB) |
| Membership trong khoảng enrollment, provenance kết thúc | `extracurricular-classes` › keeps memberships inside the enrollment interval…; › requires complete end provenance… |
| Fixed seed khi mở run | `finance.integration` › seeds a new run with every ACTIVE FIXED receivable…; › serializes run seeding with a receivable deactivation… |
| Scope resolution theo lớp ngày đầu tháng | `finance.integration` › resolves class scope on the first day of the month, reports per-line counts and subtotals… (Student chuyển lớp giữa tháng) |
| Scope shape / guard khi ghi | `finance.integration` › guards template scope targets on every write and enforces the scope shape at commit (SQL trực tiếp: rỗng, xoá target cuối, trộn, sau READY, UPDATE) |
| Một dòng ngoại khóa mỗi Receivable dù chuyển lớp; MID_MONTH / CLASS_CHANGE | `finance.integration` › lists extracurricular classes with month members and bills merged lines with MID_MONTH and CLASS_CHANGE flags…; `finance.service.test` › merges classes sharing a receivable… |
| Ngoại khóa không tạo eligibility; membership ngoài tháng bị bỏ qua | `finance.integration` › lists extracurricular classes… (Student không phân lớp vẫn `NO_CLASS_ASSIGNMENT`, tháng 8 không tính) |
| `NO_APPLICABLE_LINES` và generate bị từ chối khi không ai có dòng | `finance.integration` › skips eligible Students with no applicable line as NO_APPLICABLE_LINES… |
| Loại / khôi phục lớp khỏi run | `finance.integration` › lists extracurricular classes… (exclude/restore, audit, replay, stale); › blocks READY… (chỉ DRAFT, trigger DB) |
| Fingerprint stale khi membership/Receivable/scope đổi | `finance.integration` › blocks READY on membership and receivable changes after the preview…; › resolves class scope… (scope); › makes READY wait for an in-flight membership change and then sees it |
| Idempotency | `extracurricular-classes` › replays a bulk add by key…; › creates classes… (replay + conflict); › renames a class… ; `finance.integration` › seeds a new run… (replay open run), › generates extracurricular lines… (addGeneratedStudent replay) |
| Concurrency | `finance.integration` › makes READY wait for an in-flight membership change…; kind race hai chiều; refund/price race; `extracurricular-classes` › serializes class creation against receivable deactivation…; › serializes competing commands: one concurrent membership add, class creation and rename wins… |
| Provenance snapshot bất biến | `finance.integration` › generates extracurricular lines with immutable provenance, applies promotions, never rewrites after GENERATED, and adds a Student from live memberships and the snapshot; › resolves class scope… (TEMPLATE_FIXED / TEMPLATE_FLEXIBLE + trigger immutable) |
| Promotion trên khoản ngoại khóa; Student thêm sau GENERATED | `finance.integration` › generates extracurricular lines with immutable provenance… |
| Capability FINANCE_MANAGE | `extracurricular-classes` › replays a bulk add by key… (403 sau khi bỏ capability); `finance.controller.test` (origin/CSRF, header idempotency cho mọi route mới) |

### AC 2 - Admin E2E (`finance-release-gate.spec.ts`, một flow, không spec song song)

| Bước AC | Chứng minh trong E2E |
| --- | --- |
| Tạo lớp ngoại khóa | Dialog `Thêm lớp ngoại khóa` cho A1 và A2 (A2 hiện `Dùng chung với: Tiếng Anh A1 (T2-T4).`) |
| Thêm thành viên hàng loạt | `Chọn tất cả học sinh có thể thêm` + `Hiệu lực từ` + lý do, hai học sinh một lần gửi |
| Mở run, khoản cố định có sẵn | Run 11/2026 hiện `Học phí Release 1` với `Cố định`, `Tự thêm khi mở đợt thu`, `Toàn bộ` |
| Rời lớp giữa tháng / chuyển A1 → A2 | An kết thúc 20/11 (cờ `Vào/nghỉ giữa tháng`); Bình kết thúc A1 15/11 và vào A2 từ 16/11 (cờ `Chuyển lớp trong tháng`, một dòng gộp) |
| Loại / khôi phục lớp trong run | Run 10/2026: `Loại khỏi đợt này` → `Khôi phục` → loại lại, trạng thái do server trả |
| Thêm khoản linh hoạt theo một lớp | `Thêm khoản thu` → `Lớp chính thức` → `Mầm Release 1`; bảng hiện `Lớp chính thức: Mầm Release 1` |
| Preview theo dòng | `Tạm tính theo dòng khoản thu`: học phí 300.000, dã ngoại 100.000, Tiếng Anh 1.200.000; tạm tính theo lớp 1.200.000 đ |
| Generate và rà soát | Badge `Cố định` / `Linh hoạt · Lớp chính thức: Mầm Release 1` / `Ngoại khóa · Tiếng Anh A1 (T2-T4) → Tiếng Anh A2 (T3-T5)`; đúng một dòng Tiếng Anh cho Bình |
| Điều chỉnh một Student | `Điều chỉnh` → Đơn giá + Lý do bắt buộc → `Lưu điều chỉnh`; tổng do server tính lại |
| Chỉ hiện server value | Mọi số trong flow đến từ API; gate tĩnh bên dưới cấm tính VND ở browser |

Web unit (UI contract): `extracurricular-classes-workspace.test.tsx` (danh sách/chi tiết, dialog tạo/thêm/kết thúc/ngừng, reconcile theo Operation + resend cùng key, response cũ, đổi tên), `finance-workspace.test.tsx` (template theo loại/phạm vi, modal, xác nhận bỏ, preview theo dòng, section lớp trong đợt, badge/cờ, Điều chỉnh, reconcile hoàn tất, response cũ).

### AC 3 - Gate tĩnh (`finance-release-scope.integration.test.ts`, describe Story 5.37)

| Điều kiện | Kiểm tra |
| --- | --- |
| Evidence PostgreSQL và E2E không bị xoá | Regex trên tên test/bước E2E bắt buộc ở bảng trên |
| Không client-calculated VND | `finance-workspace.tsx`, `extracurricular-classes-workspace.tsx`: không `BigInt(a) op BigInt(b)`, không `reduce` trên BigInt, không nhân `defaultUnitPrice`, không `Math.round/floor/ceil` |
| Không phụ thuộc Parent/Teacher | Không import module/đường dẫn parent hoặc teacher ở web finance, `finance.service.ts`, `finance.controller.ts` |
| Không đổi `Class`/staff authorization | `finance.service.ts` không ghi `class`, `enrollmentClassAssignment`, `staffClassAssignment`, `staffProfile`, `schoolPosition`, `positionCapabilityGrant` và không đọc `staffClassAssignment` (ngoại lệ có chủ đích có sẵn: `setClassDefaultBankAccount` chỉ đặt tài khoản nhận mặc định của lớp, dữ liệu Finance); aggregate mới không có relation tới staff authorization; không migration nào từ 2026-10-02 `ALTER`/trigger lên `Class`, `EnrollmentClassAssignment`, `StaffClassAssignment`, `StaffProfile`, `SchoolPosition`, `PositionCapabilityGrant` |

## Không phủ (và lý do)

- Parent projection lớp ngoại khóa, giáo viên ngoại khóa, lịch/điểm danh buổi ngoại khóa, ChargeRule đầy đủ, tự prorate: ngoài phạm vi theo proposal 2026-10-02 §1/§3.3, không có hành vi để kiểm thử.
- `ON_LEAVE` và các lifecycle enrollment khác bị từ chối khi thêm membership: có test từ chối; billing eligibility vẫn do run quyết định (Story 5.36).
- Concurrency của hai lệnh loại/khôi phục lớp cùng lúc không có test riêng: dùng chung `mutate` (khoá School) và kiểm tra version run như template mutation đã được gate ở Story 5.11.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api typecheck`, `pnpm --filter @passionedu/admin-web typecheck` (lint của repo là `tsc`).
- `pnpm --filter @passionedu/api test` -- unit.
- `pnpm --filter @passionedu/api test:integration` với database tạo lại từ migration (`.env.test`, `TARGET_INTEGRATION_DATABASE_URL`).
- `pnpm --filter @passionedu/admin-web test` -- vitest (chạy 3 lần để loại flaky).
- `pnpm --filter @passionedu/admin-web test:e2e finance-release-gate` và `release-gate` với `E2E_DATABASE_URL` tạo lại từ migration, từng spec chạy riêng.

**Results:** xem báo cáo cuối của story trong commit; số lượng được ghi lại ở đó vì thay đổi theo từng lần chạy.

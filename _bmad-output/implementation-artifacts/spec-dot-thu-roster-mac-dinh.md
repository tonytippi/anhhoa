---
title: 'Đợt thu tạo hóa đơn theo roster mặc định'
type: 'feature'
created: '2026-09-28'
status: 'done'
baseline_commit: '57c087e1465b79c450c3a59fa571d3ba8140bf5d'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Trang `Đợt thu` đã có bảng ưu tiên và dialog tạo, nhưng chi tiết đợt thu vẫn buộc Kế toán chọn từng học sinh trước khi xem trước và tạo hóa đơn. Thao tác này thừa, khó dùng, đồng thời làm browser nắm phạm vi roster không cần thiết.

**Approach:** Giữ bảng danh sách và dialog tạo đợt thu hiện có; loại bỏ hoàn toàn chọn học sinh. Preview và generation sẽ do API xác định từ roster toàn bộ học sinh có enrollment `ENROLLED` hiệu lực và lớp `ACTIVE` tại mốc tháng thu, rồi tạo hóa đơn cho phạm vi đó sau quy trình preview/READY/Operation hiện hữu.

## Boundaries & Constraints

**Always:** API reauthorize `FINANCE_MANAGE` và School cho mọi read/write; `schoolId`, run ID và browser state chỉ là selector. Roster mặc định phải do server truy vấn theo School, SchoolYear, enrollment/class assignment hiệu lực tại ngày đầu billing month, enrollment `ENROLLED` và class `ACTIVE`. Preview fingerprint phải bao gồm canonical roster facts để roster đổi sau preview bị stale. Giữ lifecycle `DRAFT -> READY -> GENERATED -> CLOSED`, preview bắt buộc, CSRF, UUID idempotency, Operation reconciliation, audit, VND `BIGINT`, template snapshot, generation durable/atomic và giới hạn một Invoice trên mỗi Student/Run.

**Ask First:** Tự động thêm học sinh nhập học sau khi một run đã `GENERATED`, hoặc thay đổi semantics của command thêm học sinh hậu-generation. Nếu loại bỏ persistence `CollectionRunSelection` đòi migration dữ liệu đã triển khai, dừng để xác nhận migration/rollout.

**Never:** Không tạo Invoice trực tiếp khi mở run; không client-filter hoặc client-count roster; không nhận Student ID từ browser để quyết định phạm vi; không làm yếu preview/fingerprint, Finance authorization, lifecycle, audit hay Operation. Không thay đổi Receipt, settlement, Parent hoặc Payroll.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mở Đợt thu | Finance mở destination | Bảng đợt thu là surface đầu tiên; `Tạo đợt thu` mở modal đã có | Giữ loading/error/filter hiện hữu |
| Rà soát roster mặc định | Run `DRAFT`, template hợp lệ | Không có checkbox, select-all hoặc lưu danh sách; preview liệt kê mọi học sinh ENROLLED đủ hiệu lực và skips do server trả | Không đủ học sinh/template giữ lỗi server và không tạo READY |
| Roster đổi sau preview | Enrollment/lớp thay đổi trước READY/generate | Fingerprint stale; Finance phải preview lại | Không enqueue generation từ preview cũ |
| Generate | Run `READY` với preview hiện tại | Worker tạo Invoice cho toàn bộ roster server-authoritative tại snapshot | Timeout giữ Operation ID để đối soát, không retry mù |

</frozen-after-approval>

## Code Map

- `apps/web/src/finance/finance-workspace.tsx` -- Đã có run table và accessible create/open dialog ở vùng `runsPath`/toolbar; loại bỏ `selectedStudentIds`, `selectionDirty`, `loadCandidates`, `saveSelection`, `toggleStudent` và bảng checkbox trong DRAFT detail. Giữ preview/generate chỉ hiển thị API result và Operation reconciliation.
- `apps/web/src/finance/finance-workspace.test.tsx` -- Fixture chứa `selectedStudentIds`; giữ regression table/dialog nhưng đổi các test selection thành proof không render/call selection và preview/generate dùng response roster mặc định.
- `apps/web/e2e/finance-release-gate.spec.ts` -- Hiện chọn checkbox và assert `PUT /selection`; thay bằng proof dialog/table-first, không có control chọn học sinh, preview/generate toàn roster seed.
- `apps/api/src/modules/finance/finance.controller.ts` -- `collection-run-candidates` và `PUT .../selection` là contract selection cần gỡ/không còn expose; không đổi các header bảo vệ write khác.
- `apps/api/src/modules/finance/finance.service.ts` -- `runInclude`/`runDto`, `openRun`, `replaceSelection`, `selectionPreview`, `readyRun`, `generateRun` là các điểm chuyển scope từ `CollectionRunSelection` sang roster server-authoritative. Tái dùng eligibility enrollment/class tại `selectionPreview`; fingerprint phải canonicalize roster. Giữ worker generation và `addGeneratedStudent` cho đến khi có quyết định riêng.
- `apps/api/src/modules/finance/finance.service.test.ts`, `apps/api/src/modules/finance/finance.controller.test.ts`, `apps/api/src/integration/finance.integration.test.ts` -- Thay test selection/replay bằng School-scoped default roster, hiệu lực ENROLLED/class ACTIVE và stale fingerprint; giữ CSRF/idempotency/lifecycle proof.
- `apps/api/prisma/schema.prisma` -- `CollectionRun.selections` và `CollectionRunSelection` chỉ được xóa cùng migration được xác nhận; không coi đây là UI-only cleanup.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html` -- Mockup chính tắc hiện có table/dialog nhưng vẫn có select-all/checkbox; cập nhật contract và visual để phù hợp intent mới.
- `_bmad-output/implementation-artifacts/spec-5-17-dot-thu-table-first-va-ra-soat-draft-tuan-tu.md` -- Historical completed spec ghi selection; không sửa frozen artifact, thay đổi này là spec kế tiếp.

## Tasks & Acceptance

**Execution:**
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html` -- cập nhật mockup đã review: modal/table-first giữ nguyên, bỏ checkbox/select-all/copy chọn học sinh và diễn đạt phạm vi roster mặc định.
- [x] `apps/api/src/modules/finance/finance.controller.ts`, `apps/api/src/modules/finance/finance.service.ts` -- loại contract selection browser và derive preview/generation scope từ canonical eligible roster; giữ tenant authorization, fingerprint, lifecycle và mutation safety.
- [x] `apps/api/prisma/schema.prisma` và migration nếu cần -- chỉ xóa persistence selection khi xác minh chưa có dữ liệu deploy cần preserve hoặc sau quyết định rollout; nếu không, ngừng dùng relation mà không destructive migration.
- [x] `apps/web/src/finance/finance-workspace.tsx` -- bỏ UI/state/request chọn học sinh; làm detail giải thích API tự bao phủ toàn bộ học sinh đang theo học và render server preview/result.
- [ ] `apps/api/src/modules/finance/finance.service.test.ts`, `apps/api/src/modules/finance/finance.controller.test.ts`, `apps/api/src/integration/finance.integration.test.ts`, `apps/web/src/finance/finance-workspace.test.tsx`, `apps/web/e2e/finance-release-gate.spec.ts` -- unit/controller/UI và E2E source đã đổi sang default roster/no selection; integration vẫn cần thay toàn bộ fixture/call trực tiếp `replaceSelection` trước khi task hoàn tất.

**Acceptance Criteria:**
- Given Finance mở `Đợt thu`, when destination tải xong, then bảng run là surface đầu tiên và create dùng modal dialog, không có form tạo nằm dưới bảng.
- Given Finance mở một run `DRAFT`, when template/preview được hiển thị, then không có chọn từng học sinh, checkbox, select-all hay request lưu selection; server xác định phạm vi roster.
- Given một học sinh có enrollment `ENROLLED`, enrollment/class assignment hiệu lực và class `ACTIVE` tại mốc tháng thu của run, when preview và generation dùng snapshot hiện tại, then học sinh đó nằm trong phạm vi tạo Invoice; các bản ghi không đủ eligibility chỉ xuất hiện trong server-returned skips phù hợp.
- Given roster/template liên quan thay đổi sau preview, when Finance ready hoặc generate run, then server từ chối preview fingerprint stale và yêu cầu preview lại.
- Given Finance generate một run `READY`, when generation hoàn tất, then Invoice chỉ được tạo theo server-authoritative roster snapshot và các bảo vệ Operation/idempotency/audit/lifecycle hiện hữu vẫn có hiệu lực.

## Design Notes

“Toàn bộ học sinh đang theo học” là roster có eligibility tại mốc billing month, không phải mọi `Student` của School hoặc mọi enrollment lịch sử. Mở run vẫn chỉ tạo aggregate DRAFT; Invoice được tạo ở generation sau preview để bảo toàn snapshot và khả năng phát hiện roster thay đổi.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test -- src/modules/finance/finance.service.test.ts src/modules/finance/finance.controller.test.ts` -- expected: default roster, Finance/School scope, lifecycle và cursor tests pass.
- `pnpm --filter @passionedu/api test:integration -- finance.integration.test.ts` -- expected: preview/generate roster eligibility, stale fingerprint và idempotent Operation pass against `.env.test` database.
- `pnpm --filter @passionedu/admin-web test -- src/finance/finance-workspace.test.tsx` -- expected: table/dialog retained and no student selection control/request.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: Admin TypeScript passes.
- `pnpm --filter @passionedu/admin-web test:e2e -- finance-release-gate.spec.ts` -- expected: browser flow proves default roster generation when configured E2E database is available.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Roster Server-Authoritative**

- Derives, canonicalizes, fingerprints and paginates eligible default roster under Finance authorization.
  [`finance.service.ts:1283`](../../apps/api/src/modules/finance/finance.service.ts#L1283)

- Removes browser selection routes and exposes the minimum post-generation Finance read-model.
  [`finance.controller.ts:18`](../../apps/api/src/modules/finance/finance.controller.ts#L18)

**Admin Workflow**

- Keeps table-first creation dialog while removing student selection from the Draft surface.
  [`finance-workspace.tsx:285`](../../apps/web/src/finance/finance-workspace.tsx#L285)

- Preserves the existing add-after-generation command through Finance-scoped candidate pagination.
  [`finance-workspace.tsx:301`](../../apps/web/src/finance/finance-workspace.tsx#L301)

**Contract And Regression Proof**

- Reflects no-selection default roster and distinct Preview, READY and Generate interactions.
  [`invoice-generation.html:1`](../../_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html#L1)

- Proves effective roster eligibility and generation-time stale fingerprint rejection.
  [`finance.integration.test.ts:876`](../../apps/api/src/integration/finance.integration.test.ts#L876)

- Prevents UI regressions to selection request/control behavior.
  [`finance-workspace.test.tsx:66`](../../apps/web/src/finance/finance-workspace.test.tsx#L66)

- Exercises the browser flow without any legacy selection mutation.
  [`finance-release-gate.spec.ts:74`](../../apps/web/e2e/finance-release-gate.spec.ts#L74)

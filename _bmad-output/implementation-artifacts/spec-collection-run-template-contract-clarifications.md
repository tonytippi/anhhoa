---
title: 'CollectionRun template: đơn giá ngày, snapshot và thứ tự hiển thị'
type: 'feature'
created: '2026-09-24'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '93152204accfb9b65bd6f0bb91df6c34e794a468'
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-24-collection-run-template.md'
  - '_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Contract template mới còn mâu thuẫn về tiền ăn: catalog mô tả giá tháng nhưng template dùng quantity ngày và đơn giá ngày. Nhánh thêm Student sau `GENERATED` cũng chưa được chứng minh copy line từ snapshot bất biến, trong khi từ ngữ "có thứ tự/sắp xếp" có thể dẫn đến persistence và API reorder không cần thiết.

**Approach:** Chốt tiền ăn là Receivable đơn vị ngày với default unit price `35.000 VND`; template và Invoice chỉ hiển thị theo thứ tự server-deterministic amount giảm dần. Generate ban đầu và thêm Student sau `GENERATED` cùng copy immutable template snapshot của run, không đọc template hoặc catalog live.

## Boundaries & Constraints

**Always:** `School` scope, `FINANCE_MANAGE`, origin/CSRF, UUID `Idempotency-Key`, `Operation`, audit, transaction, `BIGINT`/JSON-safe VND và capability reauthorization vẫn bắt buộc. Template chỉ mutable ở `DRAFT`; `READY`, `GENERATED`, `CLOSED` từ chối mutation. Mỗi template line tham chiếu một Receivable active cùng School tối đa một lần, quantity là integer dương và amount do server tính từ catalog default unit price. Generate khóa/revalidate rồi snapshot template facts và derived InvoiceLine atomically. Sau `GENERATED`, command thêm Student chỉ dùng snapshot template đã khóa của run, cùng roster-as-of eligibility và one-Invoice-per-Student/run guard; catalog/template live thay đổi hoặc inactive không được ảnh hưởng Invoice mới thêm. API trả template line và Invoice line theo `amount DESC`, với tie-breaker server-deterministic; thứ tự không có business semantics và browser không gửi/suy diễn `position` hay reorder.

**Ask First:** Dừng hỏi người dùng nếu một Receivable không phải tiền ăn cần đơn vị/giá theo ngày, hoặc nếu thứ tự cần chuyển từ hiển thị sang ý nghĩa nghiệp vụ, kéo-thả, hoặc persisted user preference.

**Never:** Không thêm pricing từ attendance, service, leave, Class/Student scope, ChargeRule, policy, Receipt, carry, Parent/Teacher dependency hay client-calculated money. Không sửa implementation artifact historical của Story 5.3. Không tạo template position/reorder endpoint, không làm Invoice đã generate/issue đọc lại catalog/template live, không tạo Invoice/InvoiceLine partial hoặc duplicate.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tiền ăn theo ngày | Receivable tiền ăn active, unit `ngày`, default price `35.000`, template quantity `22` | Server trả amount `770.000`; template và Invoice snapshot cùng unit/price/quantity/amount | Reject quantity không nguyên/dương hoặc client price/amount/total |
| Generate populated | Run `READY`, preview hiện hành, template không rỗng | Transaction tạo mỗi eligible Student một DRAFT và tất cả InvoiceLine snapshot | Empty/stale/foreign/inactive template hoặc race rollback/replay, không partial write |
| Thêm Student muộn | Run `GENERATED`, Student eligible roster-as-of, không có Invoice | Tạo một DRAFT populated từ immutable run-template snapshot | Reject closed run, ineligible/existing Student hoặc changed idempotency fingerprint |
| Catalog đổi sau generate | Template/catalog đã đổi hoặc Receivable inactive sau lần generate đầu | Student thêm muộn vẫn copy run snapshot; Invoice cũ giữ nguyên | Không đọc source live hay rewrite snapshot |
| Thứ tự hiển thị | Các line amount khác nhau hoặc bằng nhau | API trả amount giảm dần và tie-breaker ổn định; UI render nguyên server order | Không nhận/lưu position hoặc thao tác reorder |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `CollectionRun`, `Invoice`, `InvoiceLine`, `Receivable` là schema ownership; thêm template aggregate, tenant relation/constraint và snapshot run cần cho generate và Student thêm muộn.
- `apps/api/prisma/migrations/` -- migration Finance mới phải bảo vệ same-School graph, unique template Receivable/run, positive quantity và lifecycle lock ở database; không sửa migration lịch sử.
- `apps/api/src/modules/finance/finance.service.ts` -- `selectionPreview`, `readyRun`, `generateRun`, `addGeneratedStudent`, `invoiceData`, `insertInvoices`, `invoice` và `draftInvoice` là điểm tái dùng cho fingerprint, run snapshot, bulk InvoiceLine và server ordering.
- `apps/api/src/modules/finance/finance.controller.ts` -- mutation boundary hiện hữu cho CSRF/origin/idempotency; bổ sung template DRAFT commands/read DTO hẹp, không mở surface pricing khác.
- `apps/api/src/modules/finance/collection-run-generation.worker.ts` -- worker phải mang payload template snapshot đóng băng khi stage/publish, không query template/catalog live.
- `apps/api/src/modules/finance/finance.service.test.ts`, `finance.controller.test.ts`, `apps/api/src/integration/finance.integration.test.ts` -- proof unit/controller/PostgreSQL cho daily-unit money, template lifecycle, snapshot, generated-student, tenant, retry và concurrency.
- `apps/web/src/finance/finance-workspace.tsx` -- run/template API state, preview/generate/add Student và Invoice rendering; UI chỉ hiện server values/order, không reorder hay tính money.
- `apps/web/src/finance/finance-workspace.test.tsx`, `apps/web/e2e/finance-release-gate.spec.ts` -- populated DRAFT and template flow, timeout reconciliation, School switch và no client ordering/calculation proof.
- `_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md`, `addendum.md`, `ARCHITECTURE-SPINE.md`, `SPEC.md`, `epics-passionedu.md`, UX artifacts và proposal 2026-09-24 -- canonical contract cần thay "position/reorder" bằng deterministic display order và làm rõ generated-student snapshot.
- `_bmad-output/implementation-artifacts/decision-story-5-3-generated-student-addition-2026-09-21.md` -- quyết định accepted cần superseding clarification; historical Story 5.3 spec chỉ là evidence, không sửa.

## Tasks & Acceptance

**Execution:**
- [ ] Canonical PRD/Addendum/Spine/SPEC/Epic/UX/proposal và decision follow-up -- ghi rõ daily meal unit price, non-semantic order và immutable run-template snapshot cho Student thêm sau `GENERATED` -- build input không mâu thuẫn với mockup.
- [ ] `apps/api/prisma/schema.prisma` và migration mới -- thêm CollectionRun template/snapshot graph, database guards và deterministic data source -- database ngăn cross-tenant, duplicate và mutation trái lifecycle.
- [ ] `apps/api/src/modules/finance/finance.service.ts`, `finance.controller.ts`, `collection-run-generation.worker.ts` -- persist template ở DRAFT, fingerprint/snapshot tại preview/generate, populated bulk generation và generated-student copy -- API không tin browser hoặc source live.
- [ ] API unit/controller/integration tests -- thay empty-DRAFT fixtures bằng template populated và chứng minh matrix trên, including concurrent retry -- release gate phủ invariant mới.
- [ ] `apps/web/src/finance/finance-workspace.tsx` cùng test/E2E -- hiển thị daily price/quantity/amount server-returned và server order, bỏ reorder affordance -- portal không giữ business authority.
- [ ] Mockup/admin assertions -- đồng bộ catalog tiền ăn `35.000 đ/ngày`, template `22` ngày = `770.000 đ`, wording snapshot/order và regression assertions -- UX contract khớp API contract.

**Acceptance Criteria:**
- Given Finance cấu hình `Tiền ăn` active với đơn vị ngày và default price `35.000`, when template quantity là `22`, then API và Admin chỉ hiển thị amount server-returned `770.000 VND` và generated Invoice snapshot đúng facts đó.
- Given template valid đã preview, when generate hoặc retry/concurrent generate chạy, then mỗi Student eligible có tối đa một populated DRAFT với đúng bộ line snapshot, không có line/Invoice partial hay duplicate.
- Given run `GENERATED` có immutable template snapshot, when Finance thêm Student eligible chưa có Invoice sau catalog/template live đổi hoặc Receivable inactive, then command tạo đúng một populated DRAFT từ snapshot run và không đọc data live.
- Given template hoặc Invoice có nhiều line, when API trả DTO, then line order là amount giảm dần với tie-breaker ổn định và client không có field/control để gửi position hoặc reorder.
- Given template mutation ở non-DRAFT, foreign/duplicate/inactive Receivable, empty template, stale preview, invalid quantity, cross-School ID hoặc changed idempotency reuse, when request chạy, then server từ chối trước write/leak và Operation chỉ replay request identical.

## Design Notes

Snapshot cho Student thêm sau `GENERATED` phải là state thuộc run, không phải suy luận lại từ `CollectionRunTemplateLine`: template có thể đổi trước preview, bị khóa sau `READY`, hoặc catalog có thể inactive sau generate. Để sort không biến thành rule nghiệp vụ, server dùng một tie-breaker bất biến có sẵn, ví dụ InvoiceLine/template-line UUID tăng dần, nhưng không expose nó như `position` được client điều khiển.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test` -- expected: Finance unit/controller tests pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration` từ `apps/api` -- expected: PostgreSQL template, snapshot, generated-student và concurrency proofs pass trên test database.
- `pnpm --filter @passionedu/admin-web test` -- expected: Finance workspace template/UI tests pass.
- `set -a && source .env.test && set +a && pnpm test:e2e` -- expected: Admin populated-template workflow passes.
- `pnpm test:mockups && pnpm typecheck && git diff --check` -- expected: mockup contracts, typecheck và whitespace checks pass.

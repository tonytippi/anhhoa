---
title: 'Audit và verification cho policy isolation/versioning'
type: 'feature'
created: '2026-09-18'
status: 'done'
baseline_commit: '8b360db14df9d6b86fcb0c85999c4c2448e56aff'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
warnings: []
deferred:
  - summary: >-
      Evidence, Invoice/payment-instruction và Parent projection snapshot chưa có aggregate downstream trong codebase.
    evidence: |-
      Epic 4, 5 và 7 phải chứng minh snapshot của domain mình không bị rewrite khi dùng typed server as-of policy; Story 3.4 không tạo aggregate giả để thay thế proof đó.
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Policy Settings từ Stories 3.1-3.3 đã có tenant scope, versioning và audit, nhưng release proof chưa bao phủ đầy đủ ma trận hai School, mọi typed policy, account lifecycle và stale UI. Nếu thiếu proof này, thay đổi sau có thể làm query chọn sai version hoặc lộ state School cũ.

**Approach:** Mở rộng suite PostgreSQL và Admin Settings hiện có thành release proof cho policy/account isolation, effective `asOf`, immutable history, audit và render server-confirmed state. Giữ Settings là nguồn typed policy; snapshot operational thuộc Epic 4/5/7 được defer cho aggregate thực sự sở hữu snapshot.

## Boundaries & Constraints

**Always:** Test dùng ít nhất hai School và actor/membership riêng; mọi assertion read/write/audit/Operation scope `schoolId`. Xác minh Profile, Calendar, Finance, Attendance, Handover, DailyJournal và BankAccount resolve theo `asOf` `Asia/Ho_Chi_Minh`, append-only/effective-date/composite graph vẫn được PostgreSQL bảo vệ, và UI không render response School cũ hay tự tính policy. Giữ mutation CSRF/origin, reauthorization và idempotency contract hiện hữu.

**Block If:** Cần thay đổi contract canonical để biến policy snapshot, Parent access hoặc active-account eligibility thành trách nhiệm Settings, hoặc test target PostgreSQL riêng không có để chạy integration an toàn.

**Never:** Không thêm endpoint audit, policy JSON/key-value, client policy calculation, migration/schema thay đổi chỉ để phục vụ test, hoặc aggregate giả cho attendance, finance hay Parent. Không dùng database development từ `.env` làm integration target.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Hai tenant versioned | Hai School có version trước/sau và BankAccount khác nhau | Mỗi read `asOf` chỉ chọn version effective của School đó; history/account của tenant kia không lộ | Selector/ID tenant kia bị từ chối, không tạo write/audit/Operation hoàn tất |
| Mutation bị conflict/từ chối | Effective date trùng, ID account tenant khác, replay fingerprint khác hoặc request invalid | Constraint/lifecycle/idempotency giữ state cũ; audit chỉ thuộc School/actor/membership đúng | API trả server error; UI giữ active/proposed server-confirmed và error có thể focus/đọc |
| School switch với GET trễ | School A request còn pending rồi context chuyển B | Response A không cập nhật Settings B; draft/pending state theo School được clear hoặc reconcile | Không retry mutation mù, không render stale data |

</intent-contract>

## Code Map

- `apps/api/src/integration/settings.integration.test.ts` -- suite PostgreSQL Settings hiện có tenant graph, append-only và policy fixtures; mở rộng ma trận hai School, `asOf` cho mọi policy/account, scoped audit và rejected mutation không để lại state.
- `apps/api/src/modules/settings/settings.service.ts` -- `read()`, `createProfile()`, `createCalendar()`, `createFinancePolicy()`, `createEvidencePolicy()`, `createDailyJournalPolicy()`, `createBankAccount()`, `transitionBankAccount()`, `mutate()` và `audit()` là source/pattern cần chứng minh, không đổi contract nếu proof đủ.
- `apps/api/src/modules/settings/settings.service.test.ts` -- unit proof DTO typed, resolver/version và idempotency negative đang có; bổ sung assertion hẹp nếu integration không quan sát được nhánh error tương ứng.
- `apps/api/src/modules/settings/settings.controller.test.ts` -- cookie CSRF/origin boundary của các Settings POST; giữ test từ chối trước service write.
- `apps/api/src/integration/release-gate.integration.test.ts` -- có release-level pattern cross-School selector/audit/idempotency; chỉ tái dùng fixture/assertion nếu làm rõ Settings matrix, không duplicate suite vô ích.
- `apps/web/src/settings/settings-workspace.tsx` -- `load`, `post`, `reconcile`, effect theo `schoolId`, `activeSchool` và dirty state quyết định stale-response/switch safety; REST response là state duy nhất được render.
- `apps/web/src/settings/settings-workspace.test.tsx` -- mở rộng proof active/proposed/error accessible và response School A đến trễ sau khi chuyển sang B; giữ proof không Parent toggle/client calculation.
- `apps/api/prisma/migrations/20260918000006_school_settings_versioned/migration.sql`, `20260918000007_finance_policy_bank_accounts/migration.sql`, `20260918000008_attendance_handover_daily_journal_policies/migration.sql` -- bằng chứng read-only của DB constraints/append-only, không sửa cho story verification.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chỉ chuyển 3.4 sang `done` sau toàn bộ verification và review pass.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/integration/settings.integration.test.ts` -- thêm fixture/matrix PostgreSQL hai School cho Profile, Calendar, Finance, Attendance, Handover, DailyJournal và BankAccount: `asOf` trước/sau, cross-School read/write, scoped uniqueness/composite graph/append-only, lifecycle eligibility và audit/Operation provenance -- tạo release proof tại outermost persistence surface.
- [x] `apps/api/src/modules/settings/{settings.service,settings.controller}.test.ts` -- bổ sung negative proof hẹp còn thiếu cho resolver/idempotency và CSRF/origin để mutation bị reject không chạm write/audit -- khóa HTTP/service boundary trước integration.
- [x] `apps/web/src/settings/settings-workspace.test.tsx` -- test active/proposed/error keyboard-accessible sau conflict/rejection và GET School A đến trễ sau switch sang B không render stale response -- chứng minh Admin portal chỉ hiển thị server-confirmed School state.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chuyển Story 3.4 thành `done` và cập nhật timestamp/note chỉ sau test, build và review đều pass -- đồng bộ tracker với trạng thái thật.

**Acceptance Criteria:**
- Given ít nhất hai School có policy versions, BankAccounts và `asOf` records khác nhau, when PostgreSQL integration suite read/write từng Settings aggregate, then cross-School ID/route/filter bị từ chối, resolver chỉ trả effective version trong School và rejected write không tạo policy/audit/Operation completed.
- Given version/lifecycle history được truy vấn, when suite kiểm tra Profile, Calendar, Finance, Attendance, Handover, DailyJournal và BankAccount, then effective-date, scoped unique/composite graph, append-only và active-account state được chứng minh bằng PostgreSQL cùng audit có School, actor, membership, provenance, old/new và reason đúng.
- Given Admin nhận proposed policy conflict/rejection hoặc chuyển School khi request GET trước đó còn pending, when Settings render, then active/proposed là server-confirmed, error có focus/semantic accessible và response School cũ không xuất hiện; portal không tự tính policy.
- Given policy thay đổi sau source/snapshot operational, when Epic 4/5/7 triển khai aggregate sở hữu evidence, invoice/payment instruction hoặc Parent projection, then các epic đó phải test typed server `asOf` result và immutable snapshot; Story 3.4 không tuyên bố proof cho aggregate chưa tồn tại.

## Design Notes

Release proof nằm trên PostgreSQL và Admin REST surface, không di chuyển policy evaluation sang client hay tạo API mới. `SettingsService` và migration hiện hữu là implementation source; test cần quan sát behavior của chúng thay vì mock Prisma, để composite scope, trigger append-only và effective selection thực sự được chạy.

## Review Triage Log

### 2026-09-18 - Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2 (medium 2)
- defer: 1 (medium 1)
- reject: 18
- addressed_findings:
  - `[medium] [patch]` Bổ sung read assertion riêng cho School B, temporal/lifecycle assertions cho BankAccount và xác nhận cross-School rejection không đổi state/audit/Operation của cả hai tenant.
  - `[medium] [patch]` Guard cả late successful response lẫn late failed response theo School request active; thêm Admin UI proof B vẫn render và error A không ghi đè sau School switch.

## Auto Run Result

Đã hoàn thành release proof cho Settings policy isolation/versioning: PostgreSQL matrix tạo hai School với Profile, Calendar, Finance, Attendance, Handover, DailyJournal và BankAccount riêng; chứng minh typed `asOf`, lifecycle, audit/Operation provenance và cross-School write deny. Admin Settings bỏ qua cả response lẫn lỗi đến muộn của School cũ; malformed idempotency dừng trước khi mở transaction.

Files changed:

- `apps/api/src/integration/settings.integration.test.ts` -- matrix PostgreSQL hai School, temporal policy/account, cross-tenant deny và audit proof.
- `apps/api/src/modules/settings/settings.service.test.ts` -- malformed idempotency không mở Operation/transaction.
- `apps/web/src/settings/settings-workspace.tsx` -- ignore stale School request success/error state.
- `apps/web/src/settings/settings-workspace.test.tsx` -- stale success/error response proof sau School switch.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Story 3.4 hoàn tất.

Review findings: 2 patch medium đã áp dụng, 1 defer medium cho snapshot consumer thuộc Epic 4/5/7, 18 findings bị loại vì duplicate, không đúng contract hiện hữu hoặc vượt aggregate chưa tồn tại. Follow-up review: `true` (2 medium, score 6).

Verification passed:

- `pnpm --filter @passionedu/api prisma:generate`
- `pnpm --filter @passionedu/api test` -- 13 files, 56 tests
- `pnpm --filter @passionedu/admin-web test` -- 5 files, 54 tests
- `TARGET_INTEGRATION_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/anhhoa_test" pnpm --filter @passionedu/api test:integration` -- 7 files, 63 tests
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- `git diff --check`

Residual risk: Snapshot evidence, Invoice/payment instruction và Parent projection sẽ được chứng minh bởi Epic 4, 5 và 7 tại boundary aggregate sở hữu; chưa có domain source để thực hiện proof đó trong Story 3.4.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- Prisma schema/client hợp lệ.
- `pnpm --filter @passionedu/api test` -- Settings service/controller negative proof pass.
- `pnpm --filter @passionedu/admin-web test` -- stale UI, accessible error và server-confirmed render pass.
- `TARGET_INTEGRATION_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/anhhoa_test" pnpm --filter @passionedu/api test:integration` -- chỉ dùng target test riêng; matrix PostgreSQL tenant/version/audit pass.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- toàn workspace pass.
- `git diff --check` -- không whitespace error.

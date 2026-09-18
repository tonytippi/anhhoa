---
title: 'Cấu hình evidence điểm danh và trả trẻ theo policy typed'
type: 'feature'
created: '2026-09-18'
status: 'done'
baseline_commit: '9c5b5fb4da1ba8968e769fca9cb6cd831a1795c8'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '_bmad-output/implementation-artifacts/decision-handover-photo-evidence-2026-09-14.md'
warnings: []
deferred:
  - 'Epic 4/7 must consume the typed as-of policies at attendance, handover, journal/media and Parent read/write boundaries; Story 3.3 does not create operational records, storage, media URLs or Parent projection endpoints.'
---

<intent-contract>

## Intent

**Problem:** School Admin chưa có Settings aggregate typed/versioned để công bố rule ảnh bằng chứng cho điểm danh/trả trẻ và rule retention/media của Daily Journal. Nếu dùng JSON tự do hoặc client rule, downstream attendance và Parent có thể áp dụng sai policy hoặc làm lộ evidence.

**Approach:** Mở rộng Settings theo mẫu policy version/audit/Operation của Stories 3.1-3.2: ba policy School-scoped, effective-dated và append-only; Admin chỉ cấu hình, xem active/history và reconcile REST result. Parent access tiếp tục là baseline server-enforced, không có Settings tab hoặc toggle.

## Boundaries & Constraints

**Always:** Chỉ School Admin active trong School active có `SETTINGS_MANAGE` được đọc/ghi; mọi query, unique, audit và Operation scope `schoolId`, có reauthorization trong transaction, CSRF/origin và UUID idempotency. AttendancePolicy và HandoverPolicy chỉ nhận `photoEvidenceMode=REQUIRED|OPTIONAL`. DailyJournalPolicy cố định retention Parent là 30 ngày lịch sau `StudentEnrollment.endedOn`, MIME `JPEG|PNG|WEBP`, 10 MB mỗi ảnh, không giới hạn số ảnh/journal; DTO có thể công bố các fact typed này nhưng client không sửa. Mọi version có effective date, reason, provenance audit old/new và resolver `asOf` `Asia/Ho_Chi_Minh`; PostgreSQL cấm update/delete history.

**Block If:** Canonical decision mới mâu thuẫn với decision handover evidence hoặc biến Parent authorization/retention baseline thành School-configurable mà không có supersession rõ ràng; migration không thể bảo toàn composite School graph và append-only history.

**Never:** Không dùng JSON/key-value, không thêm cutoff/grace/block/pickup authorization/late fee, không tạo attendance/handover/journal/media storage operational, không tự tạo Parent API/projection/permanent media URL, và không đưa Parent access thành tab/toggle. Không để Settings thay enforcement write/read boundary mà Epic 4/7 sở hữu.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tạo evidence version | School Admin gửi mode hợp lệ, effective date và reason | Version immutable đúng School, audit old/new và completed Operation; GET `asOf` trả version active riêng cho attendance/handover | Replay cùng fingerprint trả outcome đã lưu |
| Tạo journal policy | School Admin gửi effective date/reason | Version typed lưu fixed retention/MIME/size/no-count-limit, audit và Operation | Không nhận override client cho fixed rule |
| Input/version không hợp lệ | Mode lạ, ngày sai/trùng, thiếu reason hoặc UUID không hợp lệ | Không ghi policy/audit/Operation hoàn tất | Field error accessible, conflict date được trả rõ |
| Tenant hoặc UI stale | School khác, School đổi khi draft/Operation uncertain | Không đọc/ghi chéo; UI xóa state cũ, guard/reconcile Operation đúng School trước retry | Không retry POST trước reconciliation |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `School` và `SchoolMembership` relation, School settings version pattern `SchoolProfileVersion`/`FinancePolicy`; thêm enum/model typed evidence và DailyJournal policy, composite tenant identity.
- `apps/api/prisma/migrations/20260918000006_school_settings_versioned/migration.sql` -- reuse append-only trigger `reject_school_settings_history_mutation()`; migration mới phải áp dụng cho ba policy và preserve cleanup convention.
- `apps/api/prisma/migrations/20260918000007_finance_policy_bank_accounts/migration.sql` -- enum, CHECK và composite foreign-key mẫu cho typed Settings history.
- `apps/api/src/modules/settings/settings.service.ts` -- owner `read()` (24-30), typed DTO/validation, `createFinancePolicy()` (41-47) và `mutate()` (61-64) là mẫu resolver, audit, idempotency và transaction reauthorization.
- `apps/api/src/modules/settings/settings.controller.ts` -- cookie session, CSRF/origin mutation boundary và Settings-owned POST routes cần mở rộng.
- `apps/api/src/modules/settings/{settings.service,settings.controller}.test.ts` và `apps/api/src/integration/settings.integration.test.ts` -- regression/proof validation, as-of, audit, append-only, idempotency và tenant isolation.
- `apps/web/src/settings/settings-workspace.tsx` -- REST-only `load`, `post`, `reconcile`, dirty/switch guard và Settings surface; thêm section `Điểm danh & bàn giao` với evidence modes riêng và DailyJournal facts confirmed từ server.
- `apps/web/src/settings/settings-workspace.test.tsx` và `apps/web/src/school-context.test.tsx` -- proof form errors/focus, timeout reconciliation và stale School clearing.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/school-settings.html` -- UX evidence cards; chỉ tham chiếu contract, không phải runtime enforcement.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` và migration mới -- thêm enum/model AttendancePolicy, HandoverPolicy, DailyJournalPolicy versioned với composite School/Membership graph, effective-date unique và append-only trigger -- giữ typed temporal configuration tenant-safe.
- [x] `apps/api/src/modules/settings/{settings.service,settings.controller}.ts` -- expose read-as-of DTO và idempotent POST version routes, validate enum/fixed DailyJournal facts/reason, audit typed predecessor -- API là nguồn duy nhất của policy result.
- [x] `apps/api/src/modules/settings/*.test.ts` và `apps/api/src/integration/settings.integration.test.ts` -- chứng minh validation, as-of, fixed facts, audit, replay/conflict, append-only và cross-School deny -- khóa contract configuration trước Epic 4/7.
- [x] `apps/web/src/settings/settings-workspace.tsx` và tests -- render table/form policy `Điểm danh & bàn giao`, error accessible, confirmed-state history, switch guard và reconcile -- Admin không suy diễn enforcement, không render Parent toggle.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chỉ chuyển Story 3.3 thành `done` khi toàn bộ verification pass.

**Acceptance Criteria:**
- Given School Admin tạo AttendancePolicy hoặc HandoverPolicy version hợp lệ, when server persist, then chỉ `REQUIRED|OPTIONAL` được lưu immutable theo School/effective date cùng audit/Operation và GET as-of trả đúng policy.
- Given Admin mở Settings, when attendance/handover policy render, then UI nêu riêng yêu cầu ảnh cho `PRESENT` và `pickedUpAt`, không có JSON, cutoff, grace, block policy hay Parent access configuration.
- Given Admin tạo DailyJournalPolicy, when server persist/read, then response typed chỉ thể hiện retention 30 ngày, JPEG/PNG/WEBP, 10 MB và no-count-limit cùng effective date/reason/audit; client không thể override các value này.
- Given input malformed, effective date conflict, cross-School selector, changed idempotency fingerprint hoặc School switch/timeout, when API/UI xử lý, then không có write/leak/stale state và reconcile precedes retry.

## Design Notes

Ba policy đều là configuration append-only. `effectiveTo` được derive từ version kế tiếp, không update bản ghi cũ. Settings trả typed result để Epic 4 enforce `REQUIRED` tại write boundary và Epic 4/7 enforce journal/media/Parent retention tại boundary của chúng; policy mới không rewrite evidence, journal hoặc snapshot lịch sử.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- Prisma schema hợp lệ.
- `pnpm --filter @passionedu/api test` -- Settings unit/controller suite pass.
- `pnpm --filter @passionedu/admin-web test` -- Admin Settings UI suite pass.
- `set -a && . apps/api/.env && set +a && pnpm --filter @passionedu/api test:integration` -- PostgreSQL tenant/history proof pass khi local DB configured.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- toàn workspace pass.
- `git diff --check` -- không whitespace error.

## Review Triage Log

### 2026-09-18 - Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 8 (high 1, medium 5, low 2)
- defer: 1 (medium 1)
- reject: 7
- addressed_findings:
  - `[high] [patch]` Persist DailyJournal fixed facts trên từng policy version bằng schema/migration typed CHECK; DTO và audit đọc persisted values để policy history không đổi nghĩa khi constants tương lai thay đổi.
  - `[medium] [patch]` Thêm error association accessible cho `photoEvidenceMode` và đưa mode vào dirty switch guard.
  - `[medium] [patch]` Mở rộng proof Handover/Daily Journal submit, policy draft reset theo School, CSRF/origin routes, replay/fingerprint, append-only update/delete và DailyJournal tenant graph.
  - `[medium] [defer]` Enforcement operational `PRESENT`, `pickedUpAt`, journal/media upload-read và Parent projection vẫn thuộc boundary Epic 4/7 theo Epic 3 context; Story này chỉ cung cấp typed as-of configuration.

## Auto Run Result

Status: done

Đã triển khai Settings-owned AttendancePolicy, HandoverPolicy và DailyJournalPolicy typed/versioned: migration PostgreSQL giữ composite School/Membership graph, effective-date uniqueness, immutable history và fixed Daily Journal facts per version; API thêm typed read/POST idempotent/audit; Admin Settings thêm forms/history riêng cho PRESENT, pickedUpAt và Daily Journal, không có Parent access toggle.

Review findings: 8 patches đã áp dụng (1 high, 5 medium, 2 low), 1 rủi ro downstream được ghi nhận cho Epic 4/7, 7 finding bị loại vì không đúng scope hoặc không phải lỗi hiện tại.

Verification passed:

- `pnpm --filter @passionedu/api prisma:generate`
- `pnpm --filter @passionedu/api test` -- 13 files, 55 tests
- `pnpm --filter @passionedu/admin-web test` -- 5 files, 52 tests
- `TARGET_INTEGRATION_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/anhhoa_test" pnpm --filter @passionedu/api test:integration` -- migration `20260918000009_daily_journal_policy_fixed_facts` deployed; 7 files, 62 tests
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- `git diff --check`

Môi trường: `.env` trỏ vào database phát triển `anhhoa` có migration legacy nên không dùng cho integration. Suite integration dùng target riêng `anhhoa_test`; sau review patch, migration 00008 trước đó đã được apply nên fixed Daily Journal fields được đưa vào migration tiếp theo 00009 để cả target đã tồn tại và target mới hội tụ schema.

## Suggested Review Order

**Typed policy boundary**

- Defines immutable School-scoped histories with composite membership integrity.
  [`schema.prisma:248`](../../apps/api/prisma/schema.prisma#L248)

- Applies database uniqueness, graph foreign keys, checks, and append-only triggers.
  [`migration.sql:1`](../../apps/api/prisma/migrations/20260918000008_attendance_handover_daily_journal_policies/migration.sql#L1)

- Resolves active policies as-of and emits fixed server-owned journal facts.
  [`settings.service.ts:26`](../../apps/api/src/modules/settings/settings.service.ts#L26)

- Creates audited, idempotent evidence and journal policy versions.
  [`settings.service.ts:52`](../../apps/api/src/modules/settings/settings.service.ts#L52)

**HTTP and Admin surface**

- Preserves cookie mutation proof for each new Settings-owned route.
  [`settings.controller.ts:19`](../../apps/api/src/modules/settings/settings.controller.ts#L19)

- Separates PRESENT and pickedUpAt forms while showing immutable journal facts and history.
  [`settings-workspace.tsx:377`](../../apps/web/src/settings/settings-workspace.tsx#L377)

**Verification**

- Covers malformed modes/reasons and typed read DTO facts.
  [`settings.service.test.ts:29`](../../apps/api/src/modules/settings/settings.service.test.ts#L29)

- Proves PostgreSQL temporal, tenant, audit, and append-only invariants.
  [`settings.integration.test.ts:57`](../../apps/api/src/integration/settings.integration.test.ts#L57)

- Exercises Admin typed POST and absence of a Parent access toggle.
  [`settings-workspace.test.tsx:67`](../../apps/web/src/settings/settings-workspace.test.tsx#L67)

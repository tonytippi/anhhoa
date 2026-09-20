---
title: 'Evidence lifecycle và notification source an toàn'
type: 'feature'
created: '2026-09-20'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'e08d3b65b059879b91591138871aeafa9654f394'
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
  - '_bmad-output/implementation-artifacts/decision-handover-photo-evidence-2026-09-14.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 4.2 chỉ lưu `EvidenceReference` opaque cho attendance. Chưa có cách tạo, xem có kiểm soát, hết hạn/xóa blob, hay notification source idempotent; do đó evidence không thể dùng an toàn và Parent chưa có nguồn domain tối thiểu đáng tin cậy.

**Approach:** Mở rộng attendance domain với evidence upload/read/lifecycle School-scoped, một cleanup command có thể chạy idempotent, và source event được ghi trong cùng transaction attendance. Tạo boundary tái sử dụng để Story 4.4 nối handover event/evidence mà không triển khai handover trước scope.

## Boundaries & Constraints

**Always:** Evidence public DTO chỉ có opaque ID và availability; không bao giờ trả URL, preview locator, storage/blob data, Staff identity hay lý do nội bộ. Tất cả lookup/read/cleanup/event đều scope School từ actor server-authorized. Teacher access attendance evidence yêu cầu binding/Position active `ATTENDANCE_WRITE` và Class assignment effective của record; School Admin dùng Position active `SETTINGS_MANAGE`; Parent không có route. Evidence chỉ được gắn cho `PRESENT` sau khi upload hợp lệ cùng School và được xác nhận cùng attendance write. Cleanup dùng `Asia/Ho_Chi_Minh`, sau đúng hai tháng lịch kể từ confirmation, xóa blob/preview nhưng giữ evidence/attendance/audit metadata và trả trạng thái `EXPIRED` với text `Tệp bằng chứng đã hết hạn`. Mỗi attendance record có tối đa một notification source logical, tạo trong transaction thành công; payload whitelist chỉ có School, Student, date và attendance state, tuyệt đối không evidence/internal facts. Retry idempotent không tạo event thứ hai.

**Block If:** API không thể nhận byte media và stream response protected mà không đưa locator/public URL vào DTO, hoặc migration không thể giữ School-scoped FK/unique event source trên PostgreSQL.

**Never:** Không tạo Parent projection/delivery/cache, public/presigned URL, background queue dependency, hard-delete evidence/audit/attendance, hoặc giả lập handover model/write. Không cho Admin mutation attendance hay bypass Class assignment của Teacher. Không dùng 60 ngày thay cho hai tháng lịch.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Upload and confirm | Authorized assigned Teacher uploads supported evidence then records `PRESENT` | Opaque evidence is created, attached/confirmed with record; roster exposes ID and available state only | No URL or blob in JSON |
| Protected read | Corresponding authorized Teacher or School Admin reads same-School available evidence | API streams media after server authorization | Parent, foreign School, revoked/inactive/wrong-capability actor is denied before media access |
| Retention | Confirmed evidence reaches confirmation plus two calendar months | Cleanup deletes blob and preview once, persists deletion metadata/audit, and read model becomes expired | Retry is safe; durable fact/audit/event remain |
| Event replay | Successful attendance write repeats with same idempotency key | Exactly one logical source event exists with whitelisted payload | Changed fingerprint remains `IDEMPOTENCY_CONFLICT` without a second event |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma:640-676` -- extend opaque evidence and attendance relation; add School/Student-scoped notification source with durable uniqueness.
- `apps/api/prisma/migrations/20260920000000_attendance_records/migration.sql` -- existing composite-FK/trigger conventions; add a new forward-only migration rather than editing it.
- `apps/api/src/modules/attendance/attendance.service.ts:386-435,517-536,736-818` -- existing Teacher authorization, policy evidence validation, School lock and idempotent transaction; own upload/read/cleanup and event insert here.
- `apps/api/src/modules/attendance/attendance.controller.ts:13-25` -- retain audience, cookie origin/CSRF boundary; add teacher upload/read and app-admin read routes without Parent media route.
- `apps/api/src/modules/authorization/authorization.service.ts:4-10` -- capability catalog proves `ATTENDANCE_WRITE` and `SETTINGS_MANAGE` source; do not authorize from UI/roles.
- `apps/api/src/modules/attendance/attendance.service.test.ts` -- unit coverage for access, calendar-month cutoff, audit-safe DTO/event payload and replay.
- `apps/api/src/integration/attendance.integration.test.ts` -- PostgreSQL fixture and tenant graph proof for media/event/cleanup persistence.
- `apps/api/scripts/test-integration.ts:3-9` -- integration runner maps `TARGET_INTEGRATION_DATABASE_URL` from `apps/api/.env`; never commit environment values.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/api/prisma/schema.prisma` and a new Prisma migration -- add evidence media/deletion/confirmation metadata and `NotificationSourceEvent` with composite School integrity plus logical event uniqueness; preserve all historical records.
- [ ] `apps/api/src/modules/attendance/attendance.service.ts` -- add protected Teacher evidence upload, Staff/Admin read authorization, calendar-month retention cleanup and audit-safe projection; validate uploaded evidence before attachment and create attendance source event inside `record()` transaction.
- [ ] `apps/api/src/modules/attendance/attendance.controller.ts` -- expose only authenticated teacher upload/read and app-admin read adapters, including mutation protection for upload; do not add Parent evidence endpoint.
- [ ] `apps/api/src/modules/attendance/attendance.service.test.ts` and `apps/api/src/integration/attendance.integration.test.ts` -- prove matrix scenarios, payload whitelist, revoke/cross-School denial, no duplicate source and retained audit metadata on PostgreSQL.

**Acceptance Criteria:**
- [ ] Given valid corresponding Teacher capability/assignment or School Admin in the selected School, when reading available evidence, then the API returns media only after reauthorization; any Parent, foreign-School, revoked, inactive or non-capable actor cannot retrieve it and ordinary DTOs expose no media/internal fields.
- [ ] Given confirmed attendance evidence, when cleanup runs at confirmation plus two calendar months, then its blob/preview is removed exactly once while the evidence reference, attendance fact, deletion audit and notification source remain; authorized read models display `Tệp bằng chứng đã hết hạn`.
- [ ] Given an attendance write succeeds, when its transaction completes or is idempotently replayed, then exactly one School/Student/date source event with the allowed attendance facts exists; no event carries evidence or internal details.
- [ ] Given Story 4.4 later creates a handover record, when it calls the provided private source-event/evidence lifecycle boundary, then it can produce the same retention/access contract and an event whose only additional fact is confirmed `pickedUpAt`, without changing Parent delivery ownership.

## Design Notes

`EvidenceReference` is an opaque durable audit handle. Media bytes are implementation-private and never become a client-provided storage locator. A source event is an outbox-like durable source, not a delivery event: Epic 7 alone may project it to a currently authorized Parent.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate` -- Prisma client generates successfully.
- `pnpm --filter @passionedu/api typecheck` -- API compiles with protected media/event types.
- `pnpm --filter @passionedu/api test` -- attendance unit/controller tests pass.
- `set -a; source apps/api/.env; set +a; pnpm --filter @passionedu/api test:integration` -- migrations and PostgreSQL tenant/lifecycle proof pass using the supplied integration database configuration.
- `git diff --check` -- no whitespace errors.

## Review Triage Log

### 2026-09-20 -- Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 8 (high 4, medium 4)
- defer: 0
- reject: 10
- addressed_findings:
  - `[high]` `[patch]` Upload evidence now uses actor-scoped idempotent Operation, reconciliation and audit provenance instead of creating unreconciled duplicates.
  - `[high]` `[patch]` Evidence is atomically claimed by its authorized uploader/class/date and one attendance record; protected reads authorize against that exact record.
  - `[high]` `[patch]` Retention uses Asia/Ho_Chi_Minh calendar-month logic and writes deletion metadata plus audit atomically.
  - `[medium]` `[patch]` Raw upload parsing is POST-scoped and bounded; protected media responses use `no-store` and `nosniff`.
  - `[medium]` `[patch]` Notification sources are immutable, typed attendance sources with a School-scoped logical uniqueness guarantee.
  - `[medium]` `[patch]` Roster availability treats blobless historical references as expired and ordinary JSON keeps media/internal data absent.
  - `[medium]` `[patch]` Unit and integration coverage now exercises upload authorization, exact attachment, protected read denial, cleanup/retry/timezone boundary and event payload/replay.

## Auto Run Result

Status: done

Summary: Da implement evidence upload/read/retention lifecycle va notification source idempotent cho attendance. Upload va attendance write deu dung server-authorized School/Teacher/Class/date context; media chi stream sau re-authorization, khong co Parent route hay media locator trong DTO. Cleanup giu audit handle va xoa blob/preview sau hai thang lich Asia/Ho_Chi_Minh. Notification source immutable va chi chua School/Student/date/state.

Files changed:
- `apps/api/prisma/schema.prisma` -- lifecycle metadata, ownership/claim integrity va notification source schema.
- `apps/api/prisma/migrations/20260920000001_evidence_lifecycle_notification_source/migration.sql` -- PostgreSQL constraints/indexes forward-only.
- `apps/api/src/main.ts` -- bounded POST-only raw upload body handling.
- `apps/api/src/modules/attendance/attendance.controller.ts` -- protected upload/read/reconciliation adapters and safe media headers.
- `apps/api/src/modules/attendance/attendance.service.ts` -- authorization, atomic claim, lifecycle cleanup/audit and immutable source event behavior.
- `apps/api/src/modules/attendance/attendance.service.test.ts` -- unit lifecycle and authorization coverage.
- `apps/api/src/integration/attendance.integration.test.ts` -- PostgreSQL graph/event/retention coverage.

Review: 8 patches applied (4 high, 4 medium); 0 deferred; 10 rejected as non-actionable or outside the accepted contract. Follow-up review recommendation: true (score 12).

Verification:
- `pnpm --filter @passionedu/api prisma:generate` -- pass.
- `pnpm --filter @passionedu/api typecheck` -- pass.
- `pnpm --filter @passionedu/api test` -- pass.
- `git diff --check` -- pass.
- `set -a; source apps/api/.env; set +a; pnpm --filter @passionedu/api test:integration` -- pass after resetting the user-approved local `anhhoa_test` target: migration deploy, seed, 7 integration files and 54 tests pass.

Integration PostgreSQL target `anhhoa_test` was reset at the user's direction. `sprint-status.yaml` now records Story 4.3 as done.

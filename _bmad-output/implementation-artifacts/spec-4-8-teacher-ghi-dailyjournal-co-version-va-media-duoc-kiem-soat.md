---
title: 'Story 4.8: Teacher ghi DailyJournal có version và media được kiểm soát'
type: 'feature'
created: '2026-09-24'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: 'a49779c41c20b5303d2ecd31f3732ebc1374baed'
baseline_commit: 'a49779c41c20b5303d2ecd31f3732ebc1374baed'
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
  - '_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Teacher có `DAILY_JOURNAL_WRITE` chưa thể ghi nhận xét hằng ngày theo Student/Class được phân công. Hệ thống chưa có aggregate current journal, immutable same-day version, media riêng hay Teacher workspace, nên cũng chưa thể thực thi đúng tenant, policy và privacy boundary đã phát hành.

**Approach:** Bổ sung DailyJournal do `attendance` sở hữu, gồm current journal, immutable version và opaque media riêng; cung cấp REST/Teacher workspace mobile-first theo mockup để Teacher xem roster theo Class/ngày, upload ảnh hợp lệ và lưu server-confirmed result qua Operation reconciliation.

## Boundaries & Constraints

**Always:** Mọi read/write/media/unique/audit/Operation phải School-scoped. Mỗi request re-authorize `teacher` audience, active same-School membership binding, StaffProfile, primary Position, `DAILY_JOURNAL_WRITE`, effective StaffClassAssignment và Student enrollment/Class placement theo `journalDate`; input URL/UUID/browser không là authorization. Một current journal duy nhất `(schoolId, studentId, journalDate)`; create hoặc edit chỉ trong business day `Asia/Ho_Chi_Minh` của journal, và edit append immutable audited version. Resolve `DailyJournalPolicy` as-of date; server sniff/validate bytes JPEG/PNG/WEBP, giới hạn 10 MB/tệp, không giới hạn số ảnh. Mutation dùng CSRF/origin, UUID Idempotency-Key, actor-scoped Operation/audit, identical replay, fingerprint conflict và reconciliation. Teacher DTO/media read chỉ trả metadata tối thiểu/bytes được re-authorize, `private, no-store`/`nosniff`, không storage key hay permanent/blob URL. Giữ visible School/Class/date, current/missing status, version/update server-confirmed, accessible field/error summary, dirty/switch guard, responsive table/card behavior và không optimistic terminal state.

**Block If:** Contract bắt buộc phải thêm Parent route/projection, lifecycle deletion/retention của journal media, publish/approval state, edit ngoài business day, hoặc tái sử dụng attendance/handover evidence.

**Never:** Không thêm Admin/Parent mutation hoặc Parent read, notification delivery, Finance pricing/source, evidence sharing, unlimited raw type trust, service-worker cache hay browser authorization. Không để policy thay đổi viết lại historical version/media facts; không trả Staff identity, audit history, Class list, storage key hoặc direct URL từ future Parent shape. Cleanup lifecycle và Parent projection thuộc Story 4.9/Epic 7.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Teacher roster | Authorized Teacher, assigned Class, operating journal date | Server returns only enrolled/placed Students with `MISSING` or server-confirmed `CURRENT` journal status. | Revoked/cross-School/non-assigned actor is denied and client clears protected list/editor. |
| Create/edit journal | Valid current-day text and opaque validated media IDs with idempotency key | First save creates one current journal/version; same-day edit appends one immutable version and advances current result. Identical retry replays one Operation. | Changed fingerprint conflicts; duplicate/current collision is recovered through Operation; no optimistic row update. |
| Media upload/read | JPEG/PNG/WEBP bytes at most 10 MB and authorized Class/date context | Server stores independent journal media and returns opaque metadata; authorized Teacher can read bytes after reauthorization. | Spoofed MIME/signature, oversize, foreign/expired context, evidence ID, revoked actor or foreign School is rejected without leak/write. |
| Date/policy validation | Past/future/non-operating journal date or no effective policy/enrollment/placement | Write is allowed only on current HCM operating day with effective policy, enrollment and placement. | API returns server field/reason; draft remains for correction and no version/media binding occurs. |
| Timeout and School switch | Save/upload executes but response is uncertain, or user switches School while draft is dirty | Client retains Operation ID, reconciles before retry, refreshes only terminal server data, and prompts before discard. | Pending result does not permit duplicate submission or stale cross-School journal/media display. |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` and a forward-only migration -- add School/Class/Student/date-safe `DailyJournal`, immutable `DailyJournalVersion`, and separate `DailyJournalMedia`; do not reuse `EvidenceReference`.
- `apps/api/src/modules/attendance/attendance.service.ts` -- reuse `mutate()`, School graph validation, calendar/policy-as-of and teacher Operation reconciliation patterns; add capability-aware class-scoped journal authorization, byte-verified upload/read, roster/detail/save methods.
- `apps/api/src/modules/attendance/attendance.controller.ts` -- extend Teacher audience, CSRF/origin and no-store adapters with narrow journal routes; retain raw-body media transport without permanent URL response.
- `apps/api/src/modules/authorization/authorization.service.ts` -- `DAILY_JOURNAL_WRITE` exists in capability catalog but `navigation()` must expose a server-authorized journal destination only.
- `apps/api/src/integration/attendance.integration.test.ts` and `apps/api/src/modules/attendance/attendance.service.test.ts` -- extend two-School fixture and idempotency/policy/revocation assertions at persistence and service surfaces.
- `apps/teacher-web/src/school-context.tsx`, `attendance/attendance-workspace.tsx`, and `handover/handover-workspace.tsx` -- reuse protected context reset, dirty guard, UUID/timeout/reconciliation and focused error patterns; mount journal only from server navigation.
- `apps/teacher-web/src/daily-journal/` -- new mobile-first list/filter/editor workspace matching `mockups/teacher/teacher.html:55-64`, including accessible multi-file validation and server-confirmed list refresh.
- `apps/teacher-web/src/**/*.test.tsx` and `apps/web/e2e/release-gate.spec.ts` -- add outer UI proof for validation, timeout reconciliation, revoke/switch clearing and responsive/accessibility contract.

## Tasks & Acceptance

**Execution:**
- `apps/api/prisma/schema.prisma` and new migration -- persist tenant-safe current/version/media graph, immutable version/history and scoped current uniqueness -- makes server facts enforceable in PostgreSQL.
- `apps/api/src/modules/attendance/{attendance.service,attendance.controller}.ts` and `authorization/authorization.service.ts` -- implement class-scoped Teacher journal roster/detail/upload/read/save and Operation reconciliation/navigation -- keeps authorization, policy, bytes validation and state transitions API-owned.
- `apps/api/src/modules/attendance/attendance.service.test.ts` and `apps/api/src/integration/attendance.integration.test.ts` -- cover every matrix row including actual byte signatures, isolation, revocation, same-key replay/fingerprint conflict, current uniqueness, version immutability and no evidence/Parent route reuse -- proves the owning surfaces.
- `apps/teacher-web/src/daily-journal/*`, `school-context.tsx`, and related tests -- render mockup-conformant list/filter/editor, local pre-validation, upload/save/reconcile, focused errors and switch-safe clearing -- provides a REST-only Teacher flow.
- `apps/web/e2e/release-gate.spec.ts` -- prove browser validation, server error focus, uncertain Operation reconciliation and no stale School data for DailyJournal -- verifies terminal user behavior.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- mark 4.8 `done` only after all implementation/review verification passes -- keeps tracker truthful.

**Acceptance Criteria:**
- Given an authorized Teacher opens an assigned Class on the current HCM operating day, when loading DailyJournal, then the API and workspace expose only server-authorized enrolled Students with visible School/Class/date and server-confirmed missing/current/update state.
- Given the Teacher saves valid text and zero or more independently uploaded valid journal images, when the save succeeds or is replayed, then exactly one School/Student/date current journal advances through immutable version(s), audit/Operation is persisted once per idempotent request, and no evidence or permanent URL is reused/exposed.
- Given a spoofed, invalid, oversized, cross-School, revoked, non-assigned, non-operating, non-current-day or policy-ineligible request, when it reaches any upload/read/save route, then it is denied before unauthorized data is returned or journal/version/media state changes.
- Given save/upload response times out or a School switch/revocation occurs, when the Teacher portal resolves the state, then it reconciles the retained Operation before retry, focuses server errors, preserves/clears draft only through the switch guard, and never renders stale protected data or an optimistic terminal result.

## Design Notes

Journal media is a provisional, opaque School/Class/Student/date record until atomically attached by save. The journal owns its own byte/blob data and policy snapshot so future retention cleanup can operate without inheriting evidence semantics. The current journal stores the active version pointer/read projection; append-only versions preserve text and attached media membership for same-day audit.

## Auto Run Result

Status: done

Summary: Triển khai DailyJournal Teacher-only trong `attendance`: current journal School/Student/date, immutable same-day version, media độc lập và byte-verified, REST reauthorization/Operation reconciliation, navigation server-authorized và workspace mobile-first theo mockup. Parent projection và media lifecycle cleanup vẫn được defer đúng Story 4.9/Epic 7.

Files changed:
- `apps/api/prisma/schema.prisma` và migrations DailyJournal -- graph current/version/media tenant-safe, policy snapshot, attachment control và history append-only.
- `apps/api/src/modules/attendance/` -- Teacher roster/upload/read/save, policy/graph authorization, idempotency, audit và media response headers.
- `apps/teacher-web/src/daily-journal/` và `school-context.tsx` -- list/filter/editor, server-confirmed current state, media preservation, validation focus, dirty/switch guard và timeout reconciliation.
- `apps/api/src/integration/attendance.integration.test.ts`, attendance tests và `apps/web/e2e/release-gate.spec.ts` -- PostgreSQL, controller, portal và browser proof cho controlled media/version matrix.
- `apps/api/scripts/seed-e2e-release-gate.ts` và existing release tests -- DailyJournal fixture và resilient selectors cho coexisting Teacher surfaces.
- `apps/api/src/modules/roster/roster.service.ts` và integration test -- safe pagination offset validation and a corrected out-of-range test expectation discovered while running the release gate.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- records Story 4.8 completion.

Review findings: applied 14 patch findings (high 0, medium 10, low 4); deferred 0; rejected 6 coverage/style findings that were either already covered or outside this Story's explicit Parent/lifecycle boundary. Follow-up review is recommended: patch score 34.

Verification performed:
- `set -a && source .env.test && set +a && pnpm test:release-gate` -- pass: 113 PostgreSQL integration tests; 81 Admin, 14 Teacher, 4 Parent, and 6 Ops unit tests; 8 browser E2E tests.
- `pnpm typecheck` -- pass for all 7 workspace packages.
- `git diff --check` -- pass.

Residual risk: release runs emit the pre-existing `pg` concurrent-query deprecation warning, and Vite reports a pre-existing Admin bundle-size warning. Neither changes DailyJournal behavior; both remain separate maintenance work.

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 14 (high 0, medium 10, low 4)
- defer: 0
- reject: 6 (high 0, medium 0, low 6)
- addressed_findings:
  - `[medium]` `[patch]` Added upload Operation class/date outcome and reconciliation authorization.
  - `[medium]` `[patch]` Enforced policy MIME, size and count facts, including server byte validation.
  - `[medium]` `[patch]` Preserved current-version media during edits and restricted provisional media to its uploader.
  - `[medium]` `[patch]` Added policy snapshot, attachment control, concurrent-create conflict handling and strict append-only history guard.
  - `[medium]` `[patch]` Re-authorized media reads against current Student/Class facts and added controller/integration proof.
  - `[medium]` `[patch]` Reset protected workspace state on Class/date changes and rendered explicit server context, empty state and responsive table wrapper.
  - `[low]` `[patch]` Completed release fixture fixed policy facts and guarded cleanup for immutable test history.
  - `[low]` `[patch]` Scoped legacy E2E locators to their owning Admin, attendance and handover surfaces after DailyJournal added similarly named controls.

## Verification

**Commands:**
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test` -- expected: attendance unit and API suites pass with test database configuration.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL tenant/idempotency/media/version matrix passes.
- `pnpm --filter @passionedu/teacher-web test` -- expected: DailyJournal workspace, reconciliation, switch and accessibility tests pass.
- `set -a && source .env.test && set +a && pnpm test:release-gate` -- expected: configured cross-portal release proof passes.
- `pnpm typecheck && git diff --check` -- expected: workspace typecheck and whitespace checks pass.

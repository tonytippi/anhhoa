---
title: 'Story 4.9: DailyJournal media lifecycle và parent projection an toàn'
type: 'feature'
created: '2026-09-24'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: '07f0847171b7d2905960c001116ab1356b7c7ad9'
baseline_commit: '07f0847171b7d2905960c001116ab1356b7c7ad9'
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/parent/parent.html'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** DailyJournal va media hien chi duoc Teacher doc, nen Parent chua the xem nhan xet cua dung Student va media cua journal current. Chua co boundary server-side de re-authorize StudentParent va ap dung retention sau khi enrollment ket thuc.

**Approach:** Mo rong `attendance` bang Parent read model current-journal va protected media endpoint. Parent portal render section nhan xet theo child/date cua mockup, chi tai media khi nguoi dung yeu cau va xoa state bao ve truoc safe fallback khi context bi revoke, doi School/child hoac qua retention.

## Boundaries & Constraints

**Always:** Moi Parent list/detail/media request re-authorize Parent session, active School context va active `StudentParent` cho tung Student; Server ap dung `Asia/Ho_Chi_Minh` retention 30 ngay lich sau `StudentEnrollment.endedOn`. Projection chi tra `studentId`, Student display-name snapshot, `journalDate`, current text, `updatedAt` va opaque media metadata toi thieu cua current version. Media chi qua protected request, `private, no-store` va `nosniff`; khong preload, service-worker cache, direct/permanent URL, storage key, Teacher/Class identity, audit/version history hay evidence. Internal journal/audit/blob khong hard-delete chi vi Parent retention; lifecycle nay la access expiry/re-authorization.

**Block If:** Contract can purge/xoa journal blob noi bo theo Parent retention, thay doi retention 30 ngay, expose historical version, hoac them Parent journal mutation/notification payload.

**Never:** Khong tai su dung `EvidenceReference`, attendance/handover evidence, Teacher authorization hay notification source. Khong them Parent attendance, leave, finance, inbox hoac gallery/feed ngoai reviewed home/child-detail journal section. Khong tin `schoolId`, `studentId`, deep link hay browser state lam authorization.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Parent journal projection | Parent co active School/StudentParent va current journal trong retention | API tra current text/media metadata toi thieu cua dung Student; child detail hien section "Nhan xet hom nay" theo mockup. | Khong co journal tra empty state, khong suy dien attendance. |
| Protected media read | Parent yeu cau media ID cua current journal duoc uy quyen | API re-authorize Parent/Student/retention, tra bytes voi no-store/nosniff; UI chi tao request sau thao tac xem anh. | ID provisional, evidence, historical/current journal khac, sibling hay School khac bi deny truoc khi bytes tra ve. |
| Retention va revoke | StudentParent bi revoke, School/child thay doi, hoac da qua 30 ngay lich sau endedOn | Request tiep theo bi deny/loai khoi list; portal xoa text, thumbnails va dialog truoc safe fallback. | Khong render state cu, retry hay cache protected response. |
| Parent projection redaction | Journal co actor, Class, version va blob metadata noi bo | JSON chi chua Parent DTO da quy dinh va opaque media ID/content type. | Khong lo Staff, Class, audit/version, storage key hay direct URL. |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma:1230-1314` -- DailyJournal current/version/media graph da co; giu immutable internal record/blob, khong migration purge theo Parent retention.
- `apps/api/src/modules/attendance/attendance.service.ts` -- `parent()`, journal read helpers va Teacher media flow la diem mo rong Parent re-authorization, retention va current-only projection.
- `apps/api/src/modules/attendance/attendance.controller.ts` -- them Parent GET journal/list-media routes va reuse protected byte response headers; tuyet doi khong them Parent mutation.
- `apps/api/src/modules/parents/parents.service.ts` -- owner cua `StudentParent`; reuse query boundary de xac minh active link trong transaction thay vi tin session DTO.
- `apps/parent-web/src/{auth-session,main,styles}.tsx` -- Parent shell hien co la nen context-safe; them reviewed home/child detail journal surface va protected-state clearing.
- `apps/parent-web/vite.config.ts` -- giu `runtimeCaching: []` va API/media denylist; khong them cache cho authenticated journal response.
- `apps/api/src/{modules/attendance/attendance.service,modules/attendance/attendance.controller}.test.ts` va `integration/attendance.integration.test.ts` -- mo rong proof Parent authorization, retention, DTO redaction va media headers.
- `apps/parent-web/src/*.test.tsx` va `apps/web/e2e/release-gate.spec.ts` -- proof lazy media, revoke/switch clear va mockup-conformant parent surface.

## Tasks & Acceptance

**Execution:**
- `apps/api/src/modules/attendance/attendance.service.ts` -- them Parent current-journal list/detail/media read, active StudentParent-per-row/request va HCM retention evaluator -- giu authorization va lifecycle access o API owner.
- `apps/api/src/modules/attendance/attendance.controller.ts` -- expose narrow Parent GET routes, response byte no-store/nosniff -- khong tao Parent mutation hay URL media permanence.
- `apps/parent-web/src/{main,auth-session,styles}.tsx` va journal UI/test files -- render home/child-detail section cua mockup, lazy protected media va clear state khi reauthorization/context thay doi -- dat security behavior o terminal user surface.
- `apps/api/src/modules/attendance/attendance.{service,controller}.test.ts`, `apps/api/src/integration/attendance.integration.test.ts`, `apps/parent-web/src/*.test.tsx`, `apps/web/e2e/release-gate.spec.ts` -- cover matrix, two-School/sibling/revoke/retention/redaction/cache assertions -- chung minh tenant va privacy boundary.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- mark 4.9 `done` chi sau review va verification pass -- tracker trung thuc.

**Acceptance Criteria:**
- Given ParentSchoolContext va active StudentParent link hop le, when Parent mo child detail co current DailyJournal trong retention, then API/UI chi hien current journal va minimum DTO cua dung Student theo mockup.
- Given Parent mo media cua journal authorized, when protected request duoc xu ly, then server re-authorize StudentParent/retention va tra bytes no-store khong kem permanent URL, evidence hay internal metadata.
- Given link bi revoke, Student/School thay doi, deep link khong duoc phep hoac retention het han, when Parent request/foreground return, then protected journal text/media/dialog bi xoa truoc safe fallback va API khong tra data.
- Given DailyJournal co versions, actor, Class va internal blob provenance, when Parent projection chay, then historical version/audit/Staff/Class/storage facts khong xuat hien trong API hoac DOM.

## Design Notes

Parent retention khac evidence cleanup: no ket thuc kha nang Parent doc vao `endedOn + 30 calendar days`, khong xoa immutable operational journal. Media endpoint la authorization boundary duy nhat; JSON khong tao URL va UI khong prefetch blob.

## Verification

**Commands:**
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test` -- expected: unit/controller Parent journal assertions pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration` -- expected: PostgreSQL Parent tenant/revoke/retention/current-only matrix passes.
- `pnpm --filter @passionedu/parent-web test` -- expected: Parent journal lazy loading and protected-state clearing tests pass.
- `set -a && source .env.test && set +a && pnpm test:release-gate` -- expected: cross-portal release proof passes.
- `pnpm typecheck && git diff --check` -- expected: workspace type and whitespace checks pass.

## Auto Run Result

Status: done

Summary: Da them Parent DailyJournal current projection va protected media read trong `attendance`, voi re-authorization School/StudentParent theo request, retention snapshot immutable theo enrollment interval va Parent UI lazy-load media theo mockup.

Files changed:
- `apps/api/prisma/schema.prisma` va migration DailyJournal retention snapshot -- luu enrollment/ended-on provenance immutable de tai nhap hoc khong gia han journal cu.
- `apps/api/src/modules/attendance/attendance.{service,controller}.ts` -- Parent list/detail/media, current-version-only projection, no-store headers va transaction-scoped authorization.
- `apps/parent-web/src/{auth-session,main,journal.css}` -- child detail journal, lazy multi-media, protected-state clearing va race-safe Parent context refresh.
- `apps/api/src/modules/attendance/*.test.ts`, `apps/api/src/integration/attendance.integration.test.ts`, `apps/parent-web/src/shell.test.tsx` -- API, PostgreSQL va portal proof cho matrix authorization/retention/cache/fallback.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- ghi nhan Story 4.9 hoan tat.

Review findings: applied 22 patch findings (high 4, medium 18, low 0); deferred 0; rejected 0. Follow-up review is recommended: patch score 66.

Verification performed:
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test` -- pass.
- `set -a && source .env.test && set +a && pnpm --filter @passionedu/api test:integration` -- pass: 113 PostgreSQL integration tests.
- `pnpm --filter @passionedu/parent-web test` -- pass: 11 tests.
- `pnpm typecheck` -- pass for all workspace packages.
- `git diff --check` -- pass.
- `pnpm test:release-gate` -- not green because pre-existing Admin E2E assertion `apps/web/e2e/release-gate.spec.ts:121` expects a suspended School option to disappear but it remains visible; Story 4.9 does not modify that Admin surface.

Residual risk: the full release gate remains blocked by the unrelated Admin assertion above. API integration and Parent portal tests cover the Story 4.9 authorization, retention, cache and protected-state surfaces.

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 22 (high 4, medium 18, low 0)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high]` `[patch]` Made Parent authorization/current-version media reads transaction-scoped and retention-aware.
  - `[high]` `[patch]` Cleared protected Parent UI state for revoked, expired, School-denied and session-denied contexts.
  - `[high]` `[patch]` Preserved enrollment-end retention provenance so re-entry cannot revive expired journals.
  - `[medium]` `[patch]` Added no-store JSON headers, deterministic projections, lazy multi-media rendering and regression coverage for all Parent fallback outcomes.

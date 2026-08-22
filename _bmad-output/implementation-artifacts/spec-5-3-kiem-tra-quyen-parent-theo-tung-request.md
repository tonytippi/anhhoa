---
title: 'Story 5.3: Kiem tra quyen Parent theo tung request'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_revision: '80885a94dcf2e2ba7acbab5227218102e1dea50c'
baseline_commit: '80885a94dcf2e2ba7acbab5227218102e1dea50c'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Parent-Student links retained da ton tai, nhung chua co dependency server-side de Parent surface tuong lai kiem tra quyen cua Parent cho tung Hoc sinh hoac Hoa don truoc khi doc du lieu.

**Approach:** Mo rong `ParentsService` bang cac authorization primitive dung trang thai live trong PostgreSQL cho student va invoice context, va chung minh revoke co hieu luc ngay bang integration tests.

## Boundaries & Constraints

**Always:** Moi lan kiem tra phai yeu cau Parent `ACTIVE` va `StudentParent ACTIVE`; `studentId`, `invoiceId`, URL va filter chi la input dinh vi tai nguyen, khong la bang chung quyen; invoice phai duoc rang buoc server-side voi Student co link active; tu choi xay ra truoc khi consumer query/tao Parent DTO; failure khong phan biet Parent inactive, link khong ton tai/revoked, invoice khong thuoc con duoc uy quyen; revoke mot link phai chan request ke tiep cho Hoc sinh do ma khong anh huong link active khac.

**Block If:** Schema hien tai khong the bieu dien Parent active, StudentParent active va quan he Invoice-Student trong mot authorization query ma khong query/serialize du lieu Parent truoc do.

**Never:** Them Parent OAuth, session/HTTP guard, endpoint Parent, Parent read DTO, `apps/parent-web`, payment/QR, migration, hay dung lai Admin `StudentsService`/`InvoicesService` cho Parent authorization.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Student authorized | Parent ACTIVE va link ACTIVE dung student | Authorization resolve thanh cong | Khong co loi |
| Student denied | Parent INACTIVE, link thieu, hoac link REVOKED | Authorization bi tu choi truoc consumer query/DTO | Mot failure dong nhat |
| Invoice authorized | Invoice thuoc Student co link ACTIVE cua Parent ACTIVE | Authorization resolve thanh cong | Khong co loi |
| Invoice denied | Invoice thuoc Student khac hoac UUID khong ton tai | Authorization bi tu choi, khong lo su ton tai tai nguyen | Mot failure dong nhat |
| Revoke live | Mot Parent co link ACTIVE voi A va B, A bi revoke | Request sau revoke cho A bi tu choi; B van duoc phep | Khong cache quyen |

</intent-contract>

## Code Map

- `apps/api/src/modules/parents/parents.service.ts` -- service lifecycle retained hien co; them authorization primitive public va private query chung, khong them HTTP surface.
- `apps/api/src/modules/parents/parents.module.ts` -- da export `ParentsService`, la dependency hep cho Parent surfaces Epic 6; khong can controller/module moi neu service giu export hien tai.
- `apps/api/prisma/schema.prisma` -- `Parent.status`, `StudentParent.status`/unique relation va `Invoice.studentId` da du cho live authorization; read-only, khong can migration.
- `apps/api/src/modules/parents/parents.integration.test.ts` -- PostgreSQL fixture va lifecycle grant/revoke; them contract authorization va revoke immediate.
- `apps/api/src/modules/invoices/invoices.service.ts` va `apps/api/src/modules/students/students.service.ts` -- Admin-only read paths; khong duoc goi truoc hoac trong Parent authorization.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- cap nhat Story 5.3 `done` sau verification va review dat.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/modules/parents/parents.service.ts` -- them authorization cho Student va Invoice bang query Prisma rang buoc Parent ACTIVE, link ACTIVE va ownership invoice -- tao dependency server-side khong tin client input.
- [x] `apps/api/src/modules/parents/parents.integration.test.ts` -- kiem thu allow/deny, Parent inactive, revoked/missing link, invoice ownership, nhieu Parent/nhieu Hoc sinh va revoke immediate -- bao ve contract PostgreSQL live state.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chuyen Story 5.3 sang `done` khi toan bo verification/review dat -- dong bo tracker.

**Acceptance Criteria:**
- Given Parent ACTIVE co `StudentParent ACTIVE`, when Parent surface goi authorization cho Hoc sinh do, then dependency cho phep truoc khi consumer query hoac dung Parent DTO.
- Given Parent inactive, link revoked/thieu, hoac invoice khong thuoc Hoc sinh duoc uy quyen, when authorization chay, then dependency tu choi theo mot failure dong nhat va khong lo resource state.
- Given Parent co cac link ACTIVE voi nhieu Hoc sinh, when Admin revoke mot link, then authorization request tiep theo cho link bi revoke bi tu choi va link active khac van duoc phep.
- Given PostgreSQL integration suite chay, when authorization context Student va Invoice duoc kiem thu, then no chung minh rang buoc server-side khong tin studentId/invoiceId do client cung cap.

## Spec Change Log

## Review Triage Log

### 2026-08-22 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2 (medium 2)
- defer: 0
- reject: 13
- addressed_findings:
  - `[medium] [patch]` Kiem thu va bao ve ca Parent inactive va link REVOKED tren authorization Invoice de ngan regression predicate rieng cua duong Invoice.
  - `[medium] [patch]` Tra ve failure authorization dong nhat cho UUID khong hop le, tranh lo duong loi Prisma khac voi tai nguyen khong duoc phep.

## Design Notes

Authorization primitive chi truy van bang chung quyen va tra context toi thieu; Parent HTTP surface Epic 6 phai goi no truoc query/read DTO. Dieu nay giu Admin service va Parent surface tach biet, dong thoi revoke co hieu luc o lan request sau.

## Auto Run Result

- Summary: Da them authorization dependency dung live PostgreSQL state cho Parent theo Student va Invoice context; khong mo Parent HTTP surface, OAuth hay PWA.
- Files changed:
  - `apps/api/src/modules/parents/parents.service.ts` -- them `authorizeStudent` va `authorizeInvoice`, yeu cau Parent/link active, kiem tra invoice ownership server-side va tra denial dong nhat.
  - `apps/api/src/modules/parents/parents.integration.test.ts` -- them PostgreSQL tests cho allow/deny, ownership Invoice, Parent inactive, link revoked va revoke immediate.
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` -- danh dau Story 5.3 `done`.
  - `_bmad-output/implementation-artifacts/spec-5-3-kiem-tra-quyen-parent-theo-tung-request.md` -- implementation spec, review triage va ket qua run.
- Review findings: 2 medium patches da ap dung; 0 deferred; 13 rejected vi thuoc Parent read contract Epic 6, yeu cau endpoint chua ton tai, hoac la hardening khong can thiet cho dependency hien tai.
- Follow-up review recommendation: false (patched high: 0; patched medium: 2; patched low: 0; score: 6).
- Verification: `pnpm --filter api test:integration` pass (8 files, 47 tests); `pnpm --filter api build` pass; `git diff --check` pass.
- Residual risks: Parent request handler/read DTO chua ton tai trong Epic 5; Epic 6 phai goi authorization dependency nay truoc khi query hoac serialize du lieu Parent.

## Verification

**Commands:**
- `pnpm --filter api test:integration` -- expected: Parents PostgreSQL contract va cac integration suite pass.
- `pnpm --filter api build` -- expected: Nest API compile/typecheck thanh cong.
- `git diff --check` -- expected: khong co whitespace error.

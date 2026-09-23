---
title: 'Quan hệ người thân và menu danh bộ'
type: 'feature'
created: '2026-09-23'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'bb68caef505453001fd464b7846c5a0f534b3766'
context:
  - 'AGENTS.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/roster.html'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/student-parent-links.html'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Danh bộ hiện chỉ trả một parent summary, nên người vận hành không thể thấy nhanh Mẹ và Bố của học sinh. Liên kết `StudentParent` cũng không lưu quan hệ, và action trực tiếp trong bảng không phù hợp bảng vận hành dày dữ liệu.

**Approach:** Lưu `relationshipLabel` linh hoạt, bắt buộc trên từng `StudentParent`; ưu tiên projection server-side cho nhãn chính xác `Mẹ` và `Bố` trong hai cột roster. Các quan hệ khác chỉ quản lý trong hồ sơ tập trung. Thay action cuối dòng bằng menu `…` mở các thao tác hợp lệ.

## Boundaries & Constraints

**Always:** `relationshipLabel` là text ngắn bắt buộc, trimmed và validated server-side; không suy diễn từ tên, giới tính hoặc browser state. Nhãn thuộc `StudentParent`, không thuộc `ParentProfile`, không ảnh hưởng Parent authorization/access. API list chỉ trả mother/father name và count người thân khác, không email/phone. Chỉ active links có label chính xác `Mẹ`/`Bố` được chiếu vào hai cột; duplicate chọn ổn định theo createdAt/id. Form chi tiết hiển thị và tạo được mọi nhãn như Mẹ, Bố, Ông, Bà, Dì, Người giám hộ. Mutation giữ School scope, CSRF, idempotency, Operation/audit; label nằm trong request fingerprint/audit. Migration dùng default kỹ thuật `Người thân` để PostgreSQL thêm cột NOT NULL; dữ liệu hiện tại chỉ là seed nên không cần phân loại/backfill nghiệp vụ. Giữ table responsive horizontal scroll, caption, keyboard focus và dialog behavior.

**Ask First:** Dừng nếu cần thêm action destructive `Khóa`/`Xóa`, endpoint đổi relationship label riêng, quyền authorization theo quan hệ, hoặc UX khác ngoài columns Mẹ/Bố và menu cuối dòng đã chốt.

**Never:** Không enum/cứng hóa danh sách quan hệ đầy đủ; không dùng label làm bằng chứng authorization; không lộ phone/email trong roster list; không N+1 parent requests; không sửa mockup final đã duyệt mà không có decision artifact đi kèm.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create link | Tạo parent link với `relationshipLabel: Mẹ` | Persist label và list hiển thị tên ở cột Mẹ | Blank/quá dài trả field error |
| Flexible relation | Nhãn `Bà ngoại` hoặc `Người giám hộ` active | Không hiển thị Mẹ/Bố; tăng count người thân khác; hiện trong hồ sơ | Không suy diễn nhãn ưu tiên |
| Multiple priority links | Hai link active nhãn Mẹ | Chọn một tên ổn định và biểu thị có thêm link nếu cần | Detail hiển thị đầy đủ |
| Revoked link | Mẹ/Bố bị revoke | Không xuất hiện trong list projection | Retain history trong detail/audit |
| Action menu | Mở menu `…` cuối dòng | Keyboard reachable, chứa Xem hồ sơ và quản lý link; không hiện action destructive | Focus/menu đóng an toàn |
| Legacy database | Bảng StudentParent đã có rows | Migration áp default kỹ thuật để cột NOT NULL được áp dụng | Không phân loại dữ liệu cũ |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` -- `StudentParent` là đúng aggregate để chứa `relationshipLabel`.
- `apps/api/prisma/migrations/20260917000002_parent_profile_student_parent/migration.sql` -- read-only precedent cho migration SQL timestamped; tạo migration mới, không sửa lịch sử.
- `apps/api/src/modules/parents/parents.service.ts` -- validate, DTO, fingerprint, create/reactivate và audit parent link.
- `apps/api/src/modules/roster/roster.service.ts` -- paged list projection hiện chỉ trả `parentSummary`; thay bằng minimal mother/father/other-relative projection.
- `apps/api/src/modules/roster/roster.controller.ts` -- routes parent hiện đủ, chỉ forward body mới.
- `apps/api/src/integration/roster.integration.test.ts` -- prove migration-backed relation labels, scoped projection, retention and privacy.
- `apps/api/src/modules/roster/roster.controller.test.ts` -- parent mutation boundary/body forwarding.
- `apps/web/src/roster/roster-workspace.tsx` -- row DTO, detail form, Mẹ/Bố columns and final action menu.
- `apps/web/src/roster/roster-workspace.test.tsx` -- row/menu/detail regressions without parent list hydration.
- `apps/web/src/index.css` -- compact menu/popover and widened responsive table styles.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/roster.html` -- read-only prior roster layout; new decision intentionally supersedes parent summary column.

## Tasks & Acceptance

**Execution:**
- [x] `schema.prisma` and new `apps/api/prisma/migrations/*/migration.sql` -- add required relationship label with safe schema rollout.
- [x] Parents and roster API services/controllers/contracts/tests -- persist, audit and project minimum flexible relationship data under School scope.
- [x] Admin roster workspace/CSS/tests -- replace parent summary column with Mẹ/Bố, add compact final action menu and relationship-labelled focused management.
- [x] UX decision artifact -- record that the approved roster table now prioritizes Mẹ/Bố and action menu because user explicitly approved this replacement.

**Acceptance Criteria:**
- Given a parent link created with `Mẹ`, `Bố` or another valid label, when roster page loads, then only active exact Mẹ/Bố labels populate their columns and other labels remain in focused detail.
- Given a paged roster response, when it renders, then it has no phone/email and makes no per-row parent detail request.
- Given a row action menu, when keyboard users open, navigate or dismiss it, then focus remains predictable and opening the profile preserves current detail safeguards.
- Given invalid relationship input or a replay with a changed label, when API handles the mutation, then validation/idempotency/audit semantics remain server-authoritative.
- Given the schema migrates from current disposable seed data, when migration applies, then `StudentParent.relationshipLabel` is NOT NULL without manual data classification.

## Design Notes

Roster headers become `STT | Mã | Học sinh | Lớp | Mẹ | Bố | Trạng thái | Tùy chọn`. The final action menu contains `Xem hồ sơ` and `Quản lý liên kết người thân`; lifecycle and placement remain in the focused profile. `Khóa`/`Xóa` are excluded because their lifecycle/audit contracts do not exist.

## Verification

**Commands:**
- `set -a && source ".env.test" && set +a && pnpm --filter @passionedu/api test:integration -- roster.integration.test.ts` -- expected: relation migration/projection/isolation tests pass.
- `pnpm --filter @passionedu/api test -- roster.controller.test.ts` -- expected: mutation boundary/body forwarding tests pass.
- `pnpm --filter @passionedu/admin-web test -- roster-workspace.test.tsx` -- expected: Mẹ/Bố/menu/detail tests pass.
- `pnpm --filter @passionedu/admin-web typecheck && pnpm --filter @passionedu/api typecheck` -- expected: TypeScript passes.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Relationship Domain**

- Adds link-scoped flexible relationship labels with a safe non-null schema migration.
  [`schema.prisma:552`](../../apps/api/prisma/schema.prisma#L552)

- Validates, persists, fingerprints, and audits relationship labels without changing authorization.
  [`parents.service.ts:33`](../../apps/api/src/modules/parents/parents.service.ts#L33)

**Roster Read Model**

- Projects only active Mẹ/Bố names plus additional-relative count for each paged row.
  [`roster.service.ts:319`](../../apps/api/src/modules/roster/roster.service.ts#L319)

- Keeps the shared public roster row contract aligned with the server response.
  [`index.ts:24`](../../packages/contracts/src/index.ts#L24)

**Roster Operations**

- Implements the eight-column roster, lazy detail management, and final action menu.
  [`roster-workspace.tsx:2255`](../../apps/web/src/roster/roster-workspace.tsx#L2255)

- Implements keyboard navigation, focus return, and stale-menu cleanup for row actions.
  [`roster-workspace.tsx:1254`](../../apps/web/src/roster/roster-workspace.tsx#L1254)

**Verification**

- Proves privacy, duplicate priority links, revocation, label validation, and School scope.
  [`roster.integration.test.ts:115`](../../apps/api/src/integration/roster.integration.test.ts#L115)

- Covers Mẹ/Bố rows, relationship payloads, detail reset, and menu keyboard behavior.
  [`roster-workspace.test.tsx:23`](../../apps/web/src/roster/roster-workspace.test.tsx#L23)

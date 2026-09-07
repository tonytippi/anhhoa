<!-- bmad:context -->
<!-- Verified 2026-09-07 against efe83c6. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## PassionEdu

Nền tảng vận hành đa trường cho mầm non, thay thế clean-break cho Ánh Hoa single-school; Ánh Hoa chỉ là tenant đầu tiên. Dự án dùng BMad để quản lý planning và implementation artifacts. Implementation target là pnpm/Turborepo với NestJS/Prisma/PostgreSQL API và ba React/Vite portal độc lập cho Admin/Staff, Parent và Ops.

## Policy

- Không đưa secret vào repository; chỉ dùng `.env` cục bộ và giữ `.env.example` không có giá trị thật.
- Không sửa artifact `final` để đổi yêu cầu; cập nhật qua workflow/decision artifact phù hợp trước.
- Bắt đầu implementation từ workspace clean-break theo `ARCHITECTURE-SPINE.md`; không tái sử dụng schema, API, session, lifecycle hoặc execution artifact Ánh Hoa.
- `School` là tenant root; mọi query, mutation, unique constraint, audit và Operation phải scope theo School. Không tin `schoolId`, UUID, filter, header hay browser state làm bằng chứng authorization.

## Where things are

- Canonical product contract: `_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md` và `addendum.md`
- Architecture invariants: `_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md`
- Build contract: `_bmad-output/specs/spec-passionedu/SPEC.md`
- Backlog: `_bmad-output/planning-artifacts/epics-passionedu.md`
- UX contracts: `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/`
- Active implementation tracker: `_bmad-output/implementation-artifacts/sprint-status.yaml`; không resume spec/context Ánh Hoa từ Git history.
- Tài liệu review/discovery có nhãn `Historical only` không phải build input hoặc readiness gate.

## Conventions that differ from defaults

- API là nguồn duy nhất cho authorization, policy, VND integer calculation, state transition, snapshot, audit và Operation; ba portal chỉ gọi REST.
- Tiền VND dùng PostgreSQL `BIGINT` và JSON-safe integer; không dùng float hoặc client-calculated total.
- Finance normal settlement là exact: không có `PARTIALLY_PAID`, partial, unallocated hoặc mixed-Student Receipt. Receipt/Prepayment target phải cùng Student, School và SchoolYear.
- Cookie mutations cần origin validation, double-submit CSRF; mutation high-impact cần UUID `Idempotency-Key` và `GET /operations/:operationId` reconciliation trước retry.
- Parent API chỉ trả minimum DTO; không service-worker cache Parent authenticated responses, payment instruction, media hoặc evidence URL.

## Known pitfalls

- `PlatformOperatorGrant` là ngoại lệ duy nhất cho School-scoped Operation: provisioning dùng PlatformOperator-scoped Operation trước khi School tồn tại.
- Sau timeout của mutation idempotent, giữ Operation ID và đối soát trước retry; không coi timeout là thất bại.
- `StudentPromotionalCoverage` chỉ issued sau source Invoice được settle; refund dùng snapshot calendar/service interval và không vượt paid source còn lại.
<!-- /bmad:context -->

---
title: 'Khac phuc 500 khi tao chinh sach uu dai'
type: 'bugfix'
created: '2026-09-28'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '7232a60049f53a986f6894a5d227c008f09c4a36'
context:
  - 'AGENTS.md'
  - '_bmad-output/implementation-artifacts/decision-prepaid-coverage-draft-invoice-application-2026-09-28.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** POST tao policy uu dai trong Admin tra `500 INTERNAL_SERVER_ERROR` voi policy `PREPAID_COVERAGE` hop le. Payload da duoc service chap nhan, khoan thu thuoc School va dang ACTIVE; API hien che mat moi loi Prisma khong duoc chuyen thanh `HttpException`, nen nguoi dung khong biet co the sua gi hay co can doi soat Operation khong.

**Approach:** Tai hien request qua API dang chay de lay exception goc, sua duy nhat duong loi da duoc chung minh va tra ve ma nghiep vu 4xx. Ghi log cau truc, an toan cho exception 500 tai global filter de co stack va request context khi dieu tra; bao ve them truong hop unique `[schoolId, name]` cua policy de viec tao trung ten khong roi thanh 500, va them test service/integration cho policy `PREPAID_COVERAGE` ba thang.

## Boundaries & Constraints

**Always:** Giua nguyen School scope, authorization trong transaction, Origin/CSRF, UUID idempotency va Operation reconciliation. `PREPAID_COVERAGE` phai co `prepaidTermMonths` nguyen duong; DTO tien va discount van server-authoritative. Chi doi cac exception da xac nhan thanh HTTP 4xx co `code` va thong diep tieng Viet; khong expose loi Prisma/database. Moi exception khong phai `HttpException` phai ghi console log cau truc, co `event`, `code`, HTTP method, path khong query string, `x-request-id` neu co, va stack/message an toan.

**Ask First:** Neu tai hien cho thay loi do database schema, migration, session, hoac contract frontend khac voi code hien tai, dung sua code va bao lai loi goc cung buoc khac phuc van hanh.

**Never:** Khong bo qua unique constraint, khong retry mutation tu dong sau timeout, khong sua schema/migration, khong doi quy tac promotion/stacking/coverage hay payload contract chi de che loi 500. Khong log request object, headers day du, Cookie, Authorization, CSRF token, Idempotency-Key, X-Operation-Id, body, query string hay raw exception object. Khong dung database phat trien cho test integration.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tao policy nộp trước hợp lệ | Policy moi, receivable ACTIVE cung School, `PREPAID_COVERAGE`, term `3` | Tao DRAFT version va Operation `COMPLETED`, DTO tra term `3` | N/A |
| Trung ten policy | Policy moi co `name` da ton tai trong cung School | Khong tao version/target/audit dang do | `409 PROMOTION_POLICY_NAME_EXISTS` co thong diep tieng Viet |
| Loi ha tang xac nhan | Prisma/database failure khac validation/conflict | Khong thay doi nghiep vu hoac retry tu dong | Van dung loi 500 da an toan va ghi nhan loi server de dieu tra |
| Exception khong xu ly | Error khong phai `HttpException`, co headers nhay cam | Client van nhan response 500 chung | Console log allowlist co stack, method/path va `x-request-id` neu co; khong co secret hay body |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/finance/finance.controller.ts:60` -- HTTP entrypoint, ap dung cookie mutation protection va chuyen request vao service.
- `apps/api/src/modules/finance/finance.service.ts:1053-1080` -- parse/validate payload, lock School/promotion graph, tao policy/version/targets va audit; day la diem xu ly conflict trung ten.
- `apps/api/src/modules/finance/finance.service.ts:2774-2882` -- idempotent transaction wrapper; dang map `P2002` chi cho collision cua Operation ID.
- `apps/api/prisma/schema.prisma:1486-1525` -- `PromotionPolicy` unique theo `[schoolId, name]`; version co `prepaidTermMonths` nullable.
- `apps/api/prisma/migrations/20260928000000_prepaid_coverage_policy_term_and_draft_flow/migration.sql:1-2` -- migration them cot term; da duoc `prisma migrate status` xac nhan up-to-date tren database local.
- `apps/api/src/integration/finance.integration.test.ts:220-250,434-464` -- helper va invariant test co san cho policy nộp trước va tao policy scope/active target.
- `apps/api/src/common/api-error.filter.ts:3-14` -- moi exception khong phai `HttpException` bi an thanh `500 INTERNAL_SERVER_ERROR`.
- `apps/api/src/main.ts:18-47` -- khoi tao Nest mac dinh va dang ky `ApiErrorFilter` global; hien chua co logger/request-id middleware rieng.
- `apps/api/src/main.test.ts:1-19` -- test HTTP bootstrap phu hop de xac nhan filter global log exception an toan.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/common/api-error.filter.ts` -- Dung Nest `Logger` ghi record allowlist cho exception khong phai `HttpException`: `event`, error code, method, pathname khong query, `x-request-id` neu la string va stack/message; giu nguyen 500 client-safe -- phuc vu dieu tra ma khong ro ri credential hay payload.
- [x] `apps/api/src/main.test.ts` hoac `apps/api/src/common/api-error.filter.test.ts` -- Gia lap exception non-HTTP co request ID va sentinel trong Cookie, Authorization, CSRF, idempotency key va body; assert 500 response/log context/stack va absence cua moi secret -- khoa security contract cua logging.
- [x] `apps/api/src/modules/finance/finance.service.ts` -- Tai hien exception bang request dang nhap hoac test co lap; map unique conflict cua `PromotionPolicy` thanh `ConflictException` chi khi metadata Prisma xac nhan constraint `[schoolId, name]`, giu xu ly collision Operation hien co -- tranh 500 sai va khong nuot cac loi database khac.
- [x] `apps/api/src/modules/finance/finance.service.test.ts` hoac `apps/api/src/integration/finance.integration.test.ts` -- Them test tao moi `PREPAID_COVERAGE` voi term 3 va test trung ten trong cung School tra conflict code; xac nhan rollback khong tao version/target do dang -- khoa regression.
- [ ] `apps/api` runtime local -- Sau build/restart cua watcher, gui lai request Admin voi Idempotency-Key/X-Operation-Id moi; doi soat GET Operation neu mutation timeout -- xac nhan ket qua end-to-end voi database dang phuc vu.

**Acceptance Criteria:**
- Given mot exception khong phai `HttpException`, when global filter xu ly request, then console co record `unhandled_exception` voi stack, method, pathname va `x-request-id` neu co, trong khi client van chi nhan `500 INTERNAL_SERVER_ERROR` an toan.
- Given request co Cookie, Authorization, CSRF token, Idempotency-Key, X-Operation-Id, query va JSON body, when exception 500 duoc log, then khong secret, query string hay raw payload nao xuat hien trong log.
- Given receivable `ca7c271a-8f7e-4b1d-b482-fd6e8844e388` ACTIVE thuoc School `1b691d53-2010-4542-b3a8-ca1f9ce6c405`, when Finance tao policy `PREPAID_COVERAGE` term 3 voi ten chua ton tai, then API hoan tat Operation va tra DRAFT version co `prepaidTermMonths: 3` thay vi 500.
- Given mot policy cung School da co cung ten, when Finance POST tao policy moi voi ten do, then API tra HTTP 409 va `PROMOTION_POLICY_NAME_EXISTS`, khong co version/target/audit moi duoc luu.
- Given `P2002` la collision cua `Operation` hoac loi Prisma khac, when mutation fail, then xu ly idempotency hien co va bao mat loi 500 khong bi thay doi ngoai pham vi unique policy name.

## Design Notes

Trong database local, cot `PromotionPolicyVersion.prepaidTermMonths` ton tai va migration da applied. Query da xac nhan ten `Ưu đãi 3 tháng` chua ton tai, target thuoc dung School va hai lifecycle dang `ACTIVE`; vi vay khong duoc ket luan thieu migration chi dua tren payload. `ApiErrorFilter` la diem duy nhat can them logging: khong can them request-id middleware; neu caller gui `x-request-id`, filter chi doc header nay qua allowlist. Can co trace cua process API dang chay de phan biet loi runtime/connection voi conflict du lieu.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api lint` -- expected: TypeScript khong loi.
- `pnpm --filter @passionedu/api test -- main.test.ts` -- expected: global error filter log exception 500 co context allowlist va khong log sentinel secret.
- `pnpm --filter @passionedu/api test -- finance.service.test.ts` -- expected: unit test finance lien quan pass.
- `pnpm --filter @passionedu/api test:integration` -- expected: chi chay sau khi `.env.test` tro toi PostgreSQL test rong; bao phu prepaid creation va duplicate conflict.
- `git diff --check` -- expected: khong co whitespace error.

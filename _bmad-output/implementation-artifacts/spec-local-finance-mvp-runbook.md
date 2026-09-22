---
title: 'Runbook local cho Finance Admin MVP'
type: 'chore'
created: '2026-09-22'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'd5ed9b69f1f1af94fc83f016c17a70f5f873037f'
context:
  - 'README.md'
  - 'apps/api/.env.example'
  - 'apps/api/src/modules/auth/auth.config.ts'
  - 'apps/api/src/modules/ops/ops.service.ts'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Huong dan local hien tai bao nguoi dung mo Ops o `http://localhost:5176` de provision School, nhung khong noi rang Ops la mot Vite app rieng can khoi dong. README con mo ta Vite proxy `/api` khong ton tai, nen lenh chay Admin local theo README khong ket noi dung den API.

**Approach:** Tao mot runbook rieng cho Release 1 Finance Admin MVP va lien ket no tu README. Runbook chi ra topology toi thieu, cau hinh OAuth/API bat buoc, cac lenh khoi dong dung, luong Ops bootstrap sang Admin va cac gioi han release de nguoi dung co the test local khong can Teacher hay Parent app.

## Boundaries & Constraints

**Always:** Tai lieu phai phan biet ro app can cau hinh voi app can chay: API van validate ca bon audience, nhung manual Finance MVP chi can PostgreSQL, API `3000`, Admin `5173` va Ops `5176`. Admin/Ops local phai dung `VITE_API_URL=http://localhost:3000`; khong duoc tuyet doi hoa `pnpm dev` la topology toi thieu. OAuth callback App/Ops, `SUPERADMIN_EMAIL`, session secret va secret ngoai Git phai duoc ghi ro. Provision School phai qua Ops bang `SUPERADMIN_EMAIL`; initial School Admin phai la email khac va dang nhap qua Admin.

**Ask First:** Hoi truoc khi thay doi endpoint, CORS/auth behavior, seed data, OAuth implementation, hoac them script khoi dong moi.

**Never:** Khong ghi secret, URL database that hay thong tin Google OAuth vao repository. Khong huong dan chay Teacher/Parent nhu release requirement, dung production/pilot Compose cho manual local test, hoac tuyen bo Release 1 co Receipt, settlement, refund, Parent/Teacher behavior. Khong sua artifact `final` de doi requirement.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Minimal startup | `.env` hop le, PostgreSQL san sang | Runbook khoi dong API, Ops va Admin o dung port; portal goi truc tiep API local | Neu port/config/OAuth thieu, runbook noi ro process nao khong the chay va cach kiem tra |
| Bootstrap | Database moi, user Ops la `SUPERADMIN_EMAIL` | Ops provision School va email owner khac; owner dang nhap Admin de setup Finance | Khong huong dan dung School seed nhu thay the authorization bootstrap |
| Deferred app | Teacher/Parent server khong chay | Finance Admin MVP van test duoc sau khi API validate du cau hinh audience | Ghi ro day la app khong can chay, khong phai config co the bo qua |

</frozen-after-approval>

## Code Map

- `README.md:3-12,42,48-60` -- huong dan workspace/local hien tai; thay mo ta proxy sai bang lien ket runbook va tom tat topology toi thieu.
- `docs/local-finance-admin-mvp.md` -- tai lieu moi, chua prerequisites, `.env`, migration, khoi dong process, bootstrap, happy path va automated checks.
- `apps/api/.env.example:2-37` -- danh sach configuration audience va port local lam nguon cho runbook; chi tham chieu, khong sua secret/template khi chi can tai lieu.
- `apps/web/vite.config.ts:6-10` va `apps/ops-web/vite.config.ts:1-4` -- ca hai portal doc `VITE_API_URL`, khong khai bao Vite proxy; bang chung cho lenh direct API.
- `apps/api/src/modules/auth/auth.config.ts:27-56` -- API fail-fast validate cau hinh cac audience va `SUPERADMIN_EMAIL`.
- `apps/api/prisma/seed.ts:4-21` -- seed chi tao School mau, khong thay the Ops provision hay Finance fixture.
- `apps/api/src/modules/ops/ops.service.ts:30-48` -- provisioning can Platform Operator va email initial owner khac actor.
- `package.json:9-18` -- root scripts, bao gom `pnpm dev`, `test:e2e` va `test:release-gate`; runbook phan biet full workspace dev voi topology toi thieu.

## Tasks & Acceptance

**Execution:**
- [x] `docs/local-finance-admin-mvp.md` -- viet runbook Release 1 tu dau den cuoi: tool/database, local `.env` contract, OAuth callback, migrate, ba terminal API/Ops/Admin, bootstrap tenant, Admin setup va Invoice issue -- thay the suy doan ve app/process can chay.
- [x] `README.md` -- sua claim Vite proxy thanh direct local API, link toi runbook va tom tat chinh xac process can chay/khong can chay -- dua nguoi dung den huong dan dung ngay tu trang dau.
- [x] `README.md` -- gioi han ro `prisma:seed` chi tao School mau, khong tao owner/capability hay Finance data -- tranh bootstrap test sai.

**Acceptance Criteria:**
- Given nguoi dung muon test Release 1 tren database local moi, when ho doc README va runbook, then ho biet chay PostgreSQL, API `3000`, Ops `5176` va Admin `5173`, voi exact commands `VITE_API_URL=http://localhost:3000`; Teacher/Parent duoc ghi ro khong can chay.
- Given API validates all audience configuration, when nguoi dung cau hinh local, then runbook yeu cau khai bao day du audience env nhung chi dang ky/chay App va Ops OAuth cho happy path Finance MVP.
- Given tenant chua ton tai, when nguoi dung theo bootstrap sequence, then runbook huong dan dang nhap Ops bang `SUPERADMIN_EMAIL`, provision School cho owner email khac, roi dang nhap Admin va tao SchoolYear, Class, Student enrollment, FinancePolicy, BankAccount, Receivable, CollectionRun va issued Invoice.
- Given nguoi dung tuong tac voi manual Finance MVP, when ho doc phan scope, then tai lieu neu dung rang Receipt, settlement, refund, ledger report, Teacher va Parent khong thuoc release test nay.
- Given README duoc cap nhat, when nguoi dung xem local setup, then khong con claim rang Vite proxy `/api` ton tai hoac seed la shortcut du de provision Finance test.

## Design Notes

Dat runbook duoi `docs/` thay vi lam README qua dai. README giu vai tro entry point va chi ghi topology toi thieu; runbook la nguon thao tac chi tiet. Cac lenh khoi dong tach terminal de nguoi dung khong nghi API tu dong start Ops/Admin, va de tranh `pnpm dev` chay them Teacher/Parent khong can thiet.

## Verification

**Commands:**
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: Admin docs-linked command/name khong can thay doi code va workspace van typecheck.
- `pnpm --filter @passionedu/ops-web typecheck` -- expected: Ops workspace van typecheck.
- `git diff --check` -- expected: markdown changes khong co whitespace error.

**Manual checks:**
- Doi chieu moi lenh, port va bien moi truong trong runbook voi `package.json`, Vite config va `.env.example`.
- Xac nhan README link den runbook va khong huong dan mo `5176` truoc khi khoi dong `ops-web`.

## Suggested Review Order

**Runbook thao tac**

- Xac nhan topology toi thieu va phan biet app can cau hinh voi app can chay.
  [`local-finance-admin-mvp.md:7`](../../docs/local-finance-admin-mvp.md#L7)

- Doi chieu cau hinh OAuth va ba terminal khoi dong dung direct API local.
  [`local-finance-admin-mvp.md:35`](../../docs/local-finance-admin-mvp.md#L35)

- Theo luong Ops provision sang Admin setup va phat hanh hoa don.
  [`local-finance-admin-mvp.md:123`](../../docs/local-finance-admin-mvp.md#L123)

**Diem vao README**

- Xac nhan README loai bo proxy khong ton tai va dan den runbook dung.
  [`README.md:12`](../../README.md#L12)

- Xac nhan gioi han cua development seed, tranh dung sai lam bootstrap Finance.
  [`README.md:64`](../../README.md#L64)

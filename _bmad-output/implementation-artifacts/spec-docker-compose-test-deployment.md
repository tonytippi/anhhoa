---
title: 'Docker Compose deploy thu nghiem'
type: 'feature'
created: '2026-08-20'
status: 'done'
review_loop_iteration: 0
baseline_commit: '92bf77be47e8c79ceedbf4cffcf7a9ce82efcd2f'
context:
  - 'AGENTS.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-anhhoa-2026-08-18/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Repository chua co cach dong goi va chay dong bo web, API va PostgreSQL cho moi truong test. Nguoi van hanh can nap secret va URL public tu mot file `.env.production`, sau do de Cloudflare Tunnel chi dinh tu may chu vao mot dich vu HTTP noi bo.

**Approach:** Them topology Docker Compose toi thieu gom PostgreSQL persistent, API NestJS va web gateway. Web gateway phuc vu PWA, rewrite SPA route, va proxy `/api` den API de browser dung mot public origin; cac bien runtime nap tu `.env.production`, con `VITE_API_URL` duoc build thanh `/api`.

## Boundaries & Constraints

**Always:** Dung PostgreSQL 16 persistent volume; khong dong goi secret vao image hay commit `.env.production`; API dung committed Prisma migrations truoc khi phuc vu; web va API phai cung public HTTPS origin de cookie `Secure` va SameSite=Lax hoat dong; Compose test hien co khong bi thay doi; giu phan tach web/API/Prisma theo architecture spine.

**Ask First:** Khong tu dong them Cloudflare Tunnel container, TLS termination, backup, monitoring, seed du lieu, hay cong khai port PostgreSQL. Cloudflare Tunnel va domain/OAuth redirect do nguoi van hanh cau hinh ben ngoai Compose.

**Never:** Khong dung `prisma db push`; khong expose database ra host; khong ghi gia tri that vao file mau; khong dung Docker image co `.env.production`; khong dua API URL public vao bundle frontend khi `/api` cung origin da du.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Khoi dong lan dau | `.env.production` hop le, volume DB rong | PostgreSQL khoe manh, migrations duoc ap dung, API va web gateway chay | API chi duoc khoi dong sau khi migrate thanh cong |
| Khoi dong lai | Volume DB da co schema moi nhat | `prisma migrate deploy` an toan va dich vu khoi dong lai | Loi migration lam API khong chay, tranh phuc vu schema cu |
| Thieu bien bat buoc | `.env.production` thieu OAuth, JWT, admin hoac DB credential | Compose/API fail-fast, khong phuc vu cau hinh khong an toan | Huong dan liet ke cac bien can thiet va lenh kiem tra cau hinh |
| Tunnel vao web | Cloudflare Tunnel tro den cong web noi bo | `/` phuc vu PWA, SPA route tra `index.html`, `/api/*` proxy den API | Gateway tra loi upstream khi API chua san sang, khong redirect sang origin khac |

</frozen-after-approval>

## Code Map

- `package.json:4-10` -- pnpm workspace dung Turbo; image build can goi filter package thay vi gia dinh app doc lap.
- `pnpm-workspace.yaml:1-7` -- workspace chi gom `apps/*` va cho phep Prisma/esbuild build scripts.
- `apps/api/package.json:7-15` -- API build/start va Prisma generate/migrate deploy scripts de image va migration job tai su dung.
- `apps/api/src/main.ts:11-27` -- API nap `apps/api/.env` nhung gia tri environment cua container uu tien; listen `PORT` va CORS theo cau hinh.
- `apps/api/src/common/config/auth-config.ts:19-109` -- bat buoc `DATABASE_URL`, OAuth, `JWT_SECRET`, `ADMIN_EMAILS`; rang buoc `WEB_ORIGIN` va callback cung schemeful site.
- `apps/web/src/app/api/client.ts:15-20` -- `VITE_API_URL` la build-time, se dat `/api` de gateway cung-origin proxy request.
- `apps/web/vite.config.ts:6-16` -- PWA build, chua co server runtime hay SPA fallback.
- `apps/api/prisma/schema.prisma:1-7` va `apps/api/prisma/migrations/` -- PostgreSQL datasource va migrations committed de deploy.
- `docker-compose.test.yml:1-16` -- chi la database test tmpfs, phai giu nguyen va khong tai su dung cho deploy.
- `.gitignore:5-9` -- `.env.*` dang duoc bo qua, phu hop de giu `.env.production` local.
- `README.md:24,30-42` -- tai lieu cau hinh OAuth/API va canh bao SPA rewrite can mo rong bang huong dan deploy.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/Dockerfile` -- tao image multi-stage workspace, generate Prisma client, build NestJS va chay binary production -- de API co artifact lap lai va khong can source bind mount.
- [x] `apps/web/Dockerfile` -- build Vite voi `VITE_API_URL=/api`, sau do phuc vu artifact bang Nginx -- de frontend cung-origin va khong phu thuoc runtime Vite.
- [x] `apps/web/nginx.conf` -- them SPA fallback va proxy `/api/` den service API -- de Cloudflare Tunnel chi can tro mot dich vu va credentials giu cung origin.
- [x] `compose.yaml` -- dinh nghia `postgres`, migration one-shot, `api`, `web`, healthcheck, volume persistent va chi expose web qua host port cau hinh -- de khoi dong theo dung thu tu va database khong public.
- [x] `.dockerignore` -- loai secret, node_modules, output, test artifact va planning artifact khoi Docker context -- de image build sach va khong ro ri file local.
- [x] `.env.production.example` -- cung cap ten bien Compose/PostgreSQL va cac bien API bat buoc, khong co gia tri that -- de nguoi van hanh tao `.env.production` an toan.
- [x] `README.md` -- bo sung lenh tao `.env.production`, build/chay Compose, migrate lifecycle, Tunnel target va cau hinh OAuth URL -- de deployment test co the thuc hien khong can doc source.

**Acceptance Criteria:**
- Given mot `.env.production` hop le, when chay `docker compose --env-file .env.production up --build -d`, then web gateway, API va PostgreSQL khoi dong va API chi bat dau sau migration thanh cong.
- Given Cloudflare Tunnel chuyen HTTPS public traffic vao web gateway, when nguoi dung truy cap bat ky SPA route hoac goi `/api/auth/csrf`, then SPA duoc fallback dung va API duoc proxy cung origin.
- Given image da build, when kiem tra image filesystem va Git status, then khong co `.env.production` hay secret duoc dua vao image hoac repository.
- Given database container dang chay, when kiem tra public port mapping, then PostgreSQL khong co host port mapping va du lieu nam tren named volume.

## Design Notes

Mot web gateway la bien gioi public duy nhat. `VITE_API_URL=/api` la gia tri co the co dinh trong image vi endpoint public luon relative voi web origin, khac voi URL OAuth/API server phai la runtime environment cua API.

`migrate` la service one-shot, `api` phu thuoc vao ket qua thanh cong cua no. Nginx co the khoi dong song song API, nhung healthcheck cung voi Compose dependency se ngan API duoc phuc vu truoc schema hop le.

## Verification

**Commands:**
- `docker compose --env-file .env.production config` -- expected: cau hinh resolve thanh cong ma khong in secret vao repository.
- `docker compose --env-file .env.production build` -- expected: web va API images build thanh cong.
- `docker compose --env-file .env.production up -d` -- expected: `migrate` ket thuc thanh cong, cac service con lai healthy/chay.
- `pnpm typecheck` -- expected: TypeScript workspace van hop le.

## Suggested Review Order

**Topology va du lieu**

- Dinh nghia dich vu, migration gate va chi bind gateway vao loopback.
  [`compose.yaml:1`](../../compose.yaml#L1)

- Dong goi API, Prisma config va migrations trong runtime image.
  [`Dockerfile:1`](../../apps/api/Dockerfile#L1)

**Bien gioi HTTP cung-origin**

- Phuc vu PWA, fallback SPA va proxy `/api` qua mot public origin.
  [`nginx.conf:1`](../../apps/web/nginx.conf#L1)

- Build frontend voi API relative path thay vi public API URL.
  [`Dockerfile:1`](../../apps/web/Dockerfile#L1)

**Van hanh va bao mat**

- Loai secret va cac artifact local khoi Docker build context.
  [`.dockerignore:1`](../../.dockerignore#L1)

- Cung cap danh sach bien runtime ma khong co gia tri secret.
  [`.env.production.example:1`](../../.env.production.example#L1)

- Huong dan khoi tao, Tunnel, OAuth va lifecycle du lieu.
  [`README.md:44`](../../README.md#L44)

**Khoi dong API**

- Export JwtModule de global session guard co the resolve JwtService luc bootstrap.
  [`auth.module.ts:12`](../../apps/api/src/modules/auth/auth.module.ts#L12)

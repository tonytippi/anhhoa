---
title: 'Story 1.2: Đăng nhập Google và cô lập session theo audience'
type: 'feature'
created: '2026-09-16'
status: 'done'
review_loop_iteration: 1
baseline_commit: '6942dd5d0e6894574821d46f39957d9dd6b7e1e1'
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Target substrate chua co Google identity, OAuth state hay session boundary, nen session cua Admin/Staff, Teacher, Parent va Ops co nguy co dung cheo audience. Parent active-link authorization khong the lam dung o Story 1.2 vi target schema chua co Student, ParentProfile va StudentParent.

**Approach:** Phat hanh Google OAuth va canonical UserIdentity cho bon audience, session/cookie host-only theo audience, endpoint session/logout va client safe-state clearing. Parent callback luon tu choi session cho den khi Story 2.3 phat hanh ParentProfile va StudentParent active-link authorization; Story 2.3 se bo sung chooser/direct context va doi soat atomic truoc issue.

## Boundaries & Constraints

**Always:** API la authority cho OAuth state, verified Google subject, UserIdentity binding va audience authorization. Moi audience co start/callback allowlist, state single-use co expiry, cookie name rieng `Secure`, `httpOnly`, `SameSite=Lax`, host-only khong `Domain`, va session payload co `aud` rieng. Tu choi sai audience truoc protected data; khong luu bearer/session token trong browser. Bootstrap, 401, expiry/revoke va logout xoa protected memory/query state truoc safe view. Parent PWA giu `runtimeCaching: []` va khong cache authenticated API, payment, media hay evidence.

**Ask First:** Dung neu can ho tro Google client/redirect scheme khac config allowlist, luu session server-side thay vi signed token, hoac mo rong Parent schema/StudentParent truoc Story 2.3.

**Never:** Khong implement School provision, PlatformOperatorGrant authorization, membership/capability, school chooser hay bat ky Parent authorization dua tren `schoolId` client. Khong cap Parent session, tao ParentProfile, Student hay StudentParent trong Story nay; khong dung wildcard callback/origin, cookie `.passionedu.org`, cross-audience fallback hay compatibility auth legacy.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| OAuth callback | State hop le va Google email verified | Tao/bind UserIdentity theo immutable Google subject, issue cookie dung audience, redirect allowlisted | State reuse/het han, callback/redirect khong allowlist, email khong verified hay subject-email mismatch bi tu choi, khong issue cookie |
| Audience protected request | Cookie cua dung/sai audience | Dung audience tra session identity; sai audience bi tu choi truoc data | Tra 401 envelope va khong leak identity/protected response |
| Parent callback | Google identity hop le, chua co Story 2.3 link authority | Khong cap Parent cookie hay context | Tra denied safe redirect; ghi ro contract cho Story 2.3 thay vi tin input browser |
| Client authorization transition | Startup unauthenticated, 401, expiry/revoke hay logout | Huy protected request/cache/state truoc signed-out view | Logout van clear local state khi server da 401; khong retry 401 nhu network error |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma:51-60` -- mo rong `UserIdentity` voi unique Google subject va them OAuth transaction scoped audience, hash browser correlation va expiry de consume state atomically; khong them Parent/Student aggregate.
- `apps/api/prisma/migrations/20260916000000_target_multi_school_baseline/migration.sql` -- baseline da committed; tao migration follow-up duy nhat cho Google subject/index.
- `apps/api/src/main.ts:9-26` -- bootstrap hien chi parse PORT; them config fail-fast, cookie parsing va CORS origin allowlist theo audience.
- `apps/api/src/app.module.ts:1-5` -- dang chi co HealthModule; dang ky identity/auth session module va Prisma owner.
- `apps/api/src/modules/health/health.controller.test.ts:10-18` -- mau HTTP Nest test bang `createApi()` va native fetch de bo sung auth/session tests.
- `apps/api/.env.example:6-28` -- thay config App/Parent dang do bang config day du cho app, teacher, parent, ops; chi placeholder, khong secret.
- `packages/contracts/src/index.ts:1-6` -- pure API envelope; bo sung DTO/validator cho audience session va error code, khong chua auth policy.
- `apps/{web,teacher-web,parent-web,ops-web}/src/main.tsx` -- bon shell static la diem gan audience REST client, session bootstrap va signed-out safe state.
- `apps/{web,teacher-web,parent-web,ops-web}/vite.config.ts` -- `__API_URL__` da inject; Parent `runtimeCaching: []` la read-only security baseline can regression-test.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma`, migration follow-up va Prisma owner -- persist verified Google subject unique tren UserIdentity va OAuth transaction expire/consume atomically; giu Parent roster models cho Story 2.3.
- [x] `apps/api/src/modules/identity/`, `apps/api/src/modules/auth/`, `apps/api/src/app.module.ts`, `apps/api/src/main.ts` -- tao config-driven OAuth authorization-code exchange, OIDC id-token issuer/audience/nonce verification, browser-bound correlation cookie va durable one-time state, audience session guard, `GET session` va logout. Validate origin/callback/redirect, secret va positive integer TTL fail-fast; issue host-only cookie va CSRF double-submit cookie theo audience.
- [x] `apps/api/.env.example`, `packages/contracts/src/index.ts` -- cong bo config placeholder va REST DTO/error contract typed cho bon audience, khong leak secret/token.
- [x] `apps/api/src/modules/auth/**/*.test.ts`, integration tests -- cover authorization-code exchange/verified id-token, nonce/correlation/state expiry-reuse/retry semantics, callback allowlists, flags cookie, CSRF-protected logout, valid signed cookie cross-audience 401 va concurrent durable identity bind; Parent callback phai denied cho den Story 2.3.
- [x] `apps/web/src/`, `apps/teacher-web/src/`, `apps/parent-web/src/`, `apps/ops-web/src/` va test tuong ung -- them cookie REST bootstrap/logout, CSRF header/cookie handling, login entry point va mot cancel-safe clear-state path cho startup denial/401/expiry/revoke; khong render protected shell truoc bootstrap.
- [x] `apps/parent-web/vite.config.ts` va regression test -- giu explicit no-runtime-cache policy va cac exclusion authenticated API/payment/media/evidence.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- append scope Parent active-link recheck, direct context va authorized School chooser cho Story 2.3 theo quyet dinh human.

**Acceptance Criteria:**
- Given Google identity verified bat dau flow tu app, teacher hoac ops, when callback hop le, then UserIdentity canonical duoc tao/bind va chi cookie/session dung audience flow duoc issue.
- Given cookie/session app, teacher, parent hoac ops, when gui den protected endpoint audience khac, then API tra 401 truoc bat ky protected data nao va cookie khong co Domain attribute.
- Given Parent callback hop le truoc khi Story 2.3 phat hanh active StudentParent authorization, when callback hoan tat, then Parent session/context bi tu choi va khong co schoolId tu browser nao duoc dung de thay the link check.
- Given portal khoi dong hoac nhan 401, expiry, revoke hay logout, when authorization state doi, then protected in-memory/query state duoc xoa truoc signed-out safe state.
- Given Parent PWA build, when service worker duoc inspect, then khong co runtime cache route cho authenticated API response, payment instruction, media hay evidence URL.

## Design Notes

Parent audience van co endpoint namespace/session guard de cross-audience rejection la dong nhat, nhung khong co successful Parent issuance trong Story 1.2. Day la fail-closed contract co chu dich, tranh tao lien ket Parent-School khong FK; Story 2.3 phai thay denied branch bang atomic ParentProfile + active StudentParent recheck va only-authorized School projection.

OAuth callback nhan authorization code, khong nhan id token truc tiep. State phai duoc bind voi cookie correlation host-only cua browser va durable transaction co nonce OIDC, audience, redirect va expiry; consume chi xay ra atomically sau khi Google identity da duoc verify, de transient Google failure khong tu choi retry hop le. Logout la cookie mutation `POST`: origin va double-submit CSRF deu bat buoc, va portal khong tu set forbidden `Origin` header.

## Spec Change Log

- Review iteration 1: Review phat hien spec chi noi Google verification/state chung chung, khong rang buoc authorization-code exchange + OIDC nonce, browser-bound/durable state, CSRF logout, config TTL/secret fail-fast, valid cross-audience proof, concurrency bind va client login/cancel safety. Bo sung Code Map, Tasks va Design Notes de implementation khong the coi `code` la id token, phat hanh state co the replay/load-balance, dung fallback secret production, logout GET khong CSRF, hoac bo qua client entry/test boundary. KEEP: Parent fail-closed va defer active-link authority sang Story 2.3; audience cookie host-only va API-authoritative session isolation van giu nguyen.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api prisma:generate && pnpm --filter @passionedu/api prisma:migrate:deploy` -- expected: Google-subject migration va generated client hop le.
- `pnpm --filter @passionedu/api test && pnpm --filter @passionedu/api test:integration` -- expected: OAuth/session audience, cookie/state va PostgreSQL binding tests pass.
- `pnpm --filter @passionedu/web test && pnpm --filter @passionedu/teacher-web test && pnpm --filter @passionedu/parent-web test && pnpm --filter @passionedu/ops-web test` -- expected: bootstrap/401/logout clear-state va Parent SW regression pass.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` -- expected: workspace target checks pass khong co cross-app auth import.

## Suggested Review Order

**OAuth And Identity Boundary**

- Binds durable, browser-correlated OAuth state and immutable Google identity ownership.
  [`auth.service.ts:22`](../../apps/api/src/modules/auth/auth.service.ts#L22)

- Persists one-time OAuth state and canonical Google-subject uniqueness.
  [`schema.prisma:51`](../../apps/api/prisma/schema.prisma#L51)

- Applies the additive Google-subject and OAuth transaction migrations.
  [`migration.sql:1`](../../apps/api/prisma/migrations/20260916000002_oauth_transactions/migration.sql#L1)

**HTTP Audience Isolation**

- Restricts credentialed CORS to the origin matching the route audience.
  [`main.ts:18`](../../apps/api/src/main.ts#L18)

- Issues host-only audience cookies and enforces CSRF-protected logout.
  [`auth.controller.ts:16`](../../apps/api/src/modules/auth/auth.controller.ts#L16)

**Persistence And Regression Proof**

- Proves expiry, retry, replay and concurrent canonical binding against PostgreSQL.
  [`auth.persistence.integration.test.ts:46`](../../apps/api/src/integration/auth.persistence.integration.test.ts#L46)

- Verifies CORS, cross-audience rejection, callback cookies and CSRF at HTTP boundary.
  [`auth.controller.test.ts:14`](../../apps/api/src/modules/auth/auth.controller.test.ts#L14)

- Starts Google login and clears client state before logout completes.
  [`auth-session.ts:6`](../../apps/web/src/auth-session.ts#L6)

- Keeps Parent authenticated responses and sensitive resources out of runtime cache.
  [`vite.config.ts:5`](../../apps/parent-web/vite.config.ts#L5)

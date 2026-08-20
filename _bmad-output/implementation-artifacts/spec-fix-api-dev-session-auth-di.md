---
title: 'Sửa khởi động API dev và dependency injection của SessionAuthGuard'
type: 'bugfix'
created: '2026-08-20'
status: 'done'
baseline_commit: '5a2eaf3657fa01369fac41ce0596dab6429923b4'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Lệnh `pnpm dev` khởi động Vite thành công nhưng Nest dừng trước khi lắng nghe cổng với `UndefinedDependencyException` tại dependency đầu tiên của `SessionAuthGuard`. Điều này chặn toàn bộ dashboard trong môi trường phát triển, mặc dù source TypeScript đã bật metadata cho decorator.

**Approach:** Chạy API development từ JavaScript do TypeScript compiler tạo ra thay vì thực thi source Nest bằng `tsx`, vì DI dựa trên `design:paramtypes` phải tồn tại ở runtime. Đồng thời công khai `JwtModule` từ `AuthModule` để provider `APP_GUARD` tại `AppModule` có thể nhận `JwtService` sau khi lỗi metadata được khắc phục.

## Boundaries & Constraints

**Always:** Giữ `SessionAuthGuard` là global `APP_GUARD`; giữ cookie-auth, `AUTH_CONFIG` symbol injection, Prisma global module và hành vi xác thực hiện hữu. Dùng output của `tsc` cho runner development để metadata decorator được emit. `AuthModule` phải export đúng module/provider cần thiết cho `AppModule`, không đăng ký thêm một `JwtModule` thứ hai với cấu hình khác. Chỉ sửa công cụ development và wiring DI liên quan trực tiếp đến lỗi startup.

**Ask First:** Dừng và hỏi nếu việc chạy watcher compiler yêu cầu thay đổi major version TypeScript/Nest, thay đổi cơ chế phát hành production, hay phát hiện metadata lỗi ở provider không liên quan.

**Never:** Không thay mọi dependency constructor thành `@Inject(...)` như một workaround cho runner không có decorator metadata. Không bỏ `APP_GUARD`, không biến guard thành request-scoped, không đưa secret vào package scripts/lockfile, không thay đổi luồng Google OAuth hoặc schema database.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Khởi động dev bình thường | `.env` hợp lệ, PostgreSQL sẵn sàng, chạy root `pnpm dev` | API compile rồi khởi động Nest; `SessionAuthGuard` nhận đủ `Reflector`, `JwtService`, `PrismaService`, và `AUTH_CONFIG` | Báo lỗi cấu hình/database thật nếu có, không có `UndefinedDependencyException` do token bị mất |
| Global guard được tạo sau compile | `AppModule` đăng ký `{ provide: APP_GUARD, useClass: SessionAuthGuard }` | `JwtService` được resolve từ import `AuthModule` | Không có lỗi “Nest can't resolve dependencies ... JwtService” |
| Source API thay đổi | Chỉnh `.ts` dưới `apps/api/src` trong lúc `pnpm --filter api dev` đang chạy | Compiler rebuild và tiến trình API chạy lại bằng `dist/main.js` mới | Build lỗi được hiển thị; server không chạy output cũ sai lệch một cách âm thầm |

</frozen-after-approval>

## Code Map

- `apps/api/package.json:6-17` -- `dev` hiện chạy `tsx watch src/main.ts`; đây là điểm mất `design:paramtypes` khi esbuild transpile source decorator. `build` đã là `tsc -p tsconfig.json` và `start` đã chạy `node dist/main.js`, là nền tảng để thay runner dev mà không đổi production.
- `apps/api/tsconfig.json:1-19` -- xác nhận `experimentalDecorators` và `emitDecoratorMetadata` đang bật; runner phải thực sự dùng output compiler này.
- `apps/api/src/common/guards/session-auth.guard.ts:1-27` -- guard injectable inject `Reflector`, `JwtService`, `PrismaService` bằng class token và `AUTH_CONFIG` bằng explicit symbol. Lỗi index 0 tương ứng `Reflector`; không sửa logic authorization.
- `apps/api/src/app.module.ts:1-19` -- đăng ký `SessionAuthGuard` qua `APP_GUARD` tại module root; scope này chỉ thấy exports của imported modules cùng global modules.
- `apps/api/src/modules/auth/auth.module.ts:1-16` -- cấu hình `JwtModule.registerAsync` từ `AUTH_CONFIG` nhưng chưa export `JwtModule`; cần expose module này cho global guard.
- `apps/api/src/common/config/config.module.ts` và `apps/api/src/common/prisma/prisma.module.ts` -- các module global cung cấp `AUTH_CONFIG` và `PrismaService`; đọc để xác nhận không thay wiring hiện hữu.
- `apps/api/src/common/guards/session-auth.guard.test.ts` -- unit test hiện tự tạo guard, không kiểm chứng Nest injection metadata/module visibility.
- `apps/api/src/app.module.test.ts` -- điểm phù hợp để thêm smoke test module compilation, nếu fixture config/Prisma có thể mock mà không nối database.
- `pnpm-lock.yaml` -- chỉ cập nhật nếu thêm watcher compiler dependency; không thay phiên bản package không liên quan.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/package.json` và `pnpm-lock.yaml` -- thay `tsx watch` bằng workflow watch compile TypeScript rồi chạy/restart `dist/main.js`; thêm tối thiểu dev dependency cần thiết và lockfile chính xác -- bảo toàn metadata runtime trong development.
- [x] `apps/api/src/modules/auth/auth.module.ts` -- export `JwtModule` đã được đăng ký hiện hữu -- cho phép `SessionAuthGuard` được tạo qua `APP_GUARD` tại `AppModule` inject `JwtService`.
- [x] `apps/api/src/app.module.test.ts` hoặc test integration/unit phù hợp -- thêm regression test compile `AppModule` với mock Prisma/config, xác nhận provider global guard có thể được resolve -- bắt cả lỗi export `JwtModule` lẫn dependency token bị thiếu trong DI container.
- [x] `apps/api/src/common/guards/session-auth.guard.test.ts` -- chỉ bổ sung assertion metadata/runtime nếu cách test phù hợp với Vitest output compiler; không viết test phụ thuộc vào `tsx` không emit metadata -- tránh test xanh giả do khởi tạo bằng `new`.

**Acceptance Criteria:**
- Given API dependencies và biến môi trường hợp lệ, when chạy `pnpm dev`, then Nest hoàn tất khởi tạo mà không log `UndefinedDependencyException` cho `SessionAuthGuard`.
- Given `SessionAuthGuard` được Nest tạo từ provider `APP_GUARD`, when `AppModule` compile, then `Reflector`, `JwtService`, `PrismaService`, và `AUTH_CONFIG` đều resolve được.
- Given `JwtModule` chỉ được cấu hình trong `AuthModule`, when `AppModule` tạo global guard, then guard nhận cùng JWT configuration đã đăng ký từ `AUTH_CONFIG`, không có module JWT cấu hình trùng lặp.
- Given thay đổi source API khi dev watcher đang chạy, when TypeScript compile thành công, then tiến trình server khởi động lại từ `dist/main.js` đã cập nhật.

## Design Notes

`emitDecoratorMetadata` là tính năng của TypeScript compiler transform. `tsx` dùng esbuild để transpile nhanh nhưng không emit `Reflect.metadata('design:paramtypes', ...)`; Nest chỉ có thể nhìn thấy `AUTH_CONFIG` vì parameter đó có explicit `@Inject`. Vì vậy sửa import hoặc thêm `@Inject` rải rác chỉ che triệu chứng và sẽ dễ bỏ sót provider khác.

Export `JwtModule` là thay đổi visibility tối thiểu: `AuthModule` tiếp tục là nơi duy nhất tạo JWT options từ cấu hình auth, còn root module chỉ tiêu thụ `JwtService` thông qua global guard.

## Verification

**Commands:**
- `pnpm --filter api typecheck` -- expected: TypeScript hoàn tất không lỗi.
- `pnpm --filter api test` -- expected: unit/regression tests, gồm DI compilation test mới, pass.
- `pnpm --filter api build` -- expected: tạo `apps/api/dist` với metadata decorator và không lỗi.
- `pnpm --filter api start` -- expected: với `.env` và PostgreSQL cục bộ hợp lệ, Nest khởi động không báo lỗi resolve `SessionAuthGuard`.
- `pnpm --filter api dev` -- expected: khởi động bằng compiled output; sửa một file `.ts` kiểm chứng compile và restart.

## Suggested Review Order

**Development Runtime**

- Compile TypeScript trước khi chạy Nest để giữ metadata dependency injection.
  [`package.json:7`](../../apps/api/package.json#L7)

- Export JWT đã cấu hình để global guard ở root module có thể inject service.
  [`auth.module.ts:12`](../../apps/api/src/modules/auth/auth.module.ts#L12)

**Regression Coverage**

- Compile source thật, rồi xây Nest container từ output có decorator metadata.
  [`app.module.test.ts:9`](../../apps/api/src/app.module.test.ts#L9)

- Cài dependencies test và watcher với phiên bản được khóa nhất quán.
  [`pnpm-lock.yaml:72`](../../pnpm-lock.yaml#L72)

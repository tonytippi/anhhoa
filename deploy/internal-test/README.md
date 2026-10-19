# Internal Test Compose

Stack internal test: PostgreSQL trong Docker, API, bốn portal; expose qua Cloudflare Tunnel. Không dùng cho pilot/production (xem `deploy/compose`).

## Chạy

```bash
cd deploy/internal-test
cp .env.example .env   # điền secret giống apps/api/.env; database tự chứa trong Compose
docker compose up -d --build
docker compose --profile seed build seed      # `up --build` không build service thuộc profile seed
docker compose --profile seed run --rm seed   # seed PeakLand (idempotent, chạy lại được)
```

Reset dữ liệu: `docker compose down -v` rồi chạy lại ba lệnh trên. Seed bỏ qua bản ghi đã có, nên sửa seed xong phải reset thì dữ liệu mới đổi.

## Thông báo đẩy (Web Push)

Tắt mặc định. Để bật, sinh một cặp khóa VAPID một lần (`npx web-push generate-vapid-keys`) rồi điền `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (và tùy chọn `VAPID_SUBJECT`) vào `.env`. Giữ nguyên cặp khóa giữa các lần deploy: đổi khóa làm mọi thiết bị đã đăng ký mất thông báo cho tới khi người dùng bật lại. iPhone/iPad chỉ nhận thông báo khi app được "Thêm vào Màn hình chính" (iOS 16.4+), và domain phải là HTTPS.

## Cloudflare Tunnel

| Hostname | Service |
| --- | --- |
| `app.passionedu.org` | `http://localhost:9000` |
| `teacher.passionedu.org` | `http://localhost:9001` |
| `parent.passionedu.org` | `http://localhost:9002` |
| `ops.passionedu.org` | `http://localhost:9003` |
| `api.passionedu.org` (tuỳ chọn) | `http://localhost:9004` |

PostgreSQL bind `127.0.0.1:9005` để debug. Mọi port chỉ bind loopback; cloudflared chạy trên host.

Mỗi portal proxy `/api` về API cùng origin, nên cookie session/CSRF là host-only trên chính host portal và JS đọc được cookie CSRF cho double-submit. Vì vậy Google OAuth client phải có các redirect URI:

- `https://app.passionedu.org/api/app/auth/google/callback`
- `https://teacher.passionedu.org/api/teacher/auth/google/callback`
- `https://parent.passionedu.org/api/parent/auth/google/callback`
- `https://ops.passionedu.org/api/ops/auth/google/callback`

Đổi host qua `APP_HOST`/`TEACHER_HOST`/`PARENT_HOST`/`OPS_HOST` trong `.env` rồi `docker compose up -d --build` (portal nhúng API URL lúc build).

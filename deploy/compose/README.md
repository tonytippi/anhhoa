# Pilot Compose

Run the stack on the pilot VPS from repository source. Copy `.env.example` outside Git and replace all placeholder values with external secrets, TLS certificate directory and certificate/key paths.

`migrate` runs `prisma migrate deploy` before `api` starts. Do not use `prisma db push` in deployment and do not attempt destructive rollback; forward migrations are the only pilot recovery path.

This is a clean-break target: deploy only to a database created for the target migration history. A legacy Anh Hoa database is not an upgrade input; stop and create a separately approved onboarding/migration workstream if data must be retained.

The proxy routes `app.passionedu.org`, `teacher.passionedu.org`, `parent.passionedu.org`, `ops.passionedu.org`, and `api.passionedu.org` to separate containers. PostgreSQL data persists in the `postgres-data` volume.

FROM node:24.21.0-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
ARG APP
ARG VITE_API_URL=https://api.passionedu.org
COPY apps/${APP}/package.json apps/${APP}/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/teacher-web/package.json apps/teacher-web/package.json
COPY apps/parent-web/package.json apps/parent-web/package.json
COPY apps/ops-web/package.json apps/ops-web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile
COPY apps/${APP} apps/${APP}
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @passionedu/${APP} build

FROM nginx:1.27-alpine
ARG APP
COPY deploy/compose/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/${APP}/dist /usr/share/nginx/html

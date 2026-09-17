FROM node:24.21.0-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/teacher-web/package.json apps/teacher-web/package.json
COPY apps/parent-web/package.json apps/parent-web/package.json
COPY apps/ops-web/package.json apps/ops-web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
ARG VITE_API_URL=https://api.passionedu.org
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @passionedu/admin-web build

FROM nginx:1.27-alpine

COPY deploy/compose/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

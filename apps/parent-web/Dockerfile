FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/parent-web/package.json apps/parent-web/package.json
RUN pnpm install --frozen-lockfile

COPY apps/parent-web apps/parent-web
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter parent-web build

FROM nginx:1.27-alpine

COPY apps/parent-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/parent-web/dist /usr/share/nginx/html

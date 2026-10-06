# syntax = docker/dockerfile:1

# Two-stage build: compile the client (the one part of this app that needs
# a real build step — browsers can't strip TypeScript types the way the
# server's `node src/server/index.ts` does), then ship just the runtime
# and its production dependencies.

FROM node:24.21.0-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@11.9.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.client.json ./
COPY src ./src
RUN pnpm build:client

FROM node:24.21.0-alpine
WORKDIR /app
RUN npm install -g pnpm@11.9.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY src ./src
COPY public ./public
COPY README.md ./
COPY --from=build /app/dist ./dist
ENV DB_PATH=/data/collective-snake.db
EXPOSE 8080
CMD ["node", "src/server/index.ts"]

FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY dashboard-api/package.json ./dashboard-api/
COPY dashboard-web/package.json ./dashboard-web/
RUN pnpm install --frozen-lockfile --shamefully-hoist
COPY . .
RUN pnpm -C dashboard-api build

FROM node:20-alpine AS runner
RUN apk add --no-cache git
RUN git config --global --add safe.directory /host-repo
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dashboard-api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4001
CMD ["node", "dist/index.js"]

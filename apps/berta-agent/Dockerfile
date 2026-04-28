FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY berta-agent/package.json ./berta-agent/
COPY dashboard-api/package.json ./dashboard-api/
COPY dashboard-web/package.json ./dashboard-web/
RUN pnpm install --frozen-lockfile --shamefully-hoist
COPY . .
RUN pnpm -C berta-agent build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/berta-agent/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4002
CMD ["node", "dist/index.js"]

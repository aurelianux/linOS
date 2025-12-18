FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm -C dashboard-api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/dashboard-api/dist ./dist
COPY --from=builder /app/apps/dashboard-api/node_modules ./node_modules
EXPOSE 4001
CMD ["node", "dist/index.js"]


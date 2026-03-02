FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY dashboard-web/package.json ./dashboard-web/
COPY dashboard-api/package.json ./dashboard-api/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm -C dashboard-web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g serve
COPY --from=builder /app/dashboard-web/dist ./
EXPOSE 4000
CMD ["serve", "-s", ".", "-l", "4000"]

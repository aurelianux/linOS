FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY dashboard-web/package.json ./dashboard-web/
COPY dashboard-api/package.json ./dashboard-api/
RUN pnpm install --frozen-lockfile

# Accept build args and expose to Vite
ARG VITE_HA_URL
ARG VITE_HA_TOKEN
ARG VITE_API_BASE
ENV VITE_HA_URL=$VITE_HA_URL
ENV VITE_HA_TOKEN=$VITE_HA_TOKEN
ENV VITE_API_BASE=$VITE_API_BASE

COPY . .
RUN pnpm -C dashboard-web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && pnpm add -g serve
COPY --from=builder /app/dashboard-web/dist ./
EXPOSE 4000
CMD ["serve", "-s", ".", "-l", "4000"]

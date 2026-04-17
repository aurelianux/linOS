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
RUN apk add --no-cache git openssh-client
RUN git config --global --add safe.directory /host-repo
RUN mkdir -p /root/.ssh && \
    echo -e "Host github.com\n  IdentityFile /run/secrets/linos_git_pull_key\n  StrictHostKeyChecking no" > /root/.ssh/config && \
    chmod 600 /root/.ssh/config
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dashboard-api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4001
CMD ["node", "dist/index.js"]

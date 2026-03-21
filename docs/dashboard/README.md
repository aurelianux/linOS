# linBoard (Dashboard) — Local Development

## Overview

The dashboard is a full-stack smart-home application built with:
- **Frontend**: React 19 + TypeScript + Vite + @hakit/core + Zustand (port 4000)
- **Backend**: Express 5 + TypeScript + Zod + Pino (port 4001)
- **Manager**: pnpm workspaces

For exact versions, see [apps/package.json](../../apps/package.json) and individual package.json files.

## Prerequisites

- Node.js 20+ (or use `nvm`)
- pnpm 10.25.0+

## Quick Start

From repository root:

```bash
# Install dependencies
cd apps
pnpm install

# Start both web (4000) and API (4001)
pnpm dev

# Or start individually:
pnpm -C dashboard-web dev    # Vite on :4000
pnpm -C dashboard-api dev    # Express on :4001
```

## URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Web | http://localhost:4000 | Dashboard UI |
| API | http://localhost:4001 | Backend API |
| Health | http://localhost:4001/health | Liveness probe |
| Storybook | http://localhost:6006 | Component explorer |

## Development Commands

```bash
cd apps

# Quality checks
pnpm typecheck    # TypeScript validation (no emit)
pnpm lint         # ESLint
pnpm format       # Prettier (write)

# Build
pnpm build        # Compile both packages to dist/

# Full workflow
pnpm typecheck && pnpm lint && pnpm build

# Storybook
pnpm -C dashboard-web storybook
```

## Testing API

### Health Check

```bash
curl http://localhost:4001/health
# { "ok": true, "data": { "status": "ok" } }
```

### CORS Test

```bash
curl -i \
  -H "Origin: http://localhost:4000" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS http://localhost:4001/health
# Should include: Access-Control-Allow-Origin: http://localhost:4000
```

### 404 Error

```bash
curl http://localhost:4001/nonexistent
# { "ok": false, "error": { "message": "Not Found", "code": "NOT_FOUND" } }
```

## Architecture

### Frontend

The web frontend uses `@hakit/core` WebSocket hooks for real-time Home Assistant entity state and Zustand stores for UI persistence. See [apps/dashboard-web/README.md](../../apps/dashboard-web/README.md) for full details.

Key features:
- Gesture-based light control (tap, drag, long press)
- Climate cards with temperature presets and mode selectors
- Quick toggle bar for frequently used entities
- Docker container monitoring panel
- System info panel (CPU, RAM in header)
- Roborock vacuum control panel
- i18n support (EN/DE) via `useTranslation()` hook
- Entity configuration driven by `config/dashboard.json`

### Backend

The API serves as a BFF (Backend for Frontend) providing:
- System metrics (CPU, RAM, disk usage)
- Docker container status via Docker Engine API socket
- Service health checks from `config/services.json`
- Dashboard configuration from `config/dashboard.json`
- Rate limiting with `express-rate-limit`

See [API.md](./API.md) for full backend architecture and [DECISIONS.md](./DECISIONS.md) for tech stack decisions.

## Environment Variables

The API reads from `process.env`. For local dev, defaults are used:

| Variable | Default | Usage |
|----------|---------|-------|
| `NODE_ENV` | `development` | Log format and error verbosity |
| `PORT` | `4001` | API server port |
| `LOG_LEVEL` | `info` | Pino log level |
| `CORS_ALLOW_ORIGINS` | `http://localhost:4000,http://dashboard.lan` | CORS allowlist |
| `CONFIG_PATH` | (optional) | Path to JSON app config file |

## Docker Deployment

Test with Docker Compose:

```bash
cd stacks/applications/dashboard
docker compose up --build
```

Environment vars are sourced from `../../.env.linos`. The dashboard container uses Docker Engine API via socket (not CLI) for container management.

## Troubleshooting

### Port 4000/4001 Already in Use

```bash
# Find process using port 4000
lsof -i :4000

# Kill it
kill -9 <PID>

# Or use different port (API only):
PORT=4002 pnpm -C dashboard-api dev
```

### TypeScript Errors

```bash
pnpm typecheck  # See full error list
```

### ESLint Warnings

```bash
pnpm lint       # View issues
pnpm format     # Auto-fix where possible
```

### pino-pretty Not Found

Ensure you've installed dependencies:
```bash
pnpm install
```

## Further Reading

- [API.md](./API.md) — Backend architecture and integration guide
- [DECISIONS.md](./DECISIONS.md) — Tech stack decisions
- [apps/dashboard-web/README.md](../../apps/dashboard-web/README.md) — Frontend details
- [CLAUDE.md](../../CLAUDE.md) — Full project guidelines, code patterns, and rules

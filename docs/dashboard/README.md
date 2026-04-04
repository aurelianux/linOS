# linBoard (Dashboard) – Local Development

## Overview

The dashboard is a full-stack application built with:
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

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/health` | GET | Liveness probe |
| `/services/status` | GET | Service health status (from `config/services.json`) |
| `/system/info` | GET | Host system information |
| `/system/vitals` | GET | CPU/RAM usage for header metrics |
| `/system/containers` | GET | Docker container status (via Docker Engine API socket) |
| `/dashboard/config` | GET | Dashboard configuration (rooms, entities, quick toggles) |
| `/timer/state` | GET | Current timer state |
| `/timer/start` | POST | Start a new timer |
| `/timer/stop` | POST | Stop running timer |
| `/ws/timer` | WS | Real-time timer state broadcasts |
| `/vacuum-routines/*` | GET/POST | Vacuum routine management |
| `/ws/vacuum-routine` | WS | Real-time vacuum routine broadcasts |

## Architecture

- **Frontend**: [apps/dashboard-web/README.md](../../apps/dashboard-web/README.md) — component structure, HA integration, state management
- **Backend**: [API.md](./API.md) — full backend architecture and integration guide
- **Tech Stack**: [DECISIONS.md](./DECISIONS.md)

## Environment Variables

The API reads from `process.env`. For local dev, defaults are used:

| Variable | Default | Usage |
|----------|---------|-------|
| `NODE_ENV` | `development` | Log format and error verbosity |
| `PORT` | `4001` | API server port |
| `LOG_LEVEL` | `info` | Pino log level |
| `CORS_ALLOW_ORIGINS` | `http://localhost:4000,http://dashboard.lan` | CORS allowlist |
| `LINOS_DASHBOARD_HOST` | `dashboard.lan` | Dashboard hostname |
| `CONFIG_PATH` | (optional) | Path to JSON app config file |
| `SERVICES_CONFIG_PATH` | (optional) | Path to services monitoring config |
| `DASHBOARD_CONFIG_PATH` | (optional) | Path to dashboard entity config |
| `LINOS_HA_URL` | (optional) | HA URL for timer light feedback |
| `LINOS_HA_TOKEN` | (optional) | HA token for timer light feedback |
| `LINOS_NOTIFICATION_LIGHT_ENTITIES` | (optional) | Light entity IDs for notifications |

See also `.env.example` files in `apps/dashboard-web/` and `apps/dashboard-api/`.

## Docker Deployment

Test with Docker Compose:

```bash
cd stacks/applications/dashboard
docker compose up --build
```

Environment vars are sourced from `../../.env.linos`.

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

See [API.md](./API.md) for detailed backend documentation.

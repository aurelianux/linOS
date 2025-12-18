# linBoard (Dashboard) – Local Development

## Overview

The dashboard is a full-stack application built with:
- **Frontend**: React 19 + TypeScript + Vite (port 4000)
- **Backend**: Express 5.2 + TypeScript (port 4001)
- **Manager**: pnpm workspaces

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

- **Frontend**: [README.md](./README.md) (or see `apps/dashboard-web/README.md`)
- **Backend**: [API.md](./API.md) – Full backend architecture & integration guide
- **Tech Stack**: [DECISIONS.md](./DECISIONS.md)

## Environment Variables

The API reads from `process.env`. For local dev, defaults are used:

| Variable | Default | Usage |
|----------|---------|-------|
| `NODE_ENV` | `development` | Log format & error verbosity |
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

## Next Steps

1. ✅ API skeleton is production-ready
2. 📋 Frontend needs stub page extraction into components
3. 🏠 Next: Home Assistant integration endpoints
4. 🔐 Then: Authentication & authorization layer

See [API.md](./API.md) for detailed backend documentation.


# Dashboard API – Backend Architecture

## Overview

The dashboard API (`apps/dashboard-api`) is the Backend-for-Frontend (BFF) that powers the linOS dashboard web interface. It's built with **Express + TypeScript** and designed for production deployment.

### Current Stack
- **Framework**: Express 5.2 (HTTP server)
- **Language**: TypeScript 5.9 (strict mode)
- **Logging**: Pino + pino-http (structured, JSON in prod)
- **Config**: Zod (validation + type safety)
- **Port**: `process.env.PORT` (default 4001)

---

## Architecture

### Folder Structure

```
apps/dashboard-api/
├── src/
│   ├── index.ts              # Bootloader: env → config → app → listen
│   ├── app.ts                # createApp(): Express setup, middleware wiring
│   ├── config/
│   │   ├── env.ts            # Zod schema for environment validation
│   │   └── app-config.ts     # Optional JSON config loader (rooms, favorites, actions)
│   ├── middleware/
│   │   ├── headers.ts        # Security headers (nosniff, referrer-policy, frame-options)
│   │   ├── cors.ts           # CORS middleware (LAN-first allowlist)
│   │   └── errors.ts         # Global error handler + 404 handler
│   ├── routes/
│   │   ├── index.ts          # Main router aggregator
│   │   └── health.ts         # GET /health endpoint
│   └── services/
│       └── index.ts          # Placeholder for future services (HA, MQTT, etc.)
├── dist/                     # Compiled JS (production output)
├── Dockerfile                # Multistage build (dev → prod)
├── package.json
├── tsconfig.json
└── eslint.config.js
```

---

## Key Concepts

### 1. Response Format

All API responses follow a standardized envelope format:

**Success:**
```json
{
  "ok": true,
  "data": { /* ... */ }
}
```

**Error:**
```json
{
  "ok": false,
  "error": {
    "message": "Description of what went wrong",
    "code": "ERROR_CODE"
  }
}
```

### 2. /health Endpoint

- **Route**: `GET /health`
- **Response**: `{ ok: true, data: { status: "ok" } }`
- **Purpose**: Liveness probe for Caddy / Kubernetes / monitoring
- **Special**: Excluded from request logging (no spam)

### 3. Logging

Uses **Pino** with two modes:

| Environment | Output | Format |
|-------------|--------|--------|
| `development` | stdout | Pretty-printed with colors |
| `production` | stdout | JSON (structured logs for parsing) |

**Request logs** are added via `pino-http` middleware, excluding `/health`.

### 4. Configuration

#### Environment Variables (Zod Schema)

Loaded from `process.env` at startup:

| Variable | Type | Default | Purpose |
|----------|------|---------|---------|
| `NODE_ENV` | `development \| production` | `development` | Affects logging, error verbosity |
| `PORT` | number | `4001` | Server port |
| `LOG_LEVEL` | `fatal \| error \| warn \| info \| debug \| trace` | `info` | Pino log level |
| `CORS_ALLOW_ORIGINS` | string (comma-separated) | `http://localhost:4000,http://dashboard.lan` | CORS allowlist |
| `LINOS_DASHBOARD_HOST` | string | `dashboard.lan` | Canonical dashboard hostname |
| `CONFIG_PATH` | string (optional) | — | Path to JSON app config file |

#### App Config File (Optional)

If `CONFIG_PATH` is set, the API attempts to load a JSON file with `rooms`, `favorites`, `actions`, etc.

Example (`config/app-config.json`):
```json
{
  "rooms": ["kitchen", "bedroom", "living_room"],
  "favorites": ["light.bedroom", "climate.kitchen"],
  "actions": [...]
}
```

If the file is missing or unparseable, the API logs a warning and continues with `{}`.

### 5. CORS & Headers

**CORS (LAN-First Approach):**
- Allowlist configured via `CORS_ALLOW_ORIGINS` env var
- Default allows `localhost:4000` (dev) and `dashboard.lan`
- Blocks external origins by default

**Security Headers:**
- `X-Powered-By`: Removed
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`

---

## Local Development

### Start API Only (Isolated)

```bash
cd apps/dashboard-api
NODE_ENV=development PORT=4001 pnpm dev
```

Output:
```
✓ Dashboard API listening on http://localhost:4001
```

### Start Full Dashboard (Web + API)

```bash
cd apps
pnpm dev
```

This runs both web (Vite on 4000) and API (tsx watch on 4001) concurrently.

### Test /health Endpoint

```bash
curl http://localhost:4001/health
```

Response:
```json
{
  "ok": true,
  "data": {
    "status": "ok"
  }
}
```

### Test CORS

```bash
curl -H "Origin: http://localhost:4000" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS http://localhost:4001/health -v
```

Should include `Access-Control-Allow-Origin: http://localhost:4000`.

### Test Error Handler

```bash
curl http://localhost:4001/nonexistent
```

Response:
```json
{
  "ok": false,
  "error": {
    "message": "Not Found",
    "code": "NOT_FOUND"
  }
}
```

---

## Scripts

### Available pnpm Commands

```bash
# Development: auto-reload on file changes
pnpm -C dashboard-api dev

# TypeScript check (no emit)
pnpm -C dashboard-api typecheck

# ESLint
pnpm -C dashboard-api lint

# Prettier format
pnpm -C dashboard-api format

# Build (compile TS to dist/)
pnpm -C dashboard-api build

# Full dashboard (web + api)
cd apps && pnpm dev
cd apps && pnpm typecheck
cd apps && pnpm lint
cd apps && pnpm format
cd apps && pnpm build
```

---

## Production Deployment

### Docker

Build and run using Docker Compose:

```bash
cd stacks/applications/dashboard
docker compose up --build
```

Environment is loaded from `../../.env.linos` (shared across all stacks).

### Environment Setup

Ensure `.env.linos` includes:

```env
# Dashboard
DASHBOARD_WEB_PORT=4000
DASHBOARD_API_PORT=4001
LINOS_DASHBOARD_HOST=dashboard.lan

# API-specific (optional)
LOG_LEVEL=info
CORS_ALLOW_ORIGINS=http://localhost:4000,http://dashboard.lan
CONFIG_PATH=/etc/linos/app-config.json  # optional
```

### Caddy Reverse Proxy

The Caddy config (`stacks/proxy/Caddyfile`) exposes the dashboard:

```plaintext
{$LINOS_DASHBOARD_HOST}:{$PROXY_HTTP_PORT} {
    reverse_proxy 127.0.0.1:{$DASHBOARD_WEB_PORT}
}

{$LINOS_DASHBOARD_API_HOST}:{$PROXY_HTTP_PORT} {
    reverse_proxy 127.0.0.1:{$DASHBOARD_API_PORT}
}
```

---

## Future: Integration Points

The API is designed to integrate with:

- **Home Assistant** (REST API or direct socket)
- **MQTT** (Mosquitto - via mqtt.js or similar)
- **Node-RED** (webhooks)
- **Zigbee2MQTT** (MQTT topics)

Services will be added to `src/services/` as needed. Example:

```typescript
// src/services/home-assistant.ts
export class HomeAssistantService {
  async getRooms() { /* ... */ }
  async getEntities() { /* ... */ }
}
```

---

## Checklist for Future Work

- [ ] Add room management endpoints (`GET /rooms`, `POST /rooms`, etc.)
- [ ] Add favorites endpoints (`GET /favorites`, etc.)
- [ ] Add actions/automation endpoints
- [ ] Integrate with Home Assistant API
- [ ] Integrate with MQTT topics
- [ ] Add WebSocket for real-time updates
- [ ] Add authentication/authorization layer
- [ ] Add database layer (if needed)
- [ ] Add more comprehensive error codes

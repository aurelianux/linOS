# Dashboard API – Backend Architecture

## Overview

The dashboard API (`apps/dashboard-api`) is the Backend-for-Frontend (BFF) that powers the linOS dashboard web interface. It's built with **Express + TypeScript** and designed for production deployment with structured logging, configuration management, and error handling.

### Tech Stack
- **Framework**: Express (HTTP server)
- **Language**: TypeScript (strict mode)
- **Logging**: Pino + pino-http (structured JSON logs in production)
- **Validation**: Zod (type-safe environment variables)
- **Port**: Configured via `process.env.PORT` (default: 4001)
- **Styling** (frontend): Tailwind CSS + shadcn/ui

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
│   │   ├── cors.ts           # CORS middleware (dev-friendly, LAN-first)
│   │   └── errors.ts         # Global error handler + 404 handler
│   ├── routes/
│   │   ├── index.ts          # Main router aggregator
│   │   └── health.ts         # GET /health endpoint
│   └── services/
│       └── index.ts          # Placeholder for future services (HA, MQTT, etc.)
├── dist/                     # Compiled JS (production output)
├── Dockerfile                # Multistage build
├── package.json
├── tsconfig.json
└── eslint.config.js
```

---

## Key Concepts

### 1. Response Envelope

All API responses follow a standardized envelope format for consistency:

**Success:**
```json
{
  "ok": true,
  "data": { }
}
```

**Error:**
```json
{
  "ok": false,
  "error": {
    "message": "Human-readable error description",
    "code": "ERROR_CODE"
  }
}
```

### 2. /health Endpoint

- **Route**: `GET /health`
- **Response**: `{ ok: true, data: { status: "ok" } }`
- **Purpose**: Liveness probe for Caddy / monitoring / container orchestration
- **Special**: Excluded from request logging to avoid noise

### 3. Logging

Uses **Pino** with environment-aware configuration:

| Environment | Output | Format | Purpose |
|-------------|--------|--------|---------|
| `development` | stdout | Pretty-printed + colors | Human-readable in dev |
| `production` | stdout | JSON (structured) | Machine-parseable for log aggregation |

**Request logs** include timing, method, status, and headers. `/health` is excluded to reduce noise.

### 4. Environment Configuration

#### Environment Variables (Zod Validation)

All env vars are validated at startup via Zod schema (`src/config/env.ts`):

| Variable | Type | Default | Purpose |
|----------|------|---------|---------|
| `NODE_ENV` | `development \| production` | `development` | Affects logging format, error verbosity |
| `PORT` | number | `4001` | API server port |
| `LOG_LEVEL` | `fatal\|error\|warn\|info\|debug\|trace` | `info` | Pino log level |
| `CORS_ALLOW_ORIGINS` | string (CSV) | `http://localhost:4000,http://dashboard.lan` | CORS allowlist (dev-friendly) |
| `LINOS_DASHBOARD_HOST` | string | `dashboard.lan` | Dashboard hostname (used in config/docs) |
| `CONFIG_PATH` | string (optional) | — | Path to optional JSON config file |

**Notes:**
- All vars are loaded from `process.env` (via Docker env_file or direct export)
- Validation errors cause immediate startup failure with clear error message
- Defaults are sensible for LAN deployment

#### Application Configuration (JSON)

If `CONFIG_PATH` is set, the API attempts to load a JSON file at startup:

```json
{
  "rooms": ["kitchen", "bedroom", "living_room"],
  "favorites": ["light.bedroom", "climate.kitchen"],
  "actions": [...]
}
```

**Behavior:**
- File is optional; if missing, API logs warning and continues with `{}`
- Parse errors are logged as warnings; API continues
- Type: `AppConfig` with `rooms`, `favorites`, `actions` as `unknown` (schema defined later)

### 5. Security Headers

The `headers` middleware sets standard HTTP security headers:

| Header | Value | Rationale |
|--------|-------|-----------|
| `X-Powered-By` | (removed) | Don't leak tech stack |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME type confusion attacks |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Privacy: share origin only for same-origin requests |
| `X-Frame-Options` | `SAMEORIGIN` | Allow same-origin embeds (LAN kiosks); block external |

### 6. CORS Policy

**Intent**: CORS is primarily for **development** (Vite on localhost:4000). In production, the same-origin policy is enforced via Caddy routing (API under `/api` prefix on same host).

**Development Allowlist** (via `CORS_ALLOW_ORIGINS`):
- `http://localhost:4000` (local dev)
- `http://dashboard.lan` (LAN default)
- Configurable via env var (comma-separated origins)

**Production** (via Caddy):
- Web UI served from `dashboard.lan:/`
- API served from `dashboard.lan:/api/` → automatic same-origin, no browser CORS check needed

**Implementation** (`src/middleware/cors.ts`):
- Checks incoming `Origin` header against allowlist
- Returns `Access-Control-Allow-*` headers only if origin matches
- Preflight requests (OPTIONS) return 200 if origin allowed

---

## Routing & Deployment

### Local Development

Both services run standalone:
- **Web**: http://localhost:4000 (Vite dev server)
- **API**: http://localhost:4001 (Express + tsx watch)

```bash
cd apps
pnpm dev  # Both concurrently
```

CORS allows cross-origin requests between web (4000) and api (4001) for dev convenience.

### Production (Caddy Reverse Proxy)

**Single Host**: `dashboard.lan`

```
Caddy (Reverse Proxy on :80)
├─ GET / → dashboard-web:4000 (web UI)
└─ GET /api/* → dashboard-api:4001 (API, path stripped)
```

**Caddy Config** (`stacks/proxy/Caddyfile`):
```plaintext
{$LINOS_DASHBOARD_HOST}:{$PROXY_HTTP_PORT} {
    # Web UI (root)
    reverse_proxy / 127.0.0.1:{$DASHBOARD_WEB_PORT}

    # API on /api prefix (strip /api from path before proxying)
    handle_path /api/* {
        reverse_proxy 127.0.0.1:{$DASHBOARD_API_PORT}
    }
}
```

**Benefits**:
- Single hostname for users
- Same-origin policy satisfied naturally (no CORS needed in prod)
- Cleaner architecture

---

## Local Testing

### 1. Start API in Dev Mode

```bash
cd apps/dashboard-api
pnpm dev
```

Output:
```
[HH:MM:SS.sss] INFO (PID): Starting dashboard-api
    port: 4001
    env: "development"
    logLevel: "info"
    corsOrigins: "http://localhost:4000,http://dashboard.lan"
[HH:MM:SS.sss] INFO (PID): ✓ Dashboard API listening on http://localhost:4001
```

### 2. Health Check Endpoint

```bash
curl http://localhost:4001/health
```

Response (standardized envelope):
```json
{
  "ok": true,
  "data": {
    "status": "ok"
  }
}
```

✅ Request is NOT logged (clean logs).

### 3. 404 Error Response

```bash
curl http://localhost:4001/nonexistent
```

Response (standardized error envelope):
```json
{
  "ok": false,
  "error": {
    "message": "Not Found",
    "code": "NOT_FOUND"
  }
}
```

✅ Standard error format.

### 4. CORS Preflight (Dev)

```bash
curl -X OPTIONS \
  -H "Origin: http://localhost:4000" \
  -H "Access-Control-Request-Method: GET" \
  http://localhost:4001/health -v 2>&1 | grep -i "access-control"
```

Output:
```
< Access-Control-Allow-Origin: http://localhost:4000
< Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
< Access-Control-Allow-Headers: Content-Type, Authorization
< Access-Control-Max-Age: 86400
```

✅ CORS headers present (dev origin allowed).

### 5. Request Logging (Dev vs Prod)

**Dev (pretty colors):**
```bash
NODE_ENV=development PORT=4001 pnpm dev
curl http://localhost:4001/health
```

Logs (human-readable):
```
[HH:MM:SS.sss] GET /health 200 5ms
```

**Prod (JSON):**
```bash
NODE_ENV=production PORT=4001 pnpm dev
curl http://localhost:4001/health
```

Logs (structured JSON):
```json
{
  "level": 30,
  "msg": "GET /health 200 5ms",
  "req": { "method": "GET", "url": "/health", ... },
  "res": { "statusCode": 200, ... },
  "responseTime": 5,
  "timestamp": "2025-12-18T..."
}
```

✅ Request is excluded from logging for `/health`.

---

## Docker Deployment

### Build & Run

```bash
cd stacks/applications/dashboard
docker compose up --build
```

**Environment** is loaded from `../../.env.linos` (shared linOS config):

```env
# Example .env.linos
DASHBOARD_WEB_PORT=4000
DASHBOARD_API_PORT=4001
LINOS_DASHBOARD_HOST=dashboard.lan
PROXY_HTTP_PORT=80
NODE_ENV=production
LOG_LEVEL=info
```

### Docker Compose Config

**File**: `stacks/applications/dashboard/docker-compose.yml`

```yaml
services:
  dashboard-web:
    build:
      context: ../../..
      dockerfile: apps/dashboard-web/Dockerfile
    restart: unless-stopped
    ports:
      - "${DASHBOARD_WEB_PORT:-4000}:4000"

  dashboard-api:
    build:
      context: ../../..
      dockerfile: apps/dashboard-api/Dockerfile
    env_file:
      - ../../.env.linos
    environment:
      PORT: ${DASHBOARD_API_PORT:-4001}
      NODE_ENV: production
    restart: unless-stopped
    ports:
      - "${DASHBOARD_API_PORT:-4001}:4001"
```

---

## Quality & Testing

### Type Checking

```bash
cd apps
pnpm typecheck
```

### Linting

```bash
cd apps
pnpm lint
```

### Build

```bash
cd apps
pnpm build
```

---

## Future Integration Points

The API is designed to integrate with:

- **Home Assistant** (REST API or WebSocket)
- **MQTT** (Mosquitto topics for Zigbee, climate, lights)
- **Node-RED** (webhooks & flows)
- **Zigbee2MQTT** (device discovery via MQTT)

Services will be added to `src/services/` as needed:

```typescript
// Example (not yet implemented)
// src/services/home-assistant.ts
export class HomeAssistantService {
  async getRooms() { /* ... */ }
  async getEntities() { /* ... */ }
}

// src/services/mqtt.ts
export class MqttService {
  subscribe(topic: string, callback: (msg: string) => void) { /* ... */ }
}
```

---

## Checklist: What's Ready

- ✅ Express + TypeScript base
- ✅ Pino logging (dev: pretty, prod: JSON)
- ✅ Zod env validation
- ✅ Standardized response envelope
- ✅ Error handling (global + 404)
- ✅ Security headers (nosniff, referrer-policy, SAMEORIGIN)
- ✅ CORS (dev-friendly, LAN-first)
- ✅ /health endpoint (excluded from logging)
- ✅ Optional JSON config loader
- ✅ Folder structure for routes/services/config

## Checklist: Future Work

- [ ] Home Assistant integration endpoints
- [ ] MQTT topics listener
- [ ] WebSocket for real-time updates
- [ ] Authentication / authorization layer
- [ ] More error codes + status mapping
- [ ] Rate limiting (if needed)
- [ ] Request validation middleware (Zod schemas for each endpoint)
- [ ] Database layer (if needed)


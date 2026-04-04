# Dashboard API – Backend Architecture

## Overview

The dashboard API (`apps/dashboard-api`) is the Backend-for-Frontend (BFF) that powers the linOS dashboard web interface. It's built with **Express + TypeScript** and designed for production deployment with structured logging, configuration management, and error handling.

### Tech Stack
- **Framework**: Express 5 (HTTP server)
- **Language**: TypeScript (strict mode)
- **Logging**: Pino + pino-http (structured JSON logs in production)
- **Validation**: Zod (environment variables, request bodies, config files)
- **Real-time**: WebSocket (`ws`) for timer state broadcasts
- **Port**: Configured via `process.env.PORT` (default: 4001)

---

## Architecture

### Folder Structure

```
apps/dashboard-api/
├── src/
│   ├── index.ts              # Bootloader: env → config → app → listen → timer
│   ├── app.ts                # createApp(): Express setup, middleware wiring
│   ├── timer-setup.ts        # Timer feature initialization (routes + WS + HA lights)
│   ├── config/
│   │   ├── env.ts            # Zod schema for environment validation
│   │   ├── light-notification-env.ts  # HA light notification env (URL, token, entities)
│   │   └── app-config.ts     # JSON config loaders (app, services, dashboard)
│   ├── middleware/
│   │   ├── headers.ts        # Security headers (nosniff, referrer-policy, frame-options)
│   │   ├── cors.ts           # CORS middleware (dev-friendly, LAN-first)
│   │   └── errors.ts         # Global error handler + 404 handler + AppError class
│   ├── routes/
│   │   ├── index.ts          # Main router aggregator
│   │   ├── health.ts         # GET /health
│   │   ├── system.ts         # GET /system/info, /system/vitals, /system/containers
│   │   ├── services.ts       # GET /services/status
│   │   ├── dashboard.ts      # GET /dashboard/config
│   │   ├── timer.ts          # GET /timer/state, POST /timer/start, POST /timer/stop
│   │   ├── vacuum-routines.ts # Vacuum routine management
│   │   └── admin.ts          # Admin endpoints
│   ├── ws/
│   │   ├── timer-ws.ts       # WebSocket server for real-time timer broadcasts
│   │   └── vacuum-routine-ws.ts # WebSocket for vacuum routine broadcasts
│   └── services/
│       ├── index.ts           # Service aggregator
│       ├── timer.ts           # TimerService: in-memory timer + optional HA light feedback
│       ├── vacuum-routine.ts  # Vacuum routine management
│       └── light-notification.ts # HA light notification integration
├── .env.example              # Example environment variables
├── dist/                     # Compiled JS (production output)
├── Dockerfile                # Multistage build
├── package.json
├── tsconfig.json
└── eslint.config.js
```

---

## Startup Sequence

1. Load and validate environment variables (Zod)
2. Load optional app config (`CONFIG_PATH`)
3. Load services monitoring config (`SERVICES_CONFIG_PATH` or `config/services.json`)
4. Load dashboard entity config (`DASHBOARD_CONFIG_PATH` or `config/dashboard.json`)
5. Create Express app with middleware
6. Start HTTP server
7. Initialize timer feature (REST routes + WebSocket + optional HA light integration)
8. Register 404 + error handlers (must be last)

---

## Key Concepts

### 1. Response Envelope

All API responses follow a standardized envelope format:

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

TypeScript type:
```typescript
interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { message: string; code?: string };
}
```

### 2. Rate Limiting

All endpoints are rate-limited at **300 requests per minute** per client. This is intentionally generous for a local LAN dashboard.

---

## Endpoints

### Health

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness probe for Caddy / monitoring / container orchestration |

**Response:**
```json
{ "ok": true, "data": { "status": "ok" } }
```

Excluded from request logging to reduce noise.

---

### System

| Method | Path | Cache TTL | Purpose |
|--------|------|-----------|---------|
| GET | `/system/info` | 10s | Full host metrics (OS, CPU, memory, disk) |
| GET | `/system/vitals` | 3s | Quick CPU + memory snapshot |
| GET | `/system/containers` | 10s | Docker container listing |

#### GET `/system/info`

Returns host-level metrics from Node.js `os` module and `df -B1 /`.

```json
{
  "ok": true,
  "data": {
    "hostname": "manny",
    "uptimeSeconds": 123456,
    "platform": "Linux 6.18.5",
    "arch": "x64",
    "cpuLoadPercent": 12.5,
    "totalMemoryBytes": 8589934592,
    "freeMemoryBytes": 4294967296,
    "diskTotalBytes": 500107862016,
    "diskUsedBytes": 125026965504
  }
}
```

#### GET `/system/vitals`

Lightweight endpoint for frequent polling (CPU + memory only).

```json
{
  "ok": true,
  "data": {
    "cpuLoadPercent": 12.5,
    "memoryUsedPercent": 50.0
  }
}
```

#### GET `/system/containers`

Lists Docker containers via the Docker Engine API (Unix socket `/var/run/docker.sock`).

**Success (Docker available):**
```json
{
  "ok": true,
  "data": {
    "available": true,
    "containers": [
      {
        "id": "abc123def456",
        "name": "dashboard-web",
        "image": "linboard-web:latest",
        "status": "Up 2 hours",
        "state": "running"
      }
    ],
    "unavailableReason": null,
    "unavailableCode": null
  }
}
```

**Degraded (Docker unavailable):**
```json
{
  "ok": true,
  "data": {
    "available": false,
    "containers": [],
    "unavailableReason": "Docker socket not found at /var/run/docker.sock",
    "unavailableCode": "SOCKET_NOT_FOUND"
  }
}
```

Unavailable codes: `SOCKET_NOT_FOUND`, `PERMISSION_DENIED`, `DAEMON_NOT_RUNNING`, `UNKNOWN_ERROR`.

---

### Services

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/services/status` | Probe all configured services in parallel |

Returns health status for each service defined in `config/services.json`.

**Probe methods:**
- **HTTP**: GET request to `healthUrl`, 3000ms timeout, any response < 400 is "ok"
- **TCP**: Socket connect to `healthHost:healthPort`, 3000ms timeout
- **None configured**: Returns status "unknown"

All probes run concurrently via `Promise.allSettled()`.

```json
{
  "ok": true,
  "data": [
    {
      "id": "home-assistant",
      "label": "Home Assistant",
      "category": "smart-home",
      "status": "ok",
      "latencyMs": 45
    },
    {
      "id": "mosquitto",
      "label": "Mosquitto MQTT",
      "category": "infrastructure",
      "status": "error",
      "latencyMs": 3000
    }
  ]
}
```

Status values: `"ok"` | `"error"` | `"unknown"`.

---

### Dashboard Configuration

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/dashboard/config` | Room/entity layout, Roborock settings, quick toggles, light presets |

Returns the dashboard entity configuration loaded from `config/dashboard.json`.

```json
{
  "ok": true,
  "data": {
    "rooms": [
      {
        "id": "living-room",
        "name": "Living Room",
        "icon": "mdiSofa",
        "entities": ["light.living_room", "climate.living_room"],
        "airQuality": {
          "temperature": "sensor.living_room_temp",
          "humidity": "sensor.living_room_humidity",
          "secondary": ["sensor.living_room_co2"]
        }
      }
    ],
    "roborock": {
      "entityId": "vacuum.roborock",
      "segments": [
        { "id": 1, "roomId": "living-room", "defaultSelected": true }
      ],
      "defaultFanPower": 102,
      "defaultWaterBoxMode": 203,
      "defaultCleaningMode": "vacuum_and_mop"
    },
    "quickToggles": {
      "globalEntity": "input_boolean.guest_mode",
      "modes": ["home", "away"],
      "rooms": [
        { "roomId": "living-room", "entity": "light.living_room" }
      ]
    },
    "lightColorPresets": [
      {
        "id": "warm",
        "label": "Warm White",
        "displayColor": "#ffd700",
        "colorTemp": 370
      },
      {
        "id": "blue",
        "label": "Ocean",
        "displayColor": "#0077be",
        "hsColor": [210, 80]
      }
    ]
  }
}
```

Falls back to `{ rooms: [] }` if the config file is missing or invalid.

---

### Timer

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/timer/state` | Current timer state |
| POST | `/timer/start` | Start a new timer |
| POST | `/timer/stop` | Stop running timer |
| WS | `/ws/timer` | Real-time timer state broadcasts |

The timer is an **in-memory single timer** — intentionally lost on server restart (no persistence).

#### GET `/timer/state`

```json
{
  "ok": true,
  "data": {
    "running": false,
    "startedAt": null,
    "durationMs": 0,
    "label": ""
  }
}
```

#### POST `/timer/start`

**Request body (Zod-validated):**
```json
{
  "durationMs": 300000,
  "label": "Cooking timer"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `durationMs` | number | yes | Positive integer, max 86,400,000 (24h) |
| `label` | string | no | Max 100 characters |

**Response** (HTTP 201):
```json
{
  "ok": true,
  "data": {
    "running": true,
    "startedAt": 1711123200000,
    "durationMs": 300000,
    "label": "Cooking timer"
  }
}
```

Automatically stops any previously running timer before starting a new one.

#### POST `/timer/stop`

```json
{
  "ok": true,
  "data": {
    "running": false,
    "startedAt": null,
    "durationMs": 0,
    "label": ""
  }
}
```

No-op if no timer is running.

#### WebSocket `/ws/timer`

- **On connect**: Sends current `TimerState` immediately
- **On state change**: Broadcasts new `TimerState` to all connected clients
- **Message format**: JSON-encoded `TimerState`

#### HA Light Feedback (Optional)

When `LINOS_HA_URL`, `LINOS_HA_TOKEN`, and `LINOS_TIMER_LIGHT_ENTITIES` are configured:

- Updates configured lights every 10 seconds with progress-based RGB color
- Color gradient: Green (100%) → Yellow (50%) → Red (0%)
- Brightness: 255 (full)
- On completion: Blinks red 3x (500ms on/off cycle)

---

## Middleware

### Security Headers (`src/middleware/headers.ts`)

| Header | Value | Rationale |
|--------|-------|-----------|
| `X-Powered-By` | (removed) | Don't leak tech stack |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME type confusion attacks |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Privacy: share origin only for same-origin |
| `X-Frame-Options` | `SAMEORIGIN` | Allow same-origin embeds (LAN kiosks); block external |

### CORS (`src/middleware/cors.ts`)

**Intent**: CORS is primarily for **development** (Vite on localhost:4000). In production, same-origin is enforced by Caddy routing (API under `/api` prefix on same host).

**Allowlist** (via `CORS_ALLOW_ORIGINS`):
- `http://localhost:4000` (local dev)
- `http://dashboard.lan` (LAN default)
- Configurable via env var (comma-separated origins)

**Preflight**: OPTIONS returns 200 with allow headers. Max-age: 86400 (24h).

### Error Handling (`src/middleware/errors.ts`)

- **Global error handler**: Catches `unknown`, does `instanceof` checks, logs with Pino, returns JSON envelope
- **404 handler**: Returns `{ ok: false, error: { message: "Not Found", code: "NOT_FOUND" } }`
- **AppError class**: `new AppError(message, statusCode = 500, code = "INTERNAL_ERROR")`

---

## Caching Strategy

| Endpoint | Cache TTL | Reason |
|----------|-----------|--------|
| `/system/info` | 10s | Avoids spawning `df` subprocess on every poll |
| `/system/vitals` | 3s | Faster refresh for real-time CPU/mem display |
| `/system/containers` | 10s | Docker API calls are expensive; frontend polls every 30s |

All other endpoints (`/health`, `/services/status`, `/dashboard/config`, `/timer/*`) are uncached.

---

## Environment Configuration

### Core Variables (`src/config/env.ts`)

| Variable | Type | Default | Purpose |
|----------|------|---------|---------|
| `NODE_ENV` | `development \| production` | `development` | Affects logging format, error verbosity |
| `PORT` | number | `4001` | API server port |
| `LOG_LEVEL` | `fatal\|error\|warn\|info\|debug\|trace` | `info` | Pino log level |
| `CORS_ALLOW_ORIGINS` | string (CSV) | `http://localhost:4000,http://dashboard.lan` | CORS allowlist |
| `LINOS_DASHBOARD_HOST` | string | `dashboard.lan` | Dashboard hostname |
| `CONFIG_PATH` | string (optional) | — | Path to optional app JSON config |
| `SERVICES_CONFIG_PATH` | string (optional) | — | Path to services monitoring config |
| `DASHBOARD_CONFIG_PATH` | string (optional) | — | Path to dashboard entity config |

### Light Notification Variables (`src/config/light-notification-env.ts`)

| Variable | Type | Purpose |
|----------|------|---------|
| `LINOS_HA_URL` | string (URL, optional) | Home Assistant base URL for light feedback |
| `LINOS_HA_TOKEN` | string (optional) | HA long-lived access token |
| `LINOS_NOTIFICATION_LIGHT_ENTITIES` | string (CSV, optional) | Light entity IDs for timer/notification feedback |

All light notification env vars are optional — timer and vacuum features work without HA integration.

### Configuration Files

| File | Default Path | Purpose |
|------|-------------|---------|
| App config | `CONFIG_PATH` | Rooms, favorites, actions (stub for future use) |
| Services config | `config/services.json` | Health-check definitions for all services |
| Dashboard config | `config/dashboard.json` | Room/entity layout, Roborock, quick toggles, light presets |

All config files are optional. Missing or invalid files log a warning and fall back to sensible defaults.

---

## Logging

Uses **Pino** with environment-aware configuration:

| Environment | Output | Format | Purpose |
|-------------|--------|--------|---------|
| `development` | stdout | Pretty-printed + colors | Human-readable in dev |
| `production` | stdout | JSON (structured) | Machine-parseable for log aggregation |

**Request logs** include timing, method, status, and headers. `/health` is excluded to reduce noise.

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

CORS allows cross-origin requests between web (4000) and API (4001) for dev convenience.

### Production (Caddy Reverse Proxy)

**Single Host**: `dashboard.lan`

```
Caddy (Reverse Proxy on :80)
├─ GET / → dashboard-web:4000 (web UI)
└─ GET /api/* → dashboard-api:4001 (API, path stripped)
```

Same-origin policy is satisfied naturally — no CORS needed in production.

---

## Data Flow

```
Frontend (React)
  ├─→ GET  /system/info           → SystemInfo (cached 10s)
  ├─→ GET  /system/vitals         → SystemVitals (cached 3s)
  ├─→ GET  /system/containers     → ContainersData (cached 10s)
  ├─→ GET  /services/status       → ServiceStatus[] (live probes)
  ├─→ GET  /dashboard/config      → DashboardConfig (live)
  ├─→ GET  /timer/state           → TimerState (live)
  ├─→ POST /timer/start           → TimerState (HTTP 201)
  ├─→ POST /timer/stop            → TimerState (live)
  └─→ WS   /ws/timer              → TimerState (real-time)

Dashboard API (Express on port 4001)
  ├─→ Docker Engine API (/var/run/docker.sock)
  ├─→ OS: os.cpus(), os.uptime(), os.freemem()
  ├─→ Disk: df -B1 /
  ├─→ Service probes (HTTP GET or TCP connect)
  └─→ Home Assistant REST API (optional, timer light feedback only)
```

---

## Docker Deployment

### Build & Run

```bash
cd stacks/applications/dashboard
docker compose up --build -d
```

**Environment** is loaded from `../../.env.linos` (copy from `.env.linos.example`).

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
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:4000"]
      interval: 30s
      timeout: 10s
      retries: 3

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
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:4001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## Quality & Testing

```bash
cd apps
pnpm typecheck    # tsc --noEmit
pnpm lint         # ESLint
pnpm build        # Production build
```

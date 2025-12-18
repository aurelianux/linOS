# linOS: AI Coding Agent Instructions

## Project Overview

**linOS** is a modular Smart Home / Homelab infrastructure combining multiple Docker services on a Linux host ("Manny"). The codebase has two distinct layers:

1. **Docker Stacks** (`stacks/`): Infrastructure & deployment using Docker Compose
2. **Dashboard Application** (`apps/`): Modern full-stack dashboard for system management

## Architecture & Data Flow

### Core Infrastructure (Stacks)

```
Caddy (proxy)
  ↓
┌─────────────────────────────────────┐
│ MQTT (Mosquitto) – Message Hub      │
│ ├─ Zigbee2MQTT (USB Coordinator)    │
│ ├─ Home Assistant (MQTT integration) │
│ ├─ Node-RED (Flows & Automations)   │
│ └─ Custom IoT Devices               │
└─────────────────────────────────────┘
  ↓
┌──────────────────────────────┐
│ Downstream Services          │
│ ├─ Home Assistant UI         │
│ ├─ AdGuard Home (DNS/Filter) │
│ └─ Plane (Project Mgmt)      │
└──────────────────────────────┘
```

**Key Points:**
- MQTT (Mosquitto) is the central message bus
- Zigbee2MQTT bridges USB Zigbee coordinator → MQTT topics
- Home Assistant consumes MQTT entities and orchestrates automations
- Caddy routes external traffic to all web UIs
- All persistent data lives in `stacks/{service}/data/` and `config/` (not in Git)

### Dashboard Application (Monorepo)

**Location:** `apps/`  
**Manager:** pnpm workspaces  
**Services:**
- `dashboard-web`: React 19 + TypeScript + Vite (port 4000)
- `dashboard-api`: Express + TypeScript (port 4001)

**Frontend Stack:**
- Vite (using Rolldown) for fast HMR
- react-router-dom for navigation
- Tailwind CSS (implied by stubs, see `DECISIONS.md`)
- ESLint 9 + TypeScript 5.9

**Backend Stack:**
- Express 5.2
- Zod for validation
- Pino for structured logging with HTTP middleware
- PORT env var controls API port (default 4001)

## Developer Workflows

### Local Development (Dashboard)

```bash
cd apps
pnpm install
pnpm dev              # Starts web (4000) + api (4001) concurrently
```

**Individual commands:**
- `pnpm -C dashboard-web dev` – Vite dev server
- `pnpm -C dashboard-api dev` – tsx watch (NODE_ENV defaults to dev, pino-pretty colors)

### Quality Checks

```bash
pnpm lint              # ESLint all packages
pnpm typecheck         # tsc --noEmit (dashboard-web uses strict config)
pnpm format            # Prettier write
pnpm build             # Build both packages (outputs to dist/)
```

### Docker Deployment

Dashboard services deploy via:
- **Context:** Repo root (uses monorepo structure)
- **Compose:** `stacks/applications/dashboard/docker-compose.yml`
- **Environment:** `.env` file with `DASHBOARD_API_PORT` variable
- **Dockerfile location:** `apps/dashboard-{web,api}/Dockerfile`

To test locally:
```bash
cd stacks/applications/dashboard
docker compose up --build
```

## Project-Specific Conventions

### Logging & Debugging

- **Backend:** Pino with HTTP middleware logs all requests/responses; in dev use pino-pretty, in production disable transport
- **Frontend:** Standard console in Vite dev mode (HMR shows errors)

### API Design

- Health check endpoint: `GET /health` (returns `{"status":"ok"}`)
- Future routes should follow RESTful conventions
- Validate all inputs with Zod schema validation

### Monorepo Scripts Pattern

Commands at `apps/` root run across all workspaces:
- `pnpm dev` → concurrently spawns all dev servers
- `pnpm -C <package>` → target specific package (e.g., `pnpm -C dashboard-api lint`)
- Package-specific scripts must exist in each `package.json`

### TypeScript Configuration

- **Web:** Loose config (`tsconfig.json`) with separate `tsconfig.node.json` for build tools
- **API:** Standard Node.js config with strict module resolution
- Both use TypeScript 5.9 and typescript-eslint 8.50

### ESLint Configuration

- Uses flat config format (no `.eslintrc`)
- Config files: `eslint.config.js` in each package
- Rules include React hooks, React refresh (web), and standard TS linting

### Vite-Specific

- Rolldown is used instead of standard Vite for faster builds
- Override in `pnpm` section of `dashboard-web/package.json`
- Dev server runs on all interfaces (`host: true`) for container access
- Strict port enforcement (`strictPort: true`)

## External Integrations & Service Boundaries

### MQTT Topics (From Zigbee2MQTT & Home Assistant)

- AI agents building new dashboard features may need to query/subscribe to MQTT for real-time data
- Topic format: typically `zigbee2mqtt/{device}` or `homeassistant/{entity}`
- Integrations typically done via Node-RED flows or Home Assistant REST API

### Caddy Reverse Proxy

- Routes external requests to internal services
- Configuration: `stacks/proxy/Caddyfile`
- All web UIs (dashboard, plane, home assistant, etc.) go through Caddy
- Environment: Reads from `../../.env.linos`

### Environment & Secrets

- Dashboard uses `.env` file in `stacks/applications/dashboard/`
- Set `DASHBOARD_API_PORT` for API port (defaults to 4001 in code)
- Host timezone via `TZ` env var (default: Europe/Berlin)

## Critical Files for Reference

| Path | Purpose |
|------|---------|
| [docs/overview.md](../docs/overview.md) | Architecture & data flow diagram |
| [docs/dashboard/DECISIONS.md](../docs/dashboard/DECISIONS.md) | Tech stack rationale |
| [README.md](../README.md) | Setup & service startup order |
| [apps/package.json](../apps/package.json) | Monorepo scripts & concurrency |
| [stacks/infra/docker-compose.yml](../stacks/infra/docker-compose.yml) | MQTT, Node-RED, core services |
| [apps/dashboard-api/src/index.ts](../apps/dashboard-api/src/index.ts) | Express bootstrap & logging example |

## Common Pitfalls & Tips

1. **Port conflicts:** Web (4000) and API (4001) must be free during local dev; Vite enforces strict ports
2. **PNPM workspaces:** Use `pnpm` not `npm`; lockfile is checked and immutable (`--frozen-lockfile`)
3. **TypeScript paths:** Each package has its own `tsconfig.json`; no global path aliases across packages
4. **Dockerfiles:** Multistage builds with Alpine; ensure `pnpm install --frozen-lockfile` always used
5. **Env vars:** Caddy reads `../../.env.linos`, dashboard services read `.env` in their compose dir – keep them separate
6. **Persistence:** All runtime data excluded via `.gitignore`; never commit logs, databases, or ACME certs

## When Adding New Features

- **New API endpoints:** Add Express route with Zod validation + Pino logging
- **New React components:** Follow existing routing in `main.tsx`; use react-router-dom
- **New services to stack:** Add docker-compose.yml in `stacks/{service}/` with proper volume mounts
- **Monorepo changes:** Update both root `apps/package.json` and individual package.json scripts
- **Environment variables:** Document in `stacks/applications/dashboard/.env.example` (if created)

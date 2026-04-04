# linBoard – Project Context

## What is linBoard?

linBoard is the central dashboard for **linOS** — a minimalist, Linux-centered homelab OS on a Dell Wyse 5070 ("Manny", Arch Linux). Single pane of glass for smart home, system monitoring, and quick actions.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS (slate palette), shadcn/ui |
| HA Integration | @hakit/core v6 (WebSocket, real-time hooks) |
| Icons | @mdi/react + @mdi/js (MDI, HA-compatible) |
| State | Zustand v5 (client state: layout, favorites, prefs) |
| Backend | Express 5, Zod, Pino |
| Real-time | WebSocket (`ws`) for timer and vacuum routine broadcasts |
| Package Manager | pnpm (workspaces) |

## Architecture

```
Browser → @hakit/core WebSocket → Home Assistant (real-time state + control)
Browser → Vite dev proxy /api   → Express BFF → system monitoring, config, timer
```

- **@hakit/core** is the only data layer for HA. No REST polling, no BFF proxy for HA.
- **BFF** only for: health check (`GET /health`), stack status monitoring (`GET /services/status`), system info, Docker containers, dashboard config, timer, vacuum routines.
- **Graceful degradation**: dashboard starts without HA connection. `HaProvider` renders children without provider when env vars are missing.
- **Security**: HA long-lived access token in frontend is acceptable (dashboard is LAN/Tailscale VPN only).

## Repo Structure

```
├── apps/
│   ├── dashboard-api/          # Express BFF
│   │   └── src/
│   │       ├── config/         # Zod env + services.json + dashboard.json loader
│   │       ├── routes/         # health, services, system, dashboard, timer, vacuum-routines, admin
│   │       ├── services/       # timer, vacuum-routine, light-notification
│   │       ├── ws/             # timer-ws, vacuum-routine-ws
│   │       └── middleware/     # cors, headers, errors
│   └── dashboard-web/          # React Frontend
│       └── src/
│           ├── components/
│           │   ├── common/     # CardErrorBoundary, Panel, LoadingState, ErrorState, InlineError, StatusBadge
│           │   ├── ha/         # LightCard, ClimateCard, SwitchCard, SensorCard, AirQualitySensorCard,
│           │   │               # GenericEntityCard, CompactRoomCard, QuickToggle, VacuumRoutineCard, EntityIcon
│           │   ├── layout/     # AppShell, Header, SidebarNav, BottomNav, SystemMetricBadge, TimerHeaderBadge
│           │   ├── panels/     # SystemInfoPanel, UnifiedInfraPanel, RoborockQuickPanel, TimerCard, VacuumRoutinePanel
│           │   └── ui/         # shadcn/ui base (card, button, badge, switch, slider, icon, bottom-sheet, etc.)
│           ├── hooks/          # usePolledData factory, useSystemInfo, useSystemVitals, useDockerContainers,
│           │                   # useDashboardConfig, useLightGesture, useMetricHistory, useOptimisticAction,
│           │                   # useTimerSocket, useVacuumRoutineSocket, useIsMobile, useScrollSuppression
│           ├── lib/
│           │   ├── api/        # fetchJson client, endpoints, types
│           │   ├── ha/         # icons.ts, dashboardIcons.ts, config.ts, provider.tsx
│           │   └── i18n/       # translations.ts (DE/EN), useTranslation.ts
│           ├── pages/          # SmarthomePage, AdminPage
│           └── stores/         # languageStore, favoritesStore, layoutStore, panelStore, useVacuumRoutineStore
├── config/
│   ├── services.json           # Stack health monitoring config
│   └── dashboard.json          # Room/entity layout, Roborock, quick toggles, light presets
├── stacks/                     # Docker Compose infrastructure
├── scripts/                    # smrestart, smstatus, update_index.py
├── PROMPT.md                   # This document (project context)
└── CLAUDE.md                   # Claude Code — coding standards and patterns
```

## Design System

### Colors (dark-first, slate only)

| Role | Tailwind |
|---|---|
| App background | `slate-950` |
| Cards | `slate-900` |
| Borders | `slate-800` |
| Primary text | `slate-100` |
| Secondary text | `slate-400` |
| Tertiary text | `slate-500` |

### Accent Colors

| Meaning | Tailwind |
|---|---|
| Active / on | `amber-400` |
| Error | `red-400` |
| Success | `emerald-400` |
| Info | `sky-400` |

### Rules

- Tailwind utility classes only — no inline `style={}`, no CSS modules
- Animations via CSS transitions — no framer-motion
- Icons from `@mdi/js` via `haIconToMdiPath()` — never emojis, never Lucide

## Environment Variables

### Frontend (`apps/dashboard-web/.env`)

| Variable | Example |
|---|---|
| `VITE_API_BASE` | `/api` |
| `VITE_HA_URL` | `http://<LINOS_HOST_IP>:8123` |
| `VITE_HA_TOKEN` | `eyJ...` |

### Backend (`apps/dashboard-api/.env`)

| Variable | Default |
|---|---|
| `NODE_ENV` | `development` |
| `PORT` | `4001` |
| `LOG_LEVEL` | `info` |
| `CORS_ALLOW_ORIGINS` | `http://localhost:4000,http://dashboard.lan` |
| `LINOS_DASHBOARD_HOST` | `dashboard.lan` |
| `SERVICES_CONFIG_PATH` | `config/services.json` (optional) |
| `DASHBOARD_CONFIG_PATH` | `config/dashboard.json` (optional) |
| `LINOS_HA_URL` | (optional — for timer light feedback) |
| `LINOS_HA_TOKEN` | (optional — for timer light feedback) |
| `LINOS_NOTIFICATION_LIGHT_ENTITIES` | (optional — comma-separated light entity IDs) |

## Roadmap

### Phase 1 — Foundation (completed)

Monorepo, Express BFF, React with routing/layout, TypeScript/ESLint/Tailwind, Storybook, MDI icons, Zustand stores, CardErrorBoundary, path aliases, @hakit/core with HaProvider + ConnectionStatus, config-driven stack status monitoring.

### Phase 2 — Smart Home Cards (completed)

- LightCard — gesture-based brightness control, amber glow when on
- ClimateCard — temperature presets and mode selector
- SwitchCard — toggle for switch/input_boolean/fan/automation domains
- SensorCard — read-only value + unit + icon
- AirQualitySensorCard — PM2.5, VOC, temperature, humidity
- GenericEntityCard — fallback for unmapped domains
- CompactRoomCard — per-room entity grid
- QuickToggle / QuickAccessPanel — quick-toggle buttons
- VacuumRoutineCard — Roborock vacuum quick controls

### Phase 3 — Dashboard Grid (planned)

react-grid-layout, drag & drop, layout persistence, widget configurator, breakpoint layouts.

### Phase 4 — System Monitoring (completed)

SystemInfoPanel (CPU, RAM, disk, uptime via BFF), UnifiedInfraPanel (Docker containers + service health), TimerCard (in-memory timer with WebSocket + optional HA light feedback), VacuumRoutinePanel.

### Phase 5 — Rooms & Areas (planned)

useAreas() for HA-based room grouping, room cards with entity lists, room-specific quick controls.

## Coding Standards (Summary)

- TypeScript strict — no `any`
- @hakit/core hooks for all HA data
- MDI icons via `haIconToMdiPath()` with named imports from `@mdi/js`
- Zustand for client state (layout, favorites)
- CardErrorBoundary around every HA card
- Graceful handling of `unavailable`/`unknown` entity states
- All user-visible strings via `t()` from `useTranslation()`
- Conventional Commits in English
- Full standards and code patterns: see `CLAUDE.md`

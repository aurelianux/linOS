# linBoard Frontend

React + TypeScript + Vite + Tailwind CSS smart-home dashboard with Home Assistant integration via `@hakit/core` WebSocket hooks.

---

## Quick Start

```bash
# From repository root
cd apps

# Install dependencies
pnpm install

# Start frontend :4000 + API :4001 concurrently
pnpm dev

# Or start individually:
pnpm -C dashboard-web dev    # Vite on :4000
pnpm -C dashboard-api dev    # Express on :4001
```

### URLs

| Service | URL | Notes |
|---------|-----|-------|
| **Web** | http://localhost:4000 | Vite dev server, HMR enabled |
| **API** | http://localhost:4001 | Express backend |
| **Storybook** | http://localhost:6006 | Component library |

---

## Architecture

### Pages

- `/` — **Overview**: quick toggles, room cards with entity controls, system panels (Docker, system info, Roborock vacuum)
- `/rooms` — **Rooms**: per-room entity cards driven by `config/dashboard.json`
- `/panels` — **Panels**: system monitoring and management panels

### Layout

**Desktop (>=768px):**
- Fixed sidebar nav on left
- Main content on right
- Header with system vitals (CPU, RAM) spans full width

**Mobile (<768px):**
- Header at top with system metric badges
- Full-width content
- Bottom nav bar (touch-friendly, >=48px height)

### Data Flow

- **HA entity state** → `@hakit/core` WebSocket hooks (`useEntity`) — never custom REST/WS
- **System/Docker data** → `dashboard-api` REST → `lib/api/client.ts` with polling hooks
- **UI state** (layout, favorites, language) → Zustand stores with `persist`

### Dark Mode

- Always dark — slate-950 background, slate-100 text
- Configured via Tailwind CSS class-based dark mode

---

## Folder Structure

```
src/
├── components/
│   ├── common/               # Shared UI: CardErrorBoundary, Panel, LoadingState,
│   │                         #   ErrorState, EmptyState, InlineError, StatusBadge,
│   │                         #   PageErrorBoundary, ServiceStatusCard
│   ├── ha/                   # HA entity cards
│   │   ├── LightCard.tsx         # Gesture-based light control (tap, drag, press)
│   │   ├── ClimateCard.tsx       # Temperature display, mode selector, presets
│   │   ├── SwitchCard.tsx        # On/off toggle card
│   │   ├── SensorCard.tsx        # Sensor value display
│   │   ├── AirQualitySensorCard.tsx  # Air quality readings
│   │   ├── GenericEntityCard.tsx # Fallback for unmapped domains
│   │   ├── QuickToggle.tsx       # Compact toggle button
│   │   ├── QuickToggleBar.tsx    # Row of quick toggles
│   │   ├── DashboardRoomCard.tsx # Room card with entity list
│   │   ├── RoomCard.tsx          # Room navigation card
│   │   ├── EntityIcon.tsx        # Entity icon resolver
│   │   ├── HaStatusCard.tsx      # HA connection status
│   │   ├── HaStatusIndicator.tsx # Compact status indicator
│   │   ├── ConnectionStatus.tsx  # Connection state display
│   │   └── domainCards.ts        # Domain → card component registry
│   ├── layout/               # App shell and navigation
│   │   ├── AppShell.tsx          # Main shell (header, nav, content)
│   │   ├── Header.tsx            # Top bar with system vitals
│   │   ├── SidebarNav.tsx        # Desktop sidebar
│   │   ├── BottomNav.tsx         # Mobile bottom nav
│   │   └── SystemMetricBadge.tsx # CPU/RAM badge in header
│   ├── panels/               # System and device panels
│   │   ├── DockerPanel.tsx       # Container status and management
│   │   ├── SystemInfoPanel.tsx   # Host system metrics
│   │   └── RoborockQuickPanel.tsx # Vacuum control (fan speed, mop, rooms)
│   └── ui/                   # shadcn/ui base components
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── icon.tsx              # Custom Icon component (React 19 compatible)
│       ├── slider.tsx
│       └── switch.tsx
├── hooks/
│   ├── usePolledData.ts          # createPollingHook<T>() factory
│   ├── useSystemInfo.ts          # System info polling
│   ├── useSystemVitals.ts        # CPU/RAM vitals polling
│   ├── useDockerContainers.ts    # Docker container polling
│   ├── useServiceStatuses.ts     # Service health polling
│   ├── useDashboardConfig.ts     # Dashboard config polling
│   ├── useLightGesture.ts        # Light card gesture handling
│   ├── useMetricHistory.ts       # Metric history tracking
│   └── useOptimisticAction.ts    # Optimistic UI updates
├── lib/
│   ├── api/
│   │   ├── client.ts             # fetchJson + ApiErrorException
│   │   ├── endpoints.ts          # API endpoint constants
│   │   └── types.ts              # API response types
│   ├── ha/
│   │   ├── config.ts             # HA entity/room configuration
│   │   ├── dashboardIcons.ts     # Dashboard icon mapping
│   │   ├── icons.ts              # haIconToMdiPath() resolver
│   │   └── provider.tsx          # HAProvider wrapper
│   ├── i18n/
│   │   ├── translations.ts       # EN/DE string dictionary
│   │   └── useTranslation.ts     # useTranslation() hook
│   └── utils.ts                  # cn() (clsx + tailwind-merge)
├── pages/
│   ├── OverviewPage.tsx          # Dashboard homepage
│   ├── RoomsPage.tsx             # Room-based entity view
│   └── PanelsPage.tsx            # System panels
├── stores/
│   ├── favoritesStore.ts         # Favorite entities (Zustand + persist)
│   ├── languageStore.ts          # Language preference (EN/DE)
│   └── layoutStore.ts            # Layout state (Zustand + persist)
├── main.tsx                      # App entry point
└── index.css                     # Global Tailwind styles
```

---

## Key Patterns

### HA Entity Cards

All HA cards use `useEntity(id, { returnNullIfNotFound: true })` and handle `null`/`unavailable`/`unknown` states gracefully. Service calls are wrapped in `try/catch`. Cards are wrapped in `<CardErrorBoundary>`.

The `domainCards.ts` registry maps HA domains to their card components, with `GenericEntityCard` as the fallback.

### Polling Hooks

All API polling uses the `createPollingHook<T>()` factory from `hooks/usePolledData.ts` — one line per endpoint, no duplication.

### Light Card Gestures

`LightCard` supports gesture-based control via the `useLightGesture` hook:
- **Tap** to toggle on/off
- **Horizontal drag** to adjust brightness
- **Long press** for color temperature presets

### i18n

All user-visible strings go through the `useTranslation()` hook with EN/DE support. Translations are defined in `lib/i18n/translations.ts`.

### Icons

All icons use named imports from `@mdi/js` rendered via the custom `Icon` component (React 19 compatible replacement for `@mdi/react`). HA icon strings are resolved via `haIconToMdiPath()`.

---

## Component Conventions

### Naming

- **Components:** PascalCase (`LightCard.tsx`, `ErrorState.tsx`)
- **Props interfaces:** `<ComponentName>Props`
- **Hooks:** camelCase prefixed with `use` (e.g., `useLightGesture`)

### Styling

- Tailwind utility classes only — no `style={}`, no CSS modules
- Use `cn()` for conditional classes — never array `.filter(Boolean).join(" ")`
- Dark-first, slate palette only (see CLAUDE.md for full color system)

---

## API Integration

### Base URL

- **Dev:** `/api` (proxied to `http://localhost:4001` via Vite)
- **Prod:** `/api` (via Caddy `handle_path` strip)

### Client Usage

```typescript
import { fetchJson, ApiErrorException } from "@/lib/api/client";

const data = await fetchJson<SystemInfo>("/system/info");
```

### Vite Dev Proxy

Configured in `vite.config.ts` to proxy `/api` to `localhost:4001`, mirroring production Caddy behavior.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19, TypeScript, Vite |
| Styling | Tailwind CSS (slate palette), shadcn/ui |
| HA integration | `@hakit/core` v6 (WebSocket, real-time hooks) |
| Icons | `@mdi/js` + custom Icon component |
| State | Zustand v5 with `persist` middleware |
| Routing | React Router v7 |
| Package manager | pnpm workspaces |

---

## Development Commands

```bash
cd apps

# Quality checks
pnpm typecheck      # TypeScript (no emit)
pnpm lint           # ESLint
pnpm format         # Prettier (write)

# Serve
pnpm dev            # Start web + API concurrently

# Build
pnpm build          # Production build (Vite + tsc)

# Storybook
pnpm -C dashboard-web storybook    # Component explorer :6006
```

---

## Production Build (Docker)

```bash
cd stacks/applications/dashboard
docker compose up --build -d
```

Environment variables are sourced from `.env.linos`. The dashboard container uses Docker Engine API via socket for container management.

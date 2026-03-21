# linBoard Frontend

**React 19 + TypeScript + Vite + Tailwind CSS + @hakit/core + Zustand**

Modern, responsive smart-home dashboard with gesture-based controls, real-time Home Assistant integration, and system monitoring. Dark-first design with slate palette.

---

## Quick Start (60 seconds)

```bash
# From repository root, go to workspace
cd apps

# Install dependencies
pnpm install

# Start dev server (runs on http://localhost:4000)
pnpm dev

# In another terminal, start API server
pnpm -C dashboard-api dev  # runs on http://localhost:4001
```

### URLs

| Service | URL | Notes |
|---------|-----|-------|
| **Web** | http://localhost:4000 | Vite dev server, HMR enabled |
| **API** | http://localhost:4001 | Express backend |
| **Storybook** | http://localhost:6006 | Component library (see below) |

---

## Architecture

### Routing

| Route | Page | Description |
|-------|------|-------------|
| `/` | SmarthomePage | Main dashboard — quick toggles, room cards, Roborock panel |
| `/admin` | AdminPage | System info panel, Docker container overview |
| `*` | — | Redirects to `/` |

### Layout

**Desktop (>=768px):**
- Fixed sidebar nav on left
- Main content area on right
- Header with system metric badges (CPU, RAM)

**Mobile (<768px):**
- Header at top with system vitals
- Full-width content
- Bottom nav bar (touch-friendly, >=48px height)

### Data Flow

- **HA entity state** -> `@hakit/core` WebSocket hooks (never custom REST/WS)
- **System/Docker data** -> `dashboard-api` REST -> `lib/api/client.ts` (polled)
- **UI state** (layout, favorites, language) -> Zustand stores with `persist`
- **Dashboard config** (rooms, entities) -> `dashboard-api` `/dashboard/config` endpoint

---

## Folder Structure

```
src/
├── pages/
│   ├── SmarthomePage.tsx       # Main dashboard with rooms, toggles, Roborock
│   └── AdminPage.tsx           # System info + Docker panels
├── components/
│   ├── common/                 # CardErrorBoundary, Panel, LoadingState, InlineError
│   ├── ha/                     # HA entity cards
│   │   ├── LightCard.tsx       # Gesture-based brightness control
│   │   ├── ClimateCard.tsx     # Temperature presets and mode selector
│   │   ├── SwitchCard.tsx      # Toggle switch entity
│   │   ├── SensorCard.tsx      # Read-only sensor display
│   │   ├── AirQualitySensorCard.tsx  # Air quality with PM2.5/VOC
│   │   ├── GenericEntityCard.tsx     # Fallback for unmapped domains
│   │   ├── CompactRoomCard.tsx       # Per-room entity grid
│   │   ├── QuickToggle.tsx     # Single quick-toggle button
│   │   ├── QuickToggleBar.tsx  # Bar of quick toggles per room
│   │   ├── EntityIcon.tsx      # Icon resolver for HA entities
│   │   └── domainCards.ts      # Domain -> card component mapping
│   ├── layout/                 # AppShell, Header, SidebarNav, BottomNav, SystemMetricBadge
│   ├── panels/                 # SystemInfoPanel, DockerPanel, RoborockQuickPanel
│   └── ui/                     # shadcn/ui base (card, button, badge, switch, slider, icon)
├── hooks/
│   ├── usePolledData.ts        # createPollingHook<T>() factory
│   ├── useSystemInfo.ts        # System info polling
│   ├── useSystemVitals.ts      # CPU/RAM polling for header
│   ├── useDockerContainers.ts  # Docker container status polling
│   ├── useDashboardConfig.ts   # Dashboard config from API
│   ├── useLightGesture.ts      # Pointer gesture handler for LightCard
│   ├── useMetricHistory.ts     # Rolling history for sparkline metrics
│   └── useOptimisticAction.ts  # Optimistic UI updates for HA actions
├── lib/
│   ├── api/
│   │   ├── client.ts           # fetchJson wrapper with timeout + envelope
│   │   ├── endpoints.ts        # API endpoint constants
│   │   └── types.ts            # API response types
│   ├── ha/
│   │   ├── icons.ts            # haIconToMdiPath() resolver
│   │   ├── dashboardIcons.ts   # Dashboard-specific icon mapping
│   │   ├── config.ts           # HA_CONFIGURED flag
│   │   └── provider.tsx        # HaProvider wrapper
│   ├── i18n/
│   │   ├── translations.ts     # DE/EN translation dictionary
│   │   └── useTranslation.ts   # t() hook
│   └── utils.ts                # cn() helper (clsx + tailwind-merge)
├── stores/
│   ├── languageStore.ts        # Language preference (DE/EN)
│   ├── favoritesStore.ts       # Favorite entities
│   └── layoutStore.ts          # Layout preferences
├── main.tsx                    # App entry (BrowserRouter, HaProvider, AppShell)
└── index.css                   # Global Tailwind styles
```

---

## Key Features

### Home Assistant Integration

- Real-time entity state via `@hakit/core` WebSocket
- Gesture-based light control (swipe up/down for brightness)
- Climate cards with temperature presets and mode switching
- Quick toggle bar for room-level scene/input_select control
- Air quality sensor cards (PM2.5, VOC, temperature, humidity)
- Roborock vacuum quick control panel

### System Monitoring

- CPU and RAM usage in header bar (polled from API)
- System info panel with host details
- Docker container status overview
- Service health checks

### Internationalization

- German and English translations via `useTranslation()` hook
- All user-visible text goes through `t()` — no raw strings in JSX
- Language persisted in Zustand store

---

## Component Conventions

### Naming

- **Components:** PascalCase (`LightCard.tsx`, `QuickToggle.tsx`)
- **Props interfaces:** `<ComponentName>Props`
- **Hooks:** camelCase, prefixed with `use` (e.g., `useLightGesture`)

### Styling

- **Utility-first Tailwind CSS** — no CSS-in-JS, no CSS modules
- Use `cn()` helper from `src/lib/utils.ts` to merge classes
- Dark-first, slate palette only (see CLAUDE.md Design System)
- CSS transitions — no framer-motion

### Icons

- Named imports from `@mdi/js` only
- Custom `Icon` component (`components/ui/icon.tsx`) for React 19 compatibility
- HA icon strings resolved via `haIconToMdiPath()`

### State Management

| Source | Tool |
|--------|------|
| HA entity state | `useEntity` from `@hakit/core` |
| UI preferences | Zustand stores with `persist` |
| Backend data | `createPollingHook<T>()` factory |

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

Configured in `vite.config.ts` — mirrors production Caddy behavior, avoids CORS in dev.

---

## Storybook

```bash
cd apps/dashboard-web
pnpm storybook    # Opens http://localhost:6006
```

Stories live alongside components with `.stories.ts` suffix.

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
pnpm -C dashboard-web dev
pnpm -C dashboard-api dev

# Build
pnpm build
pnpm -C dashboard-web build
```

---

## Dependencies

### Runtime
- `react` / `react-dom` — UI library (v19)
- `react-router-dom` — Client-side routing
- `@hakit/core` — Home Assistant WebSocket integration
- `@mdi/js` — Material Design Icons (SVG paths)
- `zustand` — Lightweight state management with persistence
- `clsx` + `tailwind-merge` — Class merging utilities

### Dev
- `vite` — Build tool
- `typescript` — Type checking
- `tailwindcss` — Utility CSS
- `storybook` — Component development
- `eslint` / `prettier` — Code quality

---

## References

- [React](https://react.dev)
- [Vite](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [@hakit/core](https://shannonhochkins.github.io/ha-component-kit)
- [Zustand](https://zustand-demo.pmnd.rs)
- [Storybook](https://storybook.js.org)

# linBoard – Projekt-Kontext

## Was ist linBoard?

linBoard ist das zentrale Dashboard für **linOS** – ein minimalistisches, Linux-zentriertes Homelab-Betriebssystem auf einem Dell Wyse 5070 ("Manny", Arch Linux). Single-Pane-of-Glass für Smart-Home, Monitoring und Schnellaktionen.

## Tech Stack

| Layer | Technologie |
|---|---|
| Frontend | React 19+, TypeScript, Vite |
| Styling | Tailwind CSS (slate palette), shadcn/ui |
| HA-Integration | @hakit/core v6 (WebSocket, Real-Time Hooks) |
| Icons | @mdi/react + @mdi/js (MDI, HA-kompatibel) |
| State | Zustand v5 (Client-State: Layout, Favorites, Prefs) |
| Backend | Express 5, Zod, Pino |
| Package Manager | pnpm (Workspaces) |
| Zukünftig | Recharts, react-colorful, react-grid-layout |

## Architektur

```
Browser → @hakit/core WebSocket → Home Assistant (Real-Time State + Control)
Browser → Vite Dev Proxy /api   → Express BFF → System-Monitoring, Config
```

- **@hakit/core** ist die einzige Datenschicht für HA. Kein REST-Polling, kein BFF-Proxy für HA.
- **BFF** nur für: Health Check (`GET /health`), Stack Status Monitoring (`GET /services/status`), zukünftig Config-Persistenz.
- **Graceful Degradation**: Dashboard muss ohne HA-Verbindung starten. `HaProvider` rendert children ohne Provider wenn Env-Vars fehlen.
- **Security**: HA Long-Lived Access Token im Frontend ist akzeptabel (Dashboard nur in LAN/Tailscale VPN).

## Repo-Struktur

```
├── apps/
│   ├── dashboard-api/          # Express BFF
│   │   └── src/
│   │       ├── config/         # Zod env + services.json loader
│   │       ├── routes/         # health, services/status
│   │       └── middleware/
│   └── dashboard-web/          # React Frontend
│       └── src/
│           ├── components/
│           │   ├── common/     # CardErrorBoundary, ServiceStatusCard
│           │   ├── ha/         # ConnectionStatus, EntityIcon, HaStatusCard, HaStatusIndicator
│           │   │               # LightCard, SwitchCard, SensorCard
│           │   ├── layout/     # AppShell, Header, SidebarNav, BottomNav
│           │   └── ui/         # shadcn/ui Basis (badge, button, card, switch, slider)
│           ├── hooks/          # useServiceStatuses
│           ├── lib/
│           │   ├── api/        # Typed fetch client (BFF)
│           │   └── ha/         # icons.ts, provider.tsx, config.ts
│           ├── pages/          # OverviewPage, RoomsPage, PanelsPage
│           └── stores/         # layoutStore, favoritesStore (Zustand)
├── config/
│   └── services.json           # Stack health monitoring config
├── PROMPT.md                   # Dieses Dokument
└── AGENT.md                    # → Wird in GitHub Copilot Instructions migriert
```

## Design System

### Farben (Slate – Dark-First)

| Verwendung | Tailwind |
|---|---|
| App-Hintergrund | `slate-950` |
| Cards | `slate-900` |
| Borders | `slate-800` |
| Text primär | `slate-100` |
| Text sekundär | `slate-400` |
| Text tertiär | `slate-500` |

### Accent-Farben

| Bedeutung | Tailwind |
|---|---|
| Aktiv/An | `amber-400` |
| Fehler | `red-400` |
| Erfolg | `emerald-400` |
| Info | `sky-400` |

### Regeln

- Nur Tailwind Utility Classes – kein inline `style={}`, keine CSS-Module
- Animationen via CSS Transitions – kein framer-motion
- Icons aus `@mdi/js` via `haIconToMdiPath()` – nie Emojis, nie Lucide

## Env-Variablen

### Frontend (`apps/dashboard-web/.env`)

| Variable | Beispiel |
|---|---|
| `VITE_API_BASE` | `/api` |
| `VITE_HA_URL` | `http://192.168.2.31:8123` |
| `VITE_HA_TOKEN` | `eyJ...` |

### Backend (`apps/dashboard-api/.env`)

| Variable | Default |
|---|---|
| `NODE_ENV` | `development` |
| `PORT` | `4001` |
| `LOG_LEVEL` | `info` |
| `CORS_ALLOW_ORIGINS` | `http://localhost:4000,http://dashboard.lan` |
| `SERVICES_CONFIG_PATH` | `config/services.json` |

## Roadmap

### ✅ Phase 1 – Fundament (abgeschlossen)

Monorepo, Express BFF, React mit Routing/Layout, TypeScript/ESLint/Tailwind, Storybook, MDI Icons, Zustand Stores, CardErrorBoundary, Path Aliases, @hakit/core mit HaProvider + ConnectionStatus, Config-driven Stack Status Monitoring.

### 🔨 Phase 2 – Smart Home Cards (AKTIV)

- [x] `lib/ha/config.ts` – Shared `HA_CONFIGURED` Utility
- [x] **LightCard** – Toggle (Switch) + Brightness Slider (0-255), Amber-Glow wenn an, EntityIcon
- [x] **SwitchCard** – Toggle für switch/input_boolean/fan/automation Domains
- [x] **SensorCard** – Read-only: Wert + Einheit + EntityIcon
- [x] **OverviewPage Quick Controls** – Grid mit LightCards/SwitchCards für konfigurierte Entities
- [ ] SceneCard (Szene aktivieren)
- [ ] ClimateCard (Temperatur + Modus-Selector)
- [ ] MediaCard (Player Controls)
- [ ] CoverCard (Rolladen/Jalousien)

### Phase 3 – Dashboard Grid

react-grid-layout, Drag & Drop, Layout-Persistenz (layoutStore), Widget-Konfigurator, Breakpoint-Layouts.

### Phase 4 – System Monitoring

Server-Status via BFF, Container-Übersicht (Docker API), Netzwerk-Ping, Recharts für historische Daten.

### Phase 5 – Rooms & Areas

useAreas() für HA-basierte Raumaufteilung, RoomCard mit Entity-Liste, Raum-spezifische Quick Controls.

## Coding-Standards (Kurzfassung)

- TypeScript strict – kein `any`
- @hakit/core Hooks für alle HA-Daten (`useEntity`, `useAreas`, `useService`)
- MDI Icons via `haIconToMdiPath()` mit named imports aus `@mdi/js`
- Zustand für Client-State (Layout, Favorites)
- CardErrorBoundary um jede HA-Karte
- Graceful handling von `unavailable`/`unknown` Entity States
- Conventional Commits auf Englisch
- Vollständige Standards: siehe GitHub Copilot Instructions

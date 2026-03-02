# linBoard – Projekt-Kontext

## Was ist linBoard?

linBoard ist das zentrale Dashboard für **linOS** – ein minimalistisches, Linux-zentriertes Homelab-Betriebssystem. Das Dashboard dient als Single-Pane-of-Glass für:

- Smart-Home-Geräte via Home Assistant (Real-Time via WebSocket)
- Server- und Netzwerk-Monitoring
- Schnellaktionen und Automationen
- Konfigurationsübersicht

## Tech Stack

| Layer | Technologie |
|---|---|
| Frontend Framework | React 19+, TypeScript, Vite (rolldown-vite) |
| Styling | Tailwind CSS (slate palette), shadcn/ui |
| HA-Integration | @hakit/core (WebSocket, Hooks, Real-Time) |
| Icons | @mdi/react + @mdi/js (Material Design Icons, HA-kompatibel) |
| Charts | Recharts |
| Color Picker | react-colorful |
| State | Zustand v5 (Client-State: Layout, Favorites, Prefs) |
| Grid Layout | react-grid-layout (Drag & Drop) |
| Backend | Express 5, Zod, Pino |
| Package Manager | pnpm (Workspaces) |

## Repo-Struktur

```
├── apps/
│   ├── dashboard-api/          # Express BFF (TypeScript)
│   │   └── src/
│   │       ├── config/         # Zod-validated env + JSON app config
│   │       ├── middleware/      # cors, headers, errors
│   │       ├── routes/         # health + future BFF routes
│   │       └── services/       # placeholder for system monitoring
│   └── dashboard-web/          # React Frontend (Vite + TypeScript)
│       └── src/
│           ├── components/
│           │   ├── common/     # CardErrorBoundary, StatusBadge, etc.
│           │   ├── ha/         # HA-spezifische Komponenten
│           │   ├── layout/     # AppShell, Header, SidebarNav, BottomNav
│           │   └── ui/         # shadcn/ui Basis-Komponenten
│           ├── lib/
│           │   ├── api/        # Typed fetch client (BFF)
│           │   ├── ha/         # icons.ts, provider.tsx
│           │   └── utils.ts    # cn() helper
│           ├── pages/          # OverviewPage, RoomsPage, PanelsPage
│           └── stores/         # layoutStore, favoritesStore (Zustand)
├── docker-compose.yml
├── .env.linos.example
├── PROMPT.md                   # Dieses Dokument
└── AGENT.md                    # Agent System Prompt
```

## Architektur-Entscheidungen

### Frontend ↔ Home Assistant: WebSocket (kein REST-Polling)

Das Frontend kommuniziert **direkt** mit Home Assistant via WebSocket – vermittelt durch `@hakit/core`. Der BFF (Express) ist **nicht** der Proxy für HA-Daten.

```
Browser → @hakit/core WebSocket → Home Assistant
Browser → Vite Dev Proxy /api   → Express BFF → (System-Monitoring, Config)
```

**Warum WebSocket statt REST-Polling?**
- Real-Time Updates: State-Änderungen kommen in <100ms (kein 10s Polling-Delay)
- Kein globaler pending-State der alle Buttons disabled
- Native HA-Protokoll (Home Assistant WebSocket API)
- @hakit/core abstrahiert Auth, Reconnect, State-Management

### BFF (Express) bleibt für

- `GET /health` – Health Check
- Zukünftig: System-Monitoring (Docker, Netzwerk)
- Zukünftig: Config-Persistenz (Rooms, Favorites als JSON)

### Graceful Degradation

Das Dashboard **muss** ohne HA-Verbindung starten:

```tsx
// HaProvider degradiert graceful wenn keine Env-Vars gesetzt sind
if (!HA_URL || !HA_TOKEN) {
  return <>{children}</>; // Kein Provider – keine Hooks – kein Crash
}
```

Seiten und Komponenten prüfen `VITE_HA_URL && VITE_HA_TOKEN` und zeigen
eine freundliche Meldung wenn HA nicht konfiguriert ist.

## Design System

### Farben (Slate Palette – Dark-First)

| Token | Tailwind | Verwendung |
|---|---|---|
| Hintergrund | `slate-950` | App-Hintergrund |
| Karten | `slate-900` | Card Background |
| Borders | `slate-800` | Card Border |
| Text primär | `slate-100` | Überschriften, wichtige Werte |
| Text sekundär | `slate-400` | Labels, Beschreibungen |
| Text tertiär | `slate-500` | Timestamps, Hints |

### Accent-Farben

| Farbe | Tailwind | Bedeutung |
|---|---|---|
| Aktiv/An | `amber-400` | Licht an, aktiver Toggle |
| Fehler | `red-400` | Fehler, Unavailable |
| Erfolg | `emerald-400` | Verbunden, OK |
| Info | `sky-400` | Informationen |

### Grundregeln

- Nur Tailwind Utility Classes – kein inline `style={}`, keine CSS-Module
- Slate-Palette + definierte Accent-Farben – keine random Hex-Codes
- Animationen via CSS Transitions (`transition-all duration-200`) – kein framer-motion

## Env-Variablen

### Frontend (`apps/dashboard-web/.env`)

| Variable | Beschreibung | Beispiel |
|---|---|---|
| `VITE_API_BASE` | Vite Proxy-Prefix zum BFF | `/api` |
| `VITE_HA_URL` | Home Assistant URL (vom Browser erreichbar) | `http://192.168.2.31:8123` |
| `VITE_HA_TOKEN` | HA Long-Lived Access Token | `eyJ...` |

### Backend (`apps/dashboard-api/.env` / Docker)

| Variable | Beschreibung | Default |
|---|---|---|
| `NODE_ENV` | Umgebung | `development` |
| `PORT` | API Server Port | `4001` |
| `LOG_LEVEL` | Pino Log Level | `info` |
| `CORS_ALLOW_ORIGINS` | Erlaubte Origins | `http://localhost:4000,http://dashboard.lan` |
| `LINOS_DASHBOARD_HOST` | Dashboard Hostname | `dashboard.lan` |
| `CONFIG_PATH` | Pfad zur JSON-Konfigurationsdatei | – |

## Roadmap

### Phase 1 – Fundament ✅

- [x] Monorepo Setup (pnpm workspaces)
- [x] Express BFF mit Health-Endpoint
- [x] React Frontend mit Routing und Layout
- [x] TypeScript, ESLint, Prettier, Tailwind
- [x] Storybook für Component Library
- [x] MDI Icons Integration (`@mdi/react`, `@mdi/js`)
- [x] Zustand Stores (layoutStore, favoritesStore)
- [x] CardErrorBoundary
- [x] Path Aliases (`@/*`)
- [x] @hakit/core Integration
- [x] HaProvider mit graceful Degradation
- [x] ConnectionStatus Komponente

### Phase 2 – Smart Home Cards

- [ ] LightCard (Toggle + Brightness Slider)
- [ ] ClimateCard (Temperatur anzeigen + Modus-Selector)
- [ ] MediaCard (Player Controls: Play/Pause, Volume)
- [ ] SensorCard (Numerische Werte + Einheit)
- [ ] SceneCard (Szene aktivieren)
- [ ] CoverCard (Rolladen/Jalousien)

### Phase 3 – Dashboard Grid

- [ ] react-grid-layout Integration
- [ ] Drag & Drop Layout
- [ ] Layout-Persistenz (layoutStore)
- [ ] Widget-Konfigurator Dialog (AddWidgetDialog)
- [ ] Breakpoint-spezifische Layouts (lg, md, sm)

### Phase 4 – System Monitoring

- [ ] Server-Status via BFF
- [ ] Container-Übersicht (Docker API)
- [ ] Netzwerk-Ping Status
- [ ] Recharts für historische Daten

### Phase 5 – Rooms & Areas

- [ ] useAreas() für HA-basierte Raumaufteilung
- [ ] RoomCard mit Entity-Liste
- [ ] Raum-spezifische Quick Controls

## Coding-Standards

Alle Details in `AGENT.md`. Kurzfassung:

- TypeScript strict – kein `any`
- @hakit/core Hooks für alle HA-Daten
- MDI Icons via `haIconToMdiPath()` aus `@mdi/js` named imports
- Zustand für Client-State (Layout, Favorites)
- CardErrorBoundary um jede HA-Karte
- Slate-Palette + Accent-Farben
- Graceful handling von `unavailable`/`unknown` Entity States


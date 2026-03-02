# linBoard – Projekt-Kontext

## Was ist linBoard?

linBoard ist das zentrale Dashboard für **linOS** – ein minimalistisches, Linux-zentriertes Homelab-Betriebssystem. Das Dashboard dient als Single-Pane-of-Glass für:

- Smart-Home-Geräte via Home Assistant
- Server- und Netzwerk-Monitoring
- Schnellaktionen und Automationen
- Konfigurationsübersicht

## Tech Stack

| Layer | Technologie |
|---|---|
| Frontend Framework | React 18+, TypeScript, Vite |
| Styling | Tailwind CSS (slate palette), shadcn/ui |
| HA-Integration | @hakit/core (WebSocket, Hooks, Real-Time) |
| Icons | @mdi/react + @mdi/js (Material Design Icons) |
| Charts | Recharts |
| Color Picker | react-colorful |
| State | Zustand (Client-State) |
| Grid Layout | react-grid-layout |
| Backend | Express, Zod |
| Package Manager | pnpm (Workspaces) |

## Repo-Struktur

```
├── apps/
│   ├── dashboard-api/     # Express BFF (TypeScript)
│   └── dashboard-web/     # React Frontend (Vite + TypeScript)
├── docker-compose.yml
├── .env.linos.example
├── PROMPT.md              # Dieser Dokument
└── AGENT.md               # Agent System Prompt
```

## Roadmap

### Phase 1 – Fundament (aktuell)
- [x] Monorepo Setup (pnpm workspaces)
- [x] Express BFF mit Health-Endpoint
- [x] React Frontend mit Routing und Layout
- [x] TypeScript, ESLint, Prettier, Tailwind
- [x] Storybook für Component Library
- [ ] HA-Integration via @hakit/core
- [ ] MDI Icons Integration
- [ ] Zustand State Management

### Phase 2 – Smart Home Cards
- [ ] LightCard (Toggle + Brightness)
- [ ] ClimateCard (Temperatur + Modus)
- [ ] MediaCard (Player Controls)
- [ ] SensorCard (Werte anzeigen)
- [ ] SceneCard (Szenen aktivieren)

### Phase 3 – Dashboard Grid
- [ ] react-grid-layout Integration
- [ ] Drag & Drop Layout
- [ ] Layout-Persistenz (Zustand)
- [ ] Widget-Konfigurator

### Phase 4 – System Monitoring
- [ ] Server-Status via API
- [ ] Container-Übersicht (Docker)
- [ ] Netzwerk-Status

## Design System

### Farben (Slate Palette)
- Hintergrund: `slate-950` (dunkelster)
- Karten: `slate-900`
- Borders: `slate-800`
- Text primär: `slate-100`
- Text sekundär: `slate-400`
- Text tertiär: `slate-500`

### Accent-Farben
- Aktiv/An: `amber-400`
- Fehler: `red-400`
- Erfolg: `emerald-400`
- Info: `sky-400`

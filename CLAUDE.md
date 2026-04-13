# CLAUDE.md – linOS / linBoard

**linOS** is a homelab stack on a Dell Wyse 5070 ("Manny", Arch Linux).
**linBoard** is the central smart-home dashboard (React + Express + TypeScript).

---

## Commands

All commands run from `apps/`:

```bash
pnpm install          # install all workspace dependencies
pnpm dev              # start frontend :4000 + API :4001 concurrently
pnpm build            # production build (Vite + tsc)
pnpm typecheck        # tsc --noEmit
pnpm lint             # ESLint
pnpm format           # Prettier

pnpm -C dashboard-web storybook       # component explorer :6006
```

Docker (production):
```bash
cd stacks/applications/dashboard && docker compose up --build -d
```

---

## Architecture

```
apps/
├── dashboard-web/    # React 19, Vite, Tailwind, shadcn/ui, @hakit/core, Zustand
└── dashboard-api/    # Express 5, Zod, Pino — BFF for non-HA data

stacks/               # Docker Compose infrastructure
config/services.json  # health-check definitions
```

**Data flow (non-negotiable):**
- HA entity state → `@hakit/core` WebSocket hooks — never custom REST/WS
- System/Docker data → `dashboard-api` REST → `lib/api/client.ts`
- UI state (layout, favorites) → Zustand stores with `persist`

**Environment:**
- `VITE_HA_URL` / `VITE_HA_TOKEN` — Home Assistant
- `LINOS_HOST_IP` — host IP
- `.env.linos` is gitignored, never commit it

---

## Tech Stack

| Layer | What |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS (slate palette), shadcn/ui |
| HA integration | `@hakit/core` v6 (WebSocket, real-time hooks) |
| Icons | `@mdi/react` + `@mdi/js` |
| State | Zustand v5 with `persist` |
| Backend | Express 5, Zod, Pino |
| Package manager | pnpm workspaces |

---

## Design System

### Color palette (dark-first, slate only)

| Role | Tailwind |
|---|---|
| App background | `slate-950` |
| Cards | `slate-900` |
| Borders | `slate-800` |
| Primary text | `slate-100` |
| Secondary text | `slate-400` |
| Tertiary / placeholder | `slate-500` |
| Active / on | `amber-400` |
| Error | `red-400` |
| Success / ok | `emerald-400` |
| Info | `sky-400` |

**Never use hex codes. Never use Tailwind colors outside this palette.**

---

## Code Patterns

### HA Entity Card

```tsx
// components/ha/DomainCard.tsx
import { useEntity } from "@hakit/core";
import { mdiDevices } from "@mdi/js";
import Icon from "@mdi/react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { haIconToMdiPath } from "@/lib/ha/icons";

interface DomainCardProps {
  entityId: `domain.${string}`;
}

export function DomainCard({ entityId }: DomainCardProps) {
  // Always returnNullIfNotFound — entity may not be registered in HA yet
  const entity = useEntity(entityId, { returnNullIfNotFound: true });

  const isUnavailable = !entity || entity.state === "unavailable" || entity.state === "unknown";
  const isOn = entity?.state === "on";
  const friendlyName = entity?.attributes.friendly_name ?? entityId.split(".")[1] ?? entityId;
  const iconPath = haIconToMdiPath(entity?.attributes.icon ?? "") ?? mdiDevices;

  // Always wrap service calls in try/catch — HA calls are async and can fail
  const handleToggle = async () => {
    if (isUnavailable || !entity) return;
    try {
      await entity.service.toggle();
    } catch (err) {
      console.error("Failed to toggle entity:", entityId, err);
    }
  };

  return (
    <Card className={cn(isUnavailable && "opacity-50")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon
              path={iconPath}
              size={1}
              className={isOn ? "text-amber-400" : "text-slate-400"}
            />
            <span className="text-sm font-medium text-slate-200 truncate" title={friendlyName}>
              {friendlyName}
            </span>
          </div>
          {/* domain-specific controls */}
        </div>
        {isUnavailable && (
          <p className="text-xs text-slate-500 mt-2">Unavailable</p>
        )}
      </CardContent>
    </Card>
  );
}
```

### Polling data hook (generic factory — do not copy-paste per endpoint)

```ts
// hooks/usePolledData.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchJson, ApiErrorException } from "@/lib/api/client";

export interface PolledDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

export function createPollingHook<T>(url: string, intervalMs = 30_000) {
  return function usePolledData(): PolledDataState<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const hasData = useRef(false);

    const fetchOnce = useCallback(() => {
      fetchJson<T>(url)
        .then((d) => {
          hasData.current = true;
          setData(d);
          setError(null);
          setLastUpdated(new Date());
        })
        .catch((err: unknown) => {
          setError(err instanceof ApiErrorException ? err.message : `Failed to load ${url}`);
        })
        .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
      fetchOnce();
      const id = setInterval(fetchOnce, intervalMs);
      return () => clearInterval(id);
    }, [fetchOnce]);

    const refresh = useCallback(() => {
      if (!hasData.current) setLoading(true);
      fetchOnce();
    }, [fetchOnce]);

    return { data, loading, error, lastUpdated, refresh };
  };
}

// Usage — one line per endpoint, no duplication:
// export const useSystemInfo = createPollingHook<SystemInfo>("/system/info");
```

### Switch / toggle UI component

```tsx
// The visual switch pattern: one sr-only checkbox + one visual span.
// NEVER render two <input type="checkbox"> elements — that breaks ref, a11y, and state.
const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(({ className, ...props }, ref) => (
  <label className={cn("inline-flex items-center cursor-pointer select-none", className)}>
    <input type="checkbox" ref={ref} className="sr-only peer" {...props} />
    <span
      className={cn(
        "w-11 h-6 rounded-full relative bg-slate-700 cursor-pointer",
        "peer-checked:bg-blue-600 transition-colors duration-300",
        "after:content-[''] after:absolute after:top-0.5 after:left-0.5",
        "after:bg-white after:rounded-full after:h-5 after:w-5",
        "after:transition-transform after:duration-300 peer-checked:after:translate-x-5",
        "peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-950"
      )}
      aria-hidden="true"
    />
  </label>
));
```

### Zustand store

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ExampleStore {
  items: string[];
  addItem: (item: string) => void;
  removeItem: (item: string) => void;
}

export const useExampleStore = create<ExampleStore>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) => set((state) => ({
        items: state.items.includes(item) ? state.items : [...state.items, item],
      })),
      removeItem: (item) => set((state) => ({
        items: state.items.filter((i) => i !== item),
      })),
    }),
    { name: "linboard-example" }
  )
);
```

### Backend route

```ts
import { Router, type Request, type Response } from "express";
import type { ApiResponse } from "../middleware/errors.js";

export function exampleRouter(): Router {
  const router = Router();

  router.get("/example", async (_req: Request, res: Response): Promise<void> => {
    const data = await getExampleData(); // throws on failure
    const response: ApiResponse<typeof data> = { ok: true, data };
    res.json(response);
  });

  return router;
}
```

### Backend error handling

```ts
// Error parameter is unknown — never any.
// Create a typed AppError class instead of casting.
class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorMiddleware(logger: pino.Logger) {
  return (err: unknown, _req: Request, res: Response): void => {
    if (!(err instanceof Error)) {
      logger.error({ err }, "Non-Error thrown");
      res.status(500).json({ ok: false, error: { message: "Internal Server Error", code: "UNKNOWN" } });
      return;
    }
    const statusCode = err instanceof AppError ? err.statusCode : 500;
    const code = err instanceof AppError ? err.code : "INTERNAL_ERROR";
    logger.error({ message: err.message, stack: err.stack, statusCode }, "Request error");
    res.status(statusCode).json({ ok: false, error: { message: err.message, code } });
  };
}
```

---

## Rules

### TypeScript
- Strict mode. Zero `any`. Zero `@ts-ignore`.
- `unknown` for caught errors, use `instanceof` guards before accessing properties
- `interface` for objects, `type` for unions/intersections
- No `as X` casts unless narrowing is verified — prefer type guards

### Styling
- Tailwind utility classes only — no `style={}`, no CSS modules
- Use `cn()` (clsx) for conditional classes — never `[...].filter(Boolean).join(" ")`
- Dark-first, slate palette only — see Design System above
- CSS transitions for animation — no framer-motion

### No magic strings / no inline config
- Never hardcode entity IDs, room names, service URLs, or feature flags inline in components
- Entity lists → top-level `const` arrays in the page file, or a dedicated `config/` file
- Named constants for any value used in more than one place
- Route paths → single source, not spread across files

```tsx
// ❌ Magic string inline
<LightCard entityId="light.wohnzimmer_decke" />

// ✅ Config array at top of file or in config/entities.ts
const LIGHTS: Array<`light.${string}`> = ["light.wohnzimmer_decke"];
LIGHTS.map((id) => <LightCard key={id} entityId={id} />)
```

### Component simplicity — one job per component
- A component renders UI. It does not contain business logic, data transformations, or unrelated state.
- Extract derived values to plain functions or custom hooks above the component.
- If a component exceeds ~80 lines, consider splitting — a large render is a sign of mixed concerns.
- Sub-components that are only used once inside a parent file are fine to co-locate in the same file.
- Props stay simple: pass data and callbacks — never pass entire store slices or complex objects when scalar values suffice.

```tsx
// ❌ Logic inside JSX / large render
{containers.filter(c => c.state === "running").sort(...).map(...)}

// ✅ Derived value above return
const runningContainers = containers.filter(c => c.state === "running").sort(...);
return runningContainers.map(...);
```

### Helper files — no duplication
- Shared logic goes in `lib/` or `hooks/` — never copy-pasted between components.
- Use the `createPollingHook<T>()` factory for every polling endpoint (already exists in `hooks/usePolledData.ts`).
- Icon resolution always via `haIconToMdiPath()` (already in `lib/ha/icons.ts`).
- Utility types and API shapes go in `lib/api/types.ts` — not re-declared in component files.

### HA components
- Always `useEntity(id, { returnNullIfNotFound: true })` — never bare `useEntity(id)`
- Handle `null` / `"unavailable"` / `"unknown"` — render degraded UI, never crash
- Wrap every HA card in `<CardErrorBoundary entityId={entityId}>`
- Always `try/catch` around `entity.service.*` calls — show error to user
- All user-visible text goes through `useTranslation()` — no raw string literals in JSX

### Icons
- Named imports from `@mdi/js` only — `import { mdiLightbulb } from "@mdi/js"`
- Resolve HA icon strings via `haIconToMdiPath()` helper
- Never Lucide, never emoji, never inline SVG

### State
- HA entity state → `useEntity` / `@hakit/core` — never mirror into `useState`
- UI/layout state → Zustand with `persist`
- Backend config/system data → typed fetch via `lib/api/client.ts`

### Backend
- Use `logger` (pino) — never `console.log` / `console.warn` outside startup
- Validate all request inputs with Zod before business logic
- Errors throw `AppError` — the error middleware handles the response
- No `any` types — especially not in error middleware or route handlers

### shadcn/ui component quirks
- `Slider` `onChange` receives `number[]` — **not** `React.ChangeEvent<HTMLInputElement>`
- `Switch` is a controlled component — pass `checked` + `onChange` props

---

## Anti-Patterns (what breaks repeatedly)

These are patterns that have appeared in this codebase and must not be repeated:

```tsx
// ❌ Two checkbox inputs — only one sr-only input + one span
<input type="checkbox" className="sr-only peer" {...props} />
<input type="checkbox" className="peer" {...props} />  // WRONG

// ❌ HA service call without error handling
entity.service.toggle();  // silent failure

// ❌ Wrong Slider event type
const handleBrightness = (e: React.ChangeEvent<HTMLInputElement>) => {  // WRONG
  entity.service.turnOn({ serviceData: { brightness: Number(e.target.value) } });
};
// ✅ Correct
const handleBrightness = (value: number[]) => {
  entity.service.turnOn({ serviceData: { brightness: value[0] ?? 0 } });
};

// ❌ Array join for classNames
className={["base", isOn && "active", isDisabled && "opacity-50"].filter(Boolean).join(" ")}
// ✅ cn()
className={cn("base", isOn && "active", isDisabled && "opacity-50")}

// ❌ any in error handler
return (err: any, _req: Request, res: Response) => {  // WRONG

// ❌ Three copy-pasted polling hooks
// ✅ createPollingHook<T>() factory — see patterns above

// ❌ German UI text in components
<p>Nicht verfügbar</p>   // WRONG
<p>Fehler beim Laden</p> // WRONG
// ✅ English
<p>Unavailable</p>
<p>Failed to load</p>

// ❌ useEntity without null guard
const entity = useEntity(entityId);  // crashes if entity not found
// ✅
const entity = useEntity(entityId, { returnNullIfNotFound: true });
if (!entity) return <FallbackUI />;

// ❌ console.warn in backend
console.warn("Config missing");  // bypasses structured logging
// ✅
logger.warn({ configPath }, "Config file not found");

// ❌ Two volumes: keys in same docker-compose service (YAML silently discards first)
volumes:
  - ./config.json:/app/config.json:ro
volumes:               # WRONG — overrides the above
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

---

## File Structure

```
apps/dashboard-web/src/
├── components/
│   ├── common/         # CardErrorBoundary, CollapsiblePanel, LoadingState, ErrorState,
│   │                   # EmptyState, InlineError, StatusBadge, PageErrorBoundary
│   ├── ha/             # LightCard, ClimateCard, SwitchCard, SensorCard, AirQualitySensorCard,
│   │                   # GenericEntityCard, CompactRoomCard, QuickToggle, QuickAccessPanel,
│   │                   # VacuumRoutineCard, EntityIcon, domainCards
│   ├── layout/         # AppShell, Header, SidebarNav, BottomNav, SystemMetricBadge,
│   │                   # TimerHeaderBadge
│   ├── panels/         # SystemInfoPanel, UnifiedInfraPanel, RoborockQuickPanel,
│   │                   # TimerCard, VacuumRoutinePanel
│   └── ui/             # shadcn/ui base (card, button, badge, switch, slider, icon,
│                       # bottom-sheet, number-stepper, segment-toggle, toggle-chip)
├── hooks/              # usePolledData factory, useSystemInfo, useSystemVitals,
│                       # useDockerContainers, useDashboardConfig, useLightGesture,
│                       # useMetricHistory, useOptimisticAction, useTimerSocket,
│                       # useVacuumRoutineSocket, useIsMobile, useScrollSuppression
├── lib/
│   ├── api/            # fetchJson client, endpoints, types
│   ├── ha/             # icons.ts, dashboardIcons.ts, config.ts, provider.tsx
│   └── i18n/           # translations.ts (DE/EN dict), useTranslation.ts hook
├── pages/              # SmarthomePage, AdminPage
└── stores/             # languageStore, favoritesStore, layoutStore, panelStore,
                        # useVacuumRoutineStore

apps/dashboard-api/src/
├── config/             # env.ts (Zod), app-config.ts, light-notification-env.ts
├── middleware/         # cors, headers, errors
├── routes/             # health, services, system, dashboard, timer, vacuum-routines, admin
├── services/           # timer, vacuum-routine, light-notification
└── ws/                 # timer-ws, vacuum-routine-ws
```

---

## Git Workflow

Branch naming:
```
feat/<scope>/<description>
fix/<scope>/<description>
refactor/<scope>/<description>
chore/<scope>/<description>

Scopes: web, api, shared, infra
```

Commits — Conventional Commits, English, imperative:
```
feat(web): add ClimateCard with temperature display and mode selector
fix(web): handle null brightness attribute in LightCard slider
refactor(web): extract createPollingHook factory from duplicate hooks
fix(api): use unknown type in error middleware instead of any
```

One logical change per commit. No 500-line commits.

---

## Pre-Commit Checklist

```
□ pnpm typecheck passes (zero errors)
□ No `any` types, no `@ts-ignore`
□ No console.log left in code (except error boundaries)
□ No commented-out code blocks
□ All user-visible strings go through t() from useTranslation()
□ No magic strings — entity IDs, room names, paths in named constants or config files
□ Components are focused — no business logic mixed into render
□ No duplicated logic — shared code lives in lib/ or hooks/
□ HA entities: null / unavailable / unknown all handled
□ HA service calls wrapped in try/catch
□ Every new HA card wrapped in <CardErrorBoundary>
□ Conditional classes use cn(), not array join
□ Icons are named imports from @mdi/js
□ Slider onChange uses (value: number[]) signature
□ Switch component has one sr-only input + one visual span
□ New polling hooks use createPollingHook factory
□ Backend errors use AppError + unknown type
□ Slate palette for all colors, no hex codes
□ docker-compose: single volumes: key per service
```

---

## Infrastructure

### Service Topology

| Service | Stack path | Port | Local hostname |
|---|---|---|---|
| Caddy (reverse proxy) | `stacks/proxy` | 80 | — |
| AdGuard Home | `stacks/dns` | 3000 | `dns.manny.lan` |
| Home Assistant | `stacks/homeassistant` | 8123 | `ha.manny.lan` |
| Zigbee2MQTT | `stacks/zigbee2mqtt` | 8082 | `z2m.manny.lan` |
| Mosquitto MQTT | `stacks/infra` | 1883 (TCP) / 9001 (WS) | — (internal only) |
| Node-RED | `stacks/infra` | 1880 | `flow.manny.lan` |
| Wyoming Whisper (STT) | `stacks/wyoming` | 10300 (TCP) | — (internal only) |
| Wyoming Piper (TTS) | `stacks/wyoming` | 10200 (TCP) | — (internal only) |
| Service Index | `stacks/applications/service-index` | 8081 | `manny.lan` |
| Dashboard Web | `stacks/applications/dashboard` | 4000 | `dashboard.manny.lan` |
| Dashboard API | `stacks/applications/dashboard` | 4001 | `dashboard.manny.lan/api` |
| Plane | `stacks/applications/plane/plane-app` | 8080 | `plane.manny.lan` |

### Proxy Routing

Caddy (`stacks/proxy/Caddyfile`) runs in `network_mode: host` and routes by hostname:
- All hostnames are driven by `LINOS_*_HOST` env vars from `.env.linos`
- **Dashboard is special**: `/api/*` → API :4001 (prefix stripped via `uri strip_prefix /api`), `/*` → Web :4000

### Data Flow

```
Zigbee device
  → USB dongle → Zigbee2MQTT
  → Mosquitto MQTT :1883
  → Home Assistant (MQTT integration)
  → Node-RED (automations)

Browser
  → @hakit/core WebSocket → HA :8123   (entity state — never via BFF)
  → fetch → dashboard-api :4001         (system/Docker data only)
```

---

## Environment & Configuration

| File | Purpose |
|---|---|
| `.env.linos` | Secrets + hostnames. **Gitignored — never commit.** |
| `.env.linos.example` | Template with placeholders. Keep in sync with `.env.linos`. |
| `config/services.json` | Health-check definitions for all services. Consumed by `dashboard-api` and `smrestart`. Auto-generated by `update_index.py`. |

Key variables:

| Variable | Used by |
|---|---|
| `LINOS_HOST_IP` | Dashboard build args, API proxying |
| `LINOS_HA_TOKEN` | Vite build arg → `VITE_HA_TOKEN` |
| `LINOS_*_HOST` | Caddyfile virtual-host routing |
| `TZ` | All stacks (default `Europe/Berlin`) |
| `TS_AUTHKEY` | Tailscale container |

**Rule: adding a new env var requires a matching placeholder in `.env.linos.example`.**

---

## Operations

### Common Commands

```bash
# Restart all stacks (reads config/services.json for stack paths)
./scripts/smrestart

# Quick container status overview
./scripts/smstatus              # alias: dps

# Rebuild and redeploy dashboard (after code changes)
cd stacks/applications/dashboard && docker compose up --build -d

# Restart a single service in any stack
cd stacks/<stack> && docker compose restart <service>

# Tail logs for a container (shell alias)
dlog <container-name> [lines]

# Regenerate service index after adding/removing a stack
python3 scripts/update_index.py
```

### Shell Aliases (`shell/manny.zshrc`)

Sourced from `~/.zshrc`. Available on the host after `git pull` + re-sourcing.

| Alias / Function | Expands to |
|---|---|
| `dps` | `docker ps --format 'table …'` |
| `dcu` | `docker compose up -d` |
| `dcd` | `docker compose down` |
| `dlog <name> [n]` | Tail last n lines of container logs |
| `smrestart` | `./scripts/smrestart` |
| `smstatus` | `./scripts/smstatus` |
| `updateindex` | `python3 scripts/update_index.py` |
| `planeup` / `planedown` | Source `.env.linos` + start/stop Plane stack |

---

## Adding a New Stack — Checklist

```
□ Create stacks/<name>/docker-compose.yml
□ Single volumes: key per service (YAML silently discards duplicate keys)
□ Add healthcheck to every long-running service
□ Add proxy route in stacks/proxy/Caddyfile
□ Add LINOS_<NAME>_HOST var to Caddyfile + .env.linos.example
□ Run python3 scripts/update_index.py to refresh service index
□ Run ./scripts/smrestart to bring up the new stack
□ Verify with ./scripts/smstatus
```

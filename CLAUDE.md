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

### HA components
- Always `useEntity(id, { returnNullIfNotFound: true })` — never bare `useEntity(id)`
- Handle `null` / `"unavailable"` / `"unknown"` — render degraded UI, never crash
- Wrap every HA card in `<CardErrorBoundary entityId={entityId}>`
- Always `try/catch` around `entity.service.*` calls — show error to user
- UI text is **English** — not "Nicht verfügbar", not "Fehler beim Laden"

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
│   ├── common/         # CardErrorBoundary, Panel, LoadingState
│   ├── ha/             # HA entity cards (LightCard, SwitchCard, SensorCard…)
│   ├── layout/         # AppShell, Header, SidebarNav, BottomNav
│   ├── panels/         # System panels (SystemInfoPanel, DockerPanel, ServicesPanel)
│   └── ui/             # shadcn/ui base (card, button, badge, switch, slider)
├── hooks/              # usePolledData factory + per-endpoint exports
├── lib/
│   ├── api/            # fetchJson client + ApiErrorException + types
│   └── ha/             # icons.ts, provider.tsx, config.ts
├── pages/              # OverviewPage, RoomsPage, PanelsPage
└── stores/             # Zustand stores (only if feature is built)

apps/dashboard-api/src/
├── config/             # env.ts (Zod), app-config.ts (services.json loader)
├── middleware/         # cors, headers, errors
├── routes/             # health, services, system
└── services/           # business logic (extracted from routes when non-trivial)
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
□ No German text in UI components
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

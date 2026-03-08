# CLAUDE.md – linOS / linBoard

## Project

**linOS** is a homelab stack for a Dell Wyse 5070 host ("Manny", Arch Linux).
**linBoard** is the central smart-home dashboard (React + Express + TypeScript).

Full project context → `PROMPT.md`
Developer guidelines & code patterns → `AGENT.md`

---

## Commands

All commands run from `apps/`:

```bash
pnpm install          # install all workspace dependencies
pnpm dev              # start frontend (4000) + API (4001) concurrently
pnpm build            # production build (Vite + tsc)
pnpm typecheck        # tsc --noEmit, no emit
pnpm lint             # ESLint (both packages)
pnpm format           # Prettier format + fix

pnpm -C dashboard-web storybook       # component explorer on port 6006
pnpm -C dashboard-web build-storybook # static storybook build
```

Docker (production):
```bash
cd stacks/applications/dashboard
docker compose up --build -d
```

---

## Architecture

```
apps/
├── dashboard-web/    # React 19, Vite, Tailwind, shadcn/ui, @hakit/core, Zustand
└── dashboard-api/    # Express 5, Zod, Pino (BFF for non-HA data)

stacks/               # Docker Compose infrastructure
config/services.json  # health-check definitions for 10 services
```

**Data flow:**
- HA entity state → `@hakit/core` WebSocket hooks (never custom REST/WS)
- System/Docker data → `dashboard-api` REST → `lib/api/client.ts`
- UI state (layout, favorites) → Zustand stores with `persist`

---

## Key Conventions

### TypeScript
- Strict mode, no `any`, no `@ts-ignore`
- Interfaces for objects, types for unions/intersections

### Styling
- Tailwind utility classes only – no inline `style={}`, no CSS modules
- Dark-first, slate palette: `slate-950/900/800/400/100`
- No random hex codes

### HA Components
Every smart-home card must:
1. Use `useEntity(entityId)` from `@hakit/core`
2. Handle `unavailable` / `unknown` states with graceful fallback
3. Be wrapped in `<CardErrorBoundary entityId={entityId}>`

### Icons
- Named imports from `@mdi/js` only (`import { mdiLightbulb } from "@mdi/js"`)
- Resolve HA icon strings via `haIconToMdiPath()` helper
- Never Lucide, never Emojis, never hardcoded SVG

### State
- HA entity state → `useEntity` / `@hakit/core` (never mirror into `useState`)
- UI/layout state → Zustand store with `persist` middleware
- Backend config/system data → typed fetch via `lib/api/client.ts`

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

Commits: Conventional Commits in **English**, imperative mood, one logical change per commit.

PR description must include: **Was / Warum / Wie** + checklist (see `AGENT.md`).

---

## Environment

Copy `.env.linos.example` → `.env.linos` and set:
- `LINOS_HOST_IP` – host IP (e.g. `192.168.2.31`)
- `VITE_HA_URL` – Home Assistant URL
- `VITE_HA_TOKEN` – HA Long-Lived Access Token
- `TS_AUTHKEY` – Tailscale auth key

`.env.linos` is gitignored and must never be committed.

---

## Pre-Commit Checklist

```
□ tsc compiles without errors (pnpm typecheck)
□ No `any` types
□ No console.log (except in error handlers)
□ No commented-out code blocks
□ HA entities handle unavailable/unknown states
□ New components wrapped in CardErrorBoundary
□ Icons from @mdi/js (named imports)
□ HA data via @hakit/core hooks
□ Slate palette used for all colors
□ Responsive on mobile
```

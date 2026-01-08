# linBoard Frontend

**React + TypeScript + Vite + Tailwind CSS + Dark Mode**

Modern, responsive dashboard UI with component-driven architecture. Desktop-first responsive design with touch-friendly mobile support.

---

## 🚀 Quick Start (60 seconds)

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

## 📱 Architecture

### Routing

- `/` – Overview (dashboard homepage with health check demo)
- `/rooms` – Room management (stub)
- `/panels` – Panel management (stub)

### Layout

**Desktop (≥768px):**
- Fixed sidebar nav on left
- Main content on right
- Header spans full width

**Mobile (<768px):**
- Header at top
- Full-width content
- Bottom nav bar (touch-friendly, ≥48px height)

### Dark Mode

- **Default: ON** (no toggle in v0.1)
- Configured via Tailwind CSS class-based dark mode
- Colors: Slate-950 background, slate-100 text

---

## 🏗️ Folder Structure

```
src/
├── pages/                    # Page components (routed)
│   ├── OverviewPage.tsx
│   ├── RoomsPage.tsx
│   └── PanelsPage.tsx
├── components/
│   ├── layout/               # Layout components
│   │   ├── AppShell.tsx      # Main shell (header, nav, content)
│   │   ├── Header.tsx
│   │   ├── SidebarNav.tsx    # Desktop nav
│   │   └── BottomNav.tsx     # Mobile nav
│   ├── common/               # Reusable UI components
│   │   ├── LoadingState.tsx
│   │   ├── ErrorState.tsx
│   │   ├── EmptyState.tsx
│   │   └── StatusBadge.tsx
│   └── ui/                   # Primitives (Button, Card, Badge, Switch)
│       ├── button.tsx
│       ├── card.tsx
│       ├── badge.tsx
│       └── switch.tsx
├── lib/
│   ├── api/
│   │   ├── client.ts         # API fetch wrapper (typed, timeout, envelope)
│   │   └── types.ts          # API response types
│   └── utils.ts              # cn() helper for Tailwind merging
├── main.tsx                  # App entry point
└── index.css                 # Global Tailwind styles
```

---

## 🎨 Component Conventions

### Naming

- **Components:** PascalCase (`Button.tsx`, `ErrorState.tsx`)
- **Props interfaces:** `<ComponentName>Props`
- **Hooks:** camelCase, prefixed with `use` (e.g., `useHealthCheck`)

### Folder Organization

- **UI Primitives** (`src/components/ui/`): Reusable, unstyled base components
- **Common** (`src/components/common/`): Styled application components (Loading, Error, Status)
- **Layout** (`src/components/layout/`): Page-level layout composition
- **Pages** (`src/pages/`): Route-level containers

### Styling

- **Utility-first Tailwind CSS** for all styling
- Use `cn()` helper from `src/lib/utils.ts` to merge Tailwind classes
- No CSS-in-JS or scoped styles (Tailwind only)
- Dark mode via `dark:` prefix in classes (defaults to dark)

### Component Props

```typescript
import { cn } from "../../lib/utils";

export interface MyComponentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary";
}

export function MyComponent({ className, variant = "default", ...props }: MyComponentProps) {
  return (
    <div
      className={cn("base-styles", variant === "secondary" && "secondary-styles", className)}
      {...props}
    />
  );
}
```

---

## 🔌 API Integration

### Base URL

- **Dev:** `/api` (proxied to `http://localhost:4001` via Vite)
- **Prod:** `/api` (via Caddy `handle_path` strip)

### Client Usage

```typescript
import { fetchJson, ApiErrorException } from "@/lib/api/client";
import type { HealthResponse } from "@/lib/api/types";

// Fetch with timeout (8s), envelope parsing, error handling
const data = await fetchJson<HealthResponse>("/health");

// Errors are typed
try {
  await fetchJson("/data");
} catch (err) {
  if (err instanceof ApiErrorException) {
    console.log(err.message, err.code); // e.g., "Not Found", "NOT_FOUND"
  }
}
```

### Response Envelope

**Success:**
```json
{
  "ok": true,
  "data": { "status": "ok" }
}
```

**Error:**
```json
{
  "ok": false,
  "error": { "message": "Not Found", "code": "NOT_FOUND" }
}
```

### Vite Dev Proxy

Configured in `vite.config.ts`:
```typescript
proxy: {
  "/api": {
    target: "http://localhost:4001",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ""),
  }
}
```

This mirrors production Caddy behavior and avoids CORS complexity in dev.

---

## 📖 Storybook

### Run Storybook

```bash
cd apps/dashboard-web
pnpm storybook    # Opens http://localhost:6006
```

### Build Static Storybook

```bash
pnpm build-storybook
```

### Writing Stories

Stories live alongside components with `.stories.ts` suffix:

```typescript
// src/components/ui/button.stories.ts
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { children: "Click me", variant: "default" },
};
```

---

## 🛠️ Development Commands

```bash
cd apps

# Quality checks
pnpm typecheck      # TypeScript (no emit)
pnpm lint           # ESLint
pnpm format         # Prettier (write)

# Serve
pnpm dev            # Start web + API (pnpm workspaces)
pnpm -C dashboard-web dev
pnpm -C dashboard-api dev

# Build
pnpm build
pnpm -C dashboard-web build
```

---

## 🐳 Production Build

```bash
pnpm build
# Output: dist/
```

Docker build uses:
- Vite build output
- Caddy reverse proxy at `/api` route
- No build args needed in production

---

## 📦 Dependencies

### Runtime
- `react` – UI library
- `react-dom` – React rendering
- `react-router-dom` – Routing
- `clsx` – Class merging utility
- `tailwind-merge` – Tailwind class precedence

### Dev
- `vite` – Build tool (rolldown-vite)
- `typescript` – Type checking
- `tailwindcss` – Utility CSS
- `storybook` – Component development
- `eslint` – Linting
- `prettier` – Formatting

---

## 🎯 Conventions Summary

| Item | Convention |
|------|-----------|
| **Styling** | Tailwind CSS only (no scoped CSS) |
| **Dark Mode** | Default ON, class-based |
| **Components** | Functional, TypeScript, forwardRef for DOM refs |
| **Props** | Extend HTML attributes, use `cn()` for className |
| **Imports** | Absolute paths (if tsconfig configured) or relative |
| **Testing** | Storybook for UI, React Testing Library (future) |
| **State** | React hooks, no Redux (yet) |

---

## 🔮 Next Steps (Future Tickets)

- [ ] Room CRUD API integration
- [ ] Panel CRUD API integration
- [ ] Real device status display
- [ ] WebSocket for live updates (MQTT bridging)
- [ ] User preferences / theme toggle
- [ ] E2E tests (Cypress/Playwright)
- [ ] Accessibility audit (a11y)
- [ ] Mobile app shell (PWA)

---

## 📝 Environment Variables

### `.env.example`
```
VITE_API_BASE=/api
```

For local dev, Vite proxies `/api` to `localhost:4001`. No extra setup needed.

---

## ✅ Acceptance Checklist

- [x] Routes /, /rooms, /panels render
- [x] AppShell layout with sidebar (desktop) + bottom nav (mobile)
- [x] UI primitives: Button, Card, Badge, Switch
- [x] Standard components: LoadingState, ErrorState, EmptyState, StatusBadge
- [x] API client with timeout + envelope parsing
- [x] Overview page calls /api/health (demo)
- [x] Storybook configured with Button, Card, Badge, Switch, StatusBadge stories
- [x] Dark mode default ON
- [x] Vite dev proxy /api -> localhost:4001
- [x] TypeScript build succeeds

---

## 📚 References

- [React](https://react.dev)
- [Vite](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Storybook](https://storybook.js.org)
- [react-router-dom](https://reactrouter.com)

# AGENTS.md

## Cursor Cloud specific instructions

### Overview

linBoard is a smart-home dashboard (React + Express + TypeScript) using pnpm workspaces rooted at `apps/`. See `CLAUDE.md` for architecture, code patterns, and the pre-commit checklist.

### Running the development environment

All commands run from `apps/`:

- `pnpm install` — install all workspace dependencies
- `pnpm dev` — starts Vite dev server on `:4000` and Express API on `:4001` concurrently
- `pnpm typecheck` — TypeScript check (`tsc --noEmit`)
- `pnpm lint` — ESLint (note: there are pre-existing lint errors in the codebase)
- `pnpm build` — production build

### Caveats

- **esbuild build scripts**: The root `apps/package.json` has `pnpm.onlyBuiltDependencies` configured for `esbuild`. Without this, `pnpm install` will warn about ignored build scripts and esbuild won't have its native binary, causing Vite/build failures.
- **No external services required**: The dashboard degrades gracefully without Home Assistant, Docker socket, or other external services. The API starts with defaults and the frontend shows "unavailable" states for HA entities.
- **services.json health URLs**: The API logs validation warnings for `config/services.json` health URLs that reference `http://${LINOS_HOST_IP}:...` placeholder patterns. This is expected in dev — the service health-check feature simply won't resolve those services.
- **Timer API**: The timer REST API uses `durationMs` (milliseconds integer) and optional `label` string. Test with: `curl -X POST http://localhost:4001/timer/start -H "Content-Type: application/json" -d '{"durationMs":30000,"label":"test"}'`
- **Vite proxy**: In dev mode, Vite proxies `/api` requests to `localhost:4001`, matching the production Caddy setup. Direct API access is also available at `http://localhost:4001/`.

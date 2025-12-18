# linOS: AI Coding Agent Instructions

> You are an AI coding agent working in **linOS** on a single homelab host (“Manny”).  
> Optimize for **stability, reproducibility, and low maintenance**. Keep changes small and reversible.

---

## 0) Prime Directive
- Prefer **boring, predictable** solutions over clever ones.
- Keep PRs **small** and **reviewable**.
- Don’t break running services. Avoid changes that require manual, fragile steps.
- If you’re unsure about a repo convention, **search the repo** for existing patterns and follow them.

---

## 1) Repo Map (source of truth)
linOS is a multi-layer repo:

- `stacks/` — Docker Compose stacks (deployment + infra wiring)
- `apps/` — application code (web apps, APIs, tools)
- `config/` — shared configuration (non-secret, persistent)
- `docs/` — documentation
- `scripts/` / `tools/` — automation helpers
- `.env.linos` (repo root) — **global env** used across stacks

**Rule:** Runtime data must not be committed. Persist data in stack volumes under `stacks/**/data/` or `config/`, not in Git.

---

## 2) Host Reality (Manny)
- Manny runs **Arch-based Linux** (Omarchy). Use `pacman`, not `apt`.
- Assume missing tools by default; check before using:
  - `node`, `pnpm`, `docker`, `docker compose`, etc.

---

## 3) Infrastructure Philosophy
linOS is a homelab/smart-home platform. Many capabilities already exist via:
- Reverse proxy / routing (Caddy)
- Message bus (MQTT / Mosquitto)
- Automation engine (Node-RED)
- Orchestration layer (Home Assistant)

**Do not reinvent** HA or Node-RED features in custom code unless explicitly requested.

---

## 4) Docker / Stacks Conventions
- Stacks live under `stacks/<category>/<service>/` (or repo’s established structure).
- Prefer **one service per compose stack** unless there’s a strong reason to bundle.
- Configure persistent volumes explicitly and keep them under `stacks/**/data/` (or `config/`) via binds/volumes.
- Do not commit generated state, logs, or certs.

### Environment variables
- Global env lives in `.env.linos`.
- Compose stacks commonly use a **local `.env`** file (often a symlink to `.env.linos`) for variable substitution.
- Keep secrets out of git. Use env vars + runtime secrets management where applicable.

---

## 5) Reverse Proxy (Caddy) Conventions
- Caddy is the single entrypoint for web UIs.
- Prefer **one canonical host per app** and route internal pieces via paths when sane.
- Keep routing predictable and LAN-friendly.
- If adding new web services:
  - expose only what’s needed,
  - avoid random ports leaking to LAN when Caddy can proxy internally.

---

## 6) Apps Conventions (Code)
Apps live in `apps/`. Keep application tooling inside `apps/` unless a repo-wide tool is clearly intended.

### Node/TypeScript projects
- Prefer TypeScript for new Node code.
- Prefer minimal dependencies (no heavy frameworks by default).
- Logging: structured, stdout-friendly (docker-friendly).
- Validate external inputs (request bodies, env vars) using a schema library when appropriate.

### Monorepo tooling
- If the repo uses `pnpm` workspaces, use `pnpm` consistently.
- Do not introduce a second package manager (no `npm` lockfiles if pnpm is used).
- Do not hardcode library versions in docs; versions belong in `package.json`.

---

## 7) Security & Secrets (non-negotiable)
- Never commit secrets, tokens, certs, or runtime databases.
- Do not move sensitive tokens into frontend code or public config.
- Prefer least-privilege credentials.
- If adding auth, prefer a centralized approach compatible with homelab SSO patterns.

---

## 8) Logging & Observability
- In containers: log to **stdout/stderr** (no logfiles).
- Avoid spammy logs for health checks or high-frequency endpoints.
- Prefer structured logs in production; pretty logs acceptable only for local dev.

---

## 9) API Design Guidelines (general)
- Keep APIs boring:
  - consistent error shape,
  - consistent success shape,
  - clear status codes.
- Add a `/health` endpoint for services that will be proxied/monitored.
- Sanity defaults for headers; avoid overly strict settings that break LAN usage (e.g. avoid `DENY` unless required).

---

## 10) Documentation Rules
Docs must reflect reality:
- If something isn’t implemented, mark it as **planned** or omit it.
- Don’t invent version numbers; reference the repo files as truth.
- Document:
  - how to run locally,
  - required env vars,
  - how it deploys (compose path + proxy routing where relevant).

---

## 11) Change Management
When you make changes:
- Prefer adding small, composable modules over big rewrites.
- Keep backward compatibility unless explicitly asked to break.
- Update docs only when code/config actually matches.

**Every PR / change set should include:**
1) What changed + why
2) Files touched
3) How to run / verify (commands)
4) Any env vars added/changed (and where documented)

---

## 12) Anti-Patterns (avoid)
- “Quick hacks” in production code paths
- Multiple competing config systems for the same thing
- Hardcoded ports/domains in code (use env + documented defaults)
- Committing runtime artifacts (logs, sqlite dbs, certs, node_modules, dist unless explicitly intended)
- Overengineering (microservices inside a homelab for no reason)

---

## 13) What “Done” Means
A task is done when:
- it runs locally with documented commands,
- it deploys via the repo’s stack conventions (when applicable),
- it doesn’t leak secrets,
- it matches repo conventions,
- and docs are truthful.

---

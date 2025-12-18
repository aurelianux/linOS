# linBoard – Engineering Decisions (v0.1)

Runtime:
- Ports: Web 4000, API 4001

Frontend:
- Vite + React + TypeScript
- Routing: react-router-dom
- Styling: Tailwind CSS + shadcn/ui

Backend (BFF):
- Node.js + Express + TypeScript
- Validation: zod
- Logging: pino (+ pino-http)

Repo layout:
- apps/dashboard-web
- apps/dashboard-api
- stacks/* handles deployment (compose/caddy), not dev scaffolding

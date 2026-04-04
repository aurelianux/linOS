# linOS

Opinionated homelab and smart-home stack running on a Dell Wyse 5070 thin client ("Manny", Arch Linux). Container-based, reproducible, LAN-first.

## Structure

```
stacks/
├── infra/              # Mosquitto MQTT, Node-RED, Tailscale VPN
├── proxy/              # Caddy reverse proxy
├── dns/                # AdGuard Home (local DNS + ad filtering)
├── homeassistant/      # Home Assistant Core + config
├── zigbee2mqtt/        # Zigbee2MQTT + USB coordinator
└── applications/
    ├── plane/          # Plane project management
    ├── service-index/  # HTML landing page for all services
    └── dashboard/      # linBoard dashboard (Web + API)

apps/
├── dashboard-web/      # React 19, Vite, Tailwind, @hakit/core, Zustand
└── dashboard-api/      # Express 5, Zod, Pino — BFF for system data

config/
├── services.json       # Health-check definitions (consumed by dashboard-api)
└── dashboard.json      # Room/entity layout config

scripts/                # smrestart, smstatus, update_index.py
shell/                  # Host shell aliases (manny.zshrc)
docs/                   # Architecture docs, API reference, decisions
```

Runtime data (databases, logs, Caddy certs, Zigbee DB, etc.) is excluded via `.gitignore` and never committed.

## Prerequisites

- Linux host with Docker and Docker Compose
- Node.js 20+ and pnpm 10+ (for dashboard development)
- SSH access to the host

## Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/aurelianux/linOS.git
cd linOS

# 2. Copy the example environment file and fill in your values
cp .env.linos.example .env.linos

# 3. Create symlinks for each stack that needs environment variables
for dir in stacks/dns stacks/homeassistant stacks/infra stacks/proxy stacks/zigbee2mqtt stacks/applications/service-index; do
  ln -sf "$(pwd)/.env.linos" "$dir/.env"
done
```

> **Important:** `.env.linos` contains secrets and is gitignored. Never commit it — use `.env.linos.example` as a template.

## Starting the Stacks

```bash
# Start all stacks at once (reads config/services.json for stack paths)
./scripts/smrestart

# Or start individually:
cd stacks/infra && docker compose up -d
cd stacks/proxy && docker compose up -d
cd stacks/dns && docker compose up -d
cd stacks/homeassistant && docker compose up -d
cd stacks/zigbee2mqtt && docker compose up -d
```

### Applications

```bash
# Service Index (landing page)
cd stacks/applications/service-index && docker compose up -d

# Dashboard (linBoard) — builds from source
cd stacks/applications/dashboard && docker compose up --build -d

# Plane (project management)
cd stacks/applications/plane/plane-app && docker compose up -d
```

## Dashboard Development

```bash
cd apps
pnpm install
pnpm dev              # Start frontend :4000 + API :4001

# Quality checks
pnpm typecheck        # tsc --noEmit
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm build            # Production build
```

See [apps/dashboard-web/README.md](apps/dashboard-web/README.md) for frontend details and [docs/dashboard/API.md](docs/dashboard/API.md) for the API reference.

## Scripts & Shell Configuration

| Script | Description |
|---|---|
| `scripts/smrestart` | Restart all stacks via `docker compose up -d` (reads `config/services.json`) |
| `scripts/smstatus` | Show current container status |
| `scripts/update_index.py` | Regenerate `services.json` for the service index |

Shell aliases for the host are in `shell/manny.zshrc`. Source it from `~/.zshrc`:

```zsh
[[ -f ~/linOS/shell/manny.zshrc ]] && source ~/linOS/shell/manny.zshrc
```

## Backup Paths

| Data | Path |
|---|---|
| Home Assistant config | `stacks/homeassistant/config/` |
| Node-RED flows | `stacks/infra/nodered/` |
| Mosquitto data | `stacks/infra/mosquitto/data/` |
| AdGuard data | `stacks/dns/work/` |
| Zigbee2MQTT data | `stacks/zigbee2mqtt/data/` |
| Caddy certs | `stacks/proxy/data/` |

## Troubleshooting

```bash
# View logs for a stack
cd stacks/<stack> && docker compose logs

# Restart a single service
cd stacks/<stack> && docker compose restart <service>

# Check container status
./scripts/smstatus
```

## License

[MIT](LICENSE)

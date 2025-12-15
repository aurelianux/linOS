# AI Agent Instructions for linOS

## Project Overview

**linOS** is an opinionated homelab stack based on Docker Compose, hosting a smart home ecosystem with interconnected services. The architecture uses **modular service stacks** with a centralized reverse proxy.

## Architecture & Service Boundaries

1. **infra** (`stacks/infra/`) - Foundation services:
   - **Mosquitto**: MQTT broker (port 1883, WebSocket 9001) - message backbone for all automation
   - **Node-RED**: Visual automation/flow engine (port 1880) - connects services via MQTT
   - **Tailscale**: VPN tunnel for remote access (requires `TS_AUTHKEY` from `.env.linos`)

2. **proxy** (`stacks/proxy/`) - Caddy reverse proxy (network_mode: host)
   - Routes all HTTP/HTTPS traffic via `Caddyfile` using environment variables
   - Bridges container ports (1880, 8123, 3000, etc.) to configured domains
   - Uses `*.manny.lan` local hostnames (resolve via AdGuard)

3. **homeassistant** (`stacks/homeassistant/`) - Smart home hub
   - Mounts `/dev/serial/by-id/...` for Zigbee coordinator
   - Uses `network_mode: host` for device access
   - Trusted proxy: 127.0.0.1, 192.168.2.31
   - Config modularized: `automations.yaml`, `scripts.yaml`, `scenes.yaml`, `helpers.yaml`

4. **dns** (`stacks/dns/`) - AdGuard Home - local DNS filtering

5. **zigbee2mqtt** (`stacks/zigbee2mqtt/`) - Zigbee to MQTT bridge

### Applications
- **service-index** - Auto-generated dashboard listing all services (metadata in `scripts/update_index.py`)
- **plane** - Project management tool

### Data Persistence (all `.gitignore`d)
- Home Assistant: `stacks/homeassistant/config/.storage/`, `home-assistant_v2.db`
- Mosquitto: `stacks/infra/mosquitto/data/`, `stacks/infra/mosquitto/log/`
- Caddy: `caddy_config`, `caddy_data` (volumes)
- Backup-worthy paths: `stacks/homeassistant/config/`, `stacks/infra/nodered/`, `stacks/dns/work/`, `stacks/zigbee2mqtt/data/`

## Configuration & Environment

### Environment File: `.env.linos`
Loaded by all docker-compose files. Key variables:
- `TZ` - Timezone (default: Europe/Berlin)
- `TS_AUTHKEY` - Tailscale auth key
- `MQTT_PORT`, `MQTT_WS_PORT`, `NODE_RED_PORT`, `DNS_WEB_PORT`, etc.
- `LINOS_HA_HOST`, `LINOS_FLOW_HOST`, `LINOS_SERVICE_INDEX_HOST` - Domain names for Caddy

### Home Assistant Configuration
- **configuration.yaml** - Main config with modular includes
- **automations.yaml** - All automations (loaded via `!include`)
- **scripts.yaml** - Reusable scripts
- **helpers.yaml** - Custom helpers/template entities
- **blueprints/** - Reusable automation templates (YAML-based)
- **packages/** - Feature bundles (advanced modularization)
- **secrets.yaml** - `.gitignore`d; reference via `!secret key_name`

Default integrations + frontend themes loaded via `!include_dir_merge_named themes`

## Developer Workflows

### Starting Services
```bash
cd linOS/  # repo root
cd stacks/infra && docker compose up -d
cd stacks/proxy && docker compose up -d
cd stacks/dns && docker compose up -d
cd stacks/homeassistant && docker compose up -d
cd stacks/zigbee2mqtt && docker compose up -d
cd stacks/applications/service-index && docker compose up -d
cd stacks/applications/plane/plane-app && docker compose up -d
```

### Common Operations
- **View logs**: `cd stacks/<service> && docker compose logs`
- **Restart service**: `cd stacks/<service> && docker compose restart`
- **Rebuild service index**: `python3 scripts/update_index.py` (reads manny-shell.json, outputs services.json)
- **SSH to host**: Default host: 192.168.2.31 (Manny)

### Debugging
- Caddy: Edit `stacks/proxy/Caddyfile`, restart caddy stack
- Home Assistant: Check `configuration.yaml` includes; enable debug logs in UI or add to config
- MQTT: Check Mosquitto connectivity via Node-RED or Home Assistant MQTT integration
- Tailscale: Verify `TS_AUTHKEY` and check `/var/lib/tailscale` state in container

## Code Patterns & Conventions

### 1. Configuration-as-Code (Home Assistant)
- **YAML structure**: Deeply nested, uses anchors (`&`) and aliases (`*`) for reuse
- **Secrets**: Never commit sensitive values; use `!secret key` references
- **Templates**: Use Jinja2 in automations/conditions; leverage `helpers.yaml` for custom entities
- **Blueprints**: Reusable automation templates stored in `blueprints/automation/homeassistant/`
  - Example: `motion_light.yaml`, `notify_leaving_zone.yaml` - imported by automations

### 2. Docker Compose Stack Isolation
- Each service folder is independent; can be deployed separately
- Shared network via `docker network` (default bridge) or explicit network definitions
- Environment variables scoped per stack (`.env` file in stack directory or root `.env.linos`)
- Services reference each other by container name (e.g., `mosquitto:1883`, `nodered:1880`)

### 3. Service Communication (MQTT-Centric)
- Mosquitto is the message bus
- Home Assistant connects via MQTT integration (auto-discovery)
- Node-RED subscribes to topics and publishes commands
- Zigbee2MQTT publishes device state changes to MQTT

### 4. Reverse Proxy Pattern
- **Caddyfile** uses substitution: `{$VAR_NAME}` replaced from environment
- No TLS in compose setup (assuming internal network + Tailscale for external)
- All container ports are internal; external access only through Caddy

## Critical Integration Points

| Component | Communicates Via | Key Files |
|-----------|------------------|-----------|
| Home Assistant ↔ MQTT | MQTT Integration (localhost:1883) | `configuration.yaml` |
| Home Assistant ↔ Zigbee | Serial device USB | `docker-compose.yml` (devices) |
| Node-RED ↔ MQTT | MQTT nodes | `stacks/infra/nodered/` flows |
| Caddy ↔ Backend | HTTP reverse_proxy | `stacks/proxy/Caddyfile` |
| Services ↔ External | Tailscale VPN | `infra/docker-compose.yml` |

## Important Caveats

- **Network modes**: Home Assistant uses `network_mode: host` for device access; Caddy also `host` for listening on 80/443
- **Privilege requirements**: Home Assistant has `privileged: true` + CAP_NET_ADMIN for certain integrations
- **Port conflicts**: Ports are hardcoded in docker-compose and referenced in Caddyfile; changing one requires updating both
- **No custom components in git**: `stacks/homeassistant/config/custom_components/` is `.gitignore`d; install via UI
- **Secrets isolation**: Never log `.env.linos` or `secrets.yaml`; use local config overrides

## When Extending This Codebase

1. **Adding a new service**: Create `stacks/newservice/docker-compose.yml`, add entry to `config/manny-shell.json`, add Caddy route
2. **Modifying Home Assistant**: Edit YAML in `config/`, test via UI, commit only to git
3. **Adding automations**: Keep in `automations.yaml` or use blueprints for reusable logic
4. **Updating Node-RED flows**: Export flows as JSON from UI; consider version control strategy
5. **Secrets management**: Add to `.env.linos` (local) or use Home Assistant secrets (`.gitignore`d)

---

*Last updated: 2025-12-15. Focus on Docker Compose patterns, MQTT communication, Home Assistant YAML modularization, and reverse proxy configuration.*

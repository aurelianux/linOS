# linOS Architecture Overview

linOS bundles multiple Docker stacks into a cohesive homelab and smart-home system on the host "Manny" (Dell Wyse 5070, Arch Linux).

## Components

### infra

- Mosquitto (MQTT broker) as the central message bus for Home Assistant, Zigbee2MQTT, and Node-RED.
- Node-RED for automations, integrations, and HTTP endpoints.
- Tailscale VPN client for secure remote access to the LAN.

### proxy

- Caddy as reverse proxy in front of all web UIs.
- Handles unified hostnames, TLS certificates, and routing to internal containers.
- Runs in `network_mode: host`, routes by hostname via `LINOS_*_HOST` env vars.

### dns

- AdGuard Home as local DNS server and ad/tracker filter.
- Overrides local hostnames (configurable via `.env.linos`):
  - `manny.lan` — Service Index
  - `ha.manny.lan` — Home Assistant
  - `dns.manny.lan` — AdGuard Web UI
  - `flow.manny.lan` — Node-RED
  - `z2m.manny.lan` — Zigbee2MQTT
  - `plane.manny.lan` — Plane
  - `dashboard.lan` — linBoard Dashboard

### homeassistant

- Home Assistant Core with configuration in `stacks/homeassistant/config`.
- Uses MQTT (Mosquitto) for sensors/actuators, Zigbee2MQTT for Zigbee devices, and integrations for LAN devices.

### zigbee2mqtt

- Connects the Zigbee coordinator (USB dongle).
- Exposes all Zigbee devices via MQTT.
- Stores its database in `stacks/zigbee2mqtt/data`.

### applications

- **plane**: Plane app for project and task management. Located at `stacks/applications/plane/plane-app`.
- **service-index**: Static HTML page linking to all services. Accessible via proxy at `manny.lan`.
- **dashboard**: linBoard — full-stack dashboard (React + Express + TypeScript). Accessible at `dashboard.lan`. Source code in `apps/dashboard-web` and `apps/dashboard-api`.

## Data Persistence

Persistent data lives in:

| Data | Path |
|---|---|
| Home Assistant | `stacks/homeassistant/config/` |
| Zigbee2MQTT | `stacks/zigbee2mqtt/data/` |
| Mosquitto | `stacks/infra/mosquitto/data/` |
| AdGuard | `stacks/dns/work/` |
| Caddy | `stacks/proxy/data/` (Docker volume `caddy_data`) |

These directories are not tracked in git and should be included in backups.

## Data Flow

```
Zigbee sensor
  → USB coordinator → Zigbee2MQTT
  → Mosquitto MQTT :1883
  → Home Assistant (MQTT integration)
  → Node-RED (automations)

Browser
  → @hakit/core WebSocket → HA :8123   (entity state — never via BFF)
  → fetch → dashboard-api :4001         (system/Docker data only)
```

Caddy and AdGuard ensure all web UIs are accessible under meaningful hostnames on the LAN.

This document captures the big picture. Details for individual stacks are in their respective `docker-compose.yml` and configuration files.

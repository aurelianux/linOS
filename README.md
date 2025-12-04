# linOS

Opinionated Homelab / Smart-Home-Stack auf dem Host "Manny".

## Struktur

Dieses Repository geht davon aus, dass alles unter dem Ordner `stacks/` liegt:

- stacks/infra/ – Basisdienste wie MQTT (Mosquitto) und Node-RED
- stacks/proxy/ – Caddy Reverse-Proxy vor allen Web-UIs
- stacks/dns/ – AdGuard Home als lokaler DNS / Filter
- stacks/homeassistant/ – Home Assistant Core und Konfiguration
- stacks/zigbee2mqtt/ – Zigbee2MQTT und Koordinator
- stacks/applications/
  - plane/ – Plane Projektmanagement
  - service-index/ – einfache HTML-Übersichtsseite für alle Dienste

Runtime-Daten (Datenbanken, Logs, Caddy-ACME, Zigbee-DB usw.) sind über `.gitignore` ausgeschlossen und werden nicht committet.

## Voraussetzungen

- Linux Host mit Docker und Docker Compose
- Zugriff per SSH auf den Host (z. B. 192.168.2.31)

## Basis-Stack starten

Aus dem Repo-Root (Ordner `linOS`):

- `cd stacks/infra && docker compose up -d`
- `cd stacks/proxy && docker compose up -d`
- `cd stacks/dns && docker compose up -d`
- `cd stacks/homeassistant && docker compose up -d`
- `cd stacks/zigbee2mqtt && docker compose up -d`

## Anwendungen

Service-Index (Landingpage):

- `cd stacks/applications/service-index && docker compose up -d`

Plane:

- `cd stacks/applications/plane/plane-app && docker compose up -d`

## Wichtige Pfade für Backups

- Home Assistant Config: `stacks/homeassistant/config/`
- Node-RED Daten: `stacks/infra/nodered/`
- Mosquitto Daten: `stacks/infra/mosquitto/data/`
- AdGuard Daten: `stacks/dns/work/`
- Zigbee2MQTT Daten: `stacks/zigbee2mqtt/data/`

## Troubleshooting (Kurz)

- Logs ansehen: im jeweiligen Stack-Ordner `docker compose logs`
- Caddy neu starten: `cd stacks/proxy && docker compose restart`
- Home Assistant neu starten: `cd stacks/homeassistant && docker compose restart`

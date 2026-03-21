# linOS

Opinionated Homelab / Smart-Home-Stack auf dem Host "Manny".

## Struktur

Dieses Repository geht davon aus, dass alles unter dem Ordner `stacks/` liegt:

- `stacks/infra/` – MQTT (Mosquitto), Node-RED und Tailscale-VPN
- `stacks/proxy/` – Caddy Reverse-Proxy vor allen Web-UIs
- `stacks/dns/` – AdGuard Home als lokaler DNS / Filter
- `stacks/homeassistant/` – Home Assistant Core und Konfiguration
- `stacks/zigbee2mqtt/` – Zigbee2MQTT und Koordinator
- `stacks/applications/`
  - `plane/` – Plane Projektmanagement
  - `service-index/` – HTML-Übersichtsseite aller Dienste (erreichbar unter `manny.lan`)
  - `dashboard/` – linBoard Dashboard (Web + API, erreichbar unter `dashboard.manny.lan`)

Runtime-Daten (Datenbanken, Logs, Caddy-ACME, Zigbee-DB usw.) sind über `.gitignore` ausgeschlossen und werden nicht committet.

## Voraussetzungen

- Linux Host mit Docker und Docker Compose
- Zugriff per SSH auf den Host (z. B. 192.168.2.31)

## Erstkonfiguration

```bash
# Kopiere die Beispielkonfiguration und passe sie an:
cp .env.linos.example .env.linos
# Trage deinen Tailscale Auth-Key und Host-IP ein.
```

> **Hinweis:** `.env.linos` enthält Secrets und wird nicht versioniert.  
> Commit nie `.env.linos` direkt – nutze ausschließlich `.env.linos.example` als Vorlage.

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

Dashboard (linBoard):

- `cd stacks/applications/dashboard && docker compose up --build -d`

Plane:

- `cd stacks/applications/plane/plane-app && docker compose up -d`

## Wichtige Pfade für Backups

- Home Assistant Config: `stacks/homeassistant/config/`
- Node-RED Daten: `stacks/infra/nodered/`
- Mosquitto Daten: `stacks/infra/mosquitto/data/`
- AdGuard Daten: `stacks/dns/work/`
- Zigbee2MQTT Daten: `stacks/zigbee2mqtt/data/`
- Caddy Zertifikate/Daten: `stacks/proxy/data/` (Docker Volume `caddy_data`)

## Scripts & Shell-Konfiguration für Manny

### scripts/

| Skript | Beschreibung |
|---|---|
| `scripts/smrestart` | Alle Stacks per `docker compose up -d` neu starten (liest `config/services.json`). Log → `logs/` |
| `scripts/smstatus` | Aktuellen Container-Status anzeigen. Log → `logs/` |
| `scripts/update_index.py` | `services.json` für den Service-Index neu generieren. |

Skripte können direkt aus dem Repo ausgeführt werden – der Pfad zum Repo-Root wird automatisch aufgelöst:

```bash
~/linOS/scripts/smrestart
~/linOS/scripts/smstatus
```

### shell/manny.zshrc

`shell/manny.zshrc` enthält alle Manny-spezifischen Aliases und Funktionen (Docker-Shortcuts, `smrestart`, `smstatus`, `updateindex` usw.). Einbindung in `~/.zshrc`:

```zsh
[[ -f ~/linOS/shell/manny.zshrc ]] && source ~/linOS/shell/manny.zshrc
```

Nach einem `git pull` stehen die Änderungen in der nächsten Shell-Session automatisch zur Verfügung.

## Troubleshooting (Kurz)

- Logs ansehen: im jeweiligen Stack-Ordner `docker compose logs`
- Caddy neu starten: `cd stacks/proxy && docker compose restart`
- Home Assistant neu starten: `cd stacks/homeassistant && docker compose restart`
- Dashboard neu starten: `cd stacks/applications/dashboard && docker compose restart`

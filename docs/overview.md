# linOS Architektur-Überblick

linOS bündelt mehrere Docker-Stacks zu einem homogenen Homelab- und Smart-Home-System auf dem Host "Manny".

## Komponenten

### infra

- Mosquitto (MQTT Broker) als zentraler Message-Bus für:
  - Home Assistant
  - Zigbee2MQTT
  - Node-RED Flows
- Node-RED für Automationen, Integrationen, HTTP-Endpoints usw.

### proxy

- Caddy als Reverse-Proxy vor allen Web-UIs.
- Kümmert sich um:
  - einheitliche Hostnamen oder Pfade
  - TLS / Zertifikate, falls später nötig
  - Weiterleitung auf die internen Container

### dns

- AdGuard Home als lokaler DNS-Server und Werbe-/Tracker-Filter.
- Optional: Überschreibt lokale Hostnamen (zum Beispiel `plane.lan`, `homeassistant.lan`, `manny.lan`).

### homeassistant

- Home Assistant Core mit Konfigurationsordner `stacks/homeassistant/config`.
- Nutzt unter anderem:
  - MQTT (Mosquitto) für Sensoren und Aktoren
  - Zigbee2MQTT für Zigbee-Geräte
  - Integrationen für LAN-Geräte (z. B. Govee, Roborock).

### zigbee2mqtt

- Bindet den Zigbee-Koordinator (USB-Stick) ein.
- Stellt alle Zigbee-Geräte per MQTT bereit.
- Schreibt seine Datenbank in `stacks/zigbee2mqtt/data`.

### applications

- plane:
  - Plane App für Projekt- und Aufgabenmanagement.
  - Läuft im Ordner `stacks/applications/plane/plane-app`.
- service-index:
  - Statische HTML-Seite, die Links auf alle relevanten Dienste im Netzwerk sammelt.
  - Wird typischerweise über den Proxy unter der IP des Hosts angeboten.

## Datenhaltung

Persistente Daten liegen in:

- Home Assistant: `stacks/homeassistant/config/`
- Zigbee2MQTT: `stacks/zigbee2mqtt/data/`
- MQTT (Mosquitto): `stacks/infra/mosquitto/data/`
- AdGuard: `stacks/dns/work/`
- Caddy: `stacks/proxy/data/`

Diese Verzeichnisse werden nicht in Git versioniert und sollten in ein Backup einfließen.

## Typischer Datenfluss

- Zigbee-Sensor schickt Werte an den USB-Koordinator.
- Zigbee2MQTT schreibt die Daten als MQTT-Nachrichten in Mosquitto.
- Home Assistant liest die MQTT-Themen und aktualisiert Entitäten.
- Node-RED kann dieselben Topics lesen und komplexere Flows / Automationen bauen.
- Caddy und AdGuard sorgen dafür, dass die Web-UIs unter sinnvollen Adressen im LAN erreichbar sind.

Dieses Dokument fixiert das Big Picture, Details zu einzelnen Stacks stehen in deren `docker-compose.yml` und in der Home Assistant Konfiguration.

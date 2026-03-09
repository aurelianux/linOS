export type Language = "de" | "en";

export const translations = {
  de: {
    appTitle: "linBoard",
    appVersion: "v0.1",

    "nav.overview": "Übersicht",
    "nav.rooms": "Räume",
    "nav.panels": "Panels",

    "overview.title": "Übersicht",
    "overview.subtitle": "Willkommen bei linBoard v0.1",
    "overview.quickControls": "Schnellsteuerung",

    "panels.title": "Panels",
    "panels.subtitle": "Systemübersicht und Infrastrukturstatus.",

    "rooms.title": "Räume",
    "rooms.subtitle": "Räumliche Übersicht deiner Smart-Home-Geräte.",
    "rooms.noRooms": "Keine Räume konfiguriert",
    "rooms.noRoomsHint":
      "Füge Entity-IDs zur ROOM_CONFIG in src/pages/RoomsPage.tsx hinzu.",
    "rooms.noEntities": "Keine Geräte in diesem Raum.",
    "rooms.entitySingular": "Gerät",
    "rooms.entityPlural": "Geräte",

    "ha.title": "Home Assistant",
    "ha.label": "HA",
    "ha.notConfigured":
      "HA ist nicht konfiguriert. Setze VITE_HA_URL und VITE_HA_TOKEN in .env, um die Smart-Home-Integration zu aktivieren.",
    "ha.connecting": "Verbinde…",
    "ha.connected": "HA Verbunden",
    "ha.offline": "HA Offline",

    "panel.updated": "Aktualisiert ",
    "panel.refresh": "Aktualisieren",
    "panel.refreshLabel": "Aktualisieren {title}",

    "docker.title": "Docker Container",
    "docker.noContainers": "Keine laufenden Container gefunden.",
    "docker.socketHint":
      "Um Container aufzulisten, füge folgendes Volume zum dashboard-api Service in docker-compose.yml hinzu:",
    "docker.socketHintReplace":
      "Ersetze {HOST_DOCKER_SOCKET} durch /var/run/docker.sock auf Standard-Linux-Hosts.",

    "serviceStatus.title": "Stack Status",
    "serviceStatus.refresh": "Aktualisieren",
    "serviceStatus.updated": "Aktualisiert ",
    "serviceStatus.noServices":
      "Keine Dienste konfiguriert. Füge Einträge in config/services.json hinzu.",

    "entity.unavailable": "Nicht verfügbar",
    "entity.failedToLoad": "Fehler beim Laden",

    "lights.on": "An",
    "lights.off": "Aus",

    "overview.quickActions": "Modus",

    "lang.switch": "EN",
  },
  en: {
    appTitle: "linBoard",
    appVersion: "v0.1",

    "nav.overview": "Overview",
    "nav.rooms": "Rooms",
    "nav.panels": "Panels",

    "overview.title": "Overview",
    "overview.subtitle": "Welcome to linBoard v0.1",
    "overview.quickControls": "Quick Controls",

    "panels.title": "Panels",
    "panels.subtitle": "System overview and infrastructure status.",

    "rooms.title": "Rooms",
    "rooms.subtitle": "Spatial overview of your smart home entities.",
    "rooms.noRooms": "No rooms configured",
    "rooms.noRoomsHint":
      "Add entity IDs to ROOM_CONFIG in src/pages/RoomsPage.tsx to populate this view.",
    "rooms.noEntities": "No entities assigned to this room.",
    "rooms.entitySingular": "entity",
    "rooms.entityPlural": "entities",

    "ha.title": "Home Assistant",
    "ha.label": "HA",
    "ha.notConfigured":
      "HA is not configured. Set VITE_HA_URL and VITE_HA_TOKEN in .env to enable real-time smart home integration.",
    "ha.connecting": "Connecting…",
    "ha.connected": "HA Connected",
    "ha.offline": "HA Offline",

    "panel.updated": "Updated ",
    "panel.refresh": "Refresh",
    "panel.refreshLabel": "Refresh {title}",

    "docker.title": "Docker Containers",
    "docker.noContainers": "No running containers found.",
    "docker.socketHint":
      "To enable container listing, add the following volume to the dashboard-api service in docker-compose.yml:",
    "docker.socketHintReplace":
      "Replace {HOST_DOCKER_SOCKET} with /var/run/docker.sock on standard Linux hosts.",

    "serviceStatus.title": "Stack Status",
    "serviceStatus.refresh": "Refresh",
    "serviceStatus.updated": "Updated ",
    "serviceStatus.noServices":
      "No services configured. Add entries to config/services.json.",

    "entity.unavailable": "Unavailable",
    "entity.failedToLoad": "Failed to load",

    "lights.on": "On",
    "lights.off": "Off",

    "overview.quickActions": "Mode",

    "lang.switch": "DE",
  },
} as const;

export type TranslationKey = keyof typeof translations.de;

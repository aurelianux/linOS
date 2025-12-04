#!/usr/bin/env python3
from pathlib import Path
import json
import sys

try:
    import yaml  # type: ignore
except ImportError:
    yaml = None

ROOT = Path(__file__).resolve().parents[1]
STACKS_DIR = ROOT / "stacks"
OUTPUT = STACKS_DIR / "applications" / "service-index" / "services.json"

# Metadaten für bekannte Services (Namen, Icons, Text, Pfade)
SERVICE_META = {
    "homeassistant": {
        "name": "Home Assistant",
        "icon": "🏠",
        "tag": "Smart Home Zentrale",
        "group": "Smart Home",
        "desc": "Zentrale Smart-Home-Steuerung, Automationen und Dashboards.",
        "path": "/",
    },
    "nodered": {
        "name": "Node-RED",
        "icon": "🧠",
        "tag": "Flows & Logik",
        "group": "Automationen",
        "desc": "Visuelle Flows und Integrationen auf Basis von MQTT, HTTP usw.",
        "path": "/",
    },
    "adguardhome": {
        "name": "AdGuard Home",
        "icon": "🛡️",
        "tag": "DNS & Filter",
        "group": "Netzwerk",
        "desc": "DNS-Filter, Statistiken und lokale Hostnamen.",
        "path": "/",
    },
    "zigbee2mqtt": {
        "name": "Zigbee2MQTT",
        "icon": "📡",
        "tag": "Zigbee Bridge",
        "group": "Smart Home",
        "desc": "Bindet Zigbee-Geräte an MQTT an.",
        "path": "/",
    },
    "plane": {
        "name": "Plane",
        "icon": "📋",
        "tag": "Projektmanagement",
        "group": "Apps",
        "desc": "Projekte, Epics und Tasks.",
        "path": "/myprojects/",
    },
}

SKIP_PORTS = {1883, 1884, 3306, 5432, 6379}


def ensure_yaml():
    if yaml is None:
        sys.exit(
            "pyyaml ist nicht installiert.\n"
            "Installiere es z.B. mit:\n"
            "  pip install --user pyyaml\n"
            "oder (Arch):\n"
            "  sudo pacman -S python-yaml"
        )


def load_compose(path: Path):
    ensure_yaml()
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return data


def pick_http_port(ports):
    for raw in ports:
        host_part = str(raw).split(":")[0]
        try:
            p = int(host_part)
        except ValueError:
            continue
        if p in SKIP_PORTS:
            continue
        if p < 80:
            continue
        return p
    return None


def lookup_meta(svc_name: str, rel: Path):
    key = svc_name.lower()
    if key in SERVICE_META:
        return SERVICE_META[key]

    parts = [p.lower() for p in rel.parts]

    if "homeassistant" in parts:
        return SERVICE_META["homeassistant"]
    if "zigbee2mqtt" in parts:
        return SERVICE_META["zigbee2mqtt"]
    if "dns" in parts:
        return SERVICE_META["adguardhome"]
    if "plane" in parts:
        return SERVICE_META["plane"]

    return {}


def main():
    services = []

    for compose_path in STACKS_DIR.rglob("docker-compose.yml"):
        rel = compose_path.relative_to(ROOT)

        # Die Service-Index-Compose selbst nicht als Service anzeigen
        if "service-index" in rel.parts:
            continue

        data = load_compose(compose_path)
        svc_dict = data.get("services", {})
        if not isinstance(svc_dict, dict):
            continue

        for svc_name, cfg in svc_dict.items():
            ports = cfg.get("ports") or []
            if not ports:
                continue

            http_port = pick_http_port(ports)
            if http_port is None:
                continue

            meta = lookup_meta(svc_name, rel)
            group = meta.get("group") or (rel.parts[1] if len(rel.parts) > 1 else "stacks")

            service = {
                "id": meta.get("id") or svc_name.lower(),
                "name": meta.get("name") or svc_name,
                "icon": meta.get("icon") or "📦",
                "group": group,
                "tag": meta.get("tag") or group,
                "desc": meta.get("desc") or f"{svc_name} ({rel})",
                "port": http_port,
                "host": meta.get("host") or None,
                "path": meta.get("path") or "/",
            }
            services.append(service)

    services.sort(key=lambda s: (s["group"], s["name"].lower()))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(services, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"[update_index] {len(services)} Services -> {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

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

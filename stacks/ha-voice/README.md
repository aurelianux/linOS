# ha-voice – Wyoming STT/TTS für Home Assistant Assist

## Was macht dieser Stack?

Stellt Wyoming-kompatible Spracheingabe (STT) und Sprachausgabe (TTS) für Home Assistant Assist bereit:

| Service | Image | Port |
|---|---|---|
| faster-whisper | `lscr.io/linuxserver/faster-whisper:gpu` | 10300 (Wyoming STT) |
| piper | `rhasspy/wyoming-piper:latest` | 10200 (Wyoming TTS) |

**Modell:** Whisper `medium` (Deutsch), Beam 5 — deutlich höhere Erkennungsgenauigkeit als das frühere CPU-Modell `base`.

## Warum Berta?

Der Stack läuft auf **Berta** (NVIDIA RTX 4070 Ti, Ubuntu 24.04) statt auf Manny, weil GPU-Inferenz die Latenz von ~10 s (CPU, base) auf unter 2 s (GPU, medium) reduziert. Voraussetzung: `nvidia-container-toolkit` installiert und `berta` Docker-Context auf Manny eingerichtet (M2).

> **Wenn der Docker-Context `berta` nicht existiert:** M2 wurde nicht abgeschlossen.
> Einrichten mit: `docker context create berta --docker "host=ssh://user@<BERTA_IP>"`

## Deployment

```bash
# Stack auf Berta starten (von Manny aus):
docker --context berta compose -f stacks/ha-voice/docker-compose.yml up -d

# Beim ersten Start werden Whisper-Modelle neu gepullt (~1,5 GB für medium).
# Keine Volume-Migration von Manny nötig — neu pullen ist schneller und konsistenter.
```

## HA nach dem Deploy umkonfigurieren

### 1. Lokale Add-ons entfernen (falls vorhanden)

Falls HA-Add-ons „Faster Whisper" oder „Whisper" lokal installiert sind, müssen diese **zuerst deinstalliert** werden — sonst sieht HA zwei Wyoming-Provider mit demselben Namen und die Pipelines werden inkonsistent.

> HA → **Settings → Add-ons** → „Faster Whisper" oder „Whisper" → **Uninstall**

### 2. Alte Wyoming-Integrationen entfernen

> HA → **Settings → Devices & Services** → Integrationen filtern nach „Wyoming"

Alle Einträge die auf `localhost:10300` oder `localhost:10200` zeigen → **Löschen** (drei Punkte → Delete).

### 3. Neue Wyoming-Integrationen anlegen

> HA → **Settings → Devices & Services** → **+ Add Integration** → „Wyoming Protocol"

Zwei Integrationen anlegen:

| Feld | Whisper (STT) | Piper (TTS) |
|---|---|---|
| Host | `<LINOS_HOST_BERTA_IP>` (Bertas LAN-IP) | `<LINOS_HOST_BERTA_IP>` |
| Port | `10300` | `10200` |

Die IP steht in `.env.linos` unter `LINOS_HOST_BERTA_IP`.

### 4. Voice-Pipelines anpassen

> HA → **Settings → Voice Assistants** → Pipeline auswählen → **Edit**

- **Speech-to-text:** Wyoming (faster-whisper on Berta)
- **Text-to-speech:** Wyoming (piper on Berta)
- Speichern.

## Smoke-Test

```bash
# 1. GPU wird erkannt (muss "CUDA" oder "GPU" in den ersten Log-Zeilen enthalten):
docker --context berta logs faster-whisper 2>&1 | head -30

# 2. Wyoming-Port erreichbar (von Manny aus):
nc -zv <LINOS_HOST_BERTA_IP> 10300 && echo "Whisper OK"
nc -zv <LINOS_HOST_BERTA_IP> 10200 && echo "Piper OK"
```

Anschließend in der HA-UI:
> **Settings → Voice Assistants** → Pipeline → **Test** (Mikrofon-Button)

Erwartete Antwortzeit: **unter 2 Sekunden** (vs. ~10 s vorher mit CPU-Whisper auf Manny).

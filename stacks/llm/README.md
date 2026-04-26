# llm – Ollama LLM-Backend auf Berta

## Was macht dieser Stack?

Stellt ein lokales LLM-Backend auf **Berta** (NVIDIA RTX 4070 Ti) bereit. Ollama exponiert zwei kompatible APIs:

| API | Endpunkt |
|---|---|
| Ollama-native | `http://<LINOS_HOST_BERTA_IP>:11434/api/...` |
| OpenAI-kompatibel | `http://<LINOS_HOST_BERTA_IP>:11434/v1/...` |

Die IP steht in `.env.linos` unter `LINOS_HOST_BERTA_IP`, der Port unter `LLM_PORT` (Standard: `11434`).

**Clients:** Home Assistant Conversation Agent (M5), Cursor, Continue.dev, Aider und alle weiteren OpenAI-/Ollama-API-kompatiblen Tools.

## Warum Berta?

GPU-Inferenz auf der RTX 4070 Ti ist ca. 20–50× schneller als CPU-Inferenz auf Manny. Für ein 4B-Modell (qwen3:4b) bedeutet das Antwortzeiten unter 2 s statt 30–60 s.

> **Wenn der Docker-Context `berta` nicht existiert:** M2 wurde nicht abgeschlossen.
> Einrichten mit: `docker context create berta --docker "host=ssh://user@<LINOS_HOST_BERTA_IP>"`

## Deployment

```bash
# Stack auf Berta starten (von Manny aus):
docker --context berta compose -f stacks/llm/docker-compose.yml up -d

# Initialer Modell-Pull (Skript pullt qwen3:4b + qwen2.5-coder:7b):
scripts/llm-pull-models.sh
```

> **Disk-Hinweis:** Modelle belegen 2–30 GB pro Stück. Sicherstellen dass das LV auf Berta genug freien Speicherplatz hat, bevor größere Modelle gepullt werden.

## Modelle (initialer Pull)

| Modell | VRAM | Verwendung |
|---|---|---|
| `qwen3:4b` | ~3 GB | HA Conversation Agent, Voice, allgemein |
| `qwen2.5-coder:7b` | ~5 GB | Coding-Assist (Cursor, Continue, Aider) |

### VRAM-Constraints (RTX 4070 Ti = 12 GB total)

Beide Modelle gleichzeitig geladen: ~8 GB — innerhalb der 12 GB.

Modelle größer als ~8 GB (z. B. `mistral-small:24b`, ~14 GB) erzwingen CPU-Offload, was die Inferenz dramatisch verlangsamt. Empfehlung: `qwen3:4b` als dauerhaftes Primärmodell im VRAM, Coder-Modell on-demand.

`OLLAMA_KEEP_ALIVE=5m` entlädt inaktive Modelle nach 5 Minuten automatisch aus dem VRAM, sodass größere Modelle on-demand ohne manuelle Verwaltung genutzt werden können.

## Modelle manuell verwalten

```bash
# Modell hinzufügen:
docker --context berta exec -it ollama ollama pull <modell>

# Verfügbare Modelle auflisten:
docker --context berta exec -it ollama ollama list

# Laufende Modelle / VRAM-Auslastung:
docker --context berta exec -it ollama ollama ps

# Modell sofort aus VRAM entladen (ohne Wartezeit):
docker --context berta exec -it ollama ollama stop <modell>

# Modell entfernen:
docker --context berta exec -it ollama ollama rm <modell>
```

## Smoke-Test

```bash
# 1. GPU wird erkannt (muss "CUDA" oder "gpu" in den ersten Log-Zeilen enthalten):
docker --context berta logs ollama 2>&1 | head -20

# 2. API erreichbar:
curl http://<LINOS_HOST_BERTA_IP>:11434/api/tags

# 3. Test-Inferenz (< 2 s = GPU aktiv; > 10 s = CPU-Fallback):
curl http://<LINOS_HOST_BERTA_IP>:11434/api/generate \
  -d '{"model":"qwen3:4b","prompt":"Hallo","stream":false}'
```

## Nächste Schritte

- **M5:** HA Conversation Agent + Voice-Pipeline auf Ollama umstellen.
- **Cursor / Continue:** API-Base auf `http://<LINOS_HOST_BERTA_IP>:11434/v1` setzen (client-seitig, nicht im Repo).

#!/usr/bin/env bash
# llm-pull-models.sh – Pull initial Ollama models on Berta.
#
# Run from Manny. Requires the 'berta' Docker context to be set up (M2).
# Idempotent: pulling a model that already exists is a no-op.
#
# Usage:
#   scripts/llm-pull-models.sh

set -euo pipefail

MODELS=(
  "qwen3:4b"           # HA Conversation Agent / Voice
  "qwen2.5-coder:7b"   # Coding-Assist (Cursor, Continue, Aider)
  # "mistral-small:24b"  # 14 GB VRAM — nur mit entladenem VRAM nutzbar; manuell freischalten
)

CONTAINER=$(docker --context berta ps -qf name=ollama)
if [[ -z "$CONTAINER" ]]; then
  echo "ERROR: No running 'ollama' container found on context 'berta'." >&2
  echo "       Start the stack first: docker --context berta compose -f stacks/llm/docker-compose.yml up -d" >&2
  exit 1
fi

for model in "${MODELS[@]}"; do
  echo "==> Pulling ${model} on Berta..."
  docker --context berta exec -i "$CONTAINER" ollama pull "$model"
done

echo ""
echo "==> Available models on Berta:"
docker --context berta exec -i "$CONTAINER" ollama list

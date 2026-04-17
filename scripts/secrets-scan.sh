#!/usr/bin/env bash
# Scan the repo for committed/staged secrets using gitleaks (via Docker).
#
# Usage:
#   scripts/secrets-scan.sh            # scan full git history
#   scripts/secrets-scan.sh --staged   # scan only staged changes (pre-commit)
#
# Requires Docker.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="zricethezav/gitleaks:latest"

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker is required (install or run gitleaks natively)" >&2
  exit 2
fi

if [[ "${1:-}" == "--staged" ]]; then
  exec docker run --rm -v "${REPO_ROOT}:/repo" "${IMAGE}" \
    protect --source /repo --staged --redact --verbose
fi

exec docker run --rm -v "${REPO_ROOT}:/repo" "${IMAGE}" \
  detect --source /repo --redact --verbose

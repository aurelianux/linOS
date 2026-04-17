#!/usr/bin/env bash
# Install repo git hooks into .git/hooks/ via symlink.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_SRC="${REPO_ROOT}/scripts/git-hooks"
HOOKS_DST="${REPO_ROOT}/.git/hooks"

mkdir -p "${HOOKS_DST}"
for hook in "${HOOKS_SRC}"/*; do
  name="$(basename "${hook}")"
  ln -sfv "${hook}" "${HOOKS_DST}/${name}"
done

echo "git hooks installed."

# shell/manny.zshrc
# Manny-specific shell configuration for linOS.
#
# Source this file from ~/.zshrc on the Manny server:
#
#   [[ -f ~/linOS/shell/manny.zshrc ]] && source ~/linOS/shell/manny.zshrc
#
# All paths are relative to LINOS_ROOT (default: ~/linOS).

export LINOS_ROOT="${LINOS_ROOT:-$HOME/linOS}"

# === SSH Agent ===
if [ -z "$SSH_AUTH_SOCK" ]; then
    eval "$(ssh-agent -s)" >/dev/null
fi

# === Docker / Smart-Home Shortcuts ===
alias dc='docker compose'
alias dcl='docker compose logs -f'
alias dps="docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
alias dpsx="docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'"
alias dcu='docker compose up -d'
alias dcd='docker compose down'

dlog() {
    if [ -z "$1" ]; then
        echo "Usage: dlog <container> [lines]"
        return 1
    fi
    docker compose logs -f --tail="${2:-100}" "$1"
}

# === Plane ===
alias planeup='cd "$LINOS_ROOT/stacks/applications/plane/plane-app" && set -a && source plane.env && set +a && docker compose up -d'
alias planedown='cd "$LINOS_ROOT/stacks/applications/plane/plane-app" && docker compose down'

# === linOS Scripts ===
# Run from anywhere – the scripts resolve REPO_ROOT themselves.
alias smrestart='$LINOS_ROOT/scripts/smrestart'
alias smstatus='$LINOS_ROOT/scripts/smstatus'

updateindex() {
    python3 "$LINOS_ROOT/scripts/update_index.py"
}

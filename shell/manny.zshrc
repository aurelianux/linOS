# shell/manny.zshrc
# Manny-specific shell configuration for linOS.
#
# Source this file from ~/.zshrc on the Manny server:
#
#   [[ -f ~/linOS/shell/manny.zshrc ]] && source ~/linOS/shell/manny.zshrc
#
# All paths are relative to LINOS_ROOT (default: ~/linOS).

export LINOS_ROOT="${LINOS_ROOT:-$HOME/linOS}"

# === General Shell Settings ===
export EDITOR=nano
export HISTSIZE=50000
export SAVEHIST=50000

if [ -n "$ZSH_VERSION" ]; then
  setopt HIST_IGNORE_DUPS
  setopt HIST_IGNORE_SPACE
fi

# === SSH Agent ===
if [ -z "$SSH_AUTH_SOCK" ]; then
    eval "$(ssh-agent -s)" >/dev/null
fi

# === Basic Aliases ===
alias ll='ls -la'
alias ports="sudo lsof -i -P -n | grep LISTEN"
alias htopd='htop --sort-key=PERCENT_CPU'

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

# === Git Shortcuts ===
alias gs='git status -sb'
alias ga='git add .'
alias gc='git commit -m'
alias gp='git push'

# === Plane ===
alias planeup='cd "$LINOS_ROOT/stacks/applications/plane/plane-app" && set -a && source plane.env && set +a && docker compose up -d'
alias planedown='cd "$LINOS_ROOT/stacks/applications/plane/plane-app" && docker compose down'

# === linOS Scripts ===
alias smrestart='$LINOS_ROOT/scripts/smrestart'
alias smstatus='$LINOS_ROOT/scripts/smstatus'

updateindex() {
    python3 "$LINOS_ROOT/scripts/update_index.py"
}

# === Utility Functions ===

# copytree: tree output to clipboard (Wayland or X11)
copytree() {
    local depth="${1:-3}"
    if command -v wl-copy >/dev/null 2>&1; then
        tree -L "$depth" | wl-copy
        echo "✔ tree copied (Wayland)"
    elif command -v xclip >/dev/null 2>&1; then
        tree -L "$depth" | xclip -selection clipboard
        echo "✔ tree copied (X11)"
    else
        echo "❌ No wl-copy/xclip installed."
    fi
}

# nomouse: disable mouse reporting in terminal
nomouse() {
    printf '\e[?1000l\e[?1002l\e[?1003l'
    echo "✔ Mouse reporting disabled."
}

# vpnfix: restart NetworkManager
vpnfix() {
    sudo systemctl restart NetworkManager
    echo "✔ NetworkManager restarted"
}

# myip: show local and public IP
myip() {
    echo "Local: $(hostname -I)"
    if command -v curl >/dev/null 2>&1; then
        echo "Public: $(curl -s ifconfig.me)"
    else
        echo "Public: curl not installed"
    fi
}

# serve: quick python HTTP server
serve() {
    local port="${1:-8000}"
    echo "Serving HTTP on port $port"
    python3 -m http.server "$port"
}

# === Manny Help ===
mannyhelp() {
    echo ""
    echo "  🖥  Manny Shell — linOS Commands"
    echo "  ─────────────────────────────────"
    echo ""
    echo "  Docker"
    echo "    dc          docker compose"
    echo "    dcu         docker compose up -d"
    echo "    dcd         docker compose down"
    echo "    dcl         docker compose logs -f"
    echo "    dps         container status (compact)"
    echo "    dpsx        container status (extended)"
    echo "    dlog <c>    tail logs for container <c>"
    echo ""
    echo "  linOS"
    echo "    smrestart   restart all stacks"
    echo "    smstatus    show stack status"
    echo "    updateindex regenerate services.json"
    echo ""
    echo "  Plane"
    echo "    planeup     start Plane stack"
    echo "    planedown   stop Plane stack"
    echo ""
    echo "  Git"
    echo "    gs          git status -sb"
    echo "    ga          git add ."
    echo "    gc <msg>    git commit -m <msg>"
    echo "    gp          git push"
    echo ""
    echo "  Utils"
    echo "    ll          ls -la"
    echo "    copytree    tree to clipboard (depth arg)"
    echo "    nomouse     disable mouse reporting"
    echo "    vpnfix      restart NetworkManager"
    echo "    myip        show local + public IP"
    echo "    serve       python HTTP server (port arg)"
    echo "    ports       show listening ports"
    echo "    htopd       htop sorted by CPU"
    echo ""
}


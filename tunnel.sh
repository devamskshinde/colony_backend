#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Colony Cloudflare Tunnel — Standalone Script
#
# Run this SEPARATELY from setup.sh. The tunnel URL stays stable
# as long as this script is running. Restarting the backend API
# does NOT affect the tunnel URL.
#
# Usage:  ./tunnel.sh           (start tunnel in background, exit terminal)
#         ./tunnel.sh stop      (stop the tunnel)
#         ./tunnel.sh status    (check if tunnel is running + show URL)
#         ./tunnel.sh 5000      (explicit port)
# ═══════════════════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

PORT=${1:-5000}

echo -e "${PURPLE}"
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║     Colony Cloudflare Tunnel                  ║"
echo "  ║     URL stays stable until YOU stop this      ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

# Handle subcommands
case "${1:-}" in
  stop)
    if [ -f .tunnel.pid ]; then
      PID=$(cat .tunnel.pid)
      if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        rm -f .tunnel.pid .tunnel-url
        echo -e "${GREEN}[✓]${NC} Tunnel stopped (PID: $PID)"
      else
        rm -f .tunnel.pid .tunnel-url
        echo -e "${YELLOW}[!]${NC} Tunnel was not running"
      fi
    else
      # Try killing by process name
      pkill -f "cloudflared tunnel --url" 2>/dev/null && echo -e "${GREEN}[✓]${NC} Tunnel stopped" || echo -e "${YELLOW}[!]${NC} No tunnel running"
    fi
    exit 0
    ;;
  status)
    if [ -f .tunnel.pid ] && kill -0 "$(cat .tunnel.pid)" 2>/dev/null; then
      URL=$(cat .tunnel-url 2>/dev/null || echo "URL not available")
      echo -e "${GREEN}[✓]${NC} Tunnel is running (PID: $(cat .tunnel.pid))"
      echo -e "  ${CYAN}URL:${NC} ${URL}"
      echo -e "  ${CYAN}Flutter:${NC} ${URL}/v1"
    else
      echo -e "${YELLOW}[!]${NC} Tunnel is not running"
      echo -e "  Start with: ./tunnel.sh"
    fi
    exit 0
    ;;
esac

PORT=${1:-5000}

# Install cloudflared if missing
if ! command -v cloudflared &>/dev/null; then
  echo -e "${YELLOW}[!]${NC} cloudflared not found. Installing..."
  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared 2>/dev/null
  sudo install -m 755 /tmp/cloudflared /usr/local/bin/cloudflared
  rm -f /tmp/cloudflared
  echo -e "${GREEN}[✓]${NC} cloudflared installed"
fi

# Check if tunnel already running
if pgrep -f "cloudflared tunnel --url" >/dev/null 2>&1; then
  echo -e "${YELLOW}[!]${NC} A tunnel is already running. Kill it first? (y/N)"
  read -r REPLY
  if [ "$REPLY" = "y" ] || [ "$REPLY" = "Y" ]; then
    pkill -f "cloudflared tunnel --url"
    sleep 1
    echo -e "${GREEN}[✓]${NC} Old tunnel killed"
  else
    echo -e "${RED}[✗]${NC} Exiting. Kill the old tunnel first: pkill -f 'cloudflared tunnel --url'"
    exit 1
  fi
fi

# Check API
if curl -sf http://127.0.0.1:${PORT}/health >/dev/null 2>&1; then
  echo -e "${GREEN}[✓]${NC} API is running on port ${PORT}"
else
  echo -e "${YELLOW}[!]${NC} API is NOT running on port ${PORT} yet"
  echo -e "${BLUE}[i]${NC} The tunnel will connect once the API starts"
  echo -e "${BLUE}[i]${NC} Start API with: cd colony_backend && node src/server.js"
fi

echo ""
echo -e "${BLUE}[i]${NC} Starting tunnel → http://127.0.0.1:${PORT}"
echo -e "${BLUE}[i]${NC} Keep this terminal open. Ctrl+C to stop."
echo ""

# Start tunnel in background, capture URL, then exit
TUNNEL_LOG="/tmp/colony-tunnel.log"
nohup cloudflared tunnel --url http://127.0.0.1:${PORT} > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!
echo "$TUNNEL_PID" > .tunnel.pid

echo -e "${BLUE}[i]${NC} Tunnel starting in background (PID: $TUNNEL_PID)..."
echo -e "${BLUE}[i]${NC} Waiting for URL..."

# Wait for URL to appear in logs (max 30 seconds)
TUNNEL_URL=""
for i in $(seq 1 30); do
  TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1 || echo "")
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
  sleep 1
done

if [ -n "$TUNNEL_URL" ]; then
  echo "$TUNNEL_URL" > .tunnel-url

  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  TUNNEL IS LIVE IN BACKGROUND${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${CYAN}Public URL:${NC}  ${TUNNEL_URL}"
  echo -e "  ${CYAN}Flutter:${NC}      ${TUNNEL_URL}/v1"
  echo -e "  ${CYAN}Health:${NC}       ${TUNNEL_URL}/health"
  echo -e "  ${CYAN}PID:${NC}          ${TUNNEL_PID}"
  echo ""
  echo -e "  ${YELLOW}Update Flutter:${NC}"
  echo -e "    colony_app/lib/core/config/app_config.dart"
  echo -e "    apiBaseUrl: '${TUNNEL_URL}/v1'"
  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${BLUE}[i]${NC} Tunnel runs in background. Your terminal is free."
  echo -e "${BLUE}[i]${NC} Stop with: kill \$(cat .tunnel.pid)"
  echo -e "${BLUE}[i]${NC} View logs: tail -f $TUNNEL_LOG"
  echo -e "${BLUE}[i]${NC} Restart backend freely — tunnel URL won't change."
else
  echo -e "${RED}[✗]${NC} Could not get tunnel URL after 30s"
  echo -e "${BLUE}[i]${NC} Check logs: tail -f $TUNNEL_LOG"
  echo -e "${BLUE}[i]${NC} It may appear shortly — run: cat .tunnel-url"
fi

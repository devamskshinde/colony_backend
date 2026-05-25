#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Colony Cloudflare Tunnel — Standalone Script
#
# Run this SEPARATELY from setup.sh. The tunnel URL stays stable
# as long as this script is running. Restarting the backend API
# does NOT affect the tunnel URL.
#
# Usage:  ./tunnel.sh           (default port 5000)
#         ./tunnel.sh 5000      (explicit port)
#
# Keep this running in its own terminal. Press Ctrl+C to stop.
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

# Start tunnel, capture and display URL
cloudflared tunnel --url http://127.0.0.1:${PORT} 2>&1 | while IFS= read -r line; do
  # Show cloudflared output
  echo "$line"

  # Extract URL when it appears
  if echo "$line" | grep -qoP 'https://[a-z0-9-]+\.trycloudflare\.com'; then
    URL=$(echo "$line" | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com')
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  TUNNEL IS LIVE${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${CYAN}Public URL:${NC}  ${URL}"
    echo -e "  ${CYAN}Flutter:${NC}      ${URL}/v1"
    echo -e "  ${CYAN}Health:${NC}       ${URL}/health"
    echo ""
    echo -e "  ${YELLOW}Update Flutter:${NC}"
    echo -e "    colony_app/lib/core/config/app_config.dart"
    echo -e "    Change apiBaseUrl to: ${URL}/v1"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}[i]${NC} URL is stable. Restart backend freely — tunnel stays up."
    echo -e "${BLUE}[i]${NC} Press Ctrl+C to stop tunnel."
    echo ""

    # Save URL to file for reference
    echo "${URL}" > .tunnel-url
  fi
done

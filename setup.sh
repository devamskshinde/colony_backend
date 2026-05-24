#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Colony Backend — One-Click Setup Script v5.0
# All-in-one: Docker + API + Admin Panel + Cloudflare Tunnel
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

COLONY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${COLONY_DIR}/setup.log"
ENV_FILE="${COLONY_DIR}/.env"
API_PORT=5000
ADMIN_PORT=3000

log()   { echo -e "${GREEN}[✓]${NC} $1" | tee -a "$LOG_FILE"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[✗]${NC} $1" | tee -a "$LOG_FILE"; }
info()  { echo -e "${BLUE}[i]${NC} $1" | tee -a "$LOG_FILE"; }
header(){ echo -e "\n${PURPLE}═══ $1 ═══${NC}\n" | tee -a "$LOG_FILE"; }

# ═══════════════════════════════════════════════════════════════
# Banner
# ═══════════════════════════════════════════════════════════════
echo -e "${PURPLE}"
cat << 'BANNER'
   ██████╗ ██████╗ ██╗      ██████╗ ███╗   ██╗██╗   ██╗
  ██╔════╝██╔═══██╗██║     ██╔═══██╗████╗  ██║╚██╗ ██╔╝
  ██║     ██║   ██║██║     ██║   ██║██╔██╗ ██║ ╚████╔╝
  ██║     ██║   ██║██║     ██║   ██║██║╚██╗██║  ╚██╔╝
  ╚██████╗╚██████╔╝███████╗╚██████╔╝██║ ╚████║   ██║
   ╚═════╝ ╚═════╝ ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝
   Backend Setup Script v5.0 — All-in-One
BANNER
echo -e "${NC}"

# ═══════════════════════════════════════════════════════════════
# Self-update from GitHub
# ═══════════════════════════════════════════════════════════════
header "Syncing Latest Code"
if [ -d "${COLONY_DIR}/.git" ]; then
  cd "$COLONY_DIR"
  git stash 2>/dev/null || true
  git fetch origin 2>&1 | tee -a "$LOG_FILE"
  git reset --hard origin/master 2>&1 | tee -a "$LOG_FILE" || warn "Git sync failed"
  log "Code synced"
fi

# ═══════════════════════════════════════════════════════════════
# Pre-flight
# ═══════════════════════════════════════════════════════════════
header "Pre-flight Checks"

check_command() {
  command -v "$1" &> /dev/null && { log "$1 found"; return 0; } || return 1
}

if ! check_command docker; then
  warn "Installing Docker..."
  curl -fsSL https://get.docker.com | sh 2>&1 | tee -a "$LOG_FILE"
  sudo usermod -aG docker "$USER" 2>/dev/null || true
  log "Docker installed"
fi

if ! docker compose version &>/dev/null; then
  sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
fi

if ! check_command node; then
  warn "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs 2>&1 | tee -a "$LOG_FILE"
fi
log "Node $(node --version)"

# ═══════════════════════════════════════════════════════════════
# Environment — fixed defaults (override via env vars for prod)
# ═══════════════════════════════════════════════════════════════
header "Environment Configuration"

DB_PASSWORD="${DB_PASSWORD:-colony_db_pass_2024}"
REDIS_PASSWORD="${REDIS_PASSWORD:-colony_redis_pass_2024}"
RABBITMQ_PASSWORD="${RABBITMQ_PASSWORD:-colony_rabbit_pass_2024}"
JWT_SECRET="${JWT_SECRET:-colony_jwt_secret_key_change_in_prod_32chars}"
JWT_ADMIN_SECRET="${JWT_ADMIN_SECRET:-colony_jwt_admin_secret_change_in_prod}"
REQUEST_SIGNING_SECRET="${REQUEST_SIGNING_SECRET:-colony_signing_secret_change_in_prod}"
DEVICE_SECRET="${DEVICE_SECRET:-colony_device_secret_change_in_production}"

cat > "$ENV_FILE" << EOF
# Colony Backend — $(date -u +"%Y-%m-%d %H:%M:%S UTC")

NODE_ENV=production
PORT=${API_PORT}
HOST=0.0.0.0

DB_HOST=localhost
DB_PORT=5432
DB_NAME=colony
DB_USER=colony_user
DB_PASSWORD=${DB_PASSWORD}
DB_POOL_MAX=100

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

JWT_SECRET=${JWT_SECRET}
JWT_ADMIN_SECRET=${JWT_ADMIN_SECRET}
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=30d

REQUEST_SIGNING_SECRET=${REQUEST_SIGNING_SECRET}
DEVICE_SECRET=${DEVICE_SECRET}

RABBITMQ_URL=amqp://colony:${RABBITMQ_PASSWORD}@localhost:5672

OTP_MOCK=true

ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=admin123
ADMIN_ALLOWED_IPS=

LOG_LEVEL=info
EOF

chmod 600 "$ENV_FILE"
log ".env created"

# ═══════════════════════════════════════════════════════════════
# Clean slate
# ═══════════════════════════════════════════════════════════════
header "Clean Slate — Resetting Docker"

cd "$COLONY_DIR"
docker compose down -v 2>/dev/null || true
docker rm -f colony-postgres colony-redis colony-rabbitmq colony-pgbouncer colony-api 2>/dev/null || true
fuser -k ${API_PORT}/tcp 2>/dev/null || true
fuser -k ${ADMIN_PORT}/tcp 2>/dev/null || true
log "All containers and volumes removed"

# ═══════════════════════════════════════════════════════════════
# Start Docker Services
# ═══════════════════════════════════════════════════════════════
header "Starting Docker Services"

docker compose up -d 2>&1 | tee -a "$LOG_FILE"

# Wait for PostgreSQL (test actual password auth, retry up to 60 times)
info "Waiting for PostgreSQL (testing password auth)..."
DB_READY=false
for i in $(seq 1 60); do
  if docker exec colony-postgres psql -U colony_user -d colony -c "SELECT 1" &>/dev/null; then
    log "PostgreSQL ready and password verified"
    DB_READY=true
    break
  fi
  if [ $((i % 10)) -eq 0 ]; then
    info "Still waiting... (attempt $i/60)"
    docker logs colony-postgres 2>&1 | tail -2 | tee -a "$LOG_FILE"
  fi
  sleep 3
done

if [ "$DB_READY" = false ]; then
  error "PostgreSQL failed after 60 attempts"
  docker logs colony-postgres 2>&1 | tail -10
  exit 1
fi

# Wait for Redis
info "Waiting for Redis..."
for i in $(seq 1 15); do
  if docker exec colony-redis redis-cli -a "${REDIS_PASSWORD}" ping 2>/dev/null | grep -q PONG; then
    log "Redis ready"
    break
  fi
  [ "$i" -eq 15 ] && { error "Redis failed"; exit 1; }
  sleep 2
done

# Wait for RabbitMQ
info "Waiting for RabbitMQ..."
for i in $(seq 1 30); do
  if docker exec colony-rabbitmq rabbitmq-diagnostics check_running &>/dev/null; then
    log "RabbitMQ ready"
    break
  fi
  [ "$i" -eq 30 ] && warn "RabbitMQ slow, continuing..."
  sleep 3
done

# ═══════════════════════════════════════════════════════════════
# Install API dependencies
# ═══════════════════════════════════════════════════════════════
header "Installing API Dependencies"

cd "$COLONY_DIR"
npm install --omit=dev 2>&1 | tee -a "$LOG_FILE"
log "API dependencies installed"

# ═══════════════════════════════════════════════════════════════
# Install Admin Panel dependencies
# ═══════════════════════════════════════════════════════════════
header "Installing Admin Panel Dependencies"

cd "$COLONY_DIR/admin"
if [ -f "package.json" ]; then
  npm install 2>&1 | tee -a "$LOG_FILE"
  log "Admin panel dependencies installed"
else
  warn "admin/package.json not found — skipping admin panel"
fi

# ═══════════════════════════════════════════════════════════════
# Seed admin user
# ═══════════════════════════════════════════════════════════════
header "Seeding Admin User"

cd "$COLONY_DIR"
node -e "
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
async function seed() {
  const pool = new Pool({
    host: 'localhost', port: 5432, database: 'colony',
    user: 'colony_user', password: '${DB_PASSWORD}',
    connectionTimeoutMillis: 10000,
  });
  try {
    await pool.query('SELECT 1');
    const hash = await bcrypt.hash('admin123', 12);
    await pool.query(
      'INSERT INTO admin_users (username, password_hash, email, role, permissions) VALUES (\$1, \$2, \$3, \$4, \$5) ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash',
      ['admin', hash, 'admin@colony.app', 'super_admin', JSON.stringify({'*': true})]
    );
    console.log('Admin seeded: admin / admin123');
  } catch (e) {
    console.error('Admin seed:', e.message);
  } finally { await pool.end(); }
}
seed();
" 2>&1 | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════
# Start API Server
# ═══════════════════════════════════════════════════════════════
header "Starting Colony API"

cd "$COLONY_DIR"
fuser -k ${API_PORT}/tcp 2>/dev/null || true

if command -v pm2 &>/dev/null; then
  pm2 delete colony-api 2>/dev/null || true
  pm2 start src/server.js --name colony-api 2>&1 | tee -a "$LOG_FILE"
  log "API started with PM2"
else
  nohup node src/server.js > colony-api.log 2>&1 &
  echo $! > colony-api.pid
  log "API started (PID: $!)"
fi

# Wait for API
info "Waiting for API..."
API_OK=false
for i in $(seq 1 30); do
  RESPONSE=$(curl -sf http://localhost:${API_PORT}/health 2>/dev/null || echo "")
  if echo "$RESPONSE" | grep -q '"status":"ok"'; then
    log "API responding on port ${API_PORT}"
    API_OK=true
    break
  fi
  sleep 2
done

if [ "$API_OK" = false ]; then
  error "API failed to start. Last 30 lines:"
  tail -30 colony-api.log 2>/dev/null || echo "(no log)"
fi

# ═══════════════════════════════════════════════════════════════
# Start Admin Panel (Next.js)
# ═══════════════════════════════════════════════════════════════
header "Starting Admin Panel"

cd "$COLONY_DIR/admin"
if [ -f "package.json" ]; then
  fuser -k ${ADMIN_PORT}/tcp 2>/dev/null || true
  nohup npm run dev > ../admin-panel.log 2>&1 &
  ADMIN_PID=$!
  echo "$ADMIN_PID" > ../admin-panel.pid
  log "Admin panel starting (PID: $ADMIN_PID)"
  info "Admin panel: http://localhost:${ADMIN_PORT}"
  info "Login: admin / admin123"
else
  warn "Admin panel not found"
fi

# ═══════════════════════════════════════════════════════════════
# Cloudflare Tunnel (optional)
# ═══════════════════════════════════════════════════════════════
header "Cloudflare Tunnel (Public URL)"

TUNNEL_URL=""
USE_TUNNEL=false

# Check if cloudflared is installed
if ! check_command cloudflared; then
  echo ""
  echo -e "${YELLOW}Cloudflare Tunnel gives you a public HTTPS URL (like https://abc-xyz.trycloudflare.com)"
  echo -e "so your Flutter app can reach the backend from anywhere.${NC}"
  echo ""
  read -p "Install Cloudflare Tunnel? (y/N): " INSTALL_TUNNEL
  if [ "$INSTALL_TUNNEL" = "y" ] || [ "$INSTALL_TUNNEL" = "Y" ]; then
    info "Installing cloudflared..."
    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared 2>&1 | tee -a "$LOG_FILE"
    sudo install -m 755 /tmp/cloudflared /usr/local/bin/cloudflared
    rm -f /tmp/cloudflared
    log "cloudflared installed"
  fi
fi

if check_command cloudflared; then
  echo ""
  read -p "Start Cloudflare Tunnel for API (port ${API_PORT})? (Y/n): " START_TUNNEL
  if [ "$START_TUNNEL" != "n" ] && [ "$START_TUNNEL" != "N" ]; then
    USE_TUNNEL=true
    info "Starting Cloudflare Tunnel..."
    # Run cloudflared quick tunnel in background, capture URL
    nohup cloudflared tunnel --url http://localhost:${API_PORT} > ../tunnel.log 2>&1 &
    TUNNEL_PID=$!
    echo "$TUNNEL_PID" > ../tunnel.pid
    log "Tunnel started (PID: $TUNNEL_PID)"

    # Wait for tunnel URL to appear in logs
    info "Waiting for tunnel URL..."
    for i in $(seq 1 30); do
      TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' ../tunnel.log 2>/dev/null | head -1 || echo "")
      if [ -n "$TUNNEL_URL" ]; then
        log "Tunnel URL: ${TUNNEL_URL}"
        break
      fi
      sleep 2
    done

    if [ -z "$TUNNEL_URL" ]; then
      warn "Could not get tunnel URL. Check: tail -f tunnel.log"
      warn "You can also run manually: cloudflared tunnel --url http://localhost:${API_PORT}"
      USE_TUNNEL=false
    fi
  fi
fi

# ═══════════════════════════════════════════════════════════════
# Get IPs
# ═══════════════════════════════════════════════════════════════
PUBLIC_IP=$(curl -sf --connect-timeout 5 https://api.ipify.org 2>/dev/null || echo "")
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")

# ═══════════════════════════════════════════════════════════════
# Save tunnel URL to .env if available
# ═══════════════════════════════════════════════════════════════
if [ -n "$TUNNEL_URL" ]; then
  echo "" >> "$ENV_FILE"
  echo "# Cloudflare Tunnel URL — use this in Flutter app" >> "$ENV_FILE"
  echo "API_PUBLIC_URL=${TUNNEL_URL}" >> "$ENV_FILE"
fi

# ═══════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════
header "Setup Complete!"

echo -e "${GREEN}"
echo "  ╔═══════════════════════════════════════════════════════════════════╗"
echo "  ║                    COLONY BACKEND — READY                         ║"
echo "  ╠═══════════════════════════════════════════════════════════════════╣"
echo "  ║                                                                   ║"
echo "  ║  API Server:                                                     ║"
echo "  ║    http://localhost:${API_PORT}                                        ║"

if [ -n "$TUNNEL_URL" ]; then
  echo -e "  ║    ${CYAN}${TUNNEL_URL}${GREEN}                    ║"
  echo "  ║    ↑ USE THIS URL IN YOUR FLUTTER APP                            ║"
fi

if [ -n "$LOCAL_IP" ]; then
  echo -e "  ║    ${CYAN}http://${LOCAL_IP}:${API_PORT}${GREEN}  (local network)                      ║"
fi

echo "  ║                                                                   ║"
echo "  ║  Admin Panel:                                                    ║"
echo "  ║    http://localhost:${ADMIN_PORT}                                        ║"
echo "  ║    Login: admin / admin123                                       ║"
echo "  ║                                                                   ║"
echo "  ║  Database (use DB clients, not browser):                         ║"
echo "  ║    PostgreSQL: localhost:5432                                    ║"
echo "  ║    Redis:      localhost:6379                                    ║"
echo "  ║    RabbitMQ:   localhost:5672 (UI: localhost:15672)              ║"
echo "  ║                                                                   ║"
echo "  ║  Flutter App:                                                    ║"

if [ -n "$TUNNEL_URL" ]; then
  echo -e "  ║    Set API URL to: ${CYAN}${TUNNEL_URL}/v1${GREEN}              ║"
else
  echo "  ║    Set API URL to: http://YOUR_IP:${API_PORT}/v1                     ║"
fi

echo "  ║                                                                   ║"
echo "  ╚═══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Quick test
if [ "$API_OK" = true ]; then
  log "API health: OK"
  curl -s http://localhost:${API_PORT}/health | head -c 200
  echo ""
fi

if [ -n "$TUNNEL_URL" ]; then
  info "Flutter API URL: ${TUNNEL_URL}/v1"
  info "Update colony_app/lib/core/config/app_config.dart with this URL"
fi

info "Admin panel: http://localhost:${ADMIN_PORT}"
info "Logs: tail -f colony-api.log | tail -f admin-panel.log | tail -f tunnel.log"

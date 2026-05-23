#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Colony Backend — One-Click Setup Script
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

log()   { echo -e "${GREEN}[✓]${NC} $1" | tee -a "$LOG_FILE"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[✗]${NC} $1" | tee -a "$LOG_FILE"; }
info()  { echo -e "${BLUE}[i]${NC} $1" | tee -a "$LOG_FILE"; }
header(){ echo -e "\n${PURPLE}═══ $1 ═══${NC}\n" | tee -a "$LOG_FILE"; }

# ─── Banner ────────────────────────────────────────────────────
echo -e "${PURPLE}"
cat << 'BANNER'
   ██████╗ ██████╗ ██╗      ██████╗ ███╗   ██╗██╗   ██╗
  ██╔════╝██╔═══██╗██║     ██╔═══██╗████╗  ██║╚██╗ ██╔╝
  ██║     ██║   ██║██║     ██║   ██║██╔██╗ ██║ ╚████╔╝
  ██║     ██║   ██║██║     ██║   ██║██║╚██╗██║  ╚██╔╝
  ╚██████╗╚██████╔╝███████╗╚██████╔╝██║ ╚████║   ██║
   ╚═════╝ ╚═════╝ ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝
   Backend Setup Script v2.0
BANNER
echo -e "${NC}"

# ─── Self-update from GitHub ───────────────────────────────────
header "Syncing Latest Code"

if [ -d "${COLONY_DIR}/.git" ]; then
  info "Pulling latest changes from GitHub..."
  cd "$COLONY_DIR"
  git stash 2>/dev/null || true
  git fetch origin 2>&1 | tee -a "$LOG_FILE"
  git reset --hard origin/master 2>&1 | tee -a "$LOG_FILE" || {
    warn "Git sync failed — continuing with local code"
  }
  log "Code synced to latest"
else
  info "Not a git repo — using local files as-is"
fi

# ─── Pre-flight checks ────────────────────────────────────────
header "Pre-flight Checks"

check_command() {
  if command -v "$1" &> /dev/null; then
    log "$1 found: $(command -v "$1")"
    return 0
  else
    return 1
  fi
}

# Docker
if ! check_command docker; then
  warn "Docker not found. Installing..."
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sh /tmp/get-docker.sh 2>&1 | tee -a "$LOG_FILE"
  sudo usermod -aG docker "$USER" 2>/dev/null || true
  log "Docker installed"
fi

# Docker Compose
if ! docker compose version &> /dev/null; then
  warn "Docker Compose v2 not found. Installing..."
  sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
  log "Docker Compose installed"
fi

# Node.js
if ! check_command node; then
  warn "Node.js not found. Installing v20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs 2>&1 | tee -a "$LOG_FILE"
  log "Node.js installed: $(node --version)"
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  error "Node.js 18+ required. Found: $(node --version)"
  exit 1
fi
log "Node.js version OK: $(node --version)"

if ! check_command npm; then
  error "npm not found"
  exit 1
fi

# ─── Generate .env ─────────────────────────────────────────────
header "Environment Configuration"

ENV_FILE="${COLONY_DIR}/.env"

generate_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

# Always generate fresh secrets (don't reuse old .env)
if [ -f "$ENV_FILE" ]; then
  warn ".env exists — backing up to .env.backup"
  cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%s)"
fi

DB_PASSWORD="${DB_PASSWORD:-$(generate_secret | head -c 24)}"
REDIS_PASSWORD="${REDIS_PASSWORD:-$(generate_secret | head -c 24)}"
RABBITMQ_PASSWORD="${RABBITMQ_PASSWORD:-$(generate_secret | head -c 24)}"
JWT_SECRET="${JWT_SECRET:-$(generate_secret)}"
JWT_ADMIN_SECRET="${JWT_ADMIN_SECRET:-$(generate_secret)}"
REQUEST_SIGNING_SECRET="${REQUEST_SIGNING_SECRET:-$(generate_secret)}"
DEVICE_SECRET="${DEVICE_SECRET:-$(generate_secret)}"

cat > "$ENV_FILE" << EOF
# Colony Backend — Generated $(date -u +"%Y-%m-%d %H:%M:%S UTC")

NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# PostgreSQL — localhost because API runs on host, connects to Docker via exposed port
DB_HOST=localhost
DB_PORT=5432
DB_NAME=colony
DB_USER=colony_user
DB_PASSWORD=${DB_PASSWORD}
DB_POOL_MAX=100

# Redis — localhost because API runs on host
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_ADMIN_SECRET=${JWT_ADMIN_SECRET}
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=30d

# Request Signing
REQUEST_SIGNING_SECRET=${REQUEST_SIGNING_SECRET}
DEVICE_SECRET=${DEVICE_SECRET}

# RabbitMQ
RABBITMQ_URL=amqp://colony:${RABBITMQ_PASSWORD}@localhost:5672

# OTP (mock in dev — logs to console)
OTP_MOCK=true

# Admin
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=admin123
ADMIN_ALLOWED_IPS=

# Logging
LOG_LEVEL=info
EOF

chmod 600 "$ENV_FILE"
log ".env generated"
info "DB_PASSWORD: ${DB_PASSWORD:0:8}..."

# ─── Start Docker Services ─────────────────────────────────────
header "Starting Docker Services (PostgreSQL, Redis, RabbitMQ)"

cd "$COLONY_DIR"

# Stop any existing containers
docker compose down 2>/dev/null || true

# Start infrastructure only (API runs on host)
docker compose up -d 2>&1 | tee -a "$LOG_FILE"
log "Docker services starting..."

# Wait for PostgreSQL
info "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker exec colony-postgres pg_isready -U colony_user -d colony &>/dev/null; then
    log "PostgreSQL ready on port 5432"
    break
  fi
  if [ "$i" -eq 30 ]; then
    error "PostgreSQL failed to start"
    error "Check: docker logs colony-postgres"
    exit 1
  fi
  sleep 2
done

# Wait for Redis
info "Waiting for Redis..."
for i in $(seq 1 15); do
  if docker exec colony-redis redis-cli -a "${REDIS_PASSWORD}" ping 2>/dev/null | grep -q PONG; then
    log "Redis ready on port 6379"
    break
  fi
  if [ "$i" -eq 15 ]; then
    error "Redis failed to start"
    exit 1
  fi
  sleep 2
done

# Wait for RabbitMQ
info "Waiting for RabbitMQ..."
for i in $(seq 1 30); do
  if docker exec colony-rabbitmq rabbitmq-diagnostics check_running &>/dev/null; then
    log "RabbitMQ ready on port 5672"
    break
  fi
  if [ "$i" -eq 30 ]; then
    warn "RabbitMQ slow to start, continuing..."
    break
  fi
  sleep 3
done

# ─── Install Node Dependencies ─────────────────────────────────
header "Installing Dependencies"

cd "$COLONY_DIR"
npm install --omit=dev 2>&1 | tee -a "$LOG_FILE"
log "Node.js dependencies installed"

# ─── Seed Admin User ───────────────────────────────────────────
header "Seeding Admin User"

# Wait a moment for PostgreSQL to be fully ready
sleep 2

node -e "
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function seedAdmin() {
  // Connect directly to PostgreSQL (port 5432), not PgBouncer
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'colony',
    user: 'colony_user',
    password: '${DB_PASSWORD}',
    connectionTimeoutMillis: 5000,
  });

  try {
    // Test connection
    await pool.query('SELECT 1');

    const hash = await bcrypt.hash('${ADMIN_DEFAULT_PASSWORD:-admin123}', 12);

    await pool.query(\`
      INSERT INTO admin_users (username, password_hash, email, role, permissions)
      VALUES (\$1, \$2, \$3, \$4, \$5)
      ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
    \`, ['${ADMIN_DEFAULT_USERNAME:-admin}', hash, 'admin@colony.app', 'super_admin', JSON.stringify({'*': true})]);

    console.log('Admin user seeded: ${ADMIN_DEFAULT_USERNAME:-admin}');
  } catch (err) {
    console.error('Admin seed error:', err.message);
    console.error('The API will still start — admin can be created manually later.');
  } finally {
    await pool.end();
  }
}
seedAdmin();
" 2>&1 | tee -a "$LOG_FILE"

# ─── Kill any existing API process ─────────────────────────────
if [ -f "${COLONY_DIR}/colony-api.pid" ]; then
  OLD_PID=$(cat "${COLONY_DIR}/colony-api.pid")
  kill "$OLD_PID" 2>/dev/null || true
  rm -f "${COLONY_DIR}/colony-api.pid"
fi

# Kill any process on port 5000
fuser -k 5000/tcp 2>/dev/null || true

# ─── Start API Server ──────────────────────────────────────────
header "Starting Colony API Server"

cd "$COLONY_DIR"

if command -v pm2 &> /dev/null; then
  pm2 delete colony-api 2>/dev/null || true
  pm2 start src/server.js --name colony-api -i max --max-memory-restart 512M 2>&1 | tee -a "$LOG_FILE"
  pm2 save 2>&1 | tee -a "$LOG_FILE"
  log "API started with PM2 (cluster mode)"
else
  info "Starting with Node directly (install pm2 for production)..."
  nohup node src/server.js > colony-api.log 2>&1 &
  API_PID=$!
  echo "$API_PID" > "${COLONY_DIR}/colony-api.pid"
  log "API started (PID: $API_PID)"
fi

# ─── Wait for API ──────────────────────────────────────────────
info "Waiting for API to be ready..."
for i in $(seq 1 20); do
  if curl -sf http://localhost:5000/health > /dev/null 2>&1; then
    log "API server responding on port 5000"
    break
  fi
  if [ "$i" -eq 20 ]; then
    error "API not responding after 20 attempts"
    error "Check logs: tail -f colony-api.log"
    error "Common issues:"
    error "  - Database tables not created (check docker logs colony-postgres)"
    error "  - Port 5000 already in use"
    error "  - Missing env vars"
  fi
  sleep 2
done

# ─── Get public IP ─────────────────────────────────────────────
PUBLIC_IP=$(curl -sf --connect-timeout 5 https://api.ipify.org 2>/dev/null || echo "")
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")

# ─── Summary ───────────────────────────────────────────────────
header "Setup Complete!"

echo -e "${GREEN}"
cat << DONE
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                    COLONY BACKEND READY!                          ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║                                                                   ║
  ║  API Server:    http://localhost:5000                             ║
DONE

if [ -n "$PUBLIC_IP" ]; then
  echo -e "  ║  Public URL:    ${CYAN}http://${PUBLIC_IP}:5000${GREEN}                         ║"
fi
if [ -n "$LOCAL_IP" ]; then
  echo -e "  ║  Local Network: ${CYAN}http://${LOCAL_IP}:5000${GREEN}                     ║"
fi

cat << DONE
  ║  Health Check:  http://localhost:5000/health                      ║
  ║                                                                   ║
  ║  Admin Login:   admin / admin123                                  ║
  ║  ⚠ CHANGE THE ADMIN PASSWORD IMMEDIATELY!                        ║
  ║                                                                   ║
  ║  PostgreSQL:    localhost:5432 (user: colony_user)                ║
  ║  Redis:         localhost:6379                                    ║
  ║  RabbitMQ UI:   http://localhost:15672 (colony / colony_rabbit)   ║
  ║                                                                   ║
  ║  Logs:          tail -f colony-api.log                            ║
  ║  Restart:       node src/server.js (or pm2 restart colony-api)    ║
  ║  Stop:          docker compose down                               ║
  ║                                                                   ║
  ╚═══════════════════════════════════════════════════════════════════╝
DONE
echo -e "${NC}"

# Quick API test
info "Testing API..."
HEALTH=$(curl -sf http://localhost:5000/health 2>/dev/null || echo "failed")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  log "API health check: OK"
else
  warn "API health check failed — check tail -f colony-api.log"
fi

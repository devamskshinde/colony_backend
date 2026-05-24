#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Colony Backend — One-Click Setup Script v4.0
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
   Backend Setup Script v4.0
BANNER
echo -e "${NC}"

# ═══════════════════════════════════════════════════════════════
# Self-update
# ═══════════════════════════════════════════════════════════════
header "Syncing Latest Code"
if [ -d "${COLONY_DIR}/.git" ]; then
  cd "$COLONY_DIR"
  git stash 2>/dev/null || true
  git fetch origin 2>&1 | tee -a "$LOG_FILE"
  git reset --hard origin/master 2>&1 | tee -a "$LOG_FILE" || warn "Git sync failed"
  log "Code synced to latest"
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
  warn "Installing Docker Compose..."
  sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
fi

if ! check_command node; then
  warn "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs 2>&1 | tee -a "$LOG_FILE"
fi
log "Node $(node --version)"
check_command npm || { error "npm not found"; exit 1; }

# ═══════════════════════════════════════════════════════════════
# Generate passwords — ALWAYS use fixed defaults for dev
# This eliminates the password mismatch problem permanently.
# For production, override via environment variables before running.
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
# Override these with environment variables for production

NODE_ENV=production
PORT=5000
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
# Stop everything and nuke volumes for clean start
# This is the nuclear option that guarantees password consistency
# ═══════════════════════════════════════════════════════════════
header "Clean Slate — Resetting Docker"

cd "$COLONY_DIR"
docker compose down -v 2>/dev/null || true
docker rm -f colony-postgres colony-redis colony-rabbitmq colony-pgbouncer colony-api 2>/dev/null || true
fuser -k 5000/tcp 2>/dev/null || true

# Force remove volumes to guarantee fresh DB with correct password
docker volume rm colony_backend_postgres_data colony_backend_redis_data colony_backend_rabbitmq_data 2>/dev/null || true
log "All containers and volumes removed"

# ═══════════════════════════════════════════════════════════════
# Start Docker Services (fresh)
# ═══════════════════════════════════════════════════════════════
header "Starting Docker Services (Fresh)"

docker compose up -d 2>&1 | tee -a "$LOG_FILE"

# Wait for PostgreSQL to be fully ready (user created, DB initialized)
# pg_isready returns "accepting connections" before init scripts finish,
# so we must test actual password authentication with psql
info "Waiting for PostgreSQL (testing password auth)..."
DB_READY=false
for i in $(seq 1 60); do
  if docker exec colony-postgres psql -U colony_user -d colony -c "SELECT 1" &>/dev/null; then
    log "PostgreSQL ready and password verified on port 5432"
    DB_READY=true
    break
  fi
  # Show progress every 10 attempts
  if [ $((i % 10)) -eq 0 ]; then
    info "Still waiting for PostgreSQL... (attempt $i/60)"
    # Show postgres logs to help debug
    docker logs colony-postgres 2>&1 | tail -3 | tee -a "$LOG_FILE"
  fi
  sleep 3
done

if [ "$DB_READY" = false ]; then
  error "PostgreSQL failed after 60 attempts (3 minutes)"
  error "PostgreSQL logs:"
  docker logs colony-postgres 2>&1 | tail -20 | tee -a "$LOG_FILE"
  error ""
  error "Common causes:"
  error "  - Migrations SQL error (check logs above)"
  error "  - Docker out of memory"
  error "  - Port 5432 already in use"
  exit 1
fi

# Wait for Redis — use docker exec
info "Waiting for Redis..."
for i in $(seq 1 15); do
  if docker exec colony-redis redis-cli -a "${REDIS_PASSWORD}" ping 2>/dev/null | grep -q PONG; then
    log "Redis ready on port 6379"
    break
  fi
  [ "$i" -eq 15 ] && { error "Redis failed"; exit 1; }
  sleep 2
done

# Wait for RabbitMQ
info "Waiting for RabbitMQ..."
for i in $(seq 1 30); do
  if docker exec colony-rabbitmq rabbitmq-diagnostics check_running &>/dev/null; then
    log "RabbitMQ ready on port 5672"
    break
  fi
  [ "$i" -eq 30 ] && warn "RabbitMQ slow, continuing..."
  sleep 3
done

# ═══════════════════════════════════════════════════════════════
# Install dependencies
# ═══════════════════════════════════════════════════════════════
header "Installing Dependencies"
cd "$COLONY_DIR"
npm install --omit=dev 2>&1 | tee -a "$LOG_FILE"
log "Dependencies installed"

# ═══════════════════════════════════════════════════════════════
# Seed admin user via TCP connection
# ═══════════════════════════════════════════════════════════════
header "Seeding Admin User"

node -e "
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
async function seed() {
  const pool = new Pool({
    host: 'localhost', port: 5432, database: 'colony',
    user: 'colony_user', password: '${DB_PASSWORD}',
    connectionTimeoutMillis: 5000,
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
# Start API server
# ═══════════════════════════════════════════════════════════════
header "Starting Colony API"

cd "$COLONY_DIR"
fuser -k 5000/tcp 2>/dev/null || true

if command -v pm2 &>/dev/null; then
  pm2 delete colony-api 2>/dev/null || true
  pm2 start src/server.js --name colony-api 2>&1 | tee -a "$LOG_FILE"
  log "API started with PM2"
else
  nohup node src/server.js > colony-api.log 2>&1 &
  echo $! > colony-api.pid
  log "API started (PID: $!)"
fi

# Wait for API with proper health check
info "Waiting for API..."
API_OK=false
for i in $(seq 1 30); do
  RESPONSE=$(curl -sf http://localhost:5000/health 2>/dev/null || echo "")
  if echo "$RESPONSE" | grep -q '"status":"ok"'; then
    log "API responding on port 5000"
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
# IPs
# ═══════════════════════════════════════════════════════════════
PUBLIC_IP=$(curl -sf --connect-timeout 5 https://api.ipify.org 2>/dev/null || echo "")
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")

# ═══════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════
header "Setup Complete"

echo -e "${GREEN}"
echo "  ╔═══════════════════════════════════════════════════════════╗"
echo "  ║              COLONY BACKEND — SERVICES                    ║"
echo "  ╠═══════════════════════════════════════════════════════════╣"
echo "  ║                                                           ║"
echo "  ║  API Server (your app talks to this):                     ║"
echo "  ║    http://localhost:5000                                  ║"
[ -n "$PUBLIC_IP" ] && echo -e "  ║    ${CYAN}http://${PUBLIC_IP}:5000${GREEN}  (public)                  ║"
[ -n "$LOCAL_IP" ] && echo -e "  ║    ${CYAN}http://${LOCAL_IP}:5000${GREEN}  (local network)           ║"
echo "  ║    Health: http://localhost:5000/health                   ║"
echo "  ║                                                           ║"
echo "  ║  Admin Panel (run separately):                            ║"
echo "  ║    cd admin && npm install && npm run dev                 ║"
echo "  ║    http://localhost:3000                                  ║"
echo "  ║    Login: admin / admin123                                ║"
echo "  ║                                                           ║"
echo "  ║  Database (NOT websites — use database clients):          ║"
echo "  ║    PostgreSQL: localhost:5432 (colony_user / see .env)    ║"
echo "  ║    Redis:      localhost:6379 (password in .env)          ║"
echo "  ║    RabbitMQ:   localhost:5672 (UI: localhost:15672)       ║"
echo "  ║                                                           ║"
echo "  ║  Flutter App:                                             ║"
echo "  ║    Set API URL to: http://YOUR_IP:5000/v1                 ║"
echo "  ║                                                           ║"
echo "  ╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

if [ "$API_OK" = true ]; then
  log "Everything is running. API health: OK"
  info "Test: curl http://localhost:5000/health"
else
  error "API is NOT running. Fix the error above, then run: node src/server.js"
fi

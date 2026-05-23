#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Colony Backend — One-Click Setup Script v3.0
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

generate_secret() {
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

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
   Backend Setup Script v3.0
BANNER
echo -e "${NC}"

# ═══════════════════════════════════════════════════════════════
# Self-update from GitHub
# ═══════════════════════════════════════════════════════════════
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
fi

# ═══════════════════════════════════════════════════════════════
# Pre-flight checks
# ═══════════════════════════════════════════════════════════════
header "Pre-flight Checks"

check_command() {
  if command -v "$1" &> /dev/null; then
    log "$1 found: $(command -v "$1")"
    return 0
  else
    return 1
  fi
}

if ! check_command docker; then
  warn "Docker not found. Installing..."
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sh /tmp/get-docker.sh 2>&1 | tee -a "$LOG_FILE"
  sudo usermod -aG docker "$USER" 2>/dev/null || true
  log "Docker installed"
fi

if ! docker compose version &> /dev/null; then
  warn "Docker Compose v2 not found. Installing..."
  sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
  log "Docker Compose installed"
fi

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

check_command npm || { error "npm not found"; exit 1; }

# ═══════════════════════════════════════════════════════════════
# Environment — REUSE existing passwords, only generate if missing
# This is critical: Docker volumes persist DB passwords across runs
# ═══════════════════════════════════════════════════════════════
header "Environment Configuration"

# Read existing passwords from .env if it exists
read_env_var() {
  local key="$1"
  if [ -f "$ENV_FILE" ]; then
    grep "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo ""
  else
    echo ""
  fi
}

EXISTING_DB_PASS=$(read_env_var "DB_PASSWORD")
EXISTING_REDIS_PASS=$(read_env_var "REDIS_PASSWORD")
EXISTING_RABBIT_PASS=$(read_env_var "RABBITMQ_PASSWORD")
EXISTING_JWT=$(read_env_var "JWT_SECRET")
EXISTING_JWT_ADMIN=$(read_env_var "JWT_ADMIN_SECRET")
EXISTING_SIGNING=$(read_env_var "REQUEST_SIGNING_SECRET")
EXISTING_DEVICE=$(read_env_var "DEVICE_SECRET")

# Reuse existing passwords (critical for Docker volume persistence)
DB_PASSWORD="${EXISTING_DB_PASS:-$(generate_secret | head -c 24)}"
REDIS_PASSWORD="${EXISTING_REDIS_PASS:-$(generate_secret | head -c 24)}"
RABBITMQ_PASSWORD="${EXISTING_RABBIT_PASS:-$(generate_secret | head -c 24)}"
JWT_SECRET="${EXISTING_JWT:-$(generate_secret)}"
JWT_ADMIN_SECRET="${EXISTING_JWT_ADMIN:-$(generate_secret)}"
REQUEST_SIGNING_SECRET="${EXISTING_SIGNING:-$(generate_secret)}"
DEVICE_SECRET="${EXISTING_DEVICE:-$(generate_secret)}"

if [ -n "$EXISTING_DB_PASS" ]; then
  log "Reusing existing database password from .env"
else
  log "Generated new database password"
fi

cat > "$ENV_FILE" << EOF
# Colony Backend — Generated $(date -u +"%Y-%m-%d %H:%M:%S UTC")

NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=colony
DB_USER=colony_user
DB_PASSWORD=${DB_PASSWORD}
DB_POOL_MAX=100

# Redis
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

# OTP
OTP_MOCK=true

# Admin
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=admin123
ADMIN_ALLOWED_IPS=

# Logging
LOG_LEVEL=info
EOF

chmod 600 "$ENV_FILE"
log ".env saved"

# ═══════════════════════════════════════════════════════════════
# Stop old containers
# ═══════════════════════════════════════════════════════════════
header "Stopping Old Containers"

cd "$COLONY_DIR"
docker compose down 2>/dev/null || true
# Kill orphan containers
docker rm -f colony-pgbouncer colony-api 2>/dev/null || true
# Kill any process on port 5000
fuser -k 5000/tcp 2>/dev/null || true
log "Old containers stopped"

# ═══════════════════════════════════════════════════════════════
# Reset Docker volumes if first run (to ensure fresh DB)
# ═══════════════════════════════════════════════════════════════
if [ -n "$EXISTING_DB_PASS" ]; then
  info "Existing passwords detected — keeping database volumes"
else
  info "Fresh install — resetting database volumes"
  docker volume rm colony_backend_postgres_data 2>/dev/null || true
  docker volume rm colony_backend_redis_data 2>/dev/null || true
  docker volume rm colony_backend_rabbitmq_data 2>/dev/null || true
fi

# ═══════════════════════════════════════════════════════════════
# Start Docker Services
# ═══════════════════════════════════════════════════════════════
header "Starting Docker Services"

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
    error "Run: docker logs colony-postgres"
    exit 1
  fi
  sleep 2
done

# Test actual password authentication
info "Verifying database authentication..."
if docker exec colony-postgres psql -U colony_user -d colony -c "SELECT 1" &>/dev/null; then
  log "Database authentication OK"
else
  warn "Password mismatch — resetting database volume"
  docker compose down 2>/dev/null || true
  docker volume rm colony_backend_postgres_data 2>/dev/null || true
  docker compose up -d postgres 2>&1 | tee -a "$LOG_FILE"
  info "Waiting for fresh PostgreSQL..."
  for i in $(seq 1 30); do
    if docker exec colony-postgres pg_isready -U colony_user -d colony &>/dev/null; then
      sleep 3
      break
    fi
    sleep 2
  done
  log "Database reset with new password"
fi

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

# ═══════════════════════════════════════════════════════════════
# Install Node Dependencies
# ═══════════════════════════════════════════════════════════════
header "Installing Dependencies"

cd "$COLONY_DIR"
npm install --omit=dev 2>&1 | tee -a "$LOG_FILE"
log "Node.js dependencies installed"

# ═══════════════════════════════════════════════════════════════
# Seed Admin User
# ═══════════════════════════════════════════════════════════════
header "Seeding Admin User"

sleep 2

DB_HOST=localhost DB_PORT=5432 DB_NAME=colony DB_USER=colony_user DB_PASSWORD="${DB_PASSWORD}" \
node -e "
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function seedAdmin() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'colony',
    user: process.env.DB_USER || 'colony_user',
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 10000,
  });

  try {
    await pool.query('SELECT 1');
    const hash = await bcrypt.hash('admin123', 12);
    await pool.query(\`
      INSERT INTO admin_users (username, password_hash, email, role, permissions)
      VALUES (\$1, \$2, \$3, \$4, \$5)
      ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
    \`, ['admin', hash, 'admin@colony.app', 'super_admin', JSON.stringify({'*': true})]);
    console.log('Admin user seeded: admin / admin123');
  } catch (err) {
    console.error('Admin seed error:', err.message);
  } finally {
    await pool.end();
  }
}
seedAdmin();
" 2>&1 | tee -a "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════
# Start API Server
# ═══════════════════════════════════════════════════════════════
header "Starting Colony API Server"

cd "$COLONY_DIR"

# Kill any existing
fuser -k 5000/tcp 2>/dev/null || true

if command -v pm2 &> /dev/null; then
  pm2 delete colony-api 2>/dev/null || true
  pm2 start src/server.js --name colony-api -i max --max-memory-restart 512M 2>&1 | tee -a "$LOG_FILE"
  pm2 save 2>&1 | tee -a "$LOG_FILE"
  log "API started with PM2"
else
  nohup node src/server.js > colony-api.log 2>&1 &
  API_PID=$!
  echo "$API_PID" > "${COLONY_DIR}/colony-api.pid"
  log "API started (PID: $API_PID)"
fi

# Wait for API
info "Waiting for API to respond..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:5000/health > /dev/null 2>&1; then
    log "API server responding on port 5000"
    break
  fi
  if [ "$i" -eq 30 ]; then
    error "API not responding. Last 20 lines of log:"
    tail -20 colony-api.log 2>/dev/null || echo "(no log file)"
  fi
  sleep 2
done

# ═══════════════════════════════════════════════════════════════
# Get IPs
# ═══════════════════════════════════════════════════════════════
PUBLIC_IP=$(curl -sf --connect-timeout 5 https://api.ipify.org 2>/dev/null || echo "unavailable")
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "unavailable")

# ═══════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════
header "Setup Complete!"

echo -e "${GREEN}"
cat << DONE
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                    COLONY BACKEND READY!                          ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║                                                                   ║
  ║  API Server:    http://localhost:5000                             ║
DONE

if [ "$PUBLIC_IP" != "unavailable" ]; then
  echo -e "  ║  Public URL:    ${CYAN}http://${PUBLIC_IP}:5000${GREEN}                         ║"
fi
if [ "$LOCAL_IP" != "unavailable" ]; then
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

# Quick test
info "Testing API..."
HEALTH=$(curl -sf http://localhost:5000/health 2>/dev/null || echo "failed")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  log "API health check: OK"
  echo -e "${CYAN}  Response: ${HEALTH}${NC}"
else
  warn "API health check returned: $HEALTH"
  warn "Check: tail -f colony-api.log"
fi

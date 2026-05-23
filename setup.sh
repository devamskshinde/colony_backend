#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Colony Backend — One-Click Setup Script
# Run on any Linux VPS: curl -sSL https://raw.githubusercontent.com/devamskshinde/colony_backend/master/setup.sh | bash
# Or: git clone ... && cd colony_backend && chmod +x setup.sh && ./setup.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

COLONY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${COLONY_DIR}/setup.log"

log() { echo -e "${GREEN}[✓]${NC} $1" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[!]${NC} $1" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[✗]${NC} $1" | tee -a "$LOG_FILE"; }
info() { echo -e "${BLUE}[i]${NC} $1" | tee -a "$LOG_FILE"; }
header() { echo -e "\n${PURPLE}═══ $1 ═══${NC}\n" | tee -a "$LOG_FILE"; }

# ─── Banner ────────────────────────────────────────────────────
echo -e "${PURPLE}"
cat << 'BANNER'
   ██████╗ ██████╗ ██╗      ██████╗ ███╗   ██╗██╗   ██╗
  ██╔════╝██╔═══██╗██║     ██╔═══██╗████╗  ██║╚██╗ ██╔╝
  ██║     ██║   ██║██║     ██║   ██║██╔██╗ ██║ ╚████╔╝
  ██║     ██║   ██║██║     ██║   ██║██║╚██╗██║  ╚██╔╝
  ╚██████╗╚██████╔╝███████╗╚██████╔╝██║ ╚████║   ██║
   ╚═════╝ ╚═════╝ ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝
   Backend Setup Script v1.0
BANNER
echo -e "${NC}"

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

# Check Docker
if ! check_command docker; then
  warn "Docker not found. Installing..."
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sh /tmp/get-docker.sh 2>&1 | tee -a "$LOG_FILE"
  sudo usermod -aG docker "$USER" 2>/dev/null || true
  log "Docker installed"
fi

# Check Docker Compose
if ! docker compose version &> /dev/null; then
  if ! check_command docker-compose; then
    warn "Docker Compose not found. Installing..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    log "Docker Compose installed"
  fi
  COMPOSE_CMD="docker-compose"
else
  COMPOSE_CMD="docker compose"
fi

# Check Node.js
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

# Check npm
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

if [ -f "$ENV_FILE" ]; then
  warn ".env already exists. Backing up to .env.backup"
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
# ═══════════════════════════════════════════════════════════════
# Colony Backend — Environment Configuration
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# ═══════════════════════════════════════════════════════════════

# ─── Server ────────────────────────────────────────────────────
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# ─── PostgreSQL ────────────────────────────────────────────────
DB_HOST=localhost
DB_PORT=6432
DB_NAME=colony
DB_USER=colony_user
DB_PASSWORD=${DB_PASSWORD}
DB_POOL_MAX=100

# ─── Redis ─────────────────────────────────────────────────────
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# ─── JWT ───────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_ADMIN_SECRET=${JWT_ADMIN_SECRET}
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=30d

# ─── Request Signing ───────────────────────────────────────────
REQUEST_SIGNING_SECRET=${REQUEST_SIGNING_SECRET}
DEVICE_SECRET=${DEVICE_SECRET}

# ─── RabbitMQ ──────────────────────────────────────────────────
RABBITMQ_URL=amqp://colony:${RABBITMQ_PASSWORD}@localhost:5672

# ─── OTP (configure your SMS provider) ────────────────────────
OTP_MOCK=true
# TWILIO_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_PHONE=

# ─── Admin ─────────────────────────────────────────────────────
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=admin123
ADMIN_ALLOWED_IPS=

# ─── Logging ───────────────────────────────────────────────────
LOG_LEVEL=info
EOF

chmod 600 "$ENV_FILE"
log ".env generated with secure random secrets"
info "DB_PASSWORD: ${DB_PASSWORD:0:8}..."
info "Admin login: admin / admin123 (CHANGE THIS!)"

# ─── Start Docker Services ─────────────────────────────────────
header "Starting Docker Services"

cd "$COLONY_DIR"

# Create Docker network if needed
docker network create colony-net 2>/dev/null || true

# Start services
$COMPOSE_CMD up -d 2>&1 | tee -a "$LOG_FILE"
log "Docker services starting..."

# Wait for PostgreSQL
info "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker exec colony-postgres pg_isready -U colony_user -d colony &>/dev/null; then
    log "PostgreSQL ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    error "PostgreSQL failed to start after 30 attempts"
    error "Check logs: docker logs colony-postgres"
    exit 1
  fi
  sleep 2
done

# Wait for Redis
info "Waiting for Redis..."
for i in $(seq 1 15); do
  if docker exec colony-redis redis-cli -a "${REDIS_PASSWORD}" ping 2>/dev/null | grep -q PONG; then
    log "Redis ready"
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
    log "RabbitMQ ready"
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

npm install --production 2>&1 | tee -a "$LOG_FILE"
log "Node.js dependencies installed"

# ─── Seed Admin User ───────────────────────────────────────────
header "Seeding Admin User"

node -e "
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function seedAdmin() {
  const pool = new Pool({
    host: 'localhost',
    port: 6432,
    database: 'colony',
    user: 'colony_user',
    password: '${DB_PASSWORD}',
  });

  try {
    const hash = await bcrypt.hash('${ADMIN_DEFAULT_PASSWORD:-admin123}', 12);
    await pool.query(
      \`INSERT INTO admin_users (username, password_hash, email, role, permissions)
       VALUES (\$1, \$2, \$3, \$4, \$5)
       ON CONFLICT (username) DO UPDATE SET password_hash = \$2\`,
      ['${ADMIN_DEFAULT_USERNAME:-admin}', hash, 'admin@colony.app', 'super_admin', JSON.stringify({\"*\": true})]
    );
    console.log('Admin user seeded: ${ADMIN_DEFAULT_USERNAME:-admin}');
  } catch (err) {
    if (err.code === '42P01') {
      console.log('Tables not yet created — will seed on first migration run');
    } else {
      console.error('Admin seed error:', err.message);
    }
  } finally {
    await pool.end();
  }
}
seedAdmin();
" 2>&1 | tee -a "$LOG_FILE"

# ─── Start Application ─────────────────────────────────────────
header "Starting Colony Backend"

# Check if PM2 is available for production process management
if command -v pm2 &> /dev/null; then
  pm2 delete colony-api 2>/dev/null || true
  pm2 start src/server.js --name colony-api -i max --max-memory-restart 512M 2>&1 | tee -a "$LOG_FILE"
  pm2 save 2>&1 | tee -a "$LOG_FILE"
  log "Colony API started with PM2 (cluster mode)"
  info "PM2 status: pm2 status"
  info "PM2 logs: pm2 logs colony-api"
else
  info "PM2 not found. Starting with Node directly..."
  info "Install PM2 for production: npm i -g pm2"
  nohup node src/server.js > colony-api.log 2>&1 &
  echo $! > colony-api.pid
  log "Colony API started (PID: $(cat colony-api.pid))"
  info "Logs: tail -f colony-api.log"
fi

# ─── Wait for API ──────────────────────────────────────────────
info "Waiting for API to be ready..."
for i in $(seq 1 15); do
  if curl -s http://localhost:5000/health | grep -q '"status":"ok"' 2>/dev/null; then
    log "API server ready!"
    break
  fi
  if [ "$i" -eq 15 ]; then
    warn "API not responding yet. Check logs for errors."
  fi
  sleep 2
done

# ─── Summary ───────────────────────────────────────────────────
header "Setup Complete!"

echo -e "${GREEN}"
cat << 'DONE'
  ╔═══════════════════════════════════════════════════════════╗
  ║                  COLONY BACKEND READY!                    ║
  ╠═══════════════════════════════════════════════════════════╣
  ║                                                           ║
  ║  API Server:    http://localhost:5000                     ║
  ║  Health Check:  http://localhost:5000/health              ║
  ║  Admin Panel:   http://localhost:3000 (if Next.js built)  ║
  ║                                                           ║
  ║  Admin Login:   admin / admin123                          ║
  ║  ⚠ CHANGE THE ADMIN PASSWORD IMMEDIATELY!                ║
  ║                                                           ║
  ║  PostgreSQL:    localhost:5432 (PgBouncer: 6432)          ║
  ║  Redis:         localhost:6379                            ║
  ║  RabbitMQ UI:   localhost:15672                           ║
  ║                                                           ║
  ║  Config:        .env                                      ║
  ║  Logs:          setup.log, colony-api.log                 ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
DONE
echo -e "${NC}"

info "Docker services: $COMPOSE_CMD ps"
info "Restart API: node src/server.js (or pm2 restart colony-api)"
info "Stop everything: $COMPOSE_CMD down"
info "View logs: tail -f colony-api.log"

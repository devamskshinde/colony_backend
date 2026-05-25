# Fix Details — Colony Admin Panel (May 25, 2026)

## Root Cause: WSL Cross-Boundary API Routing

**The browser runs on Windows but the API runs on WSL.** When the browser JS called `http://127.0.0.1:5000`, it hit **Windows** localhost (where nothing runs) — NOT the WSL VM where the API actually lives. This caused "Unable to Connect" on every page.

## Changes Made

### 1. Relative API URLs (THE KEY FIX)
**File:** `admin/lib/api.ts`
- Changed `BASE_URL` from `"http://127.0.0.1:5000/api/v1"` (absolute) to `"/api/v1"` (relative)
- All browser requests now go through Next.js server-side proxy rewrites
- The proxy runs on WSL, which CAN reach `127.0.0.1:5000`
- Deleted `admin/.env.local` which was overriding BASE_URL back to absolute

### 2. Health Check Proxy
**File:** `admin/next.config.mjs`
- Added `/api/health` → backend `/health` rewrite so pingBackend() works through proxy

### 3. Complete Admin Backend API (7 New Route Files)
The backend only had admin auth + admin config. Now has full routes:

| Route | What it does |
|---|---|
| `admin/dashboard.routes.js` | Real-time stats: users, online, growth chart, hourly active, alerts |
| `admin/users.routes.js` | List (paginated/search/filter), detail, update, ban/suspend/verify actions |
| `admin/analytics.routes.js` | DAU, MAU, retention (D1/D7/D30), user growth, peak hours, feature usage |
| `admin/logs.routes.js` | API logs viewer from `api_logs` table with pagination |
| `admin/infrastructure.routes.js` | Service statuses (DB, Redis, SMS, Push, Email, Payment) + test endpoints |
| `admin/config` (extended) | Added `/categories`, `/category/:cat`, `/push` (batch update) endpoints |

### 4. Config Data Flow Fixed
- `GET /admin/config` now returns array directly (not `{configs: [...]}`)
- `updateConfig()` in api.ts changed from `PATCH /admin/config` → `POST /admin/config/push` with `{changes: {...}}` body
- Feature control page now properly loads and updates configs

### 5. Infrastructure Page Fix
- Hardcoded DB port changed from `6432` → `5432` (matches actual PostgreSQL port)

### 6. Previous Session Fixes (preserved)
- `DB_PORT=5432` in all .env files (was 6432 — PgBouncer port, no PgBouncer exists)
- RabbitMQ password: `colony:colony@` → `colony:colony_rabbit_dev@`
- Token key: `admin_token` → `colony_admin_token` (unified across storage and retrieval)
- Middleware: removed broken cookie check (tokens are in localStorage, not cookies)
- Auth validation: `checkAuth()` now calls `api.getMe()` instead of blindly trusting localStorage
- Connection status UI: amber warning banner when backend is down, green indicator when up
- pgAdmin added to docker-compose (port 5050): full PostgreSQL GUI

## What "Realtime" Means
- Dashboard polls every 30 seconds (auto-refresh)
- Config changes push to all connected servers
- User actions (ban, verify, etc.) execute immediately against PostgreSQL
- Future: WebSocket (already initialized in server.js) can push real-time updates

## On WSL After Pulling:
```bash
cd colony_backend
git pull origin master

# Kill the old API
fuser -k 5000/tcp 2>/dev/null

# Restart API (new routes!)
nohup node src/server.js > colony-api.log 2>&1 &

# Kill old admin panel
fuser -k 3000/tcp 2>/dev/null

# Restart admin panel
cd admin && nohup npm run dev > ../admin-panel.log 2>&1 &

# Then open http://localhost:3000 in Windows browser
```
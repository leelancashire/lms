# LMS (Last Man Standing)

## Current Status (March 8, 2026)

### Implemented
- Monorepo setup with `api/` (Node + TS + Express + Prisma) and `web/` (React + Vite + TS + Tailwind).
- Auth flows (register/login/refresh/me), league CRUD, picks, result processing, live screen/socket wiring, notifications scaffolding.
- Fixture history + team form guide modal/strip.
- Multi-competition architecture added:
  - `PL`, `ELC`, `EL1`, `EL2`, `SPL`, `SCH`, plus `ALL` mode.
  - Home and Pick include league selection and additional competition-view filter when league competition is `ALL`.
- Optional agreed-date fixture filter (admin env-driven) for Home/Pick display:
  - `ADMIN_ACTIVE_MATCH_DATE=YYYY-MM-DD`
- Provider fallback logic:
  - football-data.org remains primary.
  - API-Football fallback for fixture sync is wired for competitions missing from football-data responses.

### Current Known Constraint
- Real fixture coverage depends on API provider plan/access.
- Right now, environment testing indicates Premier League + Championship are available first; other leagues may remain empty if provider account does not return data for those league IDs.

### Environment Notes
- Required for fallback sync:
  - `FOOTBALL_DATA_ORG_API_KEY`
  - `API_FOOTBALL_KEY` (must be non-empty)
- Verify key loaded:
```bash
cd ~/lms/api
set -a; source .env; set +a
echo "${#API_FOOTBALL_KEY}"
```

### Next Steps
1. Confirm API-Football per-league coverage (league IDs 39, 40, 41, 42, 179, 180).
2. If coverage is limited:
   - either upgrade provider plan, or
   - explicitly keep unsupported leagues empty, or
   - re-enable mock fallback only for unsupported leagues.
3. Add admin UI/API to manage agreed date instead of env var + restart.

## Run Locally

### 1) Start PostgreSQL
```bash
cd ~/lms
docker compose up -d postgres
```

### 2) Start API
```bash
cd ~/lms
npm run dev:api
```

API health check:
```bash
curl -s http://localhost:3001/health
```

### 3) Start Web
Open a second terminal:
```bash
cd ~/lms
npm run dev:web
```

Open:
`http://localhost:5173`

## Common Issues

### `Missing script: dev:web`
You are probably inside `~/lms/api`. Run from project root:
```bash
cd ~/lms
npm run dev:web
```

Or from anywhere:
```bash
npm run dev -w web
```

### `EADDRINUSE: port 3001`
Another API process is already running:
```bash
pkill -f "node dist/index.js" || true
cd ~/lms
npm run dev:api
```

### Home page looks stale after updates
Hard refresh:
- `Ctrl+Shift+R`

If still stale, clear service worker/cache in browser console:
```js
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
caches.keys().then(keys => keys.forEach(k => caches.delete(k)))
location.reload()
```

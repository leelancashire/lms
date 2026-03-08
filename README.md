# LMS (Last Man Standing)

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


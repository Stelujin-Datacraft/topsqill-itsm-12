# One-go Dev / Prod VM deploy (after code is on `develop`)

## Why builds failed before

1. Prod VM was on an old branch (`fix/react-leaflet-react18`), not `develop`.
2. Single-branch git clone → `origin/develop` missing until fetch was widened.
3. Frontend Docker `npm ci` failed: `react-leaflet@5` wants React 19; app is React 18.
4. `curl` to `:3001` immediately after `up` can reset while Nest is still booting.

## Prerequisites on each VM

`.env` must include (Dev keys on Dev, Prod keys on Prod — never mix):

```bash
ENVIRONMENT=production   # or development on Dev VM
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJ...anon...
SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role...
# optional:
# ITAM_DISCOVERY_DATABASE_URL=postgresql://...
# VITE_API_URL=/api
```

## Deploy commands (both VMs)

```bash
cd /opt/topsqill/topsqill-itsm-12
cp -a .env /tmp/topsqill.env.bak

git remote set-branches origin '*'
git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
git fetch origin --prune
git checkout -B develop origin/develop
git reset --hard origin/develop
git clean -fd -e .env -e '.env.*'
test -f .env || cp /tmp/topsqill.env.bak .env

# Confirm tip + Prisma stub
git rev-parse HEAD origin/develop
head -5 backend/src/vis/store/prisma-client.ts

docker compose build --no-cache frontend backend
docker compose up -d

# Wait for Nest, then health-check
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -sf http://127.0.0.1:3001/api/health/crud && break
  sleep 3
done
curl -sS http://127.0.0.1:3001/api/health/crud
docker compose ps
```

Open the app as `http://YOUR_VM_IP:8080` (not localhost in the browser).
`VITE_API_URL=/api` uses that same host via nginx → Nest.

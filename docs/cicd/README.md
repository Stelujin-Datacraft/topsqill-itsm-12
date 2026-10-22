# Topsqill CI/CD (GitHub Actions)

## Who does what

| Work | Who |
|------|-----|
| Workflow YAML, deploy scripts, docs | **Agent / repo** (this PR) |
| GitHub Actions secrets + SSH key on VMs | **You** (one-time) |
| Supabase `.env` on each VM | **You** (already done; never put service_role in GitHub) |

You do **not** need another vendor for a Compose-on-GCP-VM pipeline. Optional later: GCP Artifact Registry / Cloud Build if you move off VM SSH.

## Plan (step by step)

### Step 1 — CI (done in repo)

Workflow: `.github/workflows/ci.yml`

- On PR/push to `develop` or `main`
- Builds Nest backend + runs unit tests
- Builds Vite frontend (placeholder public env)

**No secrets required.**

### Step 2 — Deploy Dev (manual first)

Workflow: `.github/workflows/deploy-dev.yml` (`workflow_dispatch`)

Add GitHub secrets:

| Secret | Example |
|--------|---------|
| `DEV_VM_HOST` | Dev VM public IP or DNS |
| `DEV_VM_USER` | `contact` |
| `DEV_VM_SSH_KEY` | Private key file (full `BEGIN`…`END` block) |
| `DEV_VM_SSH_PORT` | optional, default `22` |

**Paste tip (Mac):** copy the private key without corrupting newlines:

```bash
pbcopy < ~/.ssh/topsqill_dev_deploy
```

Then in GitHub → update secret `DEV_VM_SSH_KEY` → paste (Cmd+V). Do not wrap in quotes.

On the Dev VM, ensure `contact` (or your user) can:

```bash
sudo -n true  # or user in docker group
cd /opt/topsqill/topsqill-itsm-12 && docker compose ps
```

SSH key: generate a deploy key, add **public** key to `~/.ssh/authorized_keys` on the VM, put **private** key in `DEV_VM_SSH_KEY`.

After secrets exist: Actions → **Deploy Dev** → Run workflow (branch `main`).

### Step 3 — Deploy Prod (auto on `main`)

Workflow: `.github/workflows/deploy-prod.yml`

Secrets: `PROD_VM_HOST`, `PROD_VM_USER`, `PROD_VM_SSH_KEY`, optional `PROD_VM_SSH_PORT`.

Deploys `origin/main` (falls back to `develop` only if main missing).  
Runs on every push to `main` and via **Run workflow**.

### Step 4 — Auto-deploy Dev (enabled)

`deploy-dev.yml` runs on every push to `develop` and via **Run workflow**.  
`deploy-prod.yml` runs on every push to `main` and via **Run workflow**.

## Rules we keep

- `.env` stays on the VM — CI never uploads `SUPABASE_SERVICE_ROLE_KEY`
- Frontend Vite keys are baked **on the VM** during `docker compose build`
- Supabase SQL migrations are **not** auto-applied by CI
- Prod deploy is always manual (`workflow_dispatch`) until you choose otherwise

## After Step 1 merges

1. Open a PR or push to `develop` and confirm **CI** is green.  
2. Tell the agent when SSH secrets are ready → enable first **Deploy Dev** run.  
3. Promote `develop` → `main`, then **Deploy Prod**.

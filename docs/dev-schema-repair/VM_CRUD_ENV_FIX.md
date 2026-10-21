# Dev + Prod VM create/delete fix (app path)

Production Supabase already has tables, policies, and helpers. Create/delete failures
on the **VM** are an application and environment problem, not a missing Prod migration.

## Symptom: every module fails create/delete on both VMs

Forms, Workflows, Reports, Dashboards, Access Control, IT Assets, Policies, etc.
all go through the **same** Nest path:

`POST /api/database/{insert|update|delete|upsert}` → user JWT → Supabase RLS

So “all modules broken” means a **shared** failure, not a per-module bug:

| Layer | Dev VM | Prod VM |
|-------|--------|---------|
| App / env | Wrong or stale Nest+frontend deploy; `SUPABASE_SERVICE_ROLE_KEY` = anon; frontend `VITE_SUPABASE_*` host ≠ Nest `SUPABASE_URL` | Same |
| Database | Restrictive `*_migration_deny` + missing helpers until repairs **01–10** | Schema already OK — do **not** run Dev repairs |

First check on each VM (no secrets returned):

```bash
curl -sS http://127.0.0.1:3001/api/health/crud | jq .
```

Expect `status: "ok"`, `serviceRoleJwtRole: "service_role"`, and `supabaseHost` matching
that environment’s Supabase project. Frontend build-time `VITE_SUPABASE_URL` must use
the **same** host.

## Root causes (both Dev and Prod VMs)

1. **`SUPABASE_SERVICE_ROLE_KEY` set to the anon/publishable JWT**  
   Background jobs (Form API writes, VIS, workflow executor, queues) need a real
   `service_role` secret. Interactive CRUD now always uses the **user Bearer JWT**
   through Nest `/database/*` so RLS sees `auth.uid()`.

2. **Missing `Authorization` on Nest mutations**  
   Insert / update / delete / upsert require a user JWT. The frontend
   `apiClient` must send `Authorization: Bearer <access_token>` (already the case
   when a session exists).

3. **Stale VM image**  
   Deploy the Nest + frontend build that includes user-scoped mutations and
   zero-row mutation checks.

4. **Frontend ↔ Nest Supabase project mismatch**  
   If the browser session JWT is issued by project A but Nest `SUPABASE_URL` is
   project B, every guarded call returns 401 → all modules fail create/delete.

5. **Dev-only DB drift** (Dev Supabase only)  
   Apply repair migrations `01–10` on **Dev** (see `GO_NO_GO.md`). Do **not** run
   those Dev-only repairs on Production.

## Required env (per VM)

| Variable | Dev VM | Prod VM |
|---|---|---|
| `ENVIRONMENT` | `development` | `production` |
| `SUPABASE_URL` | Dev project URL | Prod project URL |
| `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` | Dev anon key | Prod anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Dev **service_role** secret | Prod **service_role** secret |

Never put Prod keys on the Dev VM (or the reverse). Never put `service_role` in
any `VITE_*` variable.

### Verify the service_role JWT (read-only)

Decode the middle segment of `SUPABASE_SERVICE_ROLE_KEY` (base64url JSON). The
`role` claim must be `"service_role"`. If it is `"anon"`, replace the value from
Supabase Dashboard → Project Settings → API → `service_role` (secret).

With this build, Nest **refuses to start** on `ENVIRONMENT=development|production`
when the configured service key JWT role is not `service_role`.

## Deploy steps

### Dev

1. Confirm Dev Supabase repair `01–10` applied (SQL Editor / migration history).
2. Set Dev `.env` with Dev URL + Dev anon + Dev **service_role**.
3. Deploy Nest + frontend from `develop` (or this PR).
4. Sign in as a project member / org admin and smoke-test create + delete on Forms,
   Reports, Dashboards, Access Control.

### Prod

1. **No** Dev repair SQL on Prod.
2. Set Prod `.env` with Prod URL + Prod anon + Prod **service_role**.
3. Deploy the same Nest + frontend build as Dev (or merge → Prod release).
4. Smoke-test create + delete as a Prod org admin.

## What this code change does

- Nest `DatabaseService` **insert / upsert / update / delete** always use
  `getClientForUser(Authorization)` — no silent service-role fallback.
- `getClientForUser` without a bearer **throws** (fail closed).
- Misconfigured `SUPABASE_SERVICE_ROLE_KEY` (JWT role ≠ `service_role`) **aborts
  Nest boot** on Dev/Prod `ENVIRONMENT`.
- Zero-row mutation responses still surface as errors (RLS deny / missing id).

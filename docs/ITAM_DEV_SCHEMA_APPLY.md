# ITAM Discovery — Dev-only schema apply (surgical)

## Root cause of Nest crash

Dev Supabase is missing ITAM Discovery relations (`itam_network_scopes`, `itam_discovery_jobs`, `itam_discovered_hosts`, …).  
Nest connects via **`ITAM_DISCOVERY_DATABASE_URL`** (env-specific Postgres URI). With `ITAM_DISCOVERY_APPLY_SCHEMA=0` it does **not** auto-DDL; hydrate fails until migrations are applied.

There is **no** `itam_discovered_assets` table in this repo — the host table is **`public.itam_discovered_hosts`**.

## Connection (Dev only)

| Variable | Purpose |
|----------|---------|
| `ENVIRONMENT=development` | Deployment identity |
| `NODE_ENV=production` | Container packaging (OK on Dev VM) |
| `ITAM_DISCOVERY_DATABASE_URL` | **Dev** Supabase Postgres URI only |
| `ITAM_DISCOVERY_APPLY_SCHEMA=0` | Keep off until SQL reviewed/applied |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Shared app API (VIS); not a substitute for the Postgres URI |

Do not point Dev at Prod credentials. Do not print `.env.dev` / passwords / service-role keys.

## Apply order (Dev SQL Editor or `psql -f` — not bulk `db push`)

1. `supabase/migrations/20260930110000_get_current_user_org_id.sql`  
   - Safe `CREATE OR REPLACE` for helpers. Skip only if functions already match; still prefer running for grants.
2. `supabase/migrations/20260930120000_itam_network_discovery.sql`  
   - Creates Phase A tables + RLS. Mostly `IF NOT EXISTS` / `DROP POLICY IF EXISTS`.
3. `supabase/migrations/20260930130000_itam_phases_b_d.sql`
4. `supabase/migrations/20260930140000_itam_form_sync.sql`

**Do not** run `supabase db push` against a Lovable-drifted Dev history (may re-apply hundreds of unrelated migrations).  
**Do not** bulk-insert `schema_migrations` rows for unapplied SQL.  
**Do not** alter `projects_migration_deny`.  
**Do not** apply these to Prod from this procedure.

### Repeatability notes

| Safe to re-run | Caution |
|----------------|---------|
| `CREATE … IF NOT EXISTS`, enum `DO $$ … EXCEPTION` | `uq_asset_software_asset_name_ver` fails if duplicate software rows exist (Dev currently 0) |
| `DROP POLICY IF EXISTS` + `CREATE POLICY` | Recording history: only mark versions **after** successful SQL |
| Helper `CREATE OR REPLACE FUNCTION` | |

After apply: verify `\dt public.itam_network_scopes` (or Dashboard), then restart Nest. ITAM APIs return 503 with apply instructions until schema exists; other Nest modules stay up.

## Backend behavior (post-fix)

- Missing schema → `ItamDiscoverySchemaMissingError` (clear message + file list).
- `ItamModule` logs the error and **does not** crash Nest (avoids Docker restart loop).
- No memory fallback; ITAM routes respond `503` until schema is present.

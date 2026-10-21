# Forms delete blocked by security policy (Dev + Prod)

## Cause

Direct `DELETE` on `forms` often returned `[]` under RLS (narrow helpers / overlapping
policies), so the UI showed “Delete blocked by security policy”.

## Fix (two SQL files + app rebuild)

1. `20261021120000_forms_delete_align_can_modify_form.sql` — broaden helpers/policies  
2. `20261021123000_forms_delete_authorized_rpc.sql` — `delete_form_authorized(uuid)` RPC  
3. Frontend/Nest on `develop` call `rpc('delete_form_authorized')` instead of table delete  

## Apply

### A. Supabase SQL Editor (Dev project, then Prod project)

Run both migration files in order (paste → Run).

### B. Each VM (required for UI path)

```bash
cd /opt/topsqill/topsqill-itsm-12
git fetch origin && git reset --hard origin/develop
docker compose build --no-cache frontend backend
docker compose up -d
# hard-refresh browser (Ctrl+Shift+R)
```

Then delete a form as creator / org admin / project admin|editor.

## Diagnostics

If it still fails: `docs/dev-schema-repair/FORMS_DELETE_DIAGNOSTIC.sql`

# `get_organization_users(uuid)` — Prod capture authored as repair 05

**Status:** Definition captured from Production and committed as:

`supabase/migrations/20261019120400_dev_repair_05_get_organization_users.sql`

**Live Dev apply:** still **NO-GO** until `GO_NO_GO.md` blockers clear. Do not apply to Production.

## Why this was blocked previously

- Called by `src/hooks/useOrganizationUsers.ts` and `src/hooks/useCopilotEngine.ts`.
- Typed in `src/integrations/supabase/types.ts`.
- **No `CREATE FUNCTION` existed in repo migrations** until repair 05.
- Repair package must not invent a body or permissive stub.

## Captured Production definition (authoritative)

```sql
CREATE OR REPLACE FUNCTION public.get_organization_users(org_id uuid)
RETURNS TABLE(id uuid, email text, first_name text, last_name text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT up.id, up.email, up.first_name, up.last_name, up.role
  FROM public.user_profiles up
  WHERE up.organization_id = org_id
    AND up.status = 'active'
  ORDER BY up.first_name, up.last_name, up.email;
$function$;
```

Notes:

- **No `SET search_path`** in the capture — repair 05 does **not** add one (avoid silent hardening).
- Filters to `status = 'active'` only (matches Prod).
- Does not additionally verify caller membership beyond the `org_id` argument (matches Prod).

## Production execute grants (preserved in repair 05)

- `PUBLIC`
- `anon`
- `authenticated`
- `service_role`
- `postgres`

Do not narrow or broaden these grants when applying on Dev.

## Post-apply verification

See `VALIDATION.md` — confirm `pg_get_functiondef` and `routine_privileges` on Dev match the capture above.

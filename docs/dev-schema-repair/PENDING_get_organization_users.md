# PENDING — `get_organization_users(uuid)` (cannot invent)

**PR #229 review status:** Still blocked. Cursor has no Production database credentials, so `pg_get_functiondef` could not be run from this environment. An operator must run `docs/dev-schema-repair/capture_prod_readonly.sql` on Production (read-only) and paste the function definition into a new migration for review.

## Why blocked

- Called by `src/hooks/useOrganizationUsers.ts` and `src/hooks/useCopilotEngine.ts`.
- Typed in `src/integrations/supabase/types.ts` as:

```ts
get_organization_users: {
  Args: { org_id: string }
  Returns: {
    email: string
    first_name: string
    id: string
    last_name: string
    role: string
  }[]
}
```

- **No `CREATE FUNCTION` exists anywhere under `supabase/migrations/`.**
- Repair package must not invent a body or permissive stub.

## Capture from Production (read-only)

Run as a role that can read `pg_proc` (not required to use service role for app data):

```sql
-- 1) Locate exact signature(s)
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS result,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'get_organization_users';

-- 2) Export full definition
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_organization_users';

-- 3) Grants
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'get_organization_users';
```

Paste the `CREATE OR REPLACE FUNCTION` output into a new reviewed migration, e.g.:

`supabase/migrations/20261019120400_dev_repair_05_get_organization_users.sql`

Requirements for that migration:

- Keep `SECURITY DEFINER` / `search_path` exactly as Prod (or tighten search_path if Prod omitted it and review agrees).
- Scope results to the caller’s org membership — do not broaden beyond Prod.
- `GRANT EXECUTE … TO authenticated` (and `service_role` if Prod has it).
- `NOTIFY pgrst, 'reload schema';`
- Apply on **Dev only** after code review.

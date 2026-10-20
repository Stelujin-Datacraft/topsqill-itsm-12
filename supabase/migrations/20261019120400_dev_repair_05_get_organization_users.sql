-- =============================================================================
-- DEV REPAIR 05 — Restore get_organization_users from Production capture
-- Source: Production pg_get_functiondef (operator-provided). Do NOT invent.
--
-- Captured body has NO SET search_path — do not add search_path here unless
-- the team separately approves that as intentional security hardening.
--
-- Execute grants match Production: PUBLIC, anon, authenticated, service_role,
-- postgres. Do not narrow or broaden beyond Prod.
--
-- Apply on Dev only after approval. Do NOT apply to Production.
-- Depends on: public.user_profiles (organization_id, status, name columns).
-- =============================================================================

BEGIN;

-- Preflight: user_profiles must exist with columns used by the captured body.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    RAISE EXCEPTION
      'Dev repair 05 preflight failed — public.user_profiles missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'organization_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'status'
  ) THEN
    RAISE EXCEPTION
      'Dev repair 05 preflight failed — user_profiles.organization_id / status required by captured get_organization_users';
  END IF;
END $$;

-- Exact Production definition (no search_path — matches capture).
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

-- Production execute grants (preserve exactly — do not narrow/broaden).
GRANT EXECUTE ON FUNCTION public.get_organization_users(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_organization_users(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_organization_users(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_users(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_organization_users(uuid) TO postgres;

NOTIFY pgrst, 'reload schema';

COMMIT;

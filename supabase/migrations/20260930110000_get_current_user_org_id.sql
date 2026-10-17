-- ITAM / org-scoped RLS prerequisites.
-- Provides helpers used by 20260930120000+ ITAM migrations.
-- Safe to re-run (CREATE OR REPLACE). Does NOT alter projects policies.
--
-- Authorization model (verified against repo):
--   * System Administrator / org admin in DB policies: user_profiles.role = 'admin'
--     (same check as Promotional Transfer and public.is_org_admin_of).
--   * Nest ITAM API-layer role headers are separate and MUST NOT be treated as
--     PostgreSQL RLS admin claims.

CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.user_profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_current_user_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_org_id() TO service_role;

-- Org admin check (may already exist from 20260519040514_*). Idempotent replace.
-- Reads user_profiles / user_organizations under SECURITY DEFINER to avoid RLS recursion.
CREATE OR REPLACE FUNCTION public.is_org_admin_of(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _org_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND organization_id = _org_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = _org_id
        AND role = 'admin'
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_org_admin_of(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_admin_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin_of(uuid) TO service_role;

-- Convenience: current user is admin of their active organization.
CREATE OR REPLACE FUNCTION public.is_current_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_org_admin_of(public.get_current_user_org_id());
$$;

REVOKE ALL ON FUNCTION public.is_current_org_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_org_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_org_admin() TO service_role;

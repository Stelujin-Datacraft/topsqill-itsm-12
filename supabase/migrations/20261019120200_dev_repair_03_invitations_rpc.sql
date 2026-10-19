-- =============================================================================
-- DEV REPAIR 03 — Restore get_user_project_invitations (+ GRANT)
-- Source: 20250625074633-c7def877-3cf8-4fdd-bb92-c05ecd23b805.sql
-- Adds search_path + GRANT EXECUTE (original omitted both GRANT and search_path).
-- get_organization_users is NOT included — no CREATE in repo; see
-- docs/dev-schema-repair/PENDING_get_organization_users.md
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_user_project_invitations()
RETURNS TABLE(
  id UUID,
  project_id UUID,
  project_name TEXT,
  role TEXT,
  invited_by UUID,
  inviter_name TEXT,
  invited_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  message TEXT,
  status TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pi.id,
    pi.project_id,
    p.name as project_name,
    pi.role,
    pi.invited_by,
    COALESCE(up.first_name || ' ' || up.last_name, up.email) as inviter_name,
    pi.invited_at,
    pi.expires_at,
    pi.message,
    pi.status
  FROM public.project_invitations pi
  JOIN public.projects p ON p.id = pi.project_id
  JOIN public.user_profiles up ON up.id = pi.invited_by
  JOIN public.user_profiles cu ON cu.email = pi.email
  WHERE cu.id = auth.uid()
    AND pi.status = 'pending'
    AND pi.expires_at > now()
  ORDER BY pi.invited_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_project_invitations() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

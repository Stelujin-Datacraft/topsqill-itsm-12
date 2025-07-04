
-- Fix the function with proper table alias
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

-- Add invitation token and password fields to organization_requests for direct invite flow
ALTER TABLE public.organization_requests 
ADD COLUMN IF NOT EXISTS invitation_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS security_template_id UUID REFERENCES public.security_templates(id),
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
ADD COLUMN IF NOT EXISTS mobile TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS nationality TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT,
ADD COLUMN IF NOT EXISTS invitation_type TEXT DEFAULT 'admin_invite' CHECK (invitation_type IN ('admin_invite', 'self_request')),
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '7 days');

-- Create index for faster token lookup
CREATE INDEX IF NOT EXISTS idx_organization_requests_token 
ON public.organization_requests(invitation_token) 
WHERE status = 'pending';

-- Create function to accept organization invitation via token
CREATE OR REPLACE FUNCTION public.accept_organization_invitation(invitation_token_param UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record RECORD;
  new_user_id UUID;
  temp_password TEXT;
  result jsonb;
BEGIN
  -- Get invitation details
  SELECT * INTO invitation_record
  FROM public.organization_requests
  WHERE invitation_token = invitation_token_param
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invitation not found, expired, or already processed'
    );
  END IF;

  -- Update invitation status to accepted
  UPDATE public.organization_requests
  SET status = 'accepted',
      reviewed_at = now()
  WHERE invitation_token = invitation_token_param;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Invitation accepted successfully',
    'email', invitation_record.email,
    'firstName', invitation_record.first_name,
    'lastName', invitation_record.last_name,
    'organizationId', invitation_record.organization_id,
    'role', invitation_record.role,
    'securityTemplateId', invitation_record.security_template_id,
    'passwordHash', invitation_record.password_hash,
    'mobile', invitation_record.mobile,
    'gender', invitation_record.gender,
    'nationality', invitation_record.nationality,
    'timezone', invitation_record.timezone
  );
END;
$$;

-- Create function to cancel invitation (invalidates token)
CREATE OR REPLACE FUNCTION public.cancel_organization_invitation(invitation_id_param UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Get invitation to check permissions
  SELECT orq.*, up.organization_id as requester_org
  INTO invitation_record
  FROM public.organization_requests orq
  JOIN public.user_profiles up ON up.id = auth.uid()
  WHERE orq.id = invitation_id_param
    AND orq.organization_id = up.organization_id
    AND orq.status = 'pending'
    AND (up.role = 'admin' OR up.role = 'superadmin');

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invitation not found or you do not have permission to cancel it'
    );
  END IF;

  -- Delete the invitation completely
  DELETE FROM public.organization_requests
  WHERE id = invitation_id_param;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Invitation cancelled successfully'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cancel_organization_invitation(UUID) TO authenticated;
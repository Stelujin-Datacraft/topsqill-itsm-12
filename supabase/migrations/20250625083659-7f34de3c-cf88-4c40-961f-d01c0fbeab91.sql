
-- Create RPC function to accept project invitations
CREATE OR REPLACE FUNCTION public.accept_project_invitation(invitation_id_param UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record RECORD;
  result jsonb;
BEGIN
  -- Get invitation details
  SELECT * INTO invitation_record
  FROM public.project_invitations pi
  JOIN public.user_profiles up ON up.email = pi.email
  WHERE pi.id = invitation_id_param
    AND up.id = auth.uid()
    AND pi.status = 'pending'
    AND pi.expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invitation not found, expired, or already processed'
    );
  END IF;

  -- Check if user is already in the project
  IF EXISTS (
    SELECT 1 FROM public.project_users pu
    WHERE pu.project_id = invitation_record.project_id
      AND pu.user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User is already a member of this project'
    );
  END IF;

  -- Update invitation status
  UPDATE public.project_invitations
  SET status = 'accepted',
      accepted_at = now()
  WHERE id = invitation_id_param;

  -- Add user to project
  INSERT INTO public.project_users (project_id, user_id, role, assigned_by)
  VALUES (
    invitation_record.project_id,
    auth.uid(),
    invitation_record.role,
    invitation_record.invited_by
  );

  -- Create notification for the inviter
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    invitation_record.invited_by,
    'invitation_accepted',
    'Invitation Accepted',
    (SELECT COALESCE(up.first_name || ' ' || up.last_name, up.email) FROM public.user_profiles up WHERE up.id = auth.uid()) || ' has accepted your project invitation',
    jsonb_build_object(
      'project_id', invitation_record.project_id,
      'accepted_by', auth.uid()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'project_id', invitation_record.project_id,
    'role', invitation_record.role
  );
END;
$$;

-- Create RPC function to reject project invitations
CREATE OR REPLACE FUNCTION public.reject_project_invitation(invitation_id_param UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Get invitation details
  SELECT * INTO invitation_record
  FROM public.project_invitations pi
  JOIN public.user_profiles up ON up.email = pi.email
  WHERE pi.id = invitation_id_param
    AND up.id = auth.uid()
    AND pi.status = 'pending'
    AND pi.expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invitation not found, expired, or already processed'
    );
  END IF;

  -- Update invitation status
  UPDATE public.project_invitations
  SET status = 'rejected'
  WHERE id = invitation_id_param;

  -- Create notification for the inviter
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    invitation_record.invited_by,
    'invitation_rejected',
    'Invitation Declined',
    (SELECT COALESCE(up.first_name || ' ' || up.last_name, up.email) FROM public.user_profiles up WHERE up.id = auth.uid()) || ' has declined your project invitation',
    jsonb_build_object(
      'project_id', invitation_record.project_id,
      'declined_by', auth.uid()
    )
  );

  RETURN jsonb_build_object(
    'success', true
  );
END;
$$;

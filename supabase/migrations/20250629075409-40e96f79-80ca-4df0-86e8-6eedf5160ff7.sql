
-- Update the reject_project_invitation function to delete the invitation instead of updating status
CREATE OR REPLACE FUNCTION public.reject_project_invitation(invitation_id_param UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Get invitation details before deletion
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

  -- Delete the invitation record instead of updating status
  DELETE FROM public.project_invitations
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

CREATE OR REPLACE FUNCTION public.auto_add_user_to_role_projects(_user_id uuid, _role_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _project_id uuid;
  _role_name text;
  _inserted integer;
BEGIN
  SELECT name INTO _role_name FROM public.roles WHERE id = _role_id;

  FOR _project_id IN
    SELECT DISTINCT f.project_id
    FROM public.role_permissions rp
    JOIN public.forms f ON f.id = rp.resource_id
    WHERE rp.role_id = _role_id
      AND rp.resource_type = 'form'
      AND f.project_id IS NOT NULL
  LOOP
    INSERT INTO public.project_users (project_id, user_id, role, assigned_by)
    VALUES (_project_id, _user_id, 'member', NULL)
    ON CONFLICT (project_id, user_id) DO NOTHING;

    GET DIAGNOSTICS _inserted = ROW_COUNT;

    IF _inserted > 0 THEN
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (
        _user_id,
        'project_access_granted',
        'Added to a project',
        format('You were added to a project because the role "%s" was assigned to you.', COALESCE(_role_name, 'Unknown')),
        jsonb_build_object('project_id', _project_id, 'role_id', _role_id, 'role_name', _role_name)
      );
    END IF;
  END LOOP;
END;
$function$;
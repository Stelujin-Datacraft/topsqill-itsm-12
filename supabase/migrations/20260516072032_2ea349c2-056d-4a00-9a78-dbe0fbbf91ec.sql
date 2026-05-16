
-- Function: add user to all projects implied by their role's form permissions
CREATE OR REPLACE FUNCTION public.auto_add_user_to_role_projects(_user_id uuid, _role_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_id uuid;
  _role_name text;
  _inserted boolean;
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
    -- Try insert; skip if already a member
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
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION public.trg_user_role_assignment_auto_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.auto_add_user_to_role_projects(NEW.user_id, NEW.role_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_role_assignment_auto_project ON public.user_role_assignments;
CREATE TRIGGER user_role_assignment_auto_project
AFTER INSERT ON public.user_role_assignments
FOR EACH ROW
EXECUTE FUNCTION public.trg_user_role_assignment_auto_project();

-- Also re-run when role_permissions change so newly granted forms auto-extend membership
CREATE OR REPLACE FUNCTION public.trg_role_permission_auto_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ura record;
BEGIN
  FOR _ura IN
    SELECT user_id FROM public.user_role_assignments WHERE role_id = NEW.role_id
  LOOP
    PERFORM public.auto_add_user_to_role_projects(_ura.user_id, NEW.role_id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS role_permission_auto_project ON public.role_permissions;
CREATE TRIGGER role_permission_auto_project
AFTER INSERT ON public.role_permissions
FOR EACH ROW
WHEN (NEW.resource_type = 'form')
EXECUTE FUNCTION public.trg_role_permission_auto_project();

-- Backfill: process all existing assignments
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT user_id, role_id FROM public.user_role_assignments LOOP
    PERFORM public.auto_add_user_to_role_projects(r.user_id, r.role_id);
  END LOOP;
END $$;

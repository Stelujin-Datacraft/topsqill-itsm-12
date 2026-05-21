
CREATE OR REPLACE FUNCTION public.revoke_role_and_dependent_access(_role_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role_name text;
  _affected_users uuid[];
  _deleted_resource_ids uuid[];
  _deleted_project_ids uuid[];
  _projects_revoked int := 0;
  _assets_revoked int := 0;
  _memberships_revoked int := 0;
BEGIN
  -- Only org admins may invoke
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Only administrators can delete roles';
  END IF;

  SELECT name INTO _role_name FROM public.roles WHERE id = _role_id;
  IF _role_name IS NULL THEN
    RAISE EXCEPTION 'Role not found';
  END IF;

  -- 1) Snapshot affected users
  SELECT array_agg(DISTINCT user_id)
    INTO _affected_users
    FROM public.user_role_assignments
   WHERE role_id = _role_id;

  -- 2) Snapshot the asset resource_ids the role granted
  SELECT array_agg(DISTINCT resource_id) FILTER (WHERE resource_id IS NOT NULL)
    INTO _deleted_resource_ids
    FROM public.role_permissions
   WHERE role_id = _role_id;

  -- 3) Snapshot project_ids in scope of this role (direct + derived from assets)
  SELECT array_agg(DISTINCT project_id) FILTER (WHERE project_id IS NOT NULL)
    INTO _deleted_project_ids
  FROM (
    SELECT rp.resource_id AS project_id
      FROM public.role_permissions rp
     WHERE rp.role_id = _role_id AND rp.resource_type = 'project'
    UNION ALL
    SELECT f.project_id FROM public.role_permissions rp
      JOIN public.forms f ON f.id = rp.resource_id
     WHERE rp.role_id = _role_id AND rp.resource_type = 'form'
    UNION ALL
    SELECT w.project_id FROM public.role_permissions rp
      JOIN public.workflows w ON w.id = rp.resource_id
     WHERE rp.role_id = _role_id AND rp.resource_type = 'workflow'
    UNION ALL
    SELECT r.project_id FROM public.role_permissions rp
      JOIN public.reports r ON r.id = rp.resource_id
     WHERE rp.role_id = _role_id AND rp.resource_type = 'report'
    UNION ALL
    SELECT d.project_id FROM public.role_permissions rp
      JOIN public.dashboards d ON d.id = rp.resource_id
     WHERE rp.role_id = _role_id AND rp.resource_type = 'dashboard'
  ) s;

  -- 4) Delete the role itself (cascades wipe role_permissions + user_role_assignments)
  DELETE FROM public.roles WHERE id = _role_id;

  IF _affected_users IS NULL OR array_length(_affected_users, 1) = 0 THEN
    RETURN jsonb_build_object(
      'role_id', _role_id, 'role_name', _role_name,
      'affected_users', 0, 'memberships_revoked', 0,
      'projects_revoked', 0, 'assets_revoked', 0
    );
  END IF;

  -- Helper CTE used multiple times: per affected user, the set of project_ids
  -- still covered by ANY remaining role assigned to them.
  -- 5) Revoke asset_permissions for assets that no remaining role grants
  WITH remaining_assets AS (
    SELECT ura.user_id, rp.resource_id AS asset_id
      FROM public.user_role_assignments ura
      JOIN public.role_permissions rp ON rp.role_id = ura.role_id
     WHERE ura.user_id = ANY(_affected_users)
       AND rp.resource_id IS NOT NULL
  )
  DELETE FROM public.asset_permissions ap
   WHERE ap.user_id = ANY(_affected_users)
     AND ap.asset_id = ANY(COALESCE(_deleted_resource_ids, ARRAY[]::uuid[]))
     AND NOT EXISTS (
       SELECT 1 FROM remaining_assets ra
        WHERE ra.user_id = ap.user_id AND ra.asset_id = ap.asset_id
     );
  GET DIAGNOSTICS _assets_revoked = ROW_COUNT;

  IF _deleted_project_ids IS NOT NULL AND array_length(_deleted_project_ids, 1) > 0 THEN

    -- 6) Revoke project_users membership (skip project creators)
    WITH remaining_user_projects AS (
      SELECT DISTINCT ura.user_id,
        CASE rp.resource_type
          WHEN 'project' THEN rp.resource_id
          WHEN 'form' THEN (SELECT project_id FROM public.forms WHERE id = rp.resource_id)
          WHEN 'workflow' THEN (SELECT project_id FROM public.workflows WHERE id = rp.resource_id)
          WHEN 'report' THEN (SELECT project_id FROM public.reports WHERE id = rp.resource_id)
          WHEN 'dashboard' THEN (SELECT project_id FROM public.dashboards WHERE id = rp.resource_id)
          ELSE NULL
        END AS project_id
      FROM public.user_role_assignments ura
      JOIN public.role_permissions rp ON rp.role_id = ura.role_id
      WHERE ura.user_id = ANY(_affected_users)
    ),
    to_revoke AS (
      SELECT u AS user_id, p AS project_id
      FROM unnest(_affected_users) u
      CROSS JOIN unnest(_deleted_project_ids) p
      WHERE NOT EXISTS (
        SELECT 1 FROM remaining_user_projects rup
         WHERE rup.user_id = u AND rup.project_id = p
      )
    )
    DELETE FROM public.project_users pu
     USING to_revoke tr
     WHERE pu.user_id = tr.user_id
       AND pu.project_id = tr.project_id
       AND NOT EXISTS (
         SELECT 1 FROM public.projects pr
          WHERE pr.id = tr.project_id AND pr.created_by = tr.user_id
       );
    GET DIAGNOSTICS _memberships_revoked = ROW_COUNT;

    -- 7) Revoke project_permissions for projects no remaining role covers
    WITH remaining_user_projects AS (
      SELECT DISTINCT ura.user_id,
        CASE rp.resource_type
          WHEN 'project' THEN rp.resource_id
          WHEN 'form' THEN (SELECT project_id FROM public.forms WHERE id = rp.resource_id)
          WHEN 'workflow' THEN (SELECT project_id FROM public.workflows WHERE id = rp.resource_id)
          WHEN 'report' THEN (SELECT project_id FROM public.reports WHERE id = rp.resource_id)
          WHEN 'dashboard' THEN (SELECT project_id FROM public.dashboards WHERE id = rp.resource_id)
          ELSE NULL
        END AS project_id
      FROM public.user_role_assignments ura
      JOIN public.role_permissions rp ON rp.role_id = ura.role_id
      WHERE ura.user_id = ANY(_affected_users)
    ),
    to_revoke AS (
      SELECT u AS user_id, p AS project_id
      FROM unnest(_affected_users) u
      CROSS JOIN unnest(_deleted_project_ids) p
      WHERE NOT EXISTS (
        SELECT 1 FROM remaining_user_projects rup
         WHERE rup.user_id = u AND rup.project_id = p
      )
    )
    DELETE FROM public.project_permissions pp
     USING to_revoke tr
     WHERE pp.user_id = tr.user_id AND pp.project_id = tr.project_id;

    -- 8) Revoke project_top_level_permissions for those same projects
    WITH remaining_user_projects AS (
      SELECT DISTINCT ura.user_id,
        CASE rp.resource_type
          WHEN 'project' THEN rp.resource_id
          WHEN 'form' THEN (SELECT project_id FROM public.forms WHERE id = rp.resource_id)
          WHEN 'workflow' THEN (SELECT project_id FROM public.workflows WHERE id = rp.resource_id)
          WHEN 'report' THEN (SELECT project_id FROM public.reports WHERE id = rp.resource_id)
          WHEN 'dashboard' THEN (SELECT project_id FROM public.dashboards WHERE id = rp.resource_id)
          ELSE NULL
        END AS project_id
      FROM public.user_role_assignments ura
      JOIN public.role_permissions rp ON rp.role_id = ura.role_id
      WHERE ura.user_id = ANY(_affected_users)
    ),
    to_revoke AS (
      SELECT u AS user_id, p AS project_id
      FROM unnest(_affected_users) u
      CROSS JOIN unnest(_deleted_project_ids) p
      WHERE NOT EXISTS (
        SELECT 1 FROM remaining_user_projects rup
         WHERE rup.user_id = u AND rup.project_id = p
      )
    )
    DELETE FROM public.project_top_level_permissions ptlp
     USING to_revoke tr
     WHERE ptlp.user_id = tr.user_id AND ptlp.project_id = tr.project_id;

    _projects_revoked := COALESCE(array_length(_deleted_project_ids, 1), 0);
  END IF;

  RETURN jsonb_build_object(
    'role_id', _role_id,
    'role_name', _role_name,
    'affected_users', COALESCE(array_length(_affected_users, 1), 0),
    'memberships_revoked', _memberships_revoked,
    'projects_revoked', _projects_revoked,
    'assets_revoked', _assets_revoked
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_role_and_dependent_access(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';

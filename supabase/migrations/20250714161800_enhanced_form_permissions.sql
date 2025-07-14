
-- Create enhanced function to get comprehensive form user permissions
CREATE OR REPLACE FUNCTION public.get_enhanced_form_user_permissions(
  _project_id UUID,
  _form_id UUID
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  access_sources JSONB,
  permissions JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH project_users AS (
    -- Get all project users
    SELECT 
      pu.user_id,
      up.email,
      up.first_name,
      up.last_name,
      pu.role as project_role
    FROM project_users pu
    JOIN user_profiles up ON pu.user_id = up.id
    WHERE pu.project_id = _project_id
  ),
  form_info AS (
    -- Get form creator info
    SELECT created_by, is_public
    FROM forms
    WHERE id = _form_id
  ),
  user_role_perms AS (
    -- Get role-based permissions for forms
    SELECT 
      ura.user_id,
      r.name as role_name,
      rp.permission_type,
      rp.resource_id
    FROM user_role_assignments ura
    JOIN roles r ON ura.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    WHERE rp.resource_type = 'form'
      AND (rp.resource_id = _form_id OR rp.resource_id IS NULL)
  ),
  form_access AS (
    -- Get direct form access
    SELECT 
      user_id,
      role as access_role,
      status
    FROM form_user_access
    WHERE form_id = _form_id
      AND status = 'active'
  ),
  top_level_perms AS (
    -- Get top-level form permissions
    SELECT 
      user_id,
      can_create,
      can_read,
      can_update,
      can_delete
    FROM project_top_level_permissions
    WHERE project_id = _project_id
      AND entity_type = 'forms'
  )
  SELECT 
    pu.user_id,
    pu.email::TEXT,
    pu.first_name::TEXT,
    pu.last_name::TEXT,
    -- Access sources
    jsonb_build_object(
      'is_creator', CASE WHEN fi.created_by = pu.user_id THEN true ELSE false END,
      'project_role', pu.project_role,
      'assigned_roles', COALESCE(
        jsonb_agg(DISTINCT urp.role_name) FILTER (WHERE urp.role_name IS NOT NULL),
        '[]'::jsonb
      ),
      'direct_access', CASE WHEN fa.user_id IS NOT NULL THEN fa.access_role ELSE null END,
      'has_top_level_perms', CASE WHEN tlp.user_id IS NOT NULL THEN true ELSE false END
    ) as access_sources,
    -- Permissions
    jsonb_build_object(
      'view_form', CASE 
        WHEN fi.created_by = pu.user_id THEN true -- Creator
        WHEN pu.project_role = 'admin' THEN true -- Project admin
        WHEN EXISTS(SELECT 1 FROM user_role_perms urp2 WHERE urp2.user_id = pu.user_id AND urp2.permission_type = 'read') THEN true -- Role-based
        WHEN fa.user_id IS NOT NULL THEN true -- Direct access
        WHEN tlp.can_read = true THEN true -- Top-level permission
        WHEN fi.is_public = true THEN true -- Public form
        ELSE false
      END,
      'create_form', CASE 
        WHEN fi.created_by = pu.user_id THEN true -- Creator
        WHEN pu.project_role = 'admin' THEN true -- Project admin
        WHEN EXISTS(SELECT 1 FROM user_role_perms urp2 WHERE urp2.user_id = pu.user_id AND urp2.permission_type = 'create') THEN true -- Role-based
        WHEN tlp.can_create = true THEN true -- Top-level permission
        ELSE false
      END,
      'update_form', CASE 
        WHEN fi.created_by = pu.user_id THEN true -- Creator
        WHEN pu.project_role = 'admin' THEN true -- Project admin
        WHEN EXISTS(SELECT 1 FROM user_role_perms urp2 WHERE urp2.user_id = pu.user_id AND urp2.permission_type = 'update') THEN true -- Role-based
        WHEN tlp.can_update = true THEN true -- Top-level permission
        ELSE false
      END,
      'read_form', CASE 
        WHEN fi.created_by = pu.user_id THEN true -- Creator
        WHEN pu.project_role = 'admin' THEN true -- Project admin
        WHEN EXISTS(SELECT 1 FROM user_role_perms urp2 WHERE urp2.user_id = pu.user_id AND urp2.permission_type = 'read') THEN true -- Role-based
        WHEN tlp.can_read = true THEN true -- Top-level permission
        ELSE false
      END,
      'delete_form', CASE 
        WHEN fi.created_by = pu.user_id THEN true -- Creator
        WHEN pu.project_role = 'admin' THEN true -- Project admin
        WHEN EXISTS(SELECT 1 FROM user_role_perms urp2 WHERE urp2.user_id = pu.user_id AND urp2.permission_type = 'delete') THEN true -- Role-based
        WHEN tlp.can_delete = true THEN true -- Top-level permission
        ELSE false
      END
    ) as permissions
  FROM project_users pu
  CROSS JOIN form_info fi
  LEFT JOIN user_role_perms urp ON pu.user_id = urp.user_id
  LEFT JOIN form_access fa ON pu.user_id = fa.user_id
  LEFT JOIN top_level_perms tlp ON pu.user_id = tlp.user_id
  GROUP BY 
    pu.user_id, pu.email, pu.first_name, pu.last_name, pu.project_role,
    fi.created_by, fi.is_public, fa.user_id, fa.access_role, tlp.user_id, 
    tlp.can_create, tlp.can_read, tlp.can_update, tlp.can_delete;
END;
$$;

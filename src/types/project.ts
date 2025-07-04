
export interface Project {
  id: string;
  name: string;
  description?: string;
  organization_id: string;
  created_by: string;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  userRole?: string; // Added to track user's role in this project
}

export interface ProjectUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'admin' | 'editor' | 'viewer' | 'member';
  project_id: string;
  user_id: string;
  assigned_at: string;
}

export interface ProjectPermission {
  id: string;
  project_id: string;
  user_id: string;
  resource_type: 'workflows' | 'forms' | 'reports' | 'users' | 'settings';
  permission_level: 'admin' | 'edit' | 'view';
  granted_by?: string;
  granted_at: string;
}

export interface AssetPermission {
  id: string;
  project_id: string;
  user_id: string;
  asset_type: 'form' | 'report' | 'workflow';
  asset_id: string;
  permission_type: 'view' | 'edit' | 'delete' | 'share' | 'view_records' | 'export_records' | 'start_instances';
  granted_by?: string;
  granted_at: string;
}

// New interface for top-level permissions
export interface TopLevelPermission {
  id: string;
  project_id: string;
  user_id: string;
  entity_type: 'projects' | 'forms' | 'workflows' | 'reports';
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectUserWithPermissions extends ProjectUser {
  permissions: ProjectPermission[];
  asset_permissions: AssetPermission[];
  top_level_permissions: TopLevelPermission[];
  effective_role: 'Project Admin' | 'Project Editor' | 'Project Viewer';
}

export interface ProjectStats {
  total_users: number;
  total_forms: number;
  total_workflows: number;
  total_reports: number;
  recent_activity: string;
}

export interface AssetAccessSummary {
  asset_id: string;
  asset_name: string;
  asset_type: 'form' | 'report' | 'workflow';
  permissions: string[];
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_share: boolean;
}

// New interface for user project access
export interface UserProjectAccess {
  project_id: string;
  user_id: string;
  role: 'admin' | 'editor' | 'viewer' | 'member';
  permissions: string[];
  top_level_permissions: TopLevelPermission[];
  is_creator: boolean;
  is_org_admin: boolean;
}

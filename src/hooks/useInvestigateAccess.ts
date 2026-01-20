import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  status: string;
  organization_id: string | null;
  created_at: string;
}

interface RoleAssignment {
  id: string;
  role_id: string;
  assigned_at: string;
  role: {
    id: string;
    name: string;
    description: string | null;
    top_level_access: string;
  };
}

interface GroupMembership {
  id: string;
  group_id: string;
  added_at: string;
  group: {
    id: string;
    name: string;
    role_id: string | null;
  };
}

interface TopLevelPermission {
  entity_type: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  project_name?: string;
  project_id: string;
}

interface ResourcePermission {
  resource_type: string;
  resource_id: string;
  resource_name: string;
  permission_type: string;
  role_name: string;
}

interface SecuritySettings {
  mfa_required: boolean | null;
  max_concurrent_sessions: number | null;
  session_timeout_minutes: number | null;
  access_start_time: string | null;
  access_end_time: string | null;
  allowed_days: string[] | null;
  security_template_name: string | null;
  use_template_settings: boolean | null;
  account_locked_until: string | null;
  last_login: string | null;
  last_password_change: string | null;
}

interface ActiveSession {
  id: string;
  session_token: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_activity: string;
  is_active: boolean;
}

interface ProjectAccess {
  project_id: string;
  project_name: string;
  role: string;
  assigned_at: string;
}

export interface InvestigateAccessData {
  profile: UserProfile | null;
  roleAssignments: RoleAssignment[];
  groupMemberships: GroupMembership[];
  topLevelPermissions: TopLevelPermission[];
  resourcePermissions: ResourcePermission[];
  securitySettings: SecuritySettings | null;
  activeSessions: ActiveSession[];
  projectAccess: ProjectAccess[];
}

export function useInvestigateAccess(selectedUserId: string | null) {
  const [data, setData] = useState<InvestigateAccessData>({
    profile: null,
    roleAssignments: [],
    groupMemberships: [],
    topLevelPermissions: [],
    resourcePermissions: [],
    securitySettings: null,
    activeSessions: [],
    projectAccess: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUserAccess = async (userId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Fetch role assignments with role details
      const { data: roleData, error: roleError } = await supabase
        .from('user_role_assignments')
        .select(`
          id,
          role_id,
          assigned_at,
          roles (
            id,
            name,
            description,
            top_level_access
          )
        `)
        .eq('user_id', userId);

      if (roleError) throw roleError;

      // Fetch group memberships
      const { data: groupData, error: groupError } = await supabase
        .from('group_memberships')
        .select(`
          id,
          group_id,
          added_at,
          groups (
            id,
            name,
            role_id
          )
        `)
        .eq('member_id', userId)
        .eq('member_type', 'user');

      if (groupError) throw groupError;

      // Fetch top-level permissions across all projects
      const { data: topLevelData, error: topLevelError } = await supabase
        .from('project_top_level_permissions')
        .select(`
          entity_type,
          can_create,
          can_read,
          can_update,
          can_delete,
          project_id,
          projects (
            name
          )
        `)
        .eq('user_id', userId);

      if (topLevelError) throw topLevelError;

      // Get role IDs for resource permissions query
      const roleIds = roleData?.map(r => r.role_id) || [];
      
      // Fetch resource-specific permissions from roles
      let resourcePerms: ResourcePermission[] = [];
      if (roleIds.length > 0) {
        const { data: rolePermsData, error: rolePermsError } = await supabase
          .from('role_permissions')
          .select(`
            resource_type,
            resource_id,
            permission_type,
            roles (
              name
            )
          `)
          .in('role_id', roleIds);

        if (!rolePermsError && rolePermsData) {
          // Fetch resource names for forms, workflows, reports
          const formIds = rolePermsData.filter(p => p.resource_type === 'form').map(p => p.resource_id).filter(Boolean);
          const workflowIds = rolePermsData.filter(p => p.resource_type === 'workflow').map(p => p.resource_id).filter(Boolean);
          const reportIds = rolePermsData.filter(p => p.resource_type === 'report').map(p => p.resource_id).filter(Boolean);

          const [formsResult, workflowsResult, reportsResult] = await Promise.all([
            formIds.length > 0 ? supabase.from('forms').select('id, name').in('id', formIds) : { data: [] },
            workflowIds.length > 0 ? supabase.from('workflows').select('id, name').in('id', workflowIds) : { data: [] },
            reportIds.length > 0 ? supabase.from('reports').select('id, name').in('id', reportIds) : { data: [] }
          ]);

          const resourceNames: Record<string, string> = {};
          [...(formsResult.data || []), ...(workflowsResult.data || []), ...(reportsResult.data || [])].forEach(r => {
            resourceNames[r.id] = r.name;
          });

          resourcePerms = rolePermsData.map(p => ({
            resource_type: p.resource_type,
            resource_id: p.resource_id || '',
            resource_name: resourceNames[p.resource_id || ''] || 'Unknown',
            permission_type: p.permission_type,
            role_name: (p.roles as any)?.name || 'Unknown'
          }));
        }
      }

      // Fetch security settings
      const { data: securityData, error: securityError } = await supabase
        .from('user_security_parameters')
        .select(`
          mfa_required,
          max_concurrent_sessions,
          session_timeout_minutes,
          access_start_time,
          access_end_time,
          allowed_days,
          use_template_settings,
          account_locked_until,
          last_login,
          last_password_change,
          security_template_id,
          security_templates (
            name
          )
        `)
        .eq('user_id', userId)
        .single();

      // Fetch active sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_activity', { ascending: false });

      // Fetch project access
      const { data: projectData, error: projectError } = await supabase
        .from('project_users')
        .select(`
          project_id,
          role,
          assigned_at,
          projects (
            name
          )
        `)
        .eq('user_id', userId);

      setData({
        profile: profileData,
        roleAssignments: (roleData || []).map(r => ({
          id: r.id,
          role_id: r.role_id,
          assigned_at: r.assigned_at,
          role: r.roles as any
        })),
        groupMemberships: (groupData || []).map(g => ({
          id: g.id,
          group_id: g.group_id,
          added_at: g.added_at,
          group: g.groups as any
        })),
        topLevelPermissions: (topLevelData || []).map(t => ({
          entity_type: t.entity_type,
          can_create: t.can_create,
          can_read: t.can_read,
          can_update: t.can_update,
          can_delete: t.can_delete,
          project_id: t.project_id,
          project_name: (t.projects as any)?.name
        })),
        resourcePermissions: resourcePerms,
        securitySettings: securityData ? {
          mfa_required: securityData.mfa_required,
          max_concurrent_sessions: securityData.max_concurrent_sessions,
          session_timeout_minutes: securityData.session_timeout_minutes,
          access_start_time: securityData.access_start_time,
          access_end_time: securityData.access_end_time,
          allowed_days: securityData.allowed_days,
          use_template_settings: securityData.use_template_settings,
          account_locked_until: securityData.account_locked_until,
          last_login: securityData.last_login,
          last_password_change: securityData.last_password_change,
          security_template_name: (securityData.security_templates as any)?.name || null
        } : null,
        activeSessions: sessionsData || [],
        projectAccess: (projectData || []).map(p => ({
          project_id: p.project_id,
          project_name: (p.projects as any)?.name || 'Unknown',
          role: p.role,
          assigned_at: p.assigned_at
        }))
      });
    } catch (err: any) {
      console.error('Error loading user access:', err);
      setError(err.message || 'Failed to load user access data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUserId) {
      loadUserAccess(selectedUserId);
    } else {
      setData({
        profile: null,
        roleAssignments: [],
        groupMemberships: [],
        topLevelPermissions: [],
        resourcePermissions: [],
        securitySettings: null,
        activeSessions: [],
        projectAccess: []
      });
    }
  }, [selectedUserId]);

  return {
    data,
    loading,
    error,
    reload: () => selectedUserId && loadUserAccess(selectedUserId)
  };
}

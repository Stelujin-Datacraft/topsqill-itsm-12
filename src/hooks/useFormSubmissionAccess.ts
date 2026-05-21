
import { useFormAccessMatrix } from '@/hooks/useFormAccessMatrix';
import { useAuth } from '@/contexts/AuthContext';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { useProject } from '@/contexts/ProjectContext';

export function useFormSubmissionAccess(formId: string) {
  const { users, loading: matrixLoading } = useFormAccessMatrix(formId);
  const { userProfile } = useAuth();
  const { hasPermission, loading: unifiedLoading } = useUnifiedAccessControl();
  const { currentProject } = useProject();
  
  const loading = matrixLoading || unifiedLoading;
  
  const getCurrentUserPermissions = () => {
    if (!userProfile || !currentProject) {
      return {
        canViewSubmissions: false,
        canExportData: false,
        canCreateRecords: false
      };
    }

    // First check unified access control (includes project-level and organizational permissions)
    const canViewFromUnified = hasPermission('forms', 'read', formId) || hasPermission('forms', 'update', formId);
    const canExportFromUnified = hasPermission('forms', 'read', formId) || hasPermission('forms', 'update', formId);
    // Per-form role-based create grant (e.g. "Create" permission on this specific form)
    // must enable the Submit / Save Draft buttons. The standalone `hasPermission('forms','create')`
    // is admin-only; the per-resource variant respects role_permissions for this form.
    const canCreateFromUnified =
      hasPermission('forms', 'create', formId) ||
      hasPermission('forms', 'create') ||
      hasPermission('forms', 'update', formId);

    // If user is admin, grant all permissions
    if (userProfile.role === 'admin') {
      return {
        canViewSubmissions: true,
        canExportData: true,
        canCreateRecords: true
      };
    }

    // Check form-specific permissions from access matrix
    const currentUser = users.find(user => user.user_id === userProfile.id);
    
    if (currentUser) {
      const permissions = currentUser.permissions;
      return {
        canViewSubmissions: permissions.view_submissions?.granted || canViewFromUnified,
        canExportData: permissions.export_data?.granted || canExportFromUnified,
        canCreateRecords: permissions.create_records?.granted || canCreateFromUnified
      };
    }

    // Fallback to unified permissions
    return {
      canViewSubmissions: canViewFromUnified,
      canExportData: canExportFromUnified,
      canCreateRecords: canCreateFromUnified
    };
  };

  const permissions = getCurrentUserPermissions();

  return {
    canViewSubmissions: permissions.canViewSubmissions,
    canExportData: permissions.canExportData,
    canCreateRecords: permissions.canCreateRecords,
    loading
  };
}

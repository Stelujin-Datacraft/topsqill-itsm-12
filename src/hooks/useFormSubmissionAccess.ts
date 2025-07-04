
import { useFormAccessMatrix } from '@/hooks/useFormAccessMatrix';

export function useFormSubmissionAccess(formId: string) {
  const { users, loading } = useFormAccessMatrix(formId);
  
  const getCurrentUserPermissions = () => {
    // Get current user's permissions from the users array
    // This is a simplified implementation - in a real app, you'd get the current user ID
    // from auth context and find their permissions in the users array
    const currentUser = users.find(user => {
      // This would normally check against auth.uid() or similar
      // For now, we'll assume the first user is the current user
      return user.user_id; // Placeholder logic
    });

    if (!currentUser) {
      return {
        canViewSubmissions: false,
        canExportData: false,
        canCreateRecords: false
      };
    }

    const permissions = currentUser.permissions;
    
    return {
      canViewSubmissions: permissions.view_submissions?.granted || false,
      canExportData: permissions.export_data?.granted || false,
      canCreateRecords: permissions.create_records?.granted || false
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

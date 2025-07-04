
import { useUnifiedAccessControl, EntityType, ActionType } from '@/hooks/useUnifiedAccessControl';

export function useAccessControlledActions(projectId?: string, userId?: string) {
  const { checkPermissionWithAlert } = useUnifiedAccessControl(projectId, userId);

  const executeWithPermissionCheck = (
    entityType: EntityType,
    action: ActionType,
    callback: () => void | Promise<void>,
    resourceId?: string
  ) => {
    if (checkPermissionWithAlert(entityType, action, resourceId)) {
      callback();
    }
  };

  return {
    executeWithPermissionCheck
  };
}


import React from 'react';
import { useUnifiedAccessControl, EntityType, ActionType } from '@/hooks/useUnifiedAccessControl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface AccessControlGuardProps {
  entityType: EntityType;
  action: ActionType;
  resourceId?: string;
  projectId?: string;
  userId?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showAlert?: boolean;
}

export function AccessControlGuard({ 
  entityType, 
  action, 
  resourceId,
  projectId,
  userId,
  children, 
  fallback,
  showAlert = true 
}: AccessControlGuardProps) {
  const { hasPermission, loading } = useUnifiedAccessControl(projectId, userId);

  if (loading) {
    return null;
  }

  const hasAccess = hasPermission(entityType, action, resourceId);

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showAlert) {
      return (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            You do not have permission to perform this action.
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  }

  return <>{children}</>;
}

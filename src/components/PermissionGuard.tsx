
import React from 'react';
import { useComprehensivePermissions, EntityType, ActionType } from '@/hooks/useComprehensivePermissions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface PermissionGuardProps {
  entityType: EntityType;
  action: ActionType;
  projectId?: string;
  userId?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showAlert?: boolean;
}

export function PermissionGuard({ 
  entityType, 
  action, 
  projectId, 
  userId, 
  children, 
  fallback,
  showAlert = true 
}: PermissionGuardProps) {
  const { hasPermission, loading } = useComprehensivePermissions(projectId, userId);

  if (loading) {
    return null;
  }

  const hasAccess = hasPermission(entityType, action);

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

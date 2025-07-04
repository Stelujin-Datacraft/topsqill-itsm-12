
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Project } from '@/types/project';
import { EnhancedProjectUser } from '@/hooks/useEnhancedProjectUsers';
import { AssetLevelPermissions } from './AssetLevelPermissions';

interface AdvancedPermissionMatrixProps {
  project: Project;
  user: EnhancedProjectUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPermissionsUpdated: () => void;
}

export function AdvancedPermissionMatrix({ 
  project, 
  user, 
  open, 
  onOpenChange, 
  onPermissionsUpdated 
}: AdvancedPermissionMatrixProps) {
  return (
    <AssetLevelPermissions
      user={user}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}

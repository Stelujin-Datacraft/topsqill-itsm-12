
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { EnhancedProjectUser } from '@/hooks/useEnhancedProjectUsers';
import { useRoles } from '@/hooks/useRoles';
import { useUserRoleAssignments } from '@/hooks/useUserRoleAssignments';
import { Shield, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AssetLevelPermissionsProps {
  user: EnhancedProjectUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AssetPermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export function AssetLevelPermissions({ user, open, onOpenChange }: AssetLevelPermissionsProps) {
  const { roles } = useRoles();
  const { assignments: userRoleAssignments } = useUserRoleAssignments();

  if (!user) return null;

  // Get user's assigned role
  const userRoleAssignment = userRoleAssignments.find(assignment => assignment.user_id === user.user_id);
  const assignedRole = userRoleAssignment ? roles.find(role => role.id === userRoleAssignment.role_id) : null;

  // Calculate permissions based on assigned role
  const getAssetPermissions = (assetType: 'form' | 'workflow' | 'report'): AssetPermissions => {
    if (!assignedRole) {
      // Default viewer permissions - only read access
      return { create: false, read: true, update: false, delete: false };
    }

    const rolePermissions = assignedRole.permissions.filter(p => p.resource_type === assetType);
    
    return {
      create: rolePermissions.some(p => p.permission_type === 'create'),
      read: true, // Always true as per requirement
      update: rolePermissions.some(p => p.permission_type === 'update'),
      delete: rolePermissions.some(p => p.permission_type === 'delete')
    };
  };

  const formsPermissions = getAssetPermissions('form');
  const workflowsPermissions = getAssetPermissions('workflow');
  const reportsPermissions = getAssetPermissions('report');

  const AssetPermissionRow = ({ 
    assetType, 
    permissions 
  }: { 
    assetType: string; 
    permissions: AssetPermissions; 
  }) => (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">{assetType}</h4>
      <div className="grid grid-cols-4 gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox 
            checked={permissions.create} 
            disabled 
            className="opacity-60" 
          />
          <label className="text-sm text-muted-foreground">Create</label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox 
            checked={permissions.read} 
            disabled 
            className="opacity-60" 
          />
          <label className="text-sm text-muted-foreground">Read</label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox 
            checked={permissions.update} 
            disabled 
            className="opacity-60" 
          />
          <label className="text-sm text-muted-foreground">Update</label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox 
            checked={permissions.delete} 
            disabled 
            className="opacity-60" 
          />
          <label className="text-sm text-muted-foreground">Delete</label>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Asset-Level Permissions
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{user.email}</h3>
              <p className="text-sm text-muted-foreground">
                {user.first_name && user.last_name 
                  ? `${user.first_name} ${user.last_name}`
                  : 'No name provided'
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                Project {user.role}
              </Badge>
              {assignedRole && (
                <Badge variant="outline">
                  Role: {assignedRole.name}
                </Badge>
              )}
            </div>
          </div>

          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {assignedRole 
                ? `Permissions are automatically applied based on the assigned role "${assignedRole.name}". These cannot be manually edited.`
                : 'No role assigned. User has default viewer access with read-only permissions. Assign a role to grant additional permissions.'
              }
            </AlertDescription>
          </Alert>

          {/* Asset Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Asset-Level Permissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <AssetPermissionRow assetType="Forms" permissions={formsPermissions} />
              <AssetPermissionRow assetType="Workflows" permissions={workflowsPermissions} />
              <AssetPermissionRow assetType="Reports" permissions={reportsPermissions} />
            </CardContent>
          </Card>

          {!assignedRole && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                To grant additional permissions, assign a role to this user through the Role-Based Access system.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

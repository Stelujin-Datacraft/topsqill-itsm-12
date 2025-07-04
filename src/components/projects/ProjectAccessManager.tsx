
import React, { useState, useEffect } from 'react';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';
import { useProject } from '@/contexts/ProjectContext';
import { Project, ProjectUserWithPermissions } from '@/types/project';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Settings, User, Shield, Eye, Edit, Crown } from 'lucide-react';

interface ProjectAccessManagerProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUser: ProjectUserWithPermissions | null;
}

const RESOURCE_TYPES = [
  { key: 'workflows', label: 'Workflows', icon: Settings },
  { key: 'forms', label: 'Forms', icon: User },
  { key: 'reports', label: 'Reports', icon: Shield },
  { key: 'users', label: 'User Management', icon: User },
  { key: 'settings', label: 'Project Settings', icon: Settings },
] as const;

const PERMISSION_LEVELS = [
  { key: 'admin', label: 'Admin', icon: Crown, color: 'bg-red-100 text-red-800' },
  { key: 'edit', label: 'Edit', icon: Edit, color: 'bg-blue-100 text-blue-800' },
  { key: 'view', label: 'View', icon: Eye, color: 'bg-gray-100 text-gray-800' },
] as const;

export function ProjectAccessManager({ project, open, onOpenChange, selectedUser }: ProjectAccessManagerProps) {
  const { permissions, grantPermission, revokePermission } = useProjectPermissions(project.id);
  const [userPermissions, setUserPermissions] = useState<Record<string, string>>({});

  useEffect(() => {
    if (selectedUser) {
      const perms: Record<string, string> = {};
      selectedUser.permissions.forEach(perm => {
        perms[perm.resource_type] = perm.permission_level;
      });
      setUserPermissions(perms);
    }
  }, [selectedUser]);

  const handlePermissionChange = async (resourceType: string, permissionLevel: string) => {
    if (!selectedUser) return;

    if (permissionLevel === 'none') {
      await revokePermission(selectedUser.user_id, resourceType as any);
    } else {
      await grantPermission(selectedUser.user_id, resourceType as any, permissionLevel as any);
    }

    setUserPermissions(prev => ({
      ...prev,
      [resourceType]: permissionLevel
    }));
  };

  if (!selectedUser) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Access Management
          </DialogTitle>
          <DialogDescription>
            Configure access permissions for {selectedUser.first_name} {selectedUser.last_name} ({selectedUser.email})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Role</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="text-sm">
                {selectedUser.effective_role}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resource Permissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {RESOURCE_TYPES.map((resource) => {
                const IconComponent = resource.icon;
                const currentPermission = userPermissions[resource.key] || 'none';
                
                return (
                  <div key={resource.key} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <IconComponent className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{resource.label}</span>
                    </div>
                    
                    <Select 
                      value={currentPermission}
                      onValueChange={(value) => handlePermissionChange(resource.key, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {PERMISSION_LEVELS.map((level) => (
                          <SelectItem key={level.key} value={level.key}>
                            <div className="flex items-center gap-2">
                              <level.icon className="h-3 w-3" />
                              {level.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

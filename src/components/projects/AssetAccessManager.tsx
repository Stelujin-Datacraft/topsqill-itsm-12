
import React, { useState, useEffect } from 'react';
import { useAssetPermissions } from '@/hooks/useAssetPermissions';
import { Project, ProjectUserWithPermissions, AssetPermission } from '@/types/project';
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, BarChart3, Workflow, Eye, Edit, Trash2, Share, Database, Download, Play } from 'lucide-react';

interface AssetAccessManagerProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUser: ProjectUserWithPermissions | null;
}

const ASSET_TYPES = [
  { key: 'form' as const, label: 'Forms', icon: FileText },
  { key: 'report' as const, label: 'Reports', icon: BarChart3 },
  { key: 'workflow' as const, label: 'Workflows', icon: Workflow },
];

// Define all possible permission types
type PermissionConfig = {
  key: AssetPermission['permission_type'];
  label: string;
  icon: React.ComponentType<any>;
  color: string;
};

const BASE_PERMISSIONS: PermissionConfig[] = [
  { key: 'view', label: 'View', icon: Eye, color: 'bg-blue-100 text-blue-800' },
  { key: 'edit', label: 'Edit', icon: Edit, color: 'bg-green-100 text-green-800' },
  { key: 'delete', label: 'Delete', icon: Trash2, color: 'bg-red-100 text-red-800' },
  { key: 'share', label: 'Share', icon: Share, color: 'bg-purple-100 text-purple-800' },
];

const FORM_SPECIFIC_PERMISSIONS: PermissionConfig[] = [
  { key: 'view_records', label: 'View Records', icon: Database, color: 'bg-cyan-100 text-cyan-800' },
  { key: 'export_records', label: 'Export Records', icon: Download, color: 'bg-orange-100 text-orange-800' },
];

const WORKFLOW_SPECIFIC_PERMISSIONS: PermissionConfig[] = [
  { key: 'start_instances', label: 'Start Instances', icon: Play, color: 'bg-indigo-100 text-indigo-800' },
];

export function AssetAccessManager({ project, open, onOpenChange, selectedUser }: AssetAccessManagerProps) {
  const { assetPermissions, grantAssetPermission, revokeAssetPermission } = useAssetPermissions(project.id);
  const [userAssetPermissions, setUserAssetPermissions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (selectedUser) {
      const userPerms: Record<string, string[]> = {};
      selectedUser.asset_permissions.forEach(perm => {
        const key = `${perm.asset_type}-${perm.asset_id}`;
        if (!userPerms[key]) {
          userPerms[key] = [];
        }
        userPerms[key].push(perm.permission_type);
      });
      setUserAssetPermissions(userPerms);
    }
  }, [selectedUser]);

  const handlePermissionToggle = async (
    assetType: AssetPermission['asset_type'],
    assetId: string,
    permissionType: AssetPermission['permission_type'],
    granted: boolean
  ) => {
    if (!selectedUser) return;

    if (granted) {
      await grantAssetPermission(selectedUser.user_id, assetType, assetId, permissionType);
    } else {
      await revokeAssetPermission(selectedUser.user_id, assetType, assetId, permissionType);
    }

    // Update local state
    const key = `${assetType}-${assetId}`;
    setUserAssetPermissions(prev => {
      const newPerms = { ...prev };
      if (!newPerms[key]) {
        newPerms[key] = [];
      }
      
      if (granted) {
        if (!newPerms[key].includes(permissionType)) {
          newPerms[key].push(permissionType);
        }
      } else {
        newPerms[key] = newPerms[key].filter(p => p !== permissionType);
      }
      
      return newPerms;
    });
  };

  const hasPermission = (assetType: string, assetId: string, permissionType: string) => {
    const key = `${assetType}-${assetId}`;
    return userAssetPermissions[key]?.includes(permissionType) || false;
  };

  const getPermissionsForAssetType = (assetType: AssetPermission['asset_type']): PermissionConfig[] => {
    let permissions = [...BASE_PERMISSIONS];
    
    if (assetType === 'form') {
      permissions = [...permissions, ...FORM_SPECIFIC_PERMISSIONS];
    } else if (assetType === 'workflow') {
      permissions = [...permissions, ...WORKFLOW_SPECIFIC_PERMISSIONS];
    }
    
    return permissions;
  };

  if (!selectedUser) return null;

  // Don't show asset permissions for project admins (they have implicit access)
  if (selectedUser.role === 'admin') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Asset Access Management
            </DialogTitle>
            <DialogDescription>
              {selectedUser.first_name} {selectedUser.last_name} is a Project Admin and has full access to all assets.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Asset Access Management
          </DialogTitle>
          <DialogDescription>
            Configure asset-level permissions for {selectedUser.first_name} {selectedUser.last_name} ({selectedUser.email})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Project Role</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="text-sm">
                {selectedUser.effective_role}
              </Badge>
              <p className="text-sm text-muted-foreground mt-2">
                {selectedUser.role === 'editor' 
                  ? "Can create new assets and gets full permissions on created assets. Needs explicit permissions for existing assets."
                  : "Cannot create assets. Only sees assets with explicit permissions granted."
                }
              </p>
            </CardContent>
          </Card>

          <Tabs defaultValue="form" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              {ASSET_TYPES.map((assetType) => {
                const IconComponent = assetType.icon;
                return (
                  <TabsTrigger key={assetType.key} value={assetType.key}>
                    <IconComponent className="h-4 w-4 mr-2" />
                    {assetType.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {ASSET_TYPES.map((assetType) => (
              <TabsContent key={assetType.key} value={assetType.key} className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <assetType.icon className="h-5 w-5" />
                      {assetType.label} Permissions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground mb-4">
                      Configure specific permissions for individual {assetType.label.toLowerCase()}.
                      Note: This is a demo interface - in a real implementation, you would load actual assets from the database.
                    </div>
                    
                    {/* Demo asset permissions interface */}
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-medium">Sample {assetType.label.slice(0, -1)}</h4>
                            <p className="text-sm text-muted-foreground">Demo asset for permission testing</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {getPermissionsForAssetType(assetType.key).map((permission) => {
                            const IconComponent = permission.icon;
                            const demoAssetId = 'demo-asset-1';
                            const hasThisPermission = hasPermission(assetType.key, demoAssetId, permission.key);
                            
                            return (
                              <div key={permission.key} className="flex items-center justify-between p-2 border rounded">
                                <div className="flex items-center gap-2">
                                  <IconComponent className="h-4 w-4" />
                                  <span className="text-sm">{permission.label}</span>
                                </div>
                                <Switch
                                  checked={hasThisPermission}
                                  onCheckedChange={(checked) => 
                                    handlePermissionToggle(assetType.key, demoAssetId, permission.key, checked)
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

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

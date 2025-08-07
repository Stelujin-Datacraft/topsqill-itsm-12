import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Save, X, Shield, Users, FileText, Workflow, BarChart, FolderOpen } from 'lucide-react';
import { useRoles, Role } from '@/hooks/useRoles';
import { useCreateRole } from '@/hooks/useCreateRole';
import { useProject } from '@/contexts/ProjectContext';
import { useFormsData } from '@/hooks/useFormsData';
import { useWorkflowData } from '@/hooks/useWorkflowData';
import { useReports } from '@/hooks/useReports';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ResourcePermissions {
  [key: string]: string[];
}

const RESOURCE_TYPES = [
  { id: 'forms', label: 'Forms', icon: FileText },
  { id: 'workflows', label: 'Workflows', icon: Workflow },
  { id: 'reports', label: 'Reports', icon: BarChart },
];

export function CreateRolesTab() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [resourcePermissions, setResourcePermissions] = useState<ResourcePermissions>({});
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<Record<string, string>>({});

  const { roles, loading, refetchRoles } = useRoles();
  const { createRole, updateRole, loading: createLoading } = useCreateRole();
  const { projects } = useProject();
  const { forms } = useFormsData();
  const { workflows } = useWorkflowData();
  const { reports } = useReports();

  const handleStartCreate = () => {
    setIsCreating(true);
    setEditingRole(null);
    resetForm();
  };

  const handleStartEdit = (role: Role) => {
    setEditingRole(role);
    setIsCreating(false);
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    
    // Convert role permissions to the expected format
    const perms: ResourcePermissions = {};
    const assetTypes: Record<string, string> = {};
    
    // Initialize asset type selections for each project - default to forms
    projects.forEach(project => {
      assetTypes[project.id] = 'forms';
    });
    
    // Process existing permissions from the role
    role.permissions.forEach(permission => {
      // Map database resource types to frontend resource types for the key
      let frontendResourceType: string;
      if (permission.resource_type === 'form') {
        frontendResourceType = 'forms';
      } else if (permission.resource_type === 'workflow') {
        frontendResourceType = 'workflows';
      } else if (permission.resource_type === 'report') {
        frontendResourceType = 'reports';
      } else {
        frontendResourceType = permission.resource_type; // Keep as is for 'project'
      }
      
      const key = `${frontendResourceType}:${permission.resource_id || 'all'}`;
      if (!perms[key]) {
        perms[key] = [];
      }
      perms[key].push(permission.permission_type);
      
      // Set asset type based on resource type if it's an asset-specific permission
      if (permission.resource_id && permission.resource_type !== 'project') {
        // Find which project this asset belongs to
        projects.forEach(project => {
          let assetExists = false;
          
          if (permission.resource_type === 'form') {
            assetExists = forms.some(form => form.id === permission.resource_id && form.projectId === project.id);
            if (assetExists) assetTypes[project.id] = 'forms';
          } else if (permission.resource_type === 'workflow') {
            assetExists = workflows.some(workflow => 
              workflow && typeof workflow === 'object' && 
              'id' in workflow && workflow.id === permission.resource_id &&
              'projectId' in workflow && String(workflow.projectId) === project.id
            );
            if (assetExists) assetTypes[project.id] = 'workflows';
          } else if (permission.resource_type === 'report') {
            assetExists = reports.some(report => report.id === permission.resource_id && report.project_id === project.id);
            if (assetExists) assetTypes[project.id] = 'reports';
          }
        });
      }
    });
    
    setResourcePermissions(perms);
    setSelectedAssetTypes(assetTypes);
  };

  const resetForm = () => {
    setRoleName('');
    setRoleDescription('');
    setResourcePermissions({});
    
    // Initialize asset type selections for each project
    const initialAssetTypes: Record<string, string> = {};
    projects.forEach(project => {
      initialAssetTypes[project.id] = 'forms';
    });
    setSelectedAssetTypes(initialAssetTypes);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingRole(null);
    resetForm();
  };

  const handlePermissionChange = (resourceType: string, resourceId: string, permission: string, checked: boolean) => {
    const key = `${resourceType}:${resourceId}`;
    setResourcePermissions(prev => {
      const updated = { ...prev };
      if (!updated[key]) {
        updated[key] = [];
      }
      
      if (checked) {
        if (!updated[key].includes(permission)) {
          updated[key] = [...updated[key], permission];
        }
      } else {
        updated[key] = updated[key].filter(p => p !== permission);
        if (updated[key].length === 0) {
          delete updated[key];
        }
      }
      
      return updated;
    });
  };

  const isPermissionChecked = (resourceType: string, resourceId: string, permission: string): boolean => {
    const key = `${resourceType}:${resourceId}`;
    return resourcePermissions[key]?.includes(permission) || false;
  };

  const handleAssetTypeChange = (projectId: string, assetType: string) => {
    setSelectedAssetTypes(prev => ({
      ...prev,
      [projectId]: assetType
    }));
  };

  const getAssetsForProject = (projectId: string, assetType: string) => {
    switch (assetType) {
      case 'forms':
        return forms.filter(form => form.projectId === projectId);
      case 'workflows':
        return workflows.filter(workflow => {
          if (workflow && typeof workflow === 'object' && 'projectId' in workflow) {
            return String(workflow.projectId) === projectId;
          }
          return false;
        });
      case 'reports':
        return reports.filter(report => report.project_id === projectId);
      default:
        return [];
    }
  };

  const handleSubmit = async () => {
    if (!roleName.trim()) {
      toast({
        title: "Error",
        description: "Role name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const roleData = {
        name: roleName,
        description: roleDescription,
        topLevelAccess: 'no_access' as const,
        resourcePermissions,
      };

      if (editingRole) {
        await updateRole({ ...roleData, roleId: editingRole.id });
        toast({
          title: "Success",
          description: "Role updated successfully",
        });
      } else {
        await createRole(roleData);
        toast({
          title: "Success", 
          description: "Role created successfully",
        });
      }

      refetchRoles();
      handleCancel();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save role",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role deleted successfully",
      });

      refetchRoles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete role",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Create and Manage Roles</h2>
          <p className="text-sm text-muted-foreground">
            Define custom roles with specific permissions for your organization
          </p>
        </div>
        {!isCreating && !editingRole && (
          <Button onClick={handleStartCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create New Role
          </Button>
        )}
      </div>

      {/* Create/Edit Role Form */}
      {(isCreating || editingRole) && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {editingRole ? 'Edit Role' : 'Create New Role'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="roleName">Role Name *</Label>
                <Input
                  id="roleName"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g., Form Manager"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="roleDescription">Description</Label>
              <Textarea
                id="roleDescription"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                placeholder="Describe the purpose and scope of this role"
                rows={3}
              />
            </div>

            {/* Project Permissions */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Project Permissions</h3>
              <div className="space-y-6">
                {projects.map(project => {
                  const selectedAssetType = selectedAssetTypes[project.id] || 'forms';
                  const assets = getAssetsForProject(project.id, selectedAssetType);
                  
                  return (
                    <Card key={project.id}>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <FolderOpen className="h-4 w-4" />
                          Project: {project.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Project Level Permissions - Updated message */}
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-6">
                               <span className="text-sm text-muted-foreground">
                                 Only Admin can Manage Project
                               </span>
                            </div>
                            
                            {/* Asset Type Dropdown */}
                            <div className="w-40">
                              <Select 
                                value={selectedAssetType} 
                                onValueChange={(value) => handleAssetTypeChange(project.id, value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="forms">Forms</SelectItem>
                                  <SelectItem value="workflows">Workflows</SelectItem>
                                  <SelectItem value="reports">Reports</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Asset Level Permissions */}
{assets.map(asset => {
  const readChecked = isPermissionChecked(selectedAssetType, asset.id, 'read');
  const updateChecked = isPermissionChecked(selectedAssetType, asset.id, 'update');
  const deleteChecked = isPermissionChecked(selectedAssetType, asset.id, 'delete');

  // Disable 'read' checkbox if either update or delete is checked
  const disableRead = updateChecked || deleteChecked;

  return (
    <div key={asset.id} className="flex items-center justify-between p-2 border rounded">
      <div className="flex items-center gap-3">
        <span className="text-sm">{asset.name}</span>
      </div>
      <div className="flex gap-4">
        {/* Create - Always disabled */}
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={isPermissionChecked(selectedAssetType, asset.id, 'create')}
            onCheckedChange={(checked) =>
              handlePermissionChange(selectedAssetType, asset.id, 'create', checked as boolean)
            }
            disabled={true}
          />
          <Label className="text-sm">Create</Label>
        </div>

        {/* Read */}
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={readChecked}
            onCheckedChange={(checked) =>
              handlePermissionChange(selectedAssetType, asset.id, 'read', checked as boolean)
            }
            disabled={disableRead}
          />
          <Label className="text-sm">Read</Label>
        </div>

        {/* Update */}
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={updateChecked}
            onCheckedChange={(checked) => {
              if (checked && !readChecked) {
                handlePermissionChange(selectedAssetType, asset.id, 'read', true);
              }
              handlePermissionChange(selectedAssetType, asset.id, 'update', checked as boolean);
            }}
          />
          <Label className="text-sm">Update</Label>
        </div>

        {/* Delete */}
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={deleteChecked}
            onCheckedChange={(checked) => {
              if (checked && !readChecked) {
                handlePermissionChange(selectedAssetType, asset.id, 'read', true);
              }
              handlePermissionChange(selectedAssetType, asset.id, 'delete', checked as boolean);
            }}
          />
          <Label className="text-sm">Delete</Label>
        </div>
      </div>
    </div>
  );
})}

                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={createLoading}>
                <Save className="h-4 w-4 mr-2" />
                {editingRole ? 'Update Role' : 'Create Role'}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Roles List */}
      {!isCreating && !editingRole && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Existing Roles ({roles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {roles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No roles created yet</p>
                <p className="text-sm">Create your first role to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {roles.map(role => (
                  <div key={role.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{role.name}</h3>
                        <p className="text-sm text-muted-foreground">{role.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary">{role.permissions.length} permissions</Badge>
                          <span className="text-xs text-muted-foreground">
                            Created by {role.creator_name}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartEdit(role)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRole(role.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

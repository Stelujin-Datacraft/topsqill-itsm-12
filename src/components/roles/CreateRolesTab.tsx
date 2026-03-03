import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Save, X, Shield, Users, FileText, Workflow, BarChart, FolderOpen, BookOpen, LayoutDashboard, Briefcase } from 'lucide-react';
import { useRoles, Role } from '@/hooks/useRoles';
import { useCreateRole } from '@/hooks/useCreateRole';
import { useProject } from '@/contexts/ProjectContext';
import { useFormsData } from '@/hooks/useFormsData';
import { useWorkflowData } from '@/hooks/useWorkflowData';
import { useReports } from '@/hooks/useReports';
import { usePolicies } from '@/hooks/usePolicies';
import { useDashboards } from '@/hooks/useDashboards';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ResourcePermissions {
  [key: string]: string[];
}

const RESOURCE_TYPES = [
  { id: 'dashboards', label: 'Dashboards & Reports', icon: LayoutDashboard },
  { id: 'forms', label: 'Forms', icon: FileText },
  { id: 'workflows', label: 'Workflows', icon: Workflow },
  { id: 'policies', label: 'Knowledge Base', icon: BookOpen },
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
  const { policies } = usePolicies();
  const { dashboards } = useDashboards();
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
    
    // Initialize asset type selections for each project - default to dashboards
    projects.forEach(project => {
      assetTypes[project.id] = 'dashboards';
    });
    
    // Process existing permissions from the role
    role.permissions.forEach(permission => {
      // Map database resource types to frontend resource types for the key
      let frontendResourceType: string;
      const resType = permission.resource_type as string;
      if (resType === 'form') {
        frontendResourceType = 'forms';
      } else if (resType === 'workflow') {
        frontendResourceType = 'workflows';
      } else if (resType === 'report') {
        frontendResourceType = 'reports';
      } else if (resType === 'policy') {
        frontendResourceType = 'policies';
      } else if (resType === 'project') {
        frontendResourceType = 'projects';
      } else if (resType === 'dashboard') {
        frontendResourceType = 'dashboards';
      } else {
        frontendResourceType = resType;
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
          
          if (resType === 'form') {
            assetExists = forms.some(form => form.id === permission.resource_id && form.projectId === project.id);
            if (assetExists) assetTypes[project.id] = 'forms';
          } else if (resType === 'workflow') {
            assetExists = workflows.some(workflow => 
              workflow && typeof workflow === 'object' && 
              'id' in workflow && workflow.id === permission.resource_id &&
              'projectId' in workflow && String(workflow.projectId) === project.id
            );
            if (assetExists) assetTypes[project.id] = 'workflows';
          } else if (resType === 'report') {
            assetExists = reports.some(report => report.id === permission.resource_id && report.project_id === project.id);
            if (assetExists) assetTypes[project.id] = 'reports';
          } else if (resType === 'policy') {
            assetExists = policies.some(policy => policy.id === permission.resource_id && policy.project_id === project.id);
            if (assetExists) assetTypes[project.id] = 'policies';
          } else if (resType === 'dashboard') {
            assetExists = (dashboards as any[]).some(dashboard => dashboard.id === permission.resource_id && dashboard.project_id === project.id);
            if (assetExists) assetTypes[project.id] = 'dashboards';
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
      initialAssetTypes[project.id] = 'dashboards';
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
      case 'dashboards':
        return (dashboards as any[]).filter(d => d.project_id === projectId).map(d => ({ id: d.id, name: d.name }));
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
      case 'policies':
        return policies.filter(policy => policy.project_id === projectId).map(p => ({ id: p.id, name: p.name || p.policy_number || 'Untitled Policy' }));
      default:
        return [];
    }
  };

  const getReportsForDashboard = (dashboardId: string) => {
    return reports.filter(report => (report as any).dashboard_id === dashboardId);
  };

  const renderPermissionRow = (resourceType: string, asset: { id: string; name: string }, label?: string) => {
    const readChecked = isPermissionChecked(resourceType, asset.id, 'read');
    const updateChecked = isPermissionChecked(resourceType, asset.id, 'update');
    const deleteChecked = isPermissionChecked(resourceType, asset.id, 'delete');
    const disableRead = updateChecked || deleteChecked;

    return (
      <div key={asset.id} className="flex items-center justify-between p-2 border rounded">
        <div className="flex items-center gap-3">
          {label && <Badge variant="outline" className="text-xs">{label}</Badge>}
          <span className="text-sm">{asset.name}</span>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox checked={isPermissionChecked(resourceType, asset.id, 'create')} onCheckedChange={(checked) => handlePermissionChange(resourceType, asset.id, 'create', checked as boolean)} disabled={true} />
            <Label className="text-sm">Create</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox checked={readChecked} onCheckedChange={(checked) => handlePermissionChange(resourceType, asset.id, 'read', checked as boolean)} disabled={disableRead} />
            <Label className="text-sm">Read</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox checked={updateChecked} onCheckedChange={(checked) => { if (checked && !readChecked) handlePermissionChange(resourceType, asset.id, 'read', true); handlePermissionChange(resourceType, asset.id, 'update', checked as boolean); }} />
            <Label className="text-sm">Update</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox checked={deleteChecked} onCheckedChange={(checked) => { if (checked && !readChecked) handlePermissionChange(resourceType, asset.id, 'read', true); handlePermissionChange(resourceType, asset.id, 'delete', checked as boolean); }} />
            <Label className="text-sm">Delete</Label>
          </div>
        </div>
      </div>
    );
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
                                  <SelectItem value="dashboards">Dashboards & Reports</SelectItem>
                                  <SelectItem value="forms">Forms</SelectItem>
                                  <SelectItem value="workflows">Workflows</SelectItem>
                                  <SelectItem value="policies">Knowledge Base</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Asset Level Permissions */}
{/* Nested rendering for Dashboards & Reports */}
{selectedAssetType === 'dashboards' && assets.map(dashboard => {
  const dashReports = getReportsForDashboard(dashboard.id);
  return (
    <div key={dashboard.id} className="space-y-2">
      {renderPermissionRow('dashboards', dashboard, 'Dashboard')}
      {dashReports.length > 0 && (
        <div className="ml-6 space-y-1 border-l-2 border-muted pl-4">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reports in {dashboard.name}</span>
          {dashReports.map(report => renderPermissionRow('reports', report, 'Report'))}
        </div>
      )}
    </div>
  );
})}

{/* Nested rendering for Knowledge Base (Policies) */}
{selectedAssetType === 'policies' && (() => {
  const proj = projects.find(p => p.id === project.id);
  const projPolicies = getAssetsForProject(project.id, 'policies');
  return (
    <div className="space-y-2">
      {proj && renderPermissionRow('projects', { id: proj.id, name: proj.name }, 'Project')}
      {projPolicies.length > 0 && (
        <div className="ml-6 space-y-1 border-l-2 border-muted pl-4">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Policies</span>
          {projPolicies.map(policy => renderPermissionRow('policies', policy, 'Policy'))}
        </div>
      )}
    </div>
  );
})()}

{/* Flat rendering for Forms & Workflows */}
{selectedAssetType !== 'dashboards' && selectedAssetType !== 'policies' && assets.map(asset => 
  renderPermissionRow(selectedAssetType, asset)
)}

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

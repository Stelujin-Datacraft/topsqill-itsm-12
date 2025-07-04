import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Users, Shield, Settings, FileText, Workflow, BarChart3, FolderOpen, CheckSquare, Square } from 'lucide-react';
import { useCreateRole } from '@/hooks/useCreateRole';
import { useFormsData } from '@/hooks/useFormsData';
import { useWorkflowData } from '@/hooks/useWorkflowData';
import { useReports } from '@/hooks/useReports';
import { useProject } from '@/contexts/ProjectContext';
import { toast } from '@/hooks/use-toast';
import { Role } from '@/hooks/useRoles';

interface CreateRoleDialogProps {
  children?: React.ReactNode;
  onRoleCreated?: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
  editingRole?: Role | null;
}

interface ProjectAssetSelection {
  [projectId: string]: {
    project: {
      create: boolean;
      read: boolean;
      update: boolean;
      delete: boolean;
    };
    selectedAssetType: 'forms' | 'workflows' | 'reports';
    assets: {
      forms: {
        [assetId: string]: {
          create: boolean;
          read: boolean;
          update: boolean;
          delete: boolean;
        };
      };
      workflows: {
        [assetId: string]: {
          create: boolean;
          read: boolean;
          update: boolean;
          delete: boolean;
        };
      };
      reports: {
        [assetId: string]: {
          create: boolean;
          read: boolean;
          update: boolean;
          delete: boolean;
        };
      };
    };
  };
}

export function CreateRoleDialog({ children, onRoleCreated, isOpen, onOpenChange, onSuccess, editingRole }: CreateRoleDialogProps) {
  const [open, setOpen] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [projectSelections, setProjectSelections] = useState<ProjectAssetSelection>({});

  const { createRole, updateRole, loading } = useCreateRole();
  const { forms } = useFormsData();
  const { workflows } = useWorkflowData();
  const { reports } = useReports();
  const { projects } = useProject();

  // Use controlled state if props are provided
  const dialogOpen = isOpen !== undefined ? isOpen : open;
  const setDialogOpen = onOpenChange || setOpen;

  // Initialize project selections when projects change
  useEffect(() => {
    if (projects && projects.length > 0) {
      const initialSelections: ProjectAssetSelection = {};
      projects.forEach(project => {
        initialSelections[project.id] = {
          project: { create: false, read: false, update: false, delete: false },
          selectedAssetType: 'forms',
          assets: {
            forms: {},
            workflows: {},
            reports: {}
          }
        };
      });
      setProjectSelections(initialSelections);
    }
  }, [projects]);

  // Reset form when dialog opens/closes or when editing role changes
  useEffect(() => {
    if (!dialogOpen) {
      setRoleName('');
      setRoleDescription('');
      // Reset to initial state
      if (projects && projects.length > 0) {
        const resetSelections: ProjectAssetSelection = {};
        projects.forEach(project => {
          resetSelections[project.id] = {
            project: { create: false, read: false, update: false, delete: false },
            selectedAssetType: 'forms',
            assets: {
              forms: {},
              workflows: {},
              reports: {}
            }
          };
        });
        setProjectSelections(resetSelections);
      }
    } else if (editingRole && projects && projects.length > 0) {
      // Populate form with editing role data
      setRoleName(editingRole.name);
      setRoleDescription(editingRole.description || '');
      
      // Populate project selections from role permissions
      const initialSelections: ProjectAssetSelection = {};
      projects.forEach(project => {
        initialSelections[project.id] = {
          project: { create: false, read: false, update: false, delete: false },
          selectedAssetType: 'forms',
          assets: {
            forms: {},
            workflows: {},
            reports: {}
          }
        };
      });

      // Set permissions from editing role
      if (editingRole.permissions && editingRole.permissions.length > 0) {
        editingRole.permissions.forEach(permission => {
          if (permission.resource_type === 'project' && permission.resource_id) {
            const projectId = permission.resource_id;
            if (initialSelections[projectId]) {
              initialSelections[projectId].project[permission.permission_type as keyof typeof initialSelections[string]['project']] = true;
            }
          } else if (['form', 'workflow', 'report'].includes(permission.resource_type) && permission.resource_id) {
            // Find which project this asset belongs to
            const assetType = permission.resource_type === 'form' ? 'forms' : 
                             permission.resource_type === 'workflow' ? 'workflows' : 'reports';
            
            let projectId = '';
            if (assetType === 'forms') {
              const form = forms.find(f => f.id === permission.resource_id);
              projectId = form?.projectId || '';
            } else if (assetType === 'workflows') {
              const workflow = workflows.find(w => w && typeof w === 'object' && 'id' in w && w.id === permission.resource_id);
              projectId = workflow && typeof workflow === 'object' && 'project_id' in workflow ? String(workflow.project_id) : '';
            } else if (assetType === 'reports') {
              const report = reports.find(r => r.id === permission.resource_id);
              projectId = report?.project_id || '';
            }

            if (projectId && initialSelections[projectId]) {
              if (!initialSelections[projectId].assets[assetType][permission.resource_id]) {
                initialSelections[projectId].assets[assetType][permission.resource_id] = {
                  create: false, read: false, update: false, delete: false
                };
              }
              initialSelections[projectId].assets[assetType][permission.resource_id][permission.permission_type as keyof typeof initialSelections[string]['assets'][typeof assetType][string]] = true;
            }
          }
        });
      }

      setProjectSelections(initialSelections);
    }
  }, [dialogOpen, editingRole, projects, forms, workflows, reports]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roleName.trim()) {
      toast({
        title: "Error",
        description: "Role name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Starting role creation/update process');
      console.log('Project selections:', projectSelections);
      
      // Ensure projectSelections is not null/undefined
      const safeProjectSelections = projectSelections || {};
      
      // Convert project selections to the format expected by the API
      const resourcePermissions: Record<string, string[]> = {};

      Object.entries(safeProjectSelections).forEach(([projectId, selection]) => {
        if (!selection) return; // Skip if selection is null/undefined
        
        // Add project permissions
        const projectPerms: string[] = [];
        if (selection.project?.create) projectPerms.push('create');
        if (selection.project?.read) projectPerms.push('read');
        if (selection.project?.update) projectPerms.push('update');
        if (selection.project?.delete) projectPerms.push('delete');
        
        if (projectPerms.length > 0) {
          resourcePermissions[`project:${projectId}`] = projectPerms;
        }

        // Add asset permissions for all asset types
        if (selection.assets) {
          ['forms', 'workflows', 'reports'].forEach(assetType => {
            const assetPermissions = selection.assets[assetType as keyof typeof selection.assets];
            if (assetPermissions) {
              Object.entries(assetPermissions).forEach(([assetId, assetPerms]) => {
                if (!assetPerms) return; // Skip if assetPerms is null/undefined
                
                const assetPermsList: string[] = [];
                if (assetPerms.create) assetPermsList.push('create');
                if (assetPerms.read) assetPermsList.push('read');
                if (assetPerms.update) assetPermsList.push('update');
                if (assetPerms.delete) assetPermsList.push('delete');
                
                if (assetPermsList.length > 0) {
                  // Keep the original asset type for proper mapping in the hook
                  resourcePermissions[`${assetType}:${assetId}`] = assetPermsList;
                }
              });
            }
          });
        }
      });

      console.log('Resource permissions prepared:', resourcePermissions);

      if (editingRole) {
        // Update existing role
        await updateRole({
          roleId: editingRole.id,
          name: roleName,
          description: roleDescription,
          topLevelAccess: 'no_access', // Default value since we removed the field
          resourcePermissions
        });
        
        toast({
          title: "Success",
          description: "Role updated successfully",
        });
      } else {
        // Create new role
        await createRole({
          name: roleName,
          description: roleDescription,
          topLevelAccess: 'no_access', // Default value since we removed the field
          resourcePermissions
        });
        
        toast({
          title: "Success",
          description: "Role created successfully",
        });
      }

      // Close dialog first
      setDialogOpen(false);
      
      // Then trigger callbacks with a slight delay to ensure state is updated
      setTimeout(() => {
        if (onRoleCreated) {
          onRoleCreated();
        }
        if (onSuccess) {
          onSuccess();
        }
      }, 100);
      
    } catch (error) {
      console.error('Error saving role:', error);
      
      // Provide more detailed error message
      let errorMessage = editingRole ? "Failed to update role" : "Failed to create role";
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleSelectAll = () => {
    if (!projects || projects.length === 0) return;
    
    const updatedSelections = { ...projectSelections };
    
    projects.forEach(project => {
      // Select all project permissions
      updatedSelections[project.id] = {
        ...updatedSelections[project.id],
        project: { create: true, read: true, update: true, delete: true }
      };

      // Select all assets for all types
      ['forms', 'workflows', 'reports'].forEach(assetType => {
        const assets = getAssetsForProject(project.id, assetType as 'forms' | 'workflows' | 'reports');
        assets.forEach(asset => {
          if (!updatedSelections[project.id].assets[assetType as keyof typeof updatedSelections[string]['assets']][asset.id]) {
            updatedSelections[project.id].assets[assetType as keyof typeof updatedSelections[string]['assets']][asset.id] = {
              create: false, read: false, update: false, delete: false
            };
          }
          updatedSelections[project.id].assets[assetType as keyof typeof updatedSelections[string]['assets']][asset.id] = {
            create: true, read: true, update: true, delete: true
          };
        });
      });
    });

    setProjectSelections(updatedSelections);
  };

  const handleReset = () => {
    if (!projects || projects.length === 0) return;
    
    const resetSelections: ProjectAssetSelection = {};
    projects.forEach(project => {
      resetSelections[project.id] = {
        project: { create: false, read: false, update: false, delete: false },
        selectedAssetType: 'forms',
        assets: {
          forms: {},
          workflows: {},
          reports: {}
        }
      };
    });
    setProjectSelections(resetSelections);
  };

  const handleProjectPermissionChange = (projectId: string, permission: string, checked: boolean) => {
    setProjectSelections(prev => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        project: {
          ...prev[projectId]?.project,
          [permission]: checked
        }
      }
    }));
  };

  const handleAssetTypeChange = (projectId: string, assetType: 'forms' | 'workflows' | 'reports') => {
    setProjectSelections(prev => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        selectedAssetType: assetType
        // Don't reset assets - keep all asset selections
      }
    }));
  };

  const handleAssetPermissionChange = (projectId: string, assetId: string, permission: string, checked: boolean) => {
    setProjectSelections(prev => {
      const currentSelection = prev[projectId];
      const currentAssetType = currentSelection?.selectedAssetType || 'forms';
      
      return {
        ...prev,
        [projectId]: {
          ...currentSelection,
          assets: {
            ...currentSelection?.assets,
            [currentAssetType]: {
              ...currentSelection?.assets?.[currentAssetType],
              [assetId]: {
                ...currentSelection?.assets?.[currentAssetType]?.[assetId],
                [permission]: checked
              }
            }
          }
        }
      };
    });
  };

  const getAssetsForProject = (projectId: string, assetType: 'forms' | 'workflows' | 'reports') => {
    switch (assetType) {
      case 'forms':
        return forms.filter(form => form.projectId === projectId);
      case 'workflows':
        return workflows.filter(workflow => {
          if (workflow && typeof workflow === 'object' && 'project_id' in workflow) {
            return String(workflow.project_id) === projectId;
          }
          return false;
        });
      case 'reports':
        return reports.filter(report => report.project_id === projectId);
      default:
        return [];
    }
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'forms': return <FileText className="h-4 w-4" />;
      case 'workflows': return <Workflow className="h-4 w-4" />;
      case 'reports': return <BarChart3 className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const permissionLabels = ['create', 'read', 'update', 'delete'];

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {children && (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {editingRole ? 'Edit Role' : 'Create New Role'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            {/* Fixed Basic Information Section */}
            <div className="px-6 py-4 border-b bg-gray-50/50">
              <div className="grid grid-cols-1 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="roleName">Role Name</Label>
                  <Input
                    id="roleName"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="Enter role name"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="roleDescription">Description</Label>
                <Textarea
                  id="roleDescription"
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  placeholder="Describe this role's purpose and responsibilities"
                  rows={2}
                />
              </div>
            </div>

            {/* Scrollable Project Permissions Section */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-6 py-3 border-b bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Project Permissions</h3>
                    <Badge variant="secondary">{projects?.length || 0} projects</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      className="flex items-center gap-2"
                    >
                      <CheckSquare className="h-4 w-4" />
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleReset}
                      className="flex items-center gap-2"
                    >
                      <Square className="h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="p-6 space-y-4">
                    {projects && projects.length > 0 ? projects.map((project) => {
                      const projectSelection = projectSelections[project.id];
                      const selectedAssets = getAssetsForProject(project.id, projectSelection?.selectedAssetType || 'forms');

                      return (
                        <Card key={project.id} className="border-2">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <FolderOpen className="h-4 w-4" />
                              {project.name}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Project Level Permissions */}
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <span className="font-medium">Project: {project.name}</span>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="flex gap-4">
                                  {permissionLabels.map((permission) => (
                                    <div key={permission} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`project-${project.id}-${permission}`}
                                        checked={projectSelection?.project?.[permission as keyof typeof projectSelection.project] || false}
                                        onCheckedChange={(checked) =>
                                          handleProjectPermissionChange(project.id, permission, checked as boolean)
                                        }
                                      />
                                      <Label
                                        htmlFor={`project-${project.id}-${permission}`}
                                        className="text-sm capitalize"
                                      >
                                        {permission === 'create' ? 'C' : permission === 'read' ? 'R' : permission === 'update' ? 'U' : 'D'}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                                <div className="w-40">
                                  <Select 
                                    value={projectSelection?.selectedAssetType || 'forms'} 
                                    onValueChange={(value: 'forms' | 'workflows' | 'reports') => 
                                      handleAssetTypeChange(project.id, value)
                                    }
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
                            </div>

                            {/* Asset Level Permissions */}
                            {selectedAssets.length > 0 && (
                              <div className="space-y-2 ml-4">
                                {selectedAssets.map((asset) => {
                                  const currentAssetType = projectSelection?.selectedAssetType || 'forms';
                                  const assetPermissions = projectSelection?.assets?.[currentAssetType]?.[asset.id];
                                  
                                  return (
                                    <div key={asset.id} className="flex items-center justify-between p-2 border rounded">
                                      <div className="flex items-center gap-3">
                                        {getAssetIcon(currentAssetType)}
                                        <span className="text-sm">{asset.name}</span>
                                      </div>
                                      <div className="flex gap-4">
                                        {permissionLabels.map((permission) => (
                                          <div key={permission} className="flex items-center space-x-2">
                                            <Checkbox
                                              id={`asset-${asset.id}-${permission}`}
                                              checked={assetPermissions?.[permission as keyof typeof assetPermissions] || false}
                                              onCheckedChange={(checked) =>
                                                handleAssetPermissionChange(project.id, asset.id, permission, checked as boolean)
                                              }
                                            />
                                            <Label
                                              htmlFor={`asset-${asset.id}-${permission}`}
                                              className="text-sm"
                                            >
                                              {permission === 'create' ? 'C' : permission === 'read' ? 'R' : permission === 'update' ? 'U' : 'D'}
                                            </Label>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    }) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No projects available</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="px-6 py-4 border-b bg-gray-50/50">
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (editingRole ? 'Updating...' : 'Creating...') : (editingRole ? 'Update Role' : 'Create Role')}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

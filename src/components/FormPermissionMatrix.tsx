
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Users, 
  Info,
  Eye,
  Edit,
  Settings,
  Database,
  Share,
  LifeBuoy
} from 'lucide-react';
import { Form } from '@/types/form';
import { useFormAccessMatrix } from '@/hooks/useFormAccessMatrix';
import { useRoles } from '@/hooks/useRoles';
import { useUserRoleAssignments } from '@/hooks/useUserRoleAssignments';

interface FormPermissionMatrixProps {
  form: Form;
}

interface FormPermissionType {
  id: string;
  label: string;
  description: string;
  category: string;
}

const FORM_PERMISSION_TYPES: FormPermissionType[] = [
  { id: 'view_form', label: 'View Form', description: 'Can view form structure and fields', category: 'access' },
  { id: 'edit_form', label: 'Edit Form', description: 'Can modify form structure and fields', category: 'access' },
  { id: 'create_form', label: 'Create Form', description: 'Can create new forms', category: 'access' },
  { id: 'delete_form', label: 'Delete Form', description: 'Can delete forms', category: 'access' },
  { id: 'submit_form', label: 'Submit Form', description: 'Can submit form responses', category: 'content' },
  { id: 'edit_rules', label: 'Edit Rules', description: 'Can configure form rules and logic', category: 'content' },
  { id: 'view_submissions', label: 'View Submissions', description: 'Can view form responses', category: 'content' },
  { id: 'create_records', label: 'Create Records', description: 'Can create new form records', category: 'content' },
  { id: 'export_data', label: 'Export Data', description: 'Can export form data', category: 'management' },
  { id: 'manage_access', label: 'Manage Access', description: 'Can manage user access to form', category: 'management' },
  { id: 'change_settings', label: 'Change Settings', description: 'Can modify form settings', category: 'management' },
  { id: 'change_lifecycle', label: 'Change Lifecycle', description: 'Can change form status', category: 'management' },
];

const PERMISSION_CATEGORIES = {
  access: { label: 'Access', icon: Eye, color: 'text-blue-600' },
  content: { label: 'Content', icon: Edit, color: 'text-green-600' },
  management: { label: 'Management', icon: Settings, color: 'text-purple-600' }
};

// Map form permissions to role permissions
const FORM_TO_ROLE_PERMISSION_MAP: Record<string, string> = {
  'view_form': 'read',
  'edit_form': 'update',
  'create_form': 'create',
  'delete_form': 'delete'
};

export function FormPermissionMatrix({ form }: FormPermissionMatrixProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkPermissions, setBulkPermissions] = useState<Record<string, boolean>>({});
  
  const {
    users,
    loading,
    updating,
    grantPermission,
    revokePermission,
    bulkUpdatePermissions,
  } = useFormAccessMatrix(form.id);

  const { roles } = useRoles();
  const { assignments: userRoleAssignments } = useUserRoleAssignments();

  const handleUserSelection = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleBulkPermissionChange = (permissionType: string, checked: boolean) => {
    setBulkPermissions(prev => ({
      ...prev,
      [permissionType]: checked
    }));
  };

  const handleBulkApply = async () => {
    if (selectedUsers.length === 0 || Object.keys(bulkPermissions).length === 0) {
      return;
    }

    await bulkUpdatePermissions(selectedUsers, bulkPermissions);
    setSelectedUsers([]);
    setBulkPermissions({});
  };

  const handleTogglePermission = async (userId: string, permissionType: string, currentlyGranted: boolean) => {
    // Check if this permission is controlled by role
    const rolePermission = FORM_TO_ROLE_PERMISSION_MAP[permissionType];
    if (rolePermission && isPermissionControlledByRole(userId, permissionType)) {
      return; // Don't allow manual toggle if controlled by role
    }

    if (currentlyGranted) {
      await revokePermission(userId, permissionType);
    } else {
      await grantPermission(userId, permissionType);
    }
  };

  const getUserRole = (userId: string) => {
    const assignment = userRoleAssignments.find(a => a.user_id === userId);
    if (!assignment) return null;
    return roles.find(r => r.id === assignment.role_id);
  };

  const isPermissionControlledByRole = (userId: string, permissionType: string): boolean => {
    const rolePermission = FORM_TO_ROLE_PERMISSION_MAP[permissionType];
    if (!rolePermission) return false;

    const userRole = getUserRole(userId);
    if (!userRole) return false;

    // Check if the user's role has the corresponding permission for forms
    return userRole.permissions.some(p => 
      p.resource_type === 'form' && 
      p.permission_type === rolePermission &&
      (p.resource_id === form.id || !p.resource_id) // Either specific form or all forms
    );
  };

  const getPermissionStatus = (user: any, permissionType: string) => {
    const permission = user.permissions[permissionType];
    const baseStatus = permission ? { granted: permission.granted, explicit: permission.explicit } : { granted: false, explicit: false };
    
    // Check if this permission should be controlled by role
    const rolePermission = FORM_TO_ROLE_PERMISSION_MAP[permissionType];
    if (rolePermission) {
      const isControlledByRole = isPermissionControlledByRole(user.user_id, permissionType);
      if (isControlledByRole) {
        return { granted: true, explicit: false, controlledByRole: true };
      }
    }

    // Special case for view_form - always granted if no role but user is in project
    if (permissionType === 'view_form' && !getUserRole(user.user_id)) {
      return { granted: true, explicit: false, controlledByRole: false };
    }

    return { ...baseStatus, controlledByRole: false };
  };

  const isPermissionDisabled = (userId: string, permissionType: string): boolean => {
    const rolePermission = FORM_TO_ROLE_PERMISSION_MAP[permissionType];
    if (!rolePermission) return false;

    const userRole = getUserRole(userId);
    
    // If user has no role and it's view_form, it should be checked but disabled
    if (permissionType === 'view_form' && !userRole) {
      return true;
    }

    // If controlled by role, disable the checkbox
    return isPermissionControlledByRole(userId, permissionType);
  };

  // Reorganize permissions to show access permissions first and side by side
  const accessPermissions = FORM_PERMISSION_TYPES.filter(p => p.category === 'access');
  const contentPermissions = FORM_PERMISSION_TYPES.filter(p => p.category === 'content');
  const managementPermissions = FORM_PERMISSION_TYPES.filter(p => p.category === 'management');
  
  const reorganizedGroupedPermissions = {
    access: accessPermissions,
    content: contentPermissions,
    management: managementPermissions
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading permission matrix...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permission Matrix
          </h3>
          <p className="text-muted-foreground text-sm">
            Manage granular permissions for "{form.name}"
          </p>
        </div>
        
        {selectedUsers.length > 0 && Object.keys(bulkPermissions).length > 0 && (
          <Button onClick={handleBulkApply} disabled={updating === 'bulk'}>
            Apply to {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''}
          </Button>
        )}
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Permission Categories:</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• <strong>Access:</strong> Basic form viewing, editing, creating, and deletion permissions</li>
            <li>• <strong>Content:</strong> Permissions to modify form content and view data</li>
            <li>• <strong>Management:</strong> Administrative permissions for form settings</li>
          </ul>
          <div className="mt-2 text-sm">
            <strong>Note:</strong> View Form, Edit Form, Create Form, and Delete Form permissions are automatically controlled by assigned roles and cannot be manually edited when a role is assigned.
          </div>
        </AlertDescription>
      </Alert>

      {/* Bulk Operations Panel */}
      {selectedUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bulk Permission Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Selected users: {selectedUsers.length}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map(userId => {
                    const user = users.find(u => u.user_id === userId);
                    return (
                      <Badge key={userId} variant="secondary">
                        {user?.email}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Select permissions to apply:</p>
                {Object.entries(reorganizedGroupedPermissions).map(([category, permissions]) => {
                  const CategoryIcon = PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES]?.icon || Shield;
                  return (
                    <div key={category} className="border rounded-lg p-3">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <CategoryIcon className={`h-4 w-4 ${PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES]?.color}`} />
                        {PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES]?.label}
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {permissions.map(permission => {
                          const isRoleControlled = FORM_TO_ROLE_PERMISSION_MAP[permission.id];
                          return (
                            <label key={permission.id} className="flex items-center space-x-2 text-sm">
                              <Checkbox
                                checked={bulkPermissions[permission.id] || false}
                                onCheckedChange={(checked) => 
                                  handleBulkPermissionChange(permission.id, checked as boolean)
                                }
                                disabled={!!isRoleControlled}
                              />
                              <span className={isRoleControlled ? 'text-muted-foreground' : ''}>
                                {permission.label}
                                {isRoleControlled && ' (Role Controlled)'}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permission Matrix Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Permissions Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedUsers.length === users.length && users.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUsers(users.map(u => u.user_id));
                        } else {
                          setSelectedUsers([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead className="min-w-[200px]">User</TableHead>
                  <TableHead>Role</TableHead>
                  {Object.entries(reorganizedGroupedPermissions).map(([category, permissions]) => (
                    <TableHead 
                      key={category}
                      colSpan={permissions.length}
                      className="text-center border-l-2 border-muted font-semibold"
                    >
                      <div className="flex items-center justify-center gap-1">
                        {React.createElement(PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES]?.icon || Shield, {
                          className: `h-4 w-4 ${PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES]?.color}`
                        })}
                        {PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES]?.label}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead></TableHead>
                  <TableHead></TableHead>
                  {Object.entries(reorganizedGroupedPermissions).map(([category, permissions]) => 
                    permissions.map(permission => (
                      <TableHead 
                        key={permission.id}
                        className="text-xs text-center min-w-[100px] p-2"
                        title={permission.description}
                      >
                        <div className="writing-mode-vertical transform rotate-180">
                          {permission.label}
                        </div>
                      </TableHead>
                    ))
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const userRole = getUserRole(user.user_id);
                  return (
                    <TableRow key={user.user_id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.includes(user.user_id)}
                          onCheckedChange={(checked) => 
                            handleUserSelection(user.user_id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.email}</div>
                          {(user.first_name || user.last_name) && (
                            <div className="text-sm text-muted-foreground">
                              {[user.first_name, user.last_name].filter(Boolean).join(' ')}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={user.project_role === 'admin' ? 'default' : 'secondary'}>
                            {user.project_role}
                          </Badge>
                          {userRole && (
                            <Badge variant="outline" className="text-xs">
                              {userRole.name}
                            </Badge>
                          )}
                          {user.has_explicit_permissions && (
                            <Badge variant="outline" className="text-xs">
                              Custom
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {Object.entries(reorganizedGroupedPermissions).map(([category, permissions]) => 
                        permissions.map(permission => {
                          const status = getPermissionStatus(user, permission.id);
                          const isUpdating = updating === `${user.user_id}-${permission.id}`;
                          const isDisabled = isPermissionDisabled(user.user_id, permission.id);
                          
                          return (
                            <TableCell key={permission.id} className="text-center p-2">
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  checked={status.granted}
                                  onCheckedChange={(checked) => 
                                    handleTogglePermission(user.user_id, permission.id, status.granted)
                                  }
                                  disabled={isUpdating || isDisabled}
                                />
                                {status.explicit && (
                                  <div className="ml-1">
                                    <Badge variant="outline" className="text-xs h-4">E</Badge>
                                  </div>
                                )}
                                {status.controlledByRole && (
                                  <div className="ml-1">
                                    <Badge variant="outline" className="text-xs h-4">R</Badge>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          );
                        })
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No users found</p>
              <p className="text-sm">Add users to the project to manage their form permissions</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-semibold mb-3">Permission Status</h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Checkbox checked={true} disabled className="scale-75" />
                  <span>Permission granted</span>
                </li>
                <li className="flex items-center gap-2">
                  <Checkbox checked={false} disabled className="scale-75" />
                  <span>Permission not granted</span>
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs h-4">E</Badge>
                  <span>Explicit permission (overrides role defaults)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs h-4">R</Badge>
                  <span>Role-controlled permission (automatic)</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Available Permissions</h4>
              <ul className="space-y-1">
                {FORM_PERMISSION_TYPES.map(permission => (
                  <li key={permission.id} className="text-xs">
                    <strong>{permission.label}:</strong> {permission.description}
                    {FORM_TO_ROLE_PERMISSION_MAP[permission.id] && (
                      <span className="text-muted-foreground"> (Role-controlled)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

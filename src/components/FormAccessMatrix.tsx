
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { 
  Shield, 
  Check, 
  X, 
  Users, 
  AlertTriangle,
  Info
} from 'lucide-react';
import { Form } from '@/types/form';
import { useFormAccessMatrix, FORM_PERMISSION_TYPES } from '@/hooks/useFormAccessMatrix';
import { useRoles } from '@/hooks/useRoles';
import { useUserRoleAssignments } from '@/hooks/useUserRoleAssignments';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FormAccessMatrixProps {
  form: Form;
}

// Updated permission types with Create Form and Delete Form
const UPDATED_FORM_PERMISSION_TYPES = [
  { id: 'view_form', label: 'View Form', description: 'Can view form structure and fields', category: 'access', roleControlled: true },
  { id: 'submit_form', label: 'Submit Form', description: 'Can submit form responses', category: 'access', roleControlled: false },
  { id: 'create_form', label: 'Create Form', description: 'Can create new forms', category: 'content', roleControlled: true },
  { id: 'edit_form', label: 'Edit Form', description: 'Can modify form structure and fields', category: 'content', roleControlled: true },
  { id: 'delete_form', label: 'Delete Form', description: 'Can delete forms', category: 'management', roleControlled: true },
  { id: 'edit_rules', label: 'Edit Rules', description: 'Can configure form rules and logic', category: 'content', roleControlled: false },
  { id: 'view_submissions', label: 'View Submissions', description: 'Can view form responses', category: 'content', roleControlled: false },
  { id: 'create_records', label: 'Create Records', description: 'Can create new form records', category: 'content', roleControlled: false },
  { id: 'export_data', label: 'Export Data', description: 'Can export form data', category: 'management', roleControlled: false },
  { id: 'manage_access', label: 'Manage Access', description: 'Can manage user access to form', category: 'management', roleControlled: false },
  { id: 'change_settings', label: 'Change Settings', description: 'Can modify form settings', category: 'management', roleControlled: false },
  { id: 'change_lifecycle', label: 'Change Lifecycle', description: 'Can change form status', category: 'management', roleControlled: false },
];

export function FormAccessMatrix({ form }: FormAccessMatrixProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({});
  
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

  const handlePermissionSelection = (permissionType: string, checked: boolean) => {
    setSelectedPermissions(prev => ({
      ...prev,
      [permissionType]: checked
    }));
  };

  const handleBulkApply = async () => {
    if (selectedUsers.length === 0 || Object.keys(selectedPermissions).length === 0) {
      return;
    }

    await bulkUpdatePermissions(selectedUsers, selectedPermissions);
    setSelectedUsers([]);
    setSelectedPermissions({});
  };

  const getUserRoleInfo = (userId: string) => {
    const roleAssignment = userRoleAssignments.find(assignment => assignment.user_id === userId);
    const assignedRole = roleAssignment ? roles.find(role => role.id === roleAssignment.role_id) : null;
    return assignedRole;
  };

  const getPermissionStatus = (user: any, permissionType: string) => {
    const permission = user.permissions[permissionType];
    const userRole = getUserRoleInfo(user.user_id);
    const permissionConfig = UPDATED_FORM_PERMISSION_TYPES.find(p => p.id === permissionType);
    
    // Check if this permission is role-controlled
    if (permissionConfig?.roleControlled) {
      if (!userRole) {
        // No role assigned - only view_form is granted by default
        return {
          granted: permissionType === 'view_form',
          explicit: false,
          roleControlled: true,
          editable: false
        };
      } else {
        // Check if role has this permission
        const hasRolePermission = userRole.permissions.some(p => 
          p.resource_type === 'form' && 
          (
            (permissionType === 'view_form' && p.permission_type === 'read') ||
            (permissionType === 'edit_form' && p.permission_type === 'update') ||
            (permissionType === 'create_form' && p.permission_type === 'create') ||
            (permissionType === 'delete_form' && p.permission_type === 'delete')
          )
        );
        
        return {
          granted: hasRolePermission,
          explicit: false,
          roleControlled: true,
          editable: false
        };
      }
    }
    
    // Manual permissions - can be toggled
    if (!permission) return { granted: false, explicit: false, roleControlled: false, editable: true };
    return { 
      granted: permission.granted, 
      explicit: permission.explicit, 
      roleControlled: false, 
      editable: true 
    };
  };

  const handleTogglePermission = async (userId: string, permissionType: string, currentStatus: any) => {
    if (!currentStatus.editable) return; // Don't allow toggling role-controlled permissions
    
    if (currentStatus.granted) {
      await revokePermission(userId, permissionType);
    } else {
      await grantPermission(userId, permissionType);
    }
  };

  const groupedPermissions = UPDATED_FORM_PERMISSION_TYPES.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, typeof UPDATED_FORM_PERMISSION_TYPES>);

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
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Permission Matrix
          </h2>
          <p className="text-muted-foreground">
            Manage granular permissions for "{form.name}"
          </p>
        </div>
        
        {selectedUsers.length > 0 && Object.keys(selectedPermissions).length > 0 && (
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
            <li>• <strong>Role-Controlled:</strong> View Form, Edit Form, Create Form, Delete Form are controlled by assigned roles</li>
            <li>• <strong>Manual:</strong> Other permissions can be manually configured</li>
            <li>• <strong>Default:</strong> Users without roles have View Form access by default</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Bulk Operations */}
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
              
              <div>
                <p className="text-sm text-muted-foreground mb-2">Select permissions to apply:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {FORM_PERMISSION_TYPES.map(permission => (
                    <label key={permission.id} className="flex items-center space-x-2 text-sm">
                      <Checkbox
                        checked={selectedPermissions[permission.id] || false}
                        onCheckedChange={(checked) => 
                          handlePermissionSelection(permission.id, checked as boolean)
                        }
                      />
                      <span>{permission.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permission Matrix */}
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
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  {Object.entries(groupedPermissions).map(([category, permissions]) => (
                    <React.Fragment key={category}>
                      <TableHead 
                        colSpan={permissions.length}
                        className="text-center border-l-2 border-muted font-semibold"
                      >
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </TableHead>
                    </React.Fragment>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead></TableHead>
                  <TableHead></TableHead>
                  {Object.entries(groupedPermissions).map(([category, permissions]) => 
                    permissions.map(permission => (
                      <TableHead 
                        key={permission.id}
                        className="text-xs writing-mode-vertical text-center min-w-[80px]"
                        title={permission.description}
                      >
                        {permission.label}
                        {permission.roleControlled && <span className="text-blue-600">*</span>}
                      </TableHead>
                    ))
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const userRole = getUserRoleInfo(user.user_id);
                  
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
                          {userRole ? (
                            <Badge variant="outline" className="text-xs">
                              {userRole.name}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              No Role
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {Object.entries(groupedPermissions).map(([category, permissions]) => 
                        permissions.map(permission => {
                          const status = getPermissionStatus(user, permission.id);
                          const isUpdating = updating === `${user.user_id}-${permission.id}`;
                          
                          return (
                            <TableCell key={permission.id} className="text-center">
                              <div className="flex items-center justify-center">
                                <Switch
                                  checked={status.granted}
                                  onCheckedChange={(checked) => 
                                    handleTogglePermission(user.user_id, permission.id, status)
                                  }
                                  disabled={!status.editable || isUpdating}
                                  className={`${
                                    status.granted ? 'data-[state=checked]:bg-green-600' : ''
                                  } ${!status.editable ? 'opacity-50' : ''}`}
                                />
                                {status.roleControlled && (
                                  <div className="ml-1">
                                    <Badge variant="outline" className="text-xs">R</Badge>
                                  </div>
                                )}
                                {status.explicit && (
                                  <div className="ml-1">
                                    <Badge variant="outline" className="text-xs">E</Badge>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Permission Status</h4>
              <ul className="space-y-1">
                <li className="flex items-center gap-2">
                  <Switch checked={true} disabled className="scale-75" />
                  <span>Permission granted</span>
                </li>
                <li className="flex items-center gap-2">
                  <Switch checked={false} disabled className="scale-75" />
                  <span>Permission not granted</span>
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">R</Badge>
                  <span>Role-controlled (automatic based on role)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">E</Badge>
                  <span>Explicit permission (manual override)</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Permission Types</h4>
              <ul className="space-y-1">
                <li>• <strong>Role-Controlled (*)</strong>: Managed automatically by assigned roles</li>
                <li>• <strong>Manual</strong>: Can be toggled individually</li>
                <li>• <strong>Default Viewer</strong>: View Form access for users without roles</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

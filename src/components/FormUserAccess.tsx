
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Shield, 
  Users, 
  Globe,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { Form } from '@/types/form';
import { useFormAccessMatrix, FORM_PERMISSION_TYPES } from '@/hooks/useFormAccessMatrix';
import { FormPermissionHelp } from '@/components/FormPermissionHelp';
import { UserInviteToForm } from '@/components/UserInviteToForm';

interface FormUserAccessProps {
  form: Form;
  onUpdateForm: (updates: Partial<Form>) => void;
}

const PERMISSION_CATEGORIES = {
  access: { label: 'Access', color: 'text-blue-600' },
  content: { label: 'Content', color: 'text-green-600' },
  management: { label: 'Management', color: 'text-purple-600' }
};

export function FormUserAccess({ form, onUpdateForm }: FormUserAccessProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkPermissions, setBulkPermissions] = useState<Record<string, boolean>>({});
  
  const {
    users,
    loading,
    updating,
    grantPermission,
    revokePermission,
    bulkUpdatePermissions,
    reloadPermissions,
  } = useFormAccessMatrix(form.id);

  const handleTogglePublic = (isPublic: boolean) => {
    onUpdateForm({ isPublic: isPublic });
  };

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
    if (currentlyGranted) {
      await revokePermission(userId, permissionType);
    } else {
      await grantPermission(userId, permissionType);
    }
  };

  const getPermissionStatus = (user: any, permissionType: string) => {
    const permission = user.permissions[permissionType];
    return permission ? { granted: permission.granted, explicit: permission.explicit } : { granted: false, explicit: false };
  };

  const groupedPermissions = FORM_PERMISSION_TYPES.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, typeof FORM_PERMISSION_TYPES>);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading permission matrix...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 relative p-4 md:p-6">
      <FormPermissionHelp />
      
      {/* Header with Form Access Status */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold truncate">Access Management</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Manage permissions and access control for "{form.name}"
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            {form.isPublic ? (
              <>
                <Globe className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                <Badge variant="default" className="bg-green-100 text-green-800 text-xs md:text-sm">
                  Public Form
                </Badge>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
                <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs md:text-sm">
                  Private Form
                </Badge>
              </>
            )}
          </div>
          
          <Button
            variant="outline"
            onClick={() => handleTogglePublic(!form.isPublic)}
            className="flex items-center gap-2 text-xs md:text-sm px-2 md:px-4 py-1 md:py-2"
            size="sm"
          >
            {form.isPublic ? <EyeOff className="h-3 w-3 md:h-4 md:w-4" /> : <Eye className="h-3 w-3 md:h-4 md:w-4" />}
            <span className="hidden sm:inline">Make {form.isPublic ? 'Private' : 'Public'}</span>
            <span className="sm:hidden">{form.isPublic ? 'Private' : 'Public'}</span>
          </Button>
        </div>
      </div>

      {/* Access Type Information */}
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="p-3 md:p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                <h3 className="font-semibold text-sm md:text-base">Public Form Access</h3>
              </div>
              <ul className="text-xs md:text-sm text-muted-foreground space-y-1">
                <li>• Anyone with the link can view and submit</li>
                <li>• No authentication required for submission</li>
                <li>• Viewing submissions requires explicit permission</li>
                <li>• Editing form requires explicit permission</li>
                <li>• Form creator has full permissions automatically</li>
              </ul>
            </div>
            
            <div className="p-3 md:p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
                <h3 className="font-semibold text-sm md:text-base">Private Form Access</h3>
              </div>
              <ul className="text-xs md:text-sm text-muted-foreground space-y-1">
                <li>• Requires authentication for any access</li>
                <li>• Requires explicit permission for submission</li>
                <li>• Access via direct assignment or invitation</li>
                <li>• Access request workflow available</li>
                <li>• Project-level permissions may apply</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg md:text-xl font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 md:h-5 md:w-5" />
            Advanced Permission Matrix
          </h3>
          <p className="text-muted-foreground text-xs md:text-sm">
            Manage granular permissions for "{form.name}"
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <UserInviteToForm formId={form.id} onUserAdded={reloadPermissions} />
          {selectedUsers.length > 0 && Object.keys(bulkPermissions).length > 0 && (
            <Button onClick={handleBulkApply} disabled={updating === 'bulk'} size="sm">
              Apply to {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Operations Panel */}
      {selectedUsers.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg">Bulk Permission Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs md:text-sm text-muted-foreground mb-2">
                Selected users: {selectedUsers.length}
              </p>
              <div className="flex flex-wrap gap-1 md:gap-2">
                {selectedUsers.map(userId => {
                  const user = users.find(u => u.user_id === userId);
                  return (
                    <Badge key={userId} variant="secondary" className="text-xs">
                      {user?.email}
                    </Badge>
                  );
                })}
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="text-xs md:text-sm text-muted-foreground">Select permissions to apply:</p>
              {Object.entries(groupedPermissions).map(([category, permissions]) => (
                <div key={category} className="border rounded-lg p-2 md:p-3">
                  <h4 className="font-medium mb-2 flex items-center gap-2 text-sm md:text-base">
                    <Shield className={`h-3 w-3 md:h-4 md:w-4 ${PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES]?.color}`} />
                    {PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES]?.label}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {permissions.map(permission => (
                      <label key={permission.id} className="flex items-center space-x-2 text-xs md:text-sm">
                        <Checkbox
                          checked={bulkPermissions[permission.id] || false}
                          onCheckedChange={(checked) => 
                            handleBulkPermissionChange(permission.id, checked as boolean)
                          }
                        />
                        <span>{permission.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permission Matrix Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Users className="h-4 w-4 md:h-5 md:w-5" />
            User Permissions Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 md:w-12">
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
                  <TableHead className="min-w-[150px] md:min-w-[200px]">User</TableHead>
                  <TableHead className="min-w-[80px]">Role</TableHead>
                  {Object.entries(groupedPermissions).map(([category, permissions]) => (
                    <TableHead 
                      key={category}
                      colSpan={permissions.length}
                      className="text-center border-l-2 border-muted font-semibold min-w-[100px]"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <Shield className={`h-3 w-3 md:h-4 md:w-4 ${PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES]?.color}`} />
                        <span className="text-xs md:text-sm">{PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES]?.label}</span>
                      </div>
                    </TableHead>
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
                        className="text-xs text-center min-w-[80px] md:min-w-[100px] p-1 md:p-2"
                        title={permission.description}
                      >
                        <div className="whitespace-nowrap transform rotate-0">
                          {permission.label}
                        </div>
                      </TableHead>
                    ))
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="p-2">
                      <Checkbox
                        checked={selectedUsers.includes(user.user_id)}
                        onCheckedChange={(checked) => 
                          handleUserSelection(user.user_id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <div>
                        <div className="font-medium text-xs md:text-sm">{user.email}</div>
                        {(user.first_name || user.last_name) && (
                          <div className="text-xs text-muted-foreground">
                            {[user.first_name, user.last_name].filter(Boolean).join(' ')}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-2">
                      <div className="flex flex-col gap-1">
                        <Badge variant={user.project_role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                          {user.project_role}
                        </Badge>
                        {user.has_explicit_permissions && (
                          <Badge variant="outline" className="text-xs">
                            Custom
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {Object.entries(groupedPermissions).map(([category, permissions]) => 
                      permissions.map(permission => {
                        const status = getPermissionStatus(user, permission.id);
                        const isUpdating = updating === `${user.user_id}-${permission.id}`;
                        
                        return (
                          <TableCell key={permission.id} className="text-center p-1 md:p-2">
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={status.granted}
                                onCheckedChange={(checked) => 
                                  handleTogglePermission(user.user_id, permission.id, status.granted)
                                }
                                disabled={isUpdating}
                              />
                              {status.explicit && (
                                <div className="ml-1">
                                  <Badge variant="outline" className="text-xs h-3 w-3 p-0 flex items-center justify-center">E</Badge>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        );
                      })
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-8 md:py-12 text-muted-foreground">
              <Shield className="h-8 w-8 md:h-12 md:w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm md:text-base">No users found</p>
              <p className="text-xs md:text-sm">Add users to the project to manage their form permissions</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

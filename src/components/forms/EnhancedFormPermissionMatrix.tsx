
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  Crown,
  UserCheck,
  Settings,
  Eye,
  Plus,
  Edit,
  Database,
  Trash2,
  Lock,
  Info,
  UserPlus
} from 'lucide-react';
import { Form } from '@/types/form';
import { useEnhancedFormAccess, EnhancedFormUser } from '@/hooks/useEnhancedFormAccess';
import { UserInviteToForm } from '@/components/UserInviteToForm';

interface EnhancedFormPermissionMatrixProps {
  form: Form;
}

const PERMISSION_CONFIG = [
  { 
    id: 'view_form', 
    label: 'View Form', 
    icon: Eye, 
    description: 'Can view form structure and access form page',
    editable: 'viewer_only' // Only editable for direct viewer access
  },
  { 
    id: 'create_form', 
    label: 'Create Form', 
    icon: Plus, 
    description: 'Can create new forms',
    editable: 'none' // Role/admin controlled only
  },
  { 
    id: 'update_form', 
    label: 'Update Form', 
    icon: Edit, 
    description: 'Can edit form structure and settings',
    editable: 'none' // Role/admin controlled only
  },
  { 
    id: 'read_form', 
    label: 'Read Form', 
    icon: Database, 
    description: 'Can view form submissions and data',
    editable: 'none' // Role/admin controlled only
  },
  { 
    id: 'delete_form', 
    label: 'Delete Form', 
    icon: Trash2, 
    description: 'Can delete forms',
    editable: 'none' // Role/admin controlled only
  }
];

export function EnhancedFormPermissionMatrix({ form }: EnhancedFormPermissionMatrixProps) {
  const { users, loading, updating, addViewer, removeViewer, reloadUsers } = useEnhancedFormAccess(form.id);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const getAccessSourceBadges = (user: EnhancedFormUser) => {
    const badges = [];
    
    if (user.access_sources.is_creator) {
      badges.push(
        <Badge key="creator" variant="default" className="bg-purple-100 text-purple-800">
          <Crown className="h-3 w-3 mr-1" />
          Creator
        </Badge>
      );
    }
    
    if (user.access_sources.project_role === 'admin') {
      badges.push(
        <Badge key="admin" variant="default" className="bg-red-100 text-red-800">
          <Shield className="h-3 w-3 mr-1" />
          Project Admin
        </Badge>
      );
    }
    
    if (user.access_sources.assigned_roles.length > 0) {
      user.access_sources.assigned_roles.forEach((role, index) => {
        badges.push(
          <Badge key={`role-${index}`} variant="outline" className="bg-blue-100 text-blue-800">
            <Settings className="h-3 w-3 mr-1" />
            {role}
          </Badge>
        );
      });
    }
    
    if (user.access_sources.direct_access) {
      badges.push(
        <Badge key="direct" variant="secondary" className="bg-green-100 text-green-800">
          <UserCheck className="h-3 w-3 mr-1" />
          Assigned {user.access_sources.direct_access}
        </Badge>
      );
    }
    
    if (badges.length === 0 && user.access_sources.project_role) {
      badges.push(
        <Badge key="member" variant="outline" className="bg-gray-100 text-gray-800">
          <Users className="h-3 w-3 mr-1" />
          Project {user.access_sources.project_role}
        </Badge>
      );
    }
    
    return badges;
  };

  const isPermissionEditable = (user: EnhancedFormUser, permissionId: string) => {
    const permission = PERMISSION_CONFIG.find(p => p.id === permissionId);
    if (!permission || permission.editable === 'none') return false;
    
    // Only viewer permission is editable and only for direct access users
    if (permissionId === 'view_form' && permission.editable === 'viewer_only') {
      return user.access_sources.direct_access === 'viewer';
    }
    
    return false;
  };

  const getPermissionStatus = (user: EnhancedFormUser, permissionId: string) => {
    const hasPermission = user.permissions[permissionId as keyof typeof user.permissions];
    const isEditable = isPermissionEditable(user, permissionId);
    
    let reason = '';
    if (user.access_sources.is_creator) reason = 'Creator';
    else if (user.access_sources.project_role === 'admin') reason = 'Admin';
    else if (user.access_sources.assigned_roles.length > 0) reason = 'Role-based';
    else if (user.access_sources.direct_access) reason = 'Direct access';
    else if (user.access_sources.has_top_level_perms) reason = 'Top-level permission';
    else if (form.isPublic && permissionId === 'view_form') reason = 'Public form';
    
    return { hasPermission, isEditable, reason };
  };

  const handleToggleViewerAccess = async (user: EnhancedFormUser) => {
    if (user.access_sources.direct_access === 'viewer') {
      await removeViewer(user.user_id);
    } else if (!user.permissions.view_form || isPermissionEditable(user, 'view_form')) {
      await addViewer(user.user_id);
    }
  };

  const handleUserSelection = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleBulkAddViewers = async () => {
    for (const userId of selectedUsers) {
      const user = users.find(u => u.user_id === userId);
      if (user && !user.access_sources.direct_access) {
        await addViewer(userId);
      }
    }
    setSelectedUsers([]);
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
            Enhanced Permission Matrix
          </h3>
          <p className="text-muted-foreground text-sm">
            Comprehensive access control for "{form.name}"
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {selectedUsers.length > 0 && (
            <Button onClick={handleBulkAddViewers} size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Add {selectedUsers.length} Viewer{selectedUsers.length !== 1 ? 's' : ''}
            </Button>
          )}
          <UserInviteToForm formId={form.id} onUserAdded={reloadUsers} />
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2 text-sm">
            <p><strong>Access Control Hierarchy:</strong></p>
            <ul className="space-y-1 ml-4">
              <li>• <strong>Creator & Admins:</strong> Full permissions (automatic)</li>
              <li>• <strong>Role-Based:</strong> Permissions from assigned roles (managed in Roles & Access)</li>
              <li>• <strong>Direct Assignment:</strong> Viewer access only (editable here)</li>
              <li>• <strong>Project Members:</strong> Basic access based on form visibility</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Access Matrix
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
                  <TableHead className="min-w-[250px]">User & Access Sources</TableHead>
                  {PERMISSION_CONFIG.map(permission => (
                    <TableHead 
                      key={permission.id}
                      className="text-center min-w-[120px]"
                      title={permission.description}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <permission.icon className="h-4 w-4" />
                        <span className="text-xs">{permission.label}</span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
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
                      <div className="space-y-2">
                        <div>
                          <div className="font-medium">{user.email}</div>
                          {(user.first_name || user.last_name) && (
                            <div className="text-sm text-muted-foreground">
                              {[user.first_name, user.last_name].filter(Boolean).join(' ')}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {getAccessSourceBadges(user)}
                        </div>
                      </div>
                    </TableCell>
                    {PERMISSION_CONFIG.map(permission => {
                      const status = getPermissionStatus(user, permission.id);
                      const isUpdatingThis = updating === user.user_id;
                      
                      return (
                        <TableCell key={permission.id} className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center justify-center">
                              {status.isEditable ? (
                                <Checkbox
                                  checked={status.hasPermission}
                                  onCheckedChange={() => handleToggleViewerAccess(user)}
                                  disabled={isUpdatingThis}
                                />
                              ) : (
                                <div className="flex items-center gap-1">
                                  {status.hasPermission ? (
                                    <div className="text-green-600">✓</div>
                                  ) : (
                                    <div className="text-gray-400">✗</div>
                                  )}
                                  {!status.isEditable && status.hasPermission && (
                                    <Lock className="h-3 w-3 text-gray-400" />
                                  )}
                                </div>
                              )}
                            </div>
                            {status.reason && (
                              <div className="text-xs text-muted-foreground">
                                {status.reason}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
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
    </div>
  );
}

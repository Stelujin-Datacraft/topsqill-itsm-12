
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useEnhancedProjectUsers } from '@/hooks/useEnhancedProjectUsers';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { TopLevelPermissions } from './TopLevelPermissions';
import { 
  User, 
  UserPlus, 
  Mail, 
  Shield, 
  Settings, 
  Clock, 
  AlertCircle,
  CheckCircle,
  XCircle 
} from 'lucide-react';
import { toast } from 'sonner';

interface EnhancedProjectUsersDialogProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function EnhancedProjectUsersDialog({ projectId, isOpen, onClose }: EnhancedProjectUsersDialogProps) {
  const { users, loading, error, addUser, removeUser, updateUserRole, refetch } = useEnhancedProjectUsers(projectId);
  const { users: orgUsers } = useOrganizationUsers();
  const { userProfile } = useAuth();
  const { projects } = useProject();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');
  const [selectedUserForSettings, setSelectedUserForSettings] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('users');

  const currentProject = projects.find(p => p.id === projectId);
  const isCurrentUserAdmin = userProfile?.role === 'admin' || 
    (currentProject && currentProject.created_by === userProfile?.id);

  const availableUsers = orgUsers.filter(user => 
    !users.find(projectUser => projectUser.user_id === user.id)
  );

  // Auto-switch to settings tab when a user is selected
  useEffect(() => {
    if (selectedUserForSettings) {
      setActiveTab('settings');
    }
  }, [selectedUserForSettings]);

  const handleAddUser = async () => {
    if (!selectedUserId || !selectedRole) {
      toast.error('Please select a user and role');
      return;
    }

    try {
      await addUser(selectedUserId, selectedRole);
      setSelectedUserId('');
      setSelectedRole('member');
      toast.success('User added to project successfully');
    } catch (error) {
      console.error('Error adding user:', error);
      toast.error('Failed to add user to project');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    try {
      await removeUser(userId);
      // Clear selected user if they were removed
      if (selectedUserForSettings === userId) {
        setSelectedUserForSettings(null);
        setActiveTab('users');
      }
      toast.success('User removed from project');
    } catch (error) {
      console.error('Error removing user:', error);
      toast.error('Failed to remove user from project');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await updateUserRole(userId, newRole);
      toast.success('User role updated successfully');
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'editor': return 'bg-blue-100 text-blue-800';
      case 'viewer': return 'bg-green-100 text-green-800';
      case 'member': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEffectiveRole = (user: any) => {
    if (user.effective_permissions?.is_project_admin) return 'Project Admin';
    if (user.effective_permissions?.is_org_admin) return 'Organization Admin';
    return user.role || 'Member';
  };

  const handleBackToUsers = () => {
    setSelectedUserForSettings(null);
    setActiveTab('users');
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">Loading project users...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <div className="text-center text-red-600">Error loading users: {error}</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Project Access</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">Project Users</TabsTrigger>
            <TabsTrigger value="settings" disabled={!selectedUserForSettings}>
              {selectedUserForSettings ? 'User Settings' : 'Select a User'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            {/* Add User Section */}
            {isCurrentUserAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Add User to Project
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="user-select">Select User</Label>
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a user" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.first_name && user.last_name 
                                ? `${user.first_name} ${user.last_name} (${user.email})`
                                : user.email
                              }
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="role-select">Role</Label>
                      <Select value={selectedRole} onValueChange={setSelectedRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-end">
                      <Button 
                        onClick={handleAddUser} 
                        disabled={!selectedUserId}
                        className="w-full"
                      >
                        Add User
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Users List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Project Members ({users.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map((user) => (
                    <div key={user.user_id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {user.first_name && user.last_name 
                              ? `${user.first_name} ${user.last_name}`
                              : user.email
                            }
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            Joined {new Date(user.assigned_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {getEffectiveRole(user)}
                        </Badge>
                        
                        {isCurrentUserAdmin && user.user_id !== userProfile?.id && (
                          <>
                            <Select
                              value={user.role}
                              onValueChange={(newRole) => handleUpdateRole(user.user_id, newRole)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="member">Member</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedUserForSettings(user.user_id)}
                              className="flex items-center gap-1"
                            >
                              <Settings className="h-4 w-4" />
                              Settings
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveUser(user.user_id)}
                            >
                              Remove
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {users.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No users found in this project
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            {selectedUserForSettings && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">User Settings</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure top-level permissions for {
                        users.find(u => u.user_id === selectedUserForSettings)?.email
                      }
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleBackToUsers}
                  >
                    Back to Users
                  </Button>
                </div>

                <TopLevelPermissions
                  projectId={projectId}
                  userId={selectedUserForSettings}
                  isCurrentUserAdmin={isCurrentUserAdmin}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

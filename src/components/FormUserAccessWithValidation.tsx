
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Form } from '@/types/form';
import { 
  Users, 
  Plus, 
  Trash2, 
  AlertTriangle,
  Shield,
  Settings
} from 'lucide-react';
import { useFormAccess } from '@/hooks/useFormAccess';
import { useProjectMembership } from '@/hooks/useProjectMembership';
import { useFormAssignmentCreator } from '@/hooks/useFormAssignmentCreator';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { UserSuggestionInput } from '@/components/UserSuggestionInput';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormAccessMatrix } from '@/components/FormAccessMatrix';

interface FormUserAccessWithValidationProps {
  form: Form;
  onUpdateForm: (updates: Partial<Form>) => void;
}

export function FormUserAccessWithValidation({ form, onUpdateForm }: FormUserAccessWithValidationProps) {
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'viewer' | 'editor' | 'admin'>('viewer');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('users');

  const { users: orgUsers } = useOrganizationUsers();
  const { projectMembers, canAssignAsEditor, canAssignAsAdmin } = useProjectMembership(form.projectId);
  const { createFormAssignment } = useFormAssignmentCreator();
  const {
    users: formUsers,
    loading,
    addUserAccess,
    updateUserAccess,
    removeUserAccess
  } = useFormAccess(form.id);

  const handleUserSelect = (user: any) => {
    setSelectedUserId(user.id);
  };

  const validateAssignment = (email: string, role: 'viewer' | 'editor' | 'admin'): string | null => {
    const user = orgUsers.find(u => u.email === email);
    
    if (!user) {
      if (role !== 'viewer') {
        return 'User must be in your organization to be assigned as editor or admin';
      }
      return null; // External users can be viewers
    }

    if (role === 'editor' && !canAssignAsEditor(user.id)) {
      return 'User must be a project member to be assigned as editor';
    }

    if (role === 'admin' && !canAssignAsAdmin(user.id)) {
      return 'User must be a project member to be assigned as admin';
    }

    return null;
  };

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) return;

    const validationError = validateAssignment(newUserEmail, newUserRole);
    if (validationError) {
      return; // Error will be shown in UI
    }

    let userIdToAdd = selectedUserId;
    
    // If no user was selected from suggestions, try to find by email
    if (!userIdToAdd) {
      const user = orgUsers.find(u => u.email === newUserEmail);
      userIdToAdd = user?.id || '';
    }

    if (newUserRole === 'viewer' && !userIdToAdd) {
      // For external viewers, create a form assignment instead of user access
      await createFormAssignment(
        form.id,
        null, // no user ID for external users
        newUserEmail,
        'manual',
        form.projectId,
        undefined,
        'External viewer assignment'
      );
    } else {
      // For organization users, create user access
      await addUserAccess(userIdToAdd, newUserRole);
    }

    setNewUserEmail('');
    setSelectedUserId('');
    setNewUserRole('viewer');
    setIsAddUserOpen(false);
  };

  const handleUpdateUserRole = async (userId: string, newRole: 'viewer' | 'editor' | 'admin') => {
    const user = formUsers.find(u => u.user_id === userId);
    if (!user) return;

    const userEmail = user.user_profile?.email || '';
    const validationError = validateAssignment(userEmail, newRole);
    
    if (validationError) {
      return; // Show error in UI
    }

    await updateUserAccess(user.id, { role: newRole });
  };

  const handleRemoveUser = async (userId: string) => {
    const userAccess = formUsers.find(u => u.user_id === userId);
    if (userAccess) {
      await removeUserAccess(userAccess.id);
    }
  };

  const currentValidationError = validateAssignment(newUserEmail, newUserRole);

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">User Access Management</h2>
          <p className="text-muted-foreground">
            Manage who can access "{form.name}"
          </p>
        </div>
        
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add User Access</DialogTitle>
              <DialogDescription>
                Grant access to this form by adding a user's email address.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="user-email">Email Address</Label>
                <UserSuggestionInput
                  value={newUserEmail}
                  onChange={setNewUserEmail}
                  onUserSelect={handleUserSelect}
                  placeholder="Search users or enter external email..."
                />
              </div>
              <div>
                <Label htmlFor="user-role">Role</Label>
                <Select value={newUserRole} onValueChange={(value: 'viewer' | 'editor' | 'admin') => setNewUserRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer - Can view and submit</SelectItem>
                    <SelectItem value="editor">Editor - Can edit fields and settings</SelectItem>
                    <SelectItem value="admin">Admin - Full access</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {currentValidationError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{currentValidationError}</AlertDescription>
                </Alert>
              )}

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Access Rules:</strong>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• <strong>Viewers:</strong> Can be external users (no project membership required)</li>
                    <li>• <strong>Editors/Admins:</strong> Must be project members</li>
                    <li>• External viewers will receive the form in their "Assigned Forms" section</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddUser} disabled={!!currentValidationError}>
                Add User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Basic Access
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Permission Matrix
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Form Users ({formUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Project Member</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formUsers.map((userAccess) => {
                    const isProjectMember = projectMembers.some(
                      member => member.user_id === userAccess.user_id
                    );
                    
                    return (
                      <TableRow key={userAccess.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{userAccess.user_profile?.email}</div>
                            {(userAccess.user_profile?.first_name || userAccess.user_profile?.last_name) && (
                              <div className="text-sm text-muted-foreground">
                                {[userAccess.user_profile?.first_name, userAccess.user_profile?.last_name].filter(Boolean).join(' ')}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={userAccess.role} 
                            onValueChange={(value: 'viewer' | 'editor' | 'admin') => handleUpdateUserRole(userAccess.user_id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="viewer">Viewer</SelectItem>
                              <SelectItem 
                                value="editor" 
                                disabled={!isProjectMember}
                              >
                                Editor
                              </SelectItem>
                              <SelectItem 
                                value="admin" 
                                disabled={!isProjectMember}
                              >
                                Admin
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {isProjectMember ? (
                            <span className="text-green-600">Yes</span>
                          ) : (
                            <span className="text-orange-600">No</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            userAccess.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {userAccess.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveUser(userAccess.user_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {formUsers.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No users found</p>
                  <p className="text-sm">Add users to grant them access to this form</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          <FormAccessMatrix form={form} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

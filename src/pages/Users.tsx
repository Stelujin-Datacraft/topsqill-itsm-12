import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Trash2, UserPlus, Users as UsersIcon, UserCheck, UserX, Clock } from 'lucide-react';
import UserInviteDialog from '@/components/users/UserInviteDialog';
import UserRequestsDialog from '@/components/users/UserRequestsDialog';
import UserCreateDialog from '@/components/users/UserCreateDialog';
import { UserImportButton } from '@/components/users/UserImportButton';
import { UserUpdateButton } from '@/components/users/UserUpdateButton';
import { useUserManagement } from '@/hooks/useUserManagement';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/hooks/use-toast';

const Users = () => {
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();
  const {
    users,
    requests,
    loading,
    handleInviteUser,
    handleApproveRequest,
    handleRejectRequest,
    handleRoleChange,
    handleCreateUser,
    handleDeleteUser,
    handleBulkImportUsers,
    handleBulkUpdateUsers
  } = useUserManagement();

  const [searchTerm, setSearchTerm] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);

  const filteredUsers = users.filter(user =>
    (user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
    (user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.status === 'active').length;
  const pendingUsers = users.filter(u => u.status === 'pending').length;
  const adminUsers = users.filter(u => u.role === 'admin').length;

  const handleApproveSelected = async () => {
    const selectedRequestsList = requests.filter(req => selectedRequests.has(req.id));
    for (const request of selectedRequestsList) {
      await handleApproveRequest(request);
    }
    setSelectedRequests(new Set());
  };

  const handleApproveAll = async () => {
    for (const request of requests) {
      await handleApproveRequest(request);
    }
    setSelectedRequests(new Set());
  };

  const toggleRequestSelection = (requestId: string) => {
    setSelectedRequests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };

  const handleImportUsers = async (importedUsers: Array<{ 
    email: string; 
    firstName: string; 
    lastName: string; 
    role: string;
    password?: string;
    nationality?: string;
    mobile?: string;
    gender?: string;
    timezone?: string;
  }>) => {
    const results = await handleBulkImportUsers(importedUsers);
    toast({
      title: results.failed === 0 ? 'Success' : 'Partial Success',
      description: `${results.successful} user(s) imported successfully${results.failed > 0 ? `, ${results.failed} failed` : ''}`,
      variant: results.failed === 0 ? 'default' : 'destructive'
    });
    if (results.errors.length > 0) {
      console.error('Import errors:', results.errors);
    }
  };

  const handleUpdateUsers = async (updates: Array<{
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    nationality?: string;
    mobile?: string;
    gender?: string;
    timezone?: string;
  }>) => {
    const results = await handleBulkUpdateUsers(updates);
    toast({
      title: results.failed === 0 ? 'Success' : 'Partial Success',
      description: `${results.successful} user(s) updated successfully${results.failed > 0 ? `, ${results.failed} failed` : ''}`,
      variant: results.failed === 0 ? 'default' : 'destructive'
    });
    if (results.errors.length > 0) {
      console.error('Update errors:', results.errors);
    }
  };

  const getInitials = (firstName?: string, lastName?: string, email?: string) => {
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
    if (firstName) return firstName[0].toUpperCase();
    if (email) return email[0].toUpperCase();
    return 'U';
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      inactive: 'bg-muted text-muted-foreground border-border',
    };
    return styles[status] || styles.inactive;
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      admin: 'bg-primary/10 text-primary border-primary/20',
      moderator: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      user: 'bg-muted text-muted-foreground border-border',
    };
    return styles[role] || styles.user;
  };

  const confirmDelete = (userId: string, userName: string) => {
    setUserToDelete({ id: userId, name: userName });
    setDeleteDialogOpen(true);
  };

  const executeDelete = () => {
    if (userToDelete) {
      handleDeleteUser(userToDelete.id, userToDelete.name);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Team Members">
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Team Members">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/40 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <UsersIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{totalUsers}</p>
                  <p className="text-sm text-muted-foreground">Total Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-emerald-500/10">
                  <UserCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{activeUsers}</p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{pendingUsers}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <UserX className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{adminUsers}</p>
                  <p className="text-sm text-muted-foreground">Admins</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="border-b border-border/40 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-semibold">Members</CardTitle>
                <CardDescription className="mt-1">Manage your organization's team members</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <UserImportButton onImportComplete={handleImportUsers} />
                <UserUpdateButton onUpdateComplete={handleUpdateUsers} />
                <Button size="sm" variant="outline" onClick={() => setIsRequestsOpen(true)} className="relative border-border/60 hover:bg-muted/50">
                  <Clock className="h-4 w-4 mr-2" />
                  Pending Requests
                  {requests.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1.5 flex items-center justify-center text-xs bg-primary/10 text-primary border-0">
                      {requests.length}
                    </Badge>
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsInviteOpen(true)} className="border-border/60 hover:bg-muted/50">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite User
                </Button>
                <Button size="sm" onClick={() => setIsCreateOpen(true)} className="shadow-sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create User
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Search */}
            <div className="p-4 border-b border-border/40 bg-muted/30">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-background border-border/60 focus-visible:ring-primary/20"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/40 bg-muted/20">
                    <TableHead className="font-semibold text-foreground/80">Member</TableHead>
                    <TableHead className="font-semibold text-foreground/80">Role</TableHead>
                    <TableHead className="font-semibold text-foreground/80">Status</TableHead>
                    <TableHead className="font-semibold text-foreground/80">Joined</TableHead>
                    <TableHead className="w-[80px] font-semibold text-foreground/80">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <UsersIcon className="h-10 w-10 text-muted-foreground/50" />
                          <p>{searchTerm ? 'No members match your search.' : 'No members found.'}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} className="border-border/40 hover:bg-muted/30 transition-colors">
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-border/40 shadow-sm">
                              <AvatarFallback className="bg-gradient-to-br from-primary/10 to-primary/5 text-sm font-semibold text-primary">
                                {getInitials(user.first_name, user.last_name, user.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">
                                {user.first_name && user.last_name 
                                  ? `${user.first_name} ${user.last_name}` 
                                  : user.email.split('@')[0]
                                }
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={user.role} 
                            onValueChange={(value) => handleRoleChange(user.id, value)}
                          >
                            <SelectTrigger className="w-[120px] h-8 text-xs border-border/50 bg-background hover:bg-muted/50 transition-colors">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="moderator">Moderator</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`text-xs font-medium capitalize px-2.5 py-0.5 ${getStatusBadge(user.status)}`}
                          >
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            onClick={() => confirmDelete(
                              user.id, 
                              user.first_name && user.last_name 
                                ? `${user.first_name} ${user.last_name}` 
                                : user.email
                            )}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <UserRequestsDialog
        isOpen={isRequestsOpen}
        onOpenChange={setIsRequestsOpen}
        requests={requests}
        selectedRequests={selectedRequests}
        onToggleSelection={toggleRequestSelection}
        onApproveRequest={handleApproveRequest}
        onRejectRequest={handleRejectRequest}
        onApproveSelected={handleApproveSelected}
        onApproveAll={handleApproveAll}
      />
      
      <UserCreateDialog
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreate={handleCreateUser}
      />
      
      <UserInviteDialog
        isOpen={isInviteOpen}
        onOpenChange={setIsInviteOpen}
        onInvite={handleInviteUser}
        organizationName={currentOrganization?.name}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {userToDelete?.name} from the organization? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={executeDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Users;

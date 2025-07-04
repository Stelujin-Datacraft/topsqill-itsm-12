
import React, { useState, useMemo } from 'react';
import { EnhancedProjectUser } from '@/hooks/useEnhancedProjectUsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Search, 
  Settings, 
  Shield, 
  Crown, 
  Calendar,
  Activity,
  UserMinus,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';

interface ProjectUsersTableProps {
  users: EnhancedProjectUser[];
  loading: boolean;
  onManagePermissions: (user: EnhancedProjectUser) => void;
  onRemoveUser: (userId: string) => void;
}

export function ProjectUsersTable({ 
  users, 
  loading, 
  onManagePermissions, 
  onRemoveUser 
}: ProjectUsersTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [permissionFilter, setPermissionFilter] = useState<string>('all');

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      
      const matchesPermission = 
        permissionFilter === 'all' ||
        (permissionFilter === 'admin' && (user.effective_permissions.is_project_admin || user.effective_permissions.is_org_admin)) ||
        (permissionFilter === 'manager' && user.effective_permissions.can_manage_users) ||
        (permissionFilter === 'regular' && !user.effective_permissions.is_project_admin && !user.effective_permissions.is_org_admin);

      return matchesSearch && matchesRole && matchesPermission;
    });
  }, [users, searchTerm, roleFilter, permissionFilter]);

  const getRoleBadge = (user: EnhancedProjectUser) => {
    if (user.effective_permissions.is_org_admin) {
      return <Badge className="bg-purple-100 text-purple-800"><Crown className="h-3 w-3 mr-1" />Org Admin</Badge>;
    }
    if (user.effective_permissions.is_project_admin) {
      return <Badge className="bg-blue-100 text-blue-800"><Shield className="h-3 w-3 mr-1" />Project Admin</Badge>;
    }
    if (user.role === 'editor') {
      return <Badge variant="secondary">Project Editor</Badge>;
    }
    return <Badge variant="outline">Project Viewer</Badge>;
  };

  const getPermissionSummary = (user: EnhancedProjectUser) => {
    const permissions = [];
    if (user.effective_permissions.can_manage_users) permissions.push('Users');
    if (user.effective_permissions.can_manage_settings) permissions.push('Settings');
    
    const projectPermCount = Object.keys(user.project_permissions).length;
    const assetPermCount = user.asset_permissions.length;
    
    if (projectPermCount > 0) permissions.push(`${projectPermCount} Project`);
    if (assetPermCount > 0) permissions.push(`${assetPermCount} Asset`);
    
    return permissions.length > 0 ? permissions.join(', ') : 'Basic access';
  };

  const getInitials = (user: EnhancedProjectUser) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user.email[0].toUpperCase();
  };

  const getDisplayName = (user: EnhancedProjectUser) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.email;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground">Loading team members...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Members ({users.length})</CardTitle>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search team members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="member">Member</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={permissionFilter} onValueChange={setPermissionFilter}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Permissions</SelectItem>
              <SelectItem value="admin">Administrators</SelectItem>
              <SelectItem value="manager">Managers</SelectItem>
              <SelectItem value="regular">Regular Users</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        {filteredUsers.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground">
              {searchTerm || roleFilter !== 'all' || permissionFilter !== 'all' 
                ? 'No team members match your filters' 
                : 'No team members found'
              }
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{getInitials(user)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{getDisplayName(user)}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {getRoleBadge(user)}
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm">{getPermissionSummary(user)}</div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(user.assigned_at), 'MMM d, yyyy')}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Activity className="h-3 w-3" />
                      {format(new Date(user.last_activity), 'MMM d, yyyy')}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onManagePermissions(user)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      
                      {!user.effective_permissions.is_org_admin && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRemoveUser(user.user_id)}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

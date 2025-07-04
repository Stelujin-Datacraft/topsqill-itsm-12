
import React, { useState } from 'react';
import { useUnifiedAccessControl } from '@/hooks/useUnifiedAccessControl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Shield, Eye, Edit, Plus, Trash2, Users, AlertCircle } from 'lucide-react';
import { SimpleLoadingSpinner } from '@/components/SimpleLoadingSpinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';

interface EnhancedReportAccessManagerProps {
  reportId: string;
  reportName: string;
}

export function EnhancedReportAccessManager({ reportId, reportName }: EnhancedReportAccessManagerProps) {
  const { currentProject } = useProject();
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const loadUsers = async () => {
      if (!currentProject?.id) return;

      try {
        setLoading(true);
        const { data: projectUsers } = await supabase
          .from('project_users')
          .select(`
            user_id,
            role,
            user_profiles!inner(
              email,
              first_name,
              last_name
            )
          `)
          .eq('project_id', currentProject.id);

        setUsers(projectUsers || []);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [currentProject?.id]);

  const toggleUserExpansion = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const getPermissionIcon = (permissionId: string) => {
    switch (permissionId) {
      case 'view': return <Eye className="h-4 w-4" />;
      case 'create': return <Plus className="h-4 w-4" />;
      case 'edit': return <Edit className="h-4 w-4" />;
      case 'delete': return <Trash2 className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
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

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <SimpleLoadingSpinner size={24} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Report Access Management
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage access to "{reportName}" - permissions are determined by user roles
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Permissions shown here reflect the user's assigned role and cannot be manually edited. 
              View access is granted by default to all project members.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Project Members ({users.length} users)
            </h4>
            
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center bg-gray-50 rounded-lg">
                No users found in this project.
              </p>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <ReportUserAccessRow 
                    key={user.user_id} 
                    user={user} 
                    reportId={reportId}
                    expanded={expandedUsers.has(user.user_id)}
                    onToggleExpansion={() => toggleUserExpansion(user.user_id)}
                    getPermissionIcon={getPermissionIcon}
                    getRoleBadgeColor={getRoleBadgeColor}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportUserAccessRow({ 
  user, 
  reportId, 
  expanded, 
  onToggleExpansion, 
  getPermissionIcon, 
  getRoleBadgeColor 
}: any) {
  const { getUserPermissions, topLevelPermissions } = useUnifiedAccessControl(undefined, user.user_id);
  const userProfile = Array.isArray(user.user_profiles) ? user.user_profiles[0] : user.user_profiles;
  const permissions = getUserPermissions('reports', reportId);
  const topLevel = topLevelPermissions.reports;

  return (
    <div className="border rounded-lg">
      {/* User Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={onToggleExpansion}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="font-medium">
              {userProfile?.first_name && userProfile?.last_name 
                ? `${userProfile.first_name} ${userProfile.last_name}`
                : userProfile?.email
              }
            </div>
            <div className="text-sm text-muted-foreground">
              {userProfile?.email}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge className={getRoleBadgeColor(user.role)}>
            {user.role}
          </Badge>
          <Button variant="ghost" size="sm">
            {expanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      </div>

      {/* Permission Details */}
      {expanded && (
        <div className="border-t bg-gray-50 p-4">
          <div className="space-y-3">
            <div className="text-sm font-medium">Report Permissions</div>
            
            {/* Top-level permission info */}
            <div className="text-xs text-muted-foreground bg-white p-2 rounded">
              <strong>Top-level Report Access:</strong> 
              {` Create: ${topLevel.can_create ? '✓' : '✗'}`}
              {`, Read: ${topLevel.can_read ? '✓' : '✗'}`}
              {`, Update: ${topLevel.can_update ? '✓' : '✗'}`}
              {`, Delete: ${topLevel.can_delete ? '✓' : '✗'}`}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'view', label: 'View Report', checked: permissions.view },
                { id: 'edit', label: 'Edit Report', checked: permissions.edit },
                { id: 'create', label: 'Create Report', checked: permissions.create },
                { id: 'delete', label: 'Delete Report', checked: permissions.delete }
              ].map((perm) => (
                <div key={perm.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${user.user_id}-${perm.id}`}
                    checked={perm.checked}
                    disabled={true} // Always disabled - reflects role permissions only
                  />
                  <div className="flex items-center gap-2 flex-1">
                    {getPermissionIcon(perm.id)}
                    <label
                      htmlFor={`${user.user_id}-${perm.id}`}
                      className="text-sm text-muted-foreground cursor-not-allowed"
                    >
                      {perm.label}
                      {user.role === 'admin' && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Admin
                        </Badge>
                      )}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

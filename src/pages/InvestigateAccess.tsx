import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Shield, Search, User, Users, Key, Lock, Monitor, FolderKanban, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useUsersAndGroups } from '@/hooks/useUsersAndGroups';
import { useInvestigateAccess } from '@/hooks/useInvestigateAccess';
import { UserSelector } from '@/components/investigate/UserSelector';
import { UserOverviewCard } from '@/components/investigate/UserOverviewCard';
import { PermissionsTab } from '@/components/investigate/PermissionsTab';
import { RolesTab } from '@/components/investigate/RolesTab';
import { GroupsTab } from '@/components/investigate/GroupsTab';
import { SecurityTab } from '@/components/investigate/SecurityTab';
import { SessionsTab } from '@/components/investigate/SessionsTab';
import { ProjectsTab } from '@/components/investigate/ProjectsTab';
import { ExportAccessReport } from '@/components/investigate/ExportAccessReport';
import { ExportAllUsersReport } from '@/components/investigate/ExportAllUsersReport';

export default function InvestigateAccess() {
  const { userProfile } = useAuth();
  const { isImpersonating, impersonatedUser, startImpersonation } = useImpersonation();
  const isAdmin = userProfile?.role === 'admin';
  
  // For non-admins, auto-select their own user ID
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    isAdmin ? null : userProfile?.id || null
  );
  
  const { users, loading: usersLoading } = useUsersAndGroups();
  const { data, loading, error, reload } = useInvestigateAccess(selectedUserId);

  // Set own user ID for non-admins when profile loads
  React.useEffect(() => {
    if (!isAdmin && userProfile?.id && !selectedUserId) {
      setSelectedUserId(userProfile.id);
    }
  }, [isAdmin, userProfile?.id, selectedUserId]);

  if (!userProfile) {
    return (
      <DashboardLayout title="Loading...">
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Investigate Access">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {isAdmin ? 'Investigate Access' : 'My Access'}
              </h1>
              <p className="text-muted-foreground">
                {isAdmin 
                  ? 'View comprehensive access rights for any user in the system'
                  : 'View your access permissions, roles, and security settings'
                }
              </p>
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Export All Users - Only for admins */}
            {isAdmin && (
              <ExportAllUsersReport />
            )}
            {/* Impersonate Button - Only for admins viewing non-admin users */}
            {isAdmin && data.profile && data.profile.role !== 'admin' && data.profile.id !== userProfile?.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => startImpersonation(data.profile!.id)}
                disabled={isImpersonating}
                className="text-amber-600 border-amber-300 hover:bg-amber-50"
              >
                <Eye className="h-4 w-4 mr-2" />
                Impersonate
              </Button>
            )}
            {/* Export Single User Button */}
            {data.profile && (
              <ExportAccessReport 
                data={data} 
                userName={`${data.profile.first_name || ''} ${data.profile.last_name || ''}`.trim() || data.profile.email}
              />
            )}
          </div>
        </div>

        {/* User Selector - Only for admins */}
        {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select User</CardTitle>
            <CardDescription>
              Choose a user to investigate their access permissions, roles, and security settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserSelector
              users={users}
              selectedUserId={selectedUserId}
              onSelectUser={setSelectedUserId}
              loading={usersLoading}
            />
          </CardContent>
        </Card>
        )}

        {/* User Overview Card */}
        {data.profile && (
          <UserOverviewCard profile={data.profile} loading={loading} />
        )}

        {/* Access Details Tabs */}
        {selectedUserId && (
          <Tabs defaultValue="permissions" className="space-y-4">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="permissions" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                <span className="hidden sm:inline">Permissions</span>
              </TabsTrigger>
              <TabsTrigger value="roles" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Roles</span>
              </TabsTrigger>
              <TabsTrigger value="groups" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Groups</span>
              </TabsTrigger>
              <TabsTrigger value="projects" className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4" />
                <span className="hidden sm:inline">Projects</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <span className="hidden sm:inline">Security</span>
              </TabsTrigger>
              <TabsTrigger value="sessions" className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                <span className="hidden sm:inline">Sessions</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="permissions">
              <PermissionsTab
                topLevelPermissions={data.topLevelPermissions}
                resourcePermissions={data.resourcePermissions}
                loading={loading}
              />
            </TabsContent>

            <TabsContent value="roles">
              <RolesTab roleAssignments={data.roleAssignments} loading={loading} />
            </TabsContent>

            <TabsContent value="groups">
              <GroupsTab groupMemberships={data.groupMemberships} loading={loading} />
            </TabsContent>

            <TabsContent value="projects">
              <ProjectsTab projectAccess={data.projectAccess} loading={loading} />
            </TabsContent>

            <TabsContent value="security">
              <SecurityTab securitySettings={data.securitySettings} loading={loading} />
            </TabsContent>

            <TabsContent value="sessions">
              <SessionsTab sessions={data.activeSessions} loading={loading} onReload={reload} />
            </TabsContent>
          </Tabs>
        )}

        {/* Empty State - Only for admins when no user selected */}
        {isAdmin && !selectedUserId && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No User Selected</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Select a user from the dropdown above to view their complete access rights,
                role assignments, group memberships, and security settings.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="py-6">
              <p className="text-destructive text-center">{error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

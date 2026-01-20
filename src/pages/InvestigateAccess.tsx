import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Search, User, Users, Key, Lock, Monitor, FolderKanban } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

export default function InvestigateAccess() {
  const { userProfile } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { users, loading: usersLoading } = useUsersAndGroups();
  const { data, loading, error, reload } = useInvestigateAccess(selectedUserId);

  // Only admins can access this page
  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <DashboardLayout title="Access Denied">
        <div className="text-center py-12">
          <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to access this page. Only administrators can investigate user access.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Investigate Access">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Search className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Investigate Access</h1>
            <p className="text-muted-foreground">
              View comprehensive access rights for any user in the system
            </p>
          </div>
        </div>

        {/* User Selector */}
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

        {/* Empty State */}
        {!selectedUserId && (
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

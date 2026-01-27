
import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserRolesTab } from '@/components/roles/UserRolesTab';
import { GroupRolesTab } from '@/components/roles/GroupRolesTab';
import { CreateRolesTab } from '@/components/roles/CreateRolesTab';
import { Shield } from 'lucide-react';
import { useEffectiveUser } from '@/hooks/useEffectiveUser';

const RolesAndAccess = () => {
  const { effectiveRole } = useEffectiveUser();
  const [activeTab, setActiveTab] = useState('create-roles');

  // Only admins can access this page (respects impersonation)
  if (effectiveRole !== 'admin') {
    return (
      <DashboardLayout title="Access Denied">
        <div className="text-center py-12">
          <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You need administrator privileges to access this page.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Roles and Access">
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Manage user roles and access permissions across your organization
        </p>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="user-roles">User Roles</TabsTrigger>
            <TabsTrigger value="group-roles">Group Roles</TabsTrigger>
            <TabsTrigger value="create-roles">Create Roles</TabsTrigger>
          </TabsList>

          <TabsContent value="user-roles" className="space-y-6">
            <UserRolesTab />
          </TabsContent>

          <TabsContent value="group-roles" className="space-y-6">
            <GroupRolesTab />
          </TabsContent>

          <TabsContent value="create-roles" className="space-y-6">
            <CreateRolesTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default RolesAndAccess;

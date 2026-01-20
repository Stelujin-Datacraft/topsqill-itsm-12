import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, X, FileText, GitBranch, BarChart3 } from 'lucide-react';

interface TopLevelPermission {
  entity_type: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  project_name?: string;
  project_id: string;
}

interface ResourcePermission {
  resource_type: string;
  resource_id: string;
  resource_name: string;
  permission_type: string;
  role_name: string;
}

interface PermissionsTabProps {
  topLevelPermissions: TopLevelPermission[];
  resourcePermissions: ResourcePermission[];
  loading?: boolean;
}

export function PermissionsTab({ topLevelPermissions, resourcePermissions, loading }: PermissionsTabProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'forms':
        return <FileText className="h-4 w-4" />;
      case 'workflows':
        return <GitBranch className="h-4 w-4" />;
      case 'reports':
        return <BarChart3 className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const PermissionBadge = ({ allowed }: { allowed: boolean }) => (
    allowed ? (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
        <Check className="h-3 w-3 mr-1" /> Yes
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
        <X className="h-3 w-3 mr-1" /> No
      </Badge>
    )
  );

  // Group permissions by project
  const permissionsByProject = topLevelPermissions.reduce((acc, perm) => {
    const projectKey = perm.project_id;
    if (!acc[projectKey]) {
      acc[projectKey] = {
        projectName: perm.project_name || 'Unknown Project',
        permissions: []
      };
    }
    acc[projectKey].permissions.push(perm);
    return acc;
  }, {} as Record<string, { projectName: string; permissions: TopLevelPermission[] }>);

  // Group resource permissions by type
  const resourcesByType = resourcePermissions.reduce((acc, perm) => {
    if (!acc[perm.resource_type]) {
      acc[perm.resource_type] = [];
    }
    acc[perm.resource_type].push(perm);
    return acc;
  }, {} as Record<string, ResourcePermission[]>);

  return (
    <div className="space-y-6">
      {/* Top-Level Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top-Level Permissions</CardTitle>
          <CardDescription>
            Entity-level permissions across all projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(permissionsByProject).length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No top-level permissions assigned
            </p>
          ) : (
            <div className="space-y-6">
              {Object.entries(permissionsByProject).map(([projectId, { projectName, permissions }]) => (
                <div key={projectId}>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Badge variant="outline">{projectName}</Badge>
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entity Type</TableHead>
                        <TableHead className="text-center">Create</TableHead>
                        <TableHead className="text-center">Read</TableHead>
                        <TableHead className="text-center">Update</TableHead>
                        <TableHead className="text-center">Delete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permissions.map((perm, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getEntityIcon(perm.entity_type)}
                              <span className="capitalize">{perm.entity_type}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <PermissionBadge allowed={perm.can_create} />
                          </TableCell>
                          <TableCell className="text-center">
                            <PermissionBadge allowed={perm.can_read} />
                          </TableCell>
                          <TableCell className="text-center">
                            <PermissionBadge allowed={perm.can_update} />
                          </TableCell>
                          <TableCell className="text-center">
                            <PermissionBadge allowed={perm.can_delete} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resource-Specific Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resource-Specific Permissions</CardTitle>
          <CardDescription>
            Permissions granted through role assignments for specific resources
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(resourcesByType).length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No resource-specific permissions assigned
            </p>
          ) : (
            <div className="space-y-6">
              {Object.entries(resourcesByType).map(([type, perms]) => (
                <div key={type}>
                  <h4 className="font-medium mb-3 flex items-center gap-2 capitalize">
                    {getEntityIcon(type + 's')}
                    {type}s
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Resource Name</TableHead>
                        <TableHead>Permission</TableHead>
                        <TableHead>Via Role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {perms.map((perm, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{perm.resource_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {perm.permission_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {perm.role_name}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

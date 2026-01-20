import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield } from 'lucide-react';
import { format } from 'date-fns';

interface RoleAssignment {
  id: string;
  role_id: string;
  assigned_at: string;
  role: {
    id: string;
    name: string;
    description: string | null;
    top_level_access: string;
  };
}

interface RolesTabProps {
  roleAssignments: RoleAssignment[];
  loading?: boolean;
}

export function RolesTab({ roleAssignments, loading }: RolesTabProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const getAccessLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'full':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'restricted':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'none':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Assigned Roles</CardTitle>
        <CardDescription>
          Roles determine what permissions the user has for specific resources
        </CardDescription>
      </CardHeader>
      <CardContent>
        {roleAssignments.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No roles assigned to this user</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {roleAssignments.map((assignment) => (
              <Card key={assignment.id} className="border-l-4 border-l-primary">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      <h4 className="font-semibold">{assignment.role.name}</h4>
                    </div>
                    <Badge className={getAccessLevelColor(assignment.role.top_level_access)}>
                      {assignment.role.top_level_access}
                    </Badge>
                  </div>
                  {assignment.role.description && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {assignment.role.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Assigned on {format(new Date(assignment.assigned_at), 'MMM d, yyyy')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

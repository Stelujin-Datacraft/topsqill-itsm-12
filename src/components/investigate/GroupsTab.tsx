import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';
import { format } from 'date-fns';

interface GroupMembership {
  id: string;
  group_id: string;
  added_at: string;
  group: {
    id: string;
    name: string;
    role_id: string | null;
  };
}

interface GroupsTabProps {
  groupMemberships: GroupMembership[];
  loading?: boolean;
}

export function GroupsTab({ groupMemberships, loading }: GroupsTabProps) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Group Memberships</CardTitle>
        <CardDescription>
          Groups the user belongs to, which may grant additional permissions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {groupMemberships.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">User is not a member of any groups</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupMemberships.map((membership) => (
              <Card key={membership.id} className="border-l-4 border-l-blue-500">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    <h4 className="font-semibold">{membership.group.name}</h4>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    {membership.group.role_id ? (
                      <Badge variant="secondary">Has Associated Role</Badge>
                    ) : (
                      <Badge variant="outline">No Role</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Added on {format(new Date(membership.added_at), 'MMM d, yyyy')}
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

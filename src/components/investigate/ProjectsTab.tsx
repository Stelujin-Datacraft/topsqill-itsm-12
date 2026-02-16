import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Folder } from 'lucide-react';
import { format } from 'date-fns';

interface ProjectAccess {
  project_id: string;
  project_name: string;
  role: string;
  assigned_at: string;
}

interface ProjectsTabProps {
  projectAccess: ProjectAccess[];
  loading?: boolean;
}

export function ProjectsTab({ projectAccess, loading }: ProjectsTabProps) {
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

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400';
      case 'editor':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'viewer':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Project Access</CardTitle>
        <CardDescription>
          Projects this user has access to and their role in each
        </CardDescription>
      </CardHeader>
      <CardContent>
        {projectAccess.length === 0 ? (
          <div className="text-center py-8">
            <FolderKanban className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">User has no project access</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projectAccess.map((project) => (
              <Card key={project.project_id} className="border-l-4 border-l-primary">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FolderKanban className="h-5 w-5 text-primary" />
                      <h4 className="font-semibold">{project.project_name}</h4>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge className={getRoleColor(project.role)}>
                      {project.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Since {format(new Date(project.assigned_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

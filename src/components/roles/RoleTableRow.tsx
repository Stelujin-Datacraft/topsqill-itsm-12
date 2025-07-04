
import React from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { Role } from '@/hooks/useRoles';
import { useProject } from '@/contexts/ProjectContext';
import { useFormsData } from '@/hooks/useFormsData';
import { useWorkflowData } from '@/hooks/useWorkflowData';
import { useReports } from '@/hooks/useReports';

interface RoleTableRowProps {
  role: Role;
  onUpdate: () => void;
  onEdit: (role: Role) => void;
  onDelete: (roleId: string) => void;
}

export function RoleTableRow({ role, onUpdate, onEdit, onDelete }: RoleTableRowProps) {
  const { projects } = useProject();
  const { forms } = useFormsData();
  const { workflows } = useWorkflowData();
  const { reports } = useReports();

  const getPermissionSummary = (resourceType: 'project' | 'form' | 'workflow' | 'report') => {
    const permissions = role.permissions.filter(p => p.resource_type === resourceType);
    
    if (permissions.length === 0) {
      return <span className="text-muted-foreground text-sm">No access</span>;
    }

    // Group by resource with actual names
    const resourceGroups: { [key: string]: string[] } = {};
    
    permissions.forEach(permission => {
      let resourceName = 'Unknown';
      
      if (resourceType === 'project') {
        const project = projects.find(p => p.id === permission.resource_id);
        resourceName = project ? project.name : 'Unknown Project';
      } else if (resourceType === 'form') {
        const form = forms.find(f => f.id === permission.resource_id);
        resourceName = form ? form.name : 'Unknown Form';
      } else if (resourceType === 'workflow') {
        const workflow = workflows.find(w => w && typeof w === 'object' && 'id' in w && w.id === permission.resource_id);
        resourceName = workflow && typeof workflow === 'object' && 'name' in workflow ? workflow.name : 'Unknown Workflow';
      } else if (resourceType === 'report') {
        const report = reports.find(r => r.id === permission.resource_id);
        resourceName = report ? report.name : 'Unknown Report';
      }

      if (!resourceGroups[resourceName]) {
        resourceGroups[resourceName] = [];
      }
      resourceGroups[resourceName].push(permission.permission_type);
    });

    return (
      <div className="flex flex-wrap gap-1 max-w-xs">
        {Object.entries(resourceGroups).map(([resourceName, perms]) => (
          <div key={resourceName} className="text-xs">
            <span className="font-medium">{resourceName}:</span>{' '}
            <span className="text-muted-foreground">{perms.join('-')}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <TableRow>
      <TableCell className="max-w-xs">
        <div className="space-y-1">
          <div className="font-medium text-sm truncate">{role.name}</div>
        </div>
      </TableCell>
      <TableCell className="max-w-xs">
        <p className="text-sm text-muted-foreground truncate" title={role.description || 'No description'}>
          {role.description || 'No description'}
        </p>
      </TableCell>
      <TableCell className="max-w-xs">{getPermissionSummary('project')}</TableCell>
      <TableCell className="max-w-xs">{getPermissionSummary('form')}</TableCell>
      <TableCell className="max-w-xs">{getPermissionSummary('workflow')}</TableCell>
      <TableCell className="max-w-xs">{getPermissionSummary('report')}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            title="Edit role"
            onClick={() => onEdit(role)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            title="Delete role"
            onClick={() => onDelete(role.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

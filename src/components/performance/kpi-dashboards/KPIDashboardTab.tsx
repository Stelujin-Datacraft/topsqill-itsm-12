import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, UserCog } from 'lucide-react';
import { usePerformanceKPI, PerformanceRoleType } from '@/hooks/usePerformanceKPI';
import { SeniorManagementDashboard } from './SeniorManagementDashboard';
import { ProjectManagerDashboard } from './ProjectManagerDashboard';
import { DisciplineEngineerDashboard } from './DisciplineEngineerDashboard';
import { FinanceDashboard } from './FinanceDashboard';
import { RiskGovernanceDashboard } from './RiskGovernanceDashboard';
import { RoleAssignmentDialog } from './RoleAssignmentDialog';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  perfProjectId: string;
}

const ROLE_LABELS: Record<PerformanceRoleType, string> = {
  senior_management: 'Senior Management',
  project_manager: 'Project Manager',
  discipline_engineer: 'Discipline Engineer',
  finance_contract: 'Finance / Contract',
  risk_governance: 'Risk / Governance',
};

const ROLE_DESCRIPTIONS: Record<PerformanceRoleType, string> = {
  senior_management: 'Portfolio-level view with cross-project analytics',
  project_manager: 'Project schedule, milestones, cost, and task control',
  discipline_engineer: 'Task execution, productivity, and resource utilization',
  finance_contract: 'Budget control, variance analysis, and cost forecasting',
  risk_governance: 'Risk exposure, compliance status, and audit findings',
};

export function KPIDashboardTab({ perfProjectId }: Props) {
  const { userProfile } = useAuth();
  const { userRole, loading, seniorKPIs, pmKPIs, engineerKPIs, financeKPIs, riskKPIs, alerts, submissions } = usePerformanceKPI(perfProjectId);
  const [selectedRole, setSelectedRole] = useState<PerformanceRoleType | null>(null);
  const [showRoleAssignment, setShowRoleAssignment] = useState(false);

  const activeRole = selectedRole || userRole || 'senior_management';
  const isAdmin = userProfile?.role === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No submission data found. Please ensure a data source is configured and has submissions.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with role selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Select value={activeRole} onValueChange={(v) => setSelectedRole(v as PerformanceRoleType)}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_LABELS) as PerformanceRoleType[]).map((role) => (
                <SelectItem key={role} value={role}>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{ROLE_LABELS[role]}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-xs">
            {ROLE_DESCRIPTIONS[activeRole]}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {userRole && (
            <Badge variant="secondary" className="text-xs">
              Assigned: {ROLE_LABELS[userRole]}
            </Badge>
          )}
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowRoleAssignment(true)}>
              <UserCog className="h-4 w-4 mr-1" />
              Manage Roles
            </Button>
          )}
        </div>
      </div>

      {/* Dashboard Content */}
      {activeRole === 'senior_management' && seniorKPIs && (
        <SeniorManagementDashboard kpis={seniorKPIs} alerts={alerts} />
      )}
      {activeRole === 'project_manager' && pmKPIs && (
        <ProjectManagerDashboard kpis={pmKPIs} />
      )}
      {activeRole === 'discipline_engineer' && engineerKPIs && (
        <DisciplineEngineerDashboard kpis={engineerKPIs} />
      )}
      {activeRole === 'finance_contract' && financeKPIs && (
        <FinanceDashboard kpis={financeKPIs} />
      )}
      {activeRole === 'risk_governance' && riskKPIs && (
        <RiskGovernanceDashboard kpis={riskKPIs} />
      )}

      {/* Role Assignment Dialog */}
      {isAdmin && (
        <RoleAssignmentDialog
          open={showRoleAssignment}
          onOpenChange={setShowRoleAssignment}
          perfProjectId={perfProjectId}
        />
      )}
    </div>
  );
}

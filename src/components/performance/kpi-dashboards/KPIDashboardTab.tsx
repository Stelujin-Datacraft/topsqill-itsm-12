import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserCog, Database, FileText, BarChart3 } from 'lucide-react';
import { useHierarchyKPI } from '@/hooks/useHierarchyKPI';
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

type RoleType = 'senior_management' | 'project_manager' | 'discipline_engineer' | 'finance_contract' | 'risk_governance';

const ROLE_LABELS: Record<RoleType, string> = {
  senior_management: 'Senior Management',
  project_manager: 'Project Manager',
  discipline_engineer: 'Discipline Engineer',
  finance_contract: 'Finance / Contract',
  risk_governance: 'Risk / Governance',
};

const ROLE_DESCRIPTIONS: Record<RoleType, string> = {
  senior_management: 'Portfolio-level view with cross-project analytics',
  project_manager: 'Project schedule, milestones, cost, and task control',
  discipline_engineer: 'Task execution, productivity, and resource utilization',
  finance_contract: 'Budget control, variance analysis, and cost forecasting',
  risk_governance: 'Risk exposure, compliance status, and audit findings',
};

export function KPIDashboardTab({ perfProjectId }: Props) {
  const { userProfile } = useAuth();
  const [selectedRole, setSelectedRole] = useState<RoleType>('senior_management');
  const [showRoleAssignment, setShowRoleAssignment] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');

  const { projects, hierarchy, loading, hierarchyLoading, kpis, recordOptions } = useHierarchyKPI(
    selectedRecordId || undefined
  );

  const isAdmin = userProfile?.role === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center space-y-3">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">No Project Records Found</p>
            <p className="text-sm text-muted-foreground mt-1">
              No submissions found in the Projects form. Add project records to see KPI calculations.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                KPI Dashboards — Hierarchy Drill-Down
              </CardTitle>
              <CardDescription>
                Role-based metrics from linked forms: Projects → WBS → Activities → Tasks → Resources
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setShowRoleAssignment(true)}>
                  <UserCog className="h-4 w-4 mr-1" />
                  Manage Roles
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Role Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Dashboard View</label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as RoleType)}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as RoleType[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Record Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Select Project</label>
              <Select value={selectedRecordId} onValueChange={setSelectedRecordId}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="All Projects (Portfolio)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Projects (Portfolio)</SelectItem>
                  {recordOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Info badges */}
            <div className="flex items-center gap-2 mt-auto">
              <Badge variant="outline" className="text-xs">
                {selectedRecordId && selectedRecordId !== '__all__'
                  ? '1 project selected'
                  : `${projects.length} projects`}
              </Badge>
              {hierarchyLoading && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading linked records...
                </Badge>
              )}
              {hierarchy && !hierarchyLoading && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {hierarchy.wbs.length} WBS · {hierarchy.activities.length} Activities · {hierarchy.tasks.length} Tasks · {hierarchy.resources.length} Resources
                </Badge>
              )}
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[selectedRole]}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Content */}
      {kpis && (
        <>
          {selectedRole === 'senior_management' && kpis.seniorKPIs && (
            <SeniorManagementDashboard kpis={kpis.seniorKPIs} />
          )}
          {selectedRole === 'project_manager' && kpis.pmKPIs && (
            <ProjectManagerDashboard kpis={kpis.pmKPIs} hasHierarchy={!!hierarchy} />
          )}
          {selectedRole === 'discipline_engineer' && kpis.engineerKPIs && (
            <DisciplineEngineerDashboard kpis={kpis.engineerKPIs} hasHierarchy={!!hierarchy} />
          )}
          {selectedRole === 'finance_contract' && kpis.financeKPIs && (
            <FinanceDashboard kpis={kpis.financeKPIs} />
          )}
          {selectedRole === 'risk_governance' && kpis.riskKPIs && (
            <RiskGovernanceDashboard kpis={kpis.riskKPIs} />
          )}
        </>
      )}

      {/* Prompt to select project for drill-down roles */}
      {!selectedRecordId && (selectedRole === 'project_manager' || selectedRole === 'discipline_engineer') && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-3">
            <Database className="h-10 w-10 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Select a Project for Drill-Down</p>
              <p className="text-sm text-muted-foreground mt-1">
                This dashboard requires linked Task and Resource data. Select a specific project above to load the full hierarchy.
              </p>
            </div>
          </CardContent>
        </Card>
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

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserCog, Database, FileText, BarChart3 } from 'lucide-react';
import { usePerformanceKPI, PerformanceRoleType, calculateSeniorManagementKPIs, aggregateProjectManagerKPIs, calculateProjectManagerKPIs, calculateDisciplineEngineerKPIs, calculateFinanceKPIs, calculateRiskGovernanceKPIs, generateKPIAlerts } from '@/hooks/usePerformanceKPI';
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

interface SubmissionOption {
  id: string;
  label: string;
}

export function KPIDashboardTab({ perfProjectId }: Props) {
  const { userProfile } = useAuth();
  const { userRole, loading, submissions, mappings, seniorKPIs, pmKPIs, engineerKPIs, financeKPIs, riskKPIs, alerts } = usePerformanceKPI(perfProjectId);
  const [selectedRole, setSelectedRole] = useState<PerformanceRoleType | null>(null);
  const [showRoleAssignment, setShowRoleAssignment] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string>('all');

  const activeRole = selectedRole || userRole || 'senior_management';
  const isAdmin = userProfile?.role === 'admin';

  // Build submission options for the record selector
  const recordOptions: SubmissionOption[] = useMemo(() => {
    return submissions.map((sub: any) => {
      const data = sub.submission_data || {};
      // Try to find a project name from field mappings
      const nameMapping = mappings.find(m =>
        m.formFieldLabel.toLowerCase().includes('project_name') ||
        m.formFieldLabel.toLowerCase().includes('project name')
      );
      let label = nameMapping ? String(data[nameMapping.formFieldId] || '') : '';
      if (!label) {
        // Fallback: find a string value that looks like a name
        label = Object.values(data).find((v: any) => typeof v === 'string' && v.length > 3 && v.length < 100) as string || '';
      }
      // Unwrap wrapped values
      if (typeof label === 'object' && label !== null && 'value' in (label as any)) {
        label = (label as any).value;
      }
      const refId = sub.submission_ref_id || sub.id?.slice(0, 8) || '';
      return {
        id: sub.id,
        label: label ? `${refId} — ${label}` : refId,
      };
    });
  }, [submissions, mappings]);

  // Compute KPIs based on selected record
  const computedKPIs = useMemo(() => {
    if (submissions.length === 0) return null;

    if (selectedRecordId === 'all') {
      return {
        seniorKPIs: calculateSeniorManagementKPIs(submissions, mappings),
        pmKPIs: aggregateProjectManagerKPIs(submissions, mappings),
        engineerKPIs: calculateDisciplineEngineerKPIs(submissions, mappings, userProfile?.id),
        financeKPIs: calculateFinanceKPIs(submissions, mappings),
        riskKPIs: calculateRiskGovernanceKPIs(submissions, mappings),
        alerts: generateKPIAlerts(submissions, mappings),
      };
    }

    // Single record selected
    const selectedSub = submissions.find((s: any) => s.id === selectedRecordId);
    if (!selectedSub) return null;
    const singleArr = [selectedSub];

    return {
      seniorKPIs: calculateSeniorManagementKPIs(singleArr, mappings),
      pmKPIs: calculateProjectManagerKPIs(selectedSub.submission_data || {}, mappings),
      engineerKPIs: calculateDisciplineEngineerKPIs(singleArr, mappings, userProfile?.id),
      financeKPIs: calculateFinanceKPIs(singleArr, mappings),
      riskKPIs: calculateRiskGovernanceKPIs(singleArr, mappings),
      alerts: generateKPIAlerts(singleArr, mappings),
    };
  }, [submissions, mappings, selectedRecordId, userProfile?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No data source configured
  if (mappings.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center space-y-3">
          <Database className="h-10 w-10 mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">No Data Source Configured</p>
            <p className="text-sm text-muted-foreground mt-1">
              Go to the <strong>Data Sources</strong> tab to configure a form data source with field mappings first.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Data source exists but no submissions
  if (submissions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center space-y-3">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">No Submission Data Found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Data source is configured but no form submissions found. Ensure the linked form has submission data for KPI calculations.
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
                KPI Dashboards
              </CardTitle>
              <CardDescription>
                Role-based performance metrics calculated from form submission data
              </CardDescription>
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
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Role Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Dashboard View</label>
              <Select value={activeRole} onValueChange={(v) => setSelectedRole(v as PerformanceRoleType)}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as PerformanceRoleType[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Record Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Analyze Record</label>
              <Select value={selectedRecordId} onValueChange={setSelectedRecordId}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select a record..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="font-medium">All Records (Aggregated)</span>
                  </SelectItem>
                  {recordOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Info badge */}
            <div className="flex items-center gap-2 mt-auto">
              <Badge variant="outline" className="text-xs">
                {selectedRecordId === 'all'
                  ? `${submissions.length} records`
                  : 'Single record'}
              </Badge>
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[activeRole]}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Content */}
      {computedKPIs && (
        <>
          {activeRole === 'senior_management' && computedKPIs.seniorKPIs && (
            <SeniorManagementDashboard kpis={computedKPIs.seniorKPIs} alerts={computedKPIs.alerts} />
          )}
          {activeRole === 'project_manager' && computedKPIs.pmKPIs && (
            <ProjectManagerDashboard kpis={computedKPIs.pmKPIs} />
          )}
          {activeRole === 'discipline_engineer' && computedKPIs.engineerKPIs && (
            <DisciplineEngineerDashboard kpis={computedKPIs.engineerKPIs} />
          )}
          {activeRole === 'finance_contract' && computedKPIs.financeKPIs && (
            <FinanceDashboard kpis={computedKPIs.financeKPIs} />
          )}
          {activeRole === 'risk_governance' && computedKPIs.riskKPIs && (
            <RiskGovernanceDashboard kpis={computedKPIs.riskKPIs} />
          )}
        </>
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

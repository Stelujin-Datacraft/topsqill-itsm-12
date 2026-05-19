import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';

export type ActivityType =
  | 'form_created'
  | 'form_submission'
  | 'workflow_execution'
  | 'workflow_created'
  | 'report_created'
  | 'user_joined';

export type ExecutionStatus = 'completed' | 'running' | 'failed' | 'waiting' | string;

interface RecentActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
  owner_id?: string;
  owner_name?: string;
  resource_id?: string;
  resource_type?: 'form' | 'workflow' | 'report' | 'submission';
  status?: ExecutionStatus;
  duration_ms?: number;
  ref_id?: string;
}

const formatUserName = (profile: any): string => {
  if (!profile) return 'Unknown User';
  const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
  return name || profile.email || 'Unknown User';
};

export type ActivityRange = '24h' | '7d' | '30d' | 'all';

const rangeToSince = (range: ActivityRange): string | null => {
  if (range === 'all') return null;
  const hours = range === '24h' ? 24 : range === '7d' ? 24 * 7 : 24 * 30;
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
};

export function useRecentActivity(initialRange: ActivityRange = '7d') {
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<ActivityRange>(initialRange);
  const { currentProject } = useProject();

  const loadRecentActivities = async () => {
    if (!currentProject?.id) {
      setActivities([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const collected: RecentActivity[] = [];
      const userIds = new Set<string>();

      const since = rangeToSince(range);

      const formsQ = supabase
          .from('forms')
          .select('id, name, created_at, created_by')
          .eq('project_id', currentProject.id)
          .order('created_at', { ascending: false })
          .limit(50);
      const submissionsQ = supabase
          .from('form_submissions')
          .select('id, submitted_at, submitted_by, approval_status, submission_ref_id, form_id, forms!inner(id, name, project_id)')
          .eq('forms.project_id', currentProject.id)
          .order('submitted_at', { ascending: false })
          .limit(50);
      const wfExecQ = supabase
          .from('workflow_executions')
          .select('id, status, started_at, completed_at, error_message, submitter_id, workflow_id, workflows!inner(id, name, project_id)')
          .eq('workflows.project_id', currentProject.id)
          .order('started_at', { ascending: false })
          .limit(50);
      const workflowsQ = supabase
          .from('workflows')
          .select('id, name, created_at, created_by')
          .eq('project_id', currentProject.id)
          .order('created_at', { ascending: false })
          .limit(50);
      const reportsQ = supabase
          .from('reports')
          .select('id, name, created_at, created_by')
          .eq('project_id', currentProject.id)
          .order('created_at', { ascending: false })
          .limit(50);

      if (since) {
        formsQ.gte('created_at', since);
        submissionsQ.gte('submitted_at', since);
        wfExecQ.gte('started_at', since);
        workflowsQ.gte('created_at', since);
        reportsQ.gte('created_at', since);
      }

      const [formsRes, submissionsRes, wfExecRes, workflowsRes, reportsRes] = await Promise.all([
        formsQ, submissionsQ, wfExecQ, workflowsQ, reportsQ,
      ]);

      const forms = formsRes.data || [];
      const submissions = submissionsRes.data || [];
      const workflowExecutions = wfExecRes.data || [];
      const workflows = workflowsRes.data || [];
      const reports = reportsRes.data || [];

      [...forms, ...workflows, ...reports].forEach((r: any) => r.created_by && userIds.add(r.created_by));
      submissions.forEach((s: any) => s.submitted_by && userIds.add(s.submitted_by));
      workflowExecutions.forEach((e: any) => e.submitter_id && userIds.add(e.submitter_id));

      // Fetch all profiles in one query
      let profileMap = new Map<string, any>();
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, first_name, last_name, email')
          .in('id', Array.from(userIds));
        profiles?.forEach((p: any) => profileMap.set(p.id, p));
      }

      forms.forEach((form: any) => {
        collected.push({
          id: `form_${form.id}`,
          type: 'form_created',
          title: 'Form Created',
          description: `"${form.name}" was created`,
          metadata: { form_name: form.name },
          created_at: form.created_at,
          owner_id: form.created_by,
          owner_name: formatUserName(profileMap.get(form.created_by)),
          resource_id: form.id,
          resource_type: 'form',
        });
      });

      submissions.forEach((sub: any) => {
        const profile = profileMap.get(sub.submitted_by);
        collected.push({
          id: `submission_${sub.id}`,
          type: 'form_submission',
          title: 'Form Submitted',
          description: `${sub.submission_ref_id ? `[${sub.submission_ref_id}] ` : ''}submitted to "${sub.forms?.name || 'form'}"`,
          metadata: { form_name: sub.forms?.name, ref_id: sub.submission_ref_id, approval_status: sub.approval_status },
          created_at: sub.submitted_at,
          owner_id: sub.submitted_by,
          owner_name: profile ? formatUserName(profile) : 'Anonymous',
          resource_id: sub.id,
          resource_type: 'submission',
          status: sub.approval_status,
          ref_id: sub.submission_ref_id,
        });
      });

      workflowExecutions.forEach((exec: any) => {
        const duration = exec.completed_at
          ? new Date(exec.completed_at).getTime() - new Date(exec.started_at).getTime()
          : undefined;
        const statusLabel =
          exec.status === 'completed' ? 'completed successfully' :
          exec.status === 'failed' ? `failed${exec.error_message ? `: ${exec.error_message.slice(0, 80)}` : ''}` :
          exec.status === 'running' ? 'is running' :
          exec.status === 'waiting' ? 'is waiting' :
          `status: ${exec.status}`;
        collected.push({
          id: `wfexec_${exec.id}`,
          type: 'workflow_execution',
          title: 'Workflow Executed',
          description: `"${exec.workflows?.name || 'workflow'}" ${statusLabel}`,
          metadata: { workflow_name: exec.workflows?.name, error: exec.error_message },
          created_at: exec.started_at,
          owner_id: exec.submitter_id,
          owner_name: exec.submitter_id ? formatUserName(profileMap.get(exec.submitter_id)) : 'System',
          resource_id: exec.workflows?.id,
          resource_type: 'workflow',
          status: exec.status,
          duration_ms: duration,
        });
      });

      workflows.forEach((wf: any) => {
        collected.push({
          id: `workflow_${wf.id}`,
          type: 'workflow_created',
          title: 'Workflow Created',
          description: `"${wf.name}" was created`,
          metadata: { workflow_name: wf.name },
          created_at: wf.created_at,
          owner_id: wf.created_by,
          owner_name: formatUserName(profileMap.get(wf.created_by)),
          resource_id: wf.id,
          resource_type: 'workflow',
        });
      });

      reports.forEach((report: any) => {
        collected.push({
          id: `report_${report.id}`,
          type: 'report_created',
          title: 'Report Created',
          description: `"${report.name}" was created`,
          metadata: { report_name: report.name },
          created_at: report.created_at,
          owner_id: report.created_by,
          owner_name: formatUserName(profileMap.get(report.created_by)),
          resource_id: report.id,
          resource_type: 'report',
        });
      });

      collected.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setActivities(collected.slice(0, 100));
    } catch (error) {
      console.error('Failed to load recent activities:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecentActivities();
  }, [currentProject?.id, range]);

  return {
    activities,
    loading,
    range,
    setRange,
    refresh: loadRecentActivities,
  };
}

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

export function useRecentActivity() {
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
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

      // 1. Recent forms created
      const { data: forms } = await supabase
        .from('forms')
        .select(`
          id, name, created_at, created_by,
          user_profiles!forms_created_by_fkey(first_name, last_name, email)
        `)
        .eq('project_id', currentProject.id)
        .order('created_at', { ascending: false })
        .limit(10);

      forms?.forEach((form: any) => {
        const ownerName = formatUserName(form.user_profiles);
        collected.push({
          id: `form_${form.id}`,
          type: 'form_created',
          title: 'Form Created',
          description: `"${form.name}" was created`,
          metadata: { form_name: form.name, user_email: form.user_profiles?.email },
          created_at: form.created_at,
          owner_id: form.created_by,
          owner_name: ownerName,
          resource_id: form.id,
          resource_type: 'form',
        });
      });

      // 2. Recent form submissions (with submitter profile + ref id + approval status)
      const { data: submissions } = await supabase
        .from('form_submissions')
        .select(`
          id, submitted_at, submitted_by, approval_status, submission_ref_id,
          forms!form_submissions_form_id_fkey!inner(id, name, project_id),
          user_profiles!form_submissions_submitted_by_fkey(first_name, last_name, email)
        `)
        .eq('forms.project_id', currentProject.id)
        .order('submitted_at', { ascending: false })
        .limit(15);

      submissions?.forEach((sub: any) => {
        const ownerName = sub.user_profiles ? formatUserName(sub.user_profiles) : 'Anonymous';
        collected.push({
          id: `submission_${sub.id}`,
          type: 'form_submission',
          title: 'Form Submitted',
          description: `${sub.submission_ref_id ? `[${sub.submission_ref_id}] ` : ''}submitted to "${sub.forms.name}"`,
          metadata: {
            form_name: sub.forms.name,
            ref_id: sub.submission_ref_id,
            approval_status: sub.approval_status,
          },
          created_at: sub.submitted_at,
          owner_id: sub.submitted_by,
          owner_name: ownerName,
          resource_id: sub.id,
          resource_type: 'submission',
          status: sub.approval_status,
          ref_id: sub.submission_ref_id,
        });
      });

      // 3. Recent workflow executions (RUNTIME data)
      const { data: workflowExecutions } = await supabase
        .from('workflow_executions')
        .select(`
          id, status, started_at, completed_at, error_message, current_node_id,
          workflows!workflow_executions_workflow_id_fkey!inner(id, name, project_id),
          user_profiles!workflow_executions_submitter_id_fkey(first_name, last_name, email)
        `)
        .eq('workflows.project_id', currentProject.id)
        .order('started_at', { ascending: false })
        .limit(15);

      workflowExecutions?.forEach((exec: any) => {
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
          description: `"${exec.workflows.name}" ${statusLabel}`,
          metadata: {
            workflow_name: exec.workflows.name,
            error: exec.error_message,
          },
          created_at: exec.started_at,
          owner_id: exec.submitter_id,
          owner_name: exec.user_profiles ? formatUserName(exec.user_profiles) : 'System',
          resource_id: exec.workflows.id,
          resource_type: 'workflow',
          status: exec.status,
          duration_ms: duration,
        });
      });

      // 4. Recent workflows created
      const { data: workflows } = await supabase
        .from('workflows')
        .select(`
          id, name, created_at, created_by,
          user_profiles!workflows_created_by_fkey(first_name, last_name, email)
        `)
        .eq('project_id', currentProject.id)
        .order('created_at', { ascending: false })
        .limit(5);

      workflows?.forEach((wf: any) => {
        collected.push({
          id: `workflow_${wf.id}`,
          type: 'workflow_created',
          title: 'Workflow Created',
          description: `"${wf.name}" was created`,
          metadata: { workflow_name: wf.name },
          created_at: wf.created_at,
          owner_id: wf.created_by,
          owner_name: formatUserName(wf.user_profiles),
          resource_id: wf.id,
          resource_type: 'workflow',
        });
      });

      // 5. Recent reports
      try {
        const { data: reports } = await supabase
          .from('reports')
          .select(`
            id, name, created_at, created_by,
            user_profiles!reports_created_by_fkey(first_name, last_name, email)
          `)
          .eq('project_id', currentProject.id)
          .order('created_at', { ascending: false })
          .limit(5);

        reports?.forEach((report: any) => {
          collected.push({
            id: `report_${report.id}`,
            type: 'report_created',
            title: 'Report Created',
            description: `"${report.name}" was created`,
            metadata: { report_name: report.name },
            created_at: report.created_at,
            owner_id: report.created_by,
            owner_name: formatUserName(report.user_profiles),
            resource_id: report.id,
            resource_type: 'report',
          });
        });
      } catch {
        /* noop */
      }

      collected.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setActivities(collected.slice(0, 50));
    } catch (error) {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecentActivities();
  }, [currentProject?.id]);

  return {
    activities,
    loading,
    refresh: loadRecentActivities,
  };
}

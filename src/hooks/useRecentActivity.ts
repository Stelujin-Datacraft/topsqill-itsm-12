
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';

interface RecentActivity {
  id: string;
  type: 'form_created' | 'form_submission' | 'workflow_execution' | 'report_created' | 'user_joined';
  title: string;
  description: string;
  metadata: {
    user_name?: string;
    user_email?: string;
    form_name?: string;
    workflow_name?: string;
    report_name?: string;
    project_name?: string;
    [key: string]: any;
  };
  created_at: string;
  owner_id?: string;
  owner_name?: string;
  resource_id?: string;
  resource_type?: 'form' | 'workflow' | 'report';
}

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
      const activities: RecentActivity[] = [];

      // Get recent forms
      const { data: forms } = await supabase
        .from('forms')
        .select(`
          id, name, created_at, created_by,
          user_profiles!forms_created_by_fkey(first_name, last_name, email)
        `)
        .eq('project_id', currentProject.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (forms) {
        forms.forEach(form => {
          const userProfile = form.user_profiles as any;
          activities.push({
            id: `form_${form.id}`,
            type: 'form_created',
            title: 'Form Created',
            description: `New form "${form.name}" was created`,
            metadata: {
              form_name: form.name,
              user_name: userProfile ? 
                `${userProfile.first_name} ${userProfile.last_name}` : 
                'Unknown User',
              user_email: userProfile?.email
            },
            created_at: form.created_at,
            owner_id: form.created_by,
            owner_name: userProfile ? 
              `${userProfile.first_name} ${userProfile.last_name}` : 
              'Unknown User',
            resource_id: form.id,
            resource_type: 'form'
          });
        });
      }

      // Get recent form submissions
      const { data: submissions } = await supabase
        .from('form_submissions')
        .select(`
          id, submitted_at, submitted_by,
          forms!form_submissions_form_id_fkey(id, name, project_id)
        `)
        .eq('forms.project_id', currentProject.id)
        .order('submitted_at', { ascending: false })
        .limit(10);

      if (submissions) {
        submissions.forEach(submission => {
          if (submission.forms && submission.forms.project_id === currentProject.id) {
            activities.push({
              id: `submission_${submission.id}`,
              type: 'form_submission',
              title: 'Form Submitted',
              description: `Form "${submission.forms.name}" received a new submission`,
              metadata: {
                form_name: submission.forms.name,
                submitted_by: submission.submitted_by || 'Anonymous'
              },
              created_at: submission.submitted_at,
              owner_name: submission.submitted_by || 'Anonymous',
              resource_id: submission.forms.id,
              resource_type: 'form'
            });
          }
        });
      }

      // Get recent workflows
      const { data: workflows } = await supabase
        .from('workflows')
        .select(`
          id, name, created_at, created_by,
          user_profiles!workflows_created_by_fkey(first_name, last_name, email)
        `)
        .eq('project_id', currentProject.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (workflows) {
        workflows.forEach(workflow => {
          const userProfile = workflow.user_profiles as any;
          activities.push({
            id: `workflow_${workflow.id}`,
            type: 'workflow_execution',
            title: 'Workflow Created',
            description: `New workflow "${workflow.name}" was created`,
            metadata: {
              workflow_name: workflow.name,
              user_name: userProfile ? 
                `${userProfile.first_name} ${userProfile.last_name}` : 
                'Unknown User',
              user_email: userProfile?.email
            },
            created_at: workflow.created_at,
            owner_id: workflow.created_by,
            owner_name: userProfile ? 
              `${userProfile.first_name} ${userProfile.last_name}` : 
              'Unknown User',
            resource_id: workflow.id,
            resource_type: 'workflow'
          });
        });
      }

      // Get recent reports (simplified - just basic info since reports table relationship may not exist)
      try {
        const { data: reports } = await supabase
          .from('reports')
          .select('id, name, created_at, created_by')
          .eq('project_id', currentProject.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (reports) {
          reports.forEach(report => {
            activities.push({
              id: `report_${report.id}`,
              type: 'report_created',
              title: 'Report Created',
              description: `New report "${report.name}" was created`,
              metadata: {
                report_name: report.name,
                user_name: 'Unknown User'
              },
              created_at: report.created_at,
              owner_id: report.created_by,
              owner_name: 'Unknown User',
              resource_id: report.id,
              resource_type: 'report'
            });
          });
        }
      } catch (error) {
        // Reports table may not exist or have proper relationships
      }

      // Sort all activities by date
      activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setActivities(activities.slice(0, 15)); // Show latest 15 activities
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
    refresh: loadRecentActivities
  };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';

export interface PerformanceAuditEntry {
  id: string;
  project_id: string;
  performance_project_id?: string;
  user_id?: string;
  action_type: string;
  action_category: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export function usePerformanceAuditLog(perfProjectId?: string) {
  const { userProfile } = useAuth();
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const projectId = currentProject?.id;

  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['performance-audit-logs', projectId, perfProjectId],
    queryFn: async () => {
      if (!projectId) return [];
      let query = supabase
        .from('performance_audit_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (perfProjectId) {
        query = query.eq('performance_project_id', perfProjectId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PerformanceAuditEntry[];
    },
    enabled: !!projectId,
  });

  const logAction = useMutation({
    mutationFn: async (entry: {
      action_type: string;
      action_category: string;
      title: string;
      description?: string;
      metadata?: Record<string, any>;
      performance_project_id?: string;
    }) => {
      if (!projectId || !userProfile) return;
      const { error } = await supabase
        .from('performance_audit_logs')
        .insert({
          project_id: projectId,
          performance_project_id: entry.performance_project_id || perfProjectId || null,
          organization_id: userProfile.organization_id,
          user_id: userProfile.id,
          action_type: entry.action_type,
          action_category: entry.action_category,
          title: entry.title,
          description: entry.description,
          metadata: entry.metadata || {},
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-audit-logs', projectId, perfProjectId] });
    },
  });

  return { auditLogs, isLoading, logAction };
}

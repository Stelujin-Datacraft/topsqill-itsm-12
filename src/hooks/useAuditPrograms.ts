import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { AuditProgram, AuditFinding, RemediationTask } from '@/types/compliance';

export function useAuditPrograms() {
  const { currentProject } = useProject();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const projectId = currentProject?.id;
  const orgId = currentOrganization?.id;

  const auditsQuery = useQuery({
    queryKey: ['audit_programs', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('audit_programs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AuditProgram[];
    },
    enabled: !!projectId,
  });

  const createAudit = useMutation({
    mutationFn: async (audit: Partial<AuditProgram>) => {
      const { data, error } = await supabase
        .from('audit_programs')
        .insert([{ ...audit, project_id: projectId, organization_id: orgId, created_by: user?.id } as any])
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AuditProgram;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit_programs', projectId] });
      toast.success('Audit program created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateAudit = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AuditProgram> & { id: string }) => {
      const { data, error } = await supabase
        .from('audit_programs')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AuditProgram;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit_programs', projectId] });
      toast.success('Audit updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteAudit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('audit_programs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit_programs', projectId] });
      toast.success('Audit deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return {
    audits: auditsQuery.data || [],
    isLoading: auditsQuery.isLoading,
    createAudit,
    updateAudit,
    deleteAudit,
  };
}

export function useAuditFindings(auditId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const findingsQuery = useQuery({
    queryKey: ['audit_findings', auditId],
    queryFn: async () => {
      if (!auditId) return [];
      const { data, error } = await supabase
        .from('audit_findings')
        .select('*')
        .eq('audit_id', auditId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AuditFinding[];
    },
    enabled: !!auditId,
  });

  const createFinding = useMutation({
    mutationFn: async (finding: Partial<AuditFinding>) => {
      const { data, error } = await supabase
        .from('audit_findings')
        .insert([{ ...finding, audit_id: auditId, created_by: user?.id } as any])
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AuditFinding;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit_findings', auditId] });
      toast.success('Finding created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateFinding = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AuditFinding> & { id: string }) => {
      const { data, error } = await supabase
        .from('audit_findings')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AuditFinding;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit_findings', auditId] });
      toast.success('Finding updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteFinding = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('audit_findings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit_findings', auditId] });
      toast.success('Finding deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return {
    findings: findingsQuery.data || [],
    isLoading: findingsQuery.isLoading,
    createFinding,
    updateFinding,
    deleteFinding,
  };
}

export function useRemediationTasks(findingId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: ['remediation_tasks', findingId],
    queryFn: async () => {
      if (!findingId) return [];
      const { data, error } = await supabase
        .from('remediation_tasks')
        .select('*')
        .eq('finding_id', findingId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as RemediationTask[];
    },
    enabled: !!findingId,
  });

  const createTask = useMutation({
    mutationFn: async (task: Partial<RemediationTask>) => {
      const { data, error } = await supabase
        .from('remediation_tasks')
        .insert([{ ...task, finding_id: findingId, created_by: user?.id } as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remediation_tasks', findingId] });
      toast.success('Task created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RemediationTask> & { id: string }) => {
      const { data, error } = await supabase
        .from('remediation_tasks')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remediation_tasks', findingId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('remediation_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remediation_tasks', findingId] });
      toast.success('Task deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return {
    tasks: tasksQuery.data || [],
    isLoading: tasksQuery.isLoading,
    createTask,
    updateTask,
    deleteTask,
  };
}

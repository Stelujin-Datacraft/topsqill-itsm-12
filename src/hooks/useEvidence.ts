import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { EvidenceItem, ControlTest } from '@/types/compliance';

export function useEvidence(filters?: { control_id?: string; audit_id?: string; finding_id?: string; policy_id?: string }) {
  const { currentProject } = useProject();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const projectId = currentProject?.id;
  const orgId = currentOrganization?.id;

  const evidenceQuery = useQuery({
    queryKey: ['evidence_items', projectId, filters],
    queryFn: async () => {
      if (!projectId) return [];
      let query = supabase
        .from('evidence_items')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      if (filters?.control_id) query = query.eq('control_id', filters.control_id);
      if (filters?.audit_id) query = query.eq('audit_id', filters.audit_id);
      if (filters?.finding_id) query = query.eq('finding_id', filters.finding_id);
      if (filters?.policy_id) query = query.eq('policy_id', filters.policy_id);
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as EvidenceItem[];
    },
    enabled: !!projectId,
  });

  const createEvidence = useMutation({
    mutationFn: async (evidence: Partial<EvidenceItem>) => {
      const { data, error } = await supabase
        .from('evidence_items')
        .insert([{ ...evidence, project_id: projectId, organization_id: orgId, uploaded_by: user?.id } as any])
        .select()
        .single();
      if (error) throw error;
      return data as unknown as EvidenceItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence_items', projectId] });
      toast.success('Evidence added');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteEvidence = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('evidence_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence_items', projectId] });
      toast.success('Evidence removed');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return {
    evidence: evidenceQuery.data || [],
    isLoading: evidenceQuery.isLoading,
    createEvidence,
    deleteEvidence,
  };
}

export function useControlTests(controlId?: string) {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const projectId = currentProject?.id;

  const testsQuery = useQuery({
    queryKey: ['control_tests', controlId],
    queryFn: async () => {
      if (!controlId) return [];
      const { data, error } = await supabase
        .from('control_tests')
        .select('*')
        .eq('control_id', controlId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ControlTest[];
    },
    enabled: !!controlId,
  });

  const createTest = useMutation({
    mutationFn: async (test: Partial<ControlTest>) => {
      const { data, error } = await supabase
        .from('control_tests')
        .insert([{ ...test, control_id: controlId, project_id: projectId, created_by: user?.id } as any])
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ControlTest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['control_tests', controlId] });
      toast.success('Test created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateTest = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ControlTest> & { id: string }) => {
      const { data, error } = await supabase
        .from('control_tests')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ControlTest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['control_tests', controlId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteTest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('control_tests').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['control_tests', controlId] });
      toast.success('Test deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return {
    tests: testsQuery.data || [],
    isLoading: testsQuery.isLoading,
    createTest,
    updateTest,
    deleteTest,
  };
}

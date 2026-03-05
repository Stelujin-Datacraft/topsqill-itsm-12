import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { ComplianceFramework, ComplianceControl, PolicyControlMapping } from '@/types/compliance';

export function useComplianceFrameworks() {
  const { currentProject } = useProject();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const projectId = currentProject?.id;
  const orgId = currentOrganization?.id;

  const frameworksQuery = useQuery({
    queryKey: ['compliance_frameworks', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('compliance_frameworks')
        .select('*')
        .eq('project_id', projectId)
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as ComplianceFramework[];
    },
    enabled: !!projectId,
  });

  const createFramework = useMutation({
    mutationFn: async (fw: Partial<ComplianceFramework>) => {
      const { data, error } = await supabase
        .from('compliance_frameworks')
        .insert([{ ...fw, project_id: projectId, organization_id: orgId, created_by: user?.id } as any])
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ComplianceFramework;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance_frameworks', projectId] });
      toast.success('Framework created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateFramework = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ComplianceFramework> & { id: string }) => {
      const { data, error } = await supabase
        .from('compliance_frameworks')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ComplianceFramework;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance_frameworks', projectId] });
      toast.success('Framework updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteFramework = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('compliance_frameworks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance_frameworks', projectId] });
      toast.success('Framework deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return {
    frameworks: frameworksQuery.data || [],
    isLoading: frameworksQuery.isLoading,
    createFramework,
    updateFramework,
    deleteFramework,
  };
}

export function useComplianceControls(frameworkId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const controlsQuery = useQuery({
    queryKey: ['compliance_controls', frameworkId],
    queryFn: async () => {
      if (!frameworkId) return [];
      const { data, error } = await supabase
        .from('compliance_controls')
        .select('*')
        .eq('framework_id', frameworkId)
        .order('control_id_ref');
      if (error) throw error;
      return (data || []) as unknown as ComplianceControl[];
    },
    enabled: !!frameworkId,
  });

  const createControl = useMutation({
    mutationFn: async (ctrl: Partial<ComplianceControl>) => {
      const { data, error } = await supabase
        .from('compliance_controls')
        .insert([{ ...ctrl, framework_id: frameworkId } as any])
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ComplianceControl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance_controls', frameworkId] });
      toast.success('Control added');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateControl = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ComplianceControl> & { id: string }) => {
      const { data, error } = await supabase
        .from('compliance_controls')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ComplianceControl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance_controls', frameworkId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteControl = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('compliance_controls').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance_controls', frameworkId] });
      toast.success('Control deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return {
    controls: controlsQuery.data || [],
    isLoading: controlsQuery.isLoading,
    createControl,
    updateControl,
    deleteControl,
  };
}

export function usePolicyControlMappings(policyId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mappingsQuery = useQuery({
    queryKey: ['policy_control_mappings', policyId],
    queryFn: async () => {
      if (!policyId) return [];
      const { data, error } = await supabase
        .from('policy_control_mappings')
        .select('*')
        .eq('policy_id', policyId);
      if (error) throw error;
      return (data || []) as unknown as PolicyControlMapping[];
    },
    enabled: !!policyId,
  });

  const createMapping = useMutation({
    mutationFn: async (mapping: Partial<PolicyControlMapping>) => {
      const { data, error } = await supabase
        .from('policy_control_mappings')
        .insert([{ ...mapping, policy_id: policyId, created_by: user?.id } as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy_control_mappings', policyId] });
      toast.success('Control mapping added');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('policy_control_mappings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy_control_mappings', policyId] });
      toast.success('Mapping removed');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return {
    mappings: mappingsQuery.data || [],
    isLoading: mappingsQuery.isLoading,
    createMapping,
    deleteMapping,
  };
}

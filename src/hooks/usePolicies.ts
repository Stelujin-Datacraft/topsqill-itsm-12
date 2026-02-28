import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Policy, PolicyVersion, PolicyLinkage, PolicyApproval, PolicyTemplate } from '@/types/policy';

export function usePolicies() {
  const { currentProject } = useProject();
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const projectId = currentProject?.id;
  const orgId = currentOrganization?.id;

  const policiesQuery = useQuery({
    queryKey: ['policies', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('policies')
        .select('*')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Policy[];
    },
    enabled: !!projectId,
  });

  const templatesQuery = useQuery({
    queryKey: ['policy_templates', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('policy_templates')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as PolicyTemplate[];
    },
    enabled: !!orgId,
  });

  const createPolicy = useMutation({
    mutationFn: async (policy: Partial<Policy>) => {
      const { data, error } = await supabase
        .from('policies')
        .insert([{
          ...policy,
          project_id: projectId,
          organization_id: orgId,
          created_by: user?.id,
          owner_id: policy.owner_id || user?.id,
        } as any])
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Policy;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies', projectId] });
      toast.success('Policy created successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updatePolicy = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Policy> & { id: string }) => {
      const { data, error } = await supabase
        .from('policies')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Policy;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies', projectId] });
      toast.success('Policy updated successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deletePolicy = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('policies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies', projectId] });
      toast.success('Policy deleted successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const createVersion = useMutation({
    mutationFn: async (version: Partial<PolicyVersion>) => {
      const { data, error } = await supabase
        .from('policy_versions')
        .insert([{
          ...version,
          changed_by: user?.id,
        } as any])
        .select()
        .single();
      if (error) throw error;
      return data as unknown as PolicyVersion;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['policy_versions', vars.policy_id] });
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (template: Partial<PolicyTemplate>) => {
      const { data, error } = await supabase
        .from('policy_templates')
        .insert([{
          ...template,
          organization_id: orgId,
          created_by: user?.id,
        } as any])
        .select()
        .single();
      if (error) throw error;
      return data as unknown as PolicyTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy_templates', orgId] });
      toast.success('Template saved successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return {
    policies: policiesQuery.data || [],
    isLoading: policiesQuery.isLoading,
    templates: templatesQuery.data || [],
    templatesLoading: templatesQuery.isLoading,
    createPolicy,
    updatePolicy,
    deletePolicy,
    createVersion,
    createTemplate,
  };
}

export function usePolicyDetail(policyId?: string) {
  const versionsQuery = useQuery({
    queryKey: ['policy_versions', policyId],
    queryFn: async () => {
      if (!policyId) return [];
      const { data, error } = await supabase
        .from('policy_versions')
        .select('*')
        .eq('policy_id', policyId)
        .order('version_number', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PolicyVersion[];
    },
    enabled: !!policyId,
  });

  const linkagesQuery = useQuery({
    queryKey: ['policy_linkages', policyId],
    queryFn: async () => {
      if (!policyId) return [];
      const { data, error } = await supabase
        .from('policy_linkages')
        .select('*')
        .eq('policy_id', policyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PolicyLinkage[];
    },
    enabled: !!policyId,
  });

  const approvalsQuery = useQuery({
    queryKey: ['policy_approvals', policyId],
    queryFn: async () => {
      if (!policyId) return [];
      const { data, error } = await supabase
        .from('policy_approvals')
        .select('*')
        .eq('policy_id', policyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PolicyApproval[];
    },
    enabled: !!policyId,
  });

  return {
    versions: versionsQuery.data || [],
    linkages: linkagesQuery.data || [],
    approvals: approvalsQuery.data || [],
    isLoading: versionsQuery.isLoading || linkagesQuery.isLoading || approvalsQuery.isLoading,
  };
}

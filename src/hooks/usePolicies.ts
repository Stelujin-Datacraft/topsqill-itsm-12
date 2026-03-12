import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Policy, PolicyVersion, PolicyLinkage, PolicyApproval, PolicyTemplate, PolicyAcknowledgment, PolicyException, PolicyReviewCycle } from '@/types/policy';

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

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PolicyTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('policy_templates')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as PolicyTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy_templates', orgId] });
      toast.success('Template updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('policy_templates')
        .delete()
        .eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy_templates', orgId] });
      toast.success('Template deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const createReviewCycle = useMutation({
    mutationFn: async (cycle: Partial<PolicyReviewCycle>) => {
      const { data, error } = await supabase
        .from('policy_review_cycles')
        .insert([cycle as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['policy_review_cycles', vars.policy_id] });
    },
  });

  const clonePolicy = useMutation({
    mutationFn: async (sourcePolicyId: string) => {
      const source = policiesQuery.data?.find(p => p.id === sourcePolicyId);
      if (!source) throw new Error('Policy not found');
      const { data, error } = await supabase
        .from('policies')
        .insert([{
          name: `Copy of ${source.name}`,
          description: source.description,
          category: source.category,
          department: source.department,
          owner_type: source.owner_type,
          owner_id: user?.id,
          priority: source.priority,
          content: source.content,
          tags: source.tags,
          review_cycle_days: source.review_cycle_days,
          acknowledgment_required: source.acknowledgment_required,
          exception_allowed: source.exception_allowed,
          folder_id: source.folder_id,
          item_type: source.item_type,
          project_id: projectId,
          organization_id: orgId,
          created_by: user?.id,
          status: 'draft',
          current_version: 1,
          attachments: source.attachments,
        } as any])
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Policy;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies', projectId] });
      toast.success('Policy cloned as draft');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const bulkUpdateStatus = useMutation({
    mutationFn: async ({ ids, status, extra }: { ids: string[]; status: string; extra?: Record<string, any> }) => {
      for (const id of ids) {
        const { error } = await supabase
          .from('policies')
          .update({ status, ...extra } as any)
          .eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies', projectId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const { error } = await supabase.from('policies').delete().eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies', projectId] });
      toast.success('Policies deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const completeReviewCycle = useMutation({
    mutationFn: async ({ cycleId, findings, outcome }: { cycleId: string; findings: string; outcome: string }) => {
      const { data, error } = await supabase
        .from('policy_review_cycles')
        .update({
          status: 'completed',
          findings,
          outcome,
          completed_at: new Date().toISOString(),
          reviewer_id: user?.id,
        } as any)
        .eq('id', cycleId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate all policy_review_cycles queries to ensure both pre and post tabs refresh
      queryClient.invalidateQueries({ queryKey: ['policy_review_cycles'] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Review cycle completed');
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
    updateTemplate,
    deleteTemplate,
    createReviewCycle,
    clonePolicy,
    bulkUpdateStatus,
    bulkDelete,
    completeReviewCycle,
  };
}

export function usePolicyDetail(policyId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

  const acknowledgementsQuery = useQuery({
    queryKey: ['policy_acknowledgments', policyId],
    queryFn: async () => {
      if (!policyId) return [];
      const { data, error } = await supabase
        .from('policy_acknowledgments')
        .select('*')
        .eq('policy_id', policyId)
        .order('acknowledged_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PolicyAcknowledgment[];
    },
    enabled: !!policyId,
  });

  const exceptionsQuery = useQuery({
    queryKey: ['policy_exceptions', policyId],
    queryFn: async () => {
      if (!policyId) return [];
      const { data, error } = await supabase
        .from('policy_exceptions')
        .select('*')
        .eq('policy_id', policyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PolicyException[];
    },
    enabled: !!policyId,
  });

  const reviewCyclesQuery = useQuery({
    queryKey: ['policy_review_cycles', policyId],
    queryFn: async () => {
      if (!policyId) return [];
      const { data, error } = await supabase
        .from('policy_review_cycles')
        .select('*')
        .eq('policy_id', policyId)
        .order('review_date', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PolicyReviewCycle[];
    },
    enabled: !!policyId,
  });

  const acknowledgePolicy = useMutation({
    mutationFn: async ({ policyId, versionNumber, comments }: { policyId: string; versionNumber: number; comments?: string }) => {
      const { data, error } = await supabase
        .from('policy_acknowledgments')
        .insert([{
          policy_id: policyId,
          user_id: user?.id,
          version_acknowledged: versionNumber,
          comments,
        } as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy_acknowledgments', policyId] });
      toast.success('Policy acknowledged successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const requestException = useMutation({
    mutationFn: async (exception: Partial<PolicyException>) => {
      const { data, error } = await supabase
        .from('policy_exceptions')
        .insert([{
          ...exception,
          requested_by: user?.id,
        } as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy_exceptions', policyId] });
      toast.success('Exception request submitted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const createLinkage = useMutation({
    mutationFn: async (linkage: Partial<PolicyLinkage>) => {
      const { data, error } = await supabase
        .from('policy_linkages')
        .insert([{
          ...linkage,
          created_by: user?.id,
        } as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy_linkages', policyId] });
      toast.success('Linkage created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const submitApproval = useMutation({
    mutationFn: async ({ policyId, versionNumber, approverId, comments }: { policyId: string; versionNumber: number; approverId?: string; comments?: string }) => {
      const { data, error } = await supabase
        .from('policy_approvals')
        .insert([{
          policy_id: policyId,
          version_number: versionNumber,
          approver_id: approverId || user?.id,
          status: 'pending',
          comments,
        } as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy_approvals', policyId] });
    },
  });

  const respondApproval = useMutation({
    mutationFn: async ({ approvalId, status, comments }: { approvalId: string; status: 'approved' | 'rejected'; comments?: string }) => {
      // First verify the current user is the designated approver
      const { data: existing, error: fetchError } = await supabase
        .from('policy_approvals')
        .select('id, approver_id, status')
        .eq('id', approvalId)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (!existing) throw new Error('This approval request could not be found.');
      if (existing.status !== 'pending') throw new Error('This approval has already been processed.');

      const { data, error } = await supabase
        .from('policy_approvals')
        .update({
          status,
          comments,
          approved_at: status === 'approved' ? new Date().toISOString() : null,
        } as any)
        .eq('id', approvalId)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('You are not the designated approver for this request. Only the assigned approver can approve or reject.');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy_approvals', policyId] });
      toast.success('Approval response recorded');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const respondException = useMutation({
    mutationFn: async ({ exceptionId, status, approved_by }: { exceptionId: string; status: 'approved' | 'rejected'; approved_by: string }) => {
      const { data, error } = await supabase
        .from('policy_exceptions')
        .update({
          status,
          approved_by,
          approved_at: new Date().toISOString(),
        } as any)
        .eq('id', exceptionId)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Exception record not found.');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy_exceptions', policyId] });
      toast.success('Exception response recorded');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return {
    versions: versionsQuery.data || [],
    linkages: linkagesQuery.data || [],
    approvals: approvalsQuery.data || [],
    acknowledgments: acknowledgementsQuery.data || [],
    exceptions: exceptionsQuery.data || [],
    reviewCycles: reviewCyclesQuery.data || [],
    isLoading: versionsQuery.isLoading || linkagesQuery.isLoading || approvalsQuery.isLoading,
    acknowledgePolicy,
    requestException,
    createLinkage,
    submitApproval,
    respondApproval,
    respondException,
  };
}

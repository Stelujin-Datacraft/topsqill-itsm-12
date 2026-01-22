/**
 * React Query-based data feeds hook with automatic caching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DataFeed, DataFeedFormData, MatchingRule, FieldMapping, SourceFilter, CrossRefMatchRule } from '@/types/dataFeed';
import { useToast } from '@/hooks/use-toast';
import { queryKeys, cacheManager } from '@/lib/cacheManager';

const parseDataFeed = (feed: any): DataFeed => ({
  ...feed,
  matching_rules: Array.isArray(feed.matching_rules) 
    ? (feed.matching_rules as unknown as MatchingRule[]) 
    : [],
  field_mappings: Array.isArray(feed.field_mappings) 
    ? (feed.field_mappings as unknown as FieldMapping[]) 
    : [],
  source_filters: Array.isArray(feed.source_filters)
    ? (feed.source_filters as unknown as SourceFilter[])
    : [],
  cross_ref_match_rules: Array.isArray((feed as any).cross_ref_match_rules)
    ? ((feed as any).cross_ref_match_rules as unknown as CrossRefMatchRule[])
    : [],
  last_run_stats: feed.last_run_stats as DataFeed['last_run_stats'],
});

async function fetchDataFeeds(projectId: string): Promise<DataFeed[]> {
  const { data, error } = await supabase
    .from('data_feeds')
    .select('id, name, description, source_type, source_form_id, target_form_id, matching_type, matching_rules, matching_logic, field_mappings, no_match_behavior, schedule, is_active, last_run_at, last_run_status, last_run_stats, source_filters, source_filter_logic, cross_reference_field_id, cross_ref_record_selection, cross_ref_match_rules, cross_ref_match_logic, data_source_connection_id, external_source_config, created_at, updated_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(parseDataFeed);
}

export function useDataFeedsQuery(projectId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Main query with caching
  const { data: feeds = [], isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.dataFeeds(projectId),
    queryFn: () => fetchDataFeeds(projectId),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: DataFeedFormData) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data: newFeed, error } = await supabase
        .from('data_feeds')
        .insert({
          name: data.name,
          description: data.description,
          source_type: data.source_type || 'form',
          source_form_id: data.source_form_id,
          external_source_config: (data.external_source_config || null) as any,
          data_source_connection_id: data.data_source_connection_id || null,
          target_form_id: data.target_form_id,
          matching_type: data.matching_type,
          cross_reference_field_id: data.cross_reference_field_id,
          cross_ref_record_selection: data.cross_ref_record_selection || 'all',
          cross_ref_match_rules: (data.cross_ref_match_rules || []) as any,
          cross_ref_match_logic: data.cross_ref_match_logic || '',
          matching_rules: data.matching_rules as any,
          matching_logic: data.matching_logic,
          source_filters: (data.source_filters || []) as any,
          source_filter_logic: data.source_filter_logic,
          field_mappings: data.field_mappings as any,
          no_match_behavior: data.no_match_behavior,
          schedule: data.schedule,
          is_active: data.is_active,
          project_id: projectId,
          created_by: user.user.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return parseDataFeed(newFeed);
    },
    onSuccess: () => {
      cacheManager.invalidateDataFeeds(projectId);
      toast({ title: 'Success', description: 'Data feed created successfully' });
    },
    onError: (error) => {
      console.error('Error creating data feed:', error);
      toast({ title: 'Error', description: 'Failed to create data feed', variant: 'destructive' });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DataFeedFormData> }) => {
      const updateData: Record<string, any> = { ...data };
      if (data.matching_rules) updateData.matching_rules = data.matching_rules as any;
      if (data.field_mappings) updateData.field_mappings = data.field_mappings as any;
      if (data.source_filters !== undefined) updateData.source_filters = (data.source_filters || []) as any;
      if (data.cross_ref_match_rules !== undefined) updateData.cross_ref_match_rules = (data.cross_ref_match_rules || []) as any;

      const { error } = await supabase
        .from('data_feeds')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      cacheManager.invalidateDataFeeds(projectId);
      toast({ title: 'Success', description: 'Data feed updated successfully' });
    },
    onError: (error) => {
      console.error('Error updating data feed:', error);
      toast({ title: 'Error', description: 'Failed to update data feed', variant: 'destructive' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('data_feeds').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      cacheManager.invalidateDataFeeds(projectId);
      toast({ title: 'Success', description: 'Data feed deleted successfully' });
    },
    onError: (error) => {
      console.error('Error deleting data feed:', error);
      toast({ title: 'Error', description: 'Failed to delete data feed', variant: 'destructive' });
    },
  });

  // Execute feed
  const executeFeed = async (id: string): Promise<boolean> => {
    try {
      const response = await supabase.functions.invoke('execute-data-feed', {
        body: { feedId: id, triggeredBy: 'manual' }
      });

      if (response.error) throw response.error;

      const result = response.data;
      if (result.success) {
        toast({
          title: 'Feed Executed',
          description: `Processed: ${result.stats.recordsProcessed}, Updated: ${result.stats.recordsUpdated}, Created: ${result.stats.recordsCreated}`,
        });
      } else {
        toast({
          title: 'Execution Failed',
          description: result.error || 'Unknown error occurred',
          variant: 'destructive',
        });
      }

      cacheManager.invalidateDataFeeds(projectId);
      return result.success;
    } catch (error) {
      console.error('Error executing data feed:', error);
      toast({ title: 'Error', description: 'Failed to execute data feed', variant: 'destructive' });
      return false;
    }
  };

  return {
    feeds,
    loading,
    fetchFeeds: refetch,
    createFeed: (data: DataFeedFormData) => createMutation.mutateAsync(data),
    updateFeed: (id: string, data: Partial<DataFeedFormData>) => updateMutation.mutateAsync({ id, data }).then(() => true).catch(() => false),
    deleteFeed: (id: string) => deleteMutation.mutateAsync(id).then(() => true).catch(() => false),
    executeFeed,
    toggleFeedActive: (id: string, isActive: boolean) => updateMutation.mutateAsync({ id, data: { is_active: isActive } }).then(() => true).catch(() => false),
  };
}

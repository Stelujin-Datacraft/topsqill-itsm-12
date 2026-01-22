import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DataFeed, DataFeedRun, DataFeedFormData, MatchingRule, FieldMapping, SourceFilter, CrossRefMatchRule } from '@/types/dataFeed';
import { useToast } from '@/hooks/use-toast';

export function useDataFeeds(projectId: string) {
  const [feeds, setFeeds] = useState<DataFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchFeeds = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_feeds')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Parse JSONB fields
      const parsed = (data || []).map(feed => ({
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
      })) as DataFeed[];

      setFeeds(parsed);
    } catch (error) {
      console.error('Error fetching data feeds:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data feeds',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  const createFeed = async (data: DataFeedFormData): Promise<DataFeed | null> => {
    try {
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

      toast({
        title: 'Success',
        description: 'Data feed created successfully',
      });

      await fetchFeeds();
      
      // Parse JSONB fields for the returned feed
      const parsed = {
        ...newFeed,
        matching_rules: Array.isArray(newFeed.matching_rules) 
          ? (newFeed.matching_rules as unknown as MatchingRule[]) 
          : [],
        field_mappings: Array.isArray(newFeed.field_mappings) 
          ? (newFeed.field_mappings as unknown as FieldMapping[]) 
          : [],
        source_filters: Array.isArray(newFeed.source_filters)
          ? (newFeed.source_filters as unknown as SourceFilter[])
          : [],
        last_run_stats: newFeed.last_run_stats as DataFeed['last_run_stats'],
      } as DataFeed;
      
      return parsed;
    } catch (error) {
      console.error('Error creating data feed:', error);
      toast({
        title: 'Error',
        description: 'Failed to create data feed',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateFeed = async (id: string, data: Partial<DataFeedFormData>): Promise<boolean> => {
    try {
      // Convert arrays to JSON for Supabase
      const updateData: Record<string, any> = { ...data };
      if (data.matching_rules) {
        updateData.matching_rules = data.matching_rules as any;
      }
      if (data.field_mappings) {
        updateData.field_mappings = data.field_mappings as any;
      }
      if (data.source_filters !== undefined) {
        updateData.source_filters = (data.source_filters || []) as any;
      }
      if (data.cross_ref_record_selection !== undefined) {
        updateData.cross_ref_record_selection = data.cross_ref_record_selection;
      }
      if (data.cross_ref_match_rules !== undefined) {
        updateData.cross_ref_match_rules = (data.cross_ref_match_rules || []) as any;
      }
      if (data.cross_ref_match_logic !== undefined) {
        updateData.cross_ref_match_logic = data.cross_ref_match_logic || '';
      }
      if (data.source_type !== undefined) {
        updateData.source_type = data.source_type;
      }
      if (data.external_source_config !== undefined) {
        updateData.external_source_config = data.external_source_config || null;
      }
      if (data.data_source_connection_id !== undefined) {
        updateData.data_source_connection_id = data.data_source_connection_id || null;
      }

      const { error } = await supabase
        .from('data_feeds')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Data feed updated successfully',
      });

      await fetchFeeds();
      return true;
    } catch (error) {
      console.error('Error updating data feed:', error);
      toast({
        title: 'Error',
        description: 'Failed to update data feed',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteFeed = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('data_feeds')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Data feed deleted successfully',
      });

      await fetchFeeds();
      return true;
    } catch (error) {
      console.error('Error deleting data feed:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete data feed',
        variant: 'destructive',
      });
      return false;
    }
  };

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

      await fetchFeeds();
      return result.success;
    } catch (error) {
      console.error('Error executing data feed:', error);
      toast({
        title: 'Error',
        description: 'Failed to execute data feed',
        variant: 'destructive',
      });
      return false;
    }
  };

  const toggleFeedActive = async (id: string, isActive: boolean): Promise<boolean> => {
    return updateFeed(id, { is_active: isActive });
  };

  return {
    feeds,
    loading,
    fetchFeeds,
    createFeed,
    updateFeed,
    deleteFeed,
    executeFeed,
    toggleFeedActive,
  };
}

export function useDataFeedRuns(feedId: string) {
  const [runs, setRuns] = useState<DataFeedRun[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!feedId) {
      setRuns([]);
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_feed_runs')
        .select('*')
        .eq('data_feed_id', feedId)
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const parsed = (data || []).map(run => ({
        ...run,
        run_log: Array.isArray(run.run_log) ? run.run_log : JSON.parse(run.run_log as any || '[]'),
      })) as DataFeedRun[];

      setRuns(parsed);
    } catch (error) {
      console.error('Error fetching feed runs:', error);
    } finally {
      setLoading(false);
    }
  }, [feedId]);

  // Initial fetch when feedId changes
  useEffect(() => {
    if (feedId) {
      refetch();
    }
  }, [feedId, refetch]);

  return { runs, loading, refetch };
}

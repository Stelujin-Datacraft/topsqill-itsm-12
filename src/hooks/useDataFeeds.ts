import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DataFeed, DataFeedRun, DataFeedFormData, MatchingRule, FieldMapping } from '@/types/dataFeed';
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
        matching_rules: Array.isArray(feed.matching_rules) ? feed.matching_rules : JSON.parse(feed.matching_rules as any || '[]'),
        field_mappings: Array.isArray(feed.field_mappings) ? feed.field_mappings : JSON.parse(feed.field_mappings as any || '[]'),
        last_run_stats: feed.last_run_stats || undefined,
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
          source_form_id: data.source_form_id,
          target_form_id: data.target_form_id,
          matching_type: data.matching_type,
          cross_reference_field_id: data.cross_reference_field_id,
          matching_rules: data.matching_rules as any,
          field_mappings: data.field_mappings as any,
          no_match_behavior: data.no_match_behavior,
          schedule: data.schedule,
          is_active: data.is_active,
          project_id: projectId,
          created_by: user.user.id,
        })
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

export function useDataFeedRuns(feedId: string, isOpen?: boolean) {
  const [runs, setRuns] = useState<DataFeedRun[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = useCallback(async () => {
    if (!feedId) return;
    
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

  // Fetch when feedId changes or when dialog opens
  useEffect(() => {
    if (!feedId) return;
    // Only fetch when dialog is open (if isOpen is provided) or always (if not provided)
    if (isOpen === undefined || isOpen) {
      fetchRuns();
    }
  }, [feedId, isOpen, fetchRuns]);

  return { runs, loading, refetch: fetchRuns };
}

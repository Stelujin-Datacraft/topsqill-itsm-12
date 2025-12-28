import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LifecycleHistoryEntry {
  id: string;
  submission_id: string;
  field_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string | null;
  changed_at: string;
  comment: string | null;
  duration_in_previous_stage: string | null;
  changed_by_name?: string;
}

export function useLifecycleHistory(submissionId: string, fieldId: string) {
  const { user } = useAuth();
  const [history, setHistory] = useState<LifecycleHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastChange, setLastChange] = useState<LifecycleHistoryEntry | null>(null);
  const fetchedRef = useRef(false);

  const fetchHistory = useCallback(async () => {
    if (!submissionId || !fieldId) {
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching lifecycle history for:', { submissionId, fieldId });
      
      const { data, error } = await supabase
        .from('lifecycle_stage_history')
        .select('*')
        .eq('submission_id', submissionId)
        .eq('field_id', fieldId)
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('Error fetching lifecycle history:', error);
        return;
      }

      console.log('Fetched lifecycle history:', data);

      // Cast data to our type
      const typedData = (data || []).map(item => ({
        ...item,
        duration_in_previous_stage: item.duration_in_previous_stage as string | null
      })) as LifecycleHistoryEntry[];

      setHistory(typedData);
      if (typedData.length > 0) {
        setLastChange(typedData[0]);
      } else {
        setLastChange(null);
      }
    } catch (err) {
      console.error('Error in fetchHistory:', err);
    } finally {
      setLoading(false);
    }
  }, [submissionId, fieldId]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchHistory();
    }
  }, [fetchHistory]);

  // Reset ref when submission/field changes
  useEffect(() => {
    fetchedRef.current = false;
    setHistory([]);
    setLastChange(null);
    setLoading(true);
    fetchHistory();
  }, [submissionId, fieldId, fetchHistory]);

  const addHistoryEntry = useCallback(async (
    fromStage: string | null,
    toStage: string,
    comment?: string
  ): Promise<boolean> => {
    if (!submissionId || !fieldId || !user) {
      console.log('Cannot add history entry - missing data:', { submissionId, fieldId, user: !!user });
      return false;
    }

    try {
      // Calculate duration in previous stage as PostgreSQL interval format
      let durationInterval: string | null = null;
      if (lastChange) {
        const lastChangeDate = new Date(lastChange.changed_at);
        const now = new Date();
        const diffMs = now.getTime() - lastChangeDate.getTime();
        
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        
        // Format as PostgreSQL interval: 'X days Y hours Z minutes W seconds'
        durationInterval = `${days} days ${hours} hours ${minutes} minutes ${seconds} seconds`;
      }

      console.log('Adding lifecycle history entry:', {
        submission_id: submissionId,
        field_id: fieldId,
        from_stage: fromStage,
        to_stage: toStage,
        changed_by: user.id,
        comment: comment || null,
        duration_in_previous_stage: durationInterval
      });

      const { data, error } = await supabase
        .from('lifecycle_stage_history')
        .insert({
          submission_id: submissionId,
          field_id: fieldId,
          from_stage: fromStage,
          to_stage: toStage,
          changed_by: user.id,
          comment: comment || null,
          duration_in_previous_stage: durationInterval
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding lifecycle history entry:', error);
        return false;
      }

      console.log('Successfully added lifecycle history entry:', data);
      return true;
    } catch (err) {
      console.error('Error in addHistoryEntry:', err);
      return false;
    }
  }, [submissionId, fieldId, user, lastChange]);

  // Calculate time in current stage
  const getTimeInCurrentStage = useCallback(() => {
    if (!lastChange) return null;

    const lastChangeDate = new Date(lastChange.changed_at);
    const now = new Date();
    const diffMs = now.getTime() - lastChangeDate.getTime();
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }, [lastChange]);

  return {
    history,
    loading,
    lastChange,
    addHistoryEntry,
    getTimeInCurrentStage,
    refetch: fetchHistory
  };
}

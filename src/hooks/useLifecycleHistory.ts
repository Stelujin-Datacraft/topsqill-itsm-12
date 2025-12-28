import { useState, useEffect, useCallback } from 'react';
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

  const fetchHistory = useCallback(async () => {
    if (!submissionId || !fieldId) {
      setLoading(false);
      return;
    }

    try {
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

      // Cast data to our type
      const typedData = (data || []).map(item => ({
        ...item,
        duration_in_previous_stage: item.duration_in_previous_stage as string | null
      })) as LifecycleHistoryEntry[];

      setHistory(typedData);
      if (typedData.length > 0) {
        setLastChange(typedData[0]);
      }
    } catch (err) {
      console.error('Error in fetchHistory:', err);
    } finally {
      setLoading(false);
    }
  }, [submissionId, fieldId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const addHistoryEntry = useCallback(async (
    fromStage: string | null,
    toStage: string,
    comment?: string
  ) => {
    if (!submissionId || !fieldId || !user) return;

    try {
      // Calculate duration in previous stage
      let duration = null;
      if (lastChange) {
        const lastChangeDate = new Date(lastChange.changed_at);
        const now = new Date();
        const diffMs = now.getTime() - lastChangeDate.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        duration = `${diffHours} hours ${diffMinutes} minutes`;
      }

      const { error } = await supabase
        .from('lifecycle_stage_history')
        .insert({
          submission_id: submissionId,
          field_id: fieldId,
          from_stage: fromStage,
          to_stage: toStage,
          changed_by: user.id,
          comment: comment || null,
          duration_in_previous_stage: duration
        });

      if (error) {
        console.error('Error adding lifecycle history entry:', error);
        return;
      }

      // Refresh history
      await fetchHistory();
    } catch (err) {
      console.error('Error in addHistoryEntry:', err);
    }
  }, [submissionId, fieldId, user, lastChange, fetchHistory]);

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

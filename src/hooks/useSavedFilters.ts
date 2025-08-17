import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FilterGroup } from '@/components/reports/TableFiltersPanel';

export interface SavedFilter {
  id: string;
  name: string;
  filter_data: FilterGroup[];
  created_at: string;
  updated_at: string;
}

export function useSavedFilters(formId: string | null) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSavedFilters = async () => {
    if (!formId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('saved_filters')
        .select('*')
        .eq('form_id', formId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      // Transform the data to ensure filter_data is properly typed
      const transformedData = (data || []).map(item => ({
        ...item,
        filter_data: item.filter_data as unknown as FilterGroup[]
      }));
      setSavedFilters(transformedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load saved filters');
    } finally {
      setLoading(false);
    }
  };

  const saveFilter = async (name: string, filterData: FilterGroup[]) => {
    if (!formId) return null;
    
    try {
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        return null;
      }

      const { data, error: saveError } = await supabase
        .from('saved_filters')
        .insert({
          user_id: user.id,
          form_id: formId,
          name,
          filter_data: filterData as any
        })
        .select()
        .single();

      if (saveError) {
        setError(saveError.message);
        return null;
      }

      // Reload filters to get the updated list
      await loadSavedFilters();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save filter');
      return null;
    }
  };

  const deleteFilter = async (filterId: string) => {
    try {
      setError(null);
      
      const { error: deleteError } = await supabase
        .from('saved_filters')
        .delete()
        .eq('id', filterId);

      if (deleteError) {
        setError(deleteError.message);
        return false;
      }

      // Reload filters to get the updated list
      await loadSavedFilters();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete filter');
      return false;
    }
  };

  const updateFilter = async (filterId: string, name: string, filterData: FilterGroup[]) => {
    try {
      setError(null);
      
      const { data, error: updateError } = await supabase
        .from('saved_filters')
        .update({
          name,
          filter_data: filterData as any
        })
        .eq('id', filterId)
        .select()
        .single();

      if (updateError) {
        setError(updateError.message);
        return null;
      }

      // Reload filters to get the updated list
      await loadSavedFilters();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update filter');
      return null;
    }
  };

  useEffect(() => {
    loadSavedFilters();
  }, [formId]);

  return {
    savedFilters,
    loading,
    error,
    saveFilter,
    deleteFilter,
    updateFilter,
    reload: loadSavedFilters
  };
}
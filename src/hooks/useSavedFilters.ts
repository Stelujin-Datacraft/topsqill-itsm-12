import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FilterGroup } from '@/components/reports/TableFiltersPanel';
import { queryKeys } from '@/lib/cacheManager';

export interface SavedFilter {
  id: string;
  name: string;
  filter_data: FilterGroup[];
  created_at: string;
  updated_at: string;
}

async function fetchSavedFilters(formId: string): Promise<SavedFilter[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('saved_filters')
    .select('*')
    .eq('form_id', formId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map(item => ({
    ...item,
    filter_data: item.filter_data as unknown as FilterGroup[]
  }));
}

export function useSavedFilters(formId: string | null) {
  const queryClient = useQueryClient();

  const { data: savedFilters = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: queryKeys.savedFilters(formId || ''),
    queryFn: () => fetchSavedFilters(formId!),
    enabled: !!formId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const error = queryError ? (queryError as Error).message : null;

  const saveMutation = useMutation({
    mutationFn: async ({ name, filterData }: { name: string; filterData: FilterGroup[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('saved_filters')
        .insert({
          user_id: user.id,
          form_id: formId!,
          name,
          filter_data: filterData as any
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedFilters(formId || '') });
      window.dispatchEvent(new CustomEvent('savedFiltersUpdated'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (filterId: string) => {
      const { error } = await supabase
        .from('saved_filters')
        .delete()
        .eq('id', filterId);

      if (error) throw new Error(error.message);
      return filterId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedFilters(formId || '') });
      window.dispatchEvent(new CustomEvent('savedFiltersUpdated'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ filterId, name, filterData }: { filterId: string; name: string; filterData: FilterGroup[] }) => {
      const { data, error } = await supabase
        .from('saved_filters')
        .update({
          name,
          filter_data: filterData as any
        })
        .eq('id', filterId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedFilters(formId || '') });
      window.dispatchEvent(new CustomEvent('savedFiltersUpdated'));
    },
  });

  const saveFilter = async (name: string, filterData: FilterGroup[]) => {
    if (!formId) return null;
    try {
      return await saveMutation.mutateAsync({ name, filterData });
    } catch (err) {
      return null;
    }
  };

  const deleteFilter = async (filterId: string) => {
    try {
      await deleteMutation.mutateAsync(filterId);
      return true;
    } catch {
      return false;
    }
  };

  const updateFilter = async (filterId: string, name: string, filterData: FilterGroup[]) => {
    try {
      return await updateMutation.mutateAsync({ filterId, name, filterData });
    } catch {
      return null;
    }
  };

  const reload = () => {
    if (formId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedFilters(formId) });
    }
  };

  return {
    savedFilters,
    loading,
    error,
    saveFilter,
    deleteFilter,
    updateFilter,
    reload
  };
}

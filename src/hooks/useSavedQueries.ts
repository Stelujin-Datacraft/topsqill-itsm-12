import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SavedQuery } from '@/types/queries';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/cacheManager';

async function fetchSavedQueries(): Promise<SavedQuery[]> {
  const { data, error } = await (supabase as any)
    .from('saved_queries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export function useSavedQueries() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: savedQueries = [], isLoading } = useQuery({
    queryKey: queryKeys.savedQueries(),
    queryFn: fetchSavedQueries,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const saveMutation = useMutation({
    mutationFn: async ({ name, query }: { name: string; query: string }) => {
      let { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
        if (authError) throw new Error('Failed to authenticate user');
        user = authData.user;
      }

      const { data, error } = await (supabase as any)
        .from('saved_queries')
        .insert({ name, query, user_id: user!.id })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as SavedQuery;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedQueries() });
      toast({
        title: "Query Saved",
        description: `Query "${data.name}" has been saved`,
      });
    },
    onError: (error) => {
      console.error('Error saving query:', error);
      toast({
        title: "Error",
        description: "Failed to save query",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('saved_queries')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedQueries() });
      toast({
        title: "Query Deleted",
        description: "Query has been deleted",
      });
    },
    onError: (error) => {
      console.error('Error deleting query:', error);
      toast({
        title: "Error",
        description: "Failed to delete query",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, query }: { id: string; name: string; query: string }) => {
      const { data, error } = await (supabase as any)
        .from('saved_queries')
        .update({ name, query })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as SavedQuery;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedQueries() });
      toast({
        title: "Query Updated",
        description: `Query "${data.name}" has been updated`,
      });
    },
    onError: (error) => {
      console.error('Error updating query:', error);
      toast({
        title: "Error",
        description: "Failed to update query",
        variant: "destructive",
      });
    },
  });

  const saveQuery = async (name: string, query: string): Promise<SavedQuery | null> => {
    try {
      return await saveMutation.mutateAsync({ name, query });
    } catch {
      return null;
    }
  };

  const deleteQuery = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const updateQuery = async (id: string, name: string, query: string) => {
    await updateMutation.mutateAsync({ id, name, query });
  };

  const refreshQueries = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.savedQueries() });
  };

  return {
    savedQueries,
    isLoading,
    saveQuery,
    deleteQuery,
    updateQuery,
    refreshQueries,
  };
}

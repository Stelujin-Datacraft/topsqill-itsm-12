import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SavedQuery } from '@/types/queries';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useSavedQueries() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use React Query for caching
  const { data: savedQueries = [], isLoading, refetch } = useQuery({
    queryKey: ['saved-queries'],
    queryFn: async () => {
      // Use type assertion to bypass TypeScript errors until types are updated
      const { data, error } = await (supabase as any)
        .from('saved_queries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading saved queries:', error);
        throw error;
      }

      return (data || []) as SavedQuery[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const saveQueryMutation = useMutation({
    mutationFn: async ({ name, query }: { name: string; query: string }) => {
      // Get current user or sign in anonymously
      let { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
        if (authError) throw authError;
        user = authData.user;
      }

      const { data, error } = await (supabase as any)
        .from('saved_queries')
        .insert({
          name,
          query,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as SavedQuery;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['saved-queries'] });
      toast({ title: "Query Saved", description: `Query "${data.name}" has been saved` });
    },
    onError: (error) => {
      console.error('Error saving query:', error);
      toast({ title: "Error", description: "Failed to save query", variant: "destructive" });
    },
  });

  const saveQuery = async (name: string, query: string): Promise<SavedQuery | null> => {
    try {
      return await saveQueryMutation.mutateAsync({ name, query });
    } catch {
      return null;
    }
  };

  const deleteQueryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('saved_queries')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-queries'] });
      toast({ title: "Query Deleted", description: "Query has been deleted" });
    },
    onError: (error) => {
      console.error('Error deleting query:', error);
      toast({ title: "Error", description: "Failed to delete query", variant: "destructive" });
    },
  });

  const deleteQuery = async (id: string) => {
    await deleteQueryMutation.mutateAsync(id);
  };

  const updateQueryMutation = useMutation({
    mutationFn: async ({ id, name, query }: { id: string; name: string; query: string }) => {
      const { data, error } = await (supabase as any)
        .from('saved_queries')
        .update({
          name,
          query,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as SavedQuery;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['saved-queries'] });
      toast({ title: "Query Updated", description: `Query "${data.name}" has been updated` });
    },
    onError: (error) => {
      console.error('Error updating query:', error);
      toast({ title: "Error", description: "Failed to update query", variant: "destructive" });
    },
  });

  const updateQuery = async (id: string, name: string, query: string) => {
    await updateQueryMutation.mutateAsync({ id, name, query });
  };

  return {
    savedQueries,
    isLoading,
    saveQuery,
    deleteQuery,
    updateQuery,
    refreshQueries: () => refetch()
  };
}
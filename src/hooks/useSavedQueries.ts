import { useState, useEffect } from 'react';
import { SavedQuery } from '@/types/queries';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Type assertion for saved_queries table until Supabase types are updated
type SavedQueryRecord = {
  id: string;
  name: string;
  query: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export function useSavedQueries() {
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load saved queries from database
  const loadSavedQueries = async () => {
    try {
      setIsLoading(true);
      // Use type assertion to bypass TypeScript errors until types are updated
      const { data, error } = await (supabase as any)
        .from('saved_queries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading saved queries:', error);
        toast({
          title: "Error",
          description: "Failed to load saved queries",
          variant: "destructive",
        });
        return;
      }

      setSavedQueries(data || []);
    } catch (error) {
      console.error('Unexpected error loading saved queries:', error);
      toast({
        title: "Error", 
        description: "Failed to load saved queries",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSavedQueries();
  }, []);

  const saveQuery = async (name: string, query: string): Promise<SavedQuery | null> => {
    try {
      const { data, error } = await (supabase as any)
        .from('saved_queries')
        .insert({
          name,
          query,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving query:', error);
        toast({
          title: "Error",
          description: "Failed to save query",
          variant: "destructive",
        });
        return null;
      }

      // Update local state
      setSavedQueries(prev => [data, ...prev]);
      
      toast({
        title: "Query Saved",
        description: `Query "${name}" has been saved`,
      });

      return data;
    } catch (error) {
      console.error('Unexpected error saving query:', error);
      toast({
        title: "Error",
        description: "Failed to save query", 
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteQuery = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('saved_queries')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting query:', error);
        toast({
          title: "Error",
          description: "Failed to delete query",
          variant: "destructive",
        });
        return;
      }

      // Update local state
      setSavedQueries(prev => prev.filter(q => q.id !== id));
      
      toast({
        title: "Query Deleted",
        description: "Query has been deleted",
      });
    } catch (error) {
      console.error('Unexpected error deleting query:', error);
      toast({
        title: "Error",
        description: "Failed to delete query",
        variant: "destructive",
      });
    }
  };

  const updateQuery = async (id: string, name: string, query: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('saved_queries')
        .update({
          name,
          query,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating query:', error);
        toast({
          title: "Error",
          description: "Failed to update query",
          variant: "destructive",
        });
        return;
      }

      // Update local state
      setSavedQueries(prev => prev.map(q => 
        q.id === id ? data : q
      ));
      
      toast({
        title: "Query Updated",
        description: `Query "${name}" has been updated`,
      });
    } catch (error) {
      console.error('Unexpected error updating query:', error);
      toast({
        title: "Error",
        description: "Failed to update query",
        variant: "destructive",
      });
    }
  };

  return {
    savedQueries,
    isLoading,
    saveQuery,
    deleteQuery,
    updateQuery,
    refreshQueries: loadSavedQueries
  };
}
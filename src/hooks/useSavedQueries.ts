import { useState, useEffect } from 'react';
import { SavedQuery } from '@/types/queries';

// Mock storage - in a real app, this would use Supabase
const STORAGE_KEY = 'saved_queries';

export function useSavedQueries() {
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSavedQueries(JSON.parse(stored));
    }
  }, []);

  const saveQuery = (name: string, query: string) => {
    const newQuery: SavedQuery = {
      id: crypto.randomUUID(),
      name,
      query,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: 'current_user' // Would be actual user ID in real app
    };

    const updated = [...savedQueries, newQuery];
    setSavedQueries(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return newQuery;
  };

  const deleteQuery = (id: string) => {
    const updated = savedQueries.filter(q => q.id !== id);
    setSavedQueries(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const updateQuery = (id: string, name: string, query: string) => {
    const updated = savedQueries.map(q => 
      q.id === id 
        ? { ...q, name, query, updated_at: new Date().toISOString() }
        : q
    );
    setSavedQueries(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return {
    savedQueries,
    saveQuery,
    deleteQuery,
    updateQuery
  };
}
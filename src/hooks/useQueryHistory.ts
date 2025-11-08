import { useState, useEffect } from 'react';

export interface QueryHistoryItem {
  id: string;
  query: string;
  executedAt: Date;
  executionTime: number;
  rowCount: number;
  success: boolean;
  error?: string;
}

const STORAGE_KEY = 'sql_query_history';
const MAX_HISTORY_ITEMS = 50;

export function useQueryHistory() {
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert string dates back to Date objects
        const historyWithDates = parsed.map((item: any) => ({
          ...item,
          executedAt: new Date(item.executedAt)
        }));
        setHistory(historyWithDates);
      }
    } catch (error) {
      console.error('Failed to load query history:', error);
    }
  };

  const addToHistory = (item: Omit<QueryHistoryItem, 'id' | 'executedAt'>) => {
    const newItem: QueryHistoryItem = {
      ...item,
      id: Date.now().toString(),
      executedAt: new Date()
    };

    setHistory(prev => {
      const updated = [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const removeFromHistory = (id: string) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const getRecentQueries = (limit: number = 10) => {
    return history.slice(0, limit);
  };

  return {
    history,
    addToHistory,
    clearHistory,
    removeFromHistory,
    getRecentQueries
  };
}

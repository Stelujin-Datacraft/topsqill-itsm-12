
import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { QueryEditor } from '@/components/query/QueryEditor';
import { QueryResults } from '@/components/query/QueryResults';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function QueryPage() {
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const { toast } = useToast();

  const executeQuery = async (sql: string) => {
    setIsExecuting(true);
    setError(null);
    setResults(null);

    try {
      console.log('Executing SQL:', sql);
      
      // Execute the query using Supabase's RPC function
      const { data, error: queryError } = await supabase.rpc('execute_user_query', {
        sql_query: sql
      });

      if (queryError) {
        console.error('Query execution error:', queryError);
        setError(queryError.message || 'An error occurred while executing the query');
        toast({
          title: "Query Failed",
          description: queryError.message || 'An error occurred while executing the query',
          variant: "destructive",
        });
        return;
      }

      console.log('Query results:', data);
      setResults(data || []);
      
      toast({
        title: "Query Executed",
        description: `Found ${data?.length || 0} result${data?.length === 1 ? '' : 's'}`,
      });

    } catch (err) {
      console.error('Unexpected error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      toast({
        title: "Query Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <DashboardLayout title="SQL Query Builder">
      <div className="space-y-6">
        <div className="bg-card border rounded-lg p-6">
          <QueryEditor onExecute={executeQuery} isExecuting={isExecuting} />
        </div>
        
        <div className="bg-card border rounded-lg p-6">
          <QueryResults 
            data={results}
            error={error}
            isLoading={isExecuting}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

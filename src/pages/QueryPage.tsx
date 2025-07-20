
import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { QueryEditor } from '@/components/query/QueryEditor';
import { QueryResults } from '@/components/query/QueryResults';
import { FormsSidebar } from '@/components/query/FormsSidebar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

export default function QueryPage() {
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [query, setQuery] = useState('');
  const { toast } = useToast();

  const executeQuery = async (sql: string) => {
    setIsExecuting(true);
    setError(null);
    setResults(null);

    try {
      console.log('Executing SQL:', sql);
      
      // For now, we'll execute queries directly using the SQL query
      // This is a temporary solution until we create the RPC function
      const { data, error: queryError } = await supabase
        .from('form_submissions')
        .select('*')
        .limit(100); // Add a reasonable limit for now

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
      const resultsArray = Array.isArray(data) ? data : [];
      setResults(resultsArray);
      
      toast({
        title: "Query Executed",
        description: `Found ${resultsArray.length} result${resultsArray.length === 1 ? '' : 's'}`,
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

  const insertText = (text: string) => {
    setQuery(prev => prev + text);
  };

  return (
    <DashboardLayout title="SQL Query Builder">
      <div className="h-[calc(100vh-8rem)] flex">
        <ResizablePanelGroup direction="horizontal" className="w-full">
          {/* Forms Sidebar */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
            <FormsSidebar onInsertText={insertText} />
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          {/* Main Query Area */}
          <ResizablePanel defaultSize={80}>
            <ResizablePanelGroup direction="vertical">
              {/* Query Editor */}
              <ResizablePanel defaultSize={50} minSize={30}>
                <div className="h-full border-r border-border">
                  <QueryEditor 
                    onExecute={executeQuery} 
                    isExecuting={isExecuting}
                    value={query}
                    onChange={setQuery}
                  />
                </div>
              </ResizablePanel>
              
              <ResizableHandle withHandle />
              
              {/* Results Panel */}
              <ResizablePanel defaultSize={50} minSize={20}>
                <div className="h-full">
                  <QueryResults 
                    data={results}
                    error={error}
                    isLoading={isExecuting}
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </DashboardLayout>
  );
}


import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { QueryEditor } from '@/components/query/QueryEditor';
import { QueryResultsTabs } from '@/components/query/QueryResultsTabs';
import { FormsSidebar } from '@/components/query/FormsSidebar';
import { executeUserQuery, QueryResult } from '@/services/sqlParser';
import { useToast } from '@/hooks/use-toast';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

export default function QueryPage() {
  const [queryResult, setQueryResult] = useState<QueryResult>({ columns: [], rows: [], errors: [] });
  const [isExecuting, setIsExecuting] = useState(false);
  const [query, setQuery] = useState('');
  const { toast } = useToast();

  const executeQuery = async (sql: string) => {
    setIsExecuting(true);
    
    try {
      console.log('Executing query:', query);
      
      const result = await executeUserQuery(query);
      setQueryResult(result);
      
      if (result.errors.length > 0) {
        toast({
          title: "Query Failed",
          description: result.errors[0],
          variant: "destructive",
        });
      } else {
        toast({
          title: "Query Executed",
          description: `Found ${result.rows.length} result${result.rows.length === 1 ? '' : 's'}`,
        });
      }

    } catch (err) {
      console.error('Unexpected error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setQueryResult({ columns: [], rows: [], errors: [errorMessage] });
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

  // Convert QueryResult to the format expected by QueryResults component
  const resultsData = queryResult.columns.length > 0 
    ? queryResult.rows.map(row => {
        const obj: Record<string, any> = {};
        queryResult.columns.forEach((col, index) => {
          obj[col] = row[index];
        });
        return obj;
      })
    : null;

  const resultsError = queryResult.errors.length > 0 ? queryResult.errors[0] : null;

  return (
    <DashboardLayout title="SQL Query Builder">
      <div className="h-[calc(100vh-8rem)] flex">
        <ResizablePanelGroup direction="horizontal" className="w-full">
          {/* Forms Sidebar */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={35} collapsible>
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
                  <QueryResultsTabs 
                    data={resultsData}
                    error={resultsError}
                    isLoading={isExecuting}
                    executionTime={120}
                    queryStats={{
                      rowsAffected: resultsData?.length || 0,
                      rowsScanned: resultsData?.length || 0,
                      bytesProcessed: 1024
                    }}
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

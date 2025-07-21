
import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { QueryEditor } from '@/components/query/QueryEditor';
import { QueryResultsTable } from '@/components/query/QueryResultsTable';
import { FormsSidebar } from '@/components/query/FormsSidebar';
import { QueryTabs } from '@/components/query/QueryTabs';
import { SaveQueryDialog } from '@/components/query/SaveQueryDialog';
import { executeUserQuery, QueryResult } from '@/services/sqlParser';
import { useToast } from '@/hooks/use-toast';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useSavedQueries } from '@/hooks/useSavedQueries';
import { QueryTab } from '@/types/queries';

export default function QueryPage() {
  const [queryResult, setQueryResult] = useState<QueryResult>({ columns: [], rows: [], errors: [] });
  const [isExecuting, setIsExecuting] = useState(false);
  const [tabs, setTabs] = useState<QueryTab[]>([
    { id: '1', name: 'Query 1', query: '', isActive: true, isDirty: false }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { toast } = useToast();
  const { saveQuery } = useSavedQueries();

  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const currentQuery = activeTab?.query || '';

  const updateTabQuery = (query: string) => {
    setTabs(tabs.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, query, isDirty: query !== tab.query }
        : tab
    ));
  };

  const executeQuery = async (sql: string) => {
    setIsExecuting(true);
    
    try {
      console.log('Executing query:', currentQuery);
      
      const result = await executeUserQuery(currentQuery);
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

  const handleNewTab = () => {
    const newId = Date.now().toString();
    const newTab: QueryTab = {
      id: newId,
      name: `Query ${tabs.length + 1}`,
      query: '',
      isActive: false,
      isDirty: false
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
  };

  const handleTabClose = (tabId: string) => {
    if (tabs.length === 1) return;
    
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);
    
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const handleSaveQuery = (name: string) => {
    saveQuery(name, currentQuery);
    toast({
      title: "Query Saved",
      description: `Query "${name}" has been saved`,
    });
  };

  const insertText = (text: string) => {
    updateTabQuery(currentQuery + text);
  };

  const handleSelectQuery = (query: string) => {
    updateTabQuery(query);
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
            <FormsSidebar onInsertText={insertText} onSelectQuery={handleSelectQuery} />
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          {/* Main Query Area */}
          <ResizablePanel defaultSize={80}>
            <div className="h-full flex flex-col">
              {/* Query Tabs */}
              <QueryTabs
                tabs={tabs}
                activeTabId={activeTabId}
                onTabSelect={setActiveTabId}
                onTabClose={handleTabClose}
                onNewTab={handleNewTab}
              />
              
              <ResizablePanelGroup direction="vertical" className="flex-1">
                {/* Query Editor */}
                <ResizablePanel defaultSize={50} minSize={30}>
                  <div className="h-full border-r border-border">
                    <QueryEditor 
                      onExecute={executeQuery} 
                      isExecuting={isExecuting}
                      value={currentQuery}
                      onChange={updateTabQuery}
                      onSave={() => setShowSaveDialog(true)}
                    />
                  </div>
                </ResizablePanel>
                
                <ResizableHandle withHandle />
                
                {/* Results Panel */}
                <ResizablePanel defaultSize={50} minSize={20}>
                  <div className="h-full">
                    <QueryResultsTable 
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
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      
      <SaveQueryDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={handleSaveQuery}
        defaultName={`Query ${tabs.length}`}
      />
    </DashboardLayout>
  );
}

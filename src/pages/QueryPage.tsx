
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
import { useQueryHistory } from '@/hooks/useQueryHistory';
import { QueryHistory } from '@/components/query/QueryHistory';
import { Button } from '@/components/ui/button';
import { History } from 'lucide-react';

export default function QueryPage() {
  const [queryResult, setQueryResult] = useState<QueryResult>({ columns: [], rows: [], errors: [] });
  const [isExecuting, setIsExecuting] = useState(false);
  const [tabs, setTabs] = useState<QueryTab[]>([
    { id: '1', name: 'Query 1', query: '', isActive: true, isDirty: false }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [executionTime, setExecutionTime] = useState(0);
  const { toast } = useToast();
  const { saveQuery } = useSavedQueries();
  const { history, addToHistory, removeFromHistory, clearHistory } = useQueryHistory();

  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const currentQuery = activeTab?.query || '';

  const updateTabQuery = (query: string) => {
    setTabs(tabs.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, query, isDirty: !tab.savedQueryId || query !== tab.query }
        : tab
    ));
  };

  const executeQuery = async (sql: string) => {
    setIsExecuting(true);
    const startTime = performance.now();
    
    try {
      console.log('Executing query:', currentQuery);
      
      const result = await executeUserQuery(currentQuery);
      const endTime = performance.now();
      const execTime = Math.round(endTime - startTime);
      
      setQueryResult(result);
      setExecutionTime(execTime);
      
      // Add to history
      addToHistory({
        query: currentQuery,
        executionTime: execTime,
        rowCount: result.rows.length,
        success: result.errors.length === 0,
        error: result.errors[0]
      });
      
      if (result.errors.length > 0) {
        toast({
          title: "Query Failed",
          description: result.errors[0],
          variant: "destructive",
        });
      } else {
        toast({
          title: "Query Executed",
          description: `Found ${result.rows.length} result${result.rows.length === 1 ? '' : 's'} in ${execTime}ms`,
        });
      }

    } catch (err) {
      console.error('Unexpected error:', err);
      const endTime = performance.now();
      const execTime = Math.round(endTime - startTime);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      
      setQueryResult({ columns: [], rows: [], errors: [errorMessage] });
      setExecutionTime(execTime);
      
      // Add failed query to history
      addToHistory({
        query: currentQuery,
        executionTime: execTime,
        rowCount: 0,
        success: false,
        error: errorMessage
      });
      
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

  const handleSaveQuery = async (name: string) => {
    const savedQuery = await saveQuery(name, currentQuery);
    if (savedQuery) {
      // Mark the current tab as saved and not dirty
      setTabs(tabs.map(tab => 
        tab.id === activeTabId 
          ? { ...tab, name, isDirty: false, savedQueryId: savedQuery.id }
          : tab
      ));
    }
  };

  const insertText = (text: string) => {
    updateTabQuery(currentQuery + text);
  };

  const handleSelectQuery = (query: string) => {
    // Create a new tab for the selected query or update current if empty
    if (currentQuery.trim() === '') {
      updateTabQuery(query);
    } else {
      handleNewTab();
      // Update the new tab with the selected query
      setTimeout(() => {
        setTabs(tabs => tabs.map(tab => 
          tab.id === activeTabId 
            ? { ...tab, query }
            : tab
        ));
      }, 0);
    }
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
      <div className="h-[calc(100vh-8rem)] flex overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="w-full">
          {/* Forms Sidebar */}
          <ResizablePanel defaultSize={15} minSize={12} maxSize={30} collapsible>
            <FormsSidebar onInsertText={insertText} onSelectQuery={handleSelectQuery} />
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          {/* Query History Sidebar (conditional) */}
          {showHistory && (
            <>
              <ResizablePanel defaultSize={15} minSize={12} maxSize={30}>
                <QueryHistory
                  history={history}
                  onSelectQuery={handleSelectQuery}
                  onRemove={removeFromHistory}
                  onClear={clearHistory}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}
          
          {/* Main Query Area */}
          <ResizablePanel defaultSize={showHistory ? 70 : 85}>
            <div className="h-full flex flex-col">
              {/* Query Tabs with History Toggle */}
              <div className="flex items-center justify-between border-b border-border">
                <QueryTabs
                  tabs={tabs}
                  activeTabId={activeTabId}
                  onTabSelect={setActiveTabId}
                  onTabClose={handleTabClose}
                  onNewTab={handleNewTab}
                />
                <Button
                  variant={showHistory ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                  className="mr-2"
                  title="Toggle query history"
                >
                  <History className="h-4 w-4" />
                </Button>
              </div>
              
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
                      executionTime={executionTime}
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

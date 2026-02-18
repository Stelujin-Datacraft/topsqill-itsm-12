import React, { useState, useRef, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { QueryEditor, QueryEditorRef } from '@/components/query/QueryEditor';
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
// QueryHistory and QueryResultsTable are already memoized in their own files

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
  const editorRef = useRef<QueryEditorRef>(null);
  // CRITICAL FIX: Use ref to access current tabs without causing re-renders
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  // PERFORMANCE FIX: Memoize activeTab to prevent recalculation
  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId), [tabs, activeTabId]);
  const currentQuery = activeTab?.query || '';

  // CRITICAL FIX: Memoize updateTabQuery with stable reference
  const updateTabQuery = useCallback((query: string) => {
    setTabs(prevTabs => prevTabs.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, query, isDirty: !tab.savedQueryId || query !== tab.query }
        : tab
    ));
  }, [activeTabId]);

  // PERFORMANCE FIX: Memoize onSave to prevent breaking QueryEditor memoization
  const handleOpenSaveDialog = useCallback(() => {
    setShowSaveDialog(true);
  }, []);

  // CRITICAL FIX: Remove tabs from dependencies - use ref instead to prevent
  // executeQuery from being recreated on every keystroke
  // Use requestAnimationFrame to batch state updates and prevent UI freeze
  const executeQuery = useCallback(async (sql: string) => {
    // CRITICAL: Use requestAnimationFrame to allow React to finish current render cycle
    // before starting the expensive operation - this prevents UI freeze
    requestAnimationFrame(async () => {
      setIsExecuting(true);
      const startTime = performance.now();
      
      try {
        // CRITICAL: Use ref to get current tabs without dependency
        const currentTabQuery = tabsRef.current.find(t => t.id === activeTabId)?.query || '';
        
        // Wrap in setTimeout(0) to yield to the browser and prevent freeze
        await new Promise(resolve => setTimeout(resolve, 0));
        
        const result = await executeUserQuery(currentTabQuery);
        const endTime = performance.now();
        const execTime = Math.round(endTime - startTime);
        
        // Batch state updates using React's automatic batching
        setQueryResult(result);
        setExecutionTime(execTime);
        
        // Add to history
        addToHistory({
          query: currentTabQuery,
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
        const endTime = performance.now();
        const execTime = Math.round(endTime - startTime);
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        
        setQueryResult({ columns: [], rows: [], errors: [errorMessage] });
        setExecutionTime(execTime);
        
        // Add failed query to history - use ref
        const currentTabQuery = tabsRef.current.find(t => t.id === activeTabId)?.query || '';
        addToHistory({
          query: currentTabQuery,
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
    });
  }, [activeTabId, addToHistory, toast]); // Removed 'tabs' dependency!

  const handleNewTab = useCallback(() => {
    const newId = Date.now().toString();
    setTabs(prevTabs => {
      const newTab: QueryTab = {
        id: newId,
        name: `Query ${prevTabs.length + 1}`,
        query: '',
        isActive: false,
        isDirty: false
      };
      return [...prevTabs, newTab];
    });
    setActiveTabId(newId);
  }, []);

  // CRITICAL FIX: Use ref instead of tabs dependency
  const handleTabClose = useCallback((tabId: string) => {
    setTabs(prevTabs => {
      if (prevTabs.length === 1) return prevTabs;
      return prevTabs.filter(tab => tab.id !== tabId);
    });
    
    setActiveTabId(prevActiveId => {
      if (prevActiveId === tabId) {
        // Use ref to find next tab without dependency
        const currentTabs = tabsRef.current;
        return currentTabs.find(t => t.id !== tabId)?.id || '1';
      }
      return prevActiveId;
    });
  }, []); // No dependencies needed - uses ref

  // CRITICAL FIX: Use ref instead of tabs dependency
  const handleSaveQuery = useCallback(async (name: string) => {
    const currentTabQuery = tabsRef.current.find(t => t.id === activeTabId)?.query || '';
    const savedQuery = await saveQuery(name, currentTabQuery);
    if (savedQuery) {
      // Mark the current tab as saved and not dirty
      setTabs(prevTabs => prevTabs.map(tab => 
        tab.id === activeTabId 
          ? { ...tab, name, isDirty: false, savedQueryId: savedQuery.id }
          : tab
      ));
    }
  }, [saveQuery, activeTabId]); // Removed tabs dependency

  // CRITICAL FIX: Use ref-based insertion to avoid dependency on currentQuery
  // This prevents FormsSidebar from re-rendering on every keystroke
  const insertText = useCallback((text: string) => {
    if (editorRef.current) {
      editorRef.current.insertAtCursor(text);
    } else {
      // Fallback: use functional update to avoid currentQuery dependency
      setTabs(prevTabs => prevTabs.map(tab => 
        tab.id === activeTabId 
          ? { ...tab, query: tab.query + text, isDirty: true }
          : tab
      ));
    }
  }, [activeTabId]); // NO currentQuery dependency - this is the key fix!

  // CRITICAL FIX: Use functional update to check current query without depending on it
  // This prevents FormsSidebar from re-rendering on every keystroke
  const handleSelectQuery = useCallback((query: string) => {
    setTabs(prevTabs => {
      const activeTab = prevTabs.find(t => t.id === activeTabId);
      const currentQueryIsEmpty = !activeTab?.query?.trim();
      
      if (currentQueryIsEmpty) {
        // Update existing tab
        return prevTabs.map(tab => 
          tab.id === activeTabId 
            ? { ...tab, query, isDirty: true }
            : tab
        );
      } else {
        // Create new tab with the query
        const newId = Date.now().toString();
        const newTab: QueryTab = {
          id: newId,
          name: `Query ${prevTabs.length + 1}`,
          query,
          isActive: false,
          isDirty: true
        };
        // We need to also set active tab, but can't do that inside this callback
        // So schedule it for next tick
        setTimeout(() => setActiveTabId(newId), 0);
        return [...prevTabs, newTab];
      }
    });
  }, [activeTabId]); // NO currentQuery dependency!

  // CRITICAL FIX: Memoize resultsData to prevent expensive recalculations on every keystroke
  const resultsData = useMemo(() => {
    if (queryResult.columns.length === 0) return null;
    
    return queryResult.rows.map(row => {
      const obj: Record<string, any> = {};
      queryResult.columns.forEach((col, index) => {
        obj[col] = row[index];
      });
      return obj;
    });
  }, [queryResult.columns, queryResult.rows]);

  const resultsError = useMemo(() => 
    queryResult.errors.length > 0 ? queryResult.errors[0] : null,
    [queryResult.errors]
  );

  // CRITICAL FIX: Memoize queryStats to prevent object recreation on every render
  // This was breaking QueryResultsTable memoization
  const queryStats = useMemo(() => ({
    rowsAffected: resultsData?.length || 0,
    rowsScanned: resultsData?.length || 0,
    bytesProcessed: 1024
  }), [resultsData?.length]);

  // CRITICAL FIX: Memoize toggle handler to prevent recreation
  const handleToggleHistory = useCallback(() => {
    setShowHistory(prev => !prev);
  }, []);

  return (
    <DashboardLayout title="Query Builder" description="Execute SQL queries and explore your data">
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
                  onClick={handleToggleHistory}
                  className="mr-2"
                  title="Toggle query history"
                >
                  <History className="h-4 w-4 text-primary" />
                </Button>
              </div>
              
              <ResizablePanelGroup direction="vertical" className="flex-1">
                {/* Query Editor */}
                <ResizablePanel defaultSize={50} minSize={30}>
                  <div className="h-full border-r border-border">
                    <QueryEditor 
                      ref={editorRef}
                      onExecute={executeQuery} 
                      isExecuting={isExecuting}
                      value={currentQuery}
                      onChange={updateTabQuery}
                      onSave={handleOpenSaveDialog}
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
                      queryStats={queryStats}
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

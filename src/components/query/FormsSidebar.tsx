import { useState } from 'react';
import { ChevronDown, ChevronRight, Table, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SavedQueriesSection } from './SavedQueriesSection';
import { useSavedQueries } from '@/hooks/useSavedQueries';

interface FormsSidebarProps {
  onInsertText: (text: string) => void;
  onSelectQuery: (query: string) => void;
}

export function FormsSidebar({ onInsertText, onSelectQuery }: FormsSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { savedQueries, deleteQuery } = useSavedQueries();
  
  // Mock forms data - in real app this would come from context or API
  const forms = [
    { id: 'test-form-1', name: 'Sample Form 1' },
    { id: 'test-form-2', name: 'Sample Form 2' }
  ];

  return (
    <div className="h-full border-r border-border bg-muted/50 flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-sm flex items-center">
          <Database className="h-4 w-4 mr-2" />
          Query Explorer
        </h2>
      </div>
      
      <div className="flex-1 overflow-auto">
        <SavedQueriesSection
          savedQueries={savedQueries}
          onSelectQuery={onSelectQuery}
          onDeleteQuery={deleteQuery}
        />
        
        <div className="border-b border-border">
          <Button
            variant="ghost"
            className="w-full justify-start p-3 h-auto"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="ml-2 font-medium">Forms & Fields</span>
            <span className="ml-auto text-sm text-muted-foreground">({forms.length})</span>
          </Button>
          
          {isExpanded && (
            <div className="pb-2">
              {forms.length === 0 ? (
                <p className="px-4 py-2 text-sm text-muted-foreground">No forms available</p>
              ) : (
                forms.map((form) => (
                  <Button
                    key={form.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start px-6 py-2 h-8"
                    onClick={() => onInsertText(`"${form.id}"`)}
                  >
                    <Table className="h-3 w-3 mr-2" />
                    <span className="truncate text-sm">{form.name}</span>
                  </Button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
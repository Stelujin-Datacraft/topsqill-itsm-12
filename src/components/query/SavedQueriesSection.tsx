import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SavedQuery } from '@/types/queries';

interface SavedQueriesSectionProps {
  savedQueries: SavedQuery[];
  onSelectQuery: (query: string) => void;
  onDeleteQuery: (id: string) => void;
}

export function SavedQueriesSection({ savedQueries, onSelectQuery, onDeleteQuery }: SavedQueriesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-b border-border">
      <Button
        variant="ghost"
        className="w-full justify-start p-3 h-auto"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="ml-2 font-medium">Saved Queries</span>
        <span className="ml-auto text-sm text-muted-foreground">({savedQueries.length})</span>
      </Button>
      
      {isExpanded && (
        <div className="pb-2">
          {savedQueries.length === 0 ? (
            <p className="px-4 py-2 text-sm text-muted-foreground">No saved queries</p>
          ) : (
            savedQueries.map((query) => (
              <div key={query.id} className="flex items-center group px-3 py-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 justify-start h-8 px-2"
                  onClick={() => onSelectQuery(query.query)}
                >
                  <FileText className="h-3 w-3 mr-2" />
                  <span className="truncate text-sm">{query.name}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onDeleteQuery(query.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
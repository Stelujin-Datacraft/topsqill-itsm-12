import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QueryTab } from '@/types/queries';

interface QueryTabsProps {
  tabs: QueryTab[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
}

export function QueryTabs({ tabs, activeTabId, onTabSelect, onTabClose, onNewTab }: QueryTabsProps) {
  return (
    <div className="flex items-center border-b border-border bg-muted/30">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`flex items-center group border-r border-border ${
            tab.id === activeTabId 
              ? 'bg-background' 
              : 'bg-muted/50 hover:bg-muted'
          }`}
        >
          <Button
            variant="ghost"
            className={`h-10 px-3 rounded-none justify-start ${
              tab.id === activeTabId ? 'text-foreground' : 'text-muted-foreground'
            }`}
            onClick={() => onTabSelect(tab.id)}
          >
            <span className="truncate max-w-32">
              {tab.name}
              {tab.isDirty && ' *'}
            </span>
          </Button>
          {tabs.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onTabClose(tab.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-10 w-10 p-0 border-r border-border"
        onClick={onNewTab}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
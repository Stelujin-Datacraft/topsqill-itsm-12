import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SidebarSection {
  id: string;
  title: string;
  items: {
    id: string;
    title: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  }[];
}

interface DocsSidebarProps {
  sections: SidebarSection[];
  activeSection?: string;
  onSectionClick: (id: string) => void;
}

const methodColors: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  POST: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  PATCH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export function DocsSidebar({ sections, activeSection, onSectionClick }: DocsSidebarProps) {
  return (
    <ScrollArea className="h-[calc(100vh-4rem)]">
      <nav className="py-6 pr-4">
        {sections.map((section) => (
          <div key={section.id} className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-2 px-3">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => onSectionClick(item.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2",
                      activeSection === item.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {item.method && (
                      <Badge className={cn("text-[10px] px-1.5 py-0", methodColors[item.method])}>
                        {item.method}
                      </Badge>
                    )}
                    <span className="truncate">{item.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </ScrollArea>
  );
}

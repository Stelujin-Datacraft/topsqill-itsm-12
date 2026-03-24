import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface BreadcrumbItem {
  level: number;
  label: string;
  recordId?: string;
  recordLabel?: string;
}

interface Props {
  items: BreadcrumbItem[];
  onNavigate: (level: number) => void;
}

export function HierarchyBreadcrumb({ items, onNavigate }: Props) {
  return (
    <nav className="flex items-center gap-1 text-sm flex-wrap">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 h-7 px-2 text-muted-foreground hover:text-foreground"
        onClick={() => onNavigate(0)}
      >
        <Home className="h-3.5 w-3.5" />
        Portfolio
      </Button>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={item.level}>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <Button
              variant={isLast ? 'secondary' : 'ghost'}
              size="sm"
              className={`h-7 px-2 ${isLast ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => !isLast && onNavigate(item.level)}
              disabled={isLast}
            >
              {item.recordLabel ? `${item.label}: ${item.recordLabel}` : item.label}
            </Button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

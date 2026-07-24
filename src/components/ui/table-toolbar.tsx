import * as React from 'react';
import { Filter, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AppIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

interface TableToolbarProps {
  onFilter?: () => void;
  filterLabel?: string;
  exportLabel?: string;
  exportItems?: Array<{ label: string; onClick?: () => void; disabled?: boolean }>;
  className?: string;
  children?: React.ReactNode;
}

export function TableToolbar({
  onFilter,
  filterLabel = 'Filter',
  exportLabel = 'Export',
  exportItems,
  className,
  children,
}: TableToolbarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {onFilter !== undefined && (
        <Button variant="toolbar" size="sm" onClick={onFilter}>
          <AppIcon icon={Filter} size="md" className="text-primary" />
          {filterLabel}
        </Button>
      )}
      {exportItems && exportItems.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="toolbar" size="sm">
              <AppIcon icon={Download} size="md" />
              {exportLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {exportItems.map((item) => (
              <DropdownMenuItem
                key={item.label}
                disabled={item.disabled}
                onClick={item.onClick}
                className="cursor-pointer"
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        children
      )}
    </div>
  );
}

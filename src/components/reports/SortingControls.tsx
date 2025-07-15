import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowUpDown, Plus, X } from 'lucide-react';

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
  label: string;
}

interface SortingControlsProps {
  availableFields: { id: string; label: string }[];
  sortConfigs: SortConfig[];
  onAddSort: (field: string, label: string) => void;
  onRemoveSort: (index: number) => void;
  onToggleDirection: (index: number) => void;
}

export function SortingControls({
  availableFields,
  sortConfigs,
  onAddSort,
  onRemoveSort,
  onToggleDirection,
}: SortingControlsProps) {
  const usedFields = sortConfigs.map(config => config.field);
  const availableSortFields = availableFields.filter(field => !usedFields.includes(field.id));

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
      
      {sortConfigs.map((config, index) => (
        <Badge key={`${config.field}-${index}`} variant="secondary" className="flex items-center gap-1">
          <button
            onClick={() => onToggleDirection(index)}
            className="flex items-center gap-1 hover:opacity-70"
          >
            <span>{config.label}</span>
            <ArrowUpDown className="h-3 w-3" />
            <span className="text-xs">{config.direction.toUpperCase()}</span>
          </button>
          <button
            onClick={() => onRemoveSort(index)}
            className="ml-1 hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {availableSortFields.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-3 w-3 mr-1" />
              Add Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {availableSortFields.map(field => (
              <DropdownMenuItem
                key={field.id}
                onClick={() => onAddSort(field.id, field.label)}
              >
                {field.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
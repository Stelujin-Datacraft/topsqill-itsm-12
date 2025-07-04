
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, X } from 'lucide-react';

interface SortCondition {
  field: string;
  direction: 'asc' | 'desc';
}

interface FormField {
  id: string;
  label: string;
  field_type: string;
}

interface SortControlsProps {
  sortConditions: SortCondition[];
  setSortConditions: React.Dispatch<React.SetStateAction<SortCondition[]>>;
  formFields: FormField[];
  displayColumns: string[];
}

export function SortControls({
  sortConditions,
  setSortConditions,
  formFields,
  displayColumns
}: SortControlsProps) {
  const getFieldLabel = (fieldId: string) => {
    const field = formFields.find(f => f.id === fieldId);
    return field?.label || fieldId;
  };

  const handleSort = (fieldId: string) => {
    setSortConditions((prev: SortCondition[]) => {
      const existing = prev.find(s => s.field === fieldId);
      if (existing) {
        if (existing.direction === 'asc') {
          return prev.map(s => s.field === fieldId ? { ...s, direction: 'desc' as const } : s);
        } else {
          return prev.filter(s => s.field !== fieldId);
        }
      } else {
        return [...prev, { field: fieldId, direction: 'asc' as const }];
      }
    });
  };

  const getSortIcon = (fieldId: string) => {
    const sort = sortConditions.find(s => s.field === fieldId);
    if (!sort) return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    
    return (
      <div className="flex items-center gap-1">
        <ArrowUpDown className={`h-4 w-4 ${sort.direction === 'asc' ? 'text-blue-500' : 'text-blue-500 rotate-180'}`} />
        <span className="text-xs bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
          {sortConditions.findIndex(s => s.field === fieldId) + 1}
        </span>
      </div>
    );
  };

  const removeSortCondition = (fieldId: string) => {
    setSortConditions(sortConditions.filter(s => s.field !== fieldId));
  };

  return (
    <>
      {sortConditions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">Sorted by:</span>
          {sortConditions.map((sort) => (
            <Badge key={sort.field} variant="secondary" className="text-xs">
              {getFieldLabel(sort.field)} ({sort.direction})
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 ml-1"
                onClick={() => removeSortCondition(sort.field)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </>
  );
}

// Export the getSortIcon function for external use
export function getSortIcon(fieldId: string, sortConditions: SortCondition[]) {
  const sort = sortConditions.find(s => s.field === fieldId);
  if (!sort) return null;
  
  return (
    <div className="flex items-center gap-1">
      <span className={`text-xs ${sort.direction === 'asc' ? '↑' : '↓'}`} />
      <span className="text-xs bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
        {sortConditions.findIndex(s => s.field === fieldId) + 1}
      </span>
    </div>
  );
}

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Edit3, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BulkActionsBarProps {
  selectedCount: number;
  onBulkEdit: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  canDelete: boolean;
}

export function BulkActionsBar({ 
  selectedCount, 
  onBulkEdit, 
  onBulkDelete, 
  onClearSelection,
  canDelete 
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <Card className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 shadow-lg border-2">
      <div className="flex items-center gap-4 p-4">
        <Badge variant="secondary" className="font-medium">
          {selectedCount} record{selectedCount > 1 ? 's' : ''} selected
        </Badge>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onBulkEdit}
            className="flex items-center gap-2"
          >
            <Edit3 className="h-4 w-4" />
            Bulk Edit
          </Button>
          
          {canDelete && (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={onBulkDelete}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Bulk Delete
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClearSelection}
            className="flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>
    </Card>
  );
}
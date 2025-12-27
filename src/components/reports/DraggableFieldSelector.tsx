import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { GripVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Field {
  id: string;
  label: string;
  type?: string;
}

interface DraggableFieldSelectorProps {
  availableFields: Field[];
  selectedFieldIds: string[];
  onFieldToggle: (fieldId: string, checked: boolean) => void;
  onReorder: (newOrder: string[]) => void;
  maxSelection?: number;
  showFieldType?: boolean;
  className?: string;
}

export function DraggableFieldSelector({
  availableFields,
  selectedFieldIds,
  onFieldToggle,
  onReorder,
  maxSelection,
  showFieldType = false,
  className
}: DraggableFieldSelectorProps) {
  
  // Get selected fields in order
  const selectedFields = selectedFieldIds
    .map(id => availableFields.find(f => f.id === id))
    .filter((f): f is Field => f !== undefined);
  
  // Get unselected fields
  const unselectedFields = availableFields.filter(f => !selectedFieldIds.includes(f.id));

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(selectedFieldIds);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    onReorder(items);
  };

  const canAddMore = !maxSelection || selectedFieldIds.length < maxSelection;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Selected Fields with Drag & Drop */}
      {selectedFields.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Selected Fields (drag to reorder)
          </Label>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="selected-fields">
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={cn(
                    "space-y-1 min-h-[40px] p-2 rounded-lg border-2 border-dashed transition-colors",
                    snapshot.isDraggingOver ? "border-primary bg-primary/5" : "border-muted"
                  )}
                >
                  {selectedFields.map((field, index) => (
                    <Draggable key={field.id} draggableId={field.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(
                            "flex items-center gap-2 p-2 bg-background rounded-md border transition-shadow",
                            snapshot.isDragging && "shadow-lg ring-2 ring-primary"
                          )}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {index + 1}
                          </Badge>
                          <span className="flex-1 text-sm font-medium truncate">
                            {field.label}
                          </span>
                          {showFieldType && field.type && (
                            <Badge variant="outline" className="text-xs">
                              {field.type}
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onFieldToggle(field.id, false)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      )}

      {/* Available Fields to Select */}
      {unselectedFields.length > 0 && canAddMore && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Available Fields (click to add)
          </Label>
          <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto p-2 bg-muted/30 rounded-lg">
            {unselectedFields.map(field => (
              <button
                key={field.id}
                onClick={() => onFieldToggle(field.id, true)}
                className="flex items-center gap-2 p-2 text-left text-sm rounded-md border bg-background hover:bg-primary/5 hover:border-primary/30 transition-colors"
              >
                <span className="truncate flex-1">{field.label}</span>
                {showFieldType && field.type && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {field.type}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedFields.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Click on fields above to add them
        </p>
      )}

      {/* Max Selection Warning */}
      {maxSelection && selectedFieldIds.length >= maxSelection && (
        <p className="text-xs text-amber-600 text-center">
          Maximum {maxSelection} field{maxSelection > 1 ? 's' : ''} allowed
        </p>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, GripVertical, Move } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

interface ColumnOrderManagerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  formFields: any[];
  selectedColumns: string[];
  onColumnOrderChange: (newOrder: string[]) => void;
}

export function ColumnOrderManager({
  isOpen,
  onOpenChange,
  formFields,
  selectedColumns,
  onColumnOrderChange
}: ColumnOrderManagerProps) {
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Initialize with current selectedColumns order, maintaining the current table sequence
      if (Array.isArray(selectedColumns) && selectedColumns.length > 0) {
        setColumnOrder(selectedColumns);
      } else if (Array.isArray(formFields) && formFields.length > 0) {
        // Fallback to all formFields if no selectedColumns
        setColumnOrder(formFields.map(f => f.id));
      } else {
        // Initialize with empty array if no data available
        setColumnOrder([]);
      }
    }
  }, [isOpen, selectedColumns, formFields]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const newOrder = Array.from(columnOrder);
    const [removed] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, removed);

    setColumnOrder(newOrder);
  };

  const moveColumn = (fromIndex: number, toIndex: number) => {
    const newOrder = [...columnOrder];
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);
    setColumnOrder(newOrder);
  };

  const moveUp = (index: number) => {
    if (index > 0) {
      moveColumn(index, index - 1);
    }
  };

  const moveDown = (index: number) => {
    if (index < columnOrder.length - 1) {
      moveColumn(index, index + 1);
    }
  };

  const handleApply = () => {
    onColumnOrderChange(columnOrder);
    onOpenChange(false);
  };

  const getFieldLabel = (fieldId: string) => {
    if (!Array.isArray(formFields)) return fieldId;
    const field = formFields.find(f => f.id === fieldId);
    return field?.label || fieldId;
  };

  const getFieldType = (fieldId: string) => {
    if (!Array.isArray(formFields)) return 'text';
    const field = formFields.find(f => f.id === fieldId);
    return field?.field_type || 'text';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Move className="h-5 w-5" />
            Reorder Columns
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Drag and drop or use the arrow buttons to reorder table columns
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="space-y-4">
            {columnOrder.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Move className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No columns selected</p>
                <p className="text-sm">Select columns from the Columns dropdown first</p>
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="column-list">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2 max-h-[50vh] overflow-y-auto pr-2"
                    >
                      {Array.isArray(columnOrder) ? columnOrder.map((fieldId, index) => (
                        <Draggable
                          key={fieldId}
                          draggableId={fieldId}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`p-3 transition-shadow ${
                                snapshot.isDragging ? 'shadow-lg' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </div>
                                  
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className="text-sm bg-muted px-2 py-1 rounded font-mono">
                                      {index + 1}
                                    </span>
                                    <span className="font-medium">
                                      {getFieldLabel(fieldId)}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {getFieldType(fieldId)}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveUp(index)}
                                    disabled={index === 0}
                                    className="h-8 w-8 p-0"
                                  >
                                    <ArrowUp className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveDown(index)}
                                    disabled={index === columnOrder.length - 1}
                                    className="h-8 w-8 p-0"
                                  >
                                    <ArrowDown className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          )}
                        </Draggable>
                      )) : null}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {columnOrder.length} column{columnOrder.length !== 1 ? 's' : ''} configured
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={columnOrder.length === 0}
            >
              Apply Order
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
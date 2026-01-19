import React from 'react';
import { DragDropContext } from 'react-beautiful-dnd';
import { FormField } from '@/types/form';
import { FieldRenderer } from './FieldRenderer';
import { StrictModeDroppable } from './StrictModeDroppable';
import { Plus } from 'lucide-react';

interface FieldLayoutRendererProps {
  fields: FormField[];
  columnLayout: 1 | 2 | 3;
  selectedFieldId?: string;
  highlightedFieldId: string | null;
  onFieldClick: (field: FormField) => void;
  onFieldDelete: (fieldId: string) => void;
  onDragEnd: (result: any) => void;
}

export function FieldLayoutRenderer({
  fields,
  columnLayout,
  selectedFieldId,
  highlightedFieldId,
  onFieldClick,
  onFieldDelete,
  onDragEnd,
}: FieldLayoutRendererProps) {
  if (fields.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Plus className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No fields added yet</p>
        <p className="text-sm">Click field types from the right panel to get started</p>
      </div>
    );
  }

  // Get grid column class based on layout
  const getGridClass = () => {
    switch (columnLayout) {
      case 2: return 'grid-cols-2';
      case 3: return 'grid-cols-3';
      default: return 'grid-cols-1';
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <StrictModeDroppable droppableId="all-fields">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`grid ${getGridClass()} gap-4 ${snapshot.isDraggingOver ? 'bg-muted/30 rounded-lg' : ''}`}
          >
            {fields.map((field, index) => (
              <FieldRenderer
                key={field.id}
                field={field}
                index={index}
                selectedFieldId={selectedFieldId}
                highlightedFieldId={highlightedFieldId}
                onFieldClick={onFieldClick}
                onFieldDelete={onFieldDelete}
                columnLayout={columnLayout}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </StrictModeDroppable>
    </DragDropContext>
  );
}

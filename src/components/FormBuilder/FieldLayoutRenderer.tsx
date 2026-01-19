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

// Full-width field types that should span all columns
const fullWidthTypes = [
  'header', 'description', 'section-break', 'horizontal-line', 'rich-text', 
  'record-table', 'matrix-grid', 'cross-reference', 'child-cross-reference', 
  'approval', 'geo-location', 'query-field', 'workflow-trigger'
];

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

  // Check if a field should be full-width
  const isFullWidthField = (field: FormField) => {
    return fullWidthTypes.includes(field.type) || field.isFullWidth || field.fieldCategory === 'full-width';
  };

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
              <div 
                key={field.id}
                className={isFullWidthField(field) ? `col-span-${columnLayout}` : ''}
                style={isFullWidthField(field) ? { gridColumn: `span ${columnLayout} / span ${columnLayout}` } : undefined}
              >
                <FieldRenderer
                  field={field}
                  index={index}
                  selectedFieldId={selectedFieldId}
                  highlightedFieldId={highlightedFieldId}
                  onFieldClick={onFieldClick}
                  onFieldDelete={onFieldDelete}
                />
              </div>
            ))}
            {provided.placeholder}
          </div>
        )}
      </StrictModeDroppable>
    </DragDropContext>
  );
}

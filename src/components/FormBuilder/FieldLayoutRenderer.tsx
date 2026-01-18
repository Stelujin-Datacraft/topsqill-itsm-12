
import React from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { FormField } from '@/types/form';
import { FieldRenderer } from './FieldRenderer';
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
  // Check if field is full-width based on type or explicit setting
  const isFullWidthField = (field: FormField) => {
    const fullWidthTypes = ['header', 'description', 'section-break', 'horizontal-line', 'rich-text', 'record-table', 'matrix-grid', 
      'cross-reference', 'child-cross-reference', 'approval', 'geo-location', 'query-field', 'workflow-trigger', 'full-width-container'];
    return fullWidthTypes.includes(field.type) || field.isFullWidth || field.fieldCategory === 'full-width';
  };

  if (fields.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Plus className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No fields added yet</p>
        <p className="text-sm">Click field types from the right panel to get started</p>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="all-fields">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="space-y-4"
          >
            {/* Render all fields in a flat list - required for react-beautiful-dnd */}
            {fields.map((field, index) => (
              <FieldRenderer
                key={field.id}
                field={field}
                index={index}
                selectedFieldId={selectedFieldId}
                highlightedFieldId={highlightedFieldId}
                onFieldClick={onFieldClick}
                onFieldDelete={onFieldDelete}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

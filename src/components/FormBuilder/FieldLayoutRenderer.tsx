
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
  // Separate full-width and standard fields
  const fullWidthFields = fields.filter(field => field.isFullWidth);
  const standardFields = fields.filter(field => !field.isFullWidth);

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
      <div className="space-y-4">
        {/* Render full-width fields first */}
        {fullWidthFields.length > 0 && (
          <Droppable droppableId="fullwidth-fields">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-4"
              >
                {fullWidthFields.map((field, index) => (
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
        )}

        {/* Render standard fields in grid */}
        {standardFields.length > 0 && (
          <Droppable droppableId="standard-fields">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`grid gap-4 ${
                  columnLayout === 1 ? 'grid-cols-1' : 
                  columnLayout === 2 ? 'grid-cols-1 md:grid-cols-2' : 
                  'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                }`}
              >
                {standardFields.map((field, index) => (
                  <FieldRenderer
                    key={field.id}
                    field={field}
                    index={fullWidthFields.length + index}
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
        )}
      </div>
    </DragDropContext>
  );
}

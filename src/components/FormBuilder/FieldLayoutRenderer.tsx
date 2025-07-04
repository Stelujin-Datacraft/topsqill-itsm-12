
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
      <Droppable droppableId="all-fields">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="space-y-4"
          >
            {/* Render all fields in their original order but with layout separation */}
            {fields.map((field, index) => {
              if (field.isFullWidth) {
                // Full-width fields take full width
                return (
                  <div key={field.id} className="w-full">
                    <FieldRenderer
                      field={field}
                      index={index}
                      selectedFieldId={selectedFieldId}
                      highlightedFieldId={highlightedFieldId}
                      onFieldClick={onFieldClick}
                      onFieldDelete={onFieldDelete}
                    />
                  </div>
                );
              } else {
                // Check if this is the start of a group of standard fields
                const isStartOfStandardGroup = index === 0 || fields[index - 1].isFullWidth;
                const isEndOfStandardGroup = index === fields.length - 1 || fields[index + 1].isFullWidth;
                
                // Get consecutive standard fields starting from this one
                if (isStartOfStandardGroup) {
                  const standardFieldsGroup = [];
                  let currentIndex = index;
                  while (currentIndex < fields.length && !fields[currentIndex].isFullWidth) {
                    standardFieldsGroup.push(fields[currentIndex]);
                    currentIndex++;
                  }
                  
                  return (
                    <div
                      key={`standard-group-${index}`}
                      className={`grid gap-4 ${
                        columnLayout === 1 ? 'grid-cols-1' : 
                        columnLayout === 2 ? 'grid-cols-1 md:grid-cols-2' : 
                        'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                      }`}
                    >
                      {standardFieldsGroup.map((groupField, groupIndex) => (
                        <FieldRenderer
                          key={groupField.id}
                          field={groupField}
                          index={index + groupIndex}
                          selectedFieldId={selectedFieldId}
                          highlightedFieldId={highlightedFieldId}
                          onFieldClick={onFieldClick}
                          onFieldDelete={onFieldDelete}
                        />
                      ))}
                    </div>
                  );
                }
                // Return null for standard fields that are part of a group (already rendered above)
                return null;
              }
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

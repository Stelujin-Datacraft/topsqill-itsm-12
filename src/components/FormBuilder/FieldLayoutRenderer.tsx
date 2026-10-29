import React from 'react';
import { DragDropContext } from 'react-beautiful-dnd';
import { FormField, FormPage } from '@/types/form';
import { FieldRenderer } from './FieldRenderer';
import { StrictModeDroppable } from './StrictModeDroppable';
import { pageTargetDroppableId } from './moveFieldBetweenPages';
import { Plus } from 'lucide-react';

interface FieldLayoutRendererProps {
  fields: FormField[];
  columnLayout: 1 | 2 | 3;
  selectedFieldId?: string;
  highlightedFieldId: string | null;
  onFieldClick: (field: FormField) => void;
  onFieldDelete: (fieldId: string) => void;
  onDragEnd: (result: any) => void;
  pages?: FormPage[];
  currentPageId?: string;
}

export function FieldLayoutRenderer({
  fields,
  columnLayout,
  selectedFieldId,
  highlightedFieldId,
  onFieldClick,
  onFieldDelete,
  onDragEnd,
  pages,
  currentPageId,
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

  const otherPages = currentPageId
    ? [...(pages ?? [])]
        .filter((page) => page.id !== currentPageId)
        .sort((a, b) => a.order - b.order)
    : [];

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {otherPages.length > 0 && (
        <div className="mb-4 rounded-lg border border-dashed border-border bg-muted/20 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Drag a field onto another page
          </p>
          <div className="flex flex-wrap gap-2">
            {otherPages.map((page) => (
              <StrictModeDroppable key={page.id} droppableId={pageTargetDroppableId(page.id)}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-w-[8rem] rounded-md border px-3 py-2 text-sm transition-colors ${
                      snapshot.isDraggingOver
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background'
                    }`}
                  >
                    <span className="font-medium">{page.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {page.fields.length} {page.fields.length === 1 ? 'field' : 'fields'}
                    </span>
                    <div className="h-0 overflow-hidden">{provided.placeholder}</div>
                  </div>
                )}
              </StrictModeDroppable>
            ))}
          </div>
        </div>
      )}
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

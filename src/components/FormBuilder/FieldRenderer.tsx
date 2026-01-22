import React, { memo } from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { Button } from '@/components/ui/button';
import { FormField } from '@/types/form';
import { GripVertical, Settings, Trash2 } from 'lucide-react';

// Full-width field types that should span all columns
const fullWidthTypes = [
  'header', 'description', 'section-break', 'horizontal-line', 'rich-text', 
  'record-table', 'matrix-grid', 'cross-reference', 'child-cross-reference', 
  'approval', 'geo-location', 'query-field', 'workflow-trigger'
];

interface FieldRendererProps {
  field: FormField;
  index: number;
  selectedFieldId?: string;
  highlightedFieldId: string | null;
  onFieldClick: (field: FormField) => void;
  onFieldDelete: (fieldId: string) => void;
  columnLayout?: 1 | 2 | 3;
}

export const FieldRenderer = memo(function FieldRenderer({
  field,
  index,
  selectedFieldId,
  highlightedFieldId,
  onFieldClick,
  onFieldDelete,
  columnLayout = 1
}: FieldRendererProps) {
  // Check if a field should be full-width
  const isFullWidth = fullWidthTypes.includes(field.type) || field.isFullWidth || field.fieldCategory === 'full-width';
  
  // Get style for grid column span
  const getGridStyle = (): React.CSSProperties | undefined => {
    if (isFullWidth && columnLayout > 1) {
      return { gridColumn: `span ${columnLayout} / span ${columnLayout}` };
    }
    return undefined;
  };

  return (
    <Draggable key={field.id} draggableId={field.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef} 
          {...provided.draggableProps} 
          style={{ ...provided.draggableProps.style, ...getGridStyle() }} 
          className={`group p-4 border rounded-lg transition-all duration-300 cursor-pointer hover:shadow-md ${selectedFieldId === field.id ? 'ring-2 ring-primary' : ''} ${highlightedFieldId === field.id ? 'ring-2 ring-blue-500 bg-blue-50 animate-pulse' : ''} ${snapshot.isDragging ? 'shadow-lg opacity-90' : ''}`} 
          onClick={() => onFieldClick(field)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div {...provided.dragHandleProps}>
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab hover:cursor-grabbing" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{field.label}</p>
                <p className="text-sm text-muted-foreground">
                  {field.type}{" "}
                  {field.required && (
                    <span className="text-red-500 font-medium">(Required)</span>
                  )}
                  {field.isFullWidth && (
                    <span className="italic text-slate-500"> (full-width)</span>
                  )}
                </p>
              </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={(e) => {
                  e.stopPropagation();
                  onFieldClick(field);
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={(e) => {
                  e.stopPropagation();
                  onFieldDelete(field.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
});


import React, { useState } from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { Button } from '@/components/ui/button';
import { FormField } from '@/types/form';
import { GripVertical, Settings, Trash2, Copy, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface FieldRendererProps {
  field: FormField;
  index: number;
  selectedFieldId?: string;
  highlightedFieldId: string | null;
  onFieldClick: (field: FormField) => void;
  onFieldDelete: (fieldId: string) => void;
}

export function FieldRenderer({
  field,
  index,
  selectedFieldId,
  highlightedFieldId,
  onFieldClick,
  onFieldDelete,
}: FieldRendererProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyFieldId = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(field.id);
      setCopied(true);
      toast({
        title: "Field ID copied",
        description: `"${field.id}" copied to clipboard`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy field ID to clipboard",
        variant: "destructive",
      });
    }
  };
  return (
    <Draggable key={field.id} draggableId={field.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`group p-4 border rounded-lg transition-all duration-300 cursor-pointer hover:shadow-md ${
            selectedFieldId === field.id ? 'ring-2 ring-primary' : ''
          } ${
            highlightedFieldId === field.id 
              ? 'ring-2 ring-blue-500 bg-blue-50 animate-pulse' 
              : ''
          } ${snapshot.isDragging ? 'shadow-lg opacity-90' : ''}`}
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
                  {field.type} {field.required && '(required)'}
                  {field.isFullWidth && ' (full-width)'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                    {field.id}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleCopyFieldId}
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
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
}

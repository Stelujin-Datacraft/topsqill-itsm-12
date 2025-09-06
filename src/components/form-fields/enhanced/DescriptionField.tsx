
import React, { useState } from 'react';
import { FormField } from '@/types/form';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DescriptionFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
}

export function DescriptionField({ field }: DescriptionFieldProps) {
  const config = field.customConfig || {};
  const [isCollapsed, setIsCollapsed] = useState(config.startCollapsed || false);

  const content = config.content || field.label;
  const isCollapsible = config.collapsible || false;
  const fontFamily = config.fontFamily || 'inherit';
  const fontSize = config.fontSize || '14px';
  const fontWeight = config.fontWeight || 'normal';
  const alignment = config.alignment || 'left';
  const color = config.color || 'hsl(var(--muted-foreground))';

  const style = {
    fontFamily,
    fontSize,
    fontWeight,
    textAlign: alignment as any,
    color,
    margin: 0,
  };

  if (isCollapsible) {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center justify-between w-full p-2 h-auto hover:bg-muted/50"
        >
          <span style={style}>{field.label}</span>
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
        {!isCollapsed && (
          <div 
            style={style} 
            className="prose prose-sm max-w-none dark:prose-invert pl-2" 
            dangerouslySetInnerHTML={{ __html: content }} 
          />
        )}
      </div>
    );
  }

  return (
    <div 
      style={style} 
      className="prose prose-sm max-w-none dark:prose-invert" 
      dangerouslySetInnerHTML={{ __html: content }} 
    />
  );
}

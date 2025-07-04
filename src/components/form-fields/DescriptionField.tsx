
import React, { useState } from 'react';
import { FormField } from '@/types/form';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface DescriptionFieldProps {
  field: FormField;
  isPreview?: boolean;
}

export function DescriptionField({ field, isPreview = false }: DescriptionFieldProps) {
  const [isExpanded, setIsExpanded] = useState(!field.customConfig?.startCollapsed);
  const content = field.customConfig?.content || field.label;
  const isCollapsible = field.customConfig?.collapsible || false;
  const fontSize = field.customConfig?.fontSize || '16px';
  const color = field.customConfig?.color || '#6b7280';

  const styles = {
    fontSize: fontSize,
    color: color,
    fontFamily: "'Inter', system-ui, sans-serif",
    lineHeight: '1.6',
    margin: 0,
  };

  if (isPreview) {
    return (
      <div className="w-full relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
        <div className="py-4">
          {isCollapsible && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {isExpanded ? 'Hide' : 'Show'} Details
            </button>
          )}
          {(!isCollapsible || isExpanded) && (
            <div 
              style={styles}
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br />') }}
            />
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      {isCollapsible && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {isExpanded ? 'Hide' : 'Show'} Details
        </button>
      )}
      {(!isCollapsible || isExpanded) && (
        <div 
          style={styles}
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br />') }}
        />
      )}
    </div>
  );
}


import React, { useState } from 'react';
import { FormField } from '@/types/form';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SectionBreakFieldProps {
  field: FormField;
  isPreview?: boolean;
  children?: React.ReactNode;
}

export function SectionBreakField({ field, isPreview = false, children }: SectionBreakFieldProps) {
  const [isExpanded, setIsExpanded] = useState(!field.customConfig?.startCollapsed);
  const title = field.customConfig?.title || field.label;
  const description = field.customConfig?.description || '';
  const backgroundColor = field.customConfig?.backgroundColor || '#f8f9fa';
  const isCollapsible = field.customConfig?.collapsible || false;

  const sectionStyle = {
    backgroundColor: backgroundColor,
    border: `1px solid ${backgroundColor === '#f8f9fa' ? '#e9ecef' : backgroundColor}`,
    borderRadius: '8px',
    padding: '16px',
    margin: '16px 0',
  };

  if (isPreview) {
    return (
      <div className="w-full relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
        <div style={sectionStyle}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium text-gray-900 m-0">{title}</h3>
            {isCollapsible && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-gray-500 hover:text-gray-700"
              >
                {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
            )}
          </div>
          {description && (
            <p className="text-sm text-gray-600 mb-3 m-0">{description}</p>
          )}
          {(!isCollapsible || isExpanded) && children && (
            <div className="mt-4">
              {children}
            </div>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
      </div>
    );
  }

  return (
    <div style={sectionStyle}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-medium text-gray-900 m-0">{title}</h3>
        {isCollapsible && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700"
          >
            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        )}
      </div>
      {description && (
        <p className="text-sm text-gray-600 mb-3 m-0">{description}</p>
      )}
      {(!isCollapsible || isExpanded) && children && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
}

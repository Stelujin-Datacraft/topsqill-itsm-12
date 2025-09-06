
import React, { useState } from 'react';
import { FormField } from '@/types/form';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Underline, List, Link, Image, AlignLeft, Palette } from 'lucide-react';

interface RichTextFieldProps {
  field: FormField;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
}

export function RichTextField({ field, value = '', onChange, error, disabled }: RichTextFieldProps) {
  const config = field.customConfig || {};
  const editorToolbar = config.editorToolbar || ['bold', 'italic', 'underline', 'list'];
  const [content, setContent] = useState(value || '');

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    if (onChange) {
      onChange(newContent);
    }
  };

  const insertFormatting = (tag: string) => {
    const textarea = document.getElementById(field.id) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    let replacement = '';
    switch (tag) {
      case 'bold':
        replacement = `**${selectedText}**`;
        break;
      case 'italic':
        replacement = `*${selectedText}*`;
        break;
      case 'underline':
        replacement = `<u>${selectedText}</u>`;
        break;
      case 'list':
        replacement = `\n- ${selectedText}`;
        break;
      default:
        replacement = selectedText;
    }

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    handleContentChange(newContent);
  };

  const toolbarButtons = [
    { id: 'bold', icon: Bold, label: 'Bold' },
    { id: 'italic', icon: Italic, label: 'Italic' },
    { id: 'underline', icon: Underline, label: 'Underline' },
    { id: 'list', icon: List, label: 'List' },
    { id: 'link', icon: Link, label: 'Link' },
    { id: 'image', icon: Image, label: 'Image' },
    { id: 'align', icon: AlignLeft, label: 'Align' },
    { id: 'color', icon: Palette, label: 'Color' },
  ];

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id}>{field.label}</Label>
      
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border rounded-t-md bg-gray-50">
        {toolbarButtons
          .filter(btn => editorToolbar.includes(btn.id))
          .map((btn) => {
            const IconComponent = btn.icon;
            return (
              <Button
                key={btn.id}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertFormatting(btn.id)}
                disabled={disabled}
                title={btn.label}
              >
                <IconComponent className="h-4 w-4" />
              </Button>
            );
          })}
      </div>

      {/* Editor */}
      <Textarea
        id={field.id}
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
        placeholder={field.placeholder || 'Enter rich text content...'}
        disabled={disabled}
        rows={8}
        className="rounded-t-none border-t-0"
        maxLength={config.maxContentLength}
      />

      {/* Preview */}
      {config.allowHtml && content && (
        <div className="p-3 border rounded-md bg-gray-50">
          <Label className="text-sm text-gray-600 mb-2 block">Preview:</Label>
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

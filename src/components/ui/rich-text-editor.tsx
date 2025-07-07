import React, { useEffect, useRef } from 'react';
import { Label } from './label';

interface RichTextEditorProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  rows?: number;
}

export function RichTextEditor({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
  error,
  rows = 6
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current && !disabled) {
      isUpdatingRef.current = true;
      onChange(editorRef.current.innerHTML);
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  };

  const applyFormat = (command: string, value?: string) => {
    if (disabled) return;
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const insertList = (ordered: boolean = false) => {
    if (disabled) return;
    const command = ordered ? 'insertOrderedList' : 'insertUnorderedList';
    document.execCommand(command, false);
    editorRef.current?.focus();
    handleInput();
  };

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={id}>{label}</Label>}
      
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border rounded-t-md bg-muted/50">
        <button
          type="button"
          onClick={() => applyFormat('bold')}
          disabled={disabled}
          className="p-1 rounded hover:bg-muted disabled:opacity-50"
          title="Bold"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6 4v12h4.5c2.485 0 4.5-2.015 4.5-4.5S12.985 7 10.5 7H9v2h1.5c1.379 0 2.5 1.121 2.5 2.5S11.879 14 10.5 14H8V6h2.5c1.379 0 2.5 1.121 2.5 2.5S11.879 11 10.5 11H9V9h1.5c.828 0 1.5-.672 1.5-1.5S11.328 6 10.5 6H6z"/>
          </svg>
        </button>

        <button
          type="button"
          onClick={() => applyFormat('italic')}
          disabled={disabled}
          className="p-1 rounded hover:bg-muted disabled:opacity-50"
          title="Italic"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 4v1h2.5l-2 10H6v1h6v-1h-2.5l2-10H14V4H8z"/>
          </svg>
        </button>

        <button
          type="button"
          onClick={() => applyFormat('underline')}
          disabled={disabled}
          className="p-1 rounded hover:bg-muted disabled:opacity-50"
          title="Underline"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6 3v5c0 2.2 1.8 4 4 4s4-1.8 4-4V3h-1v5c0 1.7-1.3 3-3 3s-3-1.3-3-3V3H6zM4 17h12v1H4v-1z"/>
          </svg>
        </button>

        <div className="w-px h-6 bg-border mx-1"></div>

        <button
          type="button"
          onClick={() => insertList(false)}
          disabled={disabled}
          className="p-1 rounded hover:bg-muted disabled:opacity-50"
          title="Bullet List"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 6a1 1 0 11-2 0 1 1 0 012 0zM4 10a1 1 0 11-2 0 1 1 0 012 0zM4 14a1 1 0 11-2 0 1 1 0 012 0zM8 6h8v1H8V6zM8 10h8v1H8v-1zM8 14h8v1H8v-1z"/>
          </svg>
        </button>

        <button
          type="button"
          onClick={() => insertList(true)}
          disabled={disabled}
          className="p-1 rounded hover:bg-muted disabled:opacity-50"
          title="Numbered List"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4h1v1H3V4zM5 4h10v1H5V4zM3 8h1v1H3V8zM5 8h10v1H5V8zM3 12h1v1H3v-1zM5 12h10v1H5v-1z"/>
          </svg>
        </button>

        <div className="w-px h-6 bg-border mx-1"></div>

        <button
          type="button"
          onClick={() => applyFormat('createLink', prompt('Enter URL:') || '')}
          disabled={disabled}
          className="p-1 rounded hover:bg-muted disabled:opacity-50"
          title="Insert Link"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z"/>
            <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z"/>
          </svg>
        </button>

        <button
          type="button"
          onClick={() => applyFormat('removeFormat')}
          disabled={disabled}
          className="p-1 rounded hover:bg-muted disabled:opacity-50"
          title="Clear Formatting"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8.707 3.293a1 1 0 00-1.414 1.414L8.586 6H5a1 1 0 000 2h4.586l1 1H7a1 1 0 100 2h4.586l3.707 3.707a1 1 0 001.414-1.414L8.707 3.293z"/>
            <path d="M11 14a1 1 0 100 2h3a1 1 0 100-2h-3z"/>
          </svg>
        </button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        id={id}
        contentEditable={!disabled}
        onInput={handleInput}
        className={`
          min-h-[${rows * 1.5}rem] p-3 border rounded-b-md focus:outline-none focus:ring-2 focus:ring-ring
          ${disabled ? 'bg-muted cursor-not-allowed' : 'bg-background'}
          prose prose-sm max-w-none [&_*]:my-1
        `}
        style={{ 
          minHeight: `${rows * 1.5}rem`,
          maxHeight: '300px',
          overflowY: 'auto'
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning={true}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
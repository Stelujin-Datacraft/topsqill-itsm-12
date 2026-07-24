import React, { useState, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { Button } from './button';
import { Separator } from './separator';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import {
  Bold, Italic, Underline, Strikethrough,
  List, ListOrdered,
  Link as LinkIcon, Image as ImageIcon, Unlink, Upload,
  Undo, Redo,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Table as TableIcon, Minus, Quote, Code,
  Type, Highlighter,
  RowsIcon, Columns,
  Trash2, ArrowDown, ArrowUp, ArrowLeft, ArrowRight,
  Subscript, Superscript,
} from 'lucide-react';

interface TiptapToolbarProps {
  editor: Editor;
  disabled?: boolean;
}

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Verdana', value: 'Verdana' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS' },
  { label: 'Tahoma', value: 'Tahoma' },
];

const COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#B7B7B7', '#CCCCCC', '#D9D9D9', '#FFFFFF',
  '#980000', '#FF0000', '#FF9900', '#FFFF00', '#00FF00', '#00FFFF', '#4A86E8', '#0000FF',
  '#9900FF', '#FF00FF', '#E6B8AF', '#F4CCCC', '#FCE5CD', '#FFF2CC', '#D9EAD3', '#D0E0E3',
  '#C9DAF8', '#CFE2F3', '#D9D2E9', '#EAD1DC',
];

const HEADING_OPTIONS = [
  { label: 'Normal', value: 'paragraph' },
  { label: 'Heading 1', value: '1' },
  { label: 'Heading 2', value: '2' },
  { label: 'Heading 3', value: '3' },
  { label: 'Heading 4', value: '4' },
  { label: 'Heading 5', value: '5' },
  { label: 'Heading 6', value: '6' },
];

const MAX_GRID_ROWS = 8;
const MAX_GRID_COLS = 8;

function ToolbarButton({
  onClick, active, disabled, children, title,
}: {
  onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode; title: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`h-7 w-7 p-0 ${active ? 'bg-accent text-accent-foreground' : ''}`}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  );
}

function TableGridPicker({ onSelect, onClose }: { onSelect: (rows: number, cols: number) => void; onClose: () => void }) {
  const [hoverRow, setHoverRow] = useState(0);
  const [hoverCol, setHoverCol] = useState(0);

  return (
    <div className="p-2">
      <p className="text-xs text-muted-foreground mb-1.5 text-center font-medium">
        {hoverRow > 0 && hoverCol > 0 ? `${hoverRow} × ${hoverCol} Table` : 'Select table size'}
      </p>
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${MAX_GRID_COLS}, 1fr)` }}
        onMouseLeave={() => { setHoverRow(0); setHoverCol(0); }}
      >
        {Array.from({ length: MAX_GRID_ROWS * MAX_GRID_COLS }).map((_, idx) => {
          const r = Math.floor(idx / MAX_GRID_COLS) + 1;
          const c = (idx % MAX_GRID_COLS) + 1;
          const isActive = r <= hoverRow && c <= hoverCol;
          return (
            <div
              key={idx}
              className={`w-4 h-4 border rounded-[2px] cursor-pointer transition-colors ${
                isActive
                  ? 'bg-primary border-primary'
                  : 'bg-background border-border hover:border-muted-foreground'
              }`}
              onMouseEnter={() => { setHoverRow(r); setHoverCol(c); }}
              onClick={() => { onSelect(r, c); onClose(); }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function TiptapToolbar({ editor, disabled = false }: TiptapToolbarProps) {
  const [showTableMenu, setShowTableMenu] = useState(false);

  const addLink = () => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  const imageInputRef = React.useRef<HTMLInputElement>(null);

  const addImage = () => {
    imageInputRef.current?.click();
  };

  const addImageFromUrl = () => {
    const url = window.prompt('Enter image URL:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      editor.chain().focus().setImage({ src: base64 }).run();
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const getCurrentHeading = () => {
    for (let i = 1; i <= 6; i++) {
      if (editor.isActive('heading', { level: i })) return String(i);
    }
    return 'paragraph';
  };

  const setHeading = (value: string) => {
    if (value === 'paragraph') {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level: parseInt(value) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
    }
  };

  const setFontFamily = (value: string) => {
    if (value === '') {
      editor.chain().focus().unsetFontFamily().run();
    } else {
      editor.chain().focus().setFontFamily(value).run();
    }
  };

  const insertTable = useCallback((rows: number, cols: number) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
  }, [editor]);

  return (
    <div className="flex items-center gap-0.5 p-1.5 border-b bg-muted/30 flex-wrap">
      {/* Heading Selector */}
      <Select value={getCurrentHeading()} onValueChange={setHeading} disabled={disabled}>
        <SelectTrigger className="h-7 w-[110px] text-xs border-0 bg-transparent">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {HEADING_OPTIONS.map(h => (
            <SelectItem key={h.value} value={h.value} className="text-xs">
              {h.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Font Family */}
      <Select
        value={editor.getAttributes('textStyle')?.fontFamily || ''}
        onValueChange={setFontFamily}
        disabled={disabled}
      >
        <SelectTrigger className="h-7 w-[120px] text-xs border-0 bg-transparent">
          <SelectValue placeholder="Font" />
        </SelectTrigger>
        <SelectContent>
          {FONT_FAMILIES.map(f => (
            <SelectItem key={f.value} value={f.value || 'default'} className="text-xs" style={{ fontFamily: f.value || 'inherit' }}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="h-5 mx-0.5" />

      {/* Text Formatting */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} disabled={disabled} title="Bold">
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} disabled={disabled} title="Italic">
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} disabled={disabled} title="Underline">
        <Underline className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} disabled={disabled} title="Strikethrough">
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} disabled={disabled} title="Subscript">
        <Subscript className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} disabled={disabled} title="Superscript">
        <Superscript className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-5 mx-0.5" />

      {/* Text Color */}
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={disabled} title="Text Color">
            <div className="flex flex-col items-center">
              <Type className="h-3 w-3" />
              <div className="h-0.5 w-3 mt-0.5 rounded" style={{ background: editor.getAttributes('textStyle')?.color || '#000' }} />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-10 gap-0.5">
            {COLORS.map(color => (
              <button
                key={color}
                className="w-5 h-5 rounded-sm border border-border hover:ring-2 hover:ring-ring/30 transition-shadow"
                style={{ background: color }}
                onClick={() => editor.chain().focus().setColor(color).run()}
                title={color}
              />
            ))}
          </div>
          <Button variant="ghost" size="sm" className="w-full mt-1 text-xs h-6" onClick={() => editor.chain().focus().unsetColor().run()}>
            Remove Color
          </Button>
        </PopoverContent>
      </Popover>

      {/* Highlight */}
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={disabled} title="Highlight">
            <Highlighter className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-6 gap-0.5">
            {['#FFFF00', '#00FF00', '#00FFFF', '#FF00FF', '#FF9900', '#FF0000', '#FCE5CD', '#D9EAD3', '#CFE2F3', '#D9D2E9', '#EAD1DC', '#F4CCCC'].map(color => (
              <button
                key={color}
                className="w-5 h-5 rounded-sm border border-border hover:ring-2 hover:ring-ring/30 transition-shadow"
                style={{ background: color }}
                onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
                title={color}
              />
            ))}
          </div>
          <Button variant="ghost" size="sm" className="w-full mt-1 text-xs h-6" onClick={() => editor.chain().focus().unsetHighlight().run()}>
            Remove Highlight
          </Button>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-5 mx-0.5" />

      {/* Alignment */}
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} disabled={disabled} title="Align Left">
        <AlignLeft className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} disabled={disabled} title="Align Center">
        <AlignCenter className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} disabled={disabled} title="Align Right">
        <AlignRight className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} disabled={disabled} title="Justify">
        <AlignJustify className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-5 mx-0.5" />

      {/* Lists */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} disabled={disabled} title="Bullet List">
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} disabled={disabled} title="Numbered List">
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <Separator orientation="vertical" className="h-5 mx-0.5" />

      {/* Blockquote & Code & HR */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} disabled={disabled} title="Quote">
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} disabled={disabled} title="Code Block">
        <Code className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} disabled={disabled} title="Horizontal Rule">
        <Minus className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-5 mx-0.5" />

      {/* Link */}
      <ToolbarButton onClick={addLink} active={editor.isActive('link')} disabled={disabled} title="Link">
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      {editor.isActive('link') && (
        <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} disabled={disabled} title="Remove Link">
          <Unlink className="h-3.5 w-3.5" />
        </ToolbarButton>
      )}

      {/* Image */}
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={disabled} title="Insert Image">
            <ImageIcon className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-2" align="start">
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={addImage}>
            <Upload className="h-3 w-3 mr-1.5" /> From Computer
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={addImageFromUrl}>
            <LinkIcon className="h-3 w-3 mr-1.5" /> From URL
          </Button>
        </PopoverContent>
      </Popover>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      <Separator orientation="vertical" className="h-5 mx-0.5" />

      {/* Table */}
      <Popover open={showTableMenu} onOpenChange={setShowTableMenu}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className={`h-7 w-7 p-0 ${editor.isActive('table') ? 'bg-accent text-accent-foreground' : ''}`} disabled={disabled} title="Table">
            <TableIcon className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {editor.isActive('table') ? (
            <div className="p-2 space-y-1 min-w-[180px]">
              <p className="text-xs font-medium text-muted-foreground px-1 mb-1">Table Actions</p>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={() => editor.chain().focus().addColumnAfter().run()}>
                <ArrowRight className="h-3 w-3 mr-1.5" /> Add Column After
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={() => editor.chain().focus().addColumnBefore().run()}>
                <ArrowLeft className="h-3 w-3 mr-1.5" /> Add Column Before
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={() => editor.chain().focus().addRowAfter().run()}>
                <ArrowDown className="h-3 w-3 mr-1.5" /> Add Row After
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={() => editor.chain().focus().addRowBefore().run()}>
                <ArrowUp className="h-3 w-3 mr-1.5" /> Add Row Before
              </Button>
              <Separator className="my-1" />
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={() => editor.chain().focus().deleteColumn().run()}>
                <Columns className="h-3 w-3 mr-1.5" /> Delete Column
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7" onClick={() => editor.chain().focus().deleteRow().run()}>
                <RowsIcon className="h-3 w-3 mr-1.5" /> Delete Row
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-7 text-destructive" onClick={() => { editor.chain().focus().deleteTable().run(); setShowTableMenu(false); }}>
                <Trash2 className="h-3 w-3 mr-1.5" /> Delete Table
              </Button>
            </div>
          ) : (
            <TableGridPicker
              onSelect={insertTable}
              onClose={() => setShowTableMenu(false)}
            />
          )}
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-5 mx-0.5" />

      {/* Undo/Redo */}
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo() || disabled} title="Undo">
        <Undo className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo() || disabled} title="Redo">
        <Redo className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

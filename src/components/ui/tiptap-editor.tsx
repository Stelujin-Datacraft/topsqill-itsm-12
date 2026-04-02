import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import UnderlineExtension from '@tiptap/extension-underline';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import FontFamily from '@tiptap/extension-font-family';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TiptapToolbar } from './tiptap-toolbar';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function TiptapEditor({
  content,
  onChange,
  placeholder = 'Enter content...',
  disabled = false,
  className = ''
}: TiptapEditorProps) {
  const isExternalUpdate = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      UnderlineExtension,
      Subscript,
      Superscript,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline cursor-pointer' },
      }),
      Image.configure({
        HTMLAttributes: { class: 'max-w-full h-auto rounded-md' },
        allowBase64: true,
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: 'tiptap-table' },
      }),
      TableRow,
      TableCell,
      TableHeader,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
      FontFamily,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content,
    onUpdate: ({ editor }) => {
      if (!isExternalUpdate.current) {
        onChange(editor.getHTML());
      }
    },
    editable: !disabled,
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      isExternalUpdate.current = true;
      editor.commands.setContent(content, false);
      isExternalUpdate.current = false;
    }
  }, [content, editor]);

  useEffect(() => {
    if (!editor) return;
    const handler = (e: Event) => {
      const text = (e as CustomEvent).detail as string;
      editor.chain().focus().insertContent(text).run();
    };
    window.addEventListener('tiptap-insert-text', handler);
    return () => window.removeEventListener('tiptap-insert-text', handler);
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={`border rounded-md overflow-hidden ${className}`}>
      <TiptapToolbar editor={editor} disabled={disabled} />
      <EditorContent
        editor={editor}
        className="tiptap-content prose prose-sm max-w-none p-4 min-h-[200px] focus-within:outline-none"
      />
    </div>
  );
}

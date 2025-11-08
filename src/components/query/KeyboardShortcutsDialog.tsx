import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const shortcuts = [
    { keys: ['Ctrl', 'Enter'], description: 'Execute query' },
    { keys: ['Ctrl', 'S'], description: 'Save query' },
    { keys: ['Ctrl', 'F'], description: 'Format query' },
    { keys: ['Ctrl', 'K'], description: 'Clear editor' },
    { keys: ['Ctrl', '/'], description: 'Toggle comment' },
    { keys: ['Tab'], description: 'Indent' },
    { keys: ['Shift', 'Tab'], description: 'Outdent' },
    { keys: ['Ctrl', 'D'], description: 'Duplicate line' },
    { keys: ['Ctrl', 'Z'], description: 'Undo' },
    { keys: ['Ctrl', 'Y'], description: 'Redo' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to work more efficiently
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-4">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <span className="text-sm text-muted-foreground">
                {shortcut.description}
              </span>
              <div className="flex gap-1">
                {shortcut.keys.map((key, i) => (
                  <React.Fragment key={i}>
                    <kbd className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded">
                      {key}
                    </kbd>
                    {i < shortcut.keys.length - 1 && (
                      <span className="text-muted-foreground">+</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

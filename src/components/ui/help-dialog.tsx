import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HelpCircle } from 'lucide-react';

interface HelpDialogProps {
  title: string;
  children: React.ReactNode;
  trigger?: React.ReactNode;
}

export function HelpDialog({ title, children, trigger }: HelpDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <HelpCircle className="h-4 w-4 mr-1" />
            Help
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function HelpSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">{title}</h4>
      <div className="text-sm text-muted-foreground space-y-1">
        {children}
      </div>
    </div>
  );
}

export function HelpExample({ title, code, description }: { title: string; code: string; description?: string }) {
  return (
    <div className="space-y-2">
      <h5 className="font-medium text-xs text-muted-foreground">{title}</h5>
      <div className="bg-muted p-3 rounded-md">
        <code className="text-sm font-mono">{code}</code>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

export function HelpBadge({ children }: { children: React.ReactNode }) {
  return <Badge variant="secondary" className="text-xs">{children}</Badge>;
}
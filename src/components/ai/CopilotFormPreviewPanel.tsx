import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormPreview } from '@/components/FormPreview';
import { useFormLoader } from '@/hooks/useFormLoader';
import { Eye, Loader2, X, ExternalLink, RefreshCw } from 'lucide-react';

interface CopilotFormPreviewPanelProps {
  formId: string;
  onClose: () => void;
  onViewForms: () => void;
  onRefresh?: () => void;
}

export function CopilotFormPreviewPanel({
  formId,
  onClose,
  onViewForms,
  onRefresh,
}: CopilotFormPreviewPanelProps) {
  const { form, loading, error } = useFormLoader(formId);

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/20">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Eye className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {form?.name || 'Form preview'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Preview while you keep chatting
            </p>
          </div>
          <Badge variant="secondary" className="hidden shrink-0 text-[10px] sm:inline-flex">
            Preview
          </Badge>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onRefresh && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh} title="Refresh preview">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="outline" size="sm" className="hidden h-8 gap-1.5 sm:inline-flex" onClick={onViewForms}>
            <ExternalLink className="h-3.5 w-3.5" />
            Forms
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} title="Close preview">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
        {loading && (
          <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading preview…
          </div>
        )}
        {!loading && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}
        {!loading && form && (
          <div className="space-y-3">
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Live preview of your form. Submissions are not saved from here.
            </div>
            <FormPreview form={form} showNavigation={false} />
          </div>
        )}
      </div>
    </div>
  );
}

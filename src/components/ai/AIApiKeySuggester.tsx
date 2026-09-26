import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2, Check, Lightbulb, Info, Key } from 'lucide-react';
import { useFormAI } from '@/hooks/useFormAI';
import { toast } from 'sonner';
import {
  API_KEY_PERMISSION_OPTIONS,
  type ApiKeyPermissions,
  type ApiKeyResource,
  type ApiKeySuggestionDraft,
  mergeApiKeySuggestion,
  suggestApiKeyFromPrompt,
} from '@/lib/ai/suggestApiKey';

const EXAMPLE_PROMPTS = [
  'Read-only key for Salesforce to pull submissions and reports',
  'Key that can create submissions and trigger workflows, 100 req/min',
  'Full forms and submissions access for our mobile app, expire in 90 days',
];

export type ApiKeyCreatePrefill = {
  name: string;
  description: string;
  permissions: ApiKeyPermissions;
  rateLimit: number;
  allowedIps: string;
  expiresInDays: string;
};

interface AIApiKeySuggesterProps {
  existingKeyNames?: string[];
  onApply: (draft: ApiKeyCreatePrefill) => void;
  buttonLabel?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  /** When false, only the dialog is rendered (open via controlled props). */
  showTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AIApiKeySuggester({
  existingKeyNames = [],
  onApply,
  buttonLabel = 'AI Suggest',
  variant = 'secondary',
  size = 'default',
  className,
  showTrigger = true,
  open: controlledOpen,
  onOpenChange,
}: AIApiKeySuggesterProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [prompt, setPrompt] = useState('');
  const [draft, setDraft] = useState<ApiKeySuggestionDraft | null>(null);
  const [usedAi, setUsedAi] = useState(false);
  const { suggestApiKey, isLoading } = useFormAI();

  const reset = () => {
    setPrompt('');
    setDraft(null);
    setUsedAi(false);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Describe what this API key should be allowed to do');
      return;
    }

    // Always produce a usable heuristic draft; AI refines when available
    const heuristic = suggestApiKeyFromPrompt(prompt);
    setDraft(heuristic);
    setUsedAi(false);

    const aiResult = await suggestApiKey(prompt.trim(), { existingKeyNames });
    if (aiResult) {
      const merged = mergeApiKeySuggestion(prompt, aiResult as Partial<ApiKeySuggestionDraft>);
      setDraft(merged);
      setUsedAi(true);
      toast.success('API key draft ready');
    } else {
      toast.success('Draft ready from your description (AI unavailable — used local suggest)');
    }
  };

  const handleApply = () => {
    if (!draft) return;
    onApply({
      name: draft.name,
      description: draft.description,
      permissions: draft.permissions,
      rateLimit: draft.rateLimit,
      allowedIps: draft.allowedIps,
      expiresInDays: draft.expiresInDays,
    });
    toast.success('Applied to Create API Key — review and save');
    reset();
    setOpen(false);
  };

  const permissionBadges = (permissions: ApiKeyPermissions) =>
    (Object.keys(API_KEY_PERMISSION_OPTIONS) as ApiKeyResource[])
      .filter((resource) => permissions[resource].length > 0)
      .map((resource) => (
        <div key={resource} className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium capitalize text-foreground/80 w-24 shrink-0">
            {resource}
          </span>
          {permissions[resource].map((action) => (
            <Badge key={`${resource}-${action}`} variant="secondary" className="text-xs">
              {action}
            </Badge>
          ))}
        </div>
      ));

  return (
    <>
      {showTrigger && (
        <Button
          type="button"
          variant={variant}
          size={size}
          className={`gap-2 ${className || ''}`.trim()}
          onClick={() => setOpen(true)}
          data-testid="ai-suggest-api-key-button"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          {buttonLabel}
        </Button>
      )}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Suggest API Key
          </DialogTitle>
          <DialogDescription>
            Describe the integration in plain language. We’ll draft permissions, rate limit, and expiry for you to review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="api-key-ai-prompt">
              What should this key do?
            </label>
            <Textarea
              id="api-key-ai-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Read-only access for Salesforce to sync submissions and reports…"
              className="min-h-[90px]"
            />
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((example) => (
                <Button
                  key={example}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto max-w-full py-1 px-2 text-xs text-muted-foreground hover:text-foreground whitespace-normal text-left"
                  onClick={() => setPrompt(example)}
                >
                  <Lightbulb className="h-3 w-3 mr-1 shrink-0" />
                  {example}
                </Button>
              ))}
            </div>
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={() => void handleGenerate()}
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate draft
              </>
            )}
          </Button>

          {draft && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Key className="h-4 w-4 shrink-0" />
                      <span className="truncate">{draft.name}</span>
                    </CardTitle>
                    <CardDescription className="mt-1">{draft.description}</CardDescription>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px] uppercase tracking-wide">
                    {usedAi ? 'AI' : 'Local'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {(draft.summary || draft.explanation) && (
                  <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                    <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      {draft.explanation || draft.summary}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Permissions
                  </p>
                  <div className="space-y-2">{permissionBadges(draft.permissions)}</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm pt-1 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Rate limit</p>
                    <p className="font-medium">{draft.rateLimit} / min</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expires</p>
                    <p className="font-medium">
                      {draft.expiresInDays ? `${draft.expiresInDays} days` : 'Never'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Allowed IPs</p>
                    <p className="font-medium truncate">
                      {draft.allowedIps || 'Any'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleApply} disabled={!draft}>
            <Check className="h-4 w-4 mr-2" />
            Apply to create form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

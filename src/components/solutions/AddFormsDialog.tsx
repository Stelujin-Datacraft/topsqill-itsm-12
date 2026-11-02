import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { solutionColor, type Solution } from '@/lib/solutions/solutionBoard';

interface FormOption {
  id: string;
  name: string;
  description?: string;
}

interface AddFormsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: Solution;
  forms: FormOption[];
  solutions: Solution[];
  formSolutionIds: Map<string, string>;
  onAdd: (formIds: string[]) => Promise<void>;
}

export function AddFormsDialog({ open, onOpenChange, target, forms, solutions, formSolutionIds, onAdd }: AddFormsDialogProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(new Set());
    }
  }, [open]);

  const solutionNames = useMemo(() => new Map(solutions.map((solution) => [solution.id, solution])), [solutions]);
  const candidates = useMemo(() => {
    const term = query.trim().toLowerCase();
    return forms
      .filter((form) => formSolutionIds.get(form.id) !== target.id)
      .filter((form) => !term || form.name.toLowerCase().includes(term))
      .sort((a, b) => {
        const aAssigned = formSolutionIds.has(a.id) ? 1 : 0;
        const bAssigned = formSolutionIds.has(b.id) ? 1 : 0;
        return aAssigned - bAssigned || a.name.localeCompare(b.name);
      });
  }, [forms, formSolutionIds, query, target.id]);

  const moving = [...selected].filter((id) => formSolutionIds.has(id)).length;

  const toggle = (formId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(formId)) next.delete(formId);
      else next.add(formId);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await onAdd([...selected]);
      toast.success(
        t('solutions.formsAdded', '{{count}} form(s) added to {{name}}', { count: selected.size, name: target.name }),
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('solutions.moveFailed', 'Could not move the form.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('solutions.addFormsTitle', 'Add forms to {{name}}', { name: target.name })}</DialogTitle>
          <DialogDescription>
            {t('solutions.addFormsDescription', 'A form belongs to one solution. Forms already in another solution are moved here.')}
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('solutions.searchForms', 'Search forms')}
            className="pl-9"
          />
        </div>
        <ScrollArea className="h-80 rounded-md border">
          {candidates.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {forms.length === 0
                ? t('solutions.noFormsInProject', 'This project has no forms yet.')
                : t('solutions.noMatchingForms', 'No other forms match.')}
            </p>
          ) : (
            <ul className="divide-y">
              {candidates.map((form) => {
                const current = solutionNames.get(formSolutionIds.get(form.id) || '');
                return (
                  <li key={form.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                      <Checkbox checked={selected.has(form.id)} onCheckedChange={() => toggle(form.id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{form.name}</span>
                      </span>
                      {current && (
                        <Badge variant="outline" className="shrink-0 gap-1.5 font-normal">
                          <span className={`h-2 w-2 rounded-full ${solutionColor(current.color).dot}`} />
                          {current.name}
                        </Badge>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {moving > 0
              ? t('solutions.willMove', '{{count}} selected form(s) will move from another solution.', { count: moving })
              : ''}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={() => void handleAdd()} disabled={saving || selected.size === 0}>
              {saving
                ? t('solutions.saving', 'Saving…')
                : t('solutions.addSelected', 'Add {{count}} form(s)', { count: selected.size })}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

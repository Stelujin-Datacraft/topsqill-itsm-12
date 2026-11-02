import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SOLUTION_COLORS, solutionNameError, type Solution } from '@/lib/solutions/solutionBoard';
import type { SolutionInput } from '@/hooks/useSolutions';

interface SolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solution?: Solution | null;
  solutions: Solution[];
  onSave: (input: SolutionInput) => Promise<void>;
}

export function SolutionDialog({ open, onOpenChange, solution, solutions, onSave }: SolutionDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(SOLUTION_COLORS[0].key);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(solution?.name || '');
    setDescription(solution?.description || '');
    setColor(solution?.color || SOLUTION_COLORS[0].key);
    setNameError(null);
  }, [open, solution]);

  const handleSave = async () => {
    const problem = solutionNameError(name, solutions, solution?.id);
    setNameError(problem);
    if (problem) return;
    setSaving(true);
    try {
      await onSave({ name, description, color });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('solutions.saveFailed', 'Could not save the solution.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {solution ? t('solutions.editTitle', 'Edit solution') : t('solutions.createTitle', 'New solution')}
          </DialogTitle>
          <DialogDescription>
            {t('solutions.dialogDescription', 'A solution groups related forms, for example Asset Management or Incident Management.')}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="solution-name">{t('solutions.name', 'Name')}</Label>
            <Input
              id="solution-name"
              value={name}
              autoFocus
              maxLength={120}
              placeholder={t('solutions.namePlaceholder', 'e.g. Asset Management')}
              onChange={(event) => {
                setName(event.target.value);
                if (nameError) setNameError(null);
              }}
              aria-invalid={!!nameError}
            />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="solution-description">{t('solutions.descriptionLabel', 'Description')}</Label>
            <Textarea
              id="solution-description"
              value={description}
              rows={3}
              placeholder={t('solutions.descriptionPlaceholder', 'What this group of forms is for (optional)')}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('solutions.color', 'Colour')}</Label>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {SOLUTION_COLORS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={color === option.key}
                  aria-label={option.label}
                  title={option.label}
                  onClick={() => setColor(option.key)}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 border-transparent transition-transform',
                    option.dot,
                    color === option.key ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105',
                  )}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('solutions.saving', 'Saving…') : solution ? t('solutions.save', 'Save') : t('solutions.create', 'Create solution')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

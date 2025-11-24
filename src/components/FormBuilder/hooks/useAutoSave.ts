import { useEffect, useRef, useState } from 'react';
import { useFormsData } from '@/hooks/useFormsData';
import { FormSnapshot } from './useFormSnapshot';
import { toast } from 'sonner';

interface UseAutoSaveOptions {
  snapshot: FormSnapshot;
  enabled: boolean;
  debounceMs?: number;
}

export function useAutoSave({ snapshot, enabled, debounceMs = 2000 }: UseAutoSaveOptions) {
  const { updateForm } = useFormsData();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedRef = useRef<number>(typeof snapshot.lastSaved === 'number' ? snapshot.lastSaved : Date.now());

  useEffect(() => {
    // Don't auto-save if disabled, not dirty, or form doesn't exist yet
    if (!enabled || !snapshot.isDirty || !snapshot.form?.id) {
      return;
    }

    const currentLastSaved = typeof snapshot.lastSaved === 'number' ? snapshot.lastSaved : Date.now();
    
    // Don't auto-save if already saved recently
    if (currentLastSaved === lastSavedRef.current) {
      return;
    }

    // Clear any pending save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Schedule auto-save
    timeoutRef.current = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        
        await updateForm(snapshot.form.id, {
          name: snapshot.form.name,
          description: snapshot.form.description,
          pages: snapshot.form.pages,
          layout: snapshot.form.layout,
          fieldRules: snapshot.form.fieldRules,
          formRules: snapshot.form.formRules,
          status: snapshot.form.status === 'active' ? 'active' : 'draft', // Keep active if already active, otherwise draft
        });

        lastSavedRef.current = Date.now();
        setSaveStatus('saved');
        
        // Reset to idle after 2 seconds
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveStatus('error');
        toast.error('Failed to auto-save changes');
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [snapshot.isDirty, snapshot.form, snapshot.lastSaved, enabled, debounceMs, updateForm]);

  return { saveStatus };
}

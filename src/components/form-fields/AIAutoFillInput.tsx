import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Loader2 } from 'lucide-react';
import { useFormAI } from '@/hooks/useFormAI';
import { FormField } from '@/types/form';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface AIAutoFillInputProps {
  formFields: FormField[];
  currentValues: Record<string, any>;
  formName?: string;
  formDescription?: string;
  onAutoFill: (values: Record<string, any>) => void;
}

export function AIAutoFillInput({
  formFields,
  currentValues,
  formName,
  formDescription,
  onAutoFill
}: AIAutoFillInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const { autoFillForm, isLoading } = useFormAI();

  const handleAutoFill = async () => {
    if (!input.trim()) {
      toast.error('Please enter a description');
      return;
    }

    const result = await autoFillForm(
      formFields,
      currentValues,
      input,
      formName,
      formDescription
    );

    if (result && typeof result === 'object') {
      const filledCount = Object.keys(result).length;
      if (filledCount > 0) {
        onAutoFill(result);
        toast.success(`AI filled ${filledCount} field(s)`);
        setInput('');
        setIsOpen(false);
      } else {
        toast.info('No fields could be filled from your input');
      }
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          type="button"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          AI Auto-Fill
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm mb-1">Smart Auto-Fill</h4>
            <p className="text-xs text-muted-foreground">
              Describe what you need and AI will fill the relevant fields
            </p>
          </div>
          <Input
            placeholder="e.g., Laptop broken, need IT support urgently"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isLoading) {
                handleAutoFill();
              }
            }}
          />
          <Button
            onClick={handleAutoFill}
            disabled={isLoading || !input.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Auto-Fill Fields
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

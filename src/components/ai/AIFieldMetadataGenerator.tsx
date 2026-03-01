import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Check, RefreshCw } from 'lucide-react';
import { useFormAI } from '@/hooks/useFormAI';
import { FormField } from '@/types/form';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface FieldMetadata {
  fieldId: string;
  placeholder: string | null;
  tooltip: string;
  helpText: string | null;
}

interface AIFieldMetadataGeneratorProps {
  formFields: FormField[];
  formName?: string;
  formDescription?: string;
  onApply: (updates: Array<{ fieldId: string; updates: Partial<FormField> }>) => void;
  buttonVariant?: 'default' | 'outline' | 'ghost' | 'secondary';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
}

export function AIFieldMetadataGenerator({
  formFields,
  formName,
  formDescription,
  onApply,
  buttonVariant = 'outline',
  buttonSize = 'sm'
}: AIFieldMetadataGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<FieldMetadata[]>([]);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const { generateFieldMetadata, isLoading } = useFormAI();

  const handleGenerate = async () => {
    if (formFields.length === 0) {
      toast.error('No fields to generate metadata for');
      return;
    }

    const result = await generateFieldMetadata(formFields, { formName, formDescription });

    if (result?.fields) {
      setSuggestions(result.fields);
      setSelectedFields(new Set(result.fields.map((f: FieldMetadata) => f.fieldId)));
      toast.success(`Generated suggestions for ${result.fields.length} fields`);
    }
  };

  const handleApply = () => {
    const updates = suggestions
      .filter(s => selectedFields.has(s.fieldId))
      .map(s => ({
        fieldId: s.fieldId,
        updates: {
          ...(s.placeholder ? { placeholder: s.placeholder } : {}),
          ...(s.tooltip ? { tooltip: s.tooltip } : {}),
        } as Partial<FormField>
      }));

    if (updates.length > 0) {
      onApply(updates);
      toast.success(`Updated ${updates.length} field(s)`);
      setIsOpen(false);
      setSuggestions([]);
    }
  };

  const toggleField = (fieldId: string) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  };

  const getFieldLabel = (fieldId: string) => {
    return formFields.find(f => f.id === fieldId)?.label || fieldId;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) { setSuggestions([]); } }}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize} className="gap-2" type="button">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Descriptions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Field Description Generator
          </DialogTitle>
          <DialogDescription>
            Auto-generate tooltips, placeholders, and help text for your form fields.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {formFields.length} field(s) in "{formName || 'Form'}"
            </p>
            <Button
              onClick={handleGenerate}
              disabled={isLoading || formFields.length === 0}
              size="sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : suggestions.length > 0 ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate All
                </>
              )}
            </Button>
          </div>

          {suggestions.length > 0 && (
            <>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.fieldId}
                      className={`p-3 border rounded-lg space-y-2 transition-colors ${
                        selectedFields.has(suggestion.fieldId) 
                          ? 'border-primary/50 bg-primary/5' 
                          : 'opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedFields.has(suggestion.fieldId)}
                          onCheckedChange={() => toggleField(suggestion.fieldId)}
                        />
                        <Label className="font-medium text-sm cursor-pointer" onClick={() => toggleField(suggestion.fieldId)}>
                          {getFieldLabel(suggestion.fieldId)}
                        </Label>
                      </div>
                      
                      {suggestion.placeholder && (
                        <div className="ml-6">
                          <span className="text-xs text-muted-foreground">Placeholder:</span>
                          <p className="text-sm text-foreground">{suggestion.placeholder}</p>
                        </div>
                      )}
                      
                      {suggestion.tooltip && (
                        <div className="ml-6">
                          <span className="text-xs text-muted-foreground">Tooltip:</span>
                          <p className="text-sm text-foreground">{suggestion.tooltip}</p>
                        </div>
                      )}

                      {suggestion.helpText && (
                        <div className="ml-6">
                          <span className="text-xs text-muted-foreground">Help text:</span>
                          <p className="text-sm text-foreground">{suggestion.helpText}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  if (selectedFields.size === suggestions.length) {
                    setSelectedFields(new Set());
                  } else {
                    setSelectedFields(new Set(suggestions.map(s => s.fieldId)));
                  }
                }} className="flex-1">
                  {selectedFields.size === suggestions.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button onClick={handleApply} disabled={selectedFields.size === 0} className="flex-1">
                  <Check className="h-4 w-4 mr-2" />
                  Apply {selectedFields.size} Field(s)
                </Button>
              </div>
            </>
          )}

          {!suggestions.length && !isLoading && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Click "Generate All" to auto-generate descriptions for your fields</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

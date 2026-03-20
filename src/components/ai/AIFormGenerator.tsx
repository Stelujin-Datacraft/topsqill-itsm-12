import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, Check, FileText, Wand2 } from 'lucide-react';
import { useFormAI } from '@/hooks/useFormAI';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GeneratedField {
  type: string;
  label: string;
  required: boolean;
  placeholder?: string;
  tooltip?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: Record<string, any>;
  defaultValue?: string;
  isFullWidth?: boolean;
}

interface GeneratedForm {
  name: string;
  description: string;
  fields: GeneratedField[];
  pages?: Array<{ name: string; description?: string; fieldIndexes: number[] }>;
  suggestedLayout?: 1 | 2 | 3;
  estimatedCompletionTime?: string;
}

interface AIFormGeneratorProps {
  onApply: (form: GeneratedForm) => void;
  buttonLabel?: string;
  buttonVariant?: 'default' | 'outline' | 'ghost' | 'secondary';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
}

const industries = [
  'General',
  'Healthcare',
  'Finance',
  'Technology',
  'Education',
  'Government',
  'Retail',
  'Manufacturing',
  'Non-profit',
  'Legal',
  'Real Estate',
  'Human Resources'
];

const fieldTypeIcons: Record<string, string> = {
  text: '📝',
  textarea: '📄',
  number: '🔢',
  email: '📧',
  phone: '📞',
  date: '📅',
  select: '📋',
  checkbox: '☑️',
  radio: '🔘',
  file: '📎',
  signature: '✍️',
  rating: '⭐'
};

export function AIFormGenerator({
  onApply,
  buttonLabel = 'Generate Form with AI',
  buttonVariant = 'default',
  buttonSize = 'default'
}: AIFormGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [purpose, setPurpose] = useState('');
  const [industry, setIndustry] = useState('General');
  const [generatedForm, setGeneratedForm] = useState<GeneratedForm | null>(null);
  const { generateForm, isLoading } = useFormAI();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please describe the form you want to create');
      return;
    }

    const result = await generateForm(prompt, {
      formPurpose: purpose || undefined,
      industry: industry !== 'General' ? industry : undefined
    });

    if (result) {
      setGeneratedForm(result);
      toast.success('Form schema generated!');
    }
  };

  const handleApply = () => {
    if (generatedForm) {
      // Ensure fields is always an array before passing to parent
      const safeForm = {
        ...generatedForm,
        fields: Array.isArray(generatedForm.fields) ? generatedForm.fields : [],
      };
      onApply(safeForm);
      setIsOpen(false);
      resetForm();
      toast.success('Form schema applied');
    }
  };

  const resetForm = () => {
    setGeneratedForm(null);
    setPrompt('');
    setPurpose('');
    setIndustry('General');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize} className="gap-2">
          <Wand2 className="h-4 w-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Form Generator
          </DialogTitle>
          <DialogDescription>
            Describe the form you need and AI will generate a complete form schema.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Input Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Describe your form</Label>
              <Textarea
                placeholder="e.g., An employee onboarding form that collects personal information, emergency contacts, tax details, and IT equipment preferences..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Purpose (optional)</Label>
              <Input
                placeholder="e.g., Streamline new hire onboarding process"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((ind) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Form...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Form Schema
                </>
              )}
            </Button>
          </div>

          {/* Right: Preview */}
          <div className="space-y-4">
            {generatedForm ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {generatedForm.name}
                    </span>
                    <div className="flex gap-1">
                      {generatedForm.suggestedLayout && (
                        <Badge variant="secondary">{generatedForm.suggestedLayout} col</Badge>
                      )}
                      {generatedForm.estimatedCompletionTime && (
                        <Badge variant="outline">{generatedForm.estimatedCompletionTime}</Badge>
                      )}
                    </div>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{generatedForm.description}</p>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        {generatedForm.fields.length} fields generated
                      </Label>
                      {generatedForm.fields.map((field, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 border rounded-md text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span>{fieldTypeIcons[field.type] || '📝'}</span>
                            <span>{field.label}</span>
                          </div>
                          <div className="flex gap-1">
                            <Badge variant="outline" className="text-xs">{field.type}</Badge>
                            {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed rounded-lg p-8">
                <div className="text-center text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Your generated form will appear here</p>
                </div>
              </div>
            )}

            {generatedForm && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleGenerate} disabled={isLoading} className="flex-1">
                  Regenerate
                </Button>
                <Button onClick={handleApply} className="flex-1">
                  <Check className="h-4 w-4 mr-2" />
                  Apply Form
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

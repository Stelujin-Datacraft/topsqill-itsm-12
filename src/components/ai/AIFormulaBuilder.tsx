import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, Copy, Check, Code, Database, AlertTriangle } from 'lucide-react';
import { useFormAI } from '@/hooks/useFormAI';
import { useForm } from '@/contexts/FormContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FormFieldInfo {
  id: string;
  label: string;
  type: string;
}

interface AIFormulaBuilderProps {
  availableFields?: Array<{ id: string; label: string; type: string }>;
  onApply: (result: {
    formula?: string;
    query?: string;
    type: string;
    explanation: string;
  }) => void;
  /** 
   * The type of formula to generate:
   * - 'calculated_field': For form field calculations (used in Form Builder)
   * - 'sql_query': For report queries (used in Query Builder)
   */
  formulaType: 'calculated_field' | 'sql_query';
  buttonLabel?: string;
  buttonVariant?: 'default' | 'outline' | 'ghost' | 'secondary';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
}

export function AIFormulaBuilder({
  availableFields: propFields,
  onApply,
  formulaType,
  buttonLabel,
  buttonVariant = 'outline',
  buttonSize = 'sm',
}: AIFormulaBuilderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [selectedFormName, setSelectedFormName] = useState<string>('');
  const [formFields, setFormFields] = useState<FormFieldInfo[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [result, setResult] = useState<{
    formula?: string;
    query?: string;
    explanation: string;
    type?: string;
    fieldReferences?: string[];
    resultType?: string;
    examples?: Array<{ inputs: Record<string, any>; output: string }>;
    parameters?: string[];
    warnings?: string[];
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const { generateFormula, isLoading } = useFormAI();
  const { forms } = useForm();

  // Determine if this is SQL query mode (needs form selector)
  const isSqlMode = formulaType === 'sql_query';
  
  // Use provided fields or fields from selected form
  const availableFields = propFields || formFields;

  // Determine labels based on type
  const config = {
    calculated_field: {
      icon: <Code className="h-4 w-4" />,
      title: 'AI Calculated Field',
      description: 'Describe the calculation you want in plain English.',
      buttonLabel: buttonLabel || 'AI Formula',
      placeholder: 'e.g., "Calculate the total price by multiplying quantity and unit price"',
      generateLabel: 'Generate Formula',
      resultLabel: 'Generated Formula'
    },
    sql_query: {
      icon: <Database className="h-4 w-4" />,
      title: 'AI Query Builder',
      description: 'Describe what data you want to retrieve or aggregate.',
      buttonLabel: buttonLabel || 'AI Query',
      placeholder: 'e.g., "Show all records where status is pending, ordered by date"',
      generateLabel: 'Generate Query',
      resultLabel: 'Generated Query'
    }
  }[formulaType];

  // Load form fields when a form is selected (SQL mode only)
  useEffect(() => {
    if (!isSqlMode) return;
    
    const loadFormFields = async () => {
      if (!selectedFormId) {
        setFormFields([]);
        return;
      }

      setLoadingFields(true);
      try {
        const { data, error } = await supabase
          .from('form_fields')
          .select('id, label, field_type')
          .eq('form_id', selectedFormId)
          .order('field_order');

        if (error) throw error;
        
        setFormFields((data || []).map(f => ({
          id: f.id,
          label: f.label,
          type: f.field_type
        })));
      } catch (error) {
        console.error('Error loading form fields:', error);
        toast.error('Failed to load form fields');
      } finally {
        setLoadingFields(false);
      }
    };

    loadFormFields();
  }, [selectedFormId, isSqlMode]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a description');
      return;
    }

    if (isSqlMode && !selectedFormId) {
      toast.error('Please select a form first');
      return;
    }

    const response = await generateFormula(prompt, formulaType, availableFields, {
      selectedFormId,
      selectedFormName
    });

    if (response) {
      setResult(response);
    }
  };

  const handleCopy = async () => {
    const content = result?.formula || result?.query;
    if (content) {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied to clipboard');
    }
  };

  const handleApply = () => {
    if (result) {
      onApply({
        formula: result.formula,
        query: result.query,
        type: formulaType,
        explanation: result.explanation
      });
      setIsOpen(false);
      setResult(null);
      setPrompt('');
      toast.success(isSqlMode ? 'Query applied' : 'Formula applied');
    }
  };

  const getFormulaContent = () => {
    return result?.formula || result?.query || '';
  };

  const handleFormChange = (formId: string) => {
    setSelectedFormId(formId);
    const form = forms.find(f => f.id === formId);
    setSelectedFormName(form?.name || '');
    setResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize} className="gap-2">
          <Sparkles className="h-4 w-4 text-purple-600" />
          {config.buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {config.title}
          </DialogTitle>
          <DialogDescription>
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Form Selection (SQL mode only) */}
          {isSqlMode && (
            <div className="space-y-2">
              <Label>Select Form to Query</Label>
              <Select value={selectedFormId} onValueChange={handleFormChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a form..." />
                </SelectTrigger>
                <SelectContent>
                  {forms.map((form) => (
                    <SelectItem key={form.id} value={form.id}>
                      {form.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedFormId && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Select a form to provide field context for the AI
                </p>
              )}
            </div>
          )}

          {/* Available Fields */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">
              {loadingFields ? 'Loading fields...' : `Available fields (${availableFields.length}):`}
            </Label>
            <div className="flex flex-wrap gap-1 max-h-20 overflow-auto">
              {availableFields.length === 0 && !loadingFields && (
                <span className="text-xs text-muted-foreground">
                  {isSqlMode ? 'Select a form to see available fields' : 'No fields available'}
                </span>
              )}
              {availableFields.map((field) => (
                <Badge key={field.id} variant="secondary" className="text-xs">
                  {field.label} ({field.type})
                </Badge>
              ))}
            </div>
          </div>

          {/* Prompt Input */}
          <div className="space-y-2">
            <Label>Describe what you want:</Label>
            <Textarea
              placeholder={config.placeholder}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim() || (isSqlMode && !selectedFormId)}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {config.generateLabel}
              </>
            )}
          </Button>

          {/* Result */}
          {result && (
            <ScrollArea className="max-h-[250px]">
              <div className="space-y-4">
                {/* Formula/Query */}
                <Card>
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {config.icon}
                        {config.resultLabel}
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={handleCopy}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="py-0 pb-3">
                    <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto font-mono whitespace-pre-wrap">
                      {getFormulaContent()}
                    </pre>
                  </CardContent>
                </Card>

                {/* Explanation */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Explanation</CardTitle>
                  </CardHeader>
                  <CardContent className="py-0 pb-3">
                    <p className="text-sm text-muted-foreground">{result.explanation}</p>
                  </CardContent>
                </Card>

                {/* Field References */}
                {result.fieldReferences && result.fieldReferences.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm">Referenced Fields:</Label>
                    <div className="flex flex-wrap gap-1">
                      {result.fieldReferences.map((fieldId) => {
                        const field = availableFields.find(f => f.id === fieldId);
                        return (
                          <Badge key={fieldId} variant="outline" className="text-xs">
                            {field?.label || fieldId}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Result Type (for calculated fields) */}
                {result.resultType && (
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Result Type:</Label>
                    <Badge variant="secondary">{result.resultType}</Badge>
                  </div>
                )}

                {/* Examples */}
                {result.examples && result.examples.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Examples</CardTitle>
                    </CardHeader>
                    <CardContent className="py-0 pb-3">
                      <div className="space-y-2">
                        {result.examples.map((example, index) => (
                          <div key={index} className="text-sm bg-muted p-2 rounded">
                            <span className="text-muted-foreground">Inputs:</span>{' '}
                            {JSON.stringify(example.inputs)} →{' '}
                            <span className="font-medium">{example.output}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Warnings */}
                {result.warnings && result.warnings.length > 0 && (
                  <Card className="border-yellow-500/50">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-yellow-600">
                        <AlertTriangle className="h-4 w-4" />
                        Warnings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-0 pb-3">
                      <ul className="list-disc list-inside text-sm text-yellow-600 space-y-1">
                        {result.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Apply Button */}
          {result && (
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleApply}>
                Apply {isSqlMode ? 'Query' : 'Formula'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

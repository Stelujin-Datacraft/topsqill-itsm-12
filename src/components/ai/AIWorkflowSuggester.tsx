import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, Check, GitBranch, ArrowRight, Lightbulb, Plus, X } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface CrossRefConfig {
  targetFormId: string;
  targetFormName: string;
  targetFormFields?: Array<{ id: string; label: string; type: string; options?: Array<{ id: string; value: string; label: string }> }>;
}

interface WorkflowFormField {
  id: string;
  label: string;
  type: string;
  options?: Array<{ id: string; value: string; label: string }>;
  crossRefConfig?: CrossRefConfig;
}

interface WorkflowFormOption {
  id: string;
  name: string;
  fields?: WorkflowFormField[];
}

interface WorkflowNode {
  type: string;
  label: string;
  description?: string;
  config: Record<string, any>;
  connections?: Array<{ to: string; condition?: string }>;
}

interface WorkflowSuggestion {
  name: string;
  description: string;
  nodes: WorkflowNode[];
  suggestions?: string[];
  estimatedDuration?: string;
}

interface AIWorkflowSuggesterProps {
  onApply: (workflow: WorkflowSuggestion) => void;
  availableForms?: WorkflowFormOption[];
  existingNodes?: Array<{ id: string; type: string; label: string }>;
  buttonLabel?: string;
  buttonVariant?: 'default' | 'outline' | 'ghost' | 'secondary';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
}

const nodeTypeColors: Record<string, string> = {
  start: 'bg-green-100 border-green-300 text-green-800',
  end: 'bg-red-100 border-red-300 text-red-800',
  'form-assignment': 'bg-blue-100 border-blue-300 text-blue-800',
  notification: 'bg-purple-100 border-purple-300 text-purple-800',
  condition: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  wait: 'bg-orange-100 border-orange-300 text-orange-800',
  action: 'bg-cyan-100 border-cyan-300 text-cyan-800',
  approval: 'bg-pink-100 border-pink-300 text-pink-800'
};

const nodeTypeIcons: Record<string, string> = {
  start: '▶️',
  end: '⏹️',
  'form-assignment': '📝',
  notification: '📧',
  condition: '🔀',
  wait: '⏳',
  action: '⚡',
  approval: '✅'
};

const fieldTypeIcons: Record<string, string> = {
  text: '📝',
  number: '🔢',
  email: 'ⓔ',
  select: '📋',
  radio: '🔘',
  checkbox: '☑️',
  date: '📅',
  textarea: '📄',
  file: '📎',
  toggle: '🔀',
  'cross-reference': '🔗',
  'child-cross-reference': '🔗',
};

export function AIWorkflowSuggester({
  onApply,
  availableForms = [],
  existingNodes = [],
  buttonLabel = 'AI Suggest Workflow',
  buttonVariant = 'outline',
  buttonSize = 'sm'
}: AIWorkflowSuggesterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [goal, setGoal] = useState('');
  const [selectedForms, setSelectedForms] = useState<WorkflowFormOption[]>([]);
  const [triggerFormId, setTriggerFormId] = useState<string>('');
  const [suggestion, setSuggestion] = useState<WorkflowSuggestion | null>(null);
  const { suggestWorkflow, isLoading } = useFormAI();

  const triggerForm = selectedForms.find(f => f.id === triggerFormId) || selectedForms[0];

  const handleAddForm = (formId: string) => {
    if (!formId || selectedForms.some(f => f.id === formId)) return;
    const form = availableForms.find(f => f.id === formId);
    if (!form) return;

    // Collect linked cross-reference target forms so AI has them in context immediately.
    const linkedIds = new Set<string>();
    (form.fields || []).forEach(f => {
      const tId = f.crossRefConfig?.targetFormId;
      if (tId && tId !== form.id) linkedIds.add(tId);
    });

    const linkedForms = availableForms.filter(
      af => linkedIds.has(af.id) && !selectedForms.some(sf => sf.id === af.id) && af.id !== form.id
    );

    const updated = [...selectedForms, form, ...linkedForms];
    setSelectedForms(updated);
    // Auto-set trigger form to first added (the parent, not the auto-linked ones)
    if (selectedForms.length === 0) {
      setTriggerFormId(form.id);
    }
    if (linkedForms.length > 0) {
      toast.success(
        `Added "${form.name}" + ${linkedForms.length} linked form${linkedForms.length > 1 ? 's' : ''} (${linkedForms.map(l => l.name).join(', ')})`
      );
    }
  };

  const handleRemoveForm = (formId: string) => {
    const updated = selectedForms.filter(f => f.id !== formId);
    setSelectedForms(updated);
    if (triggerFormId === formId) {
      setTriggerFormId(updated[0]?.id || '');
    }
  };

  const handleGenerate = async () => {
    if (!goal.trim()) {
      toast.error('Please describe your workflow goal');
      return;
    }

    // Build rich context from selected forms
    const formsContext = selectedForms.map(form => ({
      id: form.id,
      name: form.name,
      fields: (form.fields || []).map(f => ({
        id: f.id,
        label: f.label,
        type: f.type,
        options: f.options,
        ...(f.crossRefConfig ? {
          crossRefConfig: {
            targetFormId: f.crossRefConfig.targetFormId,
            targetFormName: f.crossRefConfig.targetFormName,
            targetFormFields: f.crossRefConfig.targetFormFields
          }
        } : {})
      }))
    }));

    const result = await suggestWorkflow(goal, {
      triggerForm: triggerForm ? {
        id: triggerForm.id,
        name: triggerForm.name,
        fields: triggerForm.fields || []
      } : undefined,
      existingNodes: existingNodes.length > 0 ? existingNodes : undefined,
      additionalForms: formsContext.filter(f => f.id !== triggerForm?.id),
    });

    if (result) {
      setSuggestion(result);
      toast.success('Workflow suggestion generated!');
    }
  };

  const handleApply = () => {
    if (suggestion) {
      onApply(suggestion);
      setIsOpen(false);
      resetForm();
      toast.success('Workflow suggestion applied');
    }
  };

  const resetForm = () => {
    setSuggestion(null);
    setGoal('');
    setSelectedForms([]);
    setTriggerFormId('');
  };

  const unselectedForms = availableForms.filter(
    f => !selectedForms.some(sf => sf.id === f.id)
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize} className="gap-2">
          <Sparkles className="h-4 w-4 text-module-workflows" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-module-workflows" />
            AI Workflow Suggester
          </DialogTitle>
          <DialogDescription>
            Select forms to give AI full context of your fields and values for precise workflow creation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Input */}
          <div className="space-y-4">
            {/* Form Selection */}
            {availableForms.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Plus className="h-3 w-3" />
                  Select Forms for Context
                </Label>
                <Select value="" onValueChange={handleAddForm}>
                  <SelectTrigger>
                    <SelectValue placeholder={
                      unselectedForms.length === 0 
                        ? "All forms selected" 
                        : `Add form (${availableForms.length} available)`
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {unselectedForms.map((form) => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.name} ({form.fields?.length || 0} fields)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Selected Forms with Fields Preview */}
                {selectedForms.length > 0 && (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    <Accordion type="multiple" className="w-full">
                      {selectedForms.map((form) => (
                        <AccordionItem key={form.id} value={form.id} className="border rounded-md px-2 mb-1">
                          <div className="flex items-center justify-between">
                            <AccordionTrigger className="py-2 text-sm hover:no-underline flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{form.name}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {form.fields?.length || 0} fields
                                </Badge>
                                {triggerFormId === form.id && (
                                  <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                                    Trigger
                                  </Badge>
                                )}
                              </div>
                            </AccordionTrigger>
                            <div className="flex items-center gap-1 ml-2">
                              {triggerFormId !== form.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs px-2"
                                  onClick={(e) => { e.stopPropagation(); setTriggerFormId(form.id); }}
                                >
                                  Set Trigger
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); handleRemoveForm(form.id); }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <AccordionContent className="pb-2">
                            <div className="grid grid-cols-2 gap-1">
                              {(form.fields || []).map((field) => (
                                <div key={field.id} className="text-xs text-muted-foreground p-1 bg-muted/50 rounded">
                                  <div className="flex items-center gap-1">
                                    <span>{fieldTypeIcons[field.type] || '📦'}</span>
                                    <span className="truncate">{field.label}</span>
                                    {field.options && field.options.length > 0 && (
                                      <Badge variant="outline" className="text-[10px] px-1 ml-auto">
                                        {field.options.length} opts
                                      </Badge>
                                    )}
                                  </div>
                                  {field.crossRefConfig && (
                                    <div className="ml-4 mt-0.5 text-[10px] text-primary/70 flex items-center gap-1">
                                      🔗 → {field.crossRefConfig.targetFormName}
                                      <Badge variant="outline" className="text-[9px] px-1">
                                        {field.crossRefConfig.targetFormFields?.length || 0} fields
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>What do you want to automate?</Label>
              <Textarea
                placeholder={selectedForms.length > 0 
                  ? `e.g., When "${selectedForms[0]?.name}" is submitted, check the priority field. If high, notify the manager via email. Create a follow-up task...`
                  : "e.g., When a new support ticket is submitted, notify the support team..."
                }
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            {existingNodes.length > 0 && (
              <div className="p-3 bg-muted rounded-md">
                <Label className="text-xs text-muted-foreground">
                  Existing workflow has {existingNodes.length} nodes - AI will consider these
                </Label>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={isLoading || !goal.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Workflow...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Workflow
                  {selectedForms.length > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {selectedForms.length} form{selectedForms.length > 1 ? 's' : ''} context
                    </Badge>
                  )}
                </>
              )}
            </Button>

            {selectedForms.length === 0 && availableForms.length > 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <Lightbulb className="h-3 w-3" />
                Tip: Select forms above for AI to use exact field names and values
              </p>
            )}
          </div>

          {/* Right: Preview */}
          <div className="space-y-4">
            {suggestion ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      {suggestion.name}
                    </span>
                    {suggestion.estimatedDuration && (
                      <Badge variant="outline">{suggestion.estimatedDuration}</Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-2">
                      {suggestion.nodes.map((node, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div
                            className={`flex-1 flex items-center gap-2 p-2 border rounded-md text-sm ${nodeTypeColors[node.type] || 'bg-gray-100'}`}
                          >
                            <span>{nodeTypeIcons[node.type] || '📦'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{node.label}</div>
                              {node.description && (
                                <div className="text-xs opacity-75">{node.description}</div>
                              )}
                              {/* Show config details */}
                              {node.config?.triggerFormName && (
                                <Badge variant="outline" className="text-[10px] mt-1">
                                  Form: {node.config.triggerFormName}
                                </Badge>
                              )}
                              {node.config?.condition?.fieldLabel && (
                                <Badge variant="outline" className="text-[10px] mt-1">
                                  Field: {node.config.condition.fieldLabel} {node.config.condition.operator} {node.config.condition.value}
                                </Badge>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-xs flex-shrink-0">{node.type}</Badge>
                          </div>
                          {index < suggestion.nodes.length - 1 && (
                            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>

                    {suggestion.suggestions && suggestion.suggestions.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <Label className="text-xs flex items-center gap-1">
                          <Lightbulb className="h-3 w-3" />
                          Additional Suggestions
                        </Label>
                        {suggestion.suggestions.map((tip, index) => (
                          <div key={index} className="text-xs text-muted-foreground p-2 bg-muted rounded">
                            {tip}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed rounded-lg p-8">
                <div className="text-center text-muted-foreground">
                  <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Your workflow suggestion will appear here</p>
                  <p className="text-xs mt-1">Select forms → Describe goal → Generate</p>
                </div>
              </div>
            )}

            {suggestion && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleGenerate} disabled={isLoading} className="flex-1">
                  Regenerate
                </Button>
                <Button onClick={handleApply} className="flex-1">
                  <Check className="h-4 w-4 mr-2" />
                  Apply Workflow
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

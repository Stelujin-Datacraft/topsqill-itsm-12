import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, Check, GitBranch, ArrowRight, Lightbulb } from 'lucide-react';
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
  availableForms?: Array<{ id: string; name: string; fields?: Array<{ id: string; label: string; type: string }> }>;
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
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [suggestion, setSuggestion] = useState<WorkflowSuggestion | null>(null);
  const { suggestWorkflow, isLoading } = useFormAI();

  const selectedForm = availableForms.find(f => f.id === selectedFormId);

  const handleGenerate = async () => {
    if (!goal.trim()) {
      toast.error('Please describe your workflow goal');
      return;
    }

    const result = await suggestWorkflow(goal, {
      triggerForm: selectedForm ? {
        id: selectedForm.id,
        name: selectedForm.name,
        fields: selectedForm.fields || []
      } : undefined,
      existingNodes: existingNodes.length > 0 ? existingNodes : undefined
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
    setSelectedFormId('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize} className="gap-2">
          <Sparkles className="h-4 w-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            AI Workflow Suggester
          </DialogTitle>
          <DialogDescription>
            Describe your automation goal and AI will suggest a complete workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Input */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>What do you want to automate?</Label>
              <Textarea
                placeholder="e.g., When a new support ticket is submitted, notify the support team. If priority is high, escalate to manager. Wait for resolution and send satisfaction survey..."
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>

            {availableForms.length > 0 && (
              <div className="space-y-2">
                <Label>Trigger Form (optional)</Label>
                <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a form to trigger workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No specific form</SelectItem>
                    {availableForms.map((form) => (
                      <SelectItem key={form.id} value={form.id}>{form.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
                  Generating Suggestions...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Workflow
                </>
              )}
            </Button>
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
                  <ScrollArea className="h-[250px] pr-4">
                    <div className="space-y-2">
                      {suggestion.nodes.map((node, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div
                            className={`flex-1 flex items-center gap-2 p-2 border rounded-md text-sm ${nodeTypeColors[node.type] || 'bg-gray-100'}`}
                          >
                            <span>{nodeTypeIcons[node.type] || '📦'}</span>
                            <div className="flex-1">
                              <div className="font-medium">{node.label}</div>
                              {node.description && (
                                <div className="text-xs opacity-75">{node.description}</div>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-xs">{node.type}</Badge>
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
                  <p>Your workflow suggestion will appear here</p>
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

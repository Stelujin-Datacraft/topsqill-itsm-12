import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, Check, ArrowRight, AlertTriangle, AlertCircle } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';

interface FieldMapping {
  sourceFieldId: string;
  sourceFieldLabel: string;
  targetFieldId: string;
  targetFieldLabel: string;
  confidence: number;
  transformation?: string;
  transformationDetails?: string;
  reason: string;
}

interface MappingSuggestion {
  mappings: FieldMapping[];
  unmappedSourceFields?: Array<{ fieldId: string; fieldLabel: string; suggestion?: string }>;
  unmappedTargetFields?: Array<{ fieldId: string; fieldLabel: string; required?: boolean; suggestion?: string }>;
  warnings?: string[];
  overallConfidence: number;
}

interface AIFieldMapperProps {
  sourceFields: Array<{ id: string; label: string; type: string }>;
  targetFields: Array<{ id: string; label: string; type: string }>;
  sourceFormName?: string;
  targetFormName?: string;
  onApply: (mappings: FieldMapping[]) => void;
  buttonLabel?: string;
  buttonVariant?: 'default' | 'outline' | 'ghost' | 'secondary';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
}

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return 'text-green-600 bg-green-100';
  if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
  return 'text-orange-600 bg-orange-100';
};

export function AIFieldMapper({
  sourceFields,
  targetFields,
  sourceFormName = 'Source Form',
  targetFormName = 'Target Form',
  onApply,
  buttonLabel = 'AI Suggest Mappings',
  buttonVariant = 'outline',
  buttonSize = 'sm'
}: AIFieldMapperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [additionalContext, setAdditionalContext] = useState('');
  const [suggestion, setSuggestion] = useState<MappingSuggestion | null>(null);
  const { suggestFieldMappings, isLoading } = useFormAI();

  const handleGenerate = async () => {
    if (sourceFields.length === 0 || targetFields.length === 0) {
      toast.error('Both source and target forms must have fields');
      return;
    }

    const result = await suggestFieldMappings(sourceFields, targetFields, {
      sourceFormName,
      targetFormName,
      additionalContext: additionalContext || undefined
    });

    if (result) {
      setSuggestion(result);
      toast.success('Field mappings suggested!');
    }
  };

  const handleApply = () => {
    if (suggestion) {
      onApply(suggestion.mappings);
      setIsOpen(false);
      resetForm();
      toast.success('Field mappings applied');
    }
  };

  const resetForm = () => {
    setSuggestion(null);
    setAdditionalContext('');
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
            <Sparkles className="h-5 w-5 text-primary" />
            AI Field Mapping
          </DialogTitle>
          <DialogDescription>
            AI will analyze your source and target fields and suggest optimal mappings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Field summary */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{sourceFormName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sourceFields.length}</div>
                <div className="text-xs text-muted-foreground">source fields</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{targetFormName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{targetFields.length}</div>
                <div className="text-xs text-muted-foreground">target fields</div>
              </CardContent>
            </Card>
          </div>

          {/* Additional context */}
          <div className="space-y-2">
            <Label>Additional context (optional)</Label>
            <Textarea
              placeholder="e.g., 'Customer Name' in source maps to 'Client Full Name' in target. Date fields should be in YYYY-MM-DD format..."
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isLoading || sourceFields.length === 0 || targetFields.length === 0}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing Fields...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Mappings
              </>
            )}
          </Button>

          {/* Results */}
          {suggestion && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>Suggested Mappings</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Confidence:</span>
                    <Progress value={suggestion.overallConfidence * 100} className="w-24 h-2" />
                    <span className="text-sm font-medium">{Math.round(suggestion.overallConfidence * 100)}%</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  {/* Mappings */}
                  <div className="space-y-2 mb-4">
                    <Label className="text-xs text-muted-foreground">
                      {suggestion.mappings.length} mappings found
                    </Label>
                    {suggestion.mappings.map((mapping, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 border rounded-md text-sm"
                      >
                        <div className="flex-1 truncate">{mapping.sourceFieldLabel}</div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 truncate">{mapping.targetFieldLabel}</div>
                        <Badge className={`text-xs ${getConfidenceColor(mapping.confidence)}`}>
                          {Math.round(mapping.confidence * 100)}%
                        </Badge>
                        {mapping.transformation && (
                          <Badge variant="outline" className="text-xs">{mapping.transformation}</Badge>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Unmapped fields */}
                  {suggestion.unmappedSourceFields && suggestion.unmappedSourceFields.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Unmapped source fields
                      </Label>
                      {suggestion.unmappedSourceFields.map((field, index) => (
                        <div key={index} className="text-xs p-2 bg-muted rounded flex justify-between">
                          <span>{field.fieldLabel}</span>
                          {field.suggestion && (
                            <span className="text-muted-foreground">{field.suggestion}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {suggestion.unmappedTargetFields && suggestion.unmappedTargetFields.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Unmapped target fields
                      </Label>
                      {suggestion.unmappedTargetFields.map((field, index) => (
                        <div key={index} className="text-xs p-2 bg-muted rounded flex justify-between">
                          <span>{field.fieldLabel}</span>
                          {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Warnings */}
                  {suggestion.warnings && suggestion.warnings.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                        Warnings
                      </Label>
                      {suggestion.warnings.map((warning, index) => (
                        <div key={index} className="text-xs p-2 bg-yellow-50 text-yellow-800 rounded">
                          {warning}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          {suggestion && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleGenerate} disabled={isLoading} className="flex-1">
                Regenerate
              </Button>
              <Button onClick={handleApply} className="flex-1">
                <Check className="h-4 w-4 mr-2" />
                Apply Mappings
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Users, FileText, Database, CheckCircle, Plus, Trash2, AlertCircle } from 'lucide-react';
import { 
  ConditionSystemType,
  FormLevelCondition,
  FieldLevelCondition,
  EnhancedCondition,
  ComparisonOperator,
  LogicalOperator,
  ConditionItem
} from '@/types/conditions';
import { useConditionFormData, useFormFields } from '@/hooks/useConditionFormData';
import { Badge } from '@/components/ui/badge';

interface EnhancedConditionBuilderProps {
  value?: EnhancedCondition;
  onChange: (condition: EnhancedCondition) => void;
}

export function EnhancedConditionBuilder({ value, onChange }: EnhancedConditionBuilderProps) {
  const [logicalOperator, setLogicalOperator] = useState<LogicalOperator>(value?.logicalOperator || 'AND');
  const [conditions, setConditions] = useState<ConditionItem[]>(() => {
    // Initialize from existing conditions or create a default one
    if (value?.conditions && value.conditions.length > 0) {
      return value.conditions;
    }
    // Convert single condition to array format
    if (value?.formLevelCondition || value?.fieldLevelCondition) {
      return [{
        id: `condition-${Date.now()}`,
        systemType: value.systemType || 'form_level',
        formLevelCondition: value.formLevelCondition,
        fieldLevelCondition: value.fieldLevelCondition
      }];
    }
    // Default empty condition
    return [{
      id: `condition-${Date.now()}`,
      systemType: 'form_level',
      formLevelCondition: {
        id: `form-level-${Date.now()}`,
        conditionType: 'form_status',
        operator: '==',
        value: 'submitted'
      }
    }];
  });
  
  const { forms, isLoading } = useConditionFormData();

  const validForms = useMemo(() => {
    return forms.filter(form => form.id && form.id.trim() !== '');
  }, [forms]);

  // Update parent whenever conditions or logical operator changes
  const updateParent = useCallback((newConditions: ConditionItem[], newOperator: LogicalOperator) => {
    const updatedCondition: EnhancedCondition = {
      id: value?.id || `enhanced-condition-${Date.now()}`,
      systemType: newConditions[0]?.systemType || 'form_level',
      logicalOperator: newOperator,
      conditions: newConditions,
      // Keep first condition for backward compatibility
      formLevelCondition: newConditions[0]?.formLevelCondition,
      fieldLevelCondition: newConditions[0]?.fieldLevelCondition
    };
    onChange(updatedCondition);
  }, [value?.id, onChange]);

  const handleLogicalOperatorChange = useCallback((op: LogicalOperator) => {
    setLogicalOperator(op);
    updateParent(conditions, op);
  }, [conditions, updateParent]);

  const handleAddCondition = useCallback(() => {
    const newCondition: ConditionItem = {
      id: `condition-${Date.now()}`,
      systemType: 'form_level',
      formLevelCondition: {
        id: `form-level-${Date.now()}`,
        conditionType: 'form_status',
        operator: '==',
        value: 'submitted'
      }
    };
    const newConditions = [...conditions, newCondition];
    setConditions(newConditions);
    updateParent(newConditions, logicalOperator);
  }, [conditions, logicalOperator, updateParent]);

  const handleRemoveCondition = useCallback((conditionId: string) => {
    if (conditions.length <= 1) return; // Keep at least one condition
    const newConditions = conditions.filter(c => c.id !== conditionId);
    setConditions(newConditions);
    updateParent(newConditions, logicalOperator);
  }, [conditions, logicalOperator, updateParent]);

  const handleConditionChange = useCallback((conditionId: string, updatedItem: Partial<ConditionItem>) => {
    const newConditions = conditions.map(c => 
      c.id === conditionId ? { ...c, ...updatedItem } : c
    );
    setConditions(newConditions);
    updateParent(newConditions, logicalOperator);
  }, [conditions, logicalOperator, updateParent]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-muted-foreground">
        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
        Loading forms...
      </div>
    );
  }

  if (validForms.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 text-amber-600 bg-amber-50 rounded-md">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">No forms available. Please create and publish forms first.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Logical Operator Selection - Only show when multiple conditions */}
      {conditions.length > 1 && (
        <div className="flex items-center gap-4 p-3 bg-primary/10 rounded-md border border-primary/20">
          <Label className="text-sm font-medium">Combine conditions with:</Label>
          <Select value={logicalOperator} onValueChange={(v) => handleLogicalOperatorChange(v as LogicalOperator)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">
                <span className="font-medium">AND</span> - All must match
              </SelectItem>
              <SelectItem value="OR">
                <span className="font-medium">OR</span> - Any can match
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Conditions List */}
      <div className="space-y-3">
        {conditions.map((condition, index) => (
          <div key={condition.id} className="relative">
            {/* Logical operator badge between conditions */}
            {index > 0 && (
              <div className="flex items-center justify-center -mt-1 -mb-1 relative z-10">
                <Badge variant="secondary" className="bg-primary text-primary-foreground">
                  {logicalOperator}
                </Badge>
              </div>
            )}
            
            <SingleConditionBuilder
              condition={condition}
              forms={validForms}
              index={index}
              canRemove={conditions.length > 1}
              onChange={(updated) => handleConditionChange(condition.id, updated)}
              onRemove={() => handleRemoveCondition(condition.id)}
            />
          </div>
        ))}
      </div>

      {/* Add Condition Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddCondition}
        className="w-full border-dashed"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Another Condition
      </Button>

      {/* Summary Preview */}
      {conditions.length > 1 && (
        <div className="p-3 bg-muted/50 rounded-md text-sm">
          <strong>Summary:</strong> {conditions.length} conditions combined with <Badge variant="outline">{logicalOperator}</Badge>
        </div>
      )}
    </div>
  );
}

interface SingleConditionBuilderProps {
  condition: ConditionItem;
  forms: any[];
  index: number;
  canRemove: boolean;
  onChange: (updated: Partial<ConditionItem>) => void;
  onRemove: () => void;
}

function SingleConditionBuilder({ condition, forms, index, canRemove, onChange, onRemove }: SingleConditionBuilderProps) {
  const handleSystemTypeChange = (type: ConditionSystemType) => {
    if (type === 'form_level') {
      onChange({
        systemType: type,
        formLevelCondition: {
          id: `form-level-${Date.now()}`,
          conditionType: 'form_status',
          operator: '==',
          value: 'submitted'
        },
        fieldLevelCondition: undefined
      });
    } else {
      onChange({
        systemType: type,
        fieldLevelCondition: {
          id: `field-level-${Date.now()}`,
          formId: '',
          fieldId: '',
          fieldType: 'text',
          operator: '==',
          value: ''
        },
        formLevelCondition: undefined
      });
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
              {index + 1}
            </span>
            Condition {index + 1}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={condition.systemType} onValueChange={(v) => handleSystemTypeChange(v as ConditionSystemType)}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="form_level">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3 w-3" />
                    Form-Level
                  </div>
                </SelectItem>
                <SelectItem value="field_level">
                  <div className="flex items-center gap-2">
                    <Database className="h-3 w-3" />
                    Field-Level
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {canRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4 px-4">
        {condition.systemType === 'form_level' ? (
          <FormLevelConditionBuilder
            condition={condition.formLevelCondition}
            forms={forms}
            onChange={(formLevelCondition) => onChange({ formLevelCondition })}
          />
        ) : (
          <FieldLevelConditionBuilder
            condition={condition.fieldLevelCondition}
            forms={forms}
            onChange={(fieldLevelCondition) => onChange({ fieldLevelCondition })}
          />
        )}
      </CardContent>
    </Card>
  );
}

interface FormLevelConditionBuilderProps {
  condition?: FormLevelCondition;
  forms: any[];
  onChange: (condition: FormLevelCondition) => void;
}

const FormLevelConditionBuilder = React.memo(({ condition, forms, onChange }: FormLevelConditionBuilderProps) => {
  const [selectedForm, setSelectedForm] = useState(condition?.formId || '');
  const [conditionType, setConditionType] = useState<'form_status' | 'form_submission' | 'user_property'>(
    condition?.conditionType || 'form_status'
  );
  const [operator, setOperator] = useState<ComparisonOperator>(condition?.operator || '==');
  const [value, setValue] = useState(condition?.value as string || '');

  // Debounced update to parent
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      const updatedCondition: FormLevelCondition = {
        id: condition?.id || `form-level-${Date.now()}`,
        conditionType,
        operator,
        value,
        formId: selectedForm
      };
      onChange(updatedCondition);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [selectedForm, conditionType, operator, value, condition?.id, onChange]);

  const getConditionTypeOptions = useMemo(() => [
    { value: 'form_status', label: 'Form Status', icon: Settings },
    { value: 'form_submission', label: 'Submission Status', icon: FileText },
    { value: 'user_property', label: 'User Property', icon: Users }
  ], []);

  const getValueOptions = useMemo(() => {
    switch (conditionType) {
      case 'form_status':
        return [
          { value: 'draft', label: 'Draft' },
          { value: 'published', label: 'Published' },
          { value: 'active', label: 'Active' },
          { value: 'submitted', label: 'Submitted' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'archived', label: 'Archived' }
        ];
      case 'form_submission':
        return [
          { value: 'pending', label: 'Pending' },
          { value: 'completed', label: 'Completed' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'in_review', label: 'In Review' },
          { value: 'needs_revision', label: 'Needs Revision' }
        ];
      case 'user_property':
        return [
          { value: 'admin', label: 'Admin' },
          { value: 'user', label: 'User' },
          { value: 'owner', label: 'Owner' },
          { value: 'submitter', label: 'Submitter' },
          { value: 'viewer', label: 'Viewer' }
        ];
      default:
        return [];
    }
  }, [conditionType]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Condition Type */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
          <Select value={conditionType} onValueChange={(v) => setConditionType(v as any)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getConditionTypeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    <opt.icon className="h-3 w-3" />
                    {opt.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Target Form */}
        {(conditionType === 'form_status' || conditionType === 'form_submission') && (
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Form</Label>
            <Select value={selectedForm} onValueChange={setSelectedForm}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select form" />
              </SelectTrigger>
              <SelectContent>
                {forms.map((form) => (
                  <SelectItem key={form.id} value={form.id}>
                    {form.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Operator */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Operator</Label>
          <Select value={operator} onValueChange={(v) => setOperator(v as ComparisonOperator)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="==">Equals</SelectItem>
              <SelectItem value="!=">Not Equals</SelectItem>
              <SelectItem value="contains">Contains</SelectItem>
              <SelectItem value="not_contains">Not Contains</SelectItem>
              <SelectItem value="exists">Exists</SelectItem>
              <SelectItem value="not_exists">Not Exists</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Value */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Value</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              {getValueOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preview */}
      {selectedForm && value && (
        <div className="text-xs bg-muted/50 p-2 rounded flex items-center gap-2">
          <CheckCircle className="h-3 w-3 text-green-600" />
          <span>
            <strong>{forms.find(f => f.id === selectedForm)?.name || 'Form'}</strong>
            {' '}{operator === '==' ? 'is' : operator === '!=' ? 'is not' : operator}{' '}
            <strong>{getValueOptions.find(o => o.value === value)?.label || value}</strong>
          </span>
        </div>
      )}
    </div>
  );
});

interface FieldLevelConditionBuilderProps {
  condition?: FieldLevelCondition;
  forms: any[];
  onChange: (condition: FieldLevelCondition) => void;
}

const FieldLevelConditionBuilder = React.memo(({ condition, forms, onChange }: FieldLevelConditionBuilderProps) => {
  const [selectedForm, setSelectedForm] = useState(condition?.formId || '');
  const [selectedField, setSelectedField] = useState(condition?.fieldId || '');
  const [operator, setOperator] = useState<ComparisonOperator>(condition?.operator || '==');
  const [value, setValue] = useState(condition?.value || '');

  const { fields, loading } = useFormFields(selectedForm);

  // Debounced update to parent
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      const field = fields.find(f => f.id === selectedField);
      const updatedCondition: FieldLevelCondition = {
        id: condition?.id || `field-level-${Date.now()}`,
        formId: selectedForm,
        fieldId: selectedField,
        fieldType: field?.type || 'text',
        operator,
        value
      };
      onChange(updatedCondition);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [selectedForm, selectedField, operator, value, fields, condition?.id, onChange]);

  const selectedFieldData = useMemo(() => 
    fields.find(f => f.id === selectedField), [fields, selectedField]
  );

  const validFields = useMemo(() => 
    fields.filter(field => field.id && field.id.trim() !== ''), [fields]
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Form Selection */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Form</Label>
          <Select value={selectedForm} onValueChange={(v) => {
            setSelectedForm(v);
            setSelectedField('');
          }}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select form" />
            </SelectTrigger>
            <SelectContent>
              {forms.map((form) => (
                <SelectItem key={form.id} value={form.id}>
                  {form.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Field Selection */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Field</Label>
          <Select value={selectedField} onValueChange={setSelectedField} disabled={!selectedForm || loading}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={loading ? "Loading..." : "Select field"} />
            </SelectTrigger>
            <SelectContent>
              {validFields.map((field) => (
                <SelectItem key={field.id} value={field.id}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Operator */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Operator</Label>
          <Select value={operator} onValueChange={(v) => setOperator(v as ComparisonOperator)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="==">Equals</SelectItem>
              <SelectItem value="!=">Not Equals</SelectItem>
              <SelectItem value=">">Greater Than</SelectItem>
              <SelectItem value="<">Less Than</SelectItem>
              <SelectItem value=">=">Greater or Equal</SelectItem>
              <SelectItem value="<=">Less or Equal</SelectItem>
              <SelectItem value="contains">Contains</SelectItem>
              <SelectItem value="not_contains">Not Contains</SelectItem>
              <SelectItem value="exists">Exists</SelectItem>
              <SelectItem value="not_exists">Not Exists</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Value */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Value</Label>
          {selectedFieldData?.options && selectedFieldData.options.length > 0 ? (
            <Select value={value as string} onValueChange={setValue}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select value" />
              </SelectTrigger>
              <SelectContent>
                {selectedFieldData.options.map((opt: any) => (
                  <SelectItem key={opt.id || opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={value as string}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter value"
              className="h-9"
            />
          )}
        </div>
      </div>

      {/* Preview */}
      {selectedForm && selectedField && value && (
        <div className="text-xs bg-muted/50 p-2 rounded flex items-center gap-2">
          <CheckCircle className="h-3 w-3 text-green-600" />
          <span>
            <strong>{selectedFieldData?.label || 'Field'}</strong>
            {' '}{operator}{' '}
            <strong>{value}</strong>
          </span>
        </div>
      )}
    </div>
  );
});

FormLevelConditionBuilder.displayName = 'FormLevelConditionBuilder';
FieldLevelConditionBuilder.displayName = 'FieldLevelConditionBuilder';

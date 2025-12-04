import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
  const [conditions, setConditions] = useState<ConditionItem[]>(() => {
    if (value?.conditions && value.conditions.length > 0) {
      return value.conditions;
    }
    if (value?.formLevelCondition || value?.fieldLevelCondition) {
      return [{
        id: `condition-${Date.now()}`,
        systemType: value.systemType || 'form_level',
        formLevelCondition: value.formLevelCondition,
        fieldLevelCondition: value.fieldLevelCondition,
        logicalOperatorWithNext: 'AND'
      }];
    }
    return [{
      id: `condition-${Date.now()}`,
      systemType: 'form_level',
      formLevelCondition: {
        id: `form-level-${Date.now()}`,
        conditionType: 'form_status',
        operator: '==',
        value: 'submitted'
      },
      logicalOperatorWithNext: 'AND'
    }];
  });
  
  const { forms, isLoading } = useConditionFormData();

  const validForms = useMemo(() => {
    return forms.filter(form => form.id && form.id.trim() !== '');
  }, [forms]);

  const updateParent = useCallback((newConditions: ConditionItem[]) => {
    const updatedCondition: EnhancedCondition = {
      id: value?.id || `enhanced-condition-${Date.now()}`,
      systemType: newConditions[0]?.systemType || 'form_level',
      conditions: newConditions,
      formLevelCondition: newConditions[0]?.formLevelCondition,
      fieldLevelCondition: newConditions[0]?.fieldLevelCondition
    };
    onChange(updatedCondition);
  }, [value?.id, onChange]);

  const handleAddCondition = useCallback(() => {
    const newCondition: ConditionItem = {
      id: `condition-${Date.now()}`,
      systemType: 'form_level',
      formLevelCondition: {
        id: `form-level-${Date.now()}`,
        conditionType: 'form_status',
        operator: '==',
        value: 'submitted'
      },
      logicalOperatorWithNext: 'AND'
    };
    const newConditions = [...conditions, newCondition];
    setConditions(newConditions);
    updateParent(newConditions);
  }, [conditions, updateParent]);

  const handleRemoveCondition = useCallback((conditionId: string) => {
    if (conditions.length <= 1) return;
    const newConditions = conditions.filter(c => c.id !== conditionId);
    setConditions(newConditions);
    updateParent(newConditions);
  }, [conditions, updateParent]);

  const handleConditionChange = useCallback((conditionId: string, updatedItem: Partial<ConditionItem>) => {
    const newConditions = conditions.map(c => 
      c.id === conditionId ? { ...c, ...updatedItem } : c
    );
    setConditions(newConditions);
    updateParent(newConditions);
  }, [conditions, updateParent]);

  const handleLogicalOperatorChange = useCallback((conditionId: string, operator: LogicalOperator) => {
    const newConditions = conditions.map(c => 
      c.id === conditionId ? { ...c, logicalOperatorWithNext: operator } : c
    );
    setConditions(newConditions);
    updateParent(newConditions);
  }, [conditions, updateParent]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 text-muted-foreground">
        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
        Loading forms...
      </div>
    );
  }

  if (validForms.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 text-amber-600 bg-amber-50 rounded-md">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">No forms available. Please create and publish forms first.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conditions.map((condition, index) => (
        <div key={condition.id}>
          <SingleConditionBuilder
            condition={condition}
            forms={validForms}
            index={index}
            canRemove={conditions.length > 1}
            onChange={(updated) => handleConditionChange(condition.id, updated)}
            onRemove={() => handleRemoveCondition(condition.id)}
          />
          
          {/* Per-condition logical operator selector - only show if not last condition */}
          {index < conditions.length - 1 && (
            <div className="flex items-center justify-center py-1">
              <Select 
                value={condition.logicalOperatorWithNext || 'AND'} 
                onValueChange={(v) => handleLogicalOperatorChange(condition.id, v as LogicalOperator)}
              >
                <SelectTrigger className="w-24 h-7 text-xs font-medium bg-primary/10 border-primary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">AND</SelectItem>
                  <SelectItem value="OR">OR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddCondition}
        className="w-full border-dashed h-8 text-xs"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Condition
      </Button>
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
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="h-5 w-5 flex items-center justify-center p-0 text-xs">
              {index + 1}
            </Badge>
            <Select value={condition.systemType} onValueChange={(v) => handleSystemTypeChange(v as ConditionSystemType)}>
              <SelectTrigger className="w-32 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="form_level">
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Form-Level
                  </div>
                </SelectItem>
                <SelectItem value="field_level">
                  <div className="flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    Field-Level
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3 px-3">
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
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
          <Select value={conditionType} onValueChange={(v) => setConditionType(v as any)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getConditionTypeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-1">
                    <opt.icon className="h-3 w-3" />
                    {opt.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(conditionType === 'form_status' || conditionType === 'form_submission') && (
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Form</Label>
            <Select value={selectedForm} onValueChange={setSelectedForm}>
              <SelectTrigger className="h-8 text-xs">
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

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Operator</Label>
          <Select value={operator} onValueChange={(v) => setOperator(v as ComparisonOperator)}>
            <SelectTrigger className="h-8 text-xs">
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

        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Value</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger className="h-8 text-xs">
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

      {selectedForm && value && (
        <div className="text-xs bg-muted/50 p-2 rounded flex items-center gap-1">
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

  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      const selectedFieldData = fields.find(f => f.id === selectedField);
      const updatedCondition: FieldLevelCondition = {
        id: condition?.id || `field-level-${Date.now()}`,
        formId: selectedForm,
        fieldId: selectedField,
        fieldType: selectedFieldData?.type || 'text',
        operator,
        value
      };
      onChange(updatedCondition);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedForm, selectedField, operator, value, fields, condition?.id, onChange]);

  const selectedFieldData = useMemo(() => {
    return fields.find(f => f.id === selectedField);
  }, [fields, selectedField]);

  // Field types that should show dropdown with options
  const optionFieldTypes = ['select', 'multi-select', 'multiselect', 'radio', 'dropdown', 'checkbox'];
  const isOptionFieldType = selectedFieldData?.type && optionFieldTypes.includes(selectedFieldData.type.toLowerCase());
  const hasOptions = isOptionFieldType && selectedFieldData?.options && selectedFieldData.options.length > 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Form</Label>
          <Select value={selectedForm} onValueChange={(v) => { setSelectedForm(v); setSelectedField(''); }}>
            <SelectTrigger className="h-8 text-xs">
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

        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Field</Label>
          <Select value={selectedField} onValueChange={setSelectedField} disabled={!selectedForm || loading}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={loading ? "Loading..." : "Select field"} />
            </SelectTrigger>
            <SelectContent>
              {fields.map((field) => (
                <SelectItem key={field.id} value={field.id}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Operator</Label>
          <Select value={operator} onValueChange={(v) => setOperator(v as ComparisonOperator)}>
            <SelectTrigger className="h-8 text-xs">
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

        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Value</Label>
          {hasOptions ? (
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger className="h-8 text-xs">
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
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter value"
              className="w-full h-8 px-2 text-xs border border-input rounded-md bg-background"
            />
          )}
        </div>
      </div>

      {selectedForm && selectedField && (
        <div className="text-xs bg-muted/50 p-2 rounded flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-green-600" />
          <span>
            <strong>{selectedFieldData?.label || 'Field'}</strong>
            {' '}{operator === '==' ? 'equals' : operator === '!=' ? 'not equals' : operator}{' '}
            <strong>"{value}"</strong>
          </span>
        </div>
      )}
    </div>
  );
});

FormLevelConditionBuilder.displayName = 'FormLevelConditionBuilder';
FieldLevelConditionBuilder.displayName = 'FieldLevelConditionBuilder';


import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Users, FileText, Database, CheckCircle } from 'lucide-react';
import { 
  ConditionSystemType,
  FormLevelCondition,
  FieldLevelCondition,
  EnhancedCondition,
  ComparisonOperator,
  FormStatusType,
  FormSubmissionStatusType,
  UserPropertyType
} from '@/types/conditions';
import { useConditionFormData, useFormFields } from '@/hooks/useConditionFormData';
import { DynamicValueInput } from './DynamicValueInput';

interface EnhancedConditionBuilderProps {
  value?: EnhancedCondition;
  onChange: (condition: EnhancedCondition) => void;
}

export function EnhancedConditionBuilder({ value, onChange }: EnhancedConditionBuilderProps) {
  const [systemType, setSystemType] = useState<ConditionSystemType>(value?.systemType || 'form_level');
  const { forms, isLoading } = useConditionFormData();

  const handleSystemTypeChange = useCallback((type: ConditionSystemType) => {
    setSystemType(type);
    
    const conditionId = value?.id || `condition-${Date.now()}`;
    const newCondition: EnhancedCondition = {
      id: conditionId,
      systemType: type
    };
    
    if (type === 'form_level') {
      newCondition.formLevelCondition = {
        id: `form-level-${Date.now()}`,
        conditionType: 'form_status',
        operator: '==',
        value: 'submitted'
      };
    } else {
      newCondition.fieldLevelCondition = {
        id: `field-level-${Date.now()}`,
        formId: '',
        fieldId: '',
        fieldType: 'text',
        operator: '==',
        value: ''
      };
    }
    
    onChange(newCondition);
  }, [value?.id, onChange]);

  const handleFormLevelConditionChange = useCallback((formLevelCondition: FormLevelCondition) => {
    const updatedCondition: EnhancedCondition = { 
      id: value?.id || `condition-${Date.now()}`,
      systemType: 'form_level',
      formLevelCondition 
    };
    onChange(updatedCondition);
  }, [value?.id, onChange]);

  const handleFieldLevelConditionChange = useCallback((fieldLevelCondition: FieldLevelCondition) => {
    const updatedCondition: EnhancedCondition = { 
      id: value?.id || `condition-${Date.now()}`,
      systemType: 'field_level',
      fieldLevelCondition 
    };
    onChange(updatedCondition);
  }, [value?.id, onChange]);

  const validForms = useMemo(() => {
    return forms.filter(form => form.id && form.id.trim() !== '');
  }, [forms]);

  if (isLoading) {
    return <div>Loading forms...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">Condition System</Label>
        <p className="text-sm text-gray-600 mb-2">Choose the type of condition you want to create</p>
        <Select value={systemType} onValueChange={(value: string) => handleSystemTypeChange(value as ConditionSystemType)}>
          <SelectTrigger>
            <SelectValue placeholder="Select condition system type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="form_level">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Form-Level Conditions
              </div>
            </SelectItem>
            <SelectItem value="field_level">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Field-Level Conditions
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {systemType === 'form_level' && (
        <FormLevelConditionBuilder
          condition={value?.formLevelCondition}
          forms={validForms}
          onChange={handleFormLevelConditionChange}
        />
      )}

      {systemType === 'field_level' && (
        <FieldLevelConditionBuilder
          condition={value?.fieldLevelCondition}
          forms={validForms}
          onChange={handleFieldLevelConditionChange}
        />
      )}
    </div>
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
    { value: 'form_submission', label: 'Form Submission Status', icon: FileText },
    { value: 'user_property', label: 'User Role/Property', icon: Users }
  ], []);

  const getValueOptions = useMemo(() => {
    switch (conditionType) {
      case 'form_status':
        return [
          { value: 'draft', label: 'Is Draft' },
          { value: 'published', label: 'Is Published' },
          { value: 'submitted', label: 'Is Submitted' },
          { value: 'approved', label: 'Is Approved' },
          { value: 'rejected', label: 'Is Rejected' },
          { value: 'archived', label: 'Is Archived' }
        ];
      case 'form_submission':
        return [
          { value: 'pending', label: 'Is Pending' },
          { value: 'completed', label: 'Is Completed' },
          { value: 'approved', label: 'Is Approved' },
          { value: 'rejected', label: 'Is Rejected' },
          { value: 'in_review', label: 'Is In Review' }
        ];
      case 'user_property':
        return [
          { value: 'admin', label: 'Is Admin' },
          { value: 'user', label: 'Is User' },
          { value: 'moderator', label: 'Is Moderator' },
          { value: 'viewer', label: 'Is Viewer' }
        ];
      default:
        return [];
    }
  }, [conditionType]);

  const selectedFormName = useMemo(() => 
    forms.find(f => f.id === selectedForm)?.name, [forms, selectedForm]
  );
  
  const selectedValueLabel = useMemo(() => 
    getValueOptions.find(opt => opt.value === value)?.label, [getValueOptions, value]
  );

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-600" />
          Form-Level Condition Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1: Select Condition Type */}
        <div>
          <Label className="flex items-center gap-2 mb-2">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span>
            Condition Type
          </Label>
          <Select value={conditionType} onValueChange={(value: string) => setConditionType(value as 'form_status' | 'form_submission' | 'user_property')}>
            <SelectTrigger>
              <SelectValue placeholder="Select condition type" />
            </SelectTrigger>
            <SelectContent>
              {getConditionTypeOptions.map((option) => {
                const IconComponent = option.icon;
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-4 w-4" />
                      {option.label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Step 2: Select Target Form (for form_status and form_submission) */}
        {(conditionType === 'form_status' || conditionType === 'form_submission') && (
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span>
              Target Form
            </Label>
            <Select value={selectedForm} onValueChange={setSelectedForm}>
              <SelectTrigger>
                <SelectValue placeholder="Select a form to check" />
              </SelectTrigger>
              <SelectContent>
                {forms.length > 0 ? (
                  forms.map((form) => (
                    <SelectItem key={form.id} value={form.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {form.name}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-forms" disabled>No forms available</SelectItem>
                )}
              </SelectContent>
            </Select>
            {forms.length === 0 && (
              <p className="text-xs text-red-500 mt-1">No published forms found. Please ensure you have published forms available.</p>
            )}
          </div>
        )}

        {/* Step 3: Select Operator */}
        <div>
          <Label className="flex items-center gap-2 mb-2">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span>
            Operator
          </Label>
          <Select value={operator} onValueChange={(value: string) => setOperator(value as ComparisonOperator)}>
            <SelectTrigger>
              <SelectValue placeholder="Select operator" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="==">Equals (Is)</SelectItem>
              <SelectItem value="!=">Not Equals (Is Not)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Step 4: Select Condition Value */}
        <div>
          <Label className="flex items-center gap-2 mb-2">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">4</span>
            Condition Value
          </Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue placeholder="Select condition" />
            </SelectTrigger>
            <SelectContent>
              {getValueOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Configuration Preview */}
        {selectedForm && value && (
          <div className="text-xs text-green-700 bg-green-50 p-3 rounded border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4" />
              <strong>Configuration Preview:</strong>
            </div>
            <div className="pl-6">
              <strong>Form:</strong> {selectedFormName || 'Selected form'}<br/>
              <strong>Condition:</strong> {operator === '==' ? 'is' : 'is not'} {selectedValueLabel || value}<br/>
              <strong>Type:</strong> {getConditionTypeOptions.find(opt => opt.value === conditionType)?.label}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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

  const selectedFormName = useMemo(() => 
    forms.find(f => f.id === selectedForm)?.name, [forms, selectedForm]
  );
  
  const selectedFieldData = useMemo(() => 
    fields.find(f => f.id === selectedField), [fields, selectedField]
  );

  const validFields = useMemo(() => 
    fields.filter(field => field.id && field.id.trim() !== ''), [fields]
  );

  return (
    <Card className="border-purple-200 bg-purple-50/30">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Database className="h-4 w-4 text-purple-600" />
          Field-Level Condition Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1: Select Target Form */}
        <div>
          <Label className="flex items-center gap-2 mb-2">
            <span className="bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">1</span>
            Target Form
          </Label>
          <Select value={selectedForm} onValueChange={(value: string) => {
            setSelectedForm(value);
            setSelectedField(''); // Reset field when form changes
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select a form" />
            </SelectTrigger>
            <SelectContent>
              {forms.length > 0 ? (
                forms.map((form) => (
                  <SelectItem key={form.id} value={form.id}>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {form.name}
                    </div>
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-forms" disabled>No forms available</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Step 2: Select Target Field */}
        {selectedForm && (
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <span className="bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">2</span>
              Target Field
            </Label>
            <Select value={selectedField} onValueChange={setSelectedField} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Loading fields..." : "Select a field"} />
              </SelectTrigger>
              <SelectContent>
                {validFields.length > 0 ? (
                  validFields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        {field.label} ({field.type})
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-fields" disabled>
                    {loading ? "Loading fields..." : "No fields found"}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Step 3: Select Comparison Operator */}
        {selectedField && (
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <span className="bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">3</span>
              Comparison Operator
            </Label>
            <Select value={operator} onValueChange={(value: string) => setOperator(value as ComparisonOperator)}>
              <SelectTrigger>
                <SelectValue placeholder="Select operator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="==">Equals</SelectItem>
                <SelectItem value="!=">Not Equals</SelectItem>
                <SelectItem value="<">Less Than</SelectItem>
                <SelectItem value=">">Greater Than</SelectItem>
                <SelectItem value="<=">Less Than or Equal</SelectItem>
                <SelectItem value=">=">Greater Than or Equal</SelectItem>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="not_contains">Does Not Contain</SelectItem>
                <SelectItem value="starts_with">Starts With</SelectItem>
                <SelectItem value="ends_with">Ends With</SelectItem>
                <SelectItem value="in">In List</SelectItem>
                <SelectItem value="not_in">Not In List</SelectItem>
                <SelectItem value="exists">Field Has Value</SelectItem>
                <SelectItem value="not_exists">Field Is Empty</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Step 4: Set Comparison Value */}
        {selectedFieldData && operator && !['exists', 'not_exists'].includes(operator) && (
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <span className="bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">4</span>
              Comparison Value
            </Label>
            <DynamicValueInput
              field={selectedFieldData}
              value={value}
              onChange={setValue}
            />
          </div>
        )}

        {/* Configuration Preview */}
        {selectedForm && selectedField && operator && (
          <div className="text-xs text-green-700 bg-green-50 p-3 rounded border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4" />
              <strong>Configuration Preview:</strong>
            </div>
            <div className="pl-6">
              <strong>Form:</strong> {selectedFormName}<br/>
              <strong>Field:</strong> {selectedFieldData?.label || 'selected field'} ({selectedFieldData?.type})<br/>
              <strong>Condition:</strong> {
                operator === '==' ? 'equals' :
                operator === '!=' ? 'does not equal' :
                operator === 'contains' ? 'contains' :
                operator === 'not_contains' ? 'does not contain' :
                operator === 'exists' ? 'has a value' :
                operator === 'not_exists' ? 'is empty' :
                operator
              } {!['exists', 'not_exists'].includes(operator) ? `"${value}"` : ''}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

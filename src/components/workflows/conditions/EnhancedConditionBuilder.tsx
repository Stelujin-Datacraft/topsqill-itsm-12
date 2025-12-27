import React, { useState, useCallback, useMemo, useEffect, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Settings, Users, FileText, Database, CheckCircle, Plus, Trash2, AlertCircle, Star, Calendar, Clock, Globe, X, Code, ListTree } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import axios from 'axios';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useGroups } from '@/hooks/useGroups';
import { LogicalExpressionInput } from './LogicalExpressionInput';
import { ExpressionEvaluator } from '@/utils/expressionEvaluator';

// Phone country codes
const PHONE_COUNTRY_CODES = [
  { code: '+1', country: 'US', name: 'United States' },
  { code: '+1', country: 'CA', name: 'Canada' },
  { code: '+44', country: 'GB', name: 'United Kingdom' },
  { code: '+33', country: 'FR', name: 'France' },
  { code: '+49', country: 'DE', name: 'Germany' },
  { code: '+81', country: 'JP', name: 'Japan' },
  { code: '+61', country: 'AU', name: 'Australia' },
  { code: '+55', country: 'BR', name: 'Brazil' },
  { code: '+91', country: 'IN', name: 'India' },
  { code: '+86', country: 'CN', name: 'China' },
];

// Currency list
const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
];

// Country type for country field
interface Country {
  name: string;
  code: string;
  flag: string;
}

// Hook to fetch countries
const useCountries = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await axios.get('https://restcountries.com/v3.1/all?fields=name,flags,cca2');
        const data = response.data.map((country: any) => ({
          name: country.name?.common || '',
          code: country.cca2 || '',
          flag: country.flags?.svg || country.flags?.png || ''
        }));
        setCountries(data.sort((a: Country, b: Country) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error('Error fetching countries:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCountries();
  }, []);

  return { countries, loading };
};

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
      systemType: 'field_level',
      fieldCondition: {
        id: `field-${Date.now()}`,
        fieldId: '',
        operator: '==',
        value: ''
      },
      logicalOperatorWithNext: 'AND'
    }];
  });
  
  const [useManualExpression, setUseManualExpression] = useState(value?.useManualExpression || false);
  const [manualExpression, setManualExpression] = useState(value?.manualExpression || '');
  
  const { forms, isLoading } = useConditionFormData();

  const validForms = useMemo(() => {
    return forms.filter(form => form.id && form.id.trim() !== '');
  }, [forms]);

  // Generate condition labels for the expression input
  const conditionLabels = useMemo(() => {
    return conditions.map((c, i) => {
      if (c.systemType === 'form_level') {
        const type = c.formLevelCondition?.conditionType || 'form_status';
        const val = c.formLevelCondition?.value || '';
        return `${type}: ${val}`;
      } else {
        const fieldId = c.fieldLevelCondition?.fieldId || '';
        return `field: ${fieldId.substring(0, 8)}...`;
      }
    });
  }, [conditions]);

  const updateParent = useCallback((newConditions: ConditionItem[], newUseManual?: boolean, newExpression?: string) => {
    const updatedCondition: EnhancedCondition = {
      id: value?.id || `enhanced-condition-${Date.now()}`,
      systemType: newConditions[0]?.systemType || 'form_level',
      conditions: newConditions,
      formLevelCondition: newConditions[0]?.formLevelCondition,
      fieldLevelCondition: newConditions[0]?.fieldLevelCondition,
      useManualExpression: newUseManual !== undefined ? newUseManual : useManualExpression,
      manualExpression: newExpression !== undefined ? newExpression : manualExpression
    };
    onChange(updatedCondition);
  }, [value?.id, onChange, useManualExpression, manualExpression]);

  const handleToggleManualMode = useCallback((checked: boolean) => {
    setUseManualExpression(checked);
    if (checked && !manualExpression) {
      // Generate default expression from current conditions
      const defaultExpr = ExpressionEvaluator.generateDefaultExpression(conditions.length, 'AND');
      setManualExpression(defaultExpr);
      updateParent(conditions, checked, defaultExpr);
    } else {
      updateParent(conditions, checked, manualExpression);
    }
  }, [conditions, manualExpression, updateParent]);

  const handleExpressionChange = useCallback((expression: string) => {
    setManualExpression(expression);
    updateParent(conditions, useManualExpression, expression);
  }, [conditions, useManualExpression, updateParent]);

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
    
    // Auto-update expression if in manual mode
    if (useManualExpression) {
      const newExpr = manualExpression 
        ? `${manualExpression} AND ${newConditions.length}` 
        : ExpressionEvaluator.generateDefaultExpression(newConditions.length, 'AND');
      setManualExpression(newExpr);
      updateParent(newConditions, useManualExpression, newExpr);
    } else {
      updateParent(newConditions);
    }
  }, [conditions, updateParent, useManualExpression, manualExpression]);

  const handleRemoveCondition = useCallback((conditionId: string) => {
    if (conditions.length <= 1) return;
    const removedIndex = conditions.findIndex(c => c.id === conditionId);
    const newConditions = conditions.filter(c => c.id !== conditionId);
    setConditions(newConditions);
    
    // Update expression if in manual mode - remove the deleted condition number
    if (useManualExpression && removedIndex !== -1) {
      // Renumber conditions in expression
      let newExpr = manualExpression;
      const removedNum = removedIndex + 1;
      
      // Remove references to the deleted condition
      newExpr = newExpr.replace(new RegExp(`\\b${removedNum}\\b`, 'g'), '');
      
      // Renumber higher conditions
      for (let i = conditions.length; i > removedNum; i--) {
        newExpr = newExpr.replace(new RegExp(`\\b${i}\\b`, 'g'), String(i - 1));
      }
      
      // Clean up any double operators or orphaned parentheses
      newExpr = newExpr
        .replace(/\s+/g, ' ')
        .replace(/AND\s+AND/gi, 'AND')
        .replace(/OR\s+OR/gi, 'OR')
        .replace(/AND\s+OR/gi, 'OR')
        .replace(/OR\s+AND/gi, 'AND')
        .replace(/\(\s*\)/g, '')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .trim();
      
      // If expression becomes invalid or empty, regenerate
      const validation = ExpressionEvaluator.validate(newExpr);
      if (!newExpr || !validation.valid) {
        newExpr = ExpressionEvaluator.generateDefaultExpression(newConditions.length, 'AND');
      }
      
      setManualExpression(newExpr);
      updateParent(newConditions, useManualExpression, newExpr);
    } else {
      updateParent(newConditions);
    }
  }, [conditions, updateParent, useManualExpression, manualExpression]);

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
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md border border-border/50">
        <div className="flex items-center gap-2">
          {useManualExpression ? (
            <Code className="h-4 w-4 text-primary" />
          ) : (
            <ListTree className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-xs font-medium">
            {useManualExpression ? 'Manual Expression Mode' : 'Visual Builder Mode'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="expression-mode" className="text-xs text-muted-foreground">
            Use manual expression
          </Label>
          <Switch
            id="expression-mode"
            checked={useManualExpression}
            onCheckedChange={handleToggleManualMode}
            className="scale-75"
          />
        </div>
      </div>

      {/* Conditions List */}
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
          
          {/* Per-condition logical operator selector - only show if not last condition AND not in manual mode */}
          {index < conditions.length - 1 && !useManualExpression && (
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

      {/* Manual Expression Input */}
      {useManualExpression && conditions.length > 1 && (
        <LogicalExpressionInput
          value={manualExpression}
          onChange={handleExpressionChange}
          conditionCount={conditions.length}
          conditionLabels={conditionLabels}
        />
      )}

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
            {/* Form Level hidden - Field Level is the only option */}
            <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
              <Database className="h-3 w-3" />
              Field-Level
            </div>
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

  // Use ref to store latest onChange to avoid infinite loops
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      const updatedCondition: FormLevelCondition = {
        id: condition?.id || `form-level-${Date.now()}`,
        conditionType,
        operator,
        value,
        formId: selectedForm
      };
      onChangeRef.current(updatedCondition);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedForm, conditionType, operator, value, condition?.id]);

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

// Specialized Value Input Component for different field types
interface FieldValueInputProps {
  fieldType: string;
  value: string;
  onChange: (value: string) => void;
  valueOptions: Array<{ value: string; label: string }> | null;
  selectedFieldData?: any;
}

const FieldValueInput = React.memo(({ fieldType, value, onChange, valueOptions, selectedFieldData }: FieldValueInputProps) => {
  const normalizedType = (fieldType || '').toLowerCase().replace(/[_\s]/g, '-');
  const { countries, loading: countriesLoading } = useCountries();
  const { users: orgUsers, loading: usersLoading } = useOrganizationUsers();
  const { groups: orgGroups, loading: groupsLoading } = useGroups();
  
  // State for tag input (must be at top level)
  const [tagInput, setTagInput] = useState('');
  
  // Parse phone value at top level
  const [phoneCountryCode, phoneNumber] = useMemo(() => {
    if (!value) return ['+1', ''];
    if (value.includes(' ')) {
      const parts = value.split(' ');
      return [parts[0], parts.slice(1).join(' ')];
    }
    return ['+1', value];
  }, [value]);
  
  // Parse tags at top level
  const tags = useMemo(() => {
    if (!value) return [];
    try {
      return Array.isArray(value) ? value : JSON.parse(value);
    } catch {
      return value ? value.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
    }
  }, [value]);
  
  // Parse multi-select values at top level
  const selectedMultiValues = useMemo(() => {
    if (!value) return [];
    try {
      return Array.isArray(value) ? value : JSON.parse(value);
    } catch {
      return value ? [value] : [];
    }
  }, [value]);
  
  // Parse currency value at top level
  const [currencyCode, currencyAmount] = useMemo(() => {
    if (!value) return ['USD', ''];
    try {
      const parsed = JSON.parse(value);
      return [parsed.currency || 'USD', String(parsed.amount || '')];
    } catch {
      return ['USD', value];
    }
  }, [value]);
  
  // Determine slider config
  const sliderConfig = useMemo(() => {
    if (normalizedType === 'slider' || normalizedType === 'range') {
      const config = selectedFieldData as any;
      return {
        min: Number(config?.validation?.min ?? config?.custom_config?.min ?? 0),
        max: Number(config?.validation?.max ?? config?.custom_config?.max ?? 100),
        step: Number(config?.validation?.step ?? config?.custom_config?.step ?? 1)
      };
    }
    return null;
  }, [normalizedType, selectedFieldData]);

  // Determine rating config
  const ratingConfig = useMemo(() => {
    if (normalizedType === 'rating' || normalizedType === 'star-rating' || normalizedType === 'starrating') {
      const config = selectedFieldData as any;
      return {
        max: Number(config?.custom_config?.maxRating ?? config?.validation?.max ?? 5)
      };
    }
    return null;
  }, [normalizedType, selectedFieldData]);

  const hasValueOptions = Array.isArray(valueOptions) && valueOptions.length > 0;

  // Get submission access config from field - uses allowedUsers and allowedGroups arrays of IDs
  const submissionAccessOptions = useMemo(() => {
    if (normalizedType === 'submission-access' || normalizedType === 'submissionaccess') {
      const config = selectedFieldData?.custom_config || {};
      const users: Array<{ value: string; label: string }> = [];
      const groups: Array<{ value: string; label: string }> = [];
      
      // Extract configured users from allowedUsers (array of user IDs)
      const allowedUserIds = config.allowedUsers || [];
      if (Array.isArray(allowedUserIds) && allowedUserIds.length > 0 && orgUsers) {
        allowedUserIds.forEach((userId: string) => {
          const user = orgUsers.find(u => u.id === userId);
          if (user) {
            const label = `${user.first_name || ''} ${user.last_name || ''} (${user.email})`.trim();
            users.push({ value: `user:${user.email}`, label });
          }
        });
      }
      
      // Extract configured groups from allowedGroups (array of group IDs)
      const allowedGroupIds = config.allowedGroups || [];
      if (Array.isArray(allowedGroupIds) && allowedGroupIds.length > 0 && orgGroups) {
        allowedGroupIds.forEach((groupId: string) => {
          const group = orgGroups.find(g => g.id === groupId);
          if (group) {
            groups.push({ value: `group:${group.name}`, label: `Group: ${group.name}` });
          }
        });
      }
      
      // If no specific users/groups configured, show all org users and groups
      if (users.length === 0 && groups.length === 0) {
        orgUsers?.forEach(user => {
          const label = `${user.first_name || ''} ${user.last_name || ''} (${user.email})`.trim();
          users.push({ value: `user:${user.email}`, label });
        });
        orgGroups?.forEach(group => {
          groups.push({ value: `group:${group.name}`, label: `Group: ${group.name}` });
        });
      }
      
      return { users, groups, hasConfig: users.length > 0 || groups.length > 0 };
    }
    return { users: [], groups: [], hasConfig: false };
  }, [normalizedType, selectedFieldData, orgUsers, orgGroups]);

  // Render specialized input based on field type
  const renderInput = () => {
    // Date field - date picker
    if (normalizedType === 'date') {
      return (
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs"
        />
      );
    }

    // Time field - time picker
    if (normalizedType === 'time') {
      return (
        <Input
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs"
        />
      );
    }

    // DateTime field - datetime picker
    if (normalizedType === 'datetime' || normalizedType === 'date-time' || normalizedType === 'datetime-local') {
      return (
        <Input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs"
        />
      );
    }

    // Phone number field with country code selector
    if (normalizedType === 'phone' || normalizedType === 'phonenumber' || normalizedType === 'phone-number' || normalizedType === 'tel') {
      return (
        <div className="flex gap-1">
          <Select 
            value={phoneCountryCode} 
            onValueChange={(code) => onChange(phoneNumber ? `${code} ${phoneNumber}` : code)}
          >
            <SelectTrigger className="h-8 text-xs w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHONE_COUNTRY_CODES.map((c, idx) => (
                <SelectItem key={`${c.code}-${c.country}-${idx}`} value={c.code}>
                  {c.code} {c.country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="tel"
            value={phoneNumber}
            onChange={(e) => onChange(`${phoneCountryCode} ${e.target.value}`)}
            placeholder="Phone number"
            className="h-8 text-xs flex-1"
          />
        </div>
      );
    }

    // Toggle/Switch field - toggle switch
    if (normalizedType === 'toggle' || normalizedType === 'switch' || normalizedType === 'toggle-switch') {
      const isOn = value === 'true' || value === 'on' || value === 'yes' || value === '1';
      return (
        <div className="flex items-center gap-3 h-8 px-2 border rounded-md bg-muted/30">
          <Switch
            checked={isOn}
            onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
          />
          <span className="text-xs font-medium">{isOn ? 'On' : 'Off'}</span>
        </div>
      );
    }

    // Slider/Range field - slider
    if (sliderConfig && (normalizedType === 'slider' || normalizedType === 'range')) {
      const numValue = Number(value) || sliderConfig.min;
      return (
        <div className="flex items-center gap-2 h-8">
          <Slider
            value={[numValue]}
            onValueChange={([v]) => onChange(String(v))}
            min={sliderConfig.min}
            max={sliderConfig.max}
            step={sliderConfig.step}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-8 text-right">{numValue}</span>
        </div>
      );
    }

    // Rating field - star rating
    if (ratingConfig && (normalizedType === 'rating' || normalizedType === 'star-rating' || normalizedType === 'starrating')) {
      const numValue = Number(value) || 0;
      return (
        <div className="flex items-center gap-1 h-8">
          {Array.from({ length: ratingConfig.max }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(String(i + 1))}
              className="focus:outline-none"
            >
              <Star
                className={cn(
                  "h-4 w-4 transition-colors",
                  i < numValue ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                )}
              />
            </button>
          ))}
          <span className="text-xs ml-1 text-muted-foreground">{numValue}/{ratingConfig.max}</span>
        </div>
      );
    }

    // Checkbox field - checkboxes (when has options, allow single selection for condition)
    if (normalizedType === 'checkbox') {
      if (hasValueOptions) {
        return (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select option" />
            </SelectTrigger>
            <SelectContent>
              {valueOptions!.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      // Checkbox without options - true/false toggle
      return (
        <div className="flex items-center gap-3 h-8 px-2 border rounded-md bg-muted/30">
          <Checkbox
            checked={value === 'true' || value === 'checked'}
            onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
          />
          <span className="text-xs">{value === 'true' || value === 'checked' ? 'Checked' : 'Unchecked'}</span>
        </div>
      );
    }

    // Country field - country dropdown
    if (normalizedType === 'country') {
      return (
        <Select value={value} onValueChange={onChange} disabled={countriesLoading}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={countriesLoading ? "Loading..." : "Select country"} />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {countries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                <div className="flex items-center gap-2">
                  {country.flag && <img src={country.flag} alt="" className="h-3 w-4 object-cover" />}
                  {country.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Submission access field - show configured users/groups from organization
    if (normalizedType === 'submission-access' || normalizedType === 'submissionaccess') {
      // Show loading state
      if (usersLoading || groupsLoading) {
        return (
          <Select disabled>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Loading..." />
            </SelectTrigger>
          </Select>
        );
      }

      const allOptions = [...submissionAccessOptions.users, ...submissionAccessOptions.groups];
      
      if (allOptions.length > 0) {
        return (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select user or group" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {submissionAccessOptions.users.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Users</div>
                  {submissionAccessOptions.users.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </>
              )}
              {submissionAccessOptions.groups.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-t mt-1 pt-1">Groups</div>
                  {submissionAccessOptions.groups.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        );
      }
      
      // Fallback if no users/groups available
      return (
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter email or group"
          className="h-8 text-xs"
        />
      );
    }

    // Tags field - multiple tag input like form preview
    if (normalizedType === 'tags' || normalizedType === 'tag') {
      const addTag = () => {
        const trimmed = tagInput.trim();
        if (trimmed && !tags.includes(trimmed)) {
          const newTags = [...tags, trimmed];
          onChange(JSON.stringify(newTags));
          setTagInput('');
        }
      };
      
      const removeTag = (index: number) => {
        const newTags = tags.filter((_: string, i: number) => i !== index);
        onChange(JSON.stringify(newTags));
      };
      
      const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          addTag();
        } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
          removeTag(tags.length - 1);
        }
      };
      
      return (
        <div className="space-y-1">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag: string, index: number) => (
                <Badge key={index} variant="secondary" className="px-1.5 py-0.5 text-xs">
                  {tag}
                  <button type="button" onClick={() => removeTag(index)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <Input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addTag}
            placeholder="Type and press Enter"
            className="h-8 text-xs"
          />
        </div>
      );
    }

    // Yes/No field
    if (normalizedType === 'yes-no' || normalizedType === 'yesno') {
      return (
        <div className="flex gap-2 h-8">
          <Button
            type="button"
            variant={value === 'yes' ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs flex-1"
            onClick={() => onChange('yes')}
          >
            Yes
          </Button>
          <Button
            type="button"
            variant={value === 'no' ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs flex-1"
            onClick={() => onChange('no')}
          >
            No
          </Button>
        </div>
      );
    }

    // Multi-select field - allow multiple selections
    if ((normalizedType === 'multi-select' || normalizedType === 'multiselect') && hasValueOptions) {
      const toggleOption = (optValue: string) => {
        const newValues = selectedMultiValues.includes(optValue)
          ? selectedMultiValues.filter((v: string) => v !== optValue)
          : [...selectedMultiValues, optValue];
        onChange(JSON.stringify(newValues));
      };
      
      return (
        <div className="space-y-1 max-h-32 overflow-y-auto border rounded-md p-2 bg-background">
          {valueOptions!.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <Checkbox
                id={`multi-${opt.value}`}
                checked={selectedMultiValues.includes(opt.value)}
                onCheckedChange={() => toggleOption(opt.value)}
              />
              <label htmlFor={`multi-${opt.value}`} className="text-xs cursor-pointer">
                {opt.label}
              </label>
            </div>
          ))}
        </div>
      );
    }

    // Currency field with currency selector
    if (normalizedType === 'currency') {
      return (
        <div className="flex gap-1">
          <Select 
            value={currencyCode} 
            onValueChange={(code) => onChange(JSON.stringify({ currency: code, amount: parseFloat(currencyAmount) || 0 }))}
          >
            <SelectTrigger className="h-8 text-xs w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.symbol} {c.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={currencyAmount}
            onChange={(e) => onChange(JSON.stringify({ currency: currencyCode, amount: parseFloat(e.target.value) || 0 }))}
            placeholder="Amount"
            className="h-8 text-xs flex-1"
          />
        </div>
      );
    }

    // Fields with options (select, radio, dropdown)
    if (hasValueOptions) {
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent>
            {valueOptions!.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Default text input
    return (
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter value"
        className="h-8 text-xs"
      />
    );
  };

  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">Value</Label>
      {renderInput()}
    </div>
  );
});
FieldValueInput.displayName = 'FieldValueInput';

interface FieldLevelConditionBuilderProps {
  condition?: FieldLevelCondition;
  forms: any[];
  onChange: (condition: FieldLevelCondition) => void;
}

const FieldLevelConditionBuilder = React.memo(({ condition, forms, onChange }: FieldLevelConditionBuilderProps) => {
  const [selectedForm, setSelectedForm] = useState(condition?.formId || '');
  const [selectedField, setSelectedField] = useState(condition?.fieldId || '');
  const [operator, setOperator] = useState<ComparisonOperator>(condition?.operator || '==');
  const [value, setValue] = useState(String(condition?.value ?? ''));

  const { fields, loading } = useFormFields(selectedForm);

  // Use ref to store latest onChange to avoid infinite loops
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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
      onChangeRef.current(updatedCondition);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedForm, selectedField, operator, value, fields, condition?.id]);

  const selectedFieldData = useMemo(() => {
    return fields.find(f => f.id === selectedField);
  }, [fields, selectedField]);

  // Generate value options based on field type
  const valueOptions = useMemo((): Array<{ value: string; label: string }> | null => {
    if (!selectedFieldData) {
      return null;
    }
    
    const fieldType = (selectedFieldData.type || '').toLowerCase();
    const fieldOptions = selectedFieldData.options || [];
    
    // Field types with predefined options from the field config
    const optionFieldTypes = ['select', 'multi-select', 'multiselect', 'radio', 'dropdown', 'checkbox'];
    if (optionFieldTypes.includes(fieldType) && fieldOptions.length > 0) {
      return fieldOptions.map((opt: any) => ({
        value: String(opt.value || opt.id || opt.label || opt),
        label: String(opt.label || opt.value || opt.id || opt)
      }));
    }
    
    // Toggle/Switch field - boolean options
    if (fieldType === 'toggle' || fieldType === 'switch') {
      return [
        { value: 'true', label: 'On / Yes / True' },
        { value: 'false', label: 'Off / No / False' }
      ];
    }
    
    // Slider field - generate range options
    if (fieldType === 'slider' || fieldType === 'range') {
      const fieldConfig = selectedFieldData as any;
      const min = Number(fieldConfig.validation?.min ?? fieldConfig.custom_config?.min ?? 0);
      const max = Number(fieldConfig.validation?.max ?? fieldConfig.custom_config?.max ?? 100);
      const step = Number(fieldConfig.validation?.step ?? fieldConfig.custom_config?.step ?? 10);
      const options: Array<{ value: string; label: string }> = [];
      for (let i = min; i <= max; i += step) {
        options.push({ value: String(i), label: String(i) });
      }
      return options;
    }
    
    // Rating field - generate 1-5 or custom range
    if (fieldType === 'rating' || fieldType === 'star-rating' || fieldType === 'starrating') {
      const fieldConfig = selectedFieldData as any;
      const maxRating = Number(fieldConfig.custom_config?.maxRating ?? fieldConfig.validation?.max ?? 5);
      const options: Array<{ value: string; label: string }> = [];
      for (let i = 1; i <= maxRating; i++) {
        options.push({ value: String(i), label: `${i} Star${i > 1 ? 's' : ''}` });
      }
      return options;
    }
    
    // Ranking field - generate position options
    if (fieldType === 'ranking') {
      const itemCount = fieldOptions.length || 5;
      const options: Array<{ value: string; label: string }> = [];
      for (let i = 1; i <= itemCount; i++) {
        options.push({ value: String(i), label: `Position ${i}` });
      }
      return options;
    }
    
    // Yes/No field
    if (fieldType === 'yes-no' || fieldType === 'yesno') {
      return [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' }
      ];
    }
    
    return null;
  }, [selectedFieldData]);

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Form</Label>
        <Select value={selectedForm} onValueChange={(v) => { setSelectedForm(v); setSelectedField(''); setValue(''); }}>
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
        <Select value={selectedField} onValueChange={(v) => { setSelectedField(v); setValue(''); }} disabled={!selectedForm || loading}>
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

      <FieldValueInput 
        fieldType={selectedFieldData?.type || ''}
        value={value}
        onChange={setValue}
        valueOptions={valueOptions}
        selectedFieldData={selectedFieldData}
      />

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

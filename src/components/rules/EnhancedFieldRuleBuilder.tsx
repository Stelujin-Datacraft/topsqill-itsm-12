import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, HelpCircle } from 'lucide-react';
import { FormField } from '@/types/form';
import { FieldRule, FieldRuleAction, FieldOperator, FieldRuleCondition } from '@/types/rules';
import { RuleDynamicValueInput } from './RuleDynamicValueInput';
import { ActionValueInput } from './ActionValueInput';
import { ExpressionEvaluator } from '@/utils/expressionEvaluator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EnhancedFieldRuleBuilderProps {
  fields: FormField[];
  rules: FieldRule[];
  onRulesChange: (rules: FieldRule[]) => void;
}

// Field types that can be used for conditions
const CONDITION_COMPATIBLE_TYPES = [
  'text', 'textarea', 'number', 'email', 'password', 'select', 'radio', 
  'checkbox', 'toggle-switch', 'date', 'time', 'datetime', 'currency',
  'country', 'phone', 'rating', 'slider', 'user-picker'
];

// Operators compatible with different field types
const getCompatibleOperators = (fieldType: string): FieldOperator[] => {
  switch (fieldType) {
    case 'number':
    case 'currency':
    case 'rating':
    case 'slider':
      return ['==', '!=', '<', '>', '<=', '>=', 'isEmpty', 'isNotEmpty'];
    case 'checkbox':
    case 'toggle-switch':
      return ['==', '!='];
    case 'select':
    case 'radio':
    case 'country':
      return ['==', '!=', 'in', 'isEmpty', 'isNotEmpty'];
    case 'text':
    case 'textarea':
    case 'email':
    case 'password':
    case 'phone':
      return ['==', '!=', 'contains', 'not contains', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'];
    case 'date':
    case 'time':
    case 'datetime':
      return ['==', '!=', '<', '>', '<=', '>=', 'isEmpty', 'isNotEmpty'];
    default:
      return ['==', '!=', 'isEmpty', 'isNotEmpty'];
  }
};

const fieldOperators: { value: FieldOperator; label: string }[] = [
  { value: '==', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: '<', label: 'less than' },
  { value: '>', label: 'greater than' },
  { value: '<=', label: 'less than or equal' },
  { value: '>=', label: 'greater than or equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not contains', label: 'does not contain' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'endsWith', label: 'ends with' },
  { value: 'in', label: 'is one of' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
];

const fieldActions: { value: FieldRuleAction; label: string }[] = [
  { value: 'show', label: 'Show Field' },
  { value: 'hide', label: 'Hide Field' },
  { value: 'enable', label: 'Enable Field' },
  { value: 'disable', label: 'Disable Field' },
  { value: 'require', label: 'Make Required' },
  { value: 'optional', label: 'Make Optional' },
  { value: 'setDefault', label: 'Set Default Value' },
  { value: 'clearValue', label: 'Clear Value' },
  { value: 'filterOptions', label: 'Filter Options' },
  // Form-level actions transferred to field rules
  { value: 'redirect', label: 'Redirect' },
  { value: 'lockForm', label: 'Lock Form' },
  { value: 'unlockForm', label: 'Unlock Form' },
  { value: 'showSuccessModal', label: 'Show Success Modal' },
  { value: 'allowSubmit', label: 'Allow Submit' },
  { value: 'preventSubmit', label: 'Prevent Submit' },
  // Hidden actions - kept for backwards compatibility but not shown in UI:
  // { value: 'changeOptions', label: 'Change Field Options' },
  // { value: 'changeLabel', label: 'Change Label' },
  // { value: 'showTooltip', label: 'Show Tooltip' },
  // { value: 'showError', label: 'Show Error' },
];

export function EnhancedFieldRuleBuilder({ fields, rules, onRulesChange }: EnhancedFieldRuleBuilderProps) {
  const [editingRule, setEditingRule] = useState<FieldRule | null>(null);
  const [useFieldComparison, setUseFieldComparison] = useState<Record<string, boolean>>({});
  const [expressionError, setExpressionError] = useState<string>('');

  // Filter fields that can be used for conditions
  const conditionFields = fields.filter(field => 
    CONDITION_COMPATIBLE_TYPES.includes(field.type)
  );

  const createNewRule = (): FieldRule => ({
    id: `rule-${Date.now()}`,
    name: '',
    targetFieldId: '',
    conditions: [{
      id: `condition-${Date.now()}`,
      fieldId: '',
      operator: '==',
      value: '',
    }],
    logicExpression: '1',
    action: 'show',
    isActive: true,
  });

  const addRule = () => {
    const newRule = createNewRule();
    setEditingRule(newRule);
    setUseFieldComparison({});
    setExpressionError('');
  };

  const saveRule = () => {
    if (!editingRule || !editingRule.logicExpression) return;
    
    // Validate expression
    const validation = ExpressionEvaluator.validate(editingRule.logicExpression);
    if (!validation.valid) {
      setExpressionError(validation.error || 'Invalid expression');
      return;
    }
    
    const existingIndex = rules.findIndex(r => r.id === editingRule.id);
    let updatedRules;
    
    if (existingIndex >= 0) {
      updatedRules = [...rules];
      updatedRules[existingIndex] = editingRule;
    } else {
      updatedRules = [...rules, editingRule];
    }
    
    onRulesChange(updatedRules);
    setEditingRule(null);
    setUseFieldComparison({});
    setExpressionError('');
  };

  const deleteRule = (ruleId: string) => {
    onRulesChange(rules.filter(r => r.id !== ruleId));
  };

  const addCondition = () => {
    if (!editingRule || !editingRule.conditions) return;
    
    const newCondition: FieldRuleCondition = {
      id: `condition-${Date.now()}`,
      fieldId: '',
      operator: '==',
      value: '',
    };
    
    const newConditions = [...editingRule.conditions, newCondition];
    setEditingRule({
      ...editingRule,
      conditions: newConditions,
      logicExpression: ExpressionEvaluator.generateDefaultExpression(newConditions.length, 'AND')
    });
    setExpressionError('');
  };

  const updateCondition = (conditionId: string, updates: Partial<FieldRuleCondition>) => {
    if (!editingRule || !editingRule.conditions) return;
    
    setEditingRule({
      ...editingRule,
      conditions: editingRule.conditions.map(c => 
        c.id === conditionId ? { ...c, ...updates } : c
      )
    });
  };

  const removeCondition = (conditionId: string) => {
    if (!editingRule || !editingRule.conditions || editingRule.conditions.length === 1) return;
    
    const newConditions = editingRule.conditions.filter(c => c.id !== conditionId);
    setEditingRule({
      ...editingRule,
      conditions: newConditions,
      logicExpression: ExpressionEvaluator.generateDefaultExpression(newConditions.length, 'AND')
    });

    // Clean up field comparison state
    const updatedComparisons = { ...useFieldComparison };
    delete updatedComparisons[conditionId];
    setUseFieldComparison(updatedComparisons);
    setExpressionError('');
  };

  const getCompatibleFields = (sourceFieldId: string) => {
    const sourceField = fields.find(f => f.id === sourceFieldId);
    if (!sourceField) return [];
    
    return conditionFields.filter(f => f.id !== sourceFieldId && f.type === sourceField.type);
  };

  const getFieldTypeForComparison = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    return field?.type || 'text';
  };

  const getAvailableOperators = (fieldId: string) => {
    const fieldType = getFieldTypeForComparison(fieldId);
    const compatibleOps = getCompatibleOperators(fieldType);
    return fieldOperators.filter(op => compatibleOps.includes(op.value));
  };

  const toggleFieldComparison = (conditionId: string, useField: boolean) => {
    setUseFieldComparison({
      ...useFieldComparison,
      [conditionId]: useField
    });

    if (!useField) {
      updateCondition(conditionId, { compareToField: undefined });
    } else {
      updateCondition(conditionId, { value: '' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Field Rules</h3>
          <p className="text-sm text-muted-foreground">
            Control field behavior based on logical conditions
          </p>
        </div>
        <Button onClick={addRule} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {/* Existing Rules */}
      <div className="space-y-2">
        {rules.map((rule) => {
          const conditionsCount = rule.conditions?.length || (rule.condition ? 1 : 0);
          return (
            <Card key={rule.id} className="p-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                    {rule.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <span className="font-medium">{rule.name || 'Unnamed Rule'}</span>
                  <Badge variant="outline">{conditionsCount} condition{conditionsCount !== 1 ? 's' : ''}</Badge>
                  {rule.logicExpression && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {rule.logicExpression}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingRule(rule);
                      // Initialize field comparison states
                      const comparisons: Record<string, boolean> = {};
                      if (rule.conditions) {
                        rule.conditions.forEach(condition => {
                          if (condition.compareToField) {
                            comparisons[condition.id] = true;
                          }
                        });
                      } else if (rule.condition?.compareToField) {
                        comparisons[rule.condition.id] = true;
                      }
                      setUseFieldComparison(comparisons);
                      setExpressionError('');
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteRule(rule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Rule Editor */}
      {editingRule && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Field Rule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Rule Name</Label>
              <Input
                value={editingRule.name}
                onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                placeholder="Enter rule name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Target Field</Label>
                <Select
                  value={editingRule.targetFieldId}
                  onValueChange={(value) => setEditingRule({ ...editingRule, targetFieldId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target field" />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.label} ({field.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Action</Label>
                <Select
                  value={editingRule.action}
                  onValueChange={(value: FieldRuleAction) => setEditingRule({ ...editingRule, action: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldActions.map((action) => (
                      <SelectItem key={action.value} value={action.value}>
                        {action.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Conditions Section */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium">Conditions</h4>
                <Button variant="outline" size="sm" onClick={addCondition}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Condition
                </Button>
              </div>

              <div className="space-y-3">
                {editingRule.conditions?.map((condition, index) => (
                  <Card key={condition.id} className="p-3 bg-muted/30">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="secondary">Condition {index + 1}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCondition(condition.id)}
                          disabled={editingRule.conditions!.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label>Field</Label>
                          <Select
                            value={condition.fieldId || ''}
                            onValueChange={(value) => updateCondition(condition.id, { 
                              fieldId: value,
                              operator: '==',
                              value: '',
                              compareToField: undefined
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select field" />
                            </SelectTrigger>
                            <SelectContent>
                              {conditionFields.map((field) => (
                                <SelectItem key={field.id} value={field.id}>
                                  {field.label} ({field.type})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Operator</Label>
                          <Select
                            value={condition.operator || '=='}
                            onValueChange={(value: FieldOperator) => updateCondition(condition.id, { operator: value })}
                            disabled={!condition.fieldId}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableOperators(condition.fieldId || '').map((op) => (
                                <SelectItem key={op.value} value={op.value}>
                                  {op.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Value</Label>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={useFieldComparison[condition.id] || false}
                                onCheckedChange={(checked) => toggleFieldComparison(condition.id, checked)}
                              />
                              <Label className="text-xs">Compare to field</Label>
                            </div>
                            
                            {useFieldComparison[condition.id] ? (
                              <Select
                                value={condition.compareToField || ''}
                                onValueChange={(value) => updateCondition(condition.id, { compareToField: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select field" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getCompatibleFields(condition.fieldId || '').map((field) => (
                                    <SelectItem key={field.id} value={field.id}>
                                      {field.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <RuleDynamicValueInput
                                field={fields.find(f => f.id === condition.fieldId) || null}
                                value={condition.value}
                                onChange={(value) => updateCondition(condition.id, { value })}
                                operator={condition.operator}
                                placeholder="Enter value"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Logic Expression */}
            {editingRule.conditions && editingRule.conditions.length > 1 && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Label>Logical Expression</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="text-sm">Define how conditions are evaluated using numbers (1, 2, 3...) and operators:</p>
                        <ul className="text-xs mt-2 space-y-1">
                          <li>• <strong>AND</strong>: Both conditions must be true</li>
                          <li>• <strong>OR</strong>: Either condition can be true</li>
                          <li>• <strong>NOT</strong>: Inverts the condition</li>
                          <li>• Use parentheses () for grouping</li>
                        </ul>
                        <p className="text-xs mt-2"><strong>Examples:</strong></p>
                        <ul className="text-xs space-y-1">
                          <li>• 1 AND 2</li>
                          <li>• 1 OR (2 AND 3)</li>
                          <li>• NOT 1 AND (2 OR 3)</li>
                          <li>• (1 AND 2) OR (3 AND NOT 4)</li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Textarea
                  value={editingRule.logicExpression || ''}
                  onChange={(e) => {
                    setEditingRule({ ...editingRule, logicExpression: e.target.value });
                    setExpressionError('');
                  }}
                  placeholder="e.g., 1 AND (2 OR 3)"
                  className="font-mono"
                  rows={2}
                />
                {expressionError && (
                  <p className="text-sm text-destructive mt-1">{expressionError}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Available conditions: {editingRule.conditions.map((_, i) => i + 1).join(', ')}
                </p>
              </div>
            )}

            {/* Action Value Input */}
            <div>
              <Label>Action Value</Label>
              <ActionValueInput
                action={editingRule.action}
                targetField={fields.find(f => f.id === editingRule.targetFieldId) || null}
                value={editingRule.actionValue}
                onChange={(value) => setEditingRule({ ...editingRule, actionValue: value })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={editingRule.isActive}
                onCheckedChange={(checked) => setEditingRule({ ...editingRule, isActive: checked })}
              />
              <Label>Rule is active</Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setEditingRule(null);
                setUseFieldComparison({});
                setExpressionError('');
              }}>
                Cancel
              </Button>
              <Button onClick={saveRule}>
                Save Rule
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

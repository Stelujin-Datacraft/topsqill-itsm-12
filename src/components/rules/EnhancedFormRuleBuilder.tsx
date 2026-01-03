import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, HelpCircle } from 'lucide-react';
import { FormField } from '@/types/form';
import { FormRule, FormRuleAction, FormRuleCondition, FieldOperator } from '@/types/rules';
import { RuleDynamicValueInput } from './RuleDynamicValueInput';
import { EmailTemplateSelector } from './EmailTemplateSelector';
import { ExpressionEvaluator } from '@/utils/expressionEvaluator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useProject } from '@/contexts/ProjectContext';

interface EnhancedFormRuleBuilderProps {
  fields: FormField[];
  rules: FormRule[];
  onRulesChange: (rules: FormRule[]) => void;
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

const formActions: { value: FormRuleAction; label: string }[] = [
  { value: 'notify', label: 'Trigger Notification' },
  { value: 'sendEmail', label: 'Send Email' },
];

export function EnhancedFormRuleBuilder({ fields, rules, onRulesChange }: EnhancedFormRuleBuilderProps) {
  const [editingRule, setEditingRule] = useState<FormRule | null>(null);
  const [conditionFieldComparisons, setConditionFieldComparisons] = useState<Record<string, boolean>>({});
  const [expressionError, setExpressionError] = useState<string>('');
  const { currentProject } = useProject();

  // Filter fields that can be used for conditions
  const conditionFields = fields.filter(field => 
    CONDITION_COMPATIBLE_TYPES.includes(field.type)
  );

  const createNewRule = (): FormRule => ({
    id: `form-rule-${Date.now()}`,
    name: '',
    conditions: [{
      id: `condition-${Date.now()}`,
      type: 'single',
      fieldId: '',
      operator: '==',
      value: '',
    }],
    logicExpression: '1',
    action: 'approve',
    isActive: true,
  });

  const addRule = () => {
    const newRule = createNewRule();
    setEditingRule(newRule);
    setConditionFieldComparisons({});
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
    setConditionFieldComparisons({});
    setExpressionError('');
  };

  const deleteRule = (ruleId: string) => {
    onRulesChange(rules.filter(r => r.id !== ruleId));
  };

  const addCondition = () => {
    if (!editingRule) return;
    
    const newCondition: FormRuleCondition = {
      id: `condition-${Date.now()}`,
      type: 'single',
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

  const updateCondition = (conditionId: string, updates: Partial<FormRuleCondition>) => {
    if (!editingRule) return;
    
    setEditingRule({
      ...editingRule,
      conditions: editingRule.conditions.map(c => 
        c.id === conditionId ? { ...c, ...updates } : c
      )
    });
  };

  const removeCondition = (conditionId: string) => {
    if (!editingRule || editingRule.conditions.length === 1) return;
    
    const newConditions = editingRule.conditions.filter(c => c.id !== conditionId);
    setEditingRule({
      ...editingRule,
      conditions: newConditions,
      logicExpression: ExpressionEvaluator.generateDefaultExpression(newConditions.length, 'AND')
    });

    // Clean up field comparison state
    const updatedComparisons = { ...conditionFieldComparisons };
    delete updatedComparisons[conditionId];
    setConditionFieldComparisons(updatedComparisons);
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
    setConditionFieldComparisons({
      ...conditionFieldComparisons,
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
          <h3 className="text-lg font-semibold">Form Rules</h3>
          <p className="text-sm text-muted-foreground">
            Define actions that trigger when logical conditions are met
          </p>
        </div>
        <Button onClick={addRule} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {/* Existing Rules */}
      <div className="space-y-2">
        {rules.map((rule) => (
          <Card key={rule.id} className="p-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                  {rule.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <span className="font-medium">{rule.name || 'Unnamed Rule'}</span>
                <Badge variant="outline">{rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}</Badge>
                <Badge variant="outline">{rule.action}</Badge>
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
                    rule.conditions.forEach(condition => {
                      if (condition.compareToField) {
                        comparisons[condition.id] = true;
                      }
                    });
                    setConditionFieldComparisons(comparisons);
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
        ))}
      </div>

      {/* Rule Editor */}
      {editingRule && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Form Rule</CardTitle>
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
                <Label>Action</Label>
                <Select
                  value={editingRule.action}
                  onValueChange={(value: FormRuleAction) => setEditingRule({ ...editingRule, action: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formActions.map((action) => (
                      <SelectItem key={action.value} value={action.value}>
                        {action.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={editingRule.isActive}
                    onCheckedChange={(checked) => setEditingRule({ ...editingRule, isActive: checked })}
                  />
                  <Label className="text-sm">Active</Label>
                </div>
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
                {editingRule.conditions.map((condition, index) => (
                  <Card key={condition.id} className="p-3 bg-muted/30">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="secondary">Condition {index + 1}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCondition(condition.id)}
                          disabled={editingRule.conditions.length === 1}
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
                                checked={conditionFieldComparisons[condition.id] || false}
                                onCheckedChange={(checked) => toggleFieldComparison(condition.id, checked)}
                              />
                              <Label className="text-xs">Compare to field</Label>
                            </div>
                            
                            {conditionFieldComparisons[condition.id] ? (
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
            {editingRule.conditions.length > 1 && (
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
                          <li>• Use parentheses () for grouping (highest priority)</li>
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
            {(editingRule.action === 'sendEmail' || 
              editingRule.action === 'notify' || 
              editingRule.action === 'showMessage' ||
              editingRule.action === 'redirect' ||
              editingRule.action === 'triggerWebhook' ||
              editingRule.action === 'assignForm' ||
              editingRule.action === 'changeFormHeader' ||
              editingRule.action === 'preventSubmit' ||
              editingRule.action === 'showSuccessModal') && (
              <div>
                <Label>
                  {editingRule.action === 'sendEmail' ? 'Email Template' :
                   editingRule.action === 'redirect' ? 'Redirect URL' :
                   editingRule.action === 'triggerWebhook' ? 'Webhook URL' :
                   editingRule.action === 'assignForm' ? 'Assign To (User ID)' :
                   'Message'}
                </Label>
                {editingRule.action === 'sendEmail' && currentProject?.id ? (
                  <EmailTemplateSelector
                    projectId={currentProject.id}
                    formFields={fields.map(f => ({ id: f.id, label: f.label, type: f.type }))}
                    value={editingRule.actionValue}
                    onChange={(value) => setEditingRule({ ...editingRule, actionValue: value })}
                  />
                ) : (
                  <Textarea
                    value={editingRule.actionValue?.toString() || ''}
                    onChange={(e) => setEditingRule({ ...editingRule, actionValue: e.target.value })}
                    placeholder={
                      editingRule.action === 'redirect' ? 'Enter redirect URL' :
                      editingRule.action === 'triggerWebhook' ? 'Enter webhook URL' :
                      editingRule.action === 'assignForm' ? 'Enter user ID' :
                      'Enter message'
                    }
                    rows={3}
                  />
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setEditingRule(null);
                setConditionFieldComparisons({});
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

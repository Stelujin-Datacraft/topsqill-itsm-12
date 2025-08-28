import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus } from 'lucide-react';
import { FormField } from '@/types/form';
import { FormRule, FormRuleAction, FormRuleCondition, FieldOperator } from '@/types/rules';
import { RuleDynamicValueInput } from './RuleDynamicValueInput';
import { EmailTemplateSelector } from './EmailTemplateSelector';

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
  { value: 'approve', label: 'Approve Form' },
  { value: 'disapprove', label: 'Disapprove Form' },
  { value: 'notify', label: 'Trigger Notification' },
  { value: 'sendEmail', label: 'Send Email' },
  { value: 'triggerWebhook', label: 'Trigger Webhook/API' },
  { value: 'startWorkflow', label: 'Start Workflow' },
  { value: 'assignForm', label: 'Assign Form' },
  { value: 'redirect', label: 'Redirect' },
  { value: 'lockForm', label: 'Lock Form' },
  { value: 'unlockForm', label: 'Unlock Form' },
  { value: 'autoFillFields', label: 'Auto-fill Fields' },
  { value: 'changeFormHeader', label: 'Change Form Header' },
  { value: 'saveDraft', label: 'Save as Draft' },
  { value: 'showSuccessModal', label: 'Show Success Modal' },
  { value: 'allowSubmit', label: 'Allow Submit' },
  { value: 'preventSubmit', label: 'Prevent Submit' },
];

export function EnhancedFormRuleBuilder({ fields, rules, onRulesChange }: EnhancedFormRuleBuilderProps) {
  const [editingRule, setEditingRule] = useState<FormRule | null>(null);
  const [conditionFieldComparisons, setConditionFieldComparisons] = useState<Record<string, boolean>>({});

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
    rootLogic: 'AND',
    action: 'approve',
    isActive: true,
  });

  const addRule = () => {
    const newRule = createNewRule();
    setEditingRule(newRule);
    setConditionFieldComparisons({});
  };

  const saveRule = () => {
    if (!editingRule) return;
    
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
    
    setEditingRule({
      ...editingRule,
      conditions: [...editingRule.conditions, newCondition]
    });
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
    if (!editingRule) return;
    
    setEditingRule({
      ...editingRule,
      conditions: editingRule.conditions.filter(c => c.id !== conditionId)
    });

    // Clean up field comparison state
    const updatedComparisons = { ...conditionFieldComparisons };
    delete updatedComparisons[conditionId];
    setConditionFieldComparisons(updatedComparisons);
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
            Define actions that trigger when form conditions are met
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
                <Badge variant="outline">{rule.conditions.length} conditions</Badge>
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

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Logic Operator</Label>
                <Select
                  value={editingRule.rootLogic}
                  onValueChange={(value: 'AND' | 'OR') => setEditingRule({ ...editingRule, rootLogic: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">AND (All conditions must be true)</SelectItem>
                    <SelectItem value="OR">OR (Any condition can be true)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
                  <Card key={condition.id} className="p-3">
                    <div className="space-y-3">
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <Label>Field</Label>
                          <Select
                            value={condition.fieldId || ''}
                            onValueChange={(value) => updateCondition(condition.id, { 
                              fieldId: value,
                              operator: '==', // Reset operator when field changes
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

                        <div className="flex items-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCondition(condition.id)}
                            disabled={editingRule.conditions.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {index < editingRule.conditions.length - 1 && (
                      <div className="text-center mt-2">
                        <Badge variant="outline">{editingRule.rootLogic}</Badge>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>

            {/* Action Configuration */}
            {([
              'preventSubmit', 'showMessage', 'notify', 'sendEmail', 'triggerWebhook', 
              'startWorkflow', 'assignForm', 'redirect', 'changeFormHeader', 
              'showSuccessModal', 'autoFillFields', 'updateField'
            ].includes(editingRule.action)) && (
              <div>
                <Label>Action Configuration</Label>
                {editingRule.action === 'autoFillFields' ? (
                  <div className="space-y-2">
                    <Textarea
                      value={typeof editingRule.actionValue === 'object' 
                        ? JSON.stringify(editingRule.actionValue, null, 2)
                        : editingRule.actionValue?.toString() || ''
                      }
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          setEditingRule({ ...editingRule, actionValue: parsed });
                        } catch {
                          setEditingRule({ ...editingRule, actionValue: e.target.value });
                        }
                      }}
                      placeholder='{"fieldId1": "value1", "fieldId2": "value2"}'
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">Enter JSON object with field IDs and values</p>
                  </div>
                ) : editingRule.action === 'updateField' ? (
                  <div className="space-y-2">
                    <Textarea
                      value={typeof editingRule.actionValue === 'object' 
                        ? JSON.stringify(editingRule.actionValue, null, 2)
                        : editingRule.actionValue?.toString() || ''
                      }
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          setEditingRule({ ...editingRule, actionValue: parsed });
                        } catch {
                          setEditingRule({ ...editingRule, actionValue: e.target.value });
                        }
                      }}
                      placeholder='{"fieldId": "target-field-id", "value": "new-value"}'
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">Enter JSON with fieldId and value</p>
                  </div>
                ) : editingRule.action === 'sendEmail' ? (
                  <EmailTemplateSelector
                    value={typeof editingRule.actionValue === 'object' ? editingRule.actionValue : undefined}
                    onChange={(config) => setEditingRule({ ...editingRule, actionValue: config })}
                    formFields={fields}
                  />
                ) : (
                  <Textarea
                    value={typeof editingRule.actionValue === 'string' ? editingRule.actionValue : ''}
                    onChange={(e) => setEditingRule({ ...editingRule, actionValue: e.target.value })}
                    placeholder={
                      editingRule.action === 'preventSubmit' ? 'Error message to show users' :
                      editingRule.action === 'showMessage' ? 'Message to display to users' :
                      editingRule.action === 'notify' ? 'Notification message' :
                      editingRule.action === 'triggerWebhook' ? 'Webhook URL or configuration JSON' :
                      editingRule.action === 'startWorkflow' ? 'Workflow ID or name to start' :
                      editingRule.action === 'assignForm' ? 'Assignee user ID or email address' :
                      editingRule.action === 'redirect' ? 'Full URL to redirect to (e.g., https://example.com)' :
                      editingRule.action === 'changeFormHeader' ? 'New header text to display' :
                      editingRule.action === 'showSuccessModal' ? 'Success message to show in modal' :
                      'Enter configuration details...'
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

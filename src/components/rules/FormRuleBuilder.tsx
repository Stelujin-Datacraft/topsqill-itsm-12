import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus } from 'lucide-react';
import { FormField } from '@/types/form';
import { FormRule, FormRuleAction, FormRuleCondition, FieldOperator } from '@/types/rules';

interface FormRuleBuilderProps {
  fields: FormField[];
  rules: FormRule[];
  onRulesChange: (rules: FormRule[]) => void;
}

const fieldOperators: { value: FieldOperator; label: string }[] = [
  { value: '==', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: '<', label: 'less than' },
  { value: '>', label: 'greater than' },
  { value: '<=', label: 'less than or equal' },
  { value: '>=', label: 'greater than or equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not contains', label: 'does not contain' },
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
];

export function FormRuleBuilder({ fields, rules, onRulesChange }: FormRuleBuilderProps) {
  const [editingRule, setEditingRule] = useState<FormRule | null>(null);

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
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Form Rules</h3>
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
                  onClick={() => setEditingRule(rule)}
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
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <Label>Field</Label>
                        <Select
                          value={condition.fieldId || ''}
                          onValueChange={(value) => updateCondition(condition.id, { fieldId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select field" />
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
                        <Label>Operator</Label>
                        <Select
                          value={condition.operator || '=='}
                          onValueChange={(value: FieldOperator) => updateCondition(condition.id, { operator: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldOperators.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Value</Label>
                        <Input
                          value={typeof condition.value === 'string' ? condition.value : ''}
                          onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                          placeholder="Enter value"
                        />
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
            {['notify', 'sendEmail', 'triggerWebhook', 'redirect', 'assignForm', 'changeFormHeader', 'showSuccessModal'].includes(editingRule.action) && (
              <div>
                <Label>Action Configuration</Label>
                <Textarea
                  value={typeof editingRule.actionValue === 'string' ? editingRule.actionValue : ''}
                  onChange={(e) => setEditingRule({ ...editingRule, actionValue: e.target.value })}
                  placeholder="Enter configuration details..."
                  rows={3}
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingRule(null)}>
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

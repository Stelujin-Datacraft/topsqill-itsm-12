
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';
import { FormField } from '@/types/form';
import { FieldRule, FieldRuleAction, FieldOperator } from '@/types/rules';

interface FieldRuleBuilderProps {
  fields: FormField[];
  rules: FieldRule[];
  onRulesChange: (rules: FieldRule[]) => void;
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
  { value: 'startsWith', label: 'starts with' },
  { value: 'endsWith', label: 'ends with' },
  { value: 'in', label: 'is one of' },
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
  // Hidden actions - kept for backwards compatibility but not shown in UI:
  // { value: 'changeOptions', label: 'Change Field Options' },
  // { value: 'changeLabel', label: 'Change Label' },
  // { value: 'showTooltip', label: 'Show Tooltip' },
  // { value: 'showError', label: 'Show Error' },
];

export function FieldRuleBuilder({ fields, rules, onRulesChange }: FieldRuleBuilderProps) {
  const [editingRule, setEditingRule] = useState<FieldRule | null>(null);

  const createNewRule = (): FieldRule => ({
    id: `rule-${Date.now()}`,
    name: '',
    targetFieldId: '',
    condition: {
      id: `condition-${Date.now()}`,
      fieldId: '',
      operator: '==',
      value: '',
    },
    action: 'show',
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

  const getCompatibleFields = (sourceFieldId: string) => {
    const sourceField = fields.find(f => f.id === sourceFieldId);
    if (!sourceField) return [];
    
    return fields.filter(f => f.id !== sourceFieldId && f.type === sourceField.type);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Field Rules</h3>
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
                        {field.label}
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

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Condition</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>When Field</Label>
                  <Select
                    value={editingRule.condition.fieldId}
                    onValueChange={(value) => 
                      setEditingRule({
                        ...editingRule,
                        condition: { ...editingRule.condition, fieldId: value }
                      })
                    }
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
                    value={editingRule.condition.operator}
                    onValueChange={(value: FieldOperator) =>
                      setEditingRule({
                        ...editingRule,
                        condition: { ...editingRule.condition, operator: value }
                      })
                    }
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
                  <div className="space-y-2">
                    <Input
                      value={typeof editingRule.condition.value === 'string' ? editingRule.condition.value : ''}
                      onChange={(e) =>
                        setEditingRule({
                          ...editingRule,
                          condition: { ...editingRule.condition, value: e.target.value }
                        })
                      }
                      placeholder="Enter value"
                    />
                    
                    {/* Dynamic field comparison option */}
                    <Select
                      value={editingRule.condition.compareToField || 'none'}
                      onValueChange={(value) =>
                        setEditingRule({
                          ...editingRule,
                          condition: { ...editingRule.condition, compareToField: value === 'none' ? undefined : value }
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Or compare to field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No field comparison</SelectItem>
                        {getCompatibleFields(editingRule.condition.fieldId).map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Value Input */}
            {(['setDefault', 'changeLabel', 'showTooltip', 'showError'].includes(editingRule.action)) && (
              <div>
                <Label>Action Value</Label>
                <Input
                  value={typeof editingRule.actionValue === 'string' ? editingRule.actionValue : ''}
                  onChange={(e) => setEditingRule({ ...editingRule, actionValue: e.target.value })}
                  placeholder="Enter action value"
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

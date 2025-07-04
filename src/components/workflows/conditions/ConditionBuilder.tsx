import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, GitBranch, Sparkles } from 'lucide-react';
import { 
  ConditionConfig, 
  IfConditionConfig, 
  SwitchConditionConfig, 
  SimpleCondition,
  LogicalGroup,
  FieldPath,
  ComparisonOperator,
  LogicalOperator,
  SwitchCase,
  EnhancedCondition
} from '@/types/conditions';
import { EnhancedConditionBuilder } from './EnhancedConditionBuilder';

interface ConditionBuilderProps {
  value?: ConditionConfig;
  onChange: (config: ConditionConfig) => void;
}

export function ConditionBuilder({ value, onChange }: ConditionBuilderProps) {
  const [conditionType, setConditionType] = useState<'if' | 'switch'>(value?.type || 'if');
  const [useEnhancedBuilder, setUseEnhancedBuilder] = useState(false);

  const handleTypeChange = (type: 'if' | 'switch') => {
    setConditionType(type);
    
    if (type === 'if') {
      const newConfig: IfConditionConfig = {
        type: 'if',
        condition: {
          id: 'condition-1',
          leftOperand: { type: 'form', path: '' },
          operator: '==',
          rightOperand: { type: 'static', value: '' }
        }
      };
      onChange(newConfig);
    } else {
      const newConfig: SwitchConditionConfig = {
        type: 'switch',
        field: { type: 'form', path: '' },
        cases: []
      };
      onChange(newConfig);
    }
  };

  const handleEnhancedConditionChange = (enhancedCondition: EnhancedCondition) => {
    const newConfig: IfConditionConfig = {
      type: 'if',
      condition: enhancedCondition
    };
    onChange(newConfig);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Condition Configuration</Label>
          <p className="text-sm text-gray-600">Configure how this condition node should evaluate data</p>
        </div>
        <Button
          variant={useEnhancedBuilder ? "default" : "outline"}
          size="sm"
          onClick={() => setUseEnhancedBuilder(!useEnhancedBuilder)}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {useEnhancedBuilder ? 'Enhanced Mode' : 'Simple Mode'}
        </Button>
      </div>

      {useEnhancedBuilder ? (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Enhanced Condition Builder</span>
            </div>
            <p className="text-xs text-blue-700">
              Build intuitive conditions with form-aware inputs and smart field detection
            </p>
          </div>
          
          <EnhancedConditionBuilder
            value={
              value?.type === 'if' && typeof value.condition === 'object' && 'systemType' in value.condition
                ? value.condition as EnhancedCondition
                : undefined
            }
            onChange={handleEnhancedConditionChange}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label>Condition Type</Label>
            <Select value={conditionType} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select condition type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="if">If Statement</SelectItem>
                <SelectItem value="switch">Switch Statement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {conditionType === 'if' && value?.type === 'if' && (
            <IfConditionBuilder 
              config={value}
              onChange={onChange}
            />
          )}

          {conditionType === 'switch' && value?.type === 'switch' && (
            <SwitchConditionBuilder
              config={value}
              onChange={onChange}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface IfConditionBuilderProps {
  config: IfConditionConfig;
  onChange: (config: IfConditionConfig) => void;
}

function IfConditionBuilder({ config, onChange }: IfConditionBuilderProps) {
  const updateCondition = (condition: SimpleCondition | LogicalGroup) => {
    onChange({ ...config, condition });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          If Condition Logic
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SimpleConditionBuilder
          condition={config.condition as SimpleCondition}
          onChange={updateCondition}
        />
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>True Path</Label>
            <Input
              value={config.truePath || ''}
              onChange={(e) => onChange({ ...config, truePath: e.target.value })}
              placeholder="Next node for true condition"
            />
          </div>
          <div>
            <Label>False Path</Label>
            <Input
              value={config.falsePath || ''}
              onChange={(e) => onChange({ ...config, falsePath: e.target.value })}
              placeholder="Next node for false condition"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SwitchConditionBuilderProps {
  config: SwitchConditionConfig;
  onChange: (config: SwitchConditionConfig) => void;
}

function SwitchConditionBuilder({ config, onChange }: SwitchConditionBuilderProps) {
  const addCase = () => {
    const newCase: SwitchCase = {
      value: '',
      path: ''
    };
    onChange({
      ...config,
      cases: [...config.cases, newCase]
    });
  };

  const updateCase = (index: number, updatedCase: SwitchCase) => {
    const newCases = [...config.cases];
    newCases[index] = updatedCase;
    onChange({ ...config, cases: newCases });
  };

  const removeCase = (index: number) => {
    const newCases = config.cases.filter((_, i) => i !== index);
    onChange({ ...config, cases: newCases });
  };

  const updateField = (field: FieldPath) => {
    onChange({ ...config, field });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          Switch Statement Logic
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Field to Evaluate</Label>
          <FieldPathBuilder
            value={config.field}
            onChange={updateField}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Cases</Label>
            <Button onClick={addCase} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add Case
            </Button>
          </div>
          
          {config.cases.map((caseItem, index) => (
            <div key={index} className="flex gap-2 items-center mb-2">
              <Input
                placeholder="Value"
                value={caseItem.value}
                onChange={(e) => updateCase(index, { ...caseItem, value: e.target.value })}
                className="flex-1"
              />
              <Input
                placeholder="Path/Node ID"
                value={caseItem.path}
                onChange={(e) => updateCase(index, { ...caseItem, path: e.target.value })}
                className="flex-1"
              />
              <Button
                onClick={() => removeCase(index)}
                size="sm"
                variant="outline"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div>
          <Label>Default Path</Label>
          <Input
            value={config.defaultPath || ''}
            onChange={(e) => onChange({ ...config, defaultPath: e.target.value })}
            placeholder="Default node when no case matches"
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface SimpleConditionBuilderProps {
  condition: SimpleCondition;
  onChange: (condition: SimpleCondition) => void;
}

function SimpleConditionBuilder({ condition, onChange }: SimpleConditionBuilderProps) {
  const updateLeftOperand = (leftOperand: FieldPath) => {
    onChange({ ...condition, leftOperand });
  };

  const updateOperator = (operator: ComparisonOperator) => {
    onChange({ ...condition, operator });
  };

  const updateRightOperand = (value: string, isStatic: boolean = true) => {
    const rightOperand = isStatic 
      ? { type: 'static' as const, value }
      : { type: 'form' as const, path: value };
    onChange({ ...condition, rightOperand });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Left Field</Label>
          <FieldPathBuilder
            value={condition.leftOperand}
            onChange={updateLeftOperand}
          />
        </div>
        
        <div>
          <Label>Operator</Label>
          <Select value={condition.operator} onValueChange={updateOperator}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="==">Equals</SelectItem>
              <SelectItem value="!=">Not Equals</SelectItem>
              <SelectItem value="<">Less Than</SelectItem>
              <SelectItem value=">">Greater Than</SelectItem>
              <SelectItem value="<=">Less Than or Equal</SelectItem>
              <SelectItem value=">=">Greater Than or Equal</SelectItem>
              <SelectItem value="contains">Contains</SelectItem>
              <SelectItem value="not_contains">Not Contains</SelectItem>
              <SelectItem value="starts_with">Starts With</SelectItem>
              <SelectItem value="ends_with">Ends With</SelectItem>
              <SelectItem value="in">In List</SelectItem>
              <SelectItem value="not_in">Not In List</SelectItem>
              <SelectItem value="exists">Exists</SelectItem>
              <SelectItem value="not_exists">Not Exists</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Right Value</Label>
          <Input
            value={
              typeof condition.rightOperand === 'object' && 'value' in condition.rightOperand
                ? condition.rightOperand.value
                : ''
            }
            onChange={(e) => updateRightOperand(e.target.value)}
            placeholder="Comparison value"
          />
        </div>
      </div>
    </div>
  );
}

interface FieldPathBuilderProps {
  value: FieldPath;
  onChange: (fieldPath: FieldPath) => void;
}

function FieldPathBuilder({ value, onChange }: FieldPathBuilderProps) {
  const updateType = (type: FieldPath['type']) => {
    onChange({ ...value, type });
  };

  const updatePath = (path: string) => {
    onChange({ ...value, path });
  };

  return (
    <div className="flex gap-2">
      <Select value={value.type} onValueChange={updateType}>
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="form">Form</SelectItem>
          <SelectItem value="user">User</SelectItem>
          <SelectItem value="system">System</SelectItem>
          <SelectItem value="static">Static</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={value.path}
        onChange={(e) => updatePath(e.target.value)}
        placeholder={value.type === 'form' ? 'field_name' : value.type === 'user' ? 'role' : 'approvalStatus'}
        className="flex-1"
      />
    </div>
  );
}

import React, { useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch, Settings } from 'lucide-react';

interface ConditionNodeProps {
  data: {
    label: string;
    config: any;
    nodeId: string;
    onSelect: React.MutableRefObject<(nodeId: string) => void>;
  };
}

export const ConditionNode = React.memo(function ConditionNode({ data }: ConditionNodeProps) {
  const getConditionPreview = () => {
    const config = data.config;
    
    // Check for enhanced condition
    if (config?.enhancedCondition) {
      const enhancedCondition = config.enhancedCondition;
      
      if (enhancedCondition.systemType === 'form_level' && enhancedCondition.formLevelCondition) {
        const formCondition = enhancedCondition.formLevelCondition;
        return `${formCondition.conditionType} ${formCondition.operator} ${formCondition.value}`;
      } else if (enhancedCondition.systemType === 'field_level' && enhancedCondition.fieldLevelCondition) {
        const fieldCondition = enhancedCondition.fieldLevelCondition;
        return `Field ${fieldCondition.operator} ${fieldCondition.value}`;
      }
      
      return 'Enhanced condition configured';
    }
    
    // Legacy condition display
    if (config?.conditionConfig?.type === 'if') {
      const condition = config.conditionConfig.condition;
      if (condition && condition.leftOperand && condition.operator) {
        const leftField = condition.leftOperand.path || condition.leftOperand.type;
        const rightValue = condition.rightOperand?.value || condition.rightOperand?.path || '';
        return `${leftField} ${condition.operator} ${rightValue}`;
      }
      return 'If condition configured';
    } else if (config?.conditionConfig?.type === 'switch') {
      const field = config.conditionConfig.field?.path || 'field';
      const casesCount = config.conditionConfig.cases?.length || 0;
      return `Switch ${field} (${casesCount} cases)`;
    }
    
    return 'Click to configure';
  };

  const getConditionType = () => {
    if (data.config?.enhancedCondition) {
      return data.config.enhancedCondition.systemType === 'form_level' ? 'Form Level' : 'Field Level';
    }
    if (data.config?.conditionConfig?.type === 'switch') {
      return 'Switch';
    }
    return 'Condition';
  };

  const isConfigured = () => {
    return data.config?.enhancedCondition || data.config?.conditionConfig;
  };

  const handleClick = useCallback(() => {
    data.onSelect.current(data.nodeId);
  }, [data.nodeId, data.onSelect]);

  return (
    <div 
      className={`px-4 py-3 shadow-md rounded-md border-2 min-w-[180px] max-w-[220px] cursor-pointer transition-colors ${
        isConfigured() 
          ? 'bg-yellow-100 border-yellow-200 hover:border-yellow-300' 
          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
      }`}
      onClick={handleClick}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-yellow-500"
      />
      
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-2">
          <GitBranch className={`h-4 w-4 ${isConfigured() ? 'text-yellow-700' : 'text-gray-500'}`} />
          <div className={`font-medium text-sm ${isConfigured() ? 'text-yellow-800' : 'text-gray-700'}`}>
            {data.label}
          </div>
        </div>
        <Settings className={`h-3 w-3 ${isConfigured() ? 'text-yellow-600' : 'text-gray-400'}`} />
      </div>
      
      <div className={`text-xs mb-1 font-medium ${isConfigured() ? 'text-yellow-700' : 'text-gray-500'}`}>
        {getConditionType()}
      </div>
      
      <div className={`text-xs break-words ${isConfigured() ? 'text-yellow-600' : 'text-gray-400'}`}>
        {getConditionPreview()}
      </div>

      {data.config?.description && (
        <div className={`text-xs mt-1 italic line-clamp-2 ${isConfigured() ? 'text-yellow-500' : 'text-gray-400'}`}>
          {data.config.description}
        </div>
      )}

      {/* Output handles for different condition types */}
      {data.config?.conditionConfig?.type === 'switch' ? (
        // Switch node - dynamic handles based on cases
        <>
          {data.config.conditionConfig.cases?.map((caseItem: any, index: number) => (
            <Handle
              key={`case-${index}`}
              type="source"
              position={Position.Right}
              id={caseItem.value}
              className="w-3 h-3 bg-blue-500"
              style={{ top: `${30 + (index * 15)}%` }}
            />
          ))}
          {data.config.conditionConfig.defaultPath && (
            <Handle
              type="source"
              position={Position.Right}
              id="default"
              className="w-3 h-3 bg-gray-500"
              style={{ top: '85%' }}
            />
          )}
        </>
      ) : (
        // If condition or enhanced condition - true/false handles
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            className="w-3 h-3 bg-green-500"
            style={{ top: '35%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            className="w-3 h-3 bg-red-500"
            style={{ top: '65%' }}
          />
        </>
      )}
    </div>
  );
});

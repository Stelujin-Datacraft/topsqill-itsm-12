
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play } from 'lucide-react';

interface StartNodeProps {
  data: {
    label: string;
    config: any;
    onSelect: () => void;
  };
}

export function StartNode({ data }: StartNodeProps) {
  const getDisplayText = () => {
    if (data.config?.triggerType === 'form_submission' && data.config?.triggerFormName) {
      return data.config.triggerFormName;
    }
    return data.config?.triggerType || 'Click to configure';
  };

  return (
    <div 
      className="px-4 py-2 shadow-md rounded-md bg-green-100 border-2 border-green-200 min-w-[150px] cursor-pointer"
      onClick={data.onSelect}
    >
      <div className="flex items-center space-x-2">
        <Play className="h-4 w-4 text-green-700" />
        <div className="text-green-800 font-medium">{data.label}</div>
      </div>
      <div className="text-xs text-green-600 mt-1">
        {getDisplayText()}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-500"
      />
    </div>
  );
}

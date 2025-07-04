
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileText } from 'lucide-react';

interface FormAssignmentNodeProps {
  data: {
    label: string;
    config: any;
    onSelect: () => void;
  };
}

export function FormAssignmentNode({ data }: FormAssignmentNodeProps) {
  return (
    <div 
      className="px-4 py-2 shadow-md rounded-md bg-blue-100 border-2 border-blue-200 min-w-[150px] cursor-pointer"
      onClick={data.onSelect}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500"
      />
      <div className="flex items-center space-x-2">
        <FileText className="h-4 w-4 text-blue-700" />
        <div className="text-blue-800 font-medium">{data.label}</div>
      </div>
      <div className="text-xs text-blue-600 mt-1">
        {data.config.actionType || 'Click to configure'}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500"
      />
    </div>
  );
}

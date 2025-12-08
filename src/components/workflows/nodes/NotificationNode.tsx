
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Mail } from 'lucide-react';

interface NotificationNodeProps {
  data: {
    label: string;
    config: any;
    onSelect: () => void;
  };
}

export function NotificationNode({ data }: NotificationNodeProps) {
  return (
    <div 
      className="px-4 py-2 shadow-md rounded-md bg-purple-100 border-2 border-purple-200 min-w-[150px] max-w-[220px] cursor-pointer"
      onClick={data.onSelect}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-purple-500"
      />
      <div className="flex items-center space-x-2">
        <Mail className="h-4 w-4 text-purple-700" />
        <div className="text-purple-800 font-medium">{data.label}</div>
      </div>
      <div className="text-xs text-purple-600 mt-1">
        {data.config.notificationConfig?.type || 'Click to configure'}
      </div>
      {data.config?.description && (
        <div className="text-xs text-purple-500 mt-1 italic line-clamp-2 break-words w-full whitespace-normal">
          {data.config.description}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-purple-500"
      />
    </div>
  );
}

import React, { useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Square } from 'lucide-react';

interface EndNodeProps {
  data: {
    label: string;
    config: any;
    nodeId: string;
    onSelect: React.MutableRefObject<(nodeId: string) => void>;
  };
}

export const EndNode = React.memo(function EndNode({ data }: EndNodeProps) {
  const handleClick = useCallback(() => {
    data.onSelect.current(data.nodeId);
  }, [data.nodeId, data.onSelect]);

  return (
    <div 
      className="px-4 py-2 shadow-md rounded-md bg-red-100 border-2 border-red-200 min-w-[150px] max-w-[220px] cursor-pointer"
      onClick={handleClick}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-red-500"
      />
      <div className="flex items-center space-x-2">
        <Square className="h-4 w-4 text-red-700" />
        <div className="text-red-800 font-medium">{data.label}</div>
      </div>
      <div className="text-xs text-red-600 mt-1">
        End of workflow
      </div>
      {data.config?.description && (
        <div className="text-xs text-red-500 mt-1 italic line-clamp-2 break-words w-full whitespace-normal">
          {data.config.description}
        </div>
      )}
    </div>
  );
});

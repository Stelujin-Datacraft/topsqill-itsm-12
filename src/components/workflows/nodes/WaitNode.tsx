import React, { useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Clock } from 'lucide-react';

interface WaitNodeProps {
  data: {
    label: string;
    config: any;
    nodeId: string;
    onSelect: React.MutableRefObject<(nodeId: string) => void>;
  };
}

export const WaitNode = React.memo(function WaitNode({ data }: WaitNodeProps) {
  const handleClick = useCallback(() => {
    data.onSelect.current(data.nodeId);
  }, [data.nodeId, data.onSelect]);

  return (
    <div 
      className="px-4 py-2 shadow-md rounded-md bg-orange-100 border-2 border-orange-200 min-w-[150px] cursor-pointer"
      onClick={handleClick}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-orange-500"
      />
      <div className="flex items-center space-x-2">
        <Clock className="h-4 w-4 text-orange-700" />
        <div className="text-orange-800 font-medium">{data.label}</div>
      </div>
      <div className="text-xs text-orange-600 mt-1">
        {data.config?.waitDuration ? `${data.config.waitDuration} ${data.config.waitUnit}` : 'Click to configure'}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-orange-500"
      />
    </div>
  );
});

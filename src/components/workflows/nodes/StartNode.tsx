import React, { useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play } from 'lucide-react';

interface StartNodeProps {
  data: {
    label: string;
    config: any;
    nodeId: string;
    onSelect: React.MutableRefObject<(nodeId: string) => void>;
  };
}

export const StartNode = React.memo(function StartNode({ data }: StartNodeProps) {
  const getDisplayText = () => {
    if (data.config?.triggerType === 'form_submission' && data.config?.triggerFormName) {
      return data.config.triggerFormName;
    }
    return data.config?.triggerType || 'Click to configure';
  };

  const handleClick = useCallback(() => {
    data.onSelect.current(data.nodeId);
  }, [data.nodeId, data.onSelect]);

  return (
    <div 
      className="px-4 py-2 shadow-md rounded-md bg-green-100 border-2 border-green-200 min-w-[150px] max-w-[220px] cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex items-center space-x-2">
        <Play className="h-4 w-4 text-green-700" />
        <div className="text-green-800 font-medium">{data.label}</div>
      </div>
      <div className="text-xs text-green-600 mt-1">
        {getDisplayText()}
      </div>
      {data.config?.description && (
        <div className="text-xs text-green-500 mt-1 italic line-clamp-2 break-words w-full whitespace-normal">
          {data.config.description}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-500"
      />
    </div>
  );
});

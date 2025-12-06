import React, { useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { CheckCircle, XCircle, FileCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ApprovalNodeProps {
  data: {
    label: string;
    nodeId: string;
    config?: {
      actionType?: string;
      approvalAction?: 'approve' | 'disapprove';
      targetFormName?: string;
      notes?: string;
    };
    onSelect: React.MutableRefObject<(nodeId: string) => void>;
  };
}

export const ApprovalNode = React.memo(function ApprovalNode({ data }: ApprovalNodeProps) {
  const config = data.config || {};
  const approvalAction = config.approvalAction;
  const targetFormName = config.targetFormName;

  const getNodeColor = () => {
    if (approvalAction === 'approve') return 'bg-green-50 border-green-200';
    if (approvalAction === 'disapprove') return 'bg-red-50 border-red-200';
    return 'bg-gray-50 border-gray-200';
  };

  const getIcon = () => {
    if (approvalAction === 'approve') return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (approvalAction === 'disapprove') return <XCircle className="h-5 w-5 text-red-600" />;
    return <FileCheck className="h-5 w-5 text-gray-600" />;
  };

  const getActionText = () => {
    if (approvalAction === 'approve') return 'Approve';
    if (approvalAction === 'disapprove') return 'Disapprove';
    return 'Set Status';
  };

  const handleClick = useCallback(() => {
    data.onSelect.current(data.nodeId);
  }, [data.nodeId, data.onSelect]);

  return (
    <div 
      className={`px-4 py-3 shadow-md rounded-md border-2 min-w-[200px] cursor-pointer hover:shadow-lg transition-shadow ${getNodeColor()}`}
      onClick={handleClick}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
      <div className="flex items-center space-x-2 mb-2">
        {getIcon()}
        <span className="font-medium text-sm">{data.label}</span>
      </div>
      
      <div className="space-y-1">
        <Badge variant={approvalAction === 'approve' ? 'default' : approvalAction === 'disapprove' ? 'destructive' : 'secondary'} className="text-xs">
          {getActionText()}
        </Badge>
        
        {targetFormName && (
          <div className="text-xs text-gray-600 mt-1">
            Form: {targetFormName}
          </div>
        )}
        
        {config.notes && (
          <div className="text-xs text-gray-500 mt-1 truncate">
            Notes: {config.notes}
          </div>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
});

import React, { useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Settings, CheckCircle, XCircle, Mail, MessageSquare, Webhook, FileText, Edit, Activity, Bell, RefreshCw, Edit3, FileCheck, Link2 } from 'lucide-react';

interface ActionNodeProps {
  data: {
    label: string;
    config: any;
    nodeId: string;
    onSelect: React.MutableRefObject<(nodeId: string) => void>;
  };
}

const getActionIcon = (actionType: string) => {
  switch (actionType) {
    case 'approve_form':
    case 'disapprove_form':
      return actionType === 'approve_form' ? CheckCircle : XCircle;
    case 'assign_form':
      return FileText;
    case 'send_email':
    case 'send_notification':
      return Bell;
    case 'send_sms':
      return MessageSquare;
    case 'trigger_webhook':
      return Webhook;
    case 'update_form_lifecycle_status':
      return RefreshCw;
    case 'set_field_values':
      return Edit;
    case 'log_event':
      return Activity;
    case 'change_field_value':
      return Edit3;
    case 'change_record_status':
      return FileCheck;
    case 'create_record':
      return FileText;
    case 'create_linked_record':
      return Link2;
    default:
      return Settings;
  }
};

const getActionColor = (actionType: string) => {
  switch (actionType) {
    case 'approve_form':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'disapprove_form':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'assign_form':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'send_email':
    case 'send_notification':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'send_sms':
      return 'bg-pink-100 text-pink-800 border-pink-200';
    case 'trigger_webhook':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'update_form_lifecycle_status':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'set_field_values':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'log_event':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'change_field_value':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'change_record_status':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'create_record':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'create_linked_record':
      return 'bg-violet-100 text-violet-800 border-violet-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
};

const getActionLabel = (actionType: string) => {
  switch (actionType) {
    case 'approve_form': return 'Approve Form';
    case 'disapprove_form': return 'Disapprove Form';
    case 'assign_form': return 'Assign Form';
    case 'send_email': return 'Send Email';
    case 'send_notification': return 'Send Notification';
    case 'send_sms': return 'Send SMS';
    case 'trigger_webhook': return 'Trigger Webhook';
    case 'update_form_lifecycle_status': return 'Update Lifecycle Status';
    case 'set_field_values': return 'Set Field Values';
    case 'log_event': return 'Log Event';
    case 'update_workflow_variable': return 'Update Variable';
    case 'wait_for_completion': return 'Wait for Completion';
    case 'change_field_value': return 'Change Field';
    case 'change_record_status': return 'Change Status';
    case 'create_record': return 'Create Record';
    case 'create_linked_record': return 'Create Linked Record';
    default: return 'Action';
  }
};

export const ActionNode = React.memo(function ActionNode({ data }: ActionNodeProps) {
  const actionType = data.config?.actionType || 'action';
  const Icon = getActionIcon(actionType);
  const colorClass = getActionColor(actionType);
  const actionLabel = getActionLabel(actionType);

  const getDisplayText = () => {
    const config = data.config;
    
    if (config?.targetFormName) {
      if (actionType === 'update_form_lifecycle_status') {
        return `${actionLabel}: ${config.targetFormName} → ${config.newStatus || 'status'}`;
      }
      return `${actionLabel}: ${config.targetFormName}`;
    }
    
    if (config?.assignToUserEmail) {
      return `${actionLabel} → ${config.assignToUserEmail}`;
    }
    
    if (config?.notificationConfig?.subject) {
      const recipient = config.notificationConfig.recipient === 'form_submitter' 
        ? 'submitter' 
        : config.notificationConfig.specificEmail || 'user';
      return `${actionLabel}: ${config.notificationConfig.subject} → ${recipient}`;
    }
    
    if (config?.webhookConfig?.url) {
      return `${actionLabel}: ${config.webhookConfig.url}`;
    }
    
    if (actionType === 'change_field_value') {
      const field = config.targetFieldName || config.targetFieldId || 'field';
      const form = config.targetFormName || 'form';
      const value = config.valueType === 'static' 
        ? config.staticValue 
        : `{${config.dynamicValuePath}}`;
      return `Update ${field} in ${form} to ${value}`;
    }
    
    if (actionType === 'change_record_status') {
      const form = config.targetFormName || 'form';
      const status = config.newStatus || 'status';
      return `Change ${form} record to ${status}`;
    }
    
    if (actionType === 'create_record') {
      const form = config.targetFormName || 'form';
      const count = config.recordCount || 1;
      const fieldCount = config.fieldValues?.length || 0;
      return `Create ${count} record${count > 1 ? 's' : ''} in ${form}${fieldCount > 0 ? ` with ${fieldCount} field${fieldCount > 1 ? 's' : ''}` : ''}`;
    }
    
    if (actionType === 'create_linked_record') {
      const crossRefField = config.crossReferenceFieldName || 'cross-reference field';
      const targetForm = config.targetFormName || 'child form';
      return `Create linked record in ${targetForm} via ${crossRefField}`;
    }
    
    return 'Click to configure';
  };

  const handleClick = useCallback(() => {
    data.onSelect.current(data.nodeId);
  }, [data.nodeId, data.onSelect]);

  return (
    <div 
      className={`px-4 py-2 shadow-md rounded-md border-2 min-w-[150px] max-w-[220px] cursor-pointer ${colorClass}`}
      onClick={handleClick}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-gray-500"
      />
      <div className="flex items-center space-x-2">
        <Icon className="h-4 w-4" />
        <div className="font-medium">{data.label}</div>
      </div>
      <div className="text-xs mt-1 opacity-75">
        {getDisplayText()}
      </div>
      {data.config?.description && (
        <div className="text-xs mt-1 opacity-60 italic line-clamp-2 break-words w-full whitespace-normal">
          {data.config.description}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-gray-500"
      />
    </div>
  );
});

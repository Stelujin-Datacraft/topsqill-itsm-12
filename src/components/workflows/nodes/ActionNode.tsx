
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Settings, CheckCircle, XCircle, Mail, MessageSquare, Webhook, FileText, Edit, Activity, Bell, RefreshCw } from 'lucide-react';

interface ActionNodeProps {
  data: {
    label: string;
    config: any;
    onSelect: () => void;
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
    default: return 'Action';
  }
};

export function ActionNode({ data }: ActionNodeProps) {
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
    
    return 'Click to configure';
  };

  return (
    <div 
      className={`px-4 py-2 shadow-md rounded-md border-2 min-w-[150px] cursor-pointer ${colorClass}`}
      onClick={data.onSelect}
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
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-gray-500"
      />
    </div>
  );
}

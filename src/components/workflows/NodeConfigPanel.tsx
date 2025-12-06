import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Trash2, Save, Sparkles } from 'lucide-react';
import { WorkflowNode } from '@/types/workflow';
import { FormSelector } from './FormSelector';
import { UserSelector } from './UserSelector';
import { EnhancedUserSelector } from './EnhancedUserSelector';
import { FormStatusSelector } from './FormStatusSelector';
import { FormFieldSelector } from './FormFieldSelector';
import { DynamicFieldSelector } from './DynamicFieldSelector';
import { WorkflowEmailTemplateSelector } from './WorkflowEmailTemplateSelector';
import { EnhancedConditionBuilder } from './conditions/EnhancedConditionBuilder';
import { DynamicValueInput } from './conditions/DynamicValueInput';
import { useTriggerManagement } from '@/hooks/useTriggerManagement';
import { useToast } from '@/hooks/use-toast';
import { EnhancedCondition } from '@/types/conditions';
import { FormFieldOption } from '@/types/conditions';

interface NodeConfigPanelProps {
  node: WorkflowNode;
  workflowId?: string;
  projectId?: string;
  triggerFormId?: string;
  formFields?: Array<{ id: string; label: string; type: string }>;
  onConfigChange: (config: any) => void;
  onDelete: () => void;
  onClose: () => void;
  onSave: () => void;
}

export function NodeConfigPanel({ node, workflowId, projectId, triggerFormId, formFields = [], onConfigChange, onDelete, onClose, onSave }: NodeConfigPanelProps) {
  const { createTrigger, deleteTrigger, loading } = useTriggerManagement();
  const { toast } = useToast();

  const handleConfigUpdate = (key: string, value: any) => {
    console.log('🔧 Updating node config:', { key, value, nodeId: node.id });
    const newConfig = { ...node.data.config, [key]: value };
    onConfigChange(newConfig);
  };

  const handleFormSelection = async (formId: string, formName: string) => {
    const newConfig = { 
      ...node.data.config, 
      triggerFormId: formId,
      triggerFormName: formName
    };
    onConfigChange(newConfig);

    // Auto-create trigger for start nodes
    if (node.type === 'start' && workflowId && node.data.config?.triggerType) {
      await createWorkflowTrigger(formId, node.data.config.triggerType);
    }
  };

  const handleTriggerTypeChange = async (triggerType: string) => {
    handleConfigUpdate('triggerType', triggerType);

    // Auto-create trigger if form is already selected
    if (node.type === 'start' && workflowId && node.data.config?.triggerFormId) {
      await createWorkflowTrigger(node.data.config.triggerFormId, triggerType);
    }
  };

  const createWorkflowTrigger = async (formId: string, triggerType: string) => {
    if (!workflowId || !formId || !triggerType) return;

    // Map trigger types to database format
    const triggerTypeMap: Record<string, 'onFormSubmit' | 'onFormCompletion' | 'onFormApproval' | 'onFormRejection'> = {
      'form_submission': 'onFormSubmit',
      'form_completion': 'onFormCompletion',
      'form_approval': 'onFormApproval',
      'form_rejection': 'onFormRejection'
    };

    const dbTriggerType = triggerTypeMap[triggerType];
    if (!dbTriggerType) return;

    try {
      await createTrigger(workflowId, dbTriggerType, formId, {
        nodeId: node.id,
        nodeType: node.type
      });
      
      toast({
        title: "Trigger Created",
        description: "Workflow trigger has been created successfully.",
      });
    } catch (error) {
      console.error('Error creating trigger:', error);
      toast({
        title: "Error",
        description: "Failed to create workflow trigger.",
        variant: "destructive",
      });
    }
  };

  const validateActionConfig = () => {
    if (node.type === 'action') {
      const actionType = node.data.config?.actionType;
      
      if (actionType === 'assign_form') {
        if (!node.data.config?.targetFormId) {
          toast({
            title: "Configuration Error",
            description: "Please select a target form for assignment.",
            variant: "destructive",
          });
          return false;
        }
        if (!node.data.config?.assignmentConfig) {
          toast({
            title: "Configuration Error", 
            description: "Please configure assignment settings.",
            variant: "destructive",
          });
          return false;
        }
      }

      if (actionType === 'change_field_value') {
        if (!node.data.config?.targetFormId) {
          toast({ title: "Error", description: "Please select a target form", variant: "destructive" });
          return false;
        }
        if (!node.data.config?.targetFieldId) {
          toast({ title: "Error", description: "Please select a field to update", variant: "destructive" });
          return false;
        }
        if (!node.data.config?.valueType) {
          toast({ title: "Error", description: "Please select a value type", variant: "destructive" });
          return false;
        }
        if (node.data.config.valueType === 'static' && !node.data.config?.staticValue) {
          toast({ title: "Error", description: "Please enter a static value", variant: "destructive" });
          return false;
        }
        if (node.data.config.valueType === 'dynamic' && !node.data.config?.dynamicValuePath) {
          toast({ title: "Error", description: "Please enter a dynamic value path", variant: "destructive" });
          return false;
        }
      }
      
      if (actionType === 'change_record_status') {
        if (!node.data.config?.targetFormId) {
          toast({ title: "Error", description: "Please select a target form", variant: "destructive" });
          return false;
        }
        if (!node.data.config?.newStatus) {
          toast({ title: "Error", description: "Please select a new status", variant: "destructive" });
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = () => {
    if (validateActionConfig()) {
      onSave();
    }
  };

  const renderNodeSpecificConfig = () => {
    switch (node.type) {
      case 'start':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="triggerType">Trigger Type</Label>
              <Select 
                value={node.data.config?.triggerType || 'form_submission'} 
                onValueChange={handleTriggerTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select trigger type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="form_submission">Form Submission</SelectItem>
                  <SelectItem value="form_completion">Form Completion</SelectItem>
                  <SelectItem value="rule_success">Rule Success</SelectItem>
                  <SelectItem value="rule_failure">Rule Failure</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(!node.data.config?.triggerType || node.data.config?.triggerType === 'form_submission' || node.data.config?.triggerType === 'form_completion') && (
              <div>
                <Label htmlFor="triggerForm">Select Form</Label>
                <FormSelector
                  value={node.data.config?.triggerFormId || ''}
                  onValueChange={handleFormSelection}
                  placeholder="Select a form to trigger this workflow"
                />
                {node.data.config?.triggerFormId && (
                  <p className="text-xs text-green-600 mt-2">
                    ✓ Trigger will be automatically created for this form
                  </p>
                )}
              </div>
            )}
          </div>
        );

      case 'action':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="actionType">Action Type</Label>
              <Select 
                value={node.data.config?.actionType || 'approve_form'} 
                onValueChange={(value) => handleConfigUpdate('actionType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select action type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approve_form">Approve Form</SelectItem>
                  <SelectItem value="assign_form">Assign Form</SelectItem>
                  <SelectItem value="update_form_lifecycle_status">Update Form Lifecycle Status</SelectItem>
                  <SelectItem value="send_notification">Send Notification</SelectItem>
                  <SelectItem value="change_field_value">Change Field Value</SelectItem>
                  <SelectItem value="change_record_status">Change Record Status</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Approve Form Configuration */}
            {(!node.data.config?.actionType || node.data.config?.actionType === 'approve_form') && (
              <div>
                <Label htmlFor="targetForm">Form to Approve</Label>
                <FormSelector
                  value={node.data.config?.targetFormId || ''}
                  onValueChange={(formId, formName) => {
                    const newConfig = { 
                      ...node.data.config, 
                      targetFormId: formId,
                      targetFormName: formName
                    };
                    onConfigChange(newConfig);
                  }}
                  placeholder="Select form to approve"
                />
              </div>
            )}

            {/* Assign Form Configuration */}
            {node.data.config?.actionType === 'assign_form' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="targetForm">Form to Assign *</Label>
                  <FormSelector
                    value={node.data.config?.targetFormId || ''}
                    onValueChange={(formId, formName) => {
                      console.log('📝 Form selected for assignment:', { formId, formName });
                      const newConfig = { 
                        ...node.data.config, 
                        targetFormId: formId,
                        targetFormName: formName
                      };
                      onConfigChange(newConfig);
                    }}
                    placeholder="Select form to assign"
                  />
                  {!node.data.config?.targetFormId && (
                    <p className="text-xs text-red-500 mt-1">Required: Please select a form to assign</p>
                  )}
                </div>
                
                <div>
                  <Label>Assignment Configuration *</Label>
                  <EnhancedUserSelector
                    value={node.data.config?.assignmentConfig || { type: 'form_submitter' }}
                    onValueChange={(value) => {
                      console.log('📝 Assignment config being saved:', value);
                      const newConfig = { 
                        ...node.data.config, 
                        assignmentConfig: value
                      };
                      console.log('📝 Updated node config:', newConfig);
                      onConfigChange(newConfig);
                    }}
                    triggerFormId={triggerFormId}
                    formFields={formFields}
                  />
                </div>
              </div>
            )}

            {/* Update Form Lifecycle Status Configuration */}
            {node.data.config?.actionType === 'update_form_lifecycle_status' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="targetForm">Target Form</Label>
                  <FormSelector
                    value={node.data.config?.targetFormId || ''}
                    onValueChange={(formId, formName) => {
                      const newConfig = { 
                        ...node.data.config, 
                        targetFormId: formId,
                        targetFormName: formName
                      };
                      onConfigChange(newConfig);
                    }}
                    placeholder="Select form to update lifecycle status"
                  />
                </div>
                <div>
                  <FormStatusSelector
                    value={node.data.config?.newStatus || 'active'}
                    onValueChange={(value) => handleConfigUpdate('newStatus', value)}
                  />
                </div>
                {node.data.config?.targetFormId && node.data.config?.newStatus && (
                  <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                    <strong>Configuration:</strong> Update {node.data.config.targetFormName || 'selected form'} lifecycle status to {node.data.config.newStatus}
                  </div>
                )}
              </div>
            )}

            {/* Send Notification Configuration */}
            {node.data.config?.actionType === 'send_notification' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="notificationType">Notification Type</Label>
                  <Select 
                    value={node.data.config?.notificationConfig?.type || 'in_app'} 
                    onValueChange={(value) => handleConfigUpdate('notificationConfig', { 
                      ...node.data.config?.notificationConfig, 
                      type: value,
                      // Clear template when switching to in_app
                      ...(value === 'in_app' ? { emailTemplateId: undefined, emailTemplateName: undefined } : {})
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select notification type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="in_app">In-App Notification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Email Template Selector - only show for email type */}
                {node.data.config?.notificationConfig?.type === 'email' && (
                  <WorkflowEmailTemplateSelector
                    projectId={projectId}
                    value={node.data.config?.notificationConfig?.emailTemplateId}
                    onValueChange={(templateId, templateName, templateSubject) => {
                      handleConfigUpdate('notificationConfig', {
                        ...node.data.config?.notificationConfig,
                        emailTemplateId: templateId,
                        emailTemplateName: templateName,
                        subject: templateSubject
                      });
                    }}
                  />
                )}

                {/* Send To - only show for in_app notifications */}
                {node.data.config?.notificationConfig?.type !== 'email' && (
                  <div className="space-y-2">
                    <Label>Send To</Label>
                    <EnhancedUserSelector
                      value={node.data.config?.notificationConfig?.recipientConfig || { type: 'form_submitter', emails: [], dynamicFieldPath: '' }}
                      onValueChange={(config) => handleConfigUpdate('notificationConfig', {
                        ...node.data.config?.notificationConfig,
                        recipientConfig: config
                      })}
                      triggerFormId={node.data.config?.notificationConfig?.triggerFormId}
                      formFields={formFields}
                    />
                  </div>
                )}

                {/* Subject - only show for in_app notifications */}
                {node.data.config?.notificationConfig?.type !== 'email' && (
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={node.data.config?.notificationConfig?.subject || ''}
                      onChange={(e) => handleConfigUpdate('notificationConfig', {
                        ...node.data.config?.notificationConfig,
                        subject: e.target.value
                      })}
                      placeholder="Enter notification subject"
                    />
                  </div>
                )}

                {/* Message - only show for in_app notifications */}
                {node.data.config?.notificationConfig?.type !== 'email' && (
                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      value={node.data.config?.notificationConfig?.message || ''}
                      onChange={(e) => handleConfigUpdate('notificationConfig', {
                        ...node.data.config?.notificationConfig,
                        message: e.target.value
                      })}
                      placeholder="Enter notification message"
                    />
                  </div>
                )}

                {/* Configuration summary */}
                {((node.data.config?.notificationConfig?.type === 'email' && node.data.config?.notificationConfig?.emailTemplateId) ||
                  (node.data.config?.notificationConfig?.type !== 'email' && node.data.config?.notificationConfig?.subject && node.data.config?.notificationConfig?.message)) && (
                  <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                    <strong>Configuration:</strong> Send {node.data.config.notificationConfig.type} notification 
                    {node.data.config.notificationConfig.type === 'email' && node.data.config.notificationConfig.emailTemplateName && (
                      <> using template "{node.data.config.notificationConfig.emailTemplateName}"</>
                    )} to {
                      node.data.config.notificationConfig.recipient === 'form_submitter' 
                        ? 'form submitter' 
                        : node.data.config.notificationConfig.specificEmail || 'specified user'
                    }
                  </div>
                )}
              </div>
            )}

            {/* Change Field Value Configuration */}
            {node.data.config?.actionType === 'change_field_value' && (
              <div className="space-y-4">
                <div>
                  <Label>Target Form *</Label>
                  <FormSelector
                    value={node.data.config?.targetFormId || ''}
                    onValueChange={(formId, formName) => {
                      const newConfig = { 
                        ...node.data.config, 
                        targetFormId: formId,
                        targetFormName: formName,
                        targetFieldId: undefined
                      };
                      onConfigChange(newConfig);
                    }}
                    placeholder="Select form to update"
                  />
                </div>

                {node.data.config?.targetFormId && (
                  <div>
                    <Label>Field to Update *</Label>
                    <FormFieldSelector
                      formId={node.data.config.targetFormId}
                      value={node.data.config?.targetFieldId || ''}
                      onValueChange={(fieldId, fieldName, fieldType, fieldOptions) => {
                        console.log('🎯 Updating field config:', { fieldId, fieldName, fieldType, fieldOptions });
                        const newConfig = {
                          ...node.data.config,
                          targetFieldId: fieldId,
                          targetFieldName: fieldName,
                          targetFieldType: fieldType,
                          targetFieldOptions: fieldOptions
                        };
                        console.log('📝 New config:', newConfig);
                        onConfigChange(newConfig);
                      }}
                      placeholder="Select field to change"
                    />
                  </div>
                )}

                {node.data.config?.targetFieldId && (
                  <div>
                    <Label>Value Type *</Label>
                    <Select 
                      value={node.data.config?.valueType || 'static'} 
                      onValueChange={(value) => handleConfigUpdate('valueType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select value type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="static">Static Value</SelectItem>
                        <SelectItem value="dynamic">Dynamic (from trigger data)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {node.data.config?.valueType === 'static' && node.data.config?.targetFieldType && (
                  <div>
                    <DynamicValueInput
                      field={{
                        id: node.data.config.targetFieldId,
                        label: node.data.config.targetFieldName || 'Field',
                        type: node.data.config.targetFieldType,
                        options: node.data.config.targetFieldOptions || []
                      } as FormFieldOption}
                      value={node.data.config?.staticValue || ''}
                      onChange={(value) => handleConfigUpdate('staticValue', value)}
                    />
                  </div>
                )}

                {node.data.config?.valueType === 'dynamic' && (
                  <DynamicFieldSelector
                    triggerFormId={triggerFormId}
                    targetFormId={node.data.config?.targetFormId}
                    targetFieldType={node.data.config?.targetFieldType}
                    value={node.data.config?.dynamicValuePath || ''}
                    onValueChange={(fieldId, fieldName, sourceForm) => {
                      handleConfigUpdate('dynamicValuePath', fieldId);
                      handleConfigUpdate('dynamicFieldName', fieldName);
                      handleConfigUpdate('dynamicSourceForm', sourceForm);
                    }}
                    placeholder="Select compatible field"
                  />
                )}

                {node.data.config?.targetFieldId && node.data.config?.valueType && (
                  <div className="text-xs text-blue-600 bg-blue-50 p-3 rounded">
                    <strong>Configuration:</strong> Will update field "{node.data.config.targetFieldName || node.data.config.targetFieldId}" 
                    in "{node.data.config.targetFormName}" to {node.data.config.valueType === 'static' 
                      ? `"${node.data.config.staticValue}"` 
                      : `value from field "${node.data.config.dynamicFieldName || node.data.config.dynamicValuePath}"${node.data.config.dynamicSourceForm ? ` (${node.data.config.dynamicSourceForm} form)` : ''}`}
                  </div>
                )}
              </div>
            )}

            {/* Change Record Status Configuration */}
            {node.data.config?.actionType === 'change_record_status' && (
              <div className="space-y-4">
                <div>
                  <Label>Target Form *</Label>
                  <FormSelector
                    value={node.data.config?.targetFormId || ''}
                    onValueChange={(formId, formName) => {
                      const newConfig = { 
                        ...node.data.config, 
                        targetFormId: formId,
                        targetFormName: formName
                      };
                      onConfigChange(newConfig);
                    }}
                    placeholder="Select form"
                  />
                </div>

                {node.data.config?.targetFormId && (
                  <div>
                    <Label>New Status *</Label>
                    <Select 
                      value={node.data.config?.newStatus || 'pending'} 
                      onValueChange={(value) => handleConfigUpdate('newStatus', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {node.data.config?.targetFormId && (
                  <div>
                    <Label>Status Notes (Optional)</Label>
                    <Textarea
                      value={node.data.config?.statusNotes || ''}
                      onChange={(e) => handleConfigUpdate('statusNotes', e.target.value)}
                      placeholder="Add notes about this status change..."
                      rows={3}
                    />
                  </div>
                )}

                {node.data.config?.targetFormId && node.data.config?.newStatus && (
                  <div className="text-xs text-blue-600 bg-blue-50 p-3 rounded">
                    <strong>Configuration:</strong> Will change the status of submissions in "{node.data.config.targetFormName}" to "{node.data.config.newStatus}"
                    {node.data.config.statusNotes && ` with notes: "${node.data.config.statusNotes}"`}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'approval':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="approvalAction">Approval Action</Label>
              <Select 
                value={node.data.config?.approvalAction || 'approve'} 
                onValueChange={(value) => handleConfigUpdate('approvalAction', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select approval action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approve">Approve</SelectItem>
                  <SelectItem value="disapprove">Disapprove</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="targetForm">Target Form</Label>
              <FormSelector
                value={node.data.config?.targetFormId || ''}
                onValueChange={(formId, formName) => {
                  const newConfig = { 
                    ...node.data.config, 
                    targetFormId: formId,
                    targetFormName: formName
                  };
                  onConfigChange(newConfig);
                }}
                placeholder="Select form to approve/disapprove"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={node.data.config?.notes || ''}
                onChange={(e) => handleConfigUpdate('notes', e.target.value)}
                placeholder="Enter approval/disapproval notes"
              />
            </div>

            {node.data.config?.targetFormId && node.data.config?.approvalAction && (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                <strong>Configuration:</strong> {node.data.config.approvalAction === 'approve' ? 'Approve' : 'Disapprove'} submissions for {node.data.config.targetFormName || 'selected form'}
                {node.data.config.notes && <div className="mt-1"><strong>Notes:</strong> {node.data.config.notes}</div>}
              </div>
            )}
          </div>
        );

      case 'form-assignment':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="targetForm">Form to Assign</Label>
              <FormSelector
                value={node.data.config?.targetFormId || ''}
                onValueChange={(formId, formName) => {
                  const newConfig = { 
                    ...node.data.config, 
                    targetFormId: formId,
                    targetFormName: formName
                  };
                  onConfigChange(newConfig);
                }}
                placeholder="Select form to assign"
              />
            </div>
            <div>
              <Label htmlFor="actionType">Assignment Type</Label>
              <Select 
                value={node.data.config?.actionType || 'assign_form'} 
                onValueChange={(value) => handleConfigUpdate('actionType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assign_form">Assign Form</SelectItem>
                  <SelectItem value="approve_form">Approve Form</SelectItem>
                  <SelectItem value="update_status">Update Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'notification':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="notificationType">Notification Type</Label>
              <Select 
                value={node.data.config?.notificationConfig?.type || 'email'} 
                onValueChange={(value) => handleConfigUpdate('notificationConfig', { 
                  ...node.data.config?.notificationConfig, 
                  type: value 
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select notification type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="in_app">In-App</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={node.data.config?.notificationConfig?.message || ''}
                onChange={(e) => handleConfigUpdate('notificationConfig', {
                  ...node.data.config?.notificationConfig,
                  message: e.target.value
                })}
                placeholder="Enter notification message"
              />
            </div>
          </div>
        );

      case 'condition':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Enhanced Condition Builder</span>
              </div>
              <p className="text-xs text-blue-700">
                Build intuitive conditions with form-aware inputs and smart field detection
              </p>
            </div>
            
            <EnhancedConditionBuilder
              value={node.data.config?.enhancedCondition}
              onChange={(enhancedCondition: EnhancedCondition) => {
                console.log('🔧 Enhanced condition updated in NodeConfigPanel:', enhancedCondition);
                const newConfig = {
                  ...node.data.config,
                  enhancedCondition,
                  conditionType: 'enhanced'
                };
                console.log('🔧 Calling onConfigChange with:', newConfig);
                onConfigChange(newConfig);
              }}
            />
            
            {node.data.config?.enhancedCondition && (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded mt-2">
                <strong>Preview:</strong> {
                  node.data.config.enhancedCondition.systemType === 'form_level' 
                    ? `Form-level condition configured` 
                    : `Field-level condition configured`
                }
              </div>
            )}
          </div>
        );

      case 'wait':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="waitDuration">Duration</Label>
              <Input
                id="waitDuration"
                type="number"
                value={node.data.config?.waitDuration || ''}
                onChange={(e) => handleConfigUpdate('waitDuration', parseInt(e.target.value))}
                placeholder="Enter duration"
              />
            </div>
            <div>
              <Label htmlFor="waitUnit">Unit</Label>
              <Select 
                value={node.data.config?.waitUnit || 'minutes'} 
                onValueChange={(value) => handleConfigUpdate('waitUnit', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      default:
        return <p className="text-sm text-slate-500">No configuration options available</p>;
    }
  };

  return (
    <Card className="w-80 h-full rounded-none border-l">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Configure Node</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="nodeLabel">Node Label</Label>
          <Input
            id="nodeLabel"
            value={node.label}
            onChange={(e) => onConfigChange({ ...node.data.config, label: e.target.value })}
            placeholder="Enter node label"
          />
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Node Configuration</h4>
          {renderNodeSpecificConfig()}
        </div>

        <div className="border-t pt-4 space-y-2">
          <Button onClick={handleSave} className="w-full" variant="outline" disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Save Workflow
          </Button>
          <Button variant="destructive" onClick={onDelete} className="w-full">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Node
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

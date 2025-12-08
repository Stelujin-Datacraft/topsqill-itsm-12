import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Trash2, Save, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
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
  const [isExpanded, setIsExpanded] = useState(false);

  // Use local state for the config to prevent re-renders from parent
  const [localConfig, setLocalConfig] = useState<any>(() => node.data.config || {});
  
  // Keep a ref to the onConfigChange to avoid stale closures
  const onConfigChangeRef = useRef(onConfigChange);
  onConfigChangeRef.current = onConfigChange;
  
  // Track if we need to sync back to parent
  const pendingUpdateRef = useRef<any>(null);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local config to parent with debouncing
  const syncToParent = useCallback((newConfig: any) => {
    pendingUpdateRef.current = newConfig;
    
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }
    
    updateTimerRef.current = setTimeout(() => {
      if (pendingUpdateRef.current) {
        console.log('🔄 Syncing config to parent:', pendingUpdateRef.current);
        onConfigChangeRef.current(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
    }, 100);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      // Final sync on unmount
      if (pendingUpdateRef.current) {
        onConfigChangeRef.current(pendingUpdateRef.current);
      }
    };
  }, []);

  // Update local config and schedule parent sync
  const handleConfigUpdate = useCallback((key: string, value: any) => {
    console.log('🔧 Updating local config:', { key, value, nodeId: node.id });
    setLocalConfig((prev: any) => {
      const newConfig = { ...prev, [key]: value };
      syncToParent(newConfig);
      return newConfig;
    });
  }, [node.id, syncToParent]);

  // Handle full config replacement
  const handleFullConfigUpdate = useCallback((newConfig: any) => {
    console.log('🔧 Full config update:', newConfig);
    setLocalConfig(newConfig);
    syncToParent(newConfig);
  }, [syncToParent]);

  const handleFormSelection = useCallback((formId: string, formName: string) => {
    const newConfig = { 
      ...localConfig, 
      triggerFormId: formId,
      triggerFormName: formName
    };
    setLocalConfig(newConfig);
    syncToParent(newConfig);

    // Auto-create trigger for start nodes
    if (node.type === 'start' && workflowId && localConfig?.triggerType) {
      createWorkflowTrigger(formId, localConfig.triggerType);
    }
  }, [localConfig, node.type, workflowId, syncToParent]);

  const handleTriggerTypeChange = useCallback((triggerType: string) => {
    handleConfigUpdate('triggerType', triggerType);

    // Auto-create trigger if form is already selected
    if (node.type === 'start' && workflowId && localConfig?.triggerFormId) {
      createWorkflowTrigger(localConfig.triggerFormId, triggerType);
    }
  }, [handleConfigUpdate, node.type, workflowId, localConfig?.triggerFormId]);

  const createWorkflowTrigger = async (formId: string, triggerType: string) => {
    if (!workflowId || !formId || !triggerType) return;

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

  const validateActionConfig = useCallback(() => {
    if (node.type === 'action') {
      const actionType = localConfig?.actionType;
      
      if (actionType === 'assign_form') {
        if (!localConfig?.targetFormId) {
          toast({
            title: "Configuration Error",
            description: "Please select a target form for assignment.",
            variant: "destructive",
          });
          return false;
        }
        if (!localConfig?.assignmentConfig) {
          toast({
            title: "Configuration Error", 
            description: "Please configure assignment settings.",
            variant: "destructive",
          });
          return false;
        }
      }

      if (actionType === 'change_field_value') {
        if (!localConfig?.targetFormId) {
          toast({ title: "Error", description: "Please select a target form", variant: "destructive" });
          return false;
        }
        if (!localConfig?.targetFieldId) {
          toast({ title: "Error", description: "Please select a field to update", variant: "destructive" });
          return false;
        }
        if (!localConfig?.valueType) {
          toast({ title: "Error", description: "Please select a value type", variant: "destructive" });
          return false;
        }
        if (localConfig.valueType === 'static' && !localConfig?.staticValue) {
          toast({ title: "Error", description: "Please enter a static value", variant: "destructive" });
          return false;
        }
        if (localConfig.valueType === 'dynamic' && !localConfig?.dynamicValuePath) {
          toast({ title: "Error", description: "Please enter a dynamic value path", variant: "destructive" });
          return false;
        }
      }
      
      if (actionType === 'change_record_status') {
        if (!localConfig?.targetFormId) {
          toast({ title: "Error", description: "Please select a target form", variant: "destructive" });
          return false;
        }
        if (!localConfig?.newStatus) {
          toast({ title: "Error", description: "Please select a new status", variant: "destructive" });
          return false;
        }
      }
    }
    return true;
  }, [node.type, localConfig, toast]);

  const handleSave = useCallback(() => {
    // Force sync any pending updates before save
    if (pendingUpdateRef.current) {
      onConfigChangeRef.current(pendingUpdateRef.current);
      pendingUpdateRef.current = null;
    }
    
    if (validateActionConfig()) {
      onSave();
    }
  }, [validateActionConfig, onSave]);

  const renderNodeSpecificConfig = () => {
    switch (node.type) {
      case 'start':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="triggerType">Trigger Type</Label>
              <Select 
                value={localConfig?.triggerType || 'form_submission'} 
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
            {(!localConfig?.triggerType || localConfig?.triggerType === 'form_submission' || localConfig?.triggerType === 'form_completion') && (
              <div>
                <Label htmlFor="triggerForm">Select Form</Label>
                <FormSelector
                  value={localConfig?.triggerFormId || ''}
                  onValueChange={handleFormSelection}
                  placeholder="Select a form to trigger this workflow"
                />
                {localConfig?.triggerFormId && (
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
                value={localConfig?.actionType || 'approve_form'} 
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
            {(!localConfig?.actionType || localConfig?.actionType === 'approve_form') && (
              <div>
                <Label htmlFor="targetForm">Form to Approve</Label>
                <FormSelector
                  value={localConfig?.targetFormId || ''}
                  onValueChange={(formId, formName) => {
                    handleFullConfigUpdate({ 
                      ...localConfig, 
                      targetFormId: formId,
                      targetFormName: formName
                    });
                  }}
                  placeholder="Select form to approve"
                />
              </div>
            )}

            {/* Assign Form Configuration */}
            {localConfig?.actionType === 'assign_form' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="targetForm">Form to Assign *</Label>
                  <FormSelector
                    value={localConfig?.targetFormId || ''}
                    onValueChange={(formId, formName) => {
                      console.log('📝 Form selected for assignment:', { formId, formName });
                      handleFullConfigUpdate({ 
                        ...localConfig, 
                        targetFormId: formId,
                        targetFormName: formName
                      });
                    }}
                    placeholder="Select form to assign"
                  />
                  {!localConfig?.targetFormId && (
                    <p className="text-xs text-red-500 mt-1">Required: Please select a form to assign</p>
                  )}
                </div>
                
                <div>
                  <Label>Assignment Configuration *</Label>
                  <EnhancedUserSelector
                    value={localConfig?.assignmentConfig || { type: 'form_submitter' }}
                    onValueChange={(value) => {
                      console.log('📝 Assignment config being saved:', value);
                      handleFullConfigUpdate({ 
                        ...localConfig, 
                        assignmentConfig: value
                      });
                    }}
                    triggerFormId={triggerFormId}
                    targetFormId={localConfig?.targetFormId}
                    formFields={formFields}
                  />
                </div>
              </div>
            )}

            {/* Update Form Lifecycle Status Configuration */}
            {localConfig?.actionType === 'update_form_lifecycle_status' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="targetForm">Target Form</Label>
                  <FormSelector
                    value={localConfig?.targetFormId || ''}
                    onValueChange={(formId, formName) => {
                      handleFullConfigUpdate({ 
                        ...localConfig, 
                        targetFormId: formId,
                        targetFormName: formName
                      });
                    }}
                    placeholder="Select form to update lifecycle status"
                  />
                </div>
                <div>
                  <FormStatusSelector
                    value={localConfig?.newStatus || 'active'}
                    onValueChange={(value) => handleConfigUpdate('newStatus', value)}
                  />
                </div>
                {localConfig?.targetFormId && localConfig?.newStatus && (
                  <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                    <strong>Configuration:</strong> Update {localConfig.targetFormName || 'selected form'} lifecycle status to {localConfig.newStatus}
                  </div>
                )}
              </div>
            )}

            {/* Send Notification Configuration */}
            {localConfig?.actionType === 'send_notification' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="notificationType">Notification Type</Label>
                  <Select 
                    value={localConfig?.notificationConfig?.type || 'in_app'} 
                    onValueChange={(value) => handleConfigUpdate('notificationConfig', { 
                      ...localConfig?.notificationConfig, 
                      type: value,
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

                {localConfig?.notificationConfig?.type === 'email' && (
                  <WorkflowEmailTemplateSelector
                    projectId={projectId}
                    value={localConfig?.notificationConfig?.emailTemplateId}
                    onValueChange={(templateId, templateName, templateSubject) => {
                      handleConfigUpdate('notificationConfig', {
                        ...localConfig?.notificationConfig,
                        emailTemplateId: templateId,
                        emailTemplateName: templateName,
                        subject: templateSubject
                      });
                    }}
                  />
                )}

                {localConfig?.notificationConfig?.type !== 'email' && (
                  <div className="space-y-2">
                    <Label>Send To</Label>
                    <EnhancedUserSelector
                      value={localConfig?.notificationConfig?.recipientConfig || { type: 'form_submitter', emails: [], dynamicFieldPath: '' }}
                      onValueChange={(config) => handleConfigUpdate('notificationConfig', {
                        ...localConfig?.notificationConfig,
                        recipientConfig: config
                      })}
                      triggerFormId={triggerFormId}
                      targetFormId={localConfig?.notificationConfig?.targetFormId}
                      formFields={formFields}
                    />
                  </div>
                )}

                {localConfig?.notificationConfig?.type !== 'email' && (
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={localConfig?.notificationConfig?.subject || ''}
                      onChange={(e) => handleConfigUpdate('notificationConfig', {
                        ...localConfig?.notificationConfig,
                        subject: e.target.value
                      })}
                      placeholder="Enter notification subject"
                    />
                  </div>
                )}

                {localConfig?.notificationConfig?.type !== 'email' && (
                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      value={localConfig?.notificationConfig?.message || ''}
                      onChange={(e) => handleConfigUpdate('notificationConfig', {
                        ...localConfig?.notificationConfig,
                        message: e.target.value
                      })}
                      placeholder="Enter notification message"
                    />
                  </div>
                )}

                {((localConfig?.notificationConfig?.type === 'email' && localConfig?.notificationConfig?.emailTemplateId) ||
                  (localConfig?.notificationConfig?.type !== 'email' && localConfig?.notificationConfig?.subject && localConfig?.notificationConfig?.message)) && (
                  <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                    <strong>Configuration:</strong> Send {localConfig.notificationConfig.type} notification 
                    {localConfig.notificationConfig.type === 'email' && localConfig.notificationConfig.emailTemplateName && (
                      <> using template "{localConfig.notificationConfig.emailTemplateName}"</>
                    )} to {
                      localConfig.notificationConfig.recipient === 'form_submitter' 
                        ? 'form submitter' 
                        : localConfig.notificationConfig.specificEmail || 'specified user'
                    }
                  </div>
                )}
              </div>
            )}

            {/* Change Field Value Configuration */}
            {localConfig?.actionType === 'change_field_value' && (
              <div className="space-y-4">
                <div>
                  <Label>Target Form *</Label>
                  <FormSelector
                    value={localConfig?.targetFormId || ''}
                    onValueChange={(formId, formName) => {
                      handleFullConfigUpdate({ 
                        ...localConfig, 
                        targetFormId: formId,
                        targetFormName: formName,
                        targetFieldId: undefined
                      });
                    }}
                    placeholder="Select form to update"
                  />
                </div>

                {localConfig?.targetFormId && (
                  <div>
                    <Label>Field to Update *</Label>
                    <FormFieldSelector
                      formId={localConfig.targetFormId}
                      value={localConfig?.targetFieldId || ''}
                      onValueChange={(fieldId, fieldName, fieldType, fieldOptions) => {
                        console.log('🎯 Updating field config:', { fieldId, fieldName, fieldType, fieldOptions });
                        handleFullConfigUpdate({
                          ...localConfig,
                          targetFieldId: fieldId,
                          targetFieldName: fieldName,
                          targetFieldType: fieldType,
                          targetFieldOptions: fieldOptions
                        });
                      }}
                      placeholder="Select field to change"
                    />
                  </div>
                )}

                {localConfig?.targetFieldId && (
                  <div>
                    <Label>Value Type *</Label>
                    <Select 
                      value={localConfig?.valueType || 'static'} 
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

                {localConfig?.valueType === 'static' && localConfig?.targetFieldType && (
                  <div>
                    <DynamicValueInput
                      field={{
                        id: localConfig.targetFieldId,
                        label: localConfig.targetFieldName || 'Field',
                        type: localConfig.targetFieldType,
                        options: localConfig.targetFieldOptions || []
                      } as FormFieldOption}
                      value={localConfig?.staticValue || ''}
                      onChange={(value) => handleConfigUpdate('staticValue', value)}
                    />
                  </div>
                )}

                {localConfig?.valueType === 'dynamic' && (
                  <DynamicFieldSelector
                    triggerFormId={triggerFormId}
                    targetFormId={localConfig?.targetFormId}
                    targetFieldType={localConfig?.targetFieldType}
                    value={localConfig?.dynamicValuePath || ''}
                    onValueChange={(fieldId, fieldName, sourceForm) => {
                      handleFullConfigUpdate({
                        ...localConfig,
                        dynamicValuePath: fieldId,
                        dynamicFieldName: fieldName,
                        dynamicSourceForm: sourceForm
                      });
                    }}
                    placeholder="Select compatible field"
                  />
                )}

                {localConfig?.targetFieldId && localConfig?.valueType && (
                  <div className="text-xs text-blue-600 bg-blue-50 p-3 rounded">
                    <strong>Configuration:</strong> Will update field "{localConfig.targetFieldName || localConfig.targetFieldId}" 
                    in "{localConfig.targetFormName}" to {localConfig.valueType === 'static' 
                      ? `"${localConfig.staticValue}"` 
                      : `value from field "${localConfig.dynamicFieldName || localConfig.dynamicValuePath}"${localConfig.dynamicSourceForm ? ` (${localConfig.dynamicSourceForm} form)` : ''}`}
                  </div>
                )}
              </div>
            )}

            {/* Change Record Status Configuration */}
            {localConfig?.actionType === 'change_record_status' && (
              <div className="space-y-4">
                <div>
                  <Label>Target Form *</Label>
                  <FormSelector
                    value={localConfig?.targetFormId || ''}
                    onValueChange={(formId, formName) => {
                      handleFullConfigUpdate({ 
                        ...localConfig, 
                        targetFormId: formId,
                        targetFormName: formName
                      });
                    }}
                    placeholder="Select form"
                  />
                </div>

                {localConfig?.targetFormId && (
                  <div>
                    <Label>New Status *</Label>
                    <Select 
                      value={localConfig?.newStatus || 'pending'} 
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

                {localConfig?.targetFormId && (
                  <div>
                    <Label>Status Notes (Optional)</Label>
                    <Textarea
                      value={localConfig?.statusNotes || ''}
                      onChange={(e) => handleConfigUpdate('statusNotes', e.target.value)}
                      placeholder="Add notes about this status change..."
                      rows={3}
                    />
                  </div>
                )}

                {localConfig?.targetFormId && localConfig?.newStatus && (
                  <div className="text-xs text-blue-600 bg-blue-50 p-3 rounded">
                    <strong>Configuration:</strong> Will change the status of submissions in "{localConfig.targetFormName}" to "{localConfig.newStatus}"
                    {localConfig.statusNotes && ` with notes: "${localConfig.statusNotes}"`}
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
                value={localConfig?.approvalAction || 'approve'} 
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
                value={localConfig?.targetFormId || ''}
                onValueChange={(formId, formName) => {
                  handleFullConfigUpdate({ 
                    ...localConfig, 
                    targetFormId: formId,
                    targetFormName: formName
                  });
                }}
                placeholder="Select form to approve/disapprove"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={localConfig?.notes || ''}
                onChange={(e) => handleConfigUpdate('notes', e.target.value)}
                placeholder="Enter approval/disapproval notes"
              />
            </div>

            {localConfig?.targetFormId && localConfig?.approvalAction && (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                <strong>Configuration:</strong> {localConfig.approvalAction === 'approve' ? 'Approve' : 'Disapprove'} submissions for {localConfig.targetFormName || 'selected form'}
                {localConfig.notes && <div className="mt-1"><strong>Notes:</strong> {localConfig.notes}</div>}
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
                value={localConfig?.targetFormId || ''}
                onValueChange={(formId, formName) => {
                  handleFullConfigUpdate({ 
                    ...localConfig, 
                    targetFormId: formId,
                    targetFormName: formName
                  });
                }}
                placeholder="Select form to assign"
              />
            </div>
            <div>
              <Label htmlFor="actionType">Assignment Type</Label>
              <Select 
                value={localConfig?.actionType || 'assign_form'} 
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
                value={localConfig?.notificationType || 'email'} 
                onValueChange={(value) => handleConfigUpdate('notificationType', value)}
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
          </div>
        );

      case 'condition':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <Label>Enhanced Condition Builder</Label>
            </div>
            
            <EnhancedConditionBuilder
              value={localConfig?.enhancedCondition}
              onChange={(condition: EnhancedCondition) => {
                handleConfigUpdate('enhancedCondition', condition);
              }}
            />
          </div>
        );

      case 'wait':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="waitType">Wait Type</Label>
              <Select 
                value={localConfig?.waitType || 'duration'} 
                onValueChange={(value) => handleConfigUpdate('waitType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select wait type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="duration">Wait Duration</SelectItem>
                  <SelectItem value="until_date">Wait Until Date</SelectItem>
                  <SelectItem value="until_event">Wait Until Event</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {localConfig?.waitType === 'duration' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="durationValue">Duration</Label>
                  <Input
                    id="durationValue"
                    type="number"
                    min="1"
                    value={localConfig?.durationValue || 1}
                    onChange={(e) => handleConfigUpdate('durationValue', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="durationUnit">Unit</Label>
                  <Select 
                    value={localConfig?.durationUnit || 'hours'} 
                    onValueChange={(value) => handleConfigUpdate('durationUnit', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="weeks">Weeks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {localConfig?.waitType === 'until_date' && (
              <div>
                <Label htmlFor="untilDate">Wait Until</Label>
                <Input
                  id="untilDate"
                  type="datetime-local"
                  value={localConfig?.untilDate || ''}
                  onChange={(e) => handleConfigUpdate('untilDate', e.target.value)}
                />
              </div>
            )}

            {localConfig?.waitType === 'until_event' && (
              <div>
                <Label htmlFor="eventType">Event Type</Label>
                <Select 
                  value={localConfig?.eventType || 'form_submission'} 
                  onValueChange={(value) => handleConfigUpdate('eventType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="form_submission">Form Submission</SelectItem>
                    <SelectItem value="form_approval">Form Approval</SelectItem>
                    <SelectItem value="manual_trigger">Manual Trigger</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        );

      case 'end':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="endStatus">End Status</Label>
              <Select 
                value={localConfig?.endStatus || 'completed'} 
                onValueChange={(value) => handleConfigUpdate('endStatus', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select end status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="summary">Summary</Label>
              <Textarea
                id="summary"
                value={localConfig?.summary || ''}
                onChange={(e) => handleConfigUpdate('summary', e.target.value)}
                placeholder="Enter workflow completion summary"
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="text-sm text-gray-500">
            Configuration not available for this node type
          </div>
        );
    }
  };

  const panelContent = (
    <>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{node.label || 'Configure Node'}</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8"
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground capitalize">{node.type} Node</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="nodeLabel">Node Label</Label>
          <Input
            id="nodeLabel"
            value={localConfig?.label || node.label || ''}
            onChange={(e) => handleConfigUpdate('label', e.target.value)}
            placeholder="Enter node label"
          />
        </div>
        
        {renderNodeSpecificConfig()}
        
        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={handleSave} className="flex-1" disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
          <Button variant="destructive" onClick={onDelete} disabled={loading}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </>
  );

  if (isExpanded) {
    return (
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{node.label || 'Configure Node'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4 p-1">
              <div>
                <Label htmlFor="nodeLabel">Node Label</Label>
                <Input
                  id="nodeLabel"
                  value={localConfig?.label || node.label || ''}
                  onChange={(e) => handleConfigUpdate('label', e.target.value)}
                  placeholder="Enter node label"
                />
              </div>
              
              {renderNodeSpecificConfig()}
              
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={handleSave} className="flex-1" disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
                <Button variant="destructive" onClick={onDelete} disabled={loading}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Card className="w-80 h-fit max-h-[calc(100vh-200px)] overflow-y-auto absolute right-4 top-4 z-10 shadow-lg border bg-card">
      {panelContent}
    </Card>
  );
}

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
import { FormRuleSelector } from './FormRuleSelector';
import { DynamicValueInput } from './conditions/DynamicValueInput';
import { CreateRecordFieldsConfig } from './CreateRecordFieldsConfig';
import { FieldMappingConfig } from './FieldMappingConfig';
import { CreateCombinationRecordsConfig } from './CreateCombinationRecordsConfig';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useTriggerManagement } from '@/hooks/useTriggerManagement';
import { useToast } from '@/hooks/use-toast';
import { useRoles } from '@/hooks/useRoles';
import { EnhancedCondition } from '@/types/conditions';
import { FormFieldOption } from '@/types/conditions';
import { supabase } from '@/integrations/supabase/client';

interface NodeConfigPanelProps {
  node: WorkflowNode;
  workflowId?: string;
  projectId?: string;
  triggerFormId?: string;
  triggerFormName?: string;
  formFields?: Array<{ id: string; label: string; type: string }>;
  onConfigChange: (config: any) => void;
  onDelete: () => void;
  onClose: () => void;
  onSave: () => void;
}

export function NodeConfigPanel({ node, workflowId, projectId, triggerFormId, triggerFormName, formFields = [], onConfigChange, onDelete, onClose, onSave }: NodeConfigPanelProps) {
  const { createTrigger, deleteTrigger, loading } = useTriggerManagement();
  const { users: organizationUsers, loading: loadingUsers } = useOrganizationUsers();
  const { roles, loading: loadingRoles } = useRoles();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);

  // Use local state for the config to prevent re-renders from parent
  // Apply defaults based on node type
  const applyNodeDefaults = useCallback((config: any, nodeType: string, actionType?: string) => {
    const result = { ...config };
    
    // Start node defaults
    if (nodeType === 'start' && !result.triggerType) {
      result.triggerType = 'form_submission';
    }
    
    // Wait node defaults
    if (nodeType === 'wait') {
      if (!result.waitType) result.waitType = 'duration';
      if (!result.durationValue) result.durationValue = 1;
      if (!result.durationUnit) result.durationUnit = 'hours';
    }
    
    // Action node defaults based on action type
    if (nodeType === 'action') {
      const action = actionType || result.actionType;
      
      if (action === 'change_field_value' && !result.valueType) {
        result.valueType = 'static';
      }
      
      if (action === 'create_record') {
        if (!result.initialStatus) result.initialStatus = 'pending';
        if (!result.setSubmittedBy) result.setSubmittedBy = 'trigger_submitter';
      }
      
      if (action === 'create_linked_record') {
        if (!result.setSubmittedBy) result.setSubmittedBy = 'trigger_submitter';
      }
      
      if (action === 'create_combination_records') {
        if (!result.combinationMode) result.combinationMode = 'single';
        if (!result.setSubmittedBy) result.setSubmittedBy = 'trigger_submitter';
      }
      
      if (action === 'update_linked_records') {
        if (!result.updateScope) result.updateScope = 'all';
      }
    }
    
    return result;
  }, []);

  const [localConfig, setLocalConfig] = useState<any>(() => {
    const config = node.data.config || {};
    return applyNodeDefaults(config, node.type, config.actionType);
  });
  
  // Re-sync local config when node changes (user clicks different node)
  const prevNodeIdRef = useRef(node.id);
  useEffect(() => {
    if (prevNodeIdRef.current !== node.id) {
      console.log('🔄 Node changed, re-initializing localConfig for:', node.id);
      prevNodeIdRef.current = node.id;
      const config = node.data.config || {};
      setLocalConfig(applyNodeDefaults(config, node.type, config.actionType));
    }
  }, [node.id, node.data.config, node.type, applyNodeDefaults]);
  
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

  // Sync defaults to parent on mount when local has defaults not yet in parent
  useEffect(() => {
    const parentConfig = node.data.config || {};
    const needsSync = (
      (node.type === 'start' && !parentConfig.triggerType && localConfig.triggerType) ||
      (node.type === 'wait' && !parentConfig.waitType && localConfig.waitType) ||
      (node.type === 'action' && localConfig.actionType && !parentConfig.valueType && localConfig.valueType)
    );
    
    if (needsSync) {
      console.log('🔄 Syncing defaults to parent:', localConfig);
      onConfigChangeRef.current(localConfig);
    }
  }, [node.type, node.data.config, localConfig]);
  
  // Handle action type changes and apply defaults
  const handleActionTypeChange = useCallback((newActionType: string) => {
    const updatedConfig = applyNodeDefaults({ ...localConfig, actionType: newActionType }, 'action', newActionType);
    setLocalConfig(updatedConfig);
    syncToParent(updatedConfig);
  }, [localConfig, applyNodeDefaults, syncToParent]);

  // Auto-fetch linked form info when sourceCrossRefFieldId is set but sourceLinkedFormId is missing
  const [linkedFormLoading, setLinkedFormLoading] = useState(false);
  
  useEffect(() => {
    const actionType = localConfig?.actionType;
    const sourceCrossRefFieldId = localConfig?.sourceCrossRefFieldId;
    const sourceLinkedFormId = localConfig?.sourceLinkedFormId;
    
    console.log('🔍 Linked form check:', { actionType, sourceCrossRefFieldId, sourceLinkedFormId });
    
    // Only for create_combination_records action with cross-ref field but missing linked form
    if (actionType !== 'create_combination_records') {
      console.log('⏭️ Skipping: not create_combination_records');
      return;
    }
    if (!sourceCrossRefFieldId) {
      console.log('⏭️ Skipping: no sourceCrossRefFieldId');
      return;
    }
    if (sourceLinkedFormId) {
      console.log('✅ Already has sourceLinkedFormId:', sourceLinkedFormId);
      return;
    }
    
    console.log('🔄 Fetching linked form for cross-ref field:', sourceCrossRefFieldId);
    setLinkedFormLoading(true);
    
    const fetchLinkedForm = async () => {
      try {
        const { data, error } = await supabase
          .from('form_fields')
          .select('custom_config')
          .eq('id', sourceCrossRefFieldId)
          .maybeSingle();
        
        console.log('📦 Fetch result:', { data, error });
        
        if (error || !data) {
          console.log('❌ Fetch failed or no data');
          setLinkedFormLoading(false);
          return;
        }
        
        // Handle case where custom_config might be a string (JSON) or already an object
        let customConfig: { targetFormId?: string; targetFormName?: string } | null = null;
        if (typeof data.custom_config === 'string') {
          try {
            customConfig = JSON.parse(data.custom_config);
          } catch (e) {
            console.log('❌ Failed to parse custom_config:', e);
          }
        } else {
          customConfig = data.custom_config as { targetFormId?: string; targetFormName?: string } | null;
        }
        console.log('📋 Custom config:', customConfig);
        
        if (customConfig?.targetFormId) {
          console.log('✅ Setting sourceLinkedFormId:', customConfig.targetFormId);
          setLocalConfig((prev: any) => ({
            ...prev,
            sourceLinkedFormId: customConfig.targetFormId,
            sourceLinkedFormName: customConfig.targetFormName || 'Unknown Form'
          }));
        }
        setLinkedFormLoading(false);
      } catch (err) {
        console.log('❌ Fetch error:', err);
        setLinkedFormLoading(false);
      }
    };
    
    fetchLinkedForm();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localConfig?.actionType, localConfig?.sourceCrossRefFieldId, localConfig?.sourceLinkedFormId]);

  // Auto-fetch field options when targetFieldId is set but options are missing (for select/radio/dropdown fields)
  useEffect(() => {
    const actionType = localConfig?.actionType;
    const targetFieldId = localConfig?.targetFieldId;
    const targetFieldType = localConfig?.targetFieldType?.toLowerCase() || '';
    const targetFieldOptions = localConfig?.targetFieldOptions;
    
    // Only for change_field_value action with select/radio/dropdown/multiselect field type
    const optionFieldTypes = ['select', 'radio', 'dropdown', 'multiselect', 'multi-select'];
    const needsOptions = optionFieldTypes.some(t => targetFieldType.includes(t));
    
    if (actionType !== 'change_field_value') return;
    if (!targetFieldId) return;
    if (!needsOptions) return;
    // Already have options
    if (Array.isArray(targetFieldOptions) && targetFieldOptions.length > 0) return;
    
    console.log('🔄 Auto-fetching field options for:', targetFieldId);
    
    const fetchFieldOptions = async () => {
      try {
        const { data, error } = await supabase
          .from('form_fields')
          .select('options, custom_config')
          .eq('id', targetFieldId)
          .maybeSingle();
        
        if (error || !data) {
          console.log('❌ Failed to fetch field options:', error);
          return;
        }
        
        let options = data.options;
        // Parse if it's a string
        if (typeof options === 'string') {
          try {
            options = JSON.parse(options);
          } catch (e) {
            console.log('❌ Failed to parse options:', e);
            options = [];
          }
        }
        
        let customConfig = data.custom_config;
        if (typeof customConfig === 'string') {
          try {
            customConfig = JSON.parse(customConfig);
          } catch (e) {
            customConfig = {};
          }
        }
        
        console.log('✅ Fetched field options:', options);
        
        if (Array.isArray(options) && options.length > 0) {
          setLocalConfig((prev: any) => ({
            ...prev,
            targetFieldOptions: options,
            targetFieldCustomConfig: customConfig || prev.targetFieldCustomConfig
          }));
        }
      } catch (err) {
        console.log('❌ Fetch error:', err);
      }
    };
    
    fetchFieldOptions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localConfig?.actionType, localConfig?.targetFieldId, localConfig?.targetFieldType, localConfig?.targetFieldOptions]);

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
    // Always ensure triggerType is set for start nodes (default to form_submission)
    const triggerType = localConfig?.triggerType || 'form_submission';
    const newConfig = { 
      ...localConfig, 
      triggerFormId: formId,
      triggerFormName: formName,
      triggerType: triggerType
    };
    setLocalConfig(newConfig);
    syncToParent(newConfig);

    // Auto-create trigger for start nodes
    if (node.type === 'start' && workflowId) {
      createWorkflowTrigger(formId, triggerType);
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

      if (actionType === 'create_record') {
        if (!localConfig?.targetFormId) {
          toast({ title: "Error", description: "Please select a target form for record creation", variant: "destructive" });
          return false;
        }
        if (!localConfig?.recordCount || localConfig.recordCount < 1) {
          toast({ title: "Error", description: "Please specify the number of records to create (at least 1)", variant: "destructive" });
          return false;
        }
        if (localConfig?.setSubmittedBy === 'specific_user' && !localConfig?.specificSubmitterId) {
          toast({ title: "Error", description: "Please select a specific user for the 'Submitted By' option", variant: "destructive" });
          return false;
        }
        if (localConfig?.fieldConfigMode === 'field_mapping') {
          const mappings = localConfig?.fieldMappings || [];
          const hasIncompleteMappings = mappings.some((m: any) => !m.sourceFieldId || !m.targetFieldId);
          if (hasIncompleteMappings) {
            toast({ title: "Error", description: "Please complete all field mappings or remove incomplete ones", variant: "destructive" });
            return false;
          }
        }
      }

      if (actionType === 'create_linked_record') {
        if (!localConfig?.crossReferenceFieldId) {
          toast({ title: "Error", description: "Please select a cross-reference field", variant: "destructive" });
          return false;
        }
        if (!localConfig?.targetFormId) {
          toast({ title: "Error", description: "Target form is required. Please ensure the cross-reference field has a target form configured.", variant: "destructive" });
          return false;
        }
        if (!localConfig?.recordCount || localConfig.recordCount < 1) {
          toast({ title: "Error", description: "Please specify the number of records to create (at least 1)", variant: "destructive" });
          return false;
        }
        if (localConfig?.setSubmittedBy === 'specific_user' && !localConfig?.specificSubmitterId) {
          toast({ title: "Error", description: "Please select a specific user for the 'Submitted By' option", variant: "destructive" });
          return false;
        }
        if (localConfig?.fieldConfigMode === 'field_mapping') {
          const mappings = localConfig?.fieldMappings || [];
          const hasIncompleteMappings = mappings.some((m: any) => !m.sourceFieldId || !m.targetFieldId);
          if (hasIncompleteMappings) {
            toast({ title: "Error", description: "Please complete all field mappings or remove incomplete ones", variant: "destructive" });
            return false;
          }
        }
      }

      if (actionType === 'update_linked_records') {
        if (!localConfig?.crossReferenceFieldId) {
          toast({ title: "Error", description: "Please select a cross-reference field", variant: "destructive" });
          return false;
        }
        if (!localConfig?.targetFormId) {
          toast({ title: "Error", description: "Target form is required. Please ensure the cross-reference field has a target form configured.", variant: "destructive" });
          return false;
        }
        if (!localConfig?.fieldMappings || localConfig.fieldMappings.length === 0) {
          toast({ title: "Error", description: "Please add at least one field mapping", variant: "destructive" });
          return false;
        }
        const mappings = localConfig?.fieldMappings || [];
        const hasIncompleteMappings = mappings.some((m: any) => !m.sourceFieldId || !m.targetFieldId);
        if (hasIncompleteMappings) {
          toast({ title: "Error", description: "Please complete all field mappings or remove incomplete ones", variant: "destructive" });
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
                <SelectContent className="bg-background z-50">
                  <SelectItem value="form_submission">Form Submission</SelectItem>
                  <SelectItem value="form_completion">Form Completion</SelectItem>
                  <SelectItem value="rule_success">Rule Success</SelectItem>
                  <SelectItem value="rule_failure">Rule Failure</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Form submission and completion triggers */}
            {(!localConfig?.triggerType || localConfig?.triggerType === 'form_submission' || localConfig?.triggerType === 'form_completion') && (
              <div>
                <Label htmlFor="triggerForm">Select Form</Label>
                <FormSelector
                  value={localConfig?.triggerFormId || ''}
                  onValueChange={handleFormSelection}
                  placeholder="Select a form to trigger this workflow"
                  projectId={projectId}
                />
                {localConfig?.triggerFormId && (
                  <p className="text-xs text-green-600 mt-2">
                    ✓ Trigger will be automatically created for this form
                  </p>
                )}
              </div>
            )}

            {/* Rule Success / Rule Failure triggers */}
            {(localConfig?.triggerType === 'rule_success' || localConfig?.triggerType === 'rule_failure') && (
              <>
                <div>
                  <Label htmlFor="triggerForm">Select Form</Label>
                  <FormSelector
                    value={localConfig?.triggerFormId || ''}
                    onValueChange={(formId, formName) => {
                      handleFullConfigUpdate({ 
                        ...localConfig, 
                        triggerFormId: formId,
                        triggerFormName: formName,
                        ruleId: '', // Reset rule when form changes
                        ruleName: ''
                      });
                    }}
                    placeholder="Select a form with rules"
                    projectId={projectId}
                  />
                </div>
                {localConfig?.triggerFormId && (
                  <div>
                    <Label htmlFor="ruleId">Select Rule</Label>
                    <FormRuleSelector
                      formId={localConfig.triggerFormId}
                      value={localConfig?.ruleId || ''}
                      onValueChange={(ruleId, ruleName) => {
                        handleFullConfigUpdate({
                          ...localConfig,
                          ruleId,
                          ruleName
                        });
                      }}
                      placeholder={localConfig?.triggerType === 'rule_success' ? "Select rule to trigger on success" : "Select rule to trigger on failure"}
                    />
                    {localConfig?.ruleId && (
                      <p className="text-xs text-green-600 mt-2">
                        ✓ Workflow will trigger when "{localConfig.ruleName}" {localConfig.triggerType === 'rule_success' ? 'passes' : 'fails'}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Manual trigger */}
            {localConfig?.triggerType === 'manual' && (
              <div className="p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-700">
                  <strong>Manual Trigger</strong>
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  This workflow will be triggered manually using the "Run Workflow" button in the workflow designer.
                </p>
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
                onValueChange={handleActionTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select action type" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="send_notification">Send Notification</SelectItem>
                  <SelectItem value="change_field_value">Change Field Value</SelectItem>
                  {/* <SelectItem value="change_record_status">Change Record Status</SelectItem> */}
                  <SelectItem value="create_record">Create Record</SelectItem>
                  <SelectItem value="create_linked_record">Create Linked Record</SelectItem>
                  <SelectItem value="update_linked_records">Update Linked Records</SelectItem>
                  <SelectItem value="create_combination_records">Create Combination Records</SelectItem>
                </SelectContent>
              </Select>
            </div>


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
                    <SelectContent className="bg-background z-50">
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
                    projectId={projectId}
                  />
                </div>

                {localConfig?.targetFormId && (
                  <div>
                    <Label>Field to Update *</Label>
                    <FormFieldSelector
                      formId={localConfig.targetFormId}
                      value={localConfig?.targetFieldId || ''}
                      onValueChange={(fieldId, fieldName, fieldType, fieldOptions, customConfig) => {
                        console.log('🎯 Updating field config:', { fieldId, fieldName, fieldType, fieldOptions, customConfig });
                        handleFullConfigUpdate({
                          ...localConfig,
                          targetFieldId: fieldId,
                          targetFieldName: fieldName,
                          targetFieldType: fieldType,
                          targetFieldOptions: fieldOptions,
                          targetFieldCustomConfig: customConfig
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
                      <SelectContent className="bg-background z-50">
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
                        options: localConfig.targetFieldOptions || [],
                        custom_config: localConfig.targetFieldCustomConfig || {}
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
                    onValueChange={(fieldId, fieldName, sourceForm, fieldType) => {
                      handleFullConfigUpdate({
                        ...localConfig,
                        dynamicValuePath: fieldId,
                        dynamicFieldName: fieldName,
                        dynamicSourceForm: sourceForm,
                        dynamicFieldType: fieldType
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
                    projectId={projectId}
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
                      <SelectContent className="bg-background z-50">
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

            {/* Create Record Configuration */}
            {localConfig?.actionType === 'create_record' && (
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
                        fieldValues: [], // Reset field values when form changes
                        fieldMappings: [], // Reset field mappings when form changes
                        fieldConfigMode: localConfig?.fieldConfigMode || 'field_values' // Ensure default mode is set
                      });
                    }}
                    placeholder="Select form to create records in"
                    projectId={projectId}
                  />
                </div>

                {localConfig?.targetFormId && (
                  <>
                    <div>
                      <Label>Number of Records *</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={localConfig?.recordCount ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            handleConfigUpdate('recordCount', '');
                          } else {
                            const num = parseInt(val);
                            if (!isNaN(num)) {
                              handleConfigUpdate('recordCount', Math.max(1, Math.min(100, num)));
                            }
                          }
                        }}
                        onBlur={() => {
                          // Ensure valid value on blur - check for empty string, null, undefined, or less than 1
                          const currentValue = localConfig?.recordCount;
                          if (currentValue === '' || currentValue === null || currentValue === undefined || (typeof currentValue === 'number' && currentValue < 1)) {
                            handleConfigUpdate('recordCount', 1);
                          }
                        }}
                        placeholder="Enter number of records to create"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Maximum 100 records per action</p>
                    </div>

                    <div>
                      <Label>Initial Status</Label>
                      <Select
                        value={localConfig?.initialStatus || 'pending'}
                        onValueChange={(value) => handleConfigUpdate('initialStatus', value)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select initial status" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="in_review">In Review</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Submitted By</Label>
                      <Select
                        value={localConfig?.setSubmittedBy || 'trigger_submitter'}
                        onValueChange={(value) => {
                          handleConfigUpdate('setSubmittedBy', value);
                          if (value !== 'specific_user') {
                            handleConfigUpdate('specificSubmitterId', undefined);
                          }
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select submitter" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="trigger_submitter">Trigger Form Submitter</SelectItem>
                          <SelectItem value="specific_user">Specific User</SelectItem>
                          <SelectItem value="system">System (No User)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">Who will be recorded as the submitter</p>
                    </div>

                    {localConfig?.setSubmittedBy === 'specific_user' && (
                      <div>
                        <Label>Select User *</Label>
                        <Select
                          value={localConfig?.specificSubmitterId || ''}
                          onValueChange={(value) => handleConfigUpdate('specificSubmitterId', value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={loadingUsers ? "Loading users..." : "Select a user"} />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            {organizationUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.first_name && user.last_name 
                                  ? `${user.first_name} ${user.last_name} (${user.email})`
                                  : user.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label>Field Configuration Mode</Label>
                      <Select
                        value={localConfig?.fieldConfigMode || 'field_values'}
                        onValueChange={(value) => {
                          handleConfigUpdate('fieldConfigMode', value);
                          // Clear the other mode's data when switching
                          if (value === 'field_values') {
                            handleConfigUpdate('fieldMappings', []);
                          } else {
                            handleConfigUpdate('fieldValues', []);
                          }
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select configuration mode" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="field_values">Set Field Values</SelectItem>
                          <SelectItem value="field_mapping">Map Fields from Trigger Form</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {localConfig?.fieldConfigMode === 'field_mapping' 
                          ? 'Map fields from the trigger form to the target form'
                          : 'Set static or dynamic values for target form fields'}
                      </p>
                    </div>

                    {localConfig?.fieldConfigMode === 'field_mapping' ? (
                      <FieldMappingConfig
                        triggerFormId={triggerFormId}
                        targetFormId={localConfig.targetFormId}
                        fieldMappings={localConfig?.fieldMappings || []}
                        onFieldMappingsChange={(mappings) => handleConfigUpdate('fieldMappings', mappings)}
                      />
                    ) : (
                      <CreateRecordFieldsConfig
                        targetFormId={localConfig.targetFormId}
                        triggerFormId={triggerFormId}
                        fieldValues={localConfig?.fieldValues || []}
                        onFieldValuesChange={(values) => handleConfigUpdate('fieldValues', values)}
                      />
                    )}
                  </>
                )}

                {localConfig?.targetFormId && (
                  <div className="text-xs text-cyan-700 bg-cyan-50 p-3 rounded border border-cyan-200">
                    <strong>Summary:</strong> Will create {localConfig.recordCount || 1} record{(localConfig.recordCount || 1) > 1 ? 's' : ''} in "{localConfig.targetFormName}"
                    {localConfig.fieldConfigMode === 'field_mapping' 
                      ? ` (mapping ${localConfig.fieldMappings?.length || 0} field${(localConfig.fieldMappings?.length || 0) !== 1 ? 's' : ''} from trigger form)`
                      : (localConfig.fieldValues?.length || 0) > 0 
                        ? ` with ${localConfig.fieldValues.length} field value${localConfig.fieldValues.length > 1 ? 's' : ''}`
                        : ' with empty/default values'}
                    {' | Status: '}{localConfig.initialStatus || 'pending'}
                    {' | By: '}{
                      localConfig.setSubmittedBy === 'system' 
                        ? 'System' 
                        : localConfig.setSubmittedBy === 'specific_user'
                          ? (organizationUsers.find(u => u.id === localConfig.specificSubmitterId)?.email || 'Selected User')
                          : 'Trigger Submitter'
                    }
                  </div>
                )}
              </div>
            )}
            {/* Create Linked Record Configuration */}
            {localConfig?.actionType === 'create_linked_record' && (
              <div className="space-y-4 border-t pt-4">
                <div className="text-xs text-violet-700 bg-violet-50 p-3 rounded border border-violet-200 mb-4">
                  <strong>Create Linked Record</strong> creates new record(s) in a child form and automatically links them back to the parent form's cross-reference field.
                </div>
                
                <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded border border-amber-200 mb-4">
                  <strong>Important:</strong> The Start Node must be configured with the <strong>Parent Form</strong> (the form containing the cross-reference field). This action will create child record(s) and link their submission reference IDs back to the parent.
                </div>

                {!triggerFormId ? (
                  <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded border border-amber-200">
                    Please configure the Start Node with a trigger form first, then <strong>save the workflow</strong>. The trigger form should be the Parent Form that contains the cross-reference field.
                  </div>
                ) : (
                  <>
                    <div>
                      <Label>Cross-Reference Field (from Parent Form) *</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Select the cross-reference field that points to the child form
                      </p>
                      <FormFieldSelector
                        formId={triggerFormId}
                        value={localConfig?.crossReferenceFieldId || ''}
                        onValueChange={(fieldId, fieldName, fieldType, fieldOptions, customConfig) => {
                          // When a cross-reference field is selected, auto-detect the target form
                          const targetFormId = customConfig?.targetFormId;
                          const targetFormName = customConfig?.targetFormName;
                          
                          handleFullConfigUpdate({
                            ...localConfig,
                            crossReferenceFieldId: fieldId,
                            crossReferenceFieldName: fieldName,
                            targetFormId: targetFormId || localConfig?.targetFormId,
                            targetFormName: targetFormName || localConfig?.targetFormName
                          });
                        }}
                        placeholder="Select cross-reference field"
                        filterTypes={['cross-reference']}
                      />
                    </div>

                    <div>
                      <Label>Number of Records *</Label>
                      <Input
                        type="number"
                        min={1}
                        value={localConfig?.recordCount ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleConfigUpdate('recordCount', val === '' ? undefined : parseInt(val, 10));
                        }}
                        placeholder="Enter number of records to create"
                        className="h-9"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        How many linked records to create (each will be linked to the parent)
                      </p>
                    </div>

                    {localConfig?.crossReferenceFieldId && (
                      <>
                        <div>
                          <Label>Target Form (Child Form)</Label>
                          <p className="text-xs text-muted-foreground mb-2">
                            {localConfig?.targetFormId 
                              ? `Auto-detected from cross-reference: ${localConfig.targetFormName || 'Unknown'}`
                              : 'Will be auto-detected from cross-reference field'
                            }
                          </p>
                          {!localConfig?.targetFormId && (
                            <FormSelector
                              value={localConfig?.targetFormId || ''}
                              onValueChange={(formId, formName) => {
                                handleFullConfigUpdate({ 
                                  ...localConfig, 
                                  targetFormId: formId,
                                  targetFormName: formName
                                });
                              }}
                              placeholder="Select target form (if not auto-detected)"
                              projectId={projectId}
                            />
                          )}
                          {localConfig?.targetFormId && (
                            <div className="text-sm p-2 bg-muted rounded">
                              {localConfig.targetFormName || localConfig.targetFormId}
                            </div>
                          )}
                        </div>

                    <div>
                      <Label>Initial Status</Label>
                      <Select
                        value={localConfig?.initialStatus || 'pending'}
                        onValueChange={(value) => handleConfigUpdate('initialStatus', value)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select initial status" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="in_review">In Review</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Submitted By</Label>
                      <Select
                        value={localConfig?.setSubmittedBy || 'trigger_submitter'}
                        onValueChange={(value) => {
                          handleConfigUpdate('setSubmittedBy', value);
                          if (value !== 'specific_user') {
                            handleConfigUpdate('specificSubmitterId', undefined);
                          }
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select submitter" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="trigger_submitter">Trigger Form Submitter</SelectItem>
                          <SelectItem value="specific_user">Specific User</SelectItem>
                          <SelectItem value="system">System (No User)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {localConfig?.setSubmittedBy === 'specific_user' && (
                      <div>
                        <Label>Select User *</Label>
                        <Select
                          value={localConfig?.specificSubmitterId || ''}
                          onValueChange={(value) => handleConfigUpdate('specificSubmitterId', value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={loadingUsers ? "Loading users..." : "Select a user"} />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            {organizationUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.first_name && user.last_name 
                                  ? `${user.first_name} ${user.last_name} (${user.email})`
                                  : user.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label>Field Configuration (Optional)</Label>
                      <Select
                        value={localConfig?.fieldConfigMode || 'none'}
                        onValueChange={(value) => {
                          handleConfigUpdate('fieldConfigMode', value);
                          if (value === 'none') {
                            handleConfigUpdate('fieldValues', []);
                            handleConfigUpdate('fieldMappings', []);
                          } else if (value === 'field_values') {
                            handleConfigUpdate('fieldMappings', []);
                          } else {
                            handleConfigUpdate('fieldValues', []);
                          }
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select configuration mode" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="none">No Additional Fields</SelectItem>
                          <SelectItem value="field_values">Set Field Values</SelectItem>
                          <SelectItem value="field_mapping">Map Fields from Trigger Form</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Optionally set additional field values for the new linked record
                      </p>
                    </div>

                    {localConfig?.fieldConfigMode === 'field_mapping' && localConfig?.targetFormId && (
                      <FieldMappingConfig
                        triggerFormId={triggerFormId}
                        targetFormId={localConfig.targetFormId}
                        fieldMappings={localConfig?.fieldMappings || []}
                        onFieldMappingsChange={(mappings) => handleConfigUpdate('fieldMappings', mappings)}
                      />
                    )}

                    {localConfig?.fieldConfigMode === 'field_values' && localConfig?.targetFormId && (
                      <CreateRecordFieldsConfig
                        targetFormId={localConfig.targetFormId}
                        triggerFormId={triggerFormId}
                        fieldValues={localConfig?.fieldValues || []}
                        onFieldValuesChange={(values) => handleConfigUpdate('fieldValues', values)}
                      />
                    )}
                  </>
                )}

                {localConfig?.crossReferenceFieldId && localConfig?.targetFormId && (
                  <div className="text-xs text-violet-700 bg-violet-50 p-3 rounded border border-violet-200">
                    <strong>Summary:</strong> Will create {localConfig.recordCount || 1} linked record{(localConfig.recordCount || 1) > 1 ? 's' : ''} in "{localConfig.targetFormName}" and update the "{localConfig.crossReferenceFieldName}" field in the parent form
                    {localConfig.fieldConfigMode === 'field_mapping' 
                      ? ` (mapping ${localConfig.fieldMappings?.length || 0} field${(localConfig.fieldMappings?.length || 0) !== 1 ? 's' : ''})`
                      : localConfig.fieldConfigMode === 'field_values' && (localConfig.fieldValues?.length || 0) > 0 
                        ? ` with ${localConfig.fieldValues.length} field value${localConfig.fieldValues.length > 1 ? 's' : ''}`
                        : ''}
                    {' | Status: '}{localConfig.initialStatus || 'pending'}
                    {' | By: '}{
                      localConfig.setSubmittedBy === 'system' 
                        ? 'System' 
                        : localConfig.setSubmittedBy === 'specific_user'
                          ? (organizationUsers.find(u => u.id === localConfig.specificSubmitterId)?.email || 'Selected User')
                          : 'Trigger Submitter'
                    }
                  </div>
                )}
              </>
            )}
              </div>
            )}
            
            {/* Update Linked Records Configuration */}
            {localConfig?.actionType === 'update_linked_records' && (
              <div className="space-y-4 border-t pt-4">
                <div className="text-xs text-teal-700 bg-teal-50 p-3 rounded border border-teal-200 mb-4">
                  <strong>Update Linked Records</strong> updates fields in records that are linked via a cross-reference field in the current form. The values from the trigger form's submission will be used to update the linked records.
                </div>

                {!triggerFormId ? (
                  <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded border border-amber-200">
                    Please configure the Start Node with a trigger form first, then <strong>save the workflow</strong>. The trigger form should contain the cross-reference field.
                  </div>
                ) : (
                  <>
                    <div>
                      <Label>Cross-Reference Field *</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Select the cross-reference field that links to the records you want to update
                      </p>
                      <FormFieldSelector
                        formId={triggerFormId}
                        value={localConfig?.crossReferenceFieldId || ''}
                        onValueChange={(fieldId, fieldName, fieldType, fieldOptions, customConfig) => {
                          const targetFormId = customConfig?.targetFormId;
                          const targetFormName = customConfig?.targetFormName;
                          
                          handleFullConfigUpdate({
                            ...localConfig,
                            crossReferenceFieldId: fieldId,
                            crossReferenceFieldName: fieldName,
                            targetFormId: targetFormId || localConfig?.targetFormId,
                            targetFormName: targetFormName || localConfig?.targetFormName,
                            fieldMappings: [] // Reset field mappings when cross-reference changes
                          });
                        }}
                        placeholder="Select cross-reference field"
                        filterTypes={['cross-reference']}
                      />
                    </div>

                    {localConfig?.crossReferenceFieldId && (
                      <>
                        <div>
                          <Label>Target Form (Linked Form)</Label>
                          <p className="text-xs text-muted-foreground mb-2">
                            {localConfig?.targetFormId 
                              ? `Auto-detected from cross-reference: ${localConfig.targetFormName || 'Unknown'}`
                              : 'Will be auto-detected from cross-reference field'
                            }
                          </p>
                          {!localConfig?.targetFormId && (
                            <FormSelector
                              value={localConfig?.targetFormId || ''}
                              onValueChange={(formId, formName) => {
                                handleFullConfigUpdate({ 
                                  ...localConfig, 
                                  targetFormId: formId,
                                  targetFormName: formName,
                                  fieldMappings: []
                                });
                              }}
                              placeholder="Select target form (if not auto-detected)"
                              projectId={projectId}
                            />
                          )}
                          {localConfig?.targetFormId && (
                            <div className="text-sm p-2 bg-muted rounded">
                              {localConfig.targetFormName || localConfig.targetFormId}
                            </div>
                          )}
                        </div>

                        <div>
                          <Label>Update Scope *</Label>
                          <Select
                            value={localConfig?.updateScope || 'all'}
                            onValueChange={(value) => handleConfigUpdate('updateScope', value)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select update scope" />
                            </SelectTrigger>
                            <SelectContent className="bg-background z-50">
                              <SelectItem value="all">All Linked Records</SelectItem>
                              <SelectItem value="first">First Linked Record Only</SelectItem>
                              <SelectItem value="last">Last Linked Record Only</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            Choose which linked records to update when there are multiple
                          </p>
                        </div>

                        {localConfig?.targetFormId && (
                          <div>
                            <Label>Field Mappings *</Label>
                            <p className="text-xs text-muted-foreground mb-2">
                              Map fields from the trigger form to the linked records
                            </p>
                            <FieldMappingConfig
                              triggerFormId={triggerFormId}
                              targetFormId={localConfig.targetFormId}
                              fieldMappings={localConfig?.fieldMappings || []}
                              onFieldMappingsChange={(mappings) => handleConfigUpdate('fieldMappings', mappings)}
                            />
                          </div>
                        )}
                      </>
                    )}

                    {localConfig?.crossReferenceFieldId && localConfig?.targetFormId && (localConfig?.fieldMappings?.length || 0) > 0 && (
                      <div className="text-xs text-teal-700 bg-teal-50 p-3 rounded border border-teal-200">
                        <strong>Summary:</strong> Will update {localConfig.updateScope === 'all' ? 'all' : localConfig.updateScope === 'first' ? 'the first' : 'the last'} linked record{localConfig.updateScope === 'all' ? 's' : ''} in "{localConfig.targetFormName}" using {localConfig.fieldMappings.length} field mapping{localConfig.fieldMappings.length !== 1 ? 's' : ''} from the trigger form
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Create Combination Records Configuration */}
            {localConfig?.actionType === 'create_combination_records' && (
              <div className="space-y-4 border-t pt-4">
                <CreateCombinationRecordsConfig
                  config={localConfig}
                  triggerFormId={triggerFormId}
                  triggerFormName={triggerFormName}
                  projectId={projectId}
                  onConfigChange={(newConfig) => handleFullConfigUpdate({ ...localConfig, ...newConfig })}
                />
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
                projectId={projectId}
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
                value={localConfig?.actionType || 'approve_form'} 
                onValueChange={(value) => handleConfigUpdate('actionType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignment type" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
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
                <SelectContent className="bg-background z-50">
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
                    <SelectContent className="bg-background z-50">
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
                  <SelectContent className="bg-background z-50">
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
                <SelectContent className="bg-background z-50">
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
        
        <div>
          <Label htmlFor="nodeDescription">Description</Label>
          <Textarea
            id="nodeDescription"
            value={localConfig?.description || ''}
            onChange={(e) => {
              if (e.target.value.length <= 70 || e.target.value.length < (localConfig?.description || '').length) {
                handleConfigUpdate('description', e.target.value);
              }
            }}
            placeholder="Add context or notes about this node (max 70 characters)"
            rows={2}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {(localConfig?.description || '').length}/70 characters
          </p>
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
              
              <div>
                <Label htmlFor="nodeDescriptionExpanded">Description</Label>
                <Textarea
                  id="nodeDescriptionExpanded"
                  value={localConfig?.description || ''}
                  onChange={(e) => {
                    if (e.target.value.length <= 70 || e.target.value.length < (localConfig?.description || '').length) {
                      handleConfigUpdate('description', e.target.value);
                    }
                  }}
                  placeholder="Add context or notes about this node (max 70 characters)"
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {(localConfig?.description || '').length}/70 characters
                </p>
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
    <Card className="w-80 h-fit max-h-[calc(100vh-200px)] overflow-y-auto absolute right-4 top-1/2 -translate-y-1/2 z-10 shadow-lg border bg-card">
      {panelContent}
    </Card>
  );
}

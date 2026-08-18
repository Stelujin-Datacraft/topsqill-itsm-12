
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { DesktopOnlyNotice } from '@/components/DesktopOnlyNotice';
import { WorkflowDesigner } from '@/components/workflows/WorkflowDesigner';
import { WorkflowInstances } from '@/components/workflows/WorkflowInstances';
import { WorkflowSettingsPanel } from '@/components/workflows/WorkflowSettingsPanel';

import { useWorkflowData } from '@/hooks/useWorkflowData';
import { useAuth } from '@/contexts/AuthContext';
import { TriggerService } from '@/services/triggerService';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, ArrowLeft, Activity, Play, Loader2, Sparkles, Settings } from 'lucide-react';
import { WorkflowNode, WorkflowConnection } from '@/types/workflow';
import { useToast } from '@/hooks/use-toast';
import { AIWorkflowSuggester } from '@/components/ai/AIWorkflowSuggester';
import { backend as supabase } from '@/services/api';
import { normalizeRelativeDateCondition } from '@/utils/conditionOperators';
import { normalizeAiWorkflowNodeConfig } from '@/lib/normalizeAiWorkflowNodes';

const WorkflowDesignerPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loadWorkflowNodes, saveWorkflowNodes, workflows } = useWorkflowData();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Simple local state for workflow data
  const [workflowData, setWorkflowData] = useState<{
    nodes: WorkflowNode[];
    connections: WorkflowConnection[];
  }>({
    nodes: [],
    connections: []
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('designer');
  const [availableForms, setAvailableForms] = useState<Array<{ id: string; name: string; fields?: Array<{ id: string; label: string; type: string; options?: Array<{ id: string; value: string; label: string }>; crossRefConfig?: { targetFormId: string; targetFormName: string; targetFormFields?: Array<{ id: string; label: string; type: string; options?: Array<{ id: string; value: string; label: string }> }> } }> }>>([]);
  
  // Enrollment settings state
  const [enrollmentMode, setEnrollmentMode] = useState<'allow_always' | 'once_per_record' | 'cooldown'>('allow_always');
  const [enrollmentCooldownHours, setEnrollmentCooldownHours] = useState(24);
  const [notifyOnFailure, setNotifyOnFailure] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Get current workflow info
  const currentWorkflow = workflows.find(w => w.id === id);

  // Check if workflow has manual trigger
  const isManualTrigger = workflowData.nodes.some(
    node => node.type === 'start' && node.data?.config?.triggerType === 'manual'
  );

  // Run workflow manually
  const handleRunWorkflow = async () => {
    if (!id || !user?.id) return;
    
    setRunning(true);
    try {
      const executionId = await TriggerService.handleManualTrigger(id, {
        triggeredAt: new Date().toISOString(),
        triggeredFrom: 'workflow_designer'
      }, user.id);
      
      toast({
        title: "Workflow Started",
        description: `Workflow execution started. ID: ${executionId?.slice(0, 8)}...`,
      });
      
      // Switch to execution history tab
      setActiveTab('instances');
    } catch (error) {
      console.error('Error running workflow:', error);
      toast({
        title: "Failed to run workflow",
        description: "Could not start workflow execution. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  // Load workflow data and settings only once on mount - loadWorkflowNodes is now memoized
  useEffect(() => {
    let isMounted = true;
    
    const loadWorkflowDataOnce = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        console.log('Loading workflow data for ID:', id);
        
        // Load workflow data and settings in parallel
        const [workflowNodesData, settingsResult] = await Promise.all([
          loadWorkflowNodes(id),
          supabase
            .from('workflows')
            .select('enrollment_mode, enrollment_cooldown_hours, notify_on_failure')
            .eq('id', id)
            .single()
        ]);
        
        if (!isMounted) return;

        console.log('Loaded workflow data:', { nodes: workflowNodesData.nodes.length, connections: workflowNodesData.connections.length });
        
        setWorkflowData(workflowNodesData);
        
        if (settingsResult.data) {
          const mode = settingsResult.data.enrollment_mode as 'allow_always' | 'once_per_record' | 'cooldown' | null;
          setEnrollmentMode(mode || 'allow_always');
          setEnrollmentCooldownHours(settingsResult.data.enrollment_cooldown_hours || 24);
          setNotifyOnFailure(settingsResult.data.notify_on_failure ?? true);
          setSettingsLoaded(true);
        }
      } catch (error) {
        console.error('Error loading workflow data:', error);
        if (isMounted) {
          toast({
            title: "Error loading workflow",
            description: "Failed to load workflow data. Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadWorkflowDataOnce();
    
    return () => {
      isMounted = false;
    };
  }, [id, loadWorkflowNodes, toast]);

  // Save enrollment settings when they change
  const handleEnrollmentModeChange = async (mode: 'allow_always' | 'once_per_record' | 'cooldown') => {
    if (!id) return;
    
    setEnrollmentMode(mode);
    
    const { error } = await supabase
      .from('workflows')
      .update({ enrollment_mode: mode })
      .eq('id', id);
    
    if (error) {
      console.error('Error saving enrollment mode:', error);
      toast({
        title: "Failed to save setting",
        description: "Could not update enrollment mode.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Setting saved",
        description: `Enrollment mode set to "${mode.replace(/_/g, ' ')}"`,
      });
    }
  };

  const handleCooldownHoursChange = async (hours: number) => {
    if (!id) return;
    
    setEnrollmentCooldownHours(hours);
    
    const { error } = await supabase
      .from('workflows')
      .update({ enrollment_cooldown_hours: hours })
      .eq('id', id);
    
    if (error) {
      console.error('Error saving cooldown hours:', error);
    }
  };

  const handleNotifyOnFailureChange = async (value: boolean) => {
    if (!id) return;
    setNotifyOnFailure(value);
    const { error } = await supabase
      .from('workflows')
      .update({ notify_on_failure: value })
      .eq('id', id);
    if (error) {
      console.error('Error saving notify_on_failure:', error);
      toast({
        title: 'Failed to save setting',
        description: 'Could not update failure notification preference.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Setting saved',
        description: `Failure notifications ${value ? 'enabled' : 'disabled'}.`,
      });
    }
  };

  // Save workflow to database and update local state
  const handleSave = async (nodes: WorkflowNode[], connections: WorkflowConnection[]) => {
    if (!id) return;
    
    setSaving(true);
    console.log('Saving workflow to database...');
    
    try {
      const success = await saveWorkflowNodes(id, nodes, connections);
      
      if (success) {
        toast({
          title: "Workflow saved",
          description: "Your workflow has been saved successfully.",
        });
        
        // Update local state to reflect saved state
        setWorkflowData({ nodes: [...nodes], connections: [...connections] });
      } else {
        toast({
          title: "Save failed",
          description: "Failed to save workflow. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast({
        title: "Save failed",
        description: "Failed to save workflow. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBackToList = () => {
    navigate('/workflows');
  };

  // Fetch available forms with fields for AI context
  useEffect(() => {
    const fetchForms = async () => {
      try {
        const { data: forms, error } = await supabase
          .from('forms')
          .select('id, name')
          .in('status', ['active', 'published', 'draft'])
          .order('name');
        
        if (error || !forms) return;

        const formsWithFields = await Promise.all(
          forms.map(async (form) => {
            const { data: fields } = await supabase
              .from('form_fields')
              .select('id, label, field_type, options, custom_config')
              .eq('form_id', form.id)
              .order('field_order');
            
            // For cross-reference fields, fetch linked form info
            const enrichedFields = await Promise.all(
              (fields || []).map(async (f) => {
                const base = {
                  id: f.id,
                  label: f.label,
                  type: f.field_type,
                  options: Array.isArray(f.options) 
                    ? (f.options as Array<{ id?: string; value: string; label: string }>).map(o => ({ id: o.id || o.value, value: o.value, label: o.label }))
                    : undefined,
                  crossRefConfig: undefined as any
                };

                if ((f.field_type === 'cross-reference' || f.field_type === 'child-cross-reference') && f.custom_config) {
                  const config = f.custom_config as any;
                  const targetFormId = config?.targetFormId;
                  if (targetFormId) {
                    // Fetch linked form name and fields
                    const [formRes, fieldsRes] = await Promise.all([
                      supabase.from('forms').select('id, name').eq('id', targetFormId).single(),
                      supabase.from('form_fields').select('id, label, field_type, options').eq('form_id', targetFormId).order('field_order')
                    ]);
                    
                    base.crossRefConfig = {
                      targetFormId,
                      targetFormName: formRes.data?.name || 'Unknown Form',
                      targetFormFields: (fieldsRes.data || []).map(tf => ({
                        id: tf.id,
                        label: tf.label,
                        type: tf.field_type,
                        options: Array.isArray(tf.options)
                          ? (tf.options as Array<{ id?: string; value: string; label: string }>).map(o => ({ id: o.id || o.value, value: o.value, label: o.label }))
                          : undefined
                      }))
                    };
                  }
                }

                return base;
              })
            );

            return {
              id: form.id,
              name: form.name,
              fields: enrichedFields
            };
          })
        );

        setAvailableForms(formsWithFields);
      } catch (err) {
        console.error('Error fetching forms for AI:', err);
      }
    };

    fetchForms();
  }, []);


  if (loading) {
    return (
      <DashboardLayout title="Workflow Designer">
        <div className="flex items-center justify-center h-full">
          <div>Loading workflow...</div>
        </div>
      </DashboardLayout>
    );
  }

  // Valid node types in our system
  const VALID_NODE_TYPES = ['start', 'action', 'condition', 'wait', 'end'];

  // Map AI-generated node types to valid types
  const mapNodeType = (aiType: string): string => {
    const typeMap: Record<string, string> = {
      'form-assignment': 'action',
      'notification': 'action',
      'approval': 'action',
      'email': 'action',
      'trigger': 'start',
      'branch': 'condition',
      'decision': 'condition',
      'delay': 'wait',
      'pause': 'wait',
      'stop': 'end',
      'finish': 'end',
      'complete': 'end',
    };
    
    const normalized = aiType.toLowerCase().replace(/\s+/g, '-');
    if (VALID_NODE_TYPES.includes(normalized)) {
      return normalized;
    }
    return typeMap[normalized] || 'action'; // Default to action for unknown types
  };

  // Normalize AI-generated config to match our expected structure
  const normalizeNodeConfig = (nodeType: string, aiConfig: Record<string, any>, triggerForm?: { id: string; name: string } | null): Record<string, any> => {
    // Shared AI→designer normalization (start form, change_field_value, conditions)
    let config = normalizeAiWorkflowNodeConfig(nodeType, aiConfig || {}, {
      triggerFormId: triggerForm?.id,
      triggerFormName: triggerForm?.name,
    });

    switch (nodeType) {
      case 'start':
        // Ensure triggerType has a valid value
        if (!config.triggerType) {
          config.triggerType = 'form_submission';
        }
       // Ensure form info is present for display
       if (triggerForm && !config.triggerFormId) {
         config.triggerFormId = triggerForm.id;
         config.triggerFormName = triggerForm.name;
       }
        break;
        
      case 'action':
        // Normalize action type variations
        if (!config.actionType) {
          // Infer from config structure
          if (config.notificationConfig || config.message || config.recipients) {
            config.actionType = 'send_notification';
          } else if (config.fieldUpdates || config.targetFieldId) {
            config.actionType = 'change_field_value';
          } else if (config.targetFormId && config.fieldMappings) {
            config.actionType = 'create_record';
          } else {
            config.actionType = 'send_notification'; // Default
          }
        }
        
        // Normalize notification config if present
        if (config.actionType === 'send_notification' && !config.notificationConfig) {
          config.notificationConfig = {
           type: config.notificationType || config.type || 'email',
           subject: config.subject || config.emailSubject || 'Workflow Notification',
           message: config.message || config.body || config.emailBody || 'This is an automated notification from the workflow.',
            recipientConfig: config.recipientConfig || {
             type: config.recipientType || 'submitter'
            }
          };
        }
       
       // Normalize change_field_value config
       if (config.actionType === 'change_field_value') {
         if (!config.targetFormId && triggerForm) {
           config.targetFormId = triggerForm.id;
           config.targetFormName = triggerForm.name;
         }
         // Ensure fieldUpdates array exists
         if (!config.fieldUpdates && (config.fieldId || config.targetFieldId)) {
           config.fieldUpdates = [{
             targetFieldId: config.targetFieldId || config.fieldId,
             targetFieldName: config.targetFieldName || config.fieldLabel || config.fieldId,
             targetFieldType: config.targetFieldType || config.fieldType,
             targetFieldOptions: config.targetFieldOptions,
             value: config.value || config.newValue || config.staticValue || '',
             staticValue: config.staticValue ?? config.value ?? config.newValue ?? '',
             valueType: config.valueType || 'static'
           }];
         }
         // Set display-friendly properties (prefer targetField* keys used by the config UI)
         if (config.fieldUpdates && config.fieldUpdates[0]) {
           const first = config.fieldUpdates[0];
           config.targetFieldId = first.targetFieldId || first.fieldId || config.targetFieldId;
           config.targetFieldName = first.targetFieldName || first.fieldLabel || first.fieldId || config.targetFieldName;
           config.targetFieldType = first.targetFieldType || first.fieldType || config.targetFieldType;
           config.targetFieldOptions = first.targetFieldOptions || config.targetFieldOptions;
           config.staticValue = first.staticValue ?? first.value ?? config.staticValue;
           config.valueType = first.valueType || config.valueType || 'static';
           // Keep fieldUpdates in the shape ChangeFieldValueConfig expects
           first.targetFieldId = config.targetFieldId;
           first.targetFieldName = config.targetFieldName;
           if (config.targetFieldType) first.targetFieldType = config.targetFieldType;
           if (config.targetFieldOptions) first.targetFieldOptions = config.targetFieldOptions;
           first.valueType = config.valueType;
           if (first.staticValue === undefined && first.value !== undefined) {
             first.staticValue = first.value;
           }
         }
       }
       
       // Normalize create_record config
       if (config.actionType === 'create_record') {
         if (!config.recordCount) {
           config.recordCount = 1;
         }
         if (!config.targetFormName && config.targetFormId) {
           config.targetFormName = 'Target Form';
         }
       }

       // Normalize create_linked_record config
       if (config.actionType === 'create_linked_record') {
         if (!config.recordCount) config.recordCount = 1;
         if (!config.targetFormName && config.targetFormId) config.targetFormName = 'Linked Form';
         if (!config.fieldConfigMode) config.fieldConfigMode = config.fieldMappings?.length ? 'field_mapping' : 'none';
       }

       // Normalize update_linked_records config
       if (config.actionType === 'update_linked_records') {
         if (!config.updateScope) config.updateScope = 'all';
         if (!config.targetFormName && config.targetFormId) config.targetFormName = 'Linked Form';
       }

       // Normalize create_combination_records config
       if (config.actionType === 'create_combination_records') {
         if (!config.combinationMode) config.combinationMode = 'single';
         if (!config.targetFormName && config.targetFormId) config.targetFormName = 'Target Form';
       }
        break;
        
      case 'condition':
       // Ensure enhancedCondition structure exists with proper display info
        if (!config.enhancedCondition && config.condition) {
          // Convert simple condition to enhanced format
          const simpleCondition = config.condition;
          const dateNorm = normalizeRelativeDateCondition(
            simpleCondition.fieldType || 'text',
            simpleCondition.operator || '==',
            simpleCondition.value || '',
          );
          config.enhancedCondition = {
            systemType: 'field_level',
            conditions: [{
              id: `cond_${Date.now()}`,
              systemType: 'field_level',
              fieldLevelCondition: {
                id: `flc_${Date.now()}`,
               formId: simpleCondition.formId || triggerForm?.id || '',
                fieldId: simpleCondition.fieldId || simpleCondition.field || '',
                fieldLabel: simpleCondition.fieldLabel || simpleCondition.field || '',
                fieldType: simpleCondition.fieldType || 'text',
                operator: dateNorm.operator,
                value: dateNorm.value ?? ''
              }
            }]
          };
       } else if (!config.enhancedCondition && config.fieldId) {
         // Build from flat config
         const dateNorm = normalizeRelativeDateCondition(
           config.fieldType || 'text',
           config.operator || '==',
           config.value || '',
         );
         config.enhancedCondition = {
           systemType: 'field_level',
           conditions: [{
             id: `cond_${Date.now()}`,
             systemType: 'field_level',
             fieldLevelCondition: {
               id: `flc_${Date.now()}`,
               formId: config.formId || triggerForm?.id || '',
               fieldId: config.fieldId,
               fieldLabel: config.fieldLabel || config.fieldId,
               fieldType: config.fieldType || 'text',
               operator: dateNorm.operator,
               value: dateNorm.value ?? ''
             }
           }]
         };
        } else if (config.enhancedCondition) {
          // Normalize relative date phrases already present (Equals + "today" → is_today)
          const enhanced = config.enhancedCondition;
          const normalizeFlc = (flc: any) => {
            if (!flc) return flc;
            const dateNorm = normalizeRelativeDateCondition(
              flc.fieldType || config.fieldType || 'date',
              flc.operator || '==',
              flc.value,
            );
            return {
              ...flc,
              formId: flc.formId || triggerForm?.id || config.formId || '',
              operator: dateNorm.operator,
              value: dateNorm.value ?? '',
            };
          };
          if (Array.isArray(enhanced.conditions)) {
            enhanced.conditions = enhanced.conditions.map((item: any) => ({
              ...item,
              fieldLevelCondition: normalizeFlc(item.fieldLevelCondition),
            }));
            const first = enhanced.conditions[0]?.fieldLevelCondition;
            if (first) {
              config.fieldId = first.fieldId;
              config.fieldLabel = first.fieldLabel;
              config.fieldType = first.fieldType;
              config.operator = first.operator;
              config.value = first.value;
              config.formId = first.formId;
            }
          } else if (enhanced.fieldLevelCondition) {
            enhanced.fieldLevelCondition = normalizeFlc(enhanced.fieldLevelCondition);
          }
        }
        break;
        
      case 'wait':
        // Ensure wait config has required fields
        if (!config.waitType) {
          config.waitType = 'duration';
        }
        if (config.waitType === 'duration') {
          config.durationValue = config.durationValue || config.waitDuration || 1;
          config.durationUnit = config.durationUnit || config.waitUnit || 'hours';
        }
        break;
        
      case 'end':
        // Ensure end status
        if (!config.endStatus) {
          config.endStatus = 'completed';
        }
       if (!config.summary) {
         config.summary = 'Workflow completed';
       }
        break;
    }
    
    return config;
  };

  // Handle AI workflow suggestions
  const handleAIWorkflowApply = (suggestion: {
    name: string;
    description: string;
    nodes: Array<{
      type: string;
      label: string;
      description?: string;
      config: Record<string, any>;
      connections?: Array<{ to: string; condition?: string }>;
      tempId?: string;
    }>;
  }) => {
   // Try to extract trigger form info from the first start node config if available
   const startNode = suggestion.nodes.find(n => n.type.toLowerCase() === 'start' || n.type.toLowerCase() === 'trigger');
   const startFormId = startNode?.config?.triggerFormId || startNode?.config?.formId;
   const matchedAvailable = startFormId
     ? availableForms.find((f) => f.id === startFormId)
     : undefined;
   const triggerFormInfo = startFormId ? {
     id: startFormId,
     name: startNode?.config?.triggerFormName || matchedAvailable?.name || 'Trigger Form'
   } : null;
   
    // Convert AI suggestions to workflow format with valid node types and normalized configs
    const newNodes: WorkflowNode[] = suggestion.nodes.map((node, index) => {
      const nodeType = mapNodeType(node.type);
     const normalizedConfig = normalizeNodeConfig(nodeType, node.config || {}, triggerFormInfo);
      
      // Calculate positions - condition nodes need more space for branches
      const yOffset = 100 + index * 150;
      const xOffset = nodeType === 'condition' ? 350 : 250;
      
      return {
        id: crypto.randomUUID(),
        type: nodeType as any,
        label: node.label,
        position: { x: xOffset, y: yOffset },
        data: { 
          config: normalizedConfig,
          description: node.description || ''
        }
      };
    });

    // Build connections from node.connections with proper edge handling
    const newConnections: WorkflowConnection[] = [];
    let unresolvedEdges = 0;

    suggestion.nodes.forEach((node, sourceIndex) => {
      const sourceNode = newNodes[sourceIndex];

      if (node.connections && node.connections.length > 0) {
        let resolvedAny = false;
        node.connections.forEach((conn) => {
          // Resolve by label OR tempId (node_N) after AI remapping
          const targetIndex = suggestion.nodes.findIndex((n, idx) => {
            const to = String(conn.to || '').toLowerCase();
            return n.label.toLowerCase() === to
              || `node_${idx}` === to
              || String((n as any).tempId || '').toLowerCase() === to;
          });

          if (targetIndex !== -1) {
            resolvedAny = true;
            const targetNode = newNodes[targetIndex];
            const conditionRaw = String(
              (conn as any).conditionType || conn.condition || (conn as any).sourceHandle || '',
            ).toLowerCase();

            // Determine source handle for condition nodes
            let sourceHandle: string | undefined;
            if (sourceNode.type === 'condition' && (conditionRaw === 'true' || conditionRaw === 'false')) {
              sourceHandle = conditionRaw;
            }

            newConnections.push({
              id: crypto.randomUUID(),
              source: sourceNode.id,
              target: targetNode.id,
              sourceHandle,
              label: sourceNode.type === 'condition' ? conditionRaw || undefined : undefined,
            });
          } else {
            unresolvedEdges += 1;
          }
        });

        // If declared edges failed to resolve, fall back to sequential connect
        if (!resolvedAny && sourceNode.type !== 'end' && sourceIndex < suggestion.nodes.length - 1) {
          const nextNode = newNodes[sourceIndex + 1];
          newConnections.push({
            id: crypto.randomUUID(),
            source: sourceNode.id,
            target: nextNode.id,
          });
        }
      } else if (sourceNode.type !== 'end' && sourceIndex < suggestion.nodes.length - 1) {
        // Auto-connect sequential nodes if no connections specified (except for end nodes)
        const nextNode = newNodes[sourceIndex + 1];
        newConnections.push({
          id: crypto.randomUUID(),
          source: sourceNode.id,
          target: nextNode.id,
        });
      }
    });

    if (unresolvedEdges > 0) {
      console.warn(`AI workflow apply: ${unresolvedEdges} connection target(s) could not be resolved`);
    }

    console.log('🤖 AI Workflow Applied:', { 
      nodes: newNodes.length, 
      connections: newConnections.length,
      nodeTypes: newNodes.map(n => n.type)
    });

    // Update local state
    setWorkflowData({ nodes: newNodes, connections: newConnections });
    
    toast({
      title: "AI Workflow Applied",
      description: `Created ${newNodes.length} nodes with ${newConnections.length} connections. Configure each node as needed.`,
    });
  };

  return (
    <DashboardLayout 
      title={`Workflow Designer${currentWorkflow ? ` - ${currentWorkflow.name}` : ''}`}
      actions={
        <div className="flex space-x-2">
          <AIWorkflowSuggester
            onApply={handleAIWorkflowApply}
            availableForms={availableForms}
            existingNodes={workflowData.nodes.map(n => ({ id: n.id, type: n.type, label: n.label }))}
            buttonLabel="AI Suggest"
            buttonVariant="outline"
            buttonSize="default"
          />
          {isManualTrigger && (
            <Button 
              variant="default" 
              onClick={handleRunWorkflow}
              disabled={running}
            >
              {running ? (
                <Loader2 className="icon-md mr-2 animate-spin" />
              ) : (
                <Play className="icon-md mr-2" />
              )}
              {running ? 'Running...' : 'Run Workflow'}
            </Button>
          )}
          <Button variant="outline" onClick={handleBackToList}>
            <ArrowLeft className="icon-md mr-2 text-module-workflows" />
            Back to Workflows
          </Button>
        </div>
      }
    >
      <DesktopOnlyNotice
        toolName="Workflow Designer"
        description="Designing workflows requires drag-and-drop on a wide canvas. Please use a tablet or desktop."
      >
      <div className="h-[calc(100vh-140px)] flex flex-col">
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="designer" className="flex items-center space-x-2">
              <Save className="icon-md" />
              <span>Designer</span>
            </TabsTrigger>
            <TabsTrigger value="instances" className="flex items-center space-x-2">
              <Activity className="icon-md" />
              <span>Execution History</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="icon-md" />
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="designer" className="flex-1">
            <WorkflowDesigner
              workflowId={id}
              projectId={currentWorkflow?.projectId}
              initialNodes={workflowData.nodes}
              initialConnections={workflowData.connections}
              onSave={handleSave}
            />
          </TabsContent>

          <TabsContent value="instances" className="flex-1">
            <WorkflowInstances workflowId={id} />
          </TabsContent>

          <TabsContent value="settings" className="flex-1 overflow-auto">
            <WorkflowSettingsPanel
              enrollmentMode={enrollmentMode}
              enrollmentCooldownHours={enrollmentCooldownHours}
              onEnrollmentModeChange={handleEnrollmentModeChange}
              onCooldownHoursChange={handleCooldownHoursChange}
              notifyOnFailure={notifyOnFailure}
              onNotifyOnFailureChange={handleNotifyOnFailureChange}
            />
          </TabsContent>
        </Tabs>
      </div>
      </DesktopOnlyNotice>
    </DashboardLayout>
  );
};

export default WorkflowDesignerPage;
